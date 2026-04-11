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
  listSessions,
  deleteSession as deleteReconciliationSession,
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
import { isAdmin } from '../utils/userRoles';
import { LoadingSpinner } from '../components/common';
import ActivityActionBar from '../components/common/ActivityActionBar';
import ReconciliationWorkbenchModals from './ReconciliationWorkbenchModals';
import './ReconciliationView.css';

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

function formatSessionTimestamp(ts) {
  if (!ts) return '—';
  const sec = ts.seconds ?? ts._seconds;
  if (sec != null) {
    const d = new Date(Number(sec) * 1000);
    if (!Number.isNaN(d.getTime())) return formatDateInMexico(d) || '—';
  }
  const d = new Date(ts);
  if (!Number.isNaN(d.getTime())) return formatDateInMexico(d) || '—';
  return '—';
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
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');

  /** Session id is URL-driven (?session=) so back/forward and shared links stay consistent */
  const sessionId = searchParams.get('session') || '';
  const setSessionParam = useCallback((id) => {
    if (id) setSearchParams({ session: id }, { replace: true });
    else setSearchParams({}, { replace: true });
  }, [setSearchParams]);

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
  const [showHistory, setShowHistory] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [expandedHistorySessionId, setExpandedHistorySessionId] = useState('');
  const [historyBusySessionId, setHistoryBusySessionId] = useState('');

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

  const loadHistory = useCallback(async () => {
    if (!clientId) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const rows = await listSessions(clientId, accountId || null);
      setHistoryRows(rows || []);
    } catch (e) {
      setHistoryError(e.message || 'Failed to load reconciliation history');
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [clientId, accountId]);

  const abandonHistorySession = useCallback(async (row) => {
    const targetSessionId = String(row?.id || '');
    if (!targetSessionId || !clientId) return;
    if (row?.accepted) {
      setHistoryError('Accepted sessions cannot be abandoned.');
      return;
    }
    const confirmDelete = window.confirm(
      'Abandon this in-progress reconciliation?\n\nThis permanently deletes the draft session and uploaded files (bank file, statement PDF, generated report if present). Accepted sessions are never deleted.'
    );
    if (!confirmDelete) return;

    setHistoryError('');
    setHistoryBusySessionId(targetSessionId);
    try {
      await deleteReconciliationSession(clientId, targetSessionId);
      if (expandedHistorySessionId === targetSessionId) {
        setExpandedHistorySessionId('');
      }
      if (sessionId === targetSessionId) {
        setSessionParam('');
      }
      await loadHistory();
    } catch (e) {
      setHistoryError(e.message || 'Failed to abandon reconciliation session');
    } finally {
      setHistoryBusySessionId('');
    }
  }, [clientId, expandedHistorySessionId, loadHistory, sessionId, setSessionParam]);

  useEffect(() => {
    if (sessionId && clientId) {
      loadWorkbench();
    } else {
      setWb(null);
    }
  }, [sessionId, clientId, loadWorkbench]);

  useEffect(() => {
    if (!showHistory || !clientId) return;
    loadHistory();
  }, [showHistory, clientId, loadHistory]);

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
        (s, id) => s + Math.abs(Math.round(Number(bankRowById[id]?.amount) || 0)),
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
    setBusyAction('accept');
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
      setBusyAction('');
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
    <div className="view-container">
      <ActivityActionBar>
        <button
          type="button"
          className={`action-item${showHistory ? ' filtered-active' : ''}`}
          onClick={() => {
            setShowHistory((v) => !v);
            setExpandedHistorySessionId('');
          }}
          disabled={busy}
        >
          {showHistory ? 'Back' : 'History'}
        </button>
        {showHistory && (
          <button
            type="button"
            className="action-item"
            onClick={loadHistory}
            disabled={busy || historyLoading}
          >
            {historyLoading ? 'Loading…' : 'Refresh History'}
          </button>
        )}
        <button
          type="button"
          className="action-item"
          onClick={loadWorkbench}
          disabled={busy || !sessionId}
        >
          Refresh
        </button>
        <button
          type="button"
          className="action-item"
          onClick={() => {
            setShowHistory(false);
            setExpandedHistorySessionId('');
            setSessionParam('');
            setWb(null);
          }}
          disabled={busy}
        >
          New Session
        </button>
      </ActivityActionBar>
      <div className="reconciliation-page">
      {busy && busyAction === 'accept' && (
        <LoadingSpinner
          variant="logo"
          size="large"
          fullScreen={true}
          show={true}
          message="Accepting statement and generating report..."
        />
      )}
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

      {showHistory && (
        <section className="recon-history-panel">
          <h2>Reconciliation history</h2>
          <p className="recon-hint">
            Sessions for this client. Open any row to continue work, or use artifact links to retrieve statement/bank/report files.
          </p>
          {historyError && <div className="recon-page-error">{historyError}</div>}
          <div className="recon-table-scroll recon-history-scroll">
            <table className="recon-wb-table recon-history-table">
              <thead>
                <tr>
                  <th className="recon-history-col-created">Created</th>
                  <th className="recon-history-col-period">Period</th>
                  <th>Account</th>
                  <th className="recon-history-col-status">Status</th>
                  <th className="num recon-history-col-bank-cleared">Bank cleared</th>
                  <th>Artifacts</th>
                  <th className="recon-history-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={9}>Loading reconciliation history…</td>
                  </tr>
                ) : historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>No reconciliation sessions found.</td>
                  </tr>
                ) : (
                  historyRows.map((row) => {
                    const sessionDocId = String(row.id || '');
                    const importFolderPath = `clients/${clientId}/reconciliation-imports/${sessionDocId}/`;
                    const reportObjectPath = `clients/${clientId}/reconciliation-reports/${sessionDocId}.pdf`;
                    const stats = row.matchStats || row.stats || {};
                    const unmatchedBank = Number(stats.unmatchedBankCount) || (row.unmatchedBankRows?.length ?? 0);
                    const matchedBankCount = (row.matchMap || []).reduce(
                      (count, match) => (match?.normalizedRowId ? count + 1 : count),
                      0
                    );
                    const totalBankRows = matchedBankCount + unmatchedBank;
                    const isMetaOpen = expandedHistorySessionId === sessionDocId;
                    const rowActionBusy = historyBusySessionId === sessionDocId;
                    const historyActionInFlight = Boolean(historyBusySessionId);
                    const statusValue = row.accepted ? 'accepted' : (row.status || 'draft');
                    const statusClass = String(statusValue).toLowerCase().replace(/\s+/g, '-');
                    return (
                      <React.Fragment key={sessionDocId}>
                        <tr>
                          <td className="recon-history-col-created">{formatSessionTimestamp(row.created)}</td>
                          <td className="recon-history-col-period">{row.startDate || '—'} → {row.endDate || '—'}</td>
                          <td>{row.accountName || row.accountId || '—'}</td>
                          <td className="recon-history-col-status">
                            <span className={`recon-history-status-badge ${statusClass}`}>
                              {statusValue}
                            </span>
                          </td>
                          <td className="num recon-history-col-bank-cleared">
                            {matchedBankCount}/{totalBankRows}
                          </td>
                          <td className="recon-history-links">
                            {row.bankPdfUrl ? <a href={row.bankPdfUrl} target="_blank" rel="noreferrer">Statement PDF</a> : <span>—</span>}
                            {row.bankFileUrl ? <a href={row.bankFileUrl} target="_blank" rel="noreferrer">Bank file</a> : <span>—</span>}
                            {row.reconciliationReportUrl ? (
                              <a href={row.reconciliationReportUrl} target="_blank" rel="noreferrer">Recon report</a>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td className="recon-history-col-actions">
                            <div className="recon-history-actions">
                              {!row.accepted && (
                                <button
                                  type="button"
                                  className="recon-secondary-btn recon-danger-btn"
                                  disabled={historyActionInFlight}
                                  onClick={() => abandonHistorySession(row)}
                                >
                                  {rowActionBusy ? 'Abandoning…' : 'Abandon'}
                                </button>
                              )}
                              <button
                                type="button"
                                className="recon-secondary-btn"
                                disabled={historyActionInFlight}
                                onClick={() =>
                                  setExpandedHistorySessionId((prev) => (prev === sessionDocId ? '' : sessionDocId))
                                }
                              >
                                {isMetaOpen ? 'Hide Meta' : 'Meta'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isMetaOpen && (
                          <tr className="recon-history-meta-row">
                            <td colSpan={9} className="recon-history-meta">
                              <div><strong>Session:</strong> <code>{sessionDocId}</code></div>
                              <div><strong>Imports:</strong> <code>{importFolderPath}</code></div>
                              <div><strong>Report:</strong> <code>{reportObjectPath}</code></div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!showHistory && sessionId && !wb && !error && (
        <div className="recon-loading-panel" aria-busy="true">
          Loading workbench…
        </div>
      )}

      {!showHistory && !sessionId && (
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

      {!showHistory && sessionId && wb && (
        <section className="recon-workbench">
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

      <ReconciliationWorkbenchModals
        gapAdjustModalOpen={gapAdjustModalOpen}
        busy={busy}
        canApplyGapAdjustment={canApplyGapAdjustment}
        gapAdjustJustification={gapAdjustJustification}
        onGapAdjustJustificationChange={setGapAdjustJustification}
        onGapAdjustOverlayClose={() => {
          if (busy) return;
          setGapAdjustModalOpen(false);
          setGapAdjustJustification('');
        }}
        onGapAdjustCancel={() => {
          setGapAdjustModalOpen(false);
          setGapAdjustJustification('');
        }}
        onGapAdjustConfirm={handleGapAdjustConfirm}
        selectionGapCentavos={selectionGapCentavos}
        bankTypeUnified={bankTypeUnified}
        sessionEndDate={wb?.session?.endDate}
        formatWorkbenchCentavos={formatWorkbenchCentavos}
        justifyModalOpen={justifyModal.open}
        justifyReason={justifyReason}
        onJustifyReasonChange={setJustifyReason}
        onJustifyOverlayClose={() => {
          if (busy) return;
          setJustifyModal({ open: false, transactionId: null });
        }}
        onJustifyCancel={() => setJustifyModal({ open: false, transactionId: null })}
        onJustifySubmit={handleJustifySubmit}
        excludeModalOpen={excludeModal.open}
        excludeReason={excludeReason}
        onExcludeReasonChange={setExcludeReason}
        onExcludeOverlayClose={() => {
          if (busy) return;
          setExcludeModal({ open: false, type: null, id: null });
          setExcludeReason('');
        }}
        onExcludeCancel={() => {
          setExcludeModal({ open: false, type: null, id: null });
          setExcludeReason('');
        }}
        onExcludeSubmit={handleExclude}
      />

      <TransactionDetailModal
        transaction={viewTxn}
        isOpen={!!viewTxn}
        onClose={() => setViewTxn(null)}
        clientId={clientId}
      />
      </div>
    </div>
  );
}
