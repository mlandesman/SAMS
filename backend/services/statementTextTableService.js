/**
 * Statement Text Table Service
 * 
 * Generates plain text table output for Statement of Account
 * Enhanced to produce complete, professional Statement of Account text report
 */

import { DateService } from '../services/DateService.js';

// Create DateService instance for date formatting
const dateService = new DateService({ timezone: 'America/Cancun' });

/**
 * Format pesos amount with commas
 * @param {number} amount - Amount in pesos
 * @returns {string} Formatted amount
 */
function formatPesos(amount) {
  if (!amount || isNaN(amount)) return '0.00';
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format date for last updated field
 * @param {*} lastUpdated - Date value (string, Firestore timestamp, or Date object)
 * @returns {string} Formatted date string (YYYY-MM-DD) or 'N/A'
 */
function formatLastUpdated(lastUpdated) {
  if (!lastUpdated) return 'N/A';
  
  if (typeof lastUpdated === 'string') {
    return lastUpdated.split('T')[0];
  } else if (lastUpdated.toDate && typeof lastUpdated.toDate === 'function') {
    return lastUpdated.toDate().toISOString().split('T')[0];
  } else if (lastUpdated.timestamp) {
    const dateObj = lastUpdated.timestamp.toDate 
      ? lastUpdated.timestamp.toDate() 
      : new Date(lastUpdated.timestamp);
    return dateObj.toISOString().split('T')[0];
  } else if (lastUpdated instanceof Date) {
    return lastUpdated.toISOString().split('T')[0];
  }
  
  return 'N/A';
}

/**
 * Center text within a given width
 * @param {string} text - Text to center
 * @param {number} width - Total width
 * @returns {string} Centered text
 */
function centerText(text, width) {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

/**
 * Format date string to "Month Day, Year" format (e.g., "November 27, 2025")
 * @param {string} dateStr - Date string (ISO or YYYY-MM-DD format)
 * @returns {string} Formatted date string
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const formatted = dateService.formatForFrontend(dateStr);
  return `${formatted.month} ${formatted.day}, ${formatted.year}`;
}

/**
 * Format date-time string to "Month Day, Year at H:MM AM/PM" format
 * @param {string} dateStr - ISO date-time string
 * @returns {string} Formatted date-time string
 */
function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  const formatted = dateService.formatForFrontend(dateStr);
  return `${formatted.month} ${formatted.day}, ${formatted.year} at ${formatted.displayTime}`;
}

/**
 * Format transaction row for table display
 * @param {Object} item - Transaction line item
 * @returns {string} Formatted table row
 */
function formatTransactionRow(item) {
  // Handle both Date objects (raw) and date strings (optimized)
  let dateStr;
  if (item.date instanceof Date) {
    dateStr = item.date.toISOString().split('T')[0];
  } else if (typeof item.date === 'string') {
    dateStr = item.date;
  } else {
    dateStr = 'N/A';
  }
  
  const description = (item.description || '').padEnd(21);
  const charge = item.charge > 0 ? formatPesos(item.charge).padStart(11) : ' '.repeat(11);
  const payment = item.payment > 0 ? formatPesos(item.payment).padStart(11) : ' '.repeat(11);
  const balance = formatPesos(item.balance || 0).padStart(11);
  
  return `${dateStr} | ${description}    | ${charge} | ${payment} | ${balance}\n`;
}

/**
 * Generate header section with client info, unit info, and statement info
 * @param {Object} clientInfo - Client information
 * @param {Object} unitInfo - Unit information
 * @param {Object} statementInfo - Statement information
 * @returns {string} Formatted header section
 */
function generateHeader(clientInfo, unitInfo, statementInfo) {
  const divider = '='.repeat(80);
  const thinDivider = '-'.repeat(80);
  
  let output = '';
  output += divider + '\n';
  output += centerText('STATEMENT OF ACCOUNT', 80) + '\n';
  output += divider + '\n\n';
  
  // Logo placeholder
  output += centerText('[LOGO PLACEHOLDER]', 80) + '\n\n';
  
  // Client name and address
  if (clientInfo.name) {
    output += centerText(clientInfo.name, 80) + '\n';
  }
  if (clientInfo.address) {
    output += centerText(clientInfo.address, 80) + '\n';
  }
  output += '\n';
  
  // Statement info box
  output += thinDivider + '\n';
  
  // Left side: Unit info, Right side: Statement info
  const leftCol = [
    'STATEMENT FOR:',
    `Unit ${unitInfo.unitId || ''}`,
    unitInfo.owners?.[0] || 'Owner',
    unitInfo.emails?.[0]?.email || ''
  ];
  
  const rightCol = [
    `STATEMENT DATE: ${formatDate(statementInfo.statementDate)}`,
    `FISCAL YEAR: ${statementInfo.fiscalYear || ''}`,
    `PERIOD: ${statementInfo.periodCovered || ''}`,
    ''
  ];
  
  for (let i = 0; i < leftCol.length; i++) {
    output += leftCol[i].padEnd(40) + rightCol[i] + '\n';
  }
  
  output += thinDivider + '\n\n';
  
  return output;
}

/**
 * Group payments by date and transactionId to combine split payments
 * @param {Array} items - Array of transaction line items
 * @returns {Array} Grouped items with combined payments
 */
function groupPaymentsByTransaction(items) {
  const grouped = [];
  const paymentGroups = new Map(); // Key: date_transactionId, Value: array of payment items
  
  for (const item of items) {
    if (item.type === 'payment' && item.payment > 0) {
      // Group payments by date and transactionId (if available)
      const transactionId = item.transactionId || item.id || '';
      const groupKey = `${item.date}_${transactionId}`;
      
      if (!paymentGroups.has(groupKey)) {
        paymentGroups.set(groupKey, []);
      }
      paymentGroups.get(groupKey).push(item);
    } else {
      // Non-payment items go through as-is
      grouped.push(item);
    }
  }
  
  // Process payment groups - combine payments on same date/transaction
  for (const [groupKey, paymentItems] of paymentGroups.entries()) {
    if (paymentItems.length === 1) {
      // Single payment - no grouping needed
      grouped.push(paymentItems[0]);
    } else {
      // Multiple payments on same date/transaction - combine them
      const firstPayment = paymentItems[0];
      const totalPayment = paymentItems.reduce((sum, item) => sum + (item.payment || 0), 0);
      
      // Create combined description
      const descriptions = paymentItems.map(item => item.description).filter(Boolean);
      let combinedDescription = 'Payment';
      if (descriptions.length > 0) {
        // Extract what was paid from descriptions
        const paidItems = [];
        descriptions.forEach(desc => {
          if (desc.includes('Q1')) paidItems.push('Q1');
          if (desc.includes('Q2')) paidItems.push('Q2');
          if (desc.includes('Q3')) paidItems.push('Q3');
          if (desc.includes('Q4')) paidItems.push('Q4');
          if (desc.includes('Water') || desc.includes('HOA+Water')) paidItems.push('Water');
        });
        
        if (paidItems.length > 0) {
          combinedDescription = `Payment (${paidItems.join(', ')})`;
        } else {
          combinedDescription = `Payment (${descriptions.length} items)`;
        }
      }
      
      // Use the balance from the last payment item (most accurate)
      const lastPayment = paymentItems[paymentItems.length - 1];
      
      grouped.push({
        ...firstPayment,
        description: combinedDescription,
        payment: totalPayment,
        balance: lastPayment.balance,
        _grouped: true,
        _originalItems: paymentItems
      });
    }
  }
  
  // Sort grouped items chronologically
  grouped.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    
    // Within same date: charges before payments
    if (a.type === 'charge' && b.type === 'payment') return -1;
    if (a.type === 'payment' && b.type === 'charge') return 1;
    return 0;
  });
  
  return grouped;
}

/**
 * Generate transaction table with current charges only (no future charges)
 * @param {Array} lineItems - Array of transaction line items
 * @param {Object} summary - Summary information
 * @returns {string} Formatted transaction table
 */
function generateTransactionTable(lineItems, summary) {
  // Only include current (non-future) items
  const currentItems = lineItems.filter(item => !item.isFuture);
  
  // Group payments that were split by the data service
  const groupedCurrentItems = groupPaymentsByTransaction(currentItems);
  
  let output = 'ACCOUNT ACTIVITY\n';
  output += '='.repeat(80) + '\n';
  output += 'Date       | Description              | Charge      | Payment     | Balance\n';
  output += '-----------|--------------------------|-------------|-------------|-------------\n';
  
  // Opening balance
  const openingBalance = summary.openingBalance || 0;
  output += `           | Opening Balance          |             |             | ${formatPesos(openingBalance).padStart(11)}\n`;
  
  // Current transactions (with grouped payments)
  groupedCurrentItems.forEach(item => {
    output += formatTransactionRow(item);
  });
  
  output += '='.repeat(80) + '\n\n';
  
  return output;
}

/**
 * Generate summary section (current charges only, no future charges)
 * @param {Object} summary - Summary information
 * @param {Array} lineItems - Array of transaction line items
 * @param {Object} creditInfo - Credit information
 * @returns {string} Formatted summary section
 */
function generateSummary(summary, lineItems, creditInfo) {
  // Calculate current balance (excluding future charges)
  const currentItems = lineItems.filter(item => !item.isFuture);
  const currentCharges = currentItems.reduce((sum, item) => sum + (item.charge || 0), 0);
  const currentPayments = currentItems.reduce((sum, item) => sum + (item.payment || 0), 0);
  const amountDue = currentCharges - currentPayments;
  
  let output = 'ACCOUNT SUMMARY\n';
  output += '-'.repeat(80) + '\n';
  
  output += `Total Charges:                                              $${formatPesos(currentCharges).padStart(12)} MXN\n`;
  output += `Total Payments:                                             $${formatPesos(currentPayments).padStart(12)} MXN\n`;
  output += '                                                            ---------------\n';
  output += `BALANCE DUE:                                                $${formatPesos(amountDue).padStart(12)} MXN\n`;
  output += `Credit Balance:                                             $${formatPesos(creditInfo?.currentBalance || 0).padStart(12)} MXN\n`;
  output += '-'.repeat(80) + '\n\n';
  
  return output;
}

/**
 * Generate payment instructions section
 * @param {Object} clientInfo - Client information
 * @param {Object} unitInfo - Unit information
 * @returns {string} Formatted payment instructions section
 */
function generatePaymentInstructions(clientInfo, unitInfo) {
  const bank = clientInfo.bankAccountInfo;
  if (!bank) return '';
  
  let output = 'PAYMENT INSTRUCTIONS\n';
  output += '='.repeat(80) + '\n';
  output += 'Please make payment to:\n\n';
  
  if (bank.bankName) {
    output += `Bank: ${bank.bankName}\n`;
  }
  if (bank.accountName) {
    output += `Account Name: ${bank.accountName}\n`;
  }
  if (bank.accountNumber) {
    output += `Account Number: ${bank.accountNumber}\n`;
  }
  if (bank.clabe) {
    output += `CLABE: ${bank.clabe}\n`;
  }
  if (bank.swiftCode) {
    output += `SWIFT Code: ${bank.swiftCode}\n`;
  }
  output += `Reference: Unit ${unitInfo.unitId || ''}\n`;
  output += '\n';
  
  // Management company contact info
  const mgmt = clientInfo.managementCompany;
  if (mgmt && (mgmt.email || mgmt.name || mgmt.phone)) {
    output += 'For questions, contact:';
    if (mgmt.name) {
      output += ` ${mgmt.name}`;
    }
    if (mgmt.email) {
      output += ` ${mgmt.email}`;
    }
    if (mgmt.phone) {
      output += ` ${mgmt.phone}`;
    }
    output += '\n';
  }
  output += '\n';
  
  return output;
}

/**
 * Generate footer section
 * @param {Object} statementInfo - Statement information
 * @returns {string} Formatted footer section
 */
function generateFooter(statementInfo) {
  let output = '='.repeat(80) + '\n';
  output += centerText('Thank you for your prompt payment!', 80) + '\n';
  output += '='.repeat(80) + '\n';
  output += `Generated: ${formatDateTime(statementInfo.generatedAt)}\n`;
  
  return output;
}

/**
 * Generate text table output for Statement of Account
 * 
 * @param {Object} statementData - Data object from getStatementData service
 * @param {Object} options - Formatting options
 * @param {boolean} options.includePaymentInstructions - Include bank info (default: true)
 * @param {string} options.language - 'english' or 'spanish' (default: 'english')
 * @returns {string} Plain text statement output
 */
export function generateTextTable(statementData, options = {}) {
  const {
    includePaymentInstructions = true,
    language = 'english'
  } = options;
  
  // Detect structure type: optimized has lineItems, raw has chronologicalTransactions
  const isOptimized = statementData.lineItems !== undefined;
  
  let transactions;
  let summary;
  let creditInfo;
  let clientInfo;
  let unitInfo;
  let statementInfo;
  
  if (isOptimized) {
    // Optimized structure - use enhanced format
    transactions = statementData.lineItems || [];
    summary = statementData.summary || {};
    creditInfo = statementData.creditInfo || {};
    clientInfo = statementData.clientInfo || {};
    unitInfo = statementData.unitInfo || {};
    statementInfo = statementData.statementInfo || {};
    
    // Build complete statement output
    let output = '';
    
    // Header section
    output += generateHeader(clientInfo, unitInfo, statementInfo);
    
    // Transaction table section
    if (transactions.length === 0) {
      output += 'ACCOUNT ACTIVITY\n';
      output += '='.repeat(80) + '\n';
      output += 'No transactions found\n';
      output += '='.repeat(80) + '\n\n';
    } else {
      output += generateTransactionTable(transactions, summary);
    }
    
    // Summary section
    output += generateSummary(summary, transactions, creditInfo);
    
    // Payment instructions section
    if (includePaymentInstructions) {
      output += generatePaymentInstructions(clientInfo, unitInfo);
    }
    
    // Footer section
    output += generateFooter(statementInfo);
    
    return output;
  } else {
    // Raw structure (backward compatibility) - use legacy format
    transactions = statementData.chronologicalTransactions || [];
    summary = statementData.summary || {};
    const creditBalance = statementData.creditBalance;
    const scheduledAmount = summary.scheduledAmount;
    
    const {
      totalDue = 0,
      totalPaid = 0,
      totalOutstanding = 0,
      finalBalance = 0,
      closingBalance = 0
    } = summary;
    
    // Use closingBalance if available, otherwise finalBalance
    const finalBalanceValue = closingBalance !== 0 ? closingBalance : finalBalance;
    
    let output = '';
    
    // Transaction table section
    if (transactions.length === 0) {
      output += 'No transactions found\n';
    } else {
      // Table header
      output += 'Date       | Description              | Charge      | Payment     | Balance\n';
      output += '-----------|--------------------------|-------------|-------------|-------------\n';
      
      // Opening balance row
      const openingBalance = summary.openingBalance || 0;
      output += `           | Opening Balance          |             |             | ${formatPesos(openingBalance).padStart(11)}\n`;
      
      // Transaction rows
      transactions.forEach(txn => {
        // Handle both Date objects (raw) and date strings (optimized)
        let dateStr;
        if (txn.date instanceof Date) {
          dateStr = txn.date.toISOString().split('T')[0];
        } else if (typeof txn.date === 'string') {
          dateStr = txn.date;
        } else {
          dateStr = 'N/A';
        }
        
        const description = (txn.description || '').padEnd(21);
        const charge = txn.charge > 0 ? formatPesos(txn.charge).padStart(11) : ' '.repeat(11);
        const payment = txn.payment > 0 ? formatPesos(txn.payment).padStart(11) : ' '.repeat(11);
        const balance = formatPesos(txn.balance || 0).padStart(11);
        
        output += `${dateStr} | ${description}    | ${charge} | ${payment} | ${balance}\n`;
      });
      
      // Final balance verification
      output += `\nFinal Running Balance: $${formatPesos(finalBalanceValue)} MXN\n`;
    }
    
    // Summary section
    output += '\n📊 Summary:\n';
    if (scheduledAmount !== null && scheduledAmount !== undefined) {
      output += `Total Due: $${formatPesos(totalDue)} MXN (calculated: ${formatPesos(scheduledAmount)} × 12)\n`;
    } else {
      output += `Total Due: $${formatPesos(totalDue)} MXN\n`;
    }
    output += `Total Paid: $${formatPesos(totalPaid)} MXN\n`;
    output += `Outstanding: $${formatPesos(totalOutstanding)} MXN\n`;
    
    // Credit Balance section
    if (creditBalance) {
      const creditBalanceAmount = creditBalance.creditBalance || 0;
      const lastUpdated = creditBalance.lastUpdated;
      
      output += `\n💰 Credit Balance: $${formatPesos(creditBalanceAmount)} MXN\n`;
      if (lastUpdated) {
        const lastUpdatedStr = formatLastUpdated(lastUpdated);
        if (lastUpdatedStr !== 'N/A') {
          output += `   Last Updated: ${lastUpdatedStr}\n`;
        }
      }
    } else {
      output += '\n💰 Credit Balance: $0.00 MXN\n';
    }
    
    return output;
  }
}

