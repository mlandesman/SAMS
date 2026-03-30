import React, { useMemo } from 'react';

export default function MatchingReview({ session }) {
  const matchMap = session?.matchMap || [];
  const stats = session?.stats || {};

  const rows = useMemo(() => {
    const normById = {};
    (session?.normalizedRows || []).forEach((r) => {
      normById[r.id] = r;
    });
    return matchMap.map((m) => {
      const nr = normById[m.normalizedRowId];
      const cls =
        m.matchType?.startsWith('auto') ? 'match-ok' : m.matchType?.includes('manual') ? 'match-warn' : '';
      return (
        <tr key={`${m.normalizedRowId}-${m.transactionId}`} className={cls}>
          <td>{m.matchType}</td>
          <td>{nr ? `${nr.date} ${nr.type} ${nr.amount}` : m.normalizedRowId}</td>
          <td>{m.transactionId}</td>
        </tr>
      );
    });
  }, [matchMap, session?.normalizedRows]);

  return (
    <div>
      <p className="recon-muted">
        Review automatic matches. Unmatched items are resolved in the next step.
      </p>
      <p>
        <strong>Bank rows:</strong> {stats.bankRowCount ?? '—'} &nbsp;|&nbsp;
        <strong>Normalized:</strong> {stats.normalizedRowCount ?? '—'}
      </p>
      <div className="recon-table-wrap">
        <table className="recon-table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Bank (normalized)</th>
              <th>SAMS txn</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}
