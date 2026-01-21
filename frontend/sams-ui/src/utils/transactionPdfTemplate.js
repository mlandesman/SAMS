/**
 * Transaction PDF HTML Template Generator
 * Generates printable HTML from filtered transactions with expanded split allocations
 */

/**
 * Format currency (pesos) from centavos
 * @param {number} centavos - Amount in centavos
 * @param {string} currency - Currency code (default: 'MXN')
 * @returns {string} Formatted currency
 */
function formatCurrency(centavos, currency = 'MXN') {
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
  }
  return `$${formatted}`;
}

/**
 * Format Date object as MM/DD/YYYY using America/Cancun timezone
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
function formatDateNative(date) {
  if (!date || isNaN(date.getTime())) return '';
  
  // Format date in America/Cancun timezone
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/Cancun',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format date as MM/DD/YYYY
 * @param {*} dateValue - Date value (can be Date object, ISO string, or formatted date object)
 * @returns {string} Formatted date
 */
function formatDate(dateValue) {
  if (!dateValue) return '';
  
  // Handle formatted date object from API
  if (dateValue.display) {
    return dateValue.display; // Already formatted as MM/DD/YYYY
  }
  
  // Handle timestamp object
  if (dateValue.timestamp) {
    const seconds = dateValue.timestamp._seconds || dateValue.timestamp;
    const date = new Date(seconds * 1000);
    return formatDateNative(date);
  }
  
  // Handle ISO string
  if (dateValue.iso) {
    const date = new Date(dateValue.iso);
    return formatDateNative(date);
  }
  
  // Handle Date object
  if (dateValue instanceof Date) {
    return formatDateNative(dateValue);
  }
  
  // Handle string
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return formatDateNative(date);
    }
  }
  
  return '';
}

/**
 * Check if transaction has split allocations
 * @param {Object} transaction - Transaction object
 * @returns {boolean} True if transaction has splits
 */
function isSplitTransaction(transaction) {
  return (transaction.categoryName === '-Split-' || transaction.category === '-Split-') &&
         transaction.allocations &&
         Array.isArray(transaction.allocations) &&
         transaction.allocations.length > 0;
}

/**
 * Generate filter summary text
 * @param {Object} filterSummary - Filter summary object
 * @returns {string} Filter description
 */
function generateFilterSummary(filterSummary) {
  if (!filterSummary) return 'All Transactions';
  
  const parts = [];
  
  // Date range
  if (filterSummary.dateRange) {
    if (filterSummary.dateRange.startDate && filterSummary.dateRange.endDate) {
      const start = formatDate(filterSummary.dateRange.startDate);
      const end = formatDate(filterSummary.dateRange.endDate);
      parts.push(`${start} - ${end}`);
    } else if (filterSummary.dateRange === 'all') {
      parts.push('All Time');
    } else {
      parts.push(String(filterSummary.dateRange));
    }
  }
  
  // Advanced filters
  if (filterSummary.advancedFilters) {
    const filters = filterSummary.advancedFilters;
    if (filters.vendor && filters.vendor.length > 0) {
      parts.push(`Vendor: ${filters.vendor.join(', ')}`);
    }
    if (filters.category && filters.category.length > 0) {
      parts.push(`Category: ${filters.category.join(', ')}`);
    }
    if (filters.unit && filters.unit.length > 0) {
      parts.push(`Unit: ${filters.unit.join(', ')}`);
    }
  }
  
  return parts.length > 0 ? parts.join(' | ') : 'All Transactions';
}

/**
 * Generate printable HTML from filtered transactions
 * @param {Object} params
 * @param {Array} params.transactions - Filtered transactions array
 * @param {Object} params.clientInfo - Client name, logoUrl
 * @param {Object} params.filterSummary - Date range, filter description
 * @returns {string} Complete HTML document
 */
export function generateTransactionsPdfHtml({ transactions, clientInfo, filterSummary }) {
  const now = new Date();
  const generatedDate = now.toLocaleDateString('en-US', {
    timeZone: 'America/Cancun',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const generatedTime = now.toLocaleTimeString('en-US', {
    timeZone: 'America/Cancun',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const filterText = generateFilterSummary(filterSummary);
  
  // Try multiple possible client name fields
  // Check nested basicInfo first (most common structure), then top-level fields
  let clientName = clientInfo?.basicInfo?.displayName ||
                   clientInfo?.basicInfo?.fullName ||
                   clientInfo?.name || 
                   clientInfo?.fullName || 
                   clientInfo?.clientName ||
                   clientInfo?.displayName;
  
  // Final fallback
  if (!clientName) {
    clientName = 'Association';
  }
  
  const logoUrl = clientInfo?.logoUrl || clientInfo?.branding?.logoUrl;
  
  // Build table rows with expanded splits
  // Track row index for alternating colors, grouping split transactions together
  let tableRows = '';
  let rowIndex = 0;
  
  transactions.forEach((tx) => {
    const date = formatDate(tx.date);
    const vendor = tx.vendorName || tx.vendor || '';
    const unit = tx.unitId || tx.unit || '';
    const account = tx.accountName || tx.accountType || tx.account || '';
    const notes = tx.notes || '';
    const currency = tx.currency || 'MXN';
    const amount = tx.amount || 0;
    
    if (isSplitTransaction(tx)) {
      const isEvenGroup = (rowIndex % 2) === 0;
      const rowClass = isEvenGroup ? 'even-row' : 'odd-row';
      const splitGroupClass = 'split-group';
      
      // Main row with vendor and total amount
      tableRows += `
        <tr class="${rowClass} ${splitGroupClass} split-main">
          <td class="col-date">${date}</td>
          <td class="col-vendor">${vendor}</td>
          <td class="col-category">-Split-</td>
          <td class="col-unit"></td>
          <td class="col-amount" style="text-align: right;">${formatCurrency(amount, currency)}</td>
          <td class="col-account">${account}</td>
          <td class="col-notes">${notes}</td>
        </tr>
      `;
      
      // Expanded allocation rows (same row class as main row to keep them grouped)
      tx.allocations.forEach((allocation, index) => {
        const allocCategory = allocation.categoryName || allocation.category || '';
        const allocUnit = allocation.unitId || allocation.data?.unitId || allocation.data?.unit || '';
        const allocAmount = allocation.amount || 0;
        const isLastAllocation = index === tx.allocations.length - 1;
        const lastClass = isLastAllocation ? 'split-last' : '';
        
        tableRows += `
          <tr class="${rowClass} ${splitGroupClass} split-allocation ${lastClass}">
            <td class="col-date"></td>
            <td class="col-vendor"></td>
            <td class="col-category split-indent">→ ${allocCategory}</td>
            <td class="col-unit">${allocUnit}</td>
            <td class="col-amount" style="text-align: right;">${formatCurrency(allocAmount, currency)}</td>
            <td class="col-account"></td>
            <td class="col-notes"></td>
          </tr>
        `;
      });
      
      // Increment row index after entire split group
      rowIndex++;
    } else {
      // Regular transaction row
      const isEvenRow = (rowIndex % 2) === 0;
      const rowClass = isEvenRow ? 'even-row' : 'odd-row';
      const category = tx.categoryName || tx.category || '';
      
      tableRows += `
        <tr class="${rowClass}">
          <td class="col-date">${date}</td>
          <td class="col-vendor">${vendor}</td>
          <td class="col-category">${category}</td>
          <td class="col-unit">${unit}</td>
          <td class="col-amount" style="text-align: right;">${formatCurrency(amount, currency)}</td>
          <td class="col-account">${account}</td>
          <td class="col-notes">${notes}</td>
        </tr>
      `;
      
      rowIndex++;
    }
  });
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transaction Report</title>
  <style>
    @page {
      size: Letter landscape;
      margin: 0.6in 0.5in 0.8in 0.5in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    
    .report-container {
      width: 100%;
      max-width: 11in;
      margin: 0 auto;
    }
    
    /* Header Styles */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #000;
    }
    
    .header-left {
      flex: 1;
    }
    
    .header-right {
      flex: 0 0 auto;
      text-align: right;
    }
    
    .report-title {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .client-name {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .filter-summary {
      font-size: 9pt;
      color: #666;
      margin-bottom: 5px;
    }
    
    .generated-info {
      font-size: 8pt;
      color: #666;
    }
    
    .logo-top {
      margin-bottom: 10px;
    }
    
    .logo-top img {
      max-width: 200px;
      max-height: 80px;
      object-fit: contain;
    }
    
    /* Table Styles */
    .report-table-container {
      margin-top: 15px;
      overflow-x: visible;
    }
    
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    
    .report-table thead {
      background-color: #f0f0f0;
    }
    
    .report-table th {
      padding: 8px 6px;
      text-align: left;
      font-weight: bold;
      border-bottom: 2px solid #000;
      border-right: 1px solid #ccc;
    }
    
    .report-table th:last-child {
      border-right: none;
    }
    
    .report-table th.col-amount {
      text-align: right;
    }
    
    .report-table td {
      padding: 6px;
      border-bottom: 1px solid #ddd;
      border-right: 1px solid #ddd;
      vertical-align: top;
    }
    
    .report-table td:last-child {
      border-right: none;
    }
    
    .report-table tbody tr:hover {
      background-color: #f9f9f9;
    }
    
    /* Alternating row colors */
    .even-row {
      background-color: #ffffff;
    }
    
    .odd-row {
      background-color: #f8f8f8;
    }
    
    /* Split allocation styles */
    .split-group {
      /* Group split transactions together visually */
    }
    
    .split-main {
      /* Main split transaction row */
      font-weight: 500;
      border-top: 2px solid #999 !important;
    }
    
    .split-allocation {
      /* Allocation rows within a split group */
    }
    
    .split-last {
      /* Last allocation in a group - add darker border below */
      border-bottom: 2px solid #999 !important;
    }
    
    /* Ensure regular rows after split groups have proper spacing */
    .split-group.split-last + tr:not(.split-group) {
      border-top: 1px solid #ddd;
    }
    
    .split-indent {
      padding-left: 20px;
      font-style: italic;
      color: #555;
    }
    
    /* Column widths */
    .col-date {
      width: 10%;
    }
    
    .col-vendor {
      width: 18%;
    }
    
    .col-category {
      width: 18%;
    }
    
    .col-unit {
      width: 8%;
    }
    
    .col-amount {
      width: 12%;
    }
    
    .col-account {
      width: 12%;
    }
    
    .col-notes {
      width: 22%;
    }
    
    /* Page break handling */
    .report-table thead {
      display: table-header-group;
    }
    
    .report-table tbody tr {
      page-break-inside: avoid;
    }
    
    /* Print styles */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .report-table thead {
        display: table-header-group;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header -->
    <div class="report-header">
      <div class="header-left">
        <div class="report-title">Transaction Report</div>
        <div class="client-name">${clientName}</div>
        <div class="filter-summary">${filterText}</div>
        <div class="generated-info">Generated: ${generatedDate} at ${generatedTime}</div>
      </div>
      
      <div class="header-right">
        ${logoUrl 
          ? `<div class="logo-top"><img src="${logoUrl}" alt="${clientName}"></div>`
          : `<div class="client-name">${clientName}</div>`
        }
      </div>
    </div>
    
    <!-- Transaction Table -->
    <div class="report-table-container">
      <table class="report-table">
        <thead>
          <tr>
            <th class="col-date">Date</th>
            <th class="col-vendor">Vendor</th>
            <th class="col-category">Category</th>
            <th class="col-unit">Unit</th>
            <th class="col-amount">Amount</th>
            <th class="col-account">Account</th>
            <th class="col-notes">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="7" style="text-align: center; padding: 20px;">No transactions found</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  return html;
}
