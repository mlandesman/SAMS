/**
 * Bid Comparison HTML Service
 * Generates HTML report for comparing project bids - suitable for PDF export
 */

import { getDb } from '../firebase.js';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Format currency (centavos to USD display)
 */
function formatCurrency(centavos) {
  if (centavos === null || centavos === undefined || isNaN(centavos)) {
    return '$0.00';
  }
  const amount = centavos / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Translate labels to Spanish
 */
function translateLabel(label, language) {
  if (language !== 'spanish') return label;
  
  const translations = {
    'Bid Comparison': 'Comparacion de Ofertas',
    'Project': 'Proyecto',
    'Description': 'Descripcion',
    'Bid Deadline': 'Fecha Limite de Ofertas',
    'Status': 'Estado',
    'Vendor': 'Proveedor',
    'Amount': 'Monto',
    'Timeline': 'Plazo',
    'Submitted': 'Enviado',
    'Revisions': 'Revisiones',
    'Inclusions': 'Incluye',
    'Exclusions': 'No Incluye',
    'Payment Terms': 'Terminos de Pago',
    'Documents': 'Documentos',
    'Lowest': 'Mas Bajo',
    'selected': 'seleccionado',
    'rejected': 'rechazado',
    'active': 'activo',
    'withdrawn': 'retirado',
    'No bids available': 'No hay ofertas disponibles',
    'Generated': 'Generado'
  };
  
  return translations[label] || label;
}

/**
 * Get status chip color
 */
function getStatusColor(status) {
  switch (status) {
    case 'selected': return '#059669'; // green
    case 'rejected': return '#dc2626'; // red
    case 'active': return '#2563eb'; // blue
    case 'withdrawn': return '#6b7280'; // gray
    default: return '#6b7280';
  }
}

/**
 * Generate Bid Comparison HTML Report
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} language - 'english' or 'spanish'
 * @returns {Promise<{ html: string, meta: object }>}
 */
export async function generateBidComparisonHtml(clientId, projectId, language = 'english') {
  const db = await getDb();
  const isSpanish = language === 'spanish' || language === 'es';
  
  // Get client info
  const clientDoc = await db.collection('clients').doc(clientId).get();
  if (!clientDoc.exists) {
    throw new Error(`Client ${clientId} not found`);
  }
  
  const clientData = clientDoc.data();
  const clientName = clientData.basicInfo?.fullName || clientData.basicInfo?.displayName || clientData.name || clientData.displayName || clientId;
  const logoUrl = clientData.branding?.logoUrl;
  const normalizedLogoUrl = logoUrl && logoUrl.trim() !== '' ? logoUrl : null;
  
  // Get project info
  const projectDoc = await db.doc(`clients/${clientId}/projects/${projectId}`).get();
  if (!projectDoc.exists) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  const projectData = projectDoc.data();
  const project = { 
    id: projectDoc.id, 
    ...projectData,
    // Use Spanish name/description if available and language is Spanish
    name: isSpanish && projectData.name_es ? projectData.name_es : projectData.name,
    description: isSpanish && projectData.description_es ? projectData.description_es : projectData.description
  };
  
  // Get bids for project
  const bidsSnapshot = await db.collection(`clients/${clientId}/projects/${projectId}/bids`)
    .orderBy('createdAt', 'desc')
    .get();
  
  const bids = [];
  bidsSnapshot.forEach(doc => {
    bids.push({ id: doc.id, ...doc.data() });
  });
  
  // Process bids for comparison (same logic as BidComparisonView.jsx)
  const comparisonData = bids.map(bid => {
    const revision = bid.revisions?.[bid.currentRevision - 1] || {};
    return {
      id: bid.id,
      vendorName: bid.vendorName || 'Unknown Vendor',
      status: bid.status || 'active',
      amount: revision.amount || 0,
      timeline: revision.timeline || '-',
      submittedAt: revision.submittedAt,
      revisions: bid.currentRevision || 1,
      inclusions: revision.inclusions || '-',
      exclusions: revision.exclusions || '-',
      paymentTerms: revision.paymentTerms || '-',
      documents: revision.documents?.length || 0
    };
  }).sort((a, b) => a.amount - b.amount); // Sort by amount ascending (lowest first)
  
  // Find lowest amount
  const lowestAmount = comparisonData.length > 0
    ? Math.min(...comparisonData.map(b => b.amount))
    : 0;
  
  // Read common CSS
  let reportCommonCss = '';
  try {
    const cssPath = path.join(__dirname, '../templates/reports/reportCommon.css');
    reportCommonCss = fs.readFileSync(cssPath, 'utf8');
  } catch (e) {
    console.warn('Could not load reportCommon.css:', e.message);
  }
  
  const generatedAt = DateTime.now().setZone('America/Cancun').toFormat('dd-MMM-yyyy HH:mm');
  const reportId = `BID-${clientId}-${projectId}`;
  
  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="${isSpanish ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${translateLabel('Bid Comparison', language)} - ${project.name || 'Project'}</title>
  <style>
    ${reportCommonCss}
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1f2937;
      margin: 0;
      padding: 20px;
      background: #fff;
    }
    
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .report-header-left h1 {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 4px 0;
    }
    
    .report-header-left .client-name {
      font-size: 12px;
      color: #6b7280;
      margin: 0;
    }
    
    .report-header-right {
      text-align: right;
    }
    
    .report-header-right img {
      max-width: 120px;
      max-height: 60px;
      object-fit: contain;
    }
    
    .project-info {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }
    
    .project-info h2 {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 8px 0;
    }
    
    .project-info p {
      font-size: 11px;
      color: #4b5563;
      margin: 4px 0;
    }
    
    .project-info .label {
      font-weight: 600;
      color: #374151;
    }
    
    .comparison-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-top: 16px;
    }
    
    .comparison-table th,
    .comparison-table td {
      border: 1px solid #e5e7eb;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    
    .comparison-table th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }
    
    .comparison-table th.vendor-header {
      text-align: center;
      min-width: 120px;
    }
    
    .comparison-table .criteria-cell {
      font-weight: 600;
      background: #fafafa;
      width: 100px;
    }
    
    .comparison-table td {
      background: #fff;
    }
    
    .comparison-table .amount-row td {
      background: rgba(37, 99, 235, 0.04);
    }
    
    .comparison-table .lowest-amount {
      background: rgba(16, 185, 129, 0.1) !important;
      color: #059669;
      font-weight: 700;
    }
    
    .lowest-badge {
      display: block;
      font-size: 9px;
      color: #059669;
      font-weight: 500;
    }
    
    .status-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 500;
      color: #fff;
      text-transform: capitalize;
    }
    
    .text-center {
      text-align: center;
    }
    
    .no-bids {
      text-align: center;
      color: #6b7280;
      padding: 32px;
      font-style: italic;
    }
    
    .report-footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 9px;
      color: #9ca3af;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="report-header-left">
      <h1>${translateLabel('Bid Comparison', language)}</h1>
      <p class="client-name">${clientName}</p>
    </div>
    ${normalizedLogoUrl ? `<div class="report-header-right"><img src="${normalizedLogoUrl}" alt="${clientName}" /></div>` : ''}
  </div>
  
  <div class="project-info">
    <h2>${translateLabel('Project', language)}: ${project.name || 'Unnamed Project'}</h2>
    ${project.description ? `<p><span class="label">${translateLabel('Description', language)}:</span> ${project.description}</p>` : ''}
    ${project.bidDeadline ? `<p><span class="label">${translateLabel('Bid Deadline', language)}:</span> ${formatDate(project.bidDeadline)}</p>` : ''}
    <p><span class="label">${translateLabel('Status', language)}:</span> ${project.status || 'unknown'}</p>
  </div>
  
  ${comparisonData.length === 0 ? `
    <div class="no-bids">${translateLabel('No bids available', language)}</div>
  ` : `
    <table class="comparison-table">
      <thead>
        <tr>
          <th class="criteria-cell"></th>
          ${comparisonData.map(bid => `
            <th class="vendor-header">
              ${bid.status === 'selected' ? '&#10003; ' : ''}${bid.vendorName}
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="criteria-cell">${translateLabel('Status', language)}</td>
          ${comparisonData.map(bid => `
            <td class="text-center">
              <span class="status-chip" style="background-color: ${getStatusColor(bid.status)}">
                ${translateLabel(bid.status, language)}
              </span>
            </td>
          `).join('')}
        </tr>
        <tr class="amount-row">
          <td class="criteria-cell">${translateLabel('Amount', language)}</td>
          ${comparisonData.map(bid => `
            <td class="text-center ${bid.amount === lowestAmount ? 'lowest-amount' : ''}">
              ${formatCurrency(bid.amount)}
              ${bid.amount === lowestAmount ? `<span class="lowest-badge">${translateLabel('Lowest', language)}</span>` : ''}
            </td>
          `).join('')}
        </tr>
        <tr>
          <td class="criteria-cell">${translateLabel('Timeline', language)}</td>
          ${comparisonData.map(bid => `<td class="text-center">${bid.timeline}</td>`).join('')}
        </tr>
        <tr>
          <td class="criteria-cell">${translateLabel('Submitted', language)}</td>
          ${comparisonData.map(bid => `<td class="text-center">${formatDate(bid.submittedAt)}</td>`).join('')}
        </tr>
        <tr>
          <td class="criteria-cell">${translateLabel('Revisions', language)}</td>
          ${comparisonData.map(bid => `<td class="text-center">${bid.revisions}</td>`).join('')}
        </tr>
        <tr>
          <td class="criteria-cell">${translateLabel('Inclusions', language)}</td>
          ${comparisonData.map(bid => `<td>${bid.inclusions}</td>`).join('')}
        </tr>
        <tr>
          <td class="criteria-cell">${translateLabel('Exclusions', language)}</td>
          ${comparisonData.map(bid => `<td>${bid.exclusions}</td>`).join('')}
        </tr>
        <tr>
          <td class="criteria-cell">${translateLabel('Payment Terms', language)}</td>
          ${comparisonData.map(bid => `<td>${bid.paymentTerms}</td>`).join('')}
        </tr>
        <tr>
          <td class="criteria-cell">${translateLabel('Documents', language)}</td>
          ${comparisonData.map(bid => `<td class="text-center">${bid.documents}</td>`).join('')}
        </tr>
      </tbody>
    </table>
  `}
  
  <div class="report-footer">
    <span>ID: ${reportId}</span>
    <span>${translateLabel('Generated', language)}: ${generatedAt}</span>
  </div>
</body>
</html>`;

  return {
    html,
    meta: {
      reportId,
      clientId,
      projectId,
      projectName: project.name,
      language,
      bidCount: comparisonData.length,
      generatedAt
    }
  };
}
