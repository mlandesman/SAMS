import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileInvoice,
  faLink,
  faBan,
  faEye,
  faEdit,
  faClipboardCheck
} from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { getAccounts } from '../api/client';
import {
  createSession,
  importBankFile,
  runMatching,
  getWorkbench,
  manualPair,
  excludeReconciliationItem,
  acceptSession,
  updateSession,
  resolveException
} from '../api/reconciliation';
import { getMexicoDateString, formatDateInMexico } from '../utils/timezone';
import { formatCurrency } from '@shared/utils/currencyUtils';
import TransactionDetailModal from '../components/TransactionDetailModal';

/** Normalized bank rows and workbench SAMS txns use integer centavos (Firestore storage). Shared formatCurrency divides by 100. */
function formatWorkbenchCentavos(centavos) {
  return formatCurrency(Math.round(Number(centavos) || 0), 'MXN');
}

/** Workbench pool txns are raw Firestore shapes; list APIs use enriched date objects. */
function formatWorkbenchSamsDate(t) {
  const d = t?.date;
  if (d == null) return '—';
  if (typeof d === 'object') {
    if (d.display) return d.display;
    if (d.unambiguous_long_date) return d.unambiguous_long_date;
    if (typeof d.toDate === 'function') {
      const dt = d.toDate();
      if (Number.isNaN(dt.getTime())) return '—';
      return formatDateInMexico(dt) || '—';
    }
    const sec = d.seconds ?? d._seconds;
    if (sec != null) {
      const dt = new Date(sec * 1000);
      if (Number.isNaN(dt.getTime())) return '—';
      return formatDateInMexico(dt) || '—';
    }
  }
  if (typeof d === 'string' || typeof d === 'number') {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return formatDateInMexico(dt) || '—';
  }
  return '—';
}
import { isAdmin } from '../utils/userRoles';
import './ReconciliationView.css';

/** Mirror backend reconciliationMatcher.typeMatchesBank for workbench sum preview */
function typeMatchesBankWorkbench(bankType, txn) {
  const t = txn?.type;
  const amt = Number(txn?.amount) || 0;
  if (bankType === 'ABONO') {
    if (t === 'income') return amt > 0;
    if (t === 'adjustment') return amt > 0;
    return false;
  }
  if (bankType === 'CARGO') {
    if (t === 'expense') return amt < 0;
    if (t === 'adjustment') return amt < 0;
    return false;
  }
  return false;
}

function inferBankFormat(accountName, explicit) {
  if (explicit === 'scotiabank' || explicit === 'bbva') return explicit;
  const n = String(accountName || '').toLowerCase();
  if (n.includes('scotia') || n.includes('scotiabank')) return 'scotiabank';
  if (n.includes('bbva')) return 'bbva';
  return '';
}

export default function ReconciliationView() {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = selectedClient?.id;

  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [bankFormat, setBankFormat] = useState('scotiabank');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(() => getMexicoDateString());
  const [openingBalance, setOpeningBalance] = useState('');
  const [endingBalance, setEndingBalance] = useState('');
  const [bankFile, setBankFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /** Session id is URL-driven (?session=) so back/forward and shared links stay consistent */
  const sessionId = searchParams.get('session') || '';
  const setSessionParam = (id) => {
    if (id) setSearchParams({ session: id }, { replace: true });
    else setSearchParams({}, { replace: true });
  };

  const [wb, setWb] = useState(null);
  const [diffPesos, setDiffPesos] = useState('0');

  const [selectedBankIds, setSelectedBankIds] = useState([]);
  const [selectedTxnIds, setSelectedTxnIds] = useState([]);
  const [viewTxn, setViewTxn] = useState(null);
  const [excludeModal, setExcludeModal] = useState({ open: false, type: null, id: null });
  const [excludeReason, setExcludeReason] = useState('');
  const [justifyModal, setJustifyModal] = useState({ open: false, transactionId: null });
  const [justifyReason, setJustifyReason] = useState('');
  const [reportUrl, setReportUrl] = useState(null);

  const canUse = isAdmin(samsUser, clientId);
  const prevClientIdRef = useRef(undefined);

  useEffect(() => {
    if (
      prevClientIdRef.current !== undefined &&
      clientId !== undefined &&
      prevClientIdRef.current !== clientId
    ) {
      setSearchParams({}, { replace: true });
    }
    prevClientIdRef.current = clientId;

    setWb(null);
    setReportUrl(null);
    setSelectedBankIds([]);
    setSelectedTxnIds([]);
    setError('');
  }, [clientId, setSearchParams]);

  useEffect(() => {
    if (!clientId || !canUse) return;
    getAccounts(clientId)
      .then((list) => {
        setAccounts((list || []).filter((a) => a.type === 'bank' && a.active !== false));
      })
      .catch(() => setAccounts([]));
  }, [clientId, canUse]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  );

  useEffect(() => {
    if (selectedAccount) {
      const inf = inferBankFormat(selectedAccount.name, null);
      if (inf) setBankFormat(inf);
    }
  }, [selectedAccount]);

  const loadWorkbench = useCallback(async () => {
    if (!clientId || !sessionId) return;
    setBusy(true);
    setError('');
    setWb(null);
    try {
      const data = await getWorkbench(clientId, sessionId);
      setWb(data);
      setDiffPesos(String(data.session?.differenceAmount ?? 0));
    } catch (e) {
      setError(e.message || 'Failed to load workbench');
      setWb(null);
    } finally {
      setBusy(false);
    }
  }, [clientId, sessionId]);

  useEffect(() => {
    if (sessionId && clientId) {
      loadWorkbench();
    } else {
      setWb(null);
    }
  }, [sessionId, clientId, loadWorkbench]);

  const bankRowById = useMemo(() => {
    const m = {};
    (wb?.unmatchedBankDetails || []).forEach((r) => {
      m[r.id] = r;
    });
    return m;
  }, [wb]);

  const selectedBankTypes = useMemo(
    () => [...new Set(selectedBankIds.map((id) => bankRowById[id]?.type).filter(Boolean))],
    [selectedBankIds, bankRowById]
  );
  const bankTypeUnified =
    selectedBankTypes.length === 1 && (selectedBankTypes[0] === 'CARGO' || selectedBankTypes[0] === 'ABONO')
      ? selectedBankTypes[0]
      : null;

  const bankSumCentavos = useMemo(
    () =>
      selectedBankIds.reduce(
        (s, id) => s + Math.round(Number(bankRowById[id]?.amount) || 0),
        0
      ),
    [selectedBankIds, bankRowById]
  );

  const { txnSumComparable, txnTypesOk } = useMemo(() => {
    const list = wb?.availableSamsTransactions || [];
    const byId = Object.fromEntries(list.map((t) => [t.id, t]));
    if (!bankTypeUnified) {
      return { txnSumComparable: 0, txnTypesOk: false };
    }
    let ok = true;
    const sum = selectedTxnIds.reduce((s, id) => {
      const t = byId[id];
      if (!t) {
        ok = false;
        return s;
      }
      if (!typeMatchesBankWorkbench(bankTypeUnified, t)) {
        ok = false;
        return s;
      }
      const tc = Math.round(Number(t.amount) || 0);
      return s + Math.abs(tc);
    }, 0);
    return { txnSumComparable: sum, txnTypesOk: ok && selectedTxnIds.length > 0 };
  }, [wb, selectedTxnIds, bankTypeUnified]);

  const canMatchSelection =
    selectedBankIds.length > 0 &&
    selectedTxnIds.length > 0 &&
    bankTypeUnified &&
    txnTypesOk &&
    bankSumCentavos === txnSumComparable;

  const toggleBankRow = useCallback((id) => {
    setSelectedBankIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const toggleTxnRow = useCallback((id) => {
    setSelectedTxnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const runImportAndMatch = async () => {
    setError('');
    if (!clientId || !accountId || !startDate || !endDate || openingBalance === '' || endingBalance === '') {
      setError('Fill account, period dates, and balances.');
      return;
    }
    if (!bankFile) {
      setError('Bank file is required.');
      return;
    }
    setBusy(true);
    try {
      const session = await createSession(clientId, {
        accountId,
        startDate,
        endDate,
        openingBalance: Number(openingBalance),
        endingBalance: Number(endingBalance),
        bankFormat,
        differenceAmount: 0
      });
      await importBankFile(clientId, session.id, bankFile, pdfFile || null);
      await runMatching(clientId, session.id);
      setSessionParam(session.id);
    } catch (e) {
      setError(e.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const handlePair = async () => {
    if (!clientId || !sessionId || !canMatchSelection) {
      setError('Select one or more bank lines and SAMS transactions with identical total amounts (centavos).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await manualPair(clientId, sessionId, {
        normalizedRowIds: selectedBankIds,
        transactionIds: selectedTxnIds
      });
      setSelectedBankIds([]);
      setSelectedTxnIds([]);
      await loadWorkbench();
    } catch (e) {
      setError(e.message || 'Pair failed');
    } finally {
      setBusy(false);
    }
  };

  const handleJustifySubmit = async () => {
    if (!clientId || !sessionId || !justifyModal.transactionId || !justifyReason.trim()) return;
    setBusy(true);
    setError('');
    try {
      await resolveException(clientId, sessionId, {
        action: 'manual-justify',
        transactionId: justifyModal.transactionId,
        justification: justifyReason.trim()
      });
      setJustifyModal({ open: false, transactionId: null });
      setJustifyReason('');
      await loadWorkbench();
    } catch (e) {
      setError(e.message || 'Justify failed');
    } finally {
      setBusy(false);
    }
  };

  const handleExclude = async () => {
    if (!excludeModal.open || !excludeReason.trim()) return;
    setBusy(true);
    setError('');
    try {
      await excludeReconciliationItem(clientId, sessionId, {
        type: excludeModal.type,
        ...(excludeModal.type === 'bank'
          ? { normalizedRowId: excludeModal.id }
          : { transactionId: excludeModal.id }),
        reason: excludeReason.trim()
      });
      setExcludeModal({ open: false, type: null, id: null });
      setExcludeReason('');
      await loadWorkbench();
    } catch (e) {
      setError(e.message || 'Exclude failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!clientId || !sessionId) return;
    setBusy(true);
    setError('');
    try {
      await updateSession(clientId, sessionId, { differenceAmount: Number(diffPesos) || 0 });
      const res = await acceptSession(clientId, sessionId, {});
      setReportUrl(res.reconciliationReportUrl || null);
      await loadWorkbench();
    } catch (e) {
      setError(e.message || 'Accept failed');
    } finally {
      setBusy(false);
    }
  };

  if (!selectedClient) {
    return <p className="recon-page-muted">Select a client to use bank reconciliation.</p>;
  }

  if (!canUse) {
    return (
      <div className="recon-page-access">
        <h2>Bank reconciliation</h2>
        <p>Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="reconciliation-page">
      <header className="recon-page-header">
        <h1>
          <FontAwesomeIcon icon={faFileInvoice} /> Bank reconciliation
        </h1>
        <p className="recon-page-sub">
          Auto-match first, then manual <strong>many-to-many</strong> matches (totals must match in centavos), then{' '}
          <strong>Justify</strong> for SAMS lines with no bank line. When every bank line is resolved and every in-window
          SAMS line is matched, justified, or excluded — and difference is 0 — use Accept.{' '}
          <code>clearedDate</code> is set only on Accept.
        </p>
      </header>

      {error && <div className="recon-page-error">{error}</div>}

      {sessionId && !wb && !error && (
        <div className="recon-loading-panel" aria-busy="true">
          Loading workbench…
        </div>
      )}

      {!sessionId && (
        <section className="recon-setup-panel">
          <h2>1. Import &amp; match</h2>
          <div className="recon-form-grid">
            <label>
              Account
              <select
                className="recon-field-input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bank format
              <select
                className="recon-field-input"
                value={bankFormat}
                onChange={(e) => setBankFormat(e.target.value)}
              >
                <option value="scotiabank">ScotiaBank (CSV)</option>
                <option value="bbva">BBVA (XLSX)</option>
              </select>
            </label>
            <label>
              Period start
              <input
                type="date"
                className="recon-field-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label>
              Period end
              <input
                type="date"
                className="recon-field-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            <label>
              Opening balance (pesos)
              <input
                type="number"
                step="0.01"
                className="recon-field-input"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </label>
            <label>
              Ending balance (pesos)
              <input
                type="number"
                step="0.01"
                className="recon-field-input"
                value={endingBalance}
                onChange={(e) => setEndingBalance(e.target.value)}
              />
            </label>
            <label className="recon-span-2">
              Bank file
              <input
                type="file"
                className="recon-field-input"
                accept={bankFormat === 'bbva' ? '.xlsx,.xls' : '.csv'}
                onChange={(e) => setBankFile(e.target.files?.[0] || null)}
              />
            </label>
            <label className="recon-span-2">
              Statement PDF (optional)
              <input
                type="file"
                className="recon-field-input"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <button
            type="button"
            className="recon-primary-btn"
            disabled={busy}
            onClick={runImportAndMatch}
          >
            {busy ? 'Working…' : 'Import & match'}
          </button>
        </section>
      )}

      {sessionId && wb && (
        <section className="recon-workbench">
            <div className="recon-workbench-toolbar">
              <button type="button" className="recon-secondary-btn" onClick={loadWorkbench} disabled={busy}>
                Refresh
              </button>
              <button
                type="button"
                className="recon-secondary-btn"
                onClick={() => {
                  setSessionParam(null);
                  setWb(null);
                }}
              >
                New session
              </button>
            </div>

            <div className="recon-two-col">
              <div className="recon-col recon-col-bank">
                <h3>Unmatched bank lines</h3>
                <p className="recon-hint">
                  Read-only — select one or more rows (checkbox), then select SAMS line(s) on the right. Match only when
                  totals are equal.
                </p>
                <div className="recon-table-scroll">
                  <table className="recon-wb-table">
                    <thead>
                      <tr>
                        <th />
                        <th>Date</th>
                        <th>Type</th>
                        <th className="num">Amount</th>
                        <th>Description</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(wb.unmatchedBankDetails || []).map((row) => (
                        <tr
                          key={row.id}
                          className={selectedBankIds.includes(row.id) ? 'selected' : ''}
                          onClick={(e) => {
                            if (e.target.closest('button, input, label')) return;
                            toggleBankRow(row.id);
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedBankIds.includes(row.id)}
                              onChange={() => toggleBankRow(row.id)}
                              aria-label={`Select bank line ${row.id}`}
                            />
                          </td>
                          <td>{row.date || '—'}</td>
                          <td>{row.type || '—'}</td>
                          <td className="num">{formatWorkbenchCentavos(row.amount)}</td>
                          <td>{row.description || '—'}</td>
                          <td>
                            <button
                              type="button"
                              className="recon-icon-btn"
                              title="Exclude"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExcludeModal({ open: true, type: 'bank', id: row.id });
                              }}
                            >
                              <FontAwesomeIcon icon={faBan} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="recon-col recon-col-sams">
                <h3>Available SAMS transactions</h3>
                <p className="recon-hint">
                  Uncleared SAMS lines in this bank account — dates from{' '}
                  <strong>7 days before</strong> period start through <strong>7 days after</strong>{' '}
                  period end (same register window as Import &amp; Match). Select any number of rows; use{' '}
                  <strong>Justify</strong> if there is no bank line (e.g. $0.00 or off-statement).
                </p>
                <div className="recon-sams-actions">
                  <button
                    type="button"
                    className="recon-primary-btn"
                    disabled={busy || !canMatchSelection}
                    onClick={handlePair}
                  >
                    <FontAwesomeIcon icon={faLink} /> Match selected
                  </button>
                  <button
                    type="button"
                    className="recon-secondary-btn"
                    onClick={() => navigate('/add-expense')}
                  >
                    Add expense
                  </button>
                </div>
                <p className="recon-match-totals" aria-live="polite">
                  Bank selected: <strong>{formatWorkbenchCentavos(bankSumCentavos)}</strong>
                  {' · '}
                  SAMS comparable: <strong>{formatWorkbenchCentavos(txnSumComparable)}</strong>
                  {bankTypeUnified && (
                    <span className="recon-match-totals-meta"> ({bankTypeUnified})</span>
                  )}
                  {selectedBankIds.length > 0 &&
                    selectedTxnIds.length > 0 &&
                    !canMatchSelection && (
                      <span className="recon-match-totals-warn">
                        {' '}
                        — same bank type (all CARGO or all ABONO), compatible SAMS types, and matching totals
                        required.
                      </span>
                    )}
                </p>
                <div className="recon-table-scroll">
                  <table className="recon-wb-table">
                    <thead>
                      <tr>
                        <th />
                        <th>Date</th>
                        <th>Type</th>
                        <th className="num">Amount</th>
                        <th>Category</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(wb.availableSamsTransactions || []).map((t) => (
                        <tr
                          key={t.id}
                          className={selectedTxnIds.includes(t.id) ? 'selected' : ''}
                          onClick={(e) => {
                            if (e.target.closest('button, input, label')) return;
                            toggleTxnRow(t.id);
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedTxnIds.includes(t.id)}
                              onChange={() => toggleTxnRow(t.id)}
                              aria-label={`Select SAMS transaction ${t.id}`}
                            />
                          </td>
                          <td>{formatWorkbenchSamsDate(t)}</td>
                          <td>{t.type || '—'}</td>
                          <td className="num">{formatWorkbenchCentavos(t.amount)}</td>
                          <td>{t.categoryName || t.category || '—'}</td>
                          <td className="recon-actions-cell">
                            <button
                              type="button"
                              className="recon-icon-btn"
                              title="View"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewTxn(t);
                              }}
                            >
                              <FontAwesomeIcon icon={faEye} />
                            </button>
                            <button
                              type="button"
                              className="recon-icon-btn"
                              title="Edit in Transactions"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/transactions', { state: { highlightTransactionId: t.id } });
                              }}
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button
                              type="button"
                              className="recon-icon-btn"
                              title="Justify (no bank line — cleared on Accept with reason)"
                              onClick={(e) => {
                                e.stopPropagation();
                                setJustifyModal({ open: true, transactionId: t.id });
                                setJustifyReason('');
                              }}
                            >
                              <FontAwesomeIcon icon={faClipboardCheck} />
                            </button>
                            <button
                              type="button"
                              className="recon-icon-btn"
                              title="Exclude"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExcludeModal({ open: true, type: 'sams', id: t.id });
                              }}
                            >
                              <FontAwesomeIcon icon={faBan} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="recon-summary-bar">
              <span>
                Unmatched bank lines: <strong>{wb.stats?.unmatchedBankLineCount ?? 0}</strong>
              </span>
              <span>
                Available SAMS:{' '}
                <strong>{(wb.availableSamsTransactions || []).length}</strong>
              </span>
              <label>
                Difference (pesos, 0 to accept)
                <input
                  type="number"
                  step="0.01"
                  className="recon-diff-input"
                  value={diffPesos}
                  onChange={(e) => setDiffPesos(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="recon-primary-btn"
                disabled={
                  busy ||
                  (wb.session?.unmatchedBankRows || []).length > 0 ||
                  (wb.session?.unmatchedTransactions || []).length > 0 ||
                  Math.abs(Number(diffPesos) || 0) > 0.01 ||
                  wb.session?.accepted
                }
                onClick={handleAccept}
              >
                Accept statement
              </button>
            </div>
            {reportUrl && (
              <p className="recon-success">
                <a href={reportUrl} target="_blank" rel="noreferrer">
                  Download reconciliation PDF
                </a>
              </p>
            )}
          </section>
      )}

      {justifyModal.open && (
        <div
          className="recon-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setJustifyModal({ open: false, transactionId: null })}
        >
          <div className="recon-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Justify SAMS line (no bank match)</h4>
            <p className="recon-hint">
              Use for register-only activity (e.g. $0.00, cash movement, or not on this statement). A written reason is
              required; the line is marked cleared on Accept like matched lines.
            </p>
            <textarea
              className="recon-field-input"
              rows={3}
              placeholder="Justification (required)"
              value={justifyReason}
              onChange={(e) => setJustifyReason(e.target.value)}
            />
            <div className="recon-modal-actions">
              <button
                type="button"
                className="recon-secondary-btn"
                onClick={() => setJustifyModal({ open: false, transactionId: null })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="recon-primary-btn"
                disabled={!justifyReason.trim()}
                onClick={handleJustifySubmit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {excludeModal.open && (
        <div
          className="recon-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setExcludeModal({ open: false, type: null, id: null })}
        >
          <div className="recon-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Exclude from session</h4>
            <textarea
              className="recon-field-input"
              rows={3}
              placeholder="Reason (required)"
              value={excludeReason}
              onChange={(e) => setExcludeReason(e.target.value)}
            />
            <div className="recon-modal-actions">
              <button
                type="button"
                className="recon-secondary-btn"
                onClick={() => setExcludeModal({ open: false, type: null, id: null })}
              >
                Cancel
              </button>
              <button type="button" className="recon-primary-btn" onClick={handleExclude}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <TransactionDetailModal
        transaction={viewTxn}
        isOpen={!!viewTxn}
        onClose={() => setViewTxn(null)}
        clientId={clientId}
      />
    </div>
  );
}
