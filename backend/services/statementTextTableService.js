/**
 * Statement Text Table Service
 * 
 * Generates plain text table output for Statement of Account
 * Matches prototype format exactly (from queryDuesPayments.js lines 1106-1186)
 */

/**
 * Format pesos amount with commas
 * COPIED EXACTLY FROM PROTOTYPE (lines 22-25)
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
 * Generate text table output for Statement of Account
 * Matches prototype format exactly (lines 1106-1186)
 * 
 * Supports both optimized structure (from new getStatementData) and raw structure (from getConsolidatedUnitData)
 * 
 * @param {Object} statementData - Data object from getStatementData service (optimized) or getConsolidatedUnitData (raw)
 * @param {Object} options - Optional formatting options
 * @returns {string} Plain text table output
 */
export function generateTextTable(statementData, options = {}) {
  // Detect structure type: optimized has lineItems, raw has chronologicalTransactions
  const isOptimized = statementData.lineItems !== undefined;
  
  let transactions;
  let summary;
  let creditBalance;
  let scheduledAmount;
  
  if (isOptimized) {
    // Optimized structure
    transactions = statementData.lineItems || [];
    summary = statementData.summary || {};
    creditBalance = statementData.creditInfo?.currentBalance || 0;
    scheduledAmount = null; // Not available in optimized structure
  } else {
    // Raw structure (backward compatibility)
    transactions = statementData.chronologicalTransactions || [];
    summary = statementData.summary || {};
    creditBalance = statementData.creditBalance;
    scheduledAmount = summary.scheduledAmount;
  }
  
  const {
    totalDue = 0,
    totalPaid = 0,
    totalOutstanding = 0,
    finalBalance = 0,
    closingBalance = 0
  } = summary;
  
  // Use closingBalance if available (optimized), otherwise finalBalance (raw)
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
  if (isOptimized) {
    // Optimized structure: creditInfo.currentBalance
    const creditBalanceAmount = statementData.creditInfo?.currentBalance || 0;
    output += `\n💰 Credit Balance: $${formatPesos(creditBalanceAmount)} MXN\n`;
  } else {
    // Raw structure: creditBalance object
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
  }
  
  return output;
}

