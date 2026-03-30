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
      <p>
        <strong>Bank ending (from setup):</strong> {session?.endingBalance}
      </p>
      <p className="recon-muted">
        Confirm <strong>difference</strong> is zero before accepting (adjust SAMS elsewhere if needed). Cleared
        date will be set to the statement period end.
      </p>
      <label>
        Difference (pesos, must be 0)
        <input
          type="number"
          step="0.01"
          value={diff}
          onChange={(e) => setDiff(e.target.value)}
          style={{ display: 'block', marginTop: 6, padding: 8, maxWidth: 200 }}
        />
      </label>
      {error && <div className="recon-error">{error}</div>}
      <div className="recon-actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Back
        </button>
        <button type="button" className="primary" onClick={run} disabled={busy}>
          {busy ? 'Accepting…' : 'Accept statement'}
        </button>
      </div>
    </div>
  );
}
