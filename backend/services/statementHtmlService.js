/**
 * Statement HTML Service
 * Generates professional HTML statements matching prior administrator's design
 */

import { getStatementData } from './statementDataService.js';
import { DateTime } from 'luxon';

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
      bankingInfo: 'BANKING INFORMATION',
      bank: 'Bank',
      account: 'Account',
      clabe: 'CLABE',
      beneficiary: 'Beneficiary',
      reference: 'Reference',
      date: 'Date',
      expirationDate: 'Expiration Date',
      balanceMaintenance: 'BALANCE MAINTENANCE',
      unit: 'Unit',
      nextPaymentDue: 'Next Payment Due',
      tableHeaders: {
        date: 'DATE',
        description: 'DESCRIPTION',
        amount: 'AMOUNT',
        penalty: 'PENALTY',
        payments: 'PAYMENTS',
        balance: 'BALANCE'
      },
      hoaSubtotal: 'BALANCE MAINTENANCE FEES',
      waterSection: 'BALANCE WATER CONSUMPTION',
      waterSubtotal: 'WATER BALANCE',
      totalBalance: 'TOTAL BALANCE',
      paymentTerms: {
        cash: 'We inform you that for security reasons we do not receive cash, so please make your payment in the condominium\'s bank account and send us your receipt.',
        waterDue: '***the water consumption must be paid within the first 10 days of the corresponding month, after the ten days there will be 5% interest per month.**',
        hoaDue: '***Maintenance fees must be paid within the first month of the corresponding quarter, after the month there will be 5% interest per month as approved by the Condominium Owners\' Meeting. **',
        application: 'Payments are applied first to the penalties and then to the oldest installments as indicated in articles 2281 and 2282 of the Civil Code of the State of Quintana Roo.'
      }
    },
    spanish: {
      title: 'ESTADO DE CUENTA',
      bankingInfo: 'INFORMACION BANCARIA',
      bank: 'Banco',
      account: 'Cuenta',
      clabe: 'CLABE',
      beneficiary: 'Beneficiario',
      reference: 'Referencia',
      date: 'Fecha',
      expirationDate: 'Fecha de Vencimiento',
      balanceMaintenance: 'BALANCE MANTENIMIENTO',
      unit: 'Unidad',
      nextPaymentDue: 'Próximo Pago Vencido',
      tableHeaders: {
        date: 'FECHA',
        description: 'DESCRIPCION',
        amount: 'MONTO',
        penalty: 'PENALIZACION',
        payments: 'PAGOS',
        balance: 'BALANCE'
      },
      hoaSubtotal: 'BALANCE CUOTAS DE MANTENIMIENTO',
      waterSection: 'ESTADO DE CUENTA CONSUMO DE AGUA',
      waterSubtotal: 'BALANCE AGUA',
      totalBalance: 'BALANCE TOTAL',
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
 * Generate HTML statement
 * @param {Object} api - Axios API instance
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {Object} options - { fiscalYear, language }
 * @returns {string} HTML document
 */
export async function generateStatementHtml(api, clientId, unitId, options = {}) {
  // Get statement data
  const data = await getStatementData(api, clientId, unitId, options.fiscalYear);
  
  // Determine language
  const language = options.language || 'english';
  const t = getTranslations(language);
  
  // Separate line items by module (based on description)
  // IMPORTANT: Filter out future items - statement shows only current/past transactions
  const hoaItems = data.lineItems.filter(item => {
    // Skip future items
    if (item.isFuture === true) return false;
    
    const desc = (item.description || '').toLowerCase();
    return desc.includes('hoa') || 
           desc.includes('maintenance') || 
           desc.includes('dues') ||
           desc.includes('mantenimiento');
  });
  
  const waterItems = data.lineItems.filter(item => {
    // Skip future items
    if (item.isFuture === true) return false;
    
    const desc = (item.description || '').toLowerCase();
    return desc.includes('water') || 
           desc.includes('agua') ||
           desc.includes('consumption') ||
           desc.includes('consumo');
  });
  
  // Calculate section balances
  let hoaBalance = 0;
  const hoaRows = hoaItems.map(item => {
    hoaBalance += (item.charge || 0) - (item.payment || 0);
    return { ...item, balance: hoaBalance };
  });
  
  let waterBalance = 0;
  const waterRows = waterItems.map(item => {
    waterBalance += (item.charge || 0) - (item.payment || 0);
    return { ...item, balance: waterBalance };
  });
  
  // Calculate expiration date (30 days from statement date) using Luxon
  const statementDate = DateTime.fromISO(data.statementInfo.statementDate, { zone: 'America/Cancun' });
  const expirationDate = statementDate.plus({ days: 30 });
  
  // Find next payment due date (first future charge)
  const firstFutureItem = data.lineItems.find(item => item.isFuture === true && item.charge > 0);
  const nextPaymentDue = firstFutureItem ? formatDate(firstFutureItem.date) : 'TBD';
  
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
      padding: 0.5in;
    }
    
    /* Page layout */
    .statement-page {
      max-width: 8.5in;
      margin: 0 auto;
    }
    
    /* Header section */
    .statement-header {
      margin-bottom: 20px;
      position: relative;
    }
    
    .header-left {
      text-align: left;
      width: 60%;
    }
    
    .logo-top {
      margin-bottom: 10px;
    }
    
    .logo-top img {
      max-width: 150px;
      max-height: 75px;
      height: auto;
    }
    
    .statement-title {
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 15px;
      text-transform: uppercase;
    }
    
    .client-info {
      font-size: 10pt;
      line-height: 1.5;
    }
    
    .client-info .owner-name {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .client-info-table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 5px;
    }
    
    .client-info-table td {
      padding: 3px 0;
      vertical-align: top;
    }
    
    .client-info-table td:first-child {
      font-weight: bold;
      width: 140px;
      padding-right: 10px;
    }
    
    .header-right {
      position: absolute;
      top: 125px;
      right: 0;
      width: 38%;
    }
    
    .banking-info {
      border: 1px solid #000;
      padding: 10px;
      background: #f5f5f5;
      text-align: left;
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
      line-height: 1.3;
    }
    
    .banking-info td {
      padding: 1px 5px;
    }
    
    .banking-info td:first-child {
      font-weight: bold;
      width: 40%;
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
      margin-bottom: 10px;
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
    
    /* Column alignments (6 columns - removed Apartment and Invoice/Receipt) */
    .col-date { text-align: center; width: 12%; }
    .col-description { text-align: left; width: 45%; }
    .col-amount { text-align: right; width: 13%; }
    .col-penalty { text-align: right; width: 12%; }
    .col-payment { text-align: right; width: 13%; color: #C00000; }
    .col-balance { text-align: right; width: 13%; font-weight: bold; }
    
    /* Payment amounts in red */
    .payment-red {
      color: #C00000;
      font-weight: bold;
    }
    
    /* Subtotal rows */
    .subtotal-row {
      background-color: #fff !important;
      border: 2px solid #000 !important;
    }
    
    .subtotal-row td {
      padding: 8px;
      font-weight: bold;
      border: none;
    }
    
    .subtotal-label {
      text-align: right;
      font-size: 10pt;
    }
    
    .subtotal-amount {
      text-align: right;
      font-size: 11pt;
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
      margin-top: 30px;
      font-size: 8pt;
      line-height: 1.5;
      clear: both;
    }
    
    .payment-terms p {
      margin-bottom: 8px;
    }
    
    /* Print styles */
    @media print {
      body {
        padding: 0;
      }
      
      .statement-page {
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <div class="statement-page">
    <!-- Header -->
    <div class="statement-header">
      <!-- Left side: Logo, Title and Client Info -->
      <div class="header-left">
        <div class="logo-top">
          ${data.clientInfo.logoUrl 
            ? `<img src="${data.clientInfo.logoUrl}" alt="${data.clientInfo.name}">`
            : `<div style="font-size: 12pt; font-weight: bold;">${data.clientInfo.name}</div>`
          }
        </div>
        
        <div class="statement-title">${t.title}</div>
        
        <div class="client-info">
          <div class="owner-name">${data.unitInfo.owners.join(', ')}</div>
          
          <table class="client-info-table">
            <tr>
              <td>${t.unit}:</td>
              <td>${unitId}</td>
            </tr>
            <tr>
              <td>${language === 'spanish' ? 'Dirección:' : 'Address'}:</td>
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
              <td colspan="2" style="height: 8px;"></td>
            </tr>
            <tr>
              <td>${t.date}:</td>
              <td>${statementDate.toFormat('MM/dd/yyyy')}</td>
            </tr>
            <tr>
              <td>${t.nextPaymentDue}:</td>
              <td>${nextPaymentDue}</td>
            </tr>
          </table>
        </div>
      </div>
      
      <!-- Right side: Banking Info -->
      <div class="header-right">
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
    
    ${hoaRows.length > 0 ? `
    <!-- HOA Maintenance Section -->
    <table class="transaction-table">
      <thead>
        <tr>
          <th class="col-date">${t.tableHeaders.date}</th>
          <th class="col-description">${t.tableHeaders.description}</th>
          <th class="col-amount">${t.tableHeaders.amount}</th>
          <th class="col-penalty">${t.tableHeaders.penalty}</th>
          <th class="col-payment">${t.tableHeaders.payments}</th>
          <th class="col-balance">${t.tableHeaders.balance}</th>
        </tr>
      </thead>
      <tbody>
        ${hoaRows.map(item => `
        <tr>
          <td class="col-date">${formatDate(item.date)}</td>
          <td class="col-description">${translateDescription(item.description, language)}</td>
          <td class="col-amount">${item.charge ? formatCurrency(item.charge) : ''}</td>
          <td class="col-penalty">${item.penalty ? formatCurrency(item.penalty) : ''}</td>
          <td class="col-payment ${item.payment ? 'payment-red' : ''}">${item.payment ? formatCurrency(item.payment) : ''}</td>
          <td class="col-balance">${formatCurrency(item.balance)}</td>
        </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="5" class="subtotal-label">${t.hoaSubtotal}</td>
          <td class="subtotal-amount">${formatCurrency(hoaBalance)}</td>
        </tr>
      </tfoot>
    </table>
    ` : ''}
    
    ${waterRows.length > 0 ? `
    <!-- Water Consumption Section -->
    <div class="section-header">
      ${language === 'spanish' 
        ? 'ESTADO DE CUENTA CONSUMO DE AGUA / BALANCE WATER CONSUMPTION'
        : 'BALANCE WATER CONSUMPTION / ESTADO DE CUENTA CONSUMO DE AGUA'
      }
    </div>
    <table class="transaction-table">
      <thead>
        <tr>
          <th class="col-date">${t.tableHeaders.date}</th>
          <th class="col-description">${t.tableHeaders.description}</th>
          <th class="col-amount">${t.tableHeaders.amount}</th>
          <th class="col-penalty">${t.tableHeaders.penalty}</th>
          <th class="col-payment">${t.tableHeaders.payments}</th>
          <th class="col-balance">${t.tableHeaders.balance}</th>
        </tr>
      </thead>
      <tbody>
        ${waterRows.map(item => `
        <tr>
          <td class="col-date">${formatDate(item.date)}</td>
          <td class="col-description">${translateDescription(item.description, language)}</td>
          <td class="col-amount">${item.charge ? formatCurrency(item.charge) : ''}</td>
          <td class="col-penalty">${item.penalty ? formatCurrency(item.penalty) : ''}</td>
          <td class="col-payment ${item.payment ? 'payment-red' : ''}">${item.payment ? formatCurrency(item.payment) : ''}</td>
          <td class="col-balance">${formatCurrency(item.balance)}</td>
        </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="5" class="subtotal-label">${t.waterSubtotal}</td>
          <td class="subtotal-amount">${formatCurrency(waterBalance)}</td>
        </tr>
      </tfoot>
    </table>
    ` : ''}
    
    <!-- Total Balance -->
    <div class="total-balance">
      <table>
        <tr>
          <td>${t.totalBalance}</td>
          <td>${formatCurrency(data.summary.closingBalance)}</td>
        </tr>
      </table>
    </div>
    
    <!-- Footer - Payment Terms -->
    <div class="payment-terms">
      <p>${t.paymentTerms.cash}</p>
      <p>${t.paymentTerms.waterDue}</p>
      <p>${t.paymentTerms.hoaDue}</p>
      <p>${t.paymentTerms.application}</p>
    </div>
  </div>
</body>
</html>`;
  
  return html;
}

