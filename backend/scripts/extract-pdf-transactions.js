/**
 * Extract transactions from PDF statements
 * 
 * Supports both Sheets-generated and SAMS-generated PDF statements
 * Extracts: Date, Description, Amount, Running Balance
 * 
 * Usage:
 *   node backend/scripts/extract-pdf-transactions.js <pdf-path> [unit-id]
 * 
 * Example:
 *   node backend/scripts/extract-pdf-transactions.js "/Users/michael/Projects/SAMS-Docs/docs/AVII-Reconciliation/Sheets-Statements/Account Statement for 101 - Dec 2025.pdf" 101
 */

import { PdfDocument } from '@pomgui/pdf-tables-parser';
import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Normalize date string to ISO format
 * Handles various date formats from PDFs
 */
function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  // Remove extra whitespace
  dateStr = dateStr.trim();
  
  // Try common date formats
  // Format: MM/DD/YYYY or DD/MM/YYYY
  const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    const [, month, day, year] = dateMatch;
    // Assume MM/DD/YYYY for now (adjust if needed)
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return dateStr; // Return as-is if can't parse
}

/**
 * Parse amount string to number
 * Handles currency symbols, commas, parentheses (for negatives)
 */
function parseAmount(amountStr) {
  if (!amountStr || typeof amountStr !== 'string') return 0;
  
  // Remove currency symbols and whitespace
  let cleaned = amountStr.replace(/[$,\s]/g, '');
  
  // Handle parentheses for negative (accounting format)
  const isNegative = cleaned.includes('(') || cleaned.startsWith('-');
  cleaned = cleaned.replace(/[()]/g, '');
  
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : (isNegative ? -amount : amount);
}

/**
 * Extract transactions from PDF table data
 * Identifies transaction rows based on table structure
 */
function extractTransactionsFromTable(tableData, pdfType = 'sheets') {
  const transactions = [];
  
  if (!tableData || !Array.isArray(tableData.data)) {
    return transactions;
  }
  
  const rows = tableData.data;
  
  // Find header row to identify column indices
  let headerRowIndex = -1;
  let dateCol = -1;
  let descCol = -1;
  let amountCol = -1;
  let balanceCol = -1;
  
  // Look for header row (usually first few rows)
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    
    const rowText = row.join(' ').toLowerCase();
    
    // Identify columns based on headers
    row.forEach((cell, idx) => {
      const cellLower = String(cell).toLowerCase();
      if (cellLower.includes('date') && dateCol === -1) dateCol = idx;
      if ((cellLower.includes('description') || cellLower.includes('particulars') || cellLower.includes('memo')) && descCol === -1) descCol = idx;
      if ((cellLower.includes('amount') || cellLower.includes('charge') || cellLower.includes('payment')) && amountCol === -1) amountCol = idx;
      if ((cellLower.includes('balance') || cellLower.includes('running')) && balanceCol === -1) balanceCol = idx;
    });
    
    if (dateCol !== -1 && descCol !== -1) {
      headerRowIndex = i;
      break;
    }
  }
  
  // If no header found, try to infer from structure
  if (headerRowIndex === -1) {
    // Assume first row is header, or try common patterns
    if (rows.length > 0 && Array.isArray(rows[0])) {
      // Try to infer columns from first data row
      const firstRow = rows[0];
      if (firstRow.length >= 3) {
        dateCol = 0;
        descCol = 1;
        amountCol = 2;
        if (firstRow.length > 3) balanceCol = 3;
      }
    }
  }
  
  // Extract transaction rows (skip header)
  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length < 3) continue;
    
    // Skip empty rows or summary rows
    const rowText = row.join(' ').toLowerCase();
    if (rowText.includes('total') || rowText.includes('balance forward') || rowText.trim() === '') {
      continue;
    }
    
    const date = dateCol >= 0 && dateCol < row.length ? normalizeDate(String(row[dateCol])) : null;
    const description = descCol >= 0 && descCol < row.length ? String(row[descCol]).trim() : '';
    const amount = amountCol >= 0 && amountCol < row.length ? parseAmount(String(row[amountCol])) : 0;
    const balance = balanceCol >= 0 && balanceCol < row.length ? parseAmount(String(row[balanceCol])) : null;
    
    // Only add if we have essential data
    if (date && description && amount !== 0) {
      transactions.push({
        date,
        description,
        amount,
        balance,
        rowIndex: i
      });
    }
  }
  
  return transactions;
}

/**
 * Extract transactions from PDF
 */
async function extractTransactionsFromPDF(pdfPath, unitId = null) {
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }
  
  console.log(`\n📄 Extracting transactions from: ${path.basename(pdfPath)}`);
  
  const pdf = new PdfDocument();
  await pdf.load(pdfPath);
  
  const allTransactions = [];
  
  // Process each page
  for (const page of pdf.pages || []) {
    console.log(`  Processing page ${page.pageNumber}...`);
    
    // Process each table on the page
    for (const table of page.tables || []) {
      console.log(`    Found table with ${table.numrows} rows, ${table.numcols} columns`);
      
      // Determine PDF type from filename or content
      const pdfType = pdfPath.includes('Sheets') ? 'sheets' : 'sams';
      
      const transactions = extractTransactionsFromTable(table, pdfType);
      console.log(`    Extracted ${transactions.length} transactions`);
      
      allTransactions.push(...transactions);
    }
  }
  
  // Sort by date
  allTransactions.sort((a, b) => {
    if (a.date && b.date) {
      return a.date.localeCompare(b.date);
    }
    return 0;
  });
  
  return {
    unitId: unitId || extractUnitIdFromPath(pdfPath),
    pdfPath,
    pdfType: pdfPath.includes('Sheets') ? 'sheets' : 'sams',
    totalTransactions: allTransactions.length,
    transactions: allTransactions,
    finalBalance: allTransactions.length > 0 ? allTransactions[allTransactions.length - 1].balance : null
  };
}

/**
 * Extract unit ID from PDF path or filename
 */
function extractUnitIdFromPath(pdfPath) {
  const filename = path.basename(pdfPath);
  // Try to extract unit number from filename (e.g., "Account Statement for 101" or "101_Statement")
  const match = filename.match(/(\d{3})/);
  return match ? match[1] : null;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node extract-pdf-transactions.js <pdf-path> [unit-id]');
    console.error('\nExample:');
    console.error('  node extract-pdf-transactions.js "/path/to/statement.pdf" 101');
    process.exit(1);
  }
  
  const pdfPath = args[0];
  const unitId = args[1] || null;
  
  try {
    const result = await extractTransactionsFromPDF(pdfPath, unitId);
    
    console.log('\n✅ Extraction Complete');
    console.log('='.repeat(70));
    console.log(`Unit ID: ${result.unitId || 'Unknown'}`);
    console.log(`PDF Type: ${result.pdfType}`);
    console.log(`Total Transactions: ${result.totalTransactions}`);
    console.log(`Final Balance: ${result.finalBalance !== null ? `$${result.finalBalance.toFixed(2)}` : 'N/A'}`);
    
    // Output first few transactions as sample
    if (result.transactions.length > 0) {
      console.log('\n📋 Sample Transactions (first 5):');
      console.log('-'.repeat(70));
      result.transactions.slice(0, 5).forEach((txn, idx) => {
        console.log(`${idx + 1}. ${txn.date} | ${txn.description.substring(0, 40).padEnd(40)} | $${txn.amount.toFixed(2)} | ${txn.balance !== null ? `$${txn.balance.toFixed(2)}` : 'N/A'}`);
      });
    }
    
    // Save to JSON file
    const outputPath = pdfPath.replace(/\.pdf$/i, '_transactions.json');
    await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n💾 Results saved to: ${outputPath}`);
    
    return result;
  } catch (error) {
    console.error('\n❌ Error extracting transactions:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { extractTransactionsFromPDF, extractTransactionsFromTable };
