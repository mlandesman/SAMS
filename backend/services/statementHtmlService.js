/**
 * Statement HTML Service
 * Generates professional HTML statements matching prior administrator's design
 */

import { getStatementData } from './statementDataService.js';
import { DateTime } from 'luxon';
import { getNow } from '../../shared/services/DateService.js';

/**
 * Format currency (pesos)
 * @param {number} amount - Amount in pesos
 * @param {boolean} showSign - Whether to show + for positive
 * @returns {string} Formatted currency
 */
function formatCurrency(amount, showSign = false) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0.00';
  }
  
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  if (amount < 0) {
    return `-$${formatted}`;
  } else if (showSign && amount > 0) {
    return `+$${formatted}`;
  }
  return `$${formatted}`;
}

/**
 * Format date as MM/DD/YYYY using America/Cancun timezone
 * CRITICAL: Uses Luxon to avoid timezone conversion issues
 */
function formatDate(dateValue) {
  if (!dateValue) return '';
  
  let dt;
  
  // Handle different input types
  if (typeof dateValue === 'string') {
    // Parse ISO string in Cancun timezone
    dt = DateTime.fromISO(dateValue, { zone: 'America/Cancun' });
    if (!dt.isValid) {
      // Try SQL format (YYYY-MM-DD)
      dt = DateTime.fromSQL(dateValue, { zone: 'America/Cancun' });
    }
  } else if (dateValue instanceof Date) {
    // Convert JS Date to Cancun timezone
    dt = DateTime.fromJSDate(dateValue).setZone('America/Cancun');
  } else if (dateValue && typeof dateValue.toDate === 'function') {
    // Firestore Timestamp
    dt = DateTime.fromJSDate(dateValue.toDate()).setZone('America/Cancun');
  } else {
    return '';
  }
  
  if (!dt.isValid) return '';
  
  // Format as MM/DD/YYYY
  return dt.toFormat('MM/dd/yyyy');
}

/**
 * Translate description text for Spanish
 */
function translateDescription(description, language) {
  if (language !== 'spanish' || !description) {
    return description;
  }
  
  let translated = description;
  
  // Common patterns to translate (order matters - do longer phrases first)
  const translations = {
    // HOA/Dues terms (longer phrases first)
    'HOA Dues': 'Cuotas de Mantenimiento',
    'HOA Penalty': 'Penalización de Mantenimiento',
    'HOA': 'Mantenimiento',
    'Maintenance': 'Mantenimiento',
    'Dues': 'Cuotas',
    
    // Water terms (longer phrases first)
    'Water Bill': 'Factura de Agua',
    'Water Penalty': 'Penalización de Agua',
    'Water Consumption': 'Consumo de Agua',
    'Water': 'Agua',
    
    // Payment terms
    'Payment -': 'Pago -',
    'Payment': 'Pago',
    
    // Quarter terms
    'Q0': 'T0',
    'Q1': 'T1',
    'Q2': 'T2',
    'Q3': 'T3',
    'Q4': 'T4',
    
    // Other common terms
    'Penalty': 'Penalización',
    'Opening Balance': 'Balance Inicial',
    'Adjustment': 'Ajuste',
    'Credit': 'Crédito',
    'Charge': 'Cargo'
  };
  
  // Replace each pattern (order matters - do longer phrases first)
  for (const [english, spanish] of Object.entries(translations)) {
    const regex = new RegExp(english, 'gi');
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
      title: 'STATEMENT OF ACCOUNT',
      statementFor: 'STATEMENT FOR',
      unit: 'Unit',
      bankingInfo: 'PAYMENT INFORMATION',
      bank: 'Bank',
      account: 'Account',
      clabe: 'CLABE',
      beneficiary: 'Beneficiary',
      reference: 'Reference',
      address: 'Address',
      period: 'Period',
      date: 'Date',
      nextPaymentDue: 'Next Payment',
      accountActivity: 'ACCOUNT ACTIVITY',
      openingBalance: 'Opening Balance',
      tableHeaders: {
        date: 'DATE',
        description: 'DESCRIPTION',
        charge: 'CHARGE',
        payment: 'PAYMENT',
        balance: 'BALANCE DUE'
      },
      allocationSummary: 'ALLOCATION SUMMARY',
      category: 'Category',
      charges: 'Charges',
      penalties: 'Penalties',
      totalPaid: 'Total Paid',
      totals: 'TOTALS',
      balanceDue: 'BALANCE DUE',
      creditBalance: 'CREDIT BALANCE',
      paidInFull: 'PAID IN FULL',
      statementId: 'Statement ID',
      generatedOn: 'Generated',
      pageOf: 'Page',
      questionsContact: 'For questions, please contact {name} at {email} or WhatsApp {phone}',
      confidentialNotice: 'This statement is confidential and intended only for the addressee.',
      paymentTerms: {
        cash: 'We inform you that for security reasons we do not receive cash, so please make your payment in the condominium\'s bank account and send us your receipt.',
        waterDue: '***the water consumption must be paid within the first 10 days of the corresponding month, after the ten days there will be 5% interest per month.**',
        hoaDue: '***Maintenance fees must be paid within the first month of the corresponding quarter, after the month there will be 5% interest per month as approved by the Condominium Owners\' Meeting. **',
        application: 'Payments are applied first to the penalties and then to the oldest installments as indicated in articles 2281 and 2282 of the Civil Code of the State of Quintana Roo.'
      }
    },
    spanish: {
      title: 'ESTADO DE CUENTA',
      statementFor: 'ESTADO DE CUENTA PARA',
      unit: 'Depto',
      bankingInfo: 'INFORMACIÓN DE PAGO',
      bank: 'Banco',
      account: 'Cuenta',
      clabe: 'CLABE',
      beneficiary: 'Beneficiario',
      reference: 'Referencia',
      address: 'Dirección',
      period: 'Período',
      date: 'Fecha',
      nextPaymentDue: 'Próximo Pago',
      accountActivity: 'ACTIVIDAD DE LA CUENTA',
      openingBalance: 'Balance Inicial',
      tableHeaders: {
        date: 'FECHA',
        description: 'DESCRIPCION',
        charge: 'CARGO',
        payment: 'PAGO',
        balance: 'SALDO PENDIENTE'
      },
      allocationSummary: 'RESUMEN DE ASIGNACIÓN',
      category: 'Categoría',
      charges: 'Cargos',
      penalties: 'Penalizaciones',
      totalPaid: 'Total Pagado',
      totals: 'TOTALES',
      balanceDue: 'SALDO PENDIENTE',
      creditBalance: 'SALDO A FAVOR',
      paidInFull: 'PAGADO COMPLETO',
      statementId: 'ID del Estado de Cuenta',
      generatedOn: 'Generado',
      pageOf: 'Página',
      questionsContact: 'Para preguntas, favor de contactar {name} al {email} o WhatsApp {phone}',
      confidentialNotice: 'Este estado de cuenta es confidencial y destinado únicamente al destinatario.',
      paymentTerms: {
        cash: 'Les informamos que por razones de seguridad no recibimos efectivo, favor de realizar su pago en la cuenta bancaria del condominio y enviarnos su recibo.',
        waterDue: '***el consumo de agua debe pagarse dentro de los primeros 10 días del mes correspondiente, después de los diez días habrá un interés del 5% mensual.**',
        hoaDue: '***Las cuotas de mantenimiento deben pagarse dentro del primer mes del trimestre correspondiente, después del mes habrá un interés del 5% mensual según lo aprobado por la Asamblea de Propietarios. **',
        application: 'Los pagos se aplican primero a las penalizaciones y luego a las cuotas más antiguas según lo indicado en los artículos 2281 y 2282 del Código Civil del Estado de Quintana Roo.'
      }
    }
  };
  
  return translations[language] || translations.english;
}

/**
 * Generate Statement data for a unit, including HTML, metadata and line items.
 * This is the primary entrypoint for building Statement of Account outputs.
 *
 * @param {Object} api - Axios API instance
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {Object} options - { fiscalYear, language }
 * @returns {{
 *   html: string,
 *   meta: { statementId: string, generatedAt: string, language: string },
 *   summary: Object,
 *   lineItems: Array
 * }}
 */
export async function generateStatementData(api, clientId, unitId, options = {}) {
  // Get statement data
  const data = await getStatementData(api, clientId, unitId, options.fiscalYear);
  
  // Determine language
  const language = options.language || 'english';
  const t = getTranslations(language);
  
  // Filter out future items for display
  const currentItems = data.lineItems.filter(item => item.isFuture !== true);
  
  // Get the actual closing balance from the last displayed transaction
  const actualClosingBalance = currentItems.length > 0 
    ? currentItems[currentItems.length - 1].balance 
    : data.summary.openingBalance;
  
  // Calculate expiration date (30 days from statement date) using Luxon
  const statementDate = DateTime.fromISO(data.statementInfo.statementDate, { zone: 'America/Cancun' });
  const expirationDate = statementDate.plus({ days: 30 });
  
  // Find next payment due date (first future charge)
  const firstFutureItem = data.lineItems.find(item => item.isFuture === true && item.charge > 0);
  const nextPaymentDue = firstFutureItem ? formatDate(firstFutureItem.date) : 'TBD';
  
  // Generate statement ID (clientId-unitId-fiscalYear-statementDate)
  const statementId = `${clientId}-${unitId}-${data.statementInfo.fiscalYear}-${data.statementInfo.statementDate.replace(/-/g, '')}`;
  
  // Get contact info from client governance
  const contactEmail = data.clientInfo.governance?.managementCompany?.email || 'admin@sandyland.com.mx';
  const contactPhone = data.clientInfo.governance?.managementCompany?.phone || '+52 984 206 4791';
  
  // Get current timestamp in Cancun timezone
  const generatedNow = getNow();
  const generatedTimestamp = DateTime.fromJSDate(generatedNow).setZone('America/Cancun');
  
  // Build HTML
  const html = `<!DOCTYPE html>
<html lang="${language === 'spanish' ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title} - ${data.clientInfo.name} - ${t.unit} ${unitId}</title>
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
    .statement-page {
      max-width: 8.5in;
      margin: 0 auto;
      padding-bottom: 0;
    }

    .content-bottom-spacer {
      height: 0;
      clear: both;
      display: none;
    }
    
    /* Header section */
    .statement-header {
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 340px);
      column-gap: 20px;
      align-items: start;
      grid-auto-rows: min-content;
    }
    
    .header-left,
    .header-right {
      width: 100%;
    }
    
    .header-left {
      text-align: left;
    }
    
    .statement-title {
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
    
    .client-info .owner-name {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .client-info-table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 55px;
    }
    
    .client-info-table td {
      padding: 2px 0;
      vertical-align: top;
    }
    
    .client-info-table td:first-child {
      font-weight: bold;
      width: 105px;
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
      max-height: 95px;
      height: auto;
      display: block;
      padding-top: 2px;
    }
    
    .logo-right {
      text-align: right;
    }
    
    .banking-info {
      border: 1px solid #000;
      padding: 8px 10px;
      background: #f5f5f5;
      text-align: left;
      margin-top: 6px;
      width: 100%;
      box-sizing: border-box;
    }
    
    .banking-info h3 {
      font-size: 9pt;
      font-weight: bold;
      margin-bottom: 3px;
      text-align: center;
    }
    
    .banking-info table {
      width: 100%;
      font-size: 8pt;
      line-height: 1.25;
      border-collapse: collapse;
    }
    
    .banking-info td {
      padding: 2px 4px;
      vertical-align: top;
    }
    
    .banking-info td:first-child {
      font-weight: bold;
      width: 32%;
      white-space: nowrap;
    }
    
    /* Transaction tables */
    .section-header {
      background-color: #4472C4;
      color: #fff;
      padding: 5px 10px;
      font-size: 10pt;
      font-weight: bold;
      text-align: center;
      margin: 15px 0 5px 0;
    }
    
    .transaction-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2px;
      font-size: 9pt;
    }
    
    .transaction-table thead {
      background-color: #4472C4;
      color: #fff;
    }
    
    .transaction-table th {
      padding: 5px 4px;
      text-align: center;
      font-size: 8pt;
      font-weight: bold;
      border: 1px solid #fff;
    }
    
    .transaction-table td {
      padding: 4px;
      border: 1px solid #ddd;
      font-size: 9pt;
    }
    
    .transaction-table tbody tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    /* Column alignments (5 columns - single table format) */
    .col-date { text-align: center; width: 12%; }
    .col-description { text-align: left; width: 50%; }
    .col-charge { text-align: right; width: 13%; }
    .col-payment { text-align: right; width: 13%; }
    .col-balance { text-align: right; width: 12%; font-weight: bold; }
    
    /* Payment amounts in red (only in table body, not header) */
    .transaction-table tbody .payment-red {
      color: #C00000;
      font-weight: bold;
    }
    
    /* Payment amounts in red */
    .payment-red {
      color: #C00000;
      font-weight: bold;
    }
    
    /* Balance due box (appears right after transaction table) */
    .balance-due-box {
      margin: 0;
      text-align: right;
      /* page-break-before: avoid; */
      /* page-break-inside: avoid; */
    }
    
    .balance-due-box table {
      float: right;
      border: 2px solid #000;
      background-color: #fff;
    }
    
    .balance-due-box td {
      padding: 3px 15px;
      font-weight: bold;
      font-size: 11pt;
    }
    
    .balance-due-box td:first-child {
      text-align: right;
      padding-right: 20px;
    }
    
    .balance-due-box td:last-child {
      text-align: right;
      min-width: 120px;
    }
    
    /* Allocation summary table */
    .allocation-summary {
      margin: 20px 0 10px 0;
      clear: both;
    }
    
    .allocation-summary h3 {
      background-color: #4472C4;
      color: #fff;
      padding: 5px 10px;
      font-size: 10pt;
      font-weight: bold;
      text-align: center;
      margin: 0 0 0 0;
      display: table-caption;
      width: auto;
    }
    
    .allocation-table {
      width: auto;
      max-width: 600px;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 15px;
    }
    
    .allocation-table th {
      background-color: #f5f5f5;
      padding: 5px 8px;
      border: 1px solid #ddd;
      font-weight: bold;
      text-align: left;
    }
    
    .allocation-table td {
      padding: 5px 8px;
      border: 1px solid #ddd;
    }
    
    .allocation-table .col-category { min-width: 150px; text-align: left; }
    .allocation-table .col-charges { text-align: right; min-width: 100px; }
    .allocation-table .col-penalties { text-align: right; min-width: 100px; }
    .allocation-table .col-total-paid { text-align: right; min-width: 100px; }
    
    .allocation-table .totals-row {
      background-color: #e8f0fe;
      font-weight: bold;
    }
    
    /* Total balance */
    .total-balance {
      margin: 20px 0;
      text-align: right;
    }
    
    .total-balance table {
      float: right;
      border: 2px solid #000;
    }
    
    .total-balance td {
      padding: 10px 15px;
      font-weight: bold;
      font-size: 12pt;
    }
    
    .total-balance td:first-child {
      text-align: right;
    }
    
    .total-balance td:last-child {
      text-align: right;
      min-width: 120px;
    }
    
    /* Footer */
    .payment-terms {
      margin-top: 0;
      font-size: 8pt;
      line-height: 1.5;
      clear: both;
      border-top: 1px solid #ddd;
      padding-top: 5px;
    }
    
    .payment-terms p {
      margin-bottom: 8px;
    }
    
    .statement-footer {
      margin-top: 0;
      padding-top: 2px;
      padding-bottom: 2px;
      border-top: 2px solid #000;
      font-size: 8pt;
      color: #333;
      clear: both;
    }
    
    .statement-footer .footer-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      gap: 15px;
      line-height: 1.2;
    }
    
    .statement-footer .footer-row > div {
      flex: 1;
      white-space: nowrap;
      overflow: visible;
    }
    
    .statement-footer .footer-row > div:first-child {
      text-align: left;
      flex: 1.5;
    }
    
    .statement-footer .footer-row > div:nth-child(2) {
      text-align: center;
      flex: 0.8;
    }
    
    .statement-footer .footer-row > div:last-child {
      text-align: right;
      flex: 1.2;
    }
    
    .statement-footer .footer-center {
      text-align: center;
      margin-top: 5px;
      font-size: 7pt;
      font-style: italic;
      line-height: 1.3;
    }
    
    /* PDFShift footers come from pdfService footer.html */
    
    /* Print styles */
    @media print {
      body {
        padding: 0;
        margin: 0;
      }
      
      .statement-page {
        max-width: none;
        padding: 0;
        margin: 0;
        padding-bottom: 0.1in;
      }
      
      /* Hide legacy footer row (replaced by PDFShift footer) */
      .statement-footer .footer-row {
        display: none !important;
      }
      
      .statement-footer {
        margin-top: 5px;
        /* page-break-inside: avoid; */
      }
      .statement-header,
      .banking-info,
      .client-info-table {
        /* page-break-inside: avoid; */
      }
      
      /* Try to keep balance box and allocation summary together */
      .balance-due-box {
        /* page-break-inside: avoid; */
        /* page-break-after: avoid; */
      }
      
      .allocation-summary {
        /* page-break-before: avoid; */
        /* page-break-inside: avoid; */
      }
      
      /* Keep tables together when possible */
      .transaction-table {
        /* page-break-inside: auto; */
      }
      
      .transaction-table thead {
        display: table-header-group;
      }
      
      .transaction-table tr {
        /* page-break-inside: avoid; */
      }
      
      /* Prevent orphaned rows */
      .transaction-table tbody tr {
        /* page-break-after: auto; */
      }
      
      /* Keep allocation summary together */
      .allocation-table,
      .allocation-table tbody {
        page-break-inside: avoid;
      }
      
      .payment-terms {
        page-break-inside: avoid;
      }
    }
    
    /* Additional PDF-specific optimizations */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  <div class="statement-page">
    <!-- Header -->
    <div class="statement-header">
      <!-- Left side: Title and Client Info -->
      <div class="header-left">
        <div class="statement-title">${t.title}</div>
        
        <div class="client-info">
          <div class="owner-name">${t.unit} ${unitId} - ${data.unitInfo.owners.join(', ')}</div>
          
          <table class="client-info-table">
            <tr>
              <td>${t.address}:</td>
              <td>${(() => {
                const addr = data.clientInfo.address || '';
                const commaIndex = addr.indexOf(',');
                if (commaIndex > 0) {
                  const street = addr.substring(0, commaIndex);
                  const rest = addr.substring(commaIndex + 1).trim();
                  return street + '<br>' + rest;
                }
                return addr;
              })()}</td>
            </tr>
            <tr>
              <td colspan="2" style="height: 5px;"></td>
            </tr>
            <tr>
              <td>${t.period}:</td>
              <td>${data.statementInfo.periodCovered}</td>
            </tr>
            <tr>
              <td>${t.date}:</td>
              <td>${statementDate.toFormat('MM/dd/yyyy')}</td>
            </tr>
            ${data.summary.closingBalance >= 0 ? `
            <tr>
              <td>${t.nextPaymentDue}:</td>
              <td>${nextPaymentDue}</td>
            </tr>
            ` : ''}
          </table>
        </div>
      </div>
      
      <!-- Right side: Logo + Banking Info -->
      <div class="header-right">
        <div class="logo-top logo-right">
          ${data.clientInfo.logoUrl 
            ? `<img src="${data.clientInfo.logoUrl}" alt="${data.clientInfo.name}">`
            : `<div style="font-size: 12pt; font-weight: bold;">${data.clientInfo.name}</div>`
          }
        </div>
        
        <div class="banking-info">
          <h3>${t.bankingInfo}</h3>
          <table>
            <tr>
              <td>${t.bank}:</td>
              <td>${data.clientInfo.bankAccountInfo.bankName}</td>
            </tr>
            <tr>
              <td>${t.account}:</td>
              <td>${data.clientInfo.bankAccountInfo.accountNumber}</td>
            </tr>
            <tr>
              <td>${t.clabe}:</td>
              <td>${data.clientInfo.bankAccountInfo.clabe}</td>
            </tr>
            <tr>
              <td>${t.beneficiary}:</td>
              <td>${data.clientInfo.bankAccountInfo.accountName}</td>
            </tr>
            <tr>
              <td>${t.reference}:</td>
              <td>${data.clientInfo.bankAccountInfo.reference}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Section divider -->
    <div style="border-top: 2px solid #000; margin: 20px 0 15px 0;"></div>
    
    <!-- Account Activity Section -->
    <div class="section-header">${t.accountActivity}</div>
    <table class="transaction-table">
      <thead>
        <tr>
          <th class="col-date">${t.tableHeaders.date}</th>
          <th class="col-description">${t.tableHeaders.description}</th>
          <th class="col-charge">${t.tableHeaders.charge}</th>
          <th class="col-payment">${t.tableHeaders.payment}</th>
          <th class="col-balance">${t.tableHeaders.balance}</th>
        </tr>
      </thead>
      <tbody>
        <!-- Opening Balance Row -->
        <tr style="background-color: #f9f9f9;">
          <td class="col-date"></td>
          <td class="col-description" style="font-style: italic;">${t.openingBalance}</td>
          <td class="col-charge"></td>
          <td class="col-payment"></td>
          <td class="col-balance">${formatCurrency(data.summary.openingBalance)}</td>
        </tr>
        
        <!-- All Transaction Rows -->
        ${currentItems.map(item => `
        <tr>
          <td class="col-date">${formatDate(item.date)}</td>
          <td class="col-description">${translateDescription(item.description, language)}</td>
          <td class="col-charge">${item.charge > 0 ? formatCurrency(item.charge) : ''}</td>
          <td class="col-payment ${item.payment > 0 ? 'payment-red' : ''}">${item.payment > 0 ? formatCurrency(item.payment) : ''}</td>
          <td class="col-balance">${formatCurrency(item.balance)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <!-- Balance Due/Credit (immediately after activity table) -->
    <div class="balance-due-box">
      <table>
        <tr>
          <td>
            ${actualClosingBalance > 0 
              ? t.balanceDue 
              : actualClosingBalance < 0 
                ? t.creditBalance 
                : t.paidInFull
            }
          </td>
          <td>
            ${actualClosingBalance > 0 
              ? formatCurrency(actualClosingBalance)
              : actualClosingBalance < 0
                ? formatCurrency(Math.abs(actualClosingBalance))
                : '$0.00'
            }
          </td>
        </tr>
      </table>
    </div>
    
    <!-- Spacer before Allocation Summary -->
    <div style="height: 20px; clear: both;"></div>
    
    <!-- Allocation Summary -->
    <div class="allocation-summary">
      <table class="allocation-table">
        <caption style="background-color: #4472C4; color: #fff; padding: 5px 10px; font-size: 10pt; font-weight: bold; text-align: center; caption-side: top;">${t.allocationSummary}</caption>
        <thead>
          <tr>
            <th class="col-category">${t.category}</th>
            <th class="col-charges">${t.charges}</th>
            <th class="col-penalties">${t.penalties}</th>
            <th class="col-total-paid">${t.totalPaid}</th>
          </tr>
        </thead>
        <tbody>
          ${data.allocationSummary.categories.map(cat => `
          <tr>
            <td class="col-category">${cat.name}</td>
            <td class="col-charges">${cat.charges > 0 ? formatCurrency(cat.charges) : ''}</td>
            <td class="col-penalties">${cat.penalties > 0 ? formatCurrency(cat.penalties) : ''}</td>
            <td class="col-total-paid">${formatCurrency(Math.abs(cat.paid))}</td>
          </tr>
          `).join('')}
          
          <tr class="totals-row">
            <td class="col-category">${t.totals}</td>
            <td class="col-charges">${formatCurrency(data.allocationSummary.totals.charges)}</td>
            <td class="col-penalties">${formatCurrency(data.allocationSummary.totals.penalties)}</td>
            <td class="col-total-paid">${formatCurrency(data.allocationSummary.totals.paid)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Footer - Payment Terms -->
    <div class="payment-terms">
      <p>${t.paymentTerms.cash}</p>
      <p>${t.paymentTerms.waterDue}</p>
      <p>${t.paymentTerms.hoaDue}</p>
      <p>${t.paymentTerms.application}</p>
    </div>
    
    <!-- Statement Footer -->
    <div class="content-bottom-spacer"></div>
    <div class="statement-footer">
      <div class="footer-row">
        <div>${t.statementId}: ${statementId}</div>
        <div>${t.pageOf} 1 of 1</div>
        <div>${t.generatedOn}: ${generatedTimestamp.toFormat('MM/dd/yyyy HH:mm')}</div>
      </div>
      <div class="footer-center">
        ${t.questionsContact
          .replace('{name}', data.clientInfo.governance.managementCompany.name)
          .replace('{email}', contactEmail)
          .replace('{phone}', contactPhone)}
      </div>
      <div class="footer-center">
        ${t.confidentialNotice}
      </div>
    </div>
  </div>
</body>
</html>`;
  
  return {
    html,
    meta: {
      statementId,
      generatedAt: generatedTimestamp.toFormat('MM/dd/yyyy HH:mm'),
      language
    },
    summary: data.summary,
    // Expose the cleaned-up line items used for the statement table.
    // We return the same shape as statementData.lineItems but restricted
    // to the rows actually displayed (non-future items). This will be
    // useful for future exports and row-level drill-down without needing
    // to re-run the aggregation pipeline.
    lineItems: currentItems
  };
}

