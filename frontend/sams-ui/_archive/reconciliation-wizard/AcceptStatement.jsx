import React, { useState } from 'react';
import { acceptSession, updateSession } from '../../api/reconciliation';

export default function AcceptStatement({ clientId, session, onDone, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [diff, setDiff] = useState(String(session?.differenceAmount ?? 0));

  const run = async () => {
    setError('');
    setBusy(true);
    try {
      await updateSession(clientId, session.id, { differenceAmount: Number(diff) || 0 });
      const res = await acceptSession(clientId, session.id, {});
      onDone(res.reconciliationReportUrl);
    } catch (e) {
      setError(e.message || 'Accept failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="account-reconciliation-instructions">
        <strong style={{ color: '#374151' }}>Bank ending (from setup):</strong>{' '}
        <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 600 }}>{session?.endingBalance}</span>
      </p>
      <p className="account-reconciliation-instructions">
        Confirm <strong>difference</strong> is zero before accepting (opening → activity → ending vs SAMS;
        adjust elsewhere if needed). <strong>Cleared</strong> date is set on each SAMS row that was matched or
        justified in this session (period end). Register lines with no bank line stay uncleared unless you
        justified them in step 3.
      </p>
      <label className="recon-accept-label">
        Difference (pesos, must be 0)
        <input
          className="balance-input recon-amount-field recon-accept-diff-input"
          type="number"
          step="0.01"
          value={diff}
          onChange={(e) => setDiff(e.target.value)}
        />
      </label>
      {error && <div className="account-reconciliation-error">{error}</div>}
      <div className="recon-actions">
        <button
          type="button"
          className="account-reconciliation-cancel"
          onClick={onCancel}
          disabled={busy}
        >
          Back
        </button>
        <button
          type="button"
          className="account-reconciliation-submit"
          onClick={run}
          disabled={busy}
        >
          {busy ? 'Accepting…' : 'Accept statement'}
        </button>
      </div>
    </div>
  );
}
