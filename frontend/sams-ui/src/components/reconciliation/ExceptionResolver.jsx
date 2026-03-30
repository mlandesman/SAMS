import React, { useState } from 'react';
import { resolveException } from '../../api/reconciliation';

export default function ExceptionResolver({ clientId, session, transactions, onResolved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const unmatchedBank = session?.unmatchedBankRows || [];
  const unmatchedTxn = session?.unmatchedTransactions || [];

  const normById = {};
  (session?.normalizedRows || []).forEach((r) => {
    normById[r.id] = r;
  });

  const txnById = {};
  (transactions || []).forEach((t) => {
    txnById[t.id] = t;
  });

  const [pairTxn, setPairTxn] = useState({});

  const matchBankRow = async (normalizedRowId) => {
    const transactionId = pairTxn[normalizedRowId];
    if (!transactionId) {
      setError('Pick a SAMS transaction for each unmatched bank line.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await resolveException(clientId, session.id, {
        action: 'manual-match',
        normalizedRowId,
        transactionId
      });
      await onResolved();
    } catch (e) {
      setError(e.message || 'Resolve failed');
    } finally {
      setBusy(false);
    }
  };

  const justifyTxn = async (transactionId) => {
    const justification = window.prompt('Justification (required)');
    if (!justification?.trim()) return;
    setBusy(true);
    setError('');
    try {
      await resolveException(clientId, session.id, {
        action: 'manual-justify',
        transactionId,
        justification: justification.trim()
      });
      await onResolved();
    } catch (e) {
      setError(e.message || 'Resolve failed');
    } finally {
      setBusy(false);
    }
  };

  const txnOptions = (transactions || []).filter(
    (t) => t.accountId === session.accountId && !t.clearedDate
  );

  return (
    <div>
      <p className="recon-muted">Every unmatched bank line must be paired with a SAMS transaction, or justified.</p>
      {error && <div className="recon-error">{error}</div>}

      <h4>Unmatched bank (normalized)</h4>
      {unmatchedBank.length === 0 && <p className="recon-muted">None</p>}
      {unmatchedBank.map((nid) => {
        const nr = normById[nid];
        return (
          <div key={nid} style={{ marginBottom: 12, padding: 10, background: '#12121a', borderRadius: 8 }}>
            <div>
              {nr ? `${nr.date} · ${nr.type} · ${nr.amount} · ${nr.description}` : nid}
            </div>
            <select
              value={pairTxn[nid] || ''}
              onChange={(e) => setPairTxn((p) => ({ ...p, [nid]: e.target.value }))}
              style={{ marginTop: 8, minWidth: 280 }}
            >
              <option value="">Select transaction…</option>
              {txnOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} · {t.date?.display || t.date} · {t.categoryName || ''} · {t.amount}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="primary"
              style={{ marginLeft: 8 }}
              disabled={busy}
              onClick={() => matchBankRow(nid)}
            >
              Pair
            </button>
          </div>
        );
      })}

      <h4 style={{ marginTop: 20 }}>Unmatched SAMS transactions</h4>
      {unmatchedTxn.length === 0 && <p className="recon-muted">None</p>}
      {unmatchedTxn.map((tid) => {
        const t = txnById[tid];
        return (
          <div key={tid} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>
              {tid} {t ? `· ${t.date?.display || ''} · ${t.amount}` : ''}
            </span>
            <button type="button" className="secondary" disabled={busy} onClick={() => justifyTxn(tid)}>
              Justify
            </button>
          </div>
        );
      })}
    </div>
  );
}
