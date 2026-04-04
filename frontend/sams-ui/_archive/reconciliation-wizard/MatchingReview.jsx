import React, { useMemo } from 'react';
import { formatCurrency } from '@shared/utils/currencyUtils';

const MATCH_TYPE_LABELS = {
  'auto-exact': 'Exact (amount & date)',
  'auto-date-drift': 'Date within 7 days',
  'auto-rounding': 'Rounding tolerance',
  'auto-spei-fee-gap': 'SPEI fee gap',
  'auto-fee-adjusted': 'Multi-fee sum',
  'manual-match': 'Manual pair',
  'manual-justified': 'Justified (no bank line)'
};

const BREAKDOWN_KEYS = [
  ['exact', 'Exact'],
  ['dateDrift', 'Date drift'],
  ['roundingExact', 'Rounding'],
  ['roundingDrift', 'Rounding + date drift'],
  ['speiFeeGapExact', 'SPEI gap'],
  ['speiFeeGapDrift', 'SPEI gap + drift'],
  ['feeAdjusted', 'Multi-fee']
];

function formatMatchDetails(m) {
  const parts = [];
  if (m.roundingDeltaCentavos != null && m.roundingDeltaCentavos !== 0) {
    const abs = Math.abs(m.roundingDeltaCentavos);
    const dir = m.roundingDeltaCentavos > 0 ? 'bank higher' : 'SAMS higher';
    parts.push(`Δ ${formatCurrency(abs, 'MXN')} (${dir})`);
  }
  if (m.speiFeeGapCentavos != null) {
    parts.push(`Gap ${formatCurrency(m.speiFeeGapCentavos, 'MXN')}`);
  }
  const extra = (m.relatedTransactionIds || []).length;
  if (extra > 0) {
    parts.push(`${extra} linked fee line${extra === 1 ? '' : 's'}`);
  }
  if (m.justification) {
    parts.push(m.justification);
  }
  return parts.length ? parts.join(' · ') : '—';
}

function labelForMatchType(type) {
  if (!type) return '—';
  return MATCH_TYPE_LABELS[type] || type;
}

export default function MatchingReview({ session, transactions = [] }) {
  const matchMap = session?.matchMap || [];
  const stats = session?.stats || {};

  const txnById = useMemo(() => {
    const map = {};
    (transactions || []).forEach((t) => {
      if (t?.id) map[t.id] = t;
    });
    return map;
  }, [transactions]);

  const countsByRawType = useMemo(() => {
    const acc = {};
    matchMap.forEach((m) => {
      const k = m.matchType || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
    });
    return acc;
  }, [matchMap]);

  const algorithmBreakdown = useMemo(() => {
    const fromStats = BREAKDOWN_KEYS.flatMap(([key, label]) => {
      const v = stats[key];
      if (typeof v === 'number' && v > 0) return [`${label}: ${v}`];
      return [];
    });
    if (fromStats.length > 0) return fromStats;
    const fromRows = Object.entries(countsByRawType)
      .filter(([, n]) => n > 0)
      .map(([type, n]) => `${labelForMatchType(type)}: ${n}`);
    return fromRows;
  }, [stats, countsByRawType]);

  const matchedCount =
    typeof stats.matchedCount === 'number' ? stats.matchedCount : matchMap.length;
  const unmatchedBank =
    typeof stats.unmatchedBankCount === 'number'
      ? stats.unmatchedBankCount
      : session?.unmatchedBankRows?.length ?? 0;
  const unmatchedTxn =
    typeof stats.unmatchedTxnCount === 'number'
      ? stats.unmatchedTxnCount
      : session?.unmatchedTransactions?.length ?? 0;

  const rows = useMemo(() => {
    const normById = {};
    (session?.normalizedRows || []).forEach((r) => {
      normById[r.id] = r;
    });
    return matchMap.map((m) => {
      const nr = normById[m.normalizedRowId];
      const cls =
        m.matchType?.startsWith('auto') ? 'match-ok' : m.matchType?.includes('manual') ? 'match-warn' : '';
      const t = txnById[m.transactionId];
      const dateStr = t?.date?.display || t?.date || '';
      const amtStr = t?.amount != null ? formatCurrency(t.amount, 'MXN') : '';

      return (
        <tr key={`${m.normalizedRowId}-${m.transactionId}`} className={cls}>
          <td>
            <span className="recon-match-type-label">{labelForMatchType(m.matchType)}</span>
            {m.matchType && !MATCH_TYPE_LABELS[m.matchType] && (
              <span className="recon-match-detail">
                <br />
                <code>{m.matchType}</code>
              </span>
            )}
          </td>
          <td>
            {nr
              ? `${nr.date} ${nr.type} ${formatCurrency(nr.amount, 'MXN')}`
              : m.normalizedRowId}
          </td>
          <td className="recon-sams-txn-cell">
            <span className="recon-txn-id">{m.transactionId}</span>
            {t ? (
              <span className="recon-match-detail">
                <br />
                {dateStr}
                {dateStr && amtStr ? ' · ' : ''}
                {amtStr}
              </span>
            ) : null}
          </td>
          <td className="recon-match-details-cell">
            <span className="recon-match-detail">{formatMatchDetails(m)}</span>
          </td>
        </tr>
      );
    });
  }, [matchMap, session?.normalizedRows, txnById]);

  return (
    <div>
      <p className="account-reconciliation-instructions">
        Review automatic matches. Unmatched items are resolved in the next step.
      </p>
      <p className="recon-stats-line">
        <strong>Bank rows:</strong> {stats.bankRowCount ?? '—'} &nbsp;|&nbsp;
        <strong>Normalized:</strong> {stats.normalizedRowCount ?? '—'} &nbsp;|&nbsp;
        <strong>Matched:</strong> {matchedCount} &nbsp;|&nbsp;
        <strong>Unmatched bank:</strong> {unmatchedBank} &nbsp;|&nbsp;
        <strong>Unmatched SAMS:</strong> {unmatchedTxn}
      </p>
      {algorithmBreakdown.length > 0 && (
        <p className="recon-stats-line recon-stats-breakdown">
          <strong>Match breakdown:</strong> {algorithmBreakdown.join(' · ')}
        </p>
      )}
      <div className="recon-table-wrap">
        <table className="recon-table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Bank (normalized)</th>
              <th>SAMS txn</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}
