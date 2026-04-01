import React, { useState } from 'react';
import { formatCurrency } from '@shared/utils/currencyUtils';
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
      <p className="account-reconciliation-instructions">
        Every unmatched bank line must be paired with a SAMS transaction, or justified.
      </p>
      {error && <div className="account-reconciliation-error">{error}</div>}

      <h4>Unmatched bank (normalized)</h4>
      {unmatchedBank.length === 0 && <p className="account-reconciliation-instructions">None</p>}
      {unmatchedBank.map((nid) => {
        const nr = normById[nid];
        return (
          <div key={nid} className="recon-exception-card">
            <div className="recon-exception-line">
              {nr
                ? `${nr.date} · ${nr.type} · ${formatCurrency(nr.amount, 'MXN')} · ${nr.description}`
                : nid}
            </div>
            <select
              className="recon-field-input"
              value={pairTxn[nid] || ''}
              onChange={(e) => setPairTxn((p) => ({ ...p, [nid]: e.target.value }))}
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
              className="account-reconciliation-submit"
              style={{ marginTop: 8 }}
              disabled={busy}
              onClick={() => matchBankRow(nid)}
            >
              Pair
            </button>
          </div>
        );
      })}

      <h4>Unmatched SAMS transactions</h4>
      {unmatchedTxn.length === 0 && <p className="account-reconciliation-instructions">None</p>}
      {unmatchedTxn.map((tid) => {
        const t = txnById[tid];
        return (
          <div key={tid} className="recon-exception-row">
            <span>
              {tid} {t ? `· ${t.date?.display || ''} · ${t.amount}` : ''}
            </span>
            <button
              type="button"
              className="account-reconciliation-cancel"
              disabled={busy}
              onClick={() => justifyTxn(tid)}
            >
              Justify
            </button>
          </div>
        );
      })}
    </div>
  );
}
