import { getApp, getDb } from '../firebase.js';
import { generatePdf } from './pdfService.js';
import { getNow } from './DateService.js';
import { getStorageBucketName } from '../utils/storageBucketName.js';
import { formatCurrency } from '../../shared/utils/currencyUtils.js';
import { DateTime } from 'luxon';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Statement / session balances are stored as decimal pesos in the session document. */
function formatPesosSessionValue(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return formatCurrency(Math.round(x * 100), 'MXN');
}

function formatTxnDateForReport(txn) {
  const d = txn?.date;
  if (d == null) return '—';
  try {
    if (typeof d.toDate === 'function') {
      return DateTime.fromJSDate(d.toDate(), { zone: 'America/Cancun' }).toFormat('yyyy-MM-dd');
    }
    if (d instanceof Date && !Number.isNaN(d.getTime())) {
      return DateTime.fromJSDate(d, { zone: 'America/Cancun' }).toFormat('yyyy-MM-dd');
    }
    const sec = d.seconds ?? d._seconds;
    if (sec != null) {
      return DateTime.fromSeconds(Number(sec), { zone: 'America/Cancun' }).toFormat('yyyy-MM-dd');
    }
    if (typeof d === 'string') {
      const iso = String(d).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
      const dt = DateTime.fromISO(String(d), { zone: 'America/Cancun' });
      if (dt.isValid) return dt.toFormat('yyyy-MM-dd');
    }
  } catch {
    /* fall through */
  }
  return '—';
}

function bankIdsFromMatch(m) {
  if (Array.isArray(m.normalizedRowIds) && m.normalizedRowIds.length > 0) {
    return m.normalizedRowIds.map(String);
  }
  if (m.normalizedRowId) return [String(m.normalizedRowId)];
  return [];
}

function primaryTransactionIds(m) {
  if (Array.isArray(m.transactionIds) && m.transactionIds.length > 0) {
    return m.transactionIds.map(String);
  }
  if (m.transactionId) return [String(m.transactionId)];
  return [];
}

function relatedTransactionIds(m) {
  const out = [];
  const primary = new Set(primaryTransactionIds(m));
  for (const id of m.relatedTransactionIds || []) {
    const s = String(id);
    if (!primary.has(s)) out.push(s);
  }
  for (const id of m.feeGroupTransactionIds || []) {
    const s = String(id);
    if (!primary.has(s)) out.push(s);
  }
  return [...new Set(out)];
}

function collectAllTransactionIds(matchRows) {
  const s = new Set();
  for (const m of matchRows) {
    for (const id of primaryTransactionIds(m)) s.add(id);
    for (const id of m.relatedTransactionIds || []) s.add(String(id));
    for (const id of m.feeGroupTransactionIds || []) s.add(String(id));
  }
  return [...s];
}

async function loadNormalizedRowsById(clientId, sessionId) {
  const db = await getDb();
  const snap = await db.collection(`clients/${clientId}/reconciliations/${sessionId}/normalizedRows`).get();
  const map = {};
  snap.forEach((d) => {
    map[d.id] = { id: d.id, ...d.data() };
  });
  return map;
}

async function loadTransactionsById(clientId, ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const db = await getDb();
  const map = {};
  const chunkSize = 10;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const refs = chunk.map((id) => db.doc(`clients/${clientId}/transactions/${id}`));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap, j) => {
      const id = chunk[j];
      if (snap.exists) map[id] = { id, ...snap.data() };
    });
  }
  return map;
}

function formatBankLineHtml(row, fallbackId) {
  const id = row?.id || fallbackId;
  if (!row) {
    return `<div class="line-block missing"><strong>Statement line missing</strong><div class="id-foot">id: ${escapeHtml(id)}</div></div>`;
  }
  const date = escapeHtml(String(row.date || '—').slice(0, 10));
  const typ = escapeHtml(row.type || '—');
  const amtCent = Math.round(Number(row.amount) || 0);
  const amt = formatCurrency(amtCent, 'MXN');
  const desc = escapeHtml(row.description || '').trim() || '—';
  const refParts = [];
  if (row.referenceNumber != null && String(row.referenceNumber).trim() !== '') {
    refParts.push(`Ref: ${escapeHtml(String(row.referenceNumber))}`);
  }
  if (row.referenceLegIndex != null && Number(row.referenceLegIndex) > 0) {
    refParts.push(`Leg ${escapeHtml(String(row.referenceLegIndex))}`);
  }
  const refLine = refParts.length ? `<div class="id-foot">${refParts.join(' · ')}</div>` : '';
  return `<div class="line-block">
  <div class="line-main"><span class="dt">${date}</span> <span class="pill">${typ}</span> <strong class="amt">${escapeHtml(amt)}</strong></div>
  <div class="desc">${desc}</div>
  ${refLine}
  <div class="id-foot">Import id: ${escapeHtml(id)}</div>
</div>`;
}

function formatTxnLineHtml(txn, fallbackId) {
  const id = txn?.id || fallbackId;
  if (!txn) {
    return `<div class="line-block missing"><strong>Transaction missing</strong><div class="id-foot">id: ${escapeHtml(id)}</div></div>`;
  }
  const date = escapeHtml(formatTxnDateForReport(txn));
  const typ = escapeHtml(txn.type || '—');
  const amtCent = Math.round(Number(txn.amount) || 0);
  const amt = formatCurrency(amtCent, 'MXN');
  const cat = escapeHtml(txn.categoryName || txn.category || '').trim();
  const vendor = escapeHtml(txn.vendorName || '').trim();
  const desc = escapeHtml(txn.description || '').trim();
  const meta = [cat && `Category: ${cat}`, vendor && `Vendor: ${vendor}`].filter(Boolean).join(' · ');
  const descLine = desc && desc !== '—' ? `<div class="desc">${desc}</div>` : '';
  const metaLine = meta ? `<div class="meta">${meta}</div>` : '';
  return `<div class="line-block">
  <div class="line-main"><span class="dt">${date}</span> <span class="pill">${typ}</span> <strong class="amt">${escapeHtml(amt)}</strong></div>
  ${descLine}
  ${metaLine}
  <div class="id-foot">SAMS id: ${escapeHtml(id)}</div>
</div>`;
}

function minIsoDate(a, b) {
  if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(a)) return b || null;
  if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return a;
  return a <= b ? a : b;
}

/** Earliest statement date on this match (for sort + deltas). */
function minBankDateIsoFromMatch(m, normById) {
  let minD = null;
  for (const id of bankIdsFromMatch(m)) {
    const r = normById[id];
    const d = r?.date ? String(r.date).slice(0, 10) : null;
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) minD = minIsoDate(minD, d) || d;
  }
  return minD;
}

/** Earliest primary SAMS date on this match. */
function minPrimaryTxnDateIsoFromMatch(m, txnById) {
  let minD = null;
  for (const id of primaryTransactionIds(m)) {
    const d = formatTxnDateForReport(txnById[id]);
    if (d && d !== '—' && /^\d{4}-\d{2}-\d{2}$/.test(d)) minD = minIsoDate(minD, d) || d;
  }
  return minD;
}

/** Sort key: bank date first; if no statement line, use register date. */
function bankDateSortKeyForMatch(m, normById, txnById) {
  const b = minBankDateIsoFromMatch(m, normById);
  if (b) return b;
  const t = minPrimaryTxnDateIsoFromMatch(m, txnById);
  if (t) return t;
  return '9999-12-31';
}

function absCalendarDaysBetween(isoA, isoB) {
  if (!isoA || !isoB || !/^\d{4}-\d{2}-\d{2}$/.test(isoA) || !/^\d{4}-\d{2}-\d{2}$/.test(isoB)) {
    return null;
  }
  const a = DateTime.fromISO(isoA, { zone: 'America/Cancun' }).startOf('day');
  const b = DateTime.fromISO(isoB, { zone: 'America/Cancun' }).startOf('day');
  if (!a.isValid || !b.isValid) return null;
  return Math.round(Math.abs(a.diff(b, 'days').days));
}

function formatSignedCentavosDelta(c) {
  if (c == null || !Number.isFinite(Number(c))) return null;
  const n = Math.round(Number(c));
  if (n === 0) return 'Δ 0¢';
  const sign = n > 0 ? '+' : '−';
  return `Δ ${sign}${Math.abs(n)}¢`;
}

/**
 * Accountant-facing codes + stacked delta lines (below code).
 */
function matchHowMatchedCellHtml(m, normById, txnById) {
  const t = m.matchType || '';
  const bankD = minBankDateIsoFromMatch(m, normById);
  const txnD = minPrimaryTxnDateIsoFromMatch(m, txnById);
  const dayDiff = bankD && txnD ? absCalendarDaysBetween(bankD, txnD) : null;

  let code = '—';
  const deltaLines = [];

  if (t === 'manual-group') {
    code = 'MM';
  } else if (t === 'manual-match') {
    code = 'M1';
  } else if (t === 'manual-justified') {
    code = 'MJ';
  } else if (t === 'auto-exact') {
    code = 'EXACT';
  } else if (t === 'auto-date-drift') {
    code = 'ADD';
    if (dayDiff != null) {
      deltaLines.push(`Δ ${dayDiff} calendar day${dayDiff === 1 ? '' : 's'}`);
    }
  } else if (t === 'auto-rounding') {
    const rc = m.roundingDeltaCentavos;
    const hasDayDrift = dayDiff != null && dayDiff > 0;
    code = hasDayDrift ? 'ARDD' : 'AR';
    if (hasDayDrift) {
      deltaLines.push(`Δ ${dayDiff} calendar day${dayDiff === 1 ? '' : 's'}`);
    }
    const amtLine = formatSignedCentavosDelta(rc);
    if (amtLine) deltaLines.push(amtLine);
  } else if (t === 'auto-spei-fee-gap') {
    code = 'FA';
    const g = m.speiFeeGapCentavos;
    const amtLine = formatSignedCentavosDelta(g);
    if (amtLine) deltaLines.push(amtLine);
  } else if (t === 'auto-fee-adjusted') {
    code = 'AC';
    deltaLines.push('Several SAMS lines → one bank line');
  } else {
    code = escapeHtml(t || '—');
  }

  if (m.samsAutoFixApplied && m.autoFix) {
    deltaLines.push(`SAM auto-update: ${escapeHtml(m.autoFix)}`);
  }

  const deltas =
    deltaLines.length > 0
      ? deltaLines.map((line) => `<div class="how-delta">${line}</div>`).join('')
      : '';

  return `<div class="how-cell">
  <div class="how-code"><strong>${code}</strong></div>
  ${deltas}
</div>`;
}

function renderLegendBoxHtml() {
  const items = [
    ['EXACT', 'Same calendar date and same amount (automatic match).'],
    ['ADD', 'Automatic match with date drift. Δ line = calendar days between statement and register dates.'],
    ['AR', 'Automatic match with rounding tolerance (amount delta in centavos).'],
    ['ARDD', 'Rounding + date drift (see stacked Δ lines).'],
    ['FA', 'Automatic match with fee / SPEI-style adjustment (amount delta).'],
    ['AC', 'Automatic composite — multiple SAMS lines grouped to one bank movement.'],
    ['M1', 'Manual pair — one statement line ↔ one register line.'],
    ['MM', 'Manual group — multiple lines on each side; centavo totals matched.'],
    ['MJ', 'Manual justify — register line cleared with no bank counterpart (reason in notes).']
  ];
  const dl = items
    .map(
      ([c, desc]) =>
        `<dt>${escapeHtml(c)}</dt><dd>${escapeHtml(desc)}</dd>`
    )
    .join('');
  return `<div class="legend-box half"><h2>How matched — codes</h2><dl class="legend-dl">${dl}</dl></div>`;
}

function renderSummaryAndLegendHtml(session, matchRowCount) {
  const legend = renderLegendBoxHtml();
  const s = session.matchStats;
  if (!s || typeof s !== 'object') {
    const mini = `<div class="stats-box half"><h2>Matching summary</h2><table class="stats"><tr><td>${escapeHtml(
      'Matched groups (this report)'
    )}</td><td class="num">${escapeHtml(String(matchRowCount))}</td></tr></table></div>`;
    return `<div class="summary-pair">${mini}${legend}</div>`;
  }
  const matchedTotal = s.matchedCount != null ? s.matchedCount : matchRowCount;
  const rows = [
    ['Matched groups (this report)', matchedTotal],
    ['EXACT (same day)', s.exact],
    ['ADD (date drift ≤7d)', s.dateDrift],
    ['AR (rounding, same day)', s.roundingExact],
    ['ARDD (rounding + drift)', s.roundingDrift],
    ['FA (SPEI fee gap, same day)', s.speiFeeGapExact],
    ['FA (SPEI fee gap + drift)', s.speiFeeGapDrift],
    ['AC (multi-expense composite)', s.feeAdjusted]
  ];
  const visible = rows.filter(([k, v]) => {
    if (v == null) return false;
    if (String(k).includes('Matched groups')) return true;
    return Number(v) > 0;
  });
  const body = visible
    .map(
      ([k, v]) =>
        `<tr><td>${escapeHtml(k)}</td><td class="num">${escapeHtml(String(v))}</td></tr>`
    )
    .join('');
  const stats = `<div class="stats-box half"><h2>Matching summary</h2><table class="stats">${body}</table></div>`;
  return `<div class="summary-pair">${stats}${legend}</div>`;
}

/**
 * @param {object} params
 * @returns {Promise<string>} public URL
 */
export async function generateAndUploadReconciliationReport(params) {
  const { clientId, sessionId, session, clientDisplayName, acceptedByEmail } = params;

  const matchRows = session.matchMap || [];
  const normById = await loadNormalizedRowsById(clientId, sessionId);
  const txnById = await loadTransactionsById(clientId, collectAllTransactionIds(matchRows));

  const generatedCancun = DateTime.now().setZone('America/Cancun').toFormat('yyyy-MM-dd HH:mm z');

  const sortedMatches = [...matchRows].sort((a, b) => {
    const ka = bankDateSortKeyForMatch(a, normById, txnById);
    const kb = bankDateSortKeyForMatch(b, normById, txnById);
    const c = ka.localeCompare(kb);
    if (c !== 0) return c;
    const ba = bankIdsFromMatch(a)[0] || '';
    const bb = bankIdsFromMatch(b)[0] || '';
    const ib = String(ba).localeCompare(String(bb));
    if (ib !== 0) return ib;
    const ta = String(a.transactionId || a.transactionIds?.[0] || '');
    const tb = String(b.transactionId || b.transactionIds?.[0] || '');
    return ta.localeCompare(tb);
  });

  const matchRowsHtml = sortedMatches
    .map((m) => {
      const bankIds = bankIdsFromMatch(m);
      const bankHtml =
        bankIds.length > 0
          ? bankIds.map((bid) => formatBankLineHtml(normById[bid], bid)).join('<div class="sep"></div>')
          : `<div class="line-block no-bank"><em>No statement line</em> — SAMS line accepted with justification only (e.g. not on this statement, $0.00 register activity).</div>`;

      const primaryIds = primaryTransactionIds(m);
      const relatedIds = relatedTransactionIds(m);

      let txnHtml = primaryIds
        .map((tid) => formatTxnLineHtml(txnById[tid], tid))
        .join('<div class="sep"></div>');

      if (relatedIds.length > 0) {
        txnHtml += `<div class="related-hdr">Also linked (fees / splits)</div>`;
        txnHtml += relatedIds
          .map((tid) => formatTxnLineHtml(txnById[tid], tid))
          .join('<div class="sep"></div>');
      }

      const just = escapeHtml(m.justification || '').trim() || '—';

      return `<tr>
<td class="how">${matchHowMatchedCellHtml(m, normById, txnById)}</td>
<td class="dense stmt">${bankHtml}</td>
<td class="dense reg">${txnHtml}</td>
<td class="just">${just}</td>
</tr>`;
    })
    .join('');

  const statsBlock = renderSummaryAndLegendHtml(session, matchRows.length);
  const diffPesos = Number(session.differenceAmount || 0);
  const diffLabel = formatPesosSessionValue(diffPesos);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Bank reconciliation</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:20px 24px;color:#1a1a1a;font-size:11px;line-height:1.35;}
h1{font-size:20px;margin:0 0 4px 0;}
h2{font-size:13px;margin:16px 0 6px 0;color:#333;}
.table-sub{margin:0 0 10px 0;font-size:10px;color:#555;max-width:900px;}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:12px 0 16px 0;max-width:900px;}
.meta-row{font-size:12px;}
.meta-row strong{color:#333;}
.summary-pair{display:flex;flex-direction:row;gap:12px;align-items:stretch;margin:12px 0 16px;}
.summary-pair .half{flex:1 1 0;min-width:0;max-width:calc(50% - 6px);box-sizing:border-box;}
.stats-box,.legend-box{padding:10px 12px;background:#f7f9fc;border:1px solid #d9e2ef;border-radius:4px;}
.stats-box h2,.legend-box h2{font-size:13px;margin:0 0 8px 0;color:#333;}
table.stats{border-collapse:collapse;font-size:10px;width:100%;}
table.stats td{padding:3px 8px 3px 0;border:none;vertical-align:top;}
table.stats td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
.legend-dl{margin:0;font-size:9px;line-height:1.35;}
.legend-dl dt{font-weight:700;margin-top:5px;color:#1a1a1a;}
.legend-dl dd{margin:0 0 0 10px;color:#444;}
.main-table{border-collapse:collapse;width:100%;margin-top:6px;font-size:10px;table-layout:fixed;}
.main-table th,.main-table td{border:1px solid #c5c5c5;padding:8px 7px;vertical-align:top;word-wrap:break-word;}
.main-table th{background:#e8ecf2;font-weight:600;}
.main-table col.col-how{width:7.5%;}
.main-table col.col-stmt{width:35.75%;}
.main-table col.col-reg{width:35.75%;}
.main-table col.col-just{width:21%;}
.main-table th.how,.main-table td.how{padding:6px 4px;}
.main-table .just{font-size:10px;}
.how-cell{font-size:9px;line-height:1.25;}
.how-code{font-size:10px;margin-bottom:2px;white-space:nowrap;}
.how-delta{font-size:9px;color:#444;margin-top:2px;font-variant-numeric:tabular-nums;}
.line-block{margin:0;padding:0;}
.line-block.missing{color:#8b4513;}
.line-block.no-bank{font-style:italic;color:#555;font-size:10px;}
.line-main{margin-bottom:2px;}
.dt{font-family:Consolas,monospace;font-size:10px;color:#333;}
.pill{font-size:9px;background:#eef;padding:1px 5px;border-radius:3px;margin:0 4px;}
.amt{font-variant-numeric:tabular-nums;}
.desc{margin-top:2px;color:#222;}
.meta{font-size:9px;color:#555;margin-top:2px;}
.id-foot{font-size:8px;color:#888;margin-top:4px;font-family:Consolas,monospace;}
.sep{height:8px;border-bottom:1px dashed #ddd;margin:8px 0;}
.related-hdr{font-size:9px;font-weight:bold;color:#555;margin:8px 0 4px 0;}
.badge{font-size:9px;background:#e6f7e6;padding:2px 5px;border-radius:3px;display:inline-block;margin-top:4px;}
.hint{font-size:9px;color:#666;display:block;margin-top:2px;}
.footer{margin-top:20px;padding-top:12px;border-top:1px solid #ccc;font-size:10px;color:#555;}
.foot-note{margin-top:12px;font-size:9px;color:#666;max-width:100%;}
@media print{
  tr{page-break-inside:avoid;}
  thead{display:table-header-group;}
}
</style></head><body>
<h1>Bank statement reconciliation</h1>
<p style="margin:0 0 8px 0;font-size:12px;color:#444;">Register cleared to statement period — detail sufficient for audit and CPA review.</p>
<div class="meta-grid">
<div class="meta-row"><strong>Client</strong><br/>${escapeHtml(clientDisplayName)} (${escapeHtml(clientId)})</div>
<div class="meta-row"><strong>Bank account</strong><br/>${escapeHtml(session.accountName)} <span class="id-foot" style="display:inline;">(${escapeHtml(session.accountId)})</span></div>
<div class="meta-row"><strong>Statement period</strong><br/>${escapeHtml(session.startDate)} — ${escapeHtml(session.endDate)}</div>
<div class="meta-row"><strong>Session id</strong><br/><span class="id-foot" style="font-size:10px;">${escapeHtml(sessionId)}</span></div>
<div class="meta-row"><strong>Opening balance (statement)</strong><br/>${escapeHtml(formatPesosSessionValue(session.openingBalance))}</div>
<div class="meta-row"><strong>Ending balance (statement)</strong><br/>${escapeHtml(formatPesosSessionValue(session.endingBalance))}</div>
<div class="meta-row"><strong>Prepared for acceptance</strong><br/>${escapeHtml(generatedCancun)}</div>
<div class="meta-row"><strong>Recorded by</strong><br/>${escapeHtml(acceptedByEmail || '—')}</div>
</div>
${statsBlock}
<h2>Matched statement lines ↔ SAMS register</h2>
<p class="table-sub">Rows are sorted by the <strong>earliest statement date</strong> in each match (bank file). If there is no statement line, the earliest register date is used.</p>
<table class="main-table">
<colgroup>
<col class="col-how" />
<col class="col-stmt" />
<col class="col-reg" />
<col class="col-just" />
</colgroup>
<thead><tr>
<th class="how">Match</th>
<th>Statement (imported bank file)</th>
<th>SAMS register</th>
<th class="just">Justification / notes</th>
</tr></thead>
<tbody>${matchRowsHtml || '<tr><td colspan="4">No matches recorded</td></tr>'}</tbody>
</table>
<div class="footer">
<strong>Residual at acceptance (pesos):</strong> ${escapeHtml(diffLabel)}
</div>
<div class="foot-note">
<strong>Note:</strong> See <strong>How matched — codes</strong> above. “Import id” and “SAMS id” footers are internal keys for cross-checks. Amounts are MXN (centavo-accurate). Statement lines follow the normalized import (e.g. Scotia SPEI reference groups).
</div>
</body></html>`;

  const pdfBuffer = await generatePdf(html, {
    format: 'Letter',
    footerMeta: {
      statementId: sessionId,
      generatedAt: generatedCancun
    }
  });
  const app = await getApp();
  const bucketName = getStorageBucketName();
  const bucket = app.storage().bucket(bucketName);
  const storagePath = `clients/${clientId}/reconciliation-reports/${sessionId}.pdf`;
  const file = bucket.file(storagePath);

  await file.save(pdfBuffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        generatedAt: getNow().toISOString(),
        source: 'bank-reconciliation'
      }
    }
  });

  await file.makePublic();
  return `https://storage.googleapis.com/${bucketName}/${storagePath}`;
}
