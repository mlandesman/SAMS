/**
 * yearEndReportService.js
 * Generates Board Report PDF for year-end processing
 * Uses PDFShift for PDF generation
 */

import { generatePdf } from './pdfService.js';
import { centavosToPesos } from '../../shared/utils/currencyUtils.js';
import { getNow } from '../services/DateService.js';
import { DateTime } from 'luxon';

/**
 * Generate Board Report PDF
 * @param {Object} previewData - Preview data from yearEndController
 * @param {string} language - 'english' or 'spanish'
 * @param {Object} user - User object
 * @returns {Buffer} PDF buffer
 */
export async function generateBoardReportPDF(previewData, language = 'english', user) {
  const isSpanish = language.toLowerCase() === 'spanish' || language.toLowerCase() === 'es';
  
  const { client, closingYear, openingYear, snapshotDate, accounts, units } = previewData;
  
  // Format date as dd-MMM-yy (unambiguous for international clients)
  const generatedDate = getNow();
  const dt = DateTime.fromJSDate(generatedDate).setZone('America/Cancun');
  const formattedDate = dt.toFormat('dd-MMM-yy');
  
  // Calculate totals
  // Note: accounts.balance is in centavos, balanceDue is in centavos, creditBalance is in pesos
  const totalAccountBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalBalanceDue = units.reduce((sum, unit) => sum + (unit.balanceDue || 0), 0); // Already in centavos
  const totalCreditBalance = units.reduce((sum, unit) => sum + (unit.creditBalance || 0), 0); // Already in pesos
  
  // Find units with balance due, credit balance, and rate changes
  const unitsWithBalanceDue = units.filter(u => (u.balanceDue || 0) > 0);
  const unitsWithCredit = units.filter(u => (u.creditBalance || 0) > 0);
  const unitsWithRateChange = units.filter(u => {
    const current = centavosToPesos(u.currentYearScheduledAmount || 0);
    const next = centavosToPesos(u.nextYearScheduledAmount || 0);
    return Math.abs(next - current) > 0.01;
  });
  
  // Format currency helper
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(isSpanish ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  // Format centavos to pesos for display
  const formatCentavos = (centavos) => formatCurrency(centavosToPesos(centavos));
  
  // Build HTML content
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      line-height: 1.4;
      margin: 0;
      padding: 20px;
      color: #000;
    }
    h1 {
      text-align: center;
      font-size: 16pt;
      margin-bottom: 10px;
      font-weight: bold;
    }
    h2 {
      font-size: 12pt;
      margin-top: 20px;
      margin-bottom: 10px;
      font-weight: bold;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .separator {
      border-top: 2px solid #000;
      margin: 15px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 9pt;
    }
    table th, table td {
      border: 1px solid #000;
      padding: 4px 6px;
      text-align: left;
    }
    table th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    table tr.total-row {
      font-weight: bold;
      background-color: #f0f0f0;
    }
    .summary-section {
      margin-top: 20px;
    }
    .summary-item {
      margin: 5px 0;
    }
    .notes {
      margin-top: 20px;
      font-size: 9pt;
      font-style: italic;
    }
    .footer {
      margin-top: 30px;
      font-size: 9pt;
      text-align: right;
    }
    .rate-change {
      color: #0066cc;
    }
    .rate-increase::before {
      content: "+";
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${isSpanish ? 'INFORME DE FIN DE AÑO' : 'YEAR-END REPORT'}</h1>
    <p><strong>${client.name}</strong> - ${isSpanish ? 'Año Fiscal' : 'Fiscal Year'} ${closingYear}</p>
    <p>${isSpanish ? 'Generado' : 'Generated'}: ${formattedDate}</p>
  </div>
  
  <div class="separator"></div>
  
  <h2>${isSpanish ? 'SALDOS DE CUENTAS' : 'ACCOUNT BALANCES'} (${isSpanish ? 'Al' : 'As of'} ${snapshotDate})</h2>
  
  <table>
    <thead>
      <tr>
        <th>${isSpanish ? 'Cuenta' : 'Account'}</th>
        <th style="text-align: right;">${isSpanish ? 'Saldo' : 'Balance'}</th>
      </tr>
    </thead>
    <tbody>
      ${accounts.map(acc => `
        <tr>
          <td>${acc.name}</td>
          <td style="text-align: right;">${formatCentavos(acc.balance)}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td><strong>${isSpanish ? 'TOTAL' : 'TOTAL'}</strong></td>
        <td style="text-align: right;"><strong>${formatCentavos(totalAccountBalance)}</strong></td>
      </tr>
    </tbody>
  </table>
  
  <div class="separator"></div>
  
  <h2>${isSpanish ? 'RESUMEN DE ESTADO DE UNIDADES' : 'UNIT STATUS SUMMARY'}</h2>
  
  <table>
    <thead>
      <tr>
        <th>${isSpanish ? 'Unidad' : 'Unit'}</th>
        <th>${isSpanish ? 'Propietario(s)' : 'Owner Name(s)'}</th>
        <th style="text-align: right;">${closingYear} ${isSpanish ? 'Tasa' : 'Rate'}</th>
        <th style="text-align: right;">${openingYear} ${isSpanish ? 'Tasa' : 'Rate'}</th>
        <th style="text-align: right;">${isSpanish ? 'Cambio' : 'Change'}</th>
        <th style="text-align: right;">${isSpanish ? 'Saldo Adeudado' : 'Balance Due'}</th>
        <th style="text-align: right;">${isSpanish ? 'Saldo de Crédito' : 'Credit Bal'}</th>
      </tr>
    </thead>
    <tbody>
      ${units.map(unit => {
        const currentRatePesos = centavosToPesos(unit.currentYearScheduledAmount || 0);
        const nextRatePesos = centavosToPesos(unit.nextYearScheduledAmount || 0);
        const rateChange = nextRatePesos - currentRatePesos;
        const rateChangeDisplay = Math.abs(rateChange) < 0.01 
          ? '—' 
          : `${rateChange >= 0 ? '+' : ''}${formatCurrency(rateChange)}`;
        const rateChangeClass = Math.abs(rateChange) < 0.01 ? '' : 'rate-change';
        
        return `
          <tr>
            <td>${unit.unitId}</td>
            <td>${unit.ownerNames || ''}</td>
            <td style="text-align: right;">${formatCurrency(unit.currentYearScheduledAmount || 0)}</td>
            <td style="text-align: right;">${formatCurrency(unit.nextYearScheduledAmount || 0)}</td>
            <td style="text-align: right;" class="${rateChangeClass}">${rateChangeDisplay}</td>
            <td style="text-align: right;">${formatCentavos(unit.balanceDue || 0)}</td>
            <td style="text-align: right;">${formatCurrency(unit.creditBalance || 0)}</td>
          </tr>
        `;
      }).join('')}
      <tr class="total-row">
        <td><strong>${isSpanish ? 'TOTALES' : 'TOTALS'}</strong></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td style="text-align: right;"><strong>${formatCentavos(totalBalanceDue)}</strong></td>
        <td style="text-align: right;"><strong>${formatCurrency(totalCreditBalance)}</strong></td>
      </tr>
    </tbody>
  </table>
  
  <div class="separator"></div>
  
  <div class="summary-section">
    <h2>${isSpanish ? 'RESUMEN' : 'SUMMARY'}</h2>
    
    <div class="summary-item">
      <strong>${isSpanish ? 'Unidades con Saldo Adeudado' : 'Units with Balance Due'}:</strong> ${unitsWithBalanceDue.length}
      ${unitsWithBalanceDue.length > 0 ? `
        <ul>
          ${unitsWithBalanceDue.map(u => `
            <li>${isSpanish ? 'Unidad' : 'Unit'} ${u.unitId}: ${formatCentavos(u.balanceDue || 0)} ${isSpanish ? '(se transferirá con penalizaciones)' : '(will carry forward with penalties)'}</li>
          `).join('')}
        </ul>
      ` : ''}
    </div>
    
    <div class="summary-item">
      <strong>${isSpanish ? 'Unidades con Saldo de Crédito' : 'Units with Credit Balance'}:</strong> ${unitsWithCredit.length}
      ${unitsWithCredit.length > 0 ? `
        <ul>
          ${unitsWithCredit.map(u => `
            <li>${isSpanish ? 'Unidad' : 'Unit'} ${u.unitId}: ${formatCurrency(u.creditBalance || 0)}</li>
          `).join('')}
        </ul>
      ` : ''}
    </div>
    
    <div class="summary-item">
      <strong>${isSpanish ? 'Cambios de Tasa' : 'Rate Changes'}:</strong> ${unitsWithRateChange.length}
      ${unitsWithRateChange.length > 0 ? `
        <ul>
          ${unitsWithRateChange.map(u => {
            const currentRatePesos = centavosToPesos(u.currentYearScheduledAmount || 0);
            const nextRatePesos = centavosToPesos(u.nextYearScheduledAmount || 0);
            const change = nextRatePesos - currentRatePesos;
            const percentChange = ((change / currentRatePesos) * 100).toFixed(1);
            return `
              <li>${isSpanish ? 'Unidad' : 'Unit'} ${u.unitId}: ${formatCurrency(u.currentYearScheduledAmount || 0)} → ${formatCurrency(u.nextYearScheduledAmount || 0)} (${change >= 0 ? '+' : ''}${percentChange}%)</li>
            `;
          }).join('')}
        </ul>
      ` : ''}
    </div>
  </div>
  
  <div class="separator"></div>
  
  <div class="notes">
    <p><strong>${isSpanish ? 'NOTAS' : 'NOTES'}:</strong></p>
    <ul>
      <li>${isSpanish ? 'Los saldos pendientes se transferirán con el cálculo de penalizaciones según las reglas de la HOA' : 'Outstanding balances carry forward with penalty calculation per HOA rules'}</li>
      <li>${isSpanish ? 'Este informe fue generado para revisión del consejo' : 'This report was generated for board review purposes'}</li>
    </ul>
  </div>
  
  <div class="footer">
    <p><strong>${isSpanish ? 'Preparado por' : 'Prepared by'}:</strong> ${user?.email || user?.name || 'System'}</p>
    <p><strong>${isSpanish ? 'Fecha' : 'Date'}:</strong> ${formattedDate}</p>
  </div>
</body>
</html>
  `.trim();
  
  // Generate PDF using PDFShift
  const pdfBuffer = await generatePdf(html, {
    footerMeta: {
      statementId: `YEAR-END-${client.id}-${closingYear}`,
      generatedAt: formattedDate,
      language: language.toLowerCase()
    }
  });
  
  return pdfBuffer;
}

// Helper function to convert pesos to centavos (for calculations)
function pesosToCentavosHelper(pesos) {
  return Math.round(pesos * 100);
}

