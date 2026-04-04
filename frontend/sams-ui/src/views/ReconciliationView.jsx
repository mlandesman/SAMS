import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoice, faLink, faBan, faEye, faEdit } from '@fortawesome/free-solid-svg-icons';
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
  updateSession
} from '../api/reconciliation';
import { getMexicoDateString } from '../utils/timezone';
import { formatCurrency } from '@shared/utils/currencyUtils';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { isAdmin } from '../utils/userRoles';
import './ReconciliationView.css';

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

  const [selectedBankId, setSelectedBankId] = useState(null);
  const [selectedTxnId, setSelectedTxnId] = useState(null);
  const [viewTxn, setViewTxn] = useState(null);
  const [excludeModal, setExcludeModal] = useState({ open: false, type: null, id: null });
  const [excludeReason, setExcludeReason] = useState('');
  const [reportUrl, setReportUrl] = useState(null);

  const canUse = isAdmin(samsUser, clientId);

  useEffect(() => {
    setWb(null);
    setReportUrl(null);
    setSelectedBankId(null);
    setSelectedTxnId(null);
    setError('');
  }, [clientId]);

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
    if (!clientId || !sessionId || !selectedBankId || !selectedTxnId) {
      setError('Select a bank row and a SAMS transaction.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await manualPair(clientId, sessionId, selectedBankId, selectedTxnId);
      setSelectedBankId(null);
      setSelectedTxnId(null);
      await loadWorkbench();
    } catch (e) {
      setError(e.message || 'Pair failed');
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

  const txnById = useMemo(() => {
    const m = {};
    (wb?.availableSamsTransactions || []).forEach((t) => {
      m[t.id] = t;
    });
    return m;
  }, [wb]);

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
          Session-only pairing until you accept — SAMS edits from auto-fix (SPEI/rounding) persist;{' '}
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
                <p className="recon-hint">Read-only — select a row, then pair from the right.</p>
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
                          className={selectedBankId === row.id ? 'selected' : ''}
                          onClick={() => setSelectedBankId(row.id)}
                        >
                          <td>
                            <input
                              type="radio"
                              name="bankPick"
                              checked={selectedBankId === row.id}
                              onChange={() => setSelectedBankId(row.id)}
                            />
                          </td>
                          <td>{row.date || '—'}</td>
                          <td>{row.type || '—'}</td>
                          <td className="num">{formatCurrency(row.amount || 0, 'MXN')}</td>
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
                  Uncleared · statement window ±7 days · select one to pair with the bank row.
                </p>
                <div className="recon-sams-actions">
                  <button
                    type="button"
                    className="recon-primary-btn"
                    disabled={busy || !selectedBankId || !selectedTxnId}
                    onClick={handlePair}
                  >
                    <FontAwesomeIcon icon={faLink} /> Pair selected
                  </button>
                  <button
                    type="button"
                    className="recon-secondary-btn"
                    onClick={() => navigate('/add-expense')}
                  >
                    Add expense
                  </button>
                </div>
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
                          className={selectedTxnId === t.id ? 'selected' : ''}
                          onClick={() => setSelectedTxnId(t.id)}
                        >
                          <td>
                            <input
                              type="radio"
                              name="txnPick"
                              checked={selectedTxnId === t.id}
                              onChange={() => setSelectedTxnId(t.id)}
                            />
                          </td>
                          <td>{t.date?.display || t.date?.unambiguous_long_date || '—'}</td>
                          <td>{t.type || '—'}</td>
                          <td className="num">{formatCurrency(t.amount || 0, 'MXN')}</td>
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
                Available SAMS: <strong>{wb.stats?.availableSamsCount ?? 0}</strong>
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
                  (wb.unmatchedBankDetails || []).length > 0 ||
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
