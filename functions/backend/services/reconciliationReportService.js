import { getApp } from '../firebase.js';
import { generatePdf } from './pdfService.js';
import { getNow } from '../services/DateService.js';
import { getStorageBucketName } from '../utils/storageBucketName.js';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} params
 * @returns {Promise<string>} public URL
 */
export async function generateAndUploadReconciliationReport(params) {
  const {
    clientId,
    sessionId,
    session,
    clientDisplayName,
    acceptedByEmail
  } = params;

  const rows = session.matchMap || [];
  const matchRowsHtml = rows
    .map((m) => {
      const extra = m.relatedTransactionIds?.length
        ? ` (+${m.relatedTransactionIds.length} fee)`
        : '';
      return `<tr><td>${escapeHtml(m.matchType)}</td><td>${escapeHtml(m.normalizedRowId)}</td><td>${escapeHtml(m.transactionId)}${extra}</td><td>${escapeHtml(m.justification || '')}</td></tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Bank reconciliation</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#222;}
h1{font-size:20px;}
table{border-collapse:collapse;width:100%;margin-top:16px;font-size:12px;}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}
th{background:#f0f0f0;}
.meta{margin:12px 0;font-size:13px;}
</style></head><body>
<h1>Bank statement reconciliation</h1>
<div class="meta"><strong>Client:</strong> ${escapeHtml(clientDisplayName)} (${escapeHtml(clientId)})</div>
<div class="meta"><strong>Account:</strong> ${escapeHtml(session.accountName)} (${escapeHtml(session.accountId)})</div>
<div class="meta"><strong>Period:</strong> ${escapeHtml(session.startDate)} — ${escapeHtml(session.endDate)}</div>
<div class="meta"><strong>Opening balance (statement):</strong> ${escapeHtml(String(session.openingBalance))}</div>
<div class="meta"><strong>Ending balance (statement):</strong> ${escapeHtml(String(session.endingBalance))}</div>
<div class="meta"><strong>Accepted:</strong> ${escapeHtml(getNow().toISOString())} by ${escapeHtml(acceptedByEmail || '')}</div>
<table>
<thead><tr><th>Match type</th><th>Bank row</th><th>Transaction</th><th>Justification</th></tr></thead>
<tbody>${matchRowsHtml || '<tr><td colspan="4">No matches recorded</td></tr>'}</tbody>
</table>
<p style="margin-top:24px;font-size:11px;color:#666;">Difference at acceptance: ${escapeHtml(String(session.differenceAmount ?? 0))}</p>
</body></html>`;

  const pdfBuffer = await generatePdf(html, { format: 'Letter' });
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
