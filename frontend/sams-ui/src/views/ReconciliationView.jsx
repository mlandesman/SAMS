import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileInvoice,
  faLink,
  faBan,
  faEye,
  faEdit,
  faClipboardCheck,
  faCoins,
  faFilePdf
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
  applyMatchGapAdjustment,
  regenerateReconciliationReport,
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

/** Decimal pesos from API (statement balances, gaps) → display via centavo-based formatter. */
function formatWorkbenchPesos(pesos) {
  const n = Number(pesos);
  if (!Number.isFinite(n)) return '—';
  return formatCurrency(Math.round(n * 100), 'MXN');
}

/** YYYY-MM-DD for sorting bank normalized rows. */
function reconBankRowSortKey(row) {
  const d = String(row?.date ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : String(row?.date ?? '');
}

/** YYYY-MM-DD for sorting workbench SAMS txns (Firestore date shapes). */
function reconTxnSortKey(t) {
  const d = t?.date;
  if (d == null) return '';
  if (typeof d === 'object') {
    if (typeof d.toDate === 'function') {
      const dt = d.toDate();
      return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
    }
    const sec = d.seconds ?? d._seconds;
    if (sec != null) {
      const dt = new Date(sec * 1000);
      return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
    }
  }
  if (typeof d === 'string' || typeof d === 'number') {
    const dt = new Date(d);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    const s = String(d).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : String(d);
  }
  return '';
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
  const [gapAdjustModalOpen, setGapAdjustModalOpen] = useState(false);
  const [gapAdjustJustification, setGapAdjustJustification] = useState('');
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
      setReportUrl(data.session?.reconciliationReportUrl || null);
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

  const sortedUnmatchedBankDetails = useMemo(() => {
    const rows = [...(wb?.unmatchedBankDetails || [])];
    rows.sort(
      (a, b) =>
        reconBankRowSortKey(a).localeCompare(reconBankRowSortKey(b)) || String(a.id).localeCompare(String(b.id))
    );
    return rows;
  }, [wb?.unmatchedBankDetails]);

  const sortedAvailableSamsTransactions = useMemo(() => {
    const rows = [...(wb?.availableSamsTransactions || [])];
    rows.sort(
      (a, b) =>
        reconTxnSortKey(a).localeCompare(reconTxnSortKey(b)) || String(a.id).localeCompare(String(b.id))
    );
    return rows;
  }, [wb?.availableSamsTransactions]);

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

  const selectionGapCentavos = useMemo(() => {
    if (!bankTypeUnified || selectedBankIds.length === 0 || selectedTxnIds.length === 0) return null;
    return bankSumCentavos - txnSumComparable;
  }, [
    bankTypeUnified,
    selectedBankIds.length,
    selectedTxnIds.length,
    bankSumCentavos,
    txnSumComparable
  ]);

  const canApplyGapAdjustment = useMemo(() => {
    if (wb?.session?.accepted) return false;
    if (!bankTypeUnified || !txnTypesOk) return false;
    if (selectedBankIds.length === 0 || selectedTxnIds.length === 0) return false;
    if (selectionGapCentavos == null) return false;
    return selectionGapCentavos !== 0;
  }, [
    wb?.session?.accepted,
    bankTypeUnified,
    txnTypesOk,
    selectedBankIds.length,
    selectedTxnIds.length,
    selectionGapCentavos
  ]);

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

  const handleGapAdjustConfirm = async () => {
    if (!clientId || !sessionId || !canApplyGapAdjustment || !gapAdjustJustification.trim()) return;
    const bankSnap = [...selectedBankIds];
    const txnSnap = [...selectedTxnIds];
    setBusy(true);
    setError('');
    try {
      const adjRes = await applyMatchGapAdjustment(clientId, sessionId, {
        normalizedRowIds: bankSnap,
        transactionIds: txnSnap,
        justification: gapAdjustJustification.trim()
      });
      const newTxnId = adjRes?.transactionId;
      if (!newTxnId) {
        throw new Error('Adjustment created but no transaction id was returned.');
      }
      setGapAdjustModalOpen(false);
      setGapAdjustJustification('');
      const pairTxnIds = [...new Set([...txnSnap.map(String), String(newTxnId)])];
      try {
        await manualPair(clientId, sessionId, {
          normalizedRowIds: bankSnap,
          transactionIds: pairTxnIds
        });
        setSelectedBankIds([]);
        setSelectedTxnIds([]);
      } catch (pairErr) {
        setSelectedBankIds(bankSnap);
        setSelectedTxnIds(pairTxnIds);
        setError(
          pairErr?.message
            ? `Adjustment was created, but automatic match failed: ${pairErr.message}. The new Bank Adjustments line is selected—use Match selected if totals align.`
            : 'Adjustment was created, but automatic match failed. Select the new Bank Adjustments line and use Match selected.'
        );
      }
      await loadWorkbench();
    } catch (e) {
      setError(e.message || 'Adjustment failed');
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

  const handleRegenerateReport = async () => {
    if (!clientId || !sessionId) return;
    setBusy(true);
    setError('');
    try {
      const res = await regenerateReconciliationReport(clientId, sessionId);
      setReportUrl(res.reconciliationReportUrl || null);
      await loadWorkbench();
    } catch (e) {
      setError(e.message || 'Regenerate report failed');
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
          <strong>Justify selected</strong> (or the row clipboard icon) for SAMS lines with no bank line. When every bank
          line is resolved and every in-period
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

            {(() => {
              const mm = wb.session?.matchMap?.length ?? 0;
              const st = wb.stats || {};
              const spei =
                (Number(st.speiFeeGapExact) || 0) + (Number(st.speiFeeGapDrift) || 0);
              const rnd =
                (Number(st.roundingExact) || 0) + (Number(st.roundingDrift) || 0);
              const fa = Number(st.feeAdjusted) || 0;
              const ex = Number(st.exact) || 0;
              const dd = Number(st.dateDrift) || 0;
              if (mm === 0) return null;
              const autoTotal = ex + dd + spei + rnd + fa;
              return (
                <div className="recon-automatch-banner" role="status">
                  <strong>Saved matches:</strong> {mm} link{mm === 1 ? '' : 's'} (from Import &amp; match; Refresh
                  reloads).{' '}
                  {autoTotal > 0 && (
                    <>
                      Last auto pass: exact {ex}, date drift {dd}
                      {spei > 0 ? `, SPEI gap ${spei}` : ''}
                      {rnd > 0 ? `, rounding ${rnd}` : ''}
                      {fa > 0 ? `, fee-adjusted ${fa}` : ''}.
                    </>
                  )}
                </div>
              );
            })()}

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
                      {sortedUnmatchedBankDetails.map((row) => (
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
                                setExcludeReason('');
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
                  period end (same register window as Import &amp; Match). On each <strong>Import &amp; Match</strong>,{' '}
                  SAMS lines with <strong>$0.00</strong> are auto-excluded (non-cash / credit-balance usage). For other
                  lines with <strong>no bank match</strong>, select <strong>one</strong> row and click{' '}
                  <strong>Justify selected</strong>, or use the <strong>clipboard</strong> icon in the row.
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
                    disabled={busy || !canApplyGapAdjustment}
                    title={
                      canApplyGapAdjustment
                        ? 'Create a Bank Adjustments line for the current gap, then automatically match your selected bank and SAMS rows including that new line. Requires justification.'
                        : wb?.session?.accepted
                          ? 'Session is already accepted.'
                          : !bankTypeUnified || selectedBankIds.length === 0 || selectedTxnIds.length === 0
                            ? 'Select bank and SAMS lines of a single type to compare totals.'
                            : !txnTypesOk
                              ? 'All selected SAMS rows must be valid for the bank type (CARGO or ABONO).'
                              : selectionGapCentavos === 0
                                ? 'Difference is zero — use Match selected.'
                                : 'Cannot create adjustment for this selection.'
                    }
                    onClick={() => {
                      setGapAdjustJustification('');
                      setGapAdjustModalOpen(true);
                    }}
                  >
                    <FontAwesomeIcon icon={faCoins} /> Apply bank adjustment
                  </button>
                  <button
                    type="button"
                    className="recon-secondary-btn"
                    disabled={busy || selectedTxnIds.length !== 1}
                    title={
                      selectedTxnIds.length === 0
                        ? 'Select exactly one SAMS row to justify (register-only / no bank line).'
                        : selectedTxnIds.length > 1
                          ? 'Select only one row at a time for Justify, or clear extra checkboxes.'
                          : 'Record a written reason; line is cleared on Accept like a match.'
                    }
                    onClick={() => {
                      const id = selectedTxnIds[0];
                      if (!id) return;
                      setJustifyModal({ open: true, transactionId: id });
                      setJustifyReason('');
                    }}
                  >
                    <FontAwesomeIcon icon={faClipboardCheck} /> Justify selected
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
                  {selectionGapCentavos !== null && (
                    <span className="recon-match-totals-delta">
                      {' · '}
                      Difference:{' '}
                      <strong>{formatWorkbenchCentavos(Math.abs(selectionGapCentavos))}</strong>
                      {selectionGapCentavos > 0 && (
                        <span className="recon-match-totals-delta-hint"> (bank total higher)</span>
                      )}
                      {selectionGapCentavos < 0 && (
                        <span className="recon-match-totals-delta-hint"> (SAMS total higher)</span>
                      )}
                      {selectionGapCentavos === 0 && (
                        <span className="recon-match-totals-delta-hint"> (totals match)</span>
                      )}
                    </span>
                  )}
                  {selectedBankIds.length > 0 &&
                    selectedTxnIds.length > 0 &&
                    bankTypeUnified &&
                    !txnTypesOk && (
                      <span className="recon-match-totals-warn">
                        {' '}
                        — one or more selected SAMS rows are not valid for {bankTypeUnified}; comparable total only
                        includes valid rows.
                      </span>
                    )}
                  {selectedBankIds.length > 0 &&
                    selectedTxnIds.length > 0 &&
                    !bankTypeUnified && (
                      <span className="recon-match-totals-warn">
                        {' '}
                        — select bank lines of a single type (all CARGO or all ABONO) to compare totals.
                      </span>
                    )}
                  {selectedBankIds.length > 0 &&
                    selectedTxnIds.length > 0 &&
                    bankTypeUnified &&
                    txnTypesOk &&
                    !canMatchSelection &&
                    selectionGapCentavos !== 0 && (
                      <span className="recon-match-totals-warn">
                        {' '}
                        — adjust selection until Difference is $0.00 to enable Match, or use{' '}
                        <strong>Apply bank adjustment</strong> to post the adjustment and immediately match your current
                        selection (with required justification).
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
                      {sortedAvailableSamsTransactions.map((t) => (
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
                              aria-label="Justify: no bank line (cleared on Accept with reason)"
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
                                setExcludeReason('');
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

            {wb.balanceVsStatement && (
              <div className="recon-balance-panel">
                <h4 className="recon-balance-panel-title">Balance check</h4>
                <div className="recon-balance-grid">
                  <div>
                    <span className="recon-balance-label">Statement ending (session)</span>
                    <strong className="recon-balance-value">
                      {formatWorkbenchPesos(wb.balanceVsStatement.statementEndingPesos)}
                    </strong>
                  </div>
                  <div>
                    <span className="recon-balance-label">SAMS ledger (live)</span>
                    <strong className="recon-balance-value">
                      {wb.balanceVsStatement.samsBalancePesos != null
                        ? formatWorkbenchPesos(wb.balanceVsStatement.samsBalancePesos)
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="recon-balance-label">Gap (SAMS − statement)</span>
                    <strong
                      className={`recon-balance-value${
                        wb.balanceVsStatement.samsVsStatementGapPesos != null &&
                        Math.abs(wb.balanceVsStatement.samsVsStatementGapPesos) > 0.01
                          ? ' recon-balance-gap-warn'
                          : ''
                      }`}
                    >
                      {wb.balanceVsStatement.samsVsStatementGapPesos != null
                        ? formatWorkbenchPesos(wb.balanceVsStatement.samsVsStatementGapPesos)
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="recon-balance-label">Roll-forward from import</span>
                    <strong className="recon-balance-value">
                      {formatWorkbenchPesos(wb.balanceVsStatement.impliedEndingFromImportPesos)}
                    </strong>
                    <span className="recon-balance-sub">
                      opening {formatWorkbenchPesos(wb.balanceVsStatement.statementOpeningPesos)} + net
                      bank lines in period
                    </span>
                  </div>
                  <div>
                    <span className="recon-balance-label">Import vs entered ending</span>
                    <strong
                      className={`recon-balance-value${
                        Math.abs(wb.balanceVsStatement.importVsEnteredEndingGapPesos || 0) > 0.01
                          ? ' recon-balance-gap-warn'
                          : ''
                      }`}
                    >
                      {formatWorkbenchPesos(wb.balanceVsStatement.importVsEnteredEndingGapPesos)}
                    </strong>
                    <span className="recon-balance-sub">non-zero → check opening/ending or file</span>
                  </div>
                </div>
                <p className="recon-balance-footnote">
                  <strong>SAMS ledger</strong> is the stored balance on this bank account <em>right now</em> — it still
                  includes postings <strong>after</strong> the statement end date if you have entered them. Use the gap
                  as a guide while you add missing expenses; it should trend toward zero when the books match the
                  statement period.
                </p>
              </div>
            )}

            <div className="recon-summary-bar">
              <span>
                Unmatched bank lines: <strong>{wb.stats?.unmatchedBankLineCount ?? 0}</strong>
              </span>
              <span>
                Available SAMS:{' '}
                <strong>{(wb.availableSamsTransactions || []).length}</strong>
              </span>
              <label className="recon-accept-residual-label">
                <span className="recon-accept-residual-title">Accept residual (pesos)</span>
                <span className="recon-accept-residual-hint">
                  Must be 0 to Accept. Use for a small documented adjustment only — not the same as ledger vs statement
                  above.
                </span>
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
                  (wb.stats?.unresolvedInPeriodCount || 0) > 0 ||
                  Math.abs(Number(diffPesos) || 0) > 0.01 ||
                  wb.session?.accepted
                }
                onClick={handleAccept}
              >
                Accept statement
              </button>
            </div>
            {(reportUrl || wb.session?.reconciliationReportUrl) && (
              <p className="recon-success">
                <a
                  href={reportUrl || wb.session?.reconciliationReportUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download reconciliation PDF
                </a>
              </p>
            )}
            {wb.session &&
              ((wb.session.matchMap?.length ?? 0) > 0 ||
                wb.session.accepted ||
                wb.session.reconciliationReportUrl) && (
                <p className="recon-hint" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="recon-secondary-btn"
                    disabled={busy}
                    title="Rebuild PDF from this session’s match map, normalized bank rows, and current SAMS transactions (no Accept). Use after report template changes or if transactions were cleared in dev."
                    onClick={handleRegenerateReport}
                  >
                    <FontAwesomeIcon icon={faFilePdf} /> Regenerate report PDF
                  </button>{' '}
                  <span className="recon-match-totals-meta">
                    (from saved session — does not change cleared dates)
                  </span>
                </p>
              )}
          </section>
      )}

      {gapAdjustModalOpen && (
        <div
          className="recon-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (busy) return;
            setGapAdjustModalOpen(false);
            setGapAdjustJustification('');
          }}
        >
          <div className="recon-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Apply bank adjustment</h4>
            <p className="recon-hint">
              Creates one <strong>Bank Adjustments</strong> transaction (same category as Accounts → Submit Adjustments)
              for the signed gap <strong>{formatWorkbenchCentavos(selectionGapCentavos || 0)}</strong>{' '}
              {selectionGapCentavos > 0 && '(bank total higher)'}
              {selectionGapCentavos < 0 && '(SAMS total higher)'}
              {selectionGapCentavos === 0 && ''} on <strong>{bankTypeUnified || '—'}</strong>, dated{' '}
              <strong>{wb?.session?.endDate || '—'}</strong>. Amount and direction are computed from your selection; a
              written justification is required (stored on the transaction). After posting, SAMS runs{' '}
              <strong>Match selected</strong> for the same bank rows, your selected SAMS rows, and the new adjustment
              line. Checkboxes clear only after that match succeeds (same as clicking Match selected).
            </p>
            <textarea
              className="recon-field-input"
              rows={3}
              placeholder="Justification (required)"
              value={gapAdjustJustification}
              onChange={(e) => setGapAdjustJustification(e.target.value)}
            />
            <div className="recon-modal-actions">
              <button
                type="button"
                className="recon-secondary-btn"
                disabled={busy}
                onClick={() => {
                  setGapAdjustModalOpen(false);
                  setGapAdjustJustification('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="recon-primary-btn"
                disabled={busy || !canApplyGapAdjustment || !gapAdjustJustification.trim()}
                onClick={handleGapAdjustConfirm}
              >
                {busy ? 'Working…' : 'Create adjustment'}
              </button>
            </div>
          </div>
        </div>
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
          onClick={() => {
            setExcludeModal({ open: false, type: null, id: null });
            setExcludeReason('');
          }}
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
                onClick={() => {
                  setExcludeModal({ open: false, type: null, id: null });
                  setExcludeReason('');
                }}
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
