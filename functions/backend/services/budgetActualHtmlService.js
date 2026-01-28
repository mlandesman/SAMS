/**
 * Budget vs Actual HTML Service
 * Generates professional HTML report matching Statement of Account design
 */

import { DateTime } from 'luxon';
import { getNow } from '../../shared/services/DateService.js';

/**
 * Format currency (pesos) from centavos
 * @param {number} centavos - Amount in centavos
 * @param {boolean} showSign - Whether to show + for positive
 * @returns {string} Formatted currency
 */
function formatCurrency(centavos, showSign = false) {
  if (centavos === null || centavos === undefined || isNaN(centavos)) {
    return '$0.00';
  }
  
  const pesos = centavos / 100;
  const absAmount = Math.abs(pesos);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  if (pesos < 0) {
    return `-$${formatted}`;
  } else if (showSign && pesos > 0) {
    return `+$${formatted}`;
  }
  return `$${formatted}`;
}

/**
 * Format date as dd-MMM-yy (e.g., "15-Jan-26") using America/Cancun timezone
 * Uses unambiguous format to avoid DD/MM vs MM/DD confusion for international clients
 */
function formatDate(dateValue) {
  if (!dateValue) return '';
  
  let dt;
  
  if (typeof dateValue === 'string') {
    dt = DateTime.fromISO(dateValue, { zone: 'America/Cancun' });
    if (!dt.isValid) {
      dt = DateTime.fromSQL(dateValue, { zone: 'America/Cancun' });
    }
  } else if (dateValue instanceof Date) {
    dt = DateTime.fromJSDate(dateValue).setZone('America/Cancun');
  } else {
    return '';
  }
  
  if (!dt.isValid) return '';
  return dt.toFormat('dd-MMM-yy');
}

/**
 * Format percentage
 */
function formatPercent(percent) {
  if (!percent || isNaN(percent)) return '0.00%';
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

/**
 * Translate category name for Spanish
 */
function translateCategoryName(categoryName, language) {
  if (language !== 'spanish' || !categoryName) {
    return categoryName;
  }
  
  let translated = categoryName;
  
  // Common patterns to translate (order matters - do longer phrases first)
  const translations = {
    // Income categories
    'Account Credit': 'Crédito de Cuenta',
    'HOA Dues': 'Cuotas de Mantenimiento',
    'Special Assessments': 'Cuotas Especiales',
    
    // Maintenance categories (longer phrases first)
    'Maintenance: Elevator': 'Mantenimiento: Ascensor',
    'Maintenance: General': 'Mantenimiento: General',
    'Maintenance: Landscaping': 'Mantenimiento: Jardinería',
    'Maintenance: Paint & Repairs': 'Mantenimiento: Pintura y Reparaciones',
    'Maintenance: Plumbing & Electrical': 'Mantenimiento: Plomería y Eléctrico',
    'Maintenance: Pool': 'Mantenimiento: Piscina',
    'Maintenance: Security': 'Mantenimiento: Seguridad',
    'Maintenance: Supplies': 'Mantenimiento: Suministros',
    'Maintenance': 'Mantenimiento',
    
    // Staff categories
    'Staff: Administrators': 'Personal: Administradores',
    'Staff: Maintenance Staff': 'Personal: Mantenimiento',
    'Staff': 'Personal',
    
    // Utilities categories
    'Utilities: CFE': 'Servicios: CFE',
    'Utilities: Water': 'Servicios: Agua',
    'Utilities': 'Servicios',
    
    // Services categories
    'Services: Fumigation': 'Servicios: Fumigación',
    'Services': 'Servicios',
    
    // Project categories
    'Projects: Column Repairs': 'Proyectos: Reparación de Columnas',
    'Projects: Elevator Refurb 20': 'Proyectos: Refacción de Ascensor 20',
    'Projects: Meters & Wiring': 'Proyectos: Medidores y Cableado',
    'Projects: Parking Lot Expansion': 'Proyectos: Expansión de Estacionamiento',
    'Projects: Propane Lines': 'Proyectos: Líneas de Propano',
    'Projects: Roof Sealing': 'Proyectos: Sellado de Techo',
    'Projects': 'Proyectos',
    
    // Other categories
    'Bank Adjustments': 'Ajustes Bancarios',
    'Colonos Fee': 'Cuota de Colonos',
    'Other': 'Otros',
    'Transfers': 'Transferencias',
    'Credit': 'Crédito',
    'Adjustment': 'Ajuste',
    'Fee': 'Cuota',
    'Repairs': 'Reparaciones',
    'Expansion': 'Expansión',
    'Sealing': 'Sellado',
    'Wiring': 'Cableado',
    'Meters': 'Medidores',
    'Refurb': 'Refacción',
    'Elevator': 'Ascensor',
    'Pool': 'Piscina',
    'Security': 'Seguridad',
    'Supplies': 'Suministros',
    'Plumbing': 'Plomería',
    'Electrical': 'Eléctrico',
    'Paint': 'Pintura',
    'Landscaping': 'Jardinería',
    'General': 'General',
    'Administrators': 'Administradores',
    'Fumigation': 'Fumigación',
    'Water': 'Agua',
    'CFE': 'CFE'
  };
  
  // Replace each pattern (order matters - do longer phrases first)
  for (const [english, spanish] of Object.entries(translations)) {
    const regex = new RegExp(english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    translated = translated.replace(regex, spanish);
  }
  
  return translated;
}

/**
 * Get translation strings for language
 */
function getTranslations(language) {
  const translations = {
    english: {
      title: 'BUDGET VS ACTUAL REPORT',
      reportFor: 'REPORT FOR',
      fiscalYear: 'Fiscal Year',
      reportDate: 'Report Date',
      percentElapsed: '% of Year Elapsed',
      incomeTable: 'INCOME',
      specialAssessmentsTable: 'SPECIAL ASSESSMENTS',
      unitCreditAccountsTable: 'UNIT CREDIT ACCOUNTS',
      expenseTable: 'EXPENSES',
      collections: 'COLLECTIONS (from Unit Owners)',
      expenditures: 'EXPENDITURES (Project Costs)',
      totalExpenditures: 'TOTAL EXPENDITURES',
      netFundBalance: 'NET FUND BALANCE',
      creditAdded: 'CREDIT ADDED',
      creditUsed: 'CREDIT USED',
      creditBalance: 'CREDIT BALANCE',
      tableHeaders: {
        category: 'CATEGORY NAME',
        annualBudget: 'ANNUAL BUDGET',
        ytdBudget: 'YTD BUDGET',
        ytdActual: 'YTD ACTUAL',
        variance: 'VARIANCE ($)',
        variancePercent: 'VARIANCE (%)',
        amount: 'AMOUNT'
      },
      totals: 'TOTALS',
      reportId: 'Report ID',
      generatedOn: 'Generated',
      noData: 'No data available'
    },
    spanish: {
      title: 'REPORTE PRESUPUESTO VS REAL',
      reportFor: 'REPORTE PARA',
      fiscalYear: 'Año Fiscal',
      reportDate: 'Fecha del Reporte',
      percentElapsed: '% del Año Transcurrido',
      incomeTable: 'INGRESOS',
      specialAssessmentsTable: 'CUOTAS ESPECIALES',
      unitCreditAccountsTable: 'CUENTAS DE CRÉDITO DE UNIDADES',
      expenseTable: 'GASTOS',
      collections: 'RECAUDACIONES (de Propietarios)',
      expenditures: 'GASTOS (Costos de Proyectos)',
      totalExpenditures: 'TOTAL DE GASTOS',
      netFundBalance: 'SALDO NETO DEL FONDO',
      creditAdded: 'CRÉDITO AGREGADO',
      creditUsed: 'CRÉDITO USADO',
      creditBalance: 'SALDO DE CRÉDITO',
      tableHeaders: {
        category: 'NOMBRE DE CATEGORÍA',
        annualBudget: 'PRESUPUESTO ANUAL',
        ytdBudget: 'PRESUPUESTO YTD',
        ytdActual: 'REAL YTD',
        variance: 'VARIANZA ($)',
        variancePercent: 'VARIANZA (%)',
        amount: 'MONTO'
      },
      totals: 'TOTALES',
      reportId: 'ID del Reporte',
      generatedOn: 'Generado',
      noData: 'No hay datos disponibles'
    }
  };
  
  return translations[language] || translations.english;
}

/**
 * Generate Budget vs Actual HTML report
 * @param {Object} data - Data from getBudgetActualData service
 * @param {Object} options - { language: 'english'|'spanish' }
 * @returns {Object} { html: string, meta: { reportId, generatedAt, language }, data: object }
 */
export function generateBudgetActualHtml(data, options = {}) {
  if (!data) {
    throw new Error('Data is required to generate HTML report');
  }

  const language = options.language || 'english';
  const t = getTranslations(language);
  
  const { clientInfo, reportInfo, income, specialAssessments, unitCreditAccounts, expenses } = data;
  
  // Get current timestamp in Cancun timezone
  const generatedNow = getNow();
  const generatedTimestamp = DateTime.fromJSDate(generatedNow).setZone('America/Cancun');
  
  // Format report date
  const reportDate = DateTime.fromISO(reportInfo.reportDate, { zone: 'America/Cancun' });
  
  // Get logo URL if available
  const logoUrl = clientInfo.logoUrl || null;
  
  // Build HTML
  const html = `<!DOCTYPE html>
<html lang="${language === 'spanish' ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title} - ${clientInfo.name}</title>
  <style>
    /* Reset and base styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
      padding: 0.5in 0.6in 0.4in 0.6in;
    }
    
    /* Page layout */
    .report-page {
      max-width: 8.5in;
      margin: 0 auto;
      padding-bottom: 0;
    }
    
    /* Header section */
    .report-header {
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 340px);
      column-gap: 20px;
      align-items: start;
    }
    
    .header-left {
      text-align: left;
    }
    
    .report-title {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 12px;
      text-transform: uppercase;
      grid-column: 1 / span 2;
    }
    
    .client-info {
      font-size: 10pt;
      line-height: 1.5;
      margin-top: -2px;
    }
    
    .client-info-table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 10px;
    }
    
    .client-info-table td {
      padding: 2px 0;
      vertical-align: top;
    }
    
    .client-info-table td:first-child {
      font-weight: bold;
      width: 135px;
      padding-right: 4px;
    }
    
    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding-right: 0;
      justify-self: start;
      box-sizing: border-box;
      max-width: 340px;
      width: 100%;
      margin-top: 5px;
    }
    
    .logo-top {
      margin: -4px 0 6px auto;
      padding: 0;
      align-self: flex-end;
    }
    
    .logo-top img {
      max-width: 200px;
      max-height: 125px;
      height: auto;
      display: block;
      padding-top: 2px;
    }
    
    /* Section headers */
    .section-header {
      background-color: #4472C4;
      color: #fff;
      padding: 5px 10px;
      font-size: 10pt;
      font-weight: bold;
      text-align: center;
      margin: 15px 0 5px 0;
    }
    
    .section-header-special {
      background-color: #FF8C00; /* Dark orange */
      color: #fff;
      padding: 5px 10px;
      font-size: 10pt;
      font-weight: bold;
      text-align: center;
      margin: 75px 0 5px 0;
    }
    
    /* Budget tables */
    .budget-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2px;
      font-size: 9pt;
    }
    
    .budget-table thead {
      background-color: #4472C4;
      color: #fff;
    }
    
    .budget-table th {
      padding: 5px 4px;
      text-align: center;
      font-size: 8pt;
      font-weight: bold;
      border: 1px solid #fff;
    }
    
    .budget-table td {
      padding: 4px;
      border: 1px solid #ddd;
      font-size: 9pt;
    }
    
    .budget-table tbody tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    /* Column alignments */
    .col-category { text-align: left; width: 30%; }
    .col-annual-budget { text-align: right; width: 14%; }
    .col-ytd-budget { text-align: right; width: 14%; }
    .col-ytd-actual { text-align: right; width: 14%; }
    .col-variance { text-align: right; width: 14%; }
    .col-variance-percent { text-align: right; width: 14%; }
    
    /* Variance color coding */
    .variance-favorable {
      color: #00B050; /* Green */
      font-weight: bold;
    }
    
    .variance-unfavorable {
      color: #C00000; /* Red */
      font-weight: bold;
    }
    
    /* Totals row */
    .totals-row {
      background-color: #e8f0fe;
      font-weight: bold;
    }
    
    /* Special Assessments table format */
    .special-assessments-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2px;
      font-size: 9pt;
      margin-top: 10px;
    }
    
    .special-assessments-table td {
      padding: 4px;
      border: 1px solid #ddd;
      font-size: 9pt;
    }
    
    .special-assessments-table tbody tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    .col-special-type { text-align: left; width: 40%; }
    .col-special-amount { text-align: right; width: 30%; }
    
    .special-assessments-table .section-row {
      background-color: #fff3cd; /* Light yellow background */
      font-weight: bold;
      font-size: 9pt;
    }
    
    .special-assessments-table .section-row td {
      padding: 6px 4px;
      border-bottom: 1px solid #999;
    }
    
    .special-assessments-table .total-row {
      border-top: 2px solid #000;
      border-bottom: 1px solid #ddd;
      font-weight: bold;
    }
    
    .special-assessments-table .balance-row {
      background-color: #e8f0fe;
      border-top: 2px solid #000;
      font-weight: bold;
      font-size: 10pt;
    }
    
    .balance-favorable {
      color: #00B050;
    }
    
    .balance-unfavorable {
      color: #C00000;
    }
    
    /* Footer */
    .report-footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 2px solid #000;
      font-size: 8pt;
      color: #333;
      clear: both;
    }
    
    .report-footer .footer-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      gap: 15px;
      line-height: 1.2;
    }
    
    /* Print styles */
    @media print {
      body {
        padding: 0;
        margin: 0;
      }
      
      .report-page {
        max-width: none;
        padding: 0;
        margin: 0;
      }
      
      .budget-table {
        page-break-inside: auto;
      }
      
      .budget-table thead {
        display: table-header-group;
      }
    }
    
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  <div class="report-page">
    <!-- Header -->
    <div class="report-header">
      <div class="header-left">
        <div class="report-title">${t.title}</div>
        
        <div class="client-info">
          <table class="client-info-table">
            <tr>
              <td>${t.reportFor}:</td>
              <td>${clientInfo.name}</td>
            </tr>
            <tr>
              <td>${t.fiscalYear}:</td>
              <td>${reportInfo.fiscalYear}</td>
            </tr>
            <tr>
              <td>${t.reportDate}:</td>
              <td>${reportDate.toFormat('dd-MMM-yy')}</td>
            </tr>
            <tr>
              <td>${t.percentElapsed}:</td>
              <td>${reportInfo.percentOfYearElapsed.toFixed(1)}%</td>
            </tr>
          </table>
        </div>
      </div>
      
      <div class="header-right">
        ${logoUrl 
          ? `<div class="logo-top logo-right"><img src="${logoUrl}" alt="${clientInfo.name}"></div>`
          : `<div class="logo-top logo-right" style="font-size: 12pt; font-weight: bold;">${clientInfo.name}</div>`
        }
      </div>
    </div>
    
    <!-- Section divider -->
    <div style="border-top: 2px solid #000; margin: 20px 0 15px 0;"></div>
    
    <!-- Income Table -->
    <div class="section-header">${t.incomeTable}</div>
    <table class="budget-table">
      <thead>
        <tr>
          <th class="col-category">${t.tableHeaders.category}</th>
          <th class="col-annual-budget">${t.tableHeaders.annualBudget}</th>
          <th class="col-ytd-budget">${t.tableHeaders.ytdBudget}</th>
          <th class="col-ytd-actual">${t.tableHeaders.ytdActual}</th>
          <th class="col-variance">${t.tableHeaders.variance}</th>
          <th class="col-variance-percent">${t.tableHeaders.variancePercent}</th>
        </tr>
      </thead>
      <tbody>
        ${income.categories.length > 0 ? income.categories.map(cat => {
          const varianceClass = cat.variance >= 0 ? 'variance-favorable' : 'variance-unfavorable';
          return `
        <tr>
          <td class="col-category">${translateCategoryName(cat.name, language)}</td>
          <td class="col-annual-budget">${formatCurrency(cat.annualBudget)}</td>
          <td class="col-ytd-budget">${formatCurrency(cat.ytdBudget)}</td>
          <td class="col-ytd-actual">${formatCurrency(cat.ytdActual)}</td>
          <td class="col-variance ${varianceClass}">${formatCurrency(cat.variance, true)}</td>
          <td class="col-variance-percent ${varianceClass}">${formatPercent(cat.variancePercent)}</td>
        </tr>`;
        }).join('') : `
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px;">${t.noData}</td>
        </tr>`}
      </tbody>
      <tfoot>
        <tr class="totals-row">
          <td class="col-category">${t.totals}</td>
          <td class="col-annual-budget">${formatCurrency(income.totals.totalAnnualBudget)}</td>
          <td class="col-ytd-budget">${formatCurrency(income.totals.totalYtdBudget)}</td>
          <td class="col-ytd-actual">${formatCurrency(income.totals.totalYtdActual)}</td>
          <td class="col-variance ${income.totals.totalVariance >= 0 ? 'variance-favorable' : 'variance-unfavorable'}">${formatCurrency(income.totals.totalVariance, true)}</td>
          <td class="col-variance-percent ${income.totals.totalVariance >= 0 ? 'variance-favorable' : 'variance-unfavorable'}">${formatPercent(income.totals.totalVariancePercent)}</td>
        </tr>
      </tfoot>
    </table>
    
    <!-- Expense Table -->
    <div class="section-header">${t.expenseTable}</div>
    <table class="budget-table">
      <thead>
        <tr>
          <th class="col-category">${t.tableHeaders.category}</th>
          <th class="col-annual-budget">${t.tableHeaders.annualBudget}</th>
          <th class="col-ytd-budget">${t.tableHeaders.ytdBudget}</th>
          <th class="col-ytd-actual">${t.tableHeaders.ytdActual}</th>
          <th class="col-variance">${t.tableHeaders.variance}</th>
          <th class="col-variance-percent">${t.tableHeaders.variancePercent}</th>
        </tr>
      </thead>
      <tbody>
        ${expenses.categories.length > 0 ? expenses.categories.map(cat => {
          const varianceClass = cat.variance >= 0 ? 'variance-favorable' : 'variance-unfavorable';
          return `
        <tr>
          <td class="col-category">${translateCategoryName(cat.name, language)}</td>
          <td class="col-annual-budget">${formatCurrency(cat.annualBudget)}</td>
          <td class="col-ytd-budget">${formatCurrency(cat.ytdBudget)}</td>
          <td class="col-ytd-actual">${formatCurrency(cat.ytdActual)}</td>
          <td class="col-variance ${varianceClass}">${formatCurrency(cat.variance, true)}</td>
          <td class="col-variance-percent ${varianceClass}">${formatPercent(cat.variancePercent)}</td>
        </tr>`;
        }).join('') : `
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px;">${t.noData}</td>
        </tr>`}
      </tbody>
      <tfoot>
        <tr class="totals-row">
          <td class="col-category">${t.totals}</td>
          <td class="col-annual-budget">${formatCurrency(expenses.totals.totalAnnualBudget)}</td>
          <td class="col-ytd-budget">${formatCurrency(expenses.totals.totalYtdBudget)}</td>
          <td class="col-ytd-actual">${formatCurrency(expenses.totals.totalYtdActual)}</td>
          <td class="col-variance ${expenses.totals.totalVariance >= 0 ? 'variance-favorable' : 'variance-unfavorable'}">${formatCurrency(expenses.totals.totalVariance, true)}</td>
          <td class="col-variance-percent ${expenses.totals.totalVariance >= 0 ? 'variance-favorable' : 'variance-unfavorable'}">${formatPercent(expenses.totals.totalVariancePercent)}</td>
        </tr>
      </tfoot>
    </table>
    
    <!-- Special Assessments Fund -->
    <div class="section-header-special">${t.specialAssessmentsTable}</div>
    <table class="special-assessments-table">
      <tbody>
        <!-- Collections Section -->
        <tr class="section-row">
          <td colspan="2">${t.collections}</td>
        </tr>
        ${specialAssessments.collections && specialAssessments.collections.amount > 0 ? `
        <tr>
          <td class="col-special-type">${translateCategoryName(specialAssessments.collections.categoryName, language)}</td>
          <td class="col-special-amount">${formatCurrency(specialAssessments.collections.amount)}</td>
        </tr>` : `
        <tr>
          <td class="col-special-type" colspan="2" style="text-align: center; padding: 10px;">${t.noData}</td>
        </tr>`}
        
        <!-- Expenditures Section -->
        <tr class="section-row">
          <td colspan="2">${t.expenditures}</td>
        </tr>
        ${specialAssessments.expenditures && specialAssessments.expenditures.length > 0 ? specialAssessments.expenditures.map(exp => `
        <tr>
          <td class="col-special-type">${translateCategoryName(exp.name, language)}</td>
          <td class="col-special-amount">${formatCurrency(exp.amount)}</td>
        </tr>`).join('') : `
        <tr>
          <td class="col-special-type" colspan="2" style="text-align: center; padding: 10px;">${t.noData}</td>
        </tr>`}
        ${specialAssessments.expenditures && specialAssessments.expenditures.length > 0 ? `
        <tr class="total-row">
          <td class="col-special-type">${t.totalExpenditures}</td>
          <td class="col-special-amount">${formatCurrency(specialAssessments.totalExpenditures)}</td>
        </tr>` : ''}
        
        <!-- Net Fund Balance -->
        <tr class="balance-row">
          <td class="col-special-type ${specialAssessments.netBalance >= 0 ? 'balance-favorable' : 'balance-unfavorable'}">${t.netFundBalance}</td>
          <td class="col-special-amount ${specialAssessments.netBalance >= 0 ? 'balance-favorable' : 'balance-unfavorable'}">${formatCurrency(specialAssessments.netBalance, true)}</td>
        </tr>
      </tbody>
    </table>
    
    <!-- Unit Credit Accounts -->
    <div class="section-header-special">${t.unitCreditAccountsTable}</div>
    <table class="special-assessments-table">
      <tbody>
        <!-- Credit Added Section -->
        <tr class="section-row">
          <td colspan="2">${t.creditAdded}</td>
        </tr>
        <tr>
          <td class="col-special-type">${translateCategoryName('Account Credit', language)}</td>
          <td class="col-special-amount">${formatCurrency(unitCreditAccounts?.added || 0)}</td>
        </tr>
        
        <!-- Credit Used Section -->
        <tr class="section-row">
          <td colspan="2">${t.creditUsed}</td>
        </tr>
        <tr>
          <td class="col-special-type">${translateCategoryName('Account Credit Used', language)}</td>
          <td class="col-special-amount">${formatCurrency(unitCreditAccounts?.used || 0)}</td>
        </tr>
        
        <!-- Credit Balance -->
        <tr class="balance-row">
          <td class="col-special-type ${(unitCreditAccounts?.balance || 0) >= 0 ? 'balance-favorable' : 'balance-unfavorable'}">${t.creditBalance}</td>
          <td class="col-special-amount ${(unitCreditAccounts?.balance || 0) >= 0 ? 'balance-favorable' : 'balance-unfavorable'}">${formatCurrency(unitCreditAccounts?.balance || 0, true)}</td>
        </tr>
      </tbody>
    </table>
    
    <!-- Footer -->
    <div class="report-footer">
      <div class="footer-row">
        <div>${t.reportId}: ${reportInfo.reportId}</div>
        <div>${t.generatedOn}: ${generatedTimestamp.toFormat('dd-MMM-yy, h:mm:ss a')}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    html,
    meta: {
      reportId: reportInfo.reportId,
      generatedAt: generatedTimestamp.toISO(),
      language
    },
    data
  };
}

