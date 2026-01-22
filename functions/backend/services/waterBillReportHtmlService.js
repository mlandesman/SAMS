/**
 * Water Bill Report HTML Service
 * Generates Statement-quality HTML for Water Consumption Reports
 * 
 * Supports:
 * - Bilingual output (English/Spanish on same report - dual language display)
 * - PDF-ready formatting with page breaks
 * - Reuses existing pdfService.js for PDF conversion
 * - SVG bar chart with Sandyland Sea-to-Sand gradient
 * 
 * Architecture Pattern:
 * - Data service (waterBillReportService.js) structures the data
 * - HTML service (this file) renders the data
 * - PDF service (pdfService.js) converts HTML to PDF
 */

import { generateWaterConsumptionReportData } from './waterBillReportService.js';
import { DateTime } from 'luxon';
import { getNow } from '../../shared/services/DateService.js';
import { formatCurrency as formatCurrencyUtil } from '../../shared/utils/currencyUtils.js';

/**
 * Generate Water Consumption Report HTML for a single unit
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {Object} options - { language: 'english'|'spanish', fiscalYear?: number }
 * @returns {Promise<Object>} { html, meta, reportData }
 */
export async function generateWaterConsumptionReportHtml(clientId, unitId, options = {}) {
  const language = options.language || 'english';
  
  // Get report data from data service
  const reportData = await generateWaterConsumptionReportData(clientId, unitId, options);
  
  if (reportData.error) {
    return {
      error: reportData.error,
      html: null,
      meta: null,
      reportData: null
    };
  }
  
  // Build HTML content
  const html = buildHtmlContent(reportData, language);
  
  // Build metadata for PDF footer
  const meta = {
    reportId: reportData.reportId,
    generatedAt: reportData.generatedAt,
    language
  };
  
  return {
    html,
    meta,
    reportData
  };
}

/**
 * Generate both English and Spanish versions of the report
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {Object} options - Optional parameters
 * @returns {Promise<Object>} { htmlEn, htmlEs, metaEn, metaEs, reportData }
 */
export async function generateBothLanguageReports(clientId, unitId, options = {}) {
  // Get report data once (language-agnostic)
  const reportData = await generateWaterConsumptionReportData(clientId, unitId, options);
  
  if (reportData.error) {
    return {
      error: reportData.error,
      htmlEn: null,
      htmlEs: null,
      metaEn: null,
      metaEs: null,
      reportData: null
    };
  }
  
  // Build both language versions
  const htmlEn = buildHtmlContent(reportData, 'english');
  const htmlEs = buildHtmlContent(reportData, 'spanish');
  
  const metaEn = {
    reportId: reportData.reportId,
    generatedAt: reportData.generatedAt,
    language: 'english'
  };
  
  const metaEs = {
    reportId: reportData.reportId,
    generatedAt: reportData.generatedAt,
    language: 'spanish'
  };
  
  return {
    htmlEn,
    htmlEs,
    metaEn,
    metaEs,
    reportData
  };
}

/**
 * Build complete HTML document
 * @param {Object} data - Report data from waterBillReportService
 * @param {string} language - 'english' or 'spanish'
 * @returns {string} Complete HTML document
 */
function buildHtmlContent(data, language) {
  const t = getTranslations(language);
  
  // Format generated date
  const generatedAt = DateTime.fromISO(data.generatedAt).toFormat('MMMM d, yyyy');
  
  // Build sections
  const headerHtml = buildHeader(data, t, generatedAt);
  const summaryBoxHtml = buildSummaryBox(data, t);
  const chartHtml = buildConsumptionChart(data, t);
  const comparisonHtml = buildPercentileComparison(data, t);
  const quartersHtml = buildQuarterlyDetails(data, t);
  const leakCheckHtml = buildLeakCheckInfo(t);
  const footerHtml = buildFooter(data, t, generatedAt);
  
  // REORDERED: Quarterly details first (primary data), then summary/analysis
  return `<!DOCTYPE html>
<html lang="${language === 'spanish' ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <title>${t.title} - ${t.unit} ${data.unitId}</title>
  <style>${getReportCss()}</style>
</head>
<body>
  <div class="report-container">
    ${headerHtml}
    ${quartersHtml}
    ${summaryBoxHtml}
    ${chartHtml}
    ${comparisonHtml}
    ${leakCheckHtml}
    ${footerHtml}
  </div>
</body>
</html>`;
}

/**
 * Build header section (single language)
 */
function buildHeader(data, t, generatedAt) {
  const { unit, client, fiscalYears } = data;
  
  // Get fiscal year range for display
  const fiscalYear = fiscalYears.length > 0 
    ? fiscalYears[fiscalYears.length - 1].fiscalYear 
    : DateTime.now().year;
  
  const fiscalYearLabel = `${fiscalYear} (${t.fiscalYearRange})`;
  
  // Owner names
  const ownerNames = unit.owners || 'N/A';
  
  return `
    <div class="report-header">
      <div class="header-title">
        <div class="title-main">${t.title}</div>
      </div>
      
      <div class="header-info">
        <div class="info-row">
          <span class="info-label">${t.unit}:</span>
          <span class="info-value">${data.unitId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${t.owner}:</span>
          <span class="info-value">${ownerNames}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${t.property}:</span>
          <span class="info-value">${client.name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${t.fiscalYear}:</span>
          <span class="info-value">${fiscalYearLabel}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${t.generated}:</span>
          <span class="info-value">${generatedAt}</span>
        </div>
      </div>
    </div>`;
}

/**
 * Build summary box (At-a-Glance metrics)
 * NOTE: Balance removed per user request - bills are not paid via this report
 * LAYOUT: 2x2 grid with Current Rate in footer note for cleaner balance
 */
function buildSummaryBox(data, t) {
  const { summary, client } = data;
  
  return `
    <div class="summary-box">
      <div class="summary-title">${t.atAGlance}</div>
      <div class="metrics-grid-balanced">
        <div class="metric">
          <div class="metric-label">${t.ytdUsage}</div>
          <div class="metric-value">${summary.ytdConsumption} m³</div>
        </div>
        <div class="metric">
          <div class="metric-label">${t.ytdCharges}</div>
          <div class="metric-value">${formatCurrency(summary.ytdCharges * 100)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">${t.monthlyAvg}</div>
          <div class="metric-value">${summary.monthlyAverage.toFixed(1)} m³/mo</div>
        </div>
        <div class="metric highlight">
          <div class="metric-label">${t.dailyAvg}</div>
          <div class="metric-value">${summary.dailyAverage.toFixed(2)} m³/day</div>
        </div>
      </div>
      <div class="data-note">${t.basedOn} ${summary.monthsWithData} ${t.monthsOfData}. ${t.currentBillingRate} ${formatCurrency(client.ratePerM3 * 100)}/m³</div>
    </div>`;
}

/**
 * Build consumption chart (SVG bar chart)
 */
function buildConsumptionChart(data, t) {
  const { chartData } = data;
  
  if (!chartData || chartData.months.length === 0) {
    return `
      <div class="chart-section">
        <div class="section-title">${t.monthlyConsumption}</div>
        <p class="no-data">${t.noDataAvailable}</p>
      </div>`;
  }
  
  const svgChart = buildSvgBarChart(chartData);
  
  return `
    <div class="chart-section">
      <div class="section-title">${t.monthlyConsumption}</div>
      ${svgChart}
    </div>`;
}

/**
 * Build SVG bar chart with Sandyland Sea-to-Sand gradient
 */
function buildSvgBarChart(chartData) {
  const { months, average, maxValue } = chartData;
  
  const width = 600;
  const height = 200;
  const barWidth = 40;
  const gap = 10;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Calculate bar positions
  const totalBars = months.length;
  const availableWidth = chartWidth - (gap * (totalBars - 1));
  const actualBarWidth = Math.min(barWidth, availableWidth / totalBars);
  
  // Build bars
  let bars = '';
  months.forEach((month, i) => {
    const barHeight = maxValue > 0 ? (month.consumption / maxValue) * chartHeight : 0;
    const x = padding.left + i * (actualBarWidth + gap);
    const y = padding.top + chartHeight - barHeight;
    
    bars += `
      <rect x="${x}" y="${y}" width="${actualBarWidth}" height="${barHeight}" 
            fill="url(#sandyland-gradient)" rx="3"/>
      <text x="${x + actualBarWidth/2}" y="${y - 5}" 
            text-anchor="middle" class="bar-value">${month.consumption}</text>
      <text x="${x + actualBarWidth/2}" y="${height - 10}" 
            text-anchor="middle" class="bar-label">${month.shortLabel}</text>`;
  });
  
  // Average line
  const avgY = maxValue > 0 
    ? padding.top + chartHeight - (average / maxValue) * chartHeight
    : padding.top + chartHeight;
  const avgLine = `
    <line x1="${padding.left}" y1="${avgY}" 
          x2="${width - padding.right}" y2="${avgY}"
          stroke="#666" stroke-dasharray="5,5" stroke-width="1"/>
    <text x="${width - padding.right + 5}" y="${avgY + 4}" 
          class="avg-label">Avg: ${average.toFixed(1)}</text>`;
  
  return `
    <svg viewBox="0 0 ${width} ${height}" class="consumption-chart">
      <defs>
        <linearGradient id="sandyland-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0863BF"/>
          <stop offset="72%" stop-color="#83C4F2"/>
          <stop offset="100%" stop-color="#F7E4C2"/>
        </linearGradient>
      </defs>
      ${bars}
      ${avgLine}
    </svg>`;
}

/**
 * Build percentile comparison section (single language)
 */
function buildPercentileComparison(data, t) {
  const { comparison } = data;
  
  if (!comparison) {
    return ''; // Not enough data for comparison
  }
  
  const percentile = comparison.percentile;
  
  return `
    <div class="comparison-section">
      <div class="section-title">${t.howYouCompare}</div>
      
      <p class="comparison-intro">
        ${t.comparisonIntro} ${comparison.totalUnits} ${t.units}:
      </p>
      
      <div class="percentile-bar">
        <div class="percentile-track">
          <div class="percentile-marker" style="left: ${percentile}%"></div>
        </div>
        <div class="percentile-labels">
          <span>0%<br>${t.lowUsage}</span>
          <span>50%</span>
          <span>100%<br>${t.highUsage}</span>
        </div>
      </div>
      
      <p class="percentile-text">
        ${t.yourUnitIs} <strong>${percentile}${t.percentileSuffix}</strong><br>
        (${t.usesMore} ${percentile}% ${t.ofUnits}, ${t.lessThan} ${100 - percentile}%)
      </p>
      
      <div class="comparison-note">
        <strong>${t.note}:</strong> ${t.usageVariesNote}
      </div>
    </div>`;
}

/**
 * Build quarterly details section (single language)
 */
function buildQuarterlyDetails(data, t) {
  const { fiscalYears } = data;
  
  if (fiscalYears.length === 0) {
    return `<div class="no-data">${t.noDataAvailable}</div>`;
  }
  
  let quartersHtml = `<div class="section-title">${t.quarterlyBreakdown}</div>`;
  
  for (const fy of fiscalYears) {
    for (const quarter of fy.quarters) {
      quartersHtml += buildQuarterSection(quarter, t);
    }
  }
  
  return quartersHtml;
}

/**
 * Build single quarter section (single language)
 */
function buildQuarterSection(quarter, t) {
  const statusClass = `status-${quarter.status}`;
  const statusText = t[`status_${quarter.status}`] || quarter.status.toUpperCase();
  
  // Build month rows
  let monthRows = '';
  for (const month of quarter.months) {
    const aboveAvgIndicator = month.isAboveAverage ? ' <span class="above-avg">▲</span>' : ' <span class="below-avg">▼</span>';
    
    monthRows += `
      <tr>
        <td>${month.monthName}</td>
        <td class="amount">${formatNumber(month.meterStart)}</td>
        <td class="amount">${formatNumber(month.meterEnd)}</td>
        <td class="amount">${month.consumption !== null ? `${month.consumption} m³${aboveAvgIndicator}` : '-'}</td>
        <td class="amount">${month.dailyAverage.toFixed(2)}</td>
        <td class="amount">${formatCurrency(month.totalCharge * 100)}</td>
      </tr>`;
  }
  
  // Build total row
  const totalRow = `
    <tr class="total-row">
      <td colspan="3"><strong>${t.quarterTotal}</strong></td>
      <td class="amount"><strong>${quarter.totals.consumption} m³</strong></td>
      <td class="amount"><strong>${quarter.totals.dailyAverage.toFixed(2)}</strong></td>
      <td class="amount"><strong>${formatCurrency(quarter.totals.totalCharge * 100)}</strong></td>
    </tr>`;
  
  // Build payments
  let paymentsHtml = '';
  if (quarter.payments && quarter.payments.length > 0) {
    paymentsHtml = `
      <div class="payments-section">
        <div class="payments-title">${t.payments}</div>`;
    
    for (const payment of quarter.payments) {
      paymentsHtml += `
        <div class="payment-row">
          <span>${payment.dateFormatted}</span>
          <span>${formatCurrency(payment.amount * 100)}</span>
        </div>`;
    }
    
    paymentsHtml += `</div>`;
  }
  
  return `
    <div class="quarter-section">
      <div class="quarter-header">
        <span class="quarter-title">${quarter.quarterLabel} (${quarter.periodLabel})</span>
        <span class="${statusClass}">${statusText}</span>
      </div>
      <table class="consumption-table">
        <thead>
          <tr>
            <th>${t.month}</th>
            <th class="amount">${t.meterStart}</th>
            <th class="amount">${t.meterEnd}</th>
            <th class="amount">${t.usage}</th>
            <th class="amount">${t.dailyAvg}</th>
            <th class="amount">${t.charge}</th>
          </tr>
        </thead>
        <tbody>
          ${monthRows}
          ${totalRow}
        </tbody>
      </table>
      ${paymentsHtml}
    </div>`;
}

/**
 * Build leak check information section (single language)
 */
function buildLeakCheckInfo(t) {
  return `
    <div class="leak-check-section">
      <div class="section-title">💧 ${t.understandingUsage}</div>
      
      <h4>${t.detectingLeaks}</h4>
      
      <p>${t.watchForSigns}:</p>
      
      <ul class="warning-signs">
        <li>${t.warningSign1}</li>
        <li>${t.warningSign2}</li>
        <li>${t.warningSign3}</li>
      </ul>
      
      <div class="leak-sources">
        <h4>${t.commonLeaks}</h4>
        <table class="leak-table">
          <tr>
            <td>${t.runningToilet}</td>
            <td>~0.75 m³/day (~$37.50/day)</td>
          </tr>
          <tr>
            <td>${t.drippingFaucet}</td>
            <td>~0.05 m³/day (~$2.50/day)</td>
          </tr>
          <tr>
            <td>${t.crackedPipe}</td>
            <td>2-5+ m³/day ($100-250+/day)</td>
          </tr>
        </table>
      </div>
      
      <p class="leak-action">
        <strong>${t.suspectLeak}</strong>
      </p>
    </div>`;
}

/**
 * Build footer section (data-driven from client record)
 */
function buildFooter(data, t, generatedAt) {
  const { reportId, client } = data;
  
  // Use actual client data (no hardcoded fallbacks)
  const contactEmail = client.contactEmail || 'N/A';
  const contactPhone = client.contactPhone || 'N/A';
  
  return `
    <div class="report-footer">
      <div class="footer-content">
        <div class="footer-row">
          <strong>${t.reportId}:</strong> ${reportId}
        </div>
        <div class="footer-row">
          <strong>${t.generated}:</strong> ${generatedAt} (America/Cancun)
        </div>
        <div class="footer-row">
          <strong>${t.waterRate}:</strong> ${formatCurrency(client.ratePerM3 * 100)} MXN ${t.perCubicMeter}
        </div>
        <div class="footer-row">
          <strong>${t.billingCycle}:</strong> ${t.quarterly}
        </div>
        <div class="footer-row">
          <strong>${t.questions}:</strong> ${contactEmail} | ${contactPhone}
        </div>
      </div>
    </div>`;
}

/**
 * Format currency (wrapper for shared utility)
 * @param {number} centavos - Amount in centavos
 * @returns {string} Formatted currency string
 */
function formatCurrency(centavos) {
  return formatCurrencyUtil(centavos, 'MXN', true);
}

/**
 * Format number with thousands separator
 */
function formatNumber(value) {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('en-US');
}

/**
 * Get translation strings for language (single language mode)
 */
function getTranslations(language) {
  const translations = {
    english: {
      title: 'WATER CONSUMPTION REPORT',
      unit: 'Unit',
      owner: 'Owner',
      property: 'Property',
      fiscalYear: 'Fiscal Year',
      fiscalYearRange: 'July 2025 - June 2026',
      generated: 'Generated',
      
      // Summary box
      atAGlance: 'AT A GLANCE',
      ytdUsage: 'YTD Usage',
      currentRate: 'Current Rate',
      ytdCharges: 'YTD Charges',
      monthlyAvg: 'Monthly Avg',
      dailyAvg: 'Daily Avg',
      basedOn: 'Based on',
      monthsOfData: 'months of data',
      currentBillingRate: 'Current billing rate is',
      
      // Chart
      monthlyConsumption: 'MONTHLY CONSUMPTION',
      
      // Comparison
      howYouCompare: 'HOW YOU COMPARE',
      comparisonIntro: 'Your unit\'s consumption compared to all',
      units: 'units',
      lowUsage: 'Low Usage',
      highUsage: 'High Usage',
      yourUnitIs: 'Your unit is in the',
      percentileSuffix: 'th percentile',
      usesMore: 'Uses more water than',
      ofUnits: 'of units',
      lessThan: 'less than',
      note: 'Note',
      usageVariesNote: 'Usage varies based on occupancy patterns. Full-time residents typically use more than seasonal or weekend-only residents. This comparison is for reference only.',
      
      // Quarterly details
      quarterlyBreakdown: 'QUARTERLY BREAKDOWN',
      month: 'Month',
      meterStart: 'Meter Start',
      meterEnd: 'Meter End',
      usage: 'Usage',
      charge: 'Charge',
      quarterTotal: 'Quarter Total',
      payments: 'Payments',
      status_paid: 'PAID ✓',
      status_partial: 'PARTIAL',
      status_unpaid: 'UNPAID',
      
      // Leak check
      understandingUsage: 'UNDERSTANDING YOUR WATER USAGE',
      detectingLeaks: 'Detecting Leaks',
      watchForSigns: 'Watch for these warning signs',
      warningSign1: 'Daily average suddenly doubles or triples',
      warningSign2: 'Usage doesn\'t decrease when unit is vacant',
      warningSign3: 'Unexpected spike in a single month',
      commonLeaks: 'Common Leak Sources',
      runningToilet: 'Running toilet',
      drippingFaucet: 'Dripping faucet',
      crackedPipe: 'Cracked pipe',
      suspectLeak: 'If you suspect a leak, contact building maintenance immediately.',
      
      // Footer
      reportId: 'Report ID',
      waterRate: 'Water Rate',
      perCubicMeter: 'per cubic meter (m³)',
      billingCycle: 'Billing Cycle',
      quarterly: 'Quarterly (3 months)',
      questions: 'Questions?',
      
      // General
      noDataAvailable: 'No data available'
    },
    spanish: {
      title: 'REPORTE DE CONSUMO DE AGUA',
      unit: 'Unidad',
      owner: 'Propietario',
      property: 'Propiedad',
      fiscalYear: 'Año Fiscal',
      fiscalYearRange: 'Julio 2025 - Junio 2026',
      generated: 'Generado',
      
      // Summary box
      atAGlance: 'DE UN VISTAZO',
      ytdUsage: 'Consumo del Año',
      currentRate: 'Tarifa Actual',
      ytdCharges: 'Cargos del Año',
      monthlyAvg: 'Promedio Mensual',
      dailyAvg: 'Promedio Diario',
      basedOn: 'Basado en',
      monthsOfData: 'meses de datos',
      currentBillingRate: 'La tarifa de facturación actual es',
      
      // Chart
      monthlyConsumption: 'CONSUMO MENSUAL',
      
      // Comparison
      howYouCompare: 'CÓMO SE COMPARA',
      comparisonIntro: 'Consumo de su unidad comparado con las',
      units: 'unidades',
      lowUsage: 'Bajo Consumo',
      highUsage: 'Alto Consumo',
      yourUnitIs: 'Su unidad está en el',
      percentileSuffix: 'º percentil',
      usesMore: 'Usa más agua que',
      ofUnits: 'de las unidades',
      lessThan: 'menos que',
      note: 'Nota',
      usageVariesNote: 'El consumo varía según los patrones de ocupación. Los residentes de tiempo completo típicamente usan más que los residentes de temporada o fin de semana.',
      
      // Quarterly details
      quarterlyBreakdown: 'DESGLOSE TRIMESTRAL',
      month: 'Mes',
      meterStart: 'Lectura Inicial',
      meterEnd: 'Lectura Final',
      usage: 'Consumo',
      charge: 'Cargo',
      quarterTotal: 'Total del Trimestre',
      payments: 'Pagos',
      status_paid: 'PAGADO ✓',
      status_partial: 'PARCIAL',
      status_unpaid: 'NO PAGADO',
      
      // Leak check
      understandingUsage: 'ENTENDIENDO SU CONSUMO DE AGUA',
      detectingLeaks: 'Detectando Fugas',
      watchForSigns: 'Esté atento a estas señales de advertencia',
      warningSign1: 'El promedio diario se duplica o triplica repentinamente',
      warningSign2: 'El consumo no disminuye cuando la unidad está vacía',
      warningSign3: 'Aumento inesperado en un solo mes',
      commonLeaks: 'Fuentes Comunes de Fugas',
      runningToilet: 'Inodoro con fuga',
      drippingFaucet: 'Grifo goteando',
      crackedPipe: 'Tubería agrietada',
      suspectLeak: 'Si sospecha una fuga, contacte a mantenimiento inmediatamente.',
      
      // Footer
      reportId: 'ID del Reporte',
      waterRate: 'Tarifa de Agua',
      perCubicMeter: 'por metro cúbico (m³)',
      billingCycle: 'Ciclo de Facturación',
      quarterly: 'Trimestral (3 meses)',
      questions: '¿Preguntas?',
      
      // General
      noDataAvailable: 'No hay datos disponibles'
    }
  };
  
  return translations[language] || translations.english;
}

/**
 * Get report CSS
 */
function getReportCss() {
  return `
/* Base styles */
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #333;
  margin: 0;
  padding: 20px;
}

.report-container {
  max-width: 800px;
  margin: 0 auto;
}

/* Single language mode (no bilingual pattern needed) */

/* Header */
.report-header {
  border-bottom: 2px solid #1a365d;
  padding-bottom: 15px;
  margin-bottom: 20px;
}

.header-title {
  text-align: center;
  margin-bottom: 15px;
}

.title-main {
  font-size: 24px;
  font-weight: bold;
  color: #1a365d;
}

.title-spanish {
  font-size: 18px;
  color: #666;
  font-style: italic;
}

.header-info {
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
}

.info-row {
  display: flex;
  justify-content: space-between;
}

.info-label {
  font-weight: 600;
  color: #666;
}

.info-value {
  color: #333;
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  color: #1a365d;
  margin-bottom: 15px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 5px;
}

/* Summary box (At-a-Glance) */
.summary-box {
  background: #f7fafc;
  border: 2px solid #1a365d;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 25px;
}

.summary-title {
  font-size: 16px;
  font-weight: bold;
  color: #1a365d;
  text-align: center;
  margin-bottom: 15px;
}

.metrics-grid-balanced {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  max-width: 600px;
  margin: 0 auto;
}

.metric {
  text-align: center;
  padding: 10px;
  background: white;
  border-radius: 5px;
  border: 1px solid #e2e8f0;
}

.metric.highlight {
  border-color: #4299e1;
  background: #ebf8ff;
}

.metric.alert {
  border-color: #e53e3e;
  background: #fff5f5;
}

.metric-label {
  font-size: 11px;
  color: #666;
  margin-bottom: 5px;
}

.metric-value {
  font-size: 18px;
  font-weight: bold;
  color: #1a365d;
}

.data-note {
  text-align: center;
  font-size: 10px;
  color: #999;
  margin-top: 10px;
}

/* Chart section */
.chart-section {
  margin-bottom: 25px;
}

.consumption-chart {
  width: 100%;
  max-width: 600px;
  height: 200px;
  margin: 0 auto;
  display: block;
}

.consumption-chart .bar-value {
  font-size: 10px;
  fill: #333;
}

.consumption-chart .bar-label {
  font-size: 10px;
  fill: #666;
}

.consumption-chart .avg-label {
  font-size: 9px;
  fill: #666;
}

/* Percentile comparison */
.comparison-section {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 25px;
}

.comparison-intro {
  margin: 10px 0;
}

.percentile-bar {
  margin: 15px 0;
}

.percentile-track {
  height: 20px;
  background: linear-gradient(to right, #38a169, #d69e2e, #e53e3e);
  border-radius: 10px;
  position: relative;
}

.percentile-marker {
  position: absolute;
  top: -5px;
  width: 4px;
  height: 30px;
  background: #1a365d;
  border-radius: 2px;
  transform: translateX(-50%);
}

.percentile-marker::after {
  content: '▼';
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #1a365d;
}

.percentile-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #666;
  margin-top: 5px;
}

.percentile-text {
  text-align: center;
  margin-top: 10px;
}

.comparison-note {
  font-size: 10px;
  color: #666;
  background: #fff;
  padding: 10px;
  border-radius: 5px;
  margin-top: 15px;
}

/* Quarter section */
.quarter-section {
  margin-bottom: 25px;
  page-break-inside: avoid;
}

.quarter-header {
  background: #f7fafc;
  padding: 10px 15px;
  border: 1px solid #e2e8f0;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.quarter-title {
  font-size: 14px;
  font-weight: bold;
  color: #1a365d;
}

/* Status badges */
.status-paid { color: #38a169; font-weight: bold; }
.status-partial { color: #d69e2e; font-weight: bold; }
.status-unpaid { color: #e53e3e; font-weight: bold; }

/* Tables */
.consumption-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #e2e8f0;
}

.consumption-table th {
  background: #edf2f7;
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  font-size: 11px;
  border-bottom: 2px solid #cbd5e0;
}

.consumption-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
}

.consumption-table tr.total-row {
  background: #edf2f7;
  font-weight: bold;
}

.consumption-table td.amount,
.consumption-table th.amount {
  text-align: right;
}

/* Above/below average indicators */
.above-avg { color: #dd6b20; }
.below-avg { color: #319795; }

/* Payments section */
.payments-section {
  background: #f7fafc;
  padding: 10px 15px;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.payments-title {
  font-weight: bold;
  margin-bottom: 5px;
}

.payment-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
}

/* Leak check section */
.leak-check-section {
  background: #ebf8ff;
  border: 1px solid #4299e1;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 25px;
}

.leak-check-section h4 {
  color: #2b6cb0;
  margin: 10px 0;
}

.warning-signs {
  margin: 10px 0;
  padding-left: 20px;
}

.warning-signs li {
  margin-bottom: 8px;
}

.leak-sources {
  background: white;
  border-radius: 5px;
  padding: 10px;
  margin-top: 15px;
}

.leak-table {
  width: 100%;
  border-collapse: collapse;
}

.leak-table td {
  padding: 5px 10px;
  border-bottom: 1px solid #e2e8f0;
}

.leak-table td:last-child {
  text-align: right;
  color: #e53e3e;
}

.leak-action {
  margin-top: 15px;
  padding: 10px;
  background: #fff5f5;
  border-radius: 5px;
  text-align: center;
}

/* Footer */
.report-footer {
  border-top: 2px solid #1a365d;
  margin-top: 30px;
  padding-top: 15px;
  font-size: 10px;
  color: #666;
}

.footer-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
}

.footer-row {
  padding: 2px 0;
}

/* No data message */
.no-data {
  text-align: center;
  padding: 20px;
  color: #999;
  font-style: italic;
}

/* Print/PDF optimizations */
@media print {
  body { margin: 0; padding: 0; }
  .quarter-section { page-break-inside: avoid; }
  .summary-box { page-break-inside: avoid; }
  .leak-check-section { page-break-inside: avoid; }
}
`;
}
