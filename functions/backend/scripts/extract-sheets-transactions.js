/**
 * Extract transactions from Sheets XLSX/CSV files
 * 
 * Reads spreadsheet data directly (much more reliable than PDF parsing)
 * Supports both XLSX and CSV formats
 * 
 * Usage:
 *   node backend/scripts/extract-sheets-transactions.js <file-path> [unit-id]
 * 
 * Example:
 *   node backend/scripts/extract-sheets-transactions.js "/path/to/unit-101-statement.xlsx" 101
 *   node backend/scripts/extract-sheets-transactions.js "/path/to/unit-101-statement.csv" 101
 */

import XLSX from 'xlsx';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import csv from 'csv-parser';

/**
 * Normalize date string to ISO format
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  // If it's already a Date object
  if (dateStr instanceof Date) {
    return dateStr.toISOString().split('T')[0];
  }
  
  // If it's a number (Excel date serial number)
  if (typeof dateStr === 'number') {
    // Excel epoch is 1900-01-01, but has a bug (treats 1900 as leap year)
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + dateStr * 86400000);
    return date.toISOString().split('T')[0];
  }
  
  // String date formats
  const str = String(dateStr).trim();
  
  // MM/DD/YYYY or DD/MM/YYYY
  const dateMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    const [, month, day, year] = dateMatch;
    // Assume MM/DD/YYYY for now (adjust if needed)
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // YYYY-MM-DD
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return str;
  }
  
  return str; // Return as-is if can't parse
}

/**
 * Parse amount to number
 */
function parseAmount(amountStr) {
  if (typeof amountStr === 'number') {
    return amountStr;
  }
  
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
 * Extract transactions from XLSX file
 */
async function extractFromXLSX(filePath) {
  console.log(`  Reading XLSX file...`);
  
  const workbook = XLSX.readFile(filePath);
  const transactions = [];
  
  // Try to find the sheet with transaction data
  // Usually named "Statement", "Transactions", or first sheet
  let sheetName = null;
  const sheetNames = workbook.SheetNames;
  
  // Look for likely sheet names
  for (const name of sheetNames) {
    const lower = name.toLowerCase();
    if (lower.includes('statement') || lower.includes('transaction') || lower.includes('activity')) {
      sheetName = name;
      break;
    }
  }
  
  // Use first sheet if no match found
  if (!sheetName && sheetNames.length > 0) {
    sheetName = sheetNames[0];
  }
  
  if (!sheetName) {
    throw new Error('No sheets found in XLSX file');
  }
  
  console.log(`  Using sheet: ${sheetName}`);
  
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null });
  
  // Find header row and column mapping
  let dateCol = null;
  let descCol = null;
  let amountCol = null;
  let balanceCol = null;
  
  // Try to identify columns from first row
  if (data.length > 0) {
    const firstRow = data[0];
    const keys = Object.keys(firstRow);
    
    for (const key of keys) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes('date') && !dateCol) dateCol = key;
      if ((keyLower.includes('description') || keyLower.includes('particulars') || keyLower.includes('memo') || keyLower.includes('detail')) && !descCol) descCol = key;
      if ((keyLower.includes('amount') || keyLower.includes('charge') || keyLower.includes('payment') || keyLower.includes('debit') || keyLower.includes('credit')) && !amountCol) amountCol = key;
      if ((keyLower.includes('balance') || keyLower.includes('running')) && !balanceCol) balanceCol = key;
    }
  }
  
  console.log(`  Column mapping: Date=${dateCol}, Description=${descCol}, Amount=${amountCol}, Balance=${balanceCol}`);
  
  // Extract transactions
  for (const row of data) {
    const date = dateCol ? normalizeDate(row[dateCol]) : null;
    const description = descCol ? String(row[descCol] || '').trim() : '';
    const amount = amountCol ? parseAmount(row[amountCol]) : 0;
    const balance = balanceCol ? parseAmount(row[balanceCol]) : null;
    
    // Skip empty rows or summary rows
    if (!date || !description || description.toLowerCase().includes('total')) {
      continue;
    }
    
    if (date && description && amount !== 0) {
      transactions.push({
        date,
        description,
        amount,
        balance
      });
    }
  }
  
  return transactions;
}

/**
 * Extract transactions from CSV file
 */
async function extractFromCSV(filePath) {
  console.log(`  Reading CSV file...`);
  
  return new Promise((resolve, reject) => {
    const transactions = [];
    let headers = null;
    let dateCol = null;
    let descCol = null;
    let amountCol = null;
    let balanceCol = null;
    
    createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
        
        // Identify columns
        for (let i = 0; i < headerList.length; i++) {
          const header = headerList[i].toLowerCase();
          if (header.includes('date') && dateCol === null) dateCol = i;
          if ((header.includes('description') || header.includes('particulars') || header.includes('memo') || header.includes('detail')) && descCol === null) descCol = i;
          if ((header.includes('amount') || header.includes('charge') || header.includes('payment') || header.includes('debit') || header.includes('credit')) && amountCol === null) amountCol = i;
          if ((header.includes('balance') || header.includes('running')) && balanceCol === null) balanceCol = i;
        }
        
        console.log(`  Column mapping: Date=${dateCol}, Description=${descCol}, Amount=${amountCol}, Balance=${balanceCol}`);
      })
      .on('data', (row) => {
        const rowArray = Object.values(row);
        const date = dateCol !== null ? normalizeDate(rowArray[dateCol]) : null;
        const description = descCol !== null ? String(rowArray[descCol] || '').trim() : '';
        const amount = amountCol !== null ? parseAmount(rowArray[amountCol]) : 0;
        const balance = balanceCol !== null ? parseAmount(rowArray[balanceCol]) : null;
        
        // Skip empty rows or summary rows
        if (!date || !description || description.toLowerCase().includes('total')) {
          return;
        }
        
        if (date && description && amount !== 0) {
          transactions.push({
            date,
            description,
            amount,
            balance
          });
        }
      })
      .on('end', () => {
        resolve(transactions);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Extract transactions from spreadsheet file (XLSX or CSV)
 */
async function extractTransactionsFromSheets(filePath, unitId = null) {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const ext = path.extname(filePath).toLowerCase();
  console.log(`\n📊 Extracting transactions from: ${path.basename(filePath)}`);
  
  let transactions = [];
  
  if (ext === '.xlsx' || ext === '.xls') {
    transactions = await extractFromXLSX(filePath);
  } else if (ext === '.csv') {
    transactions = await extractFromCSV(filePath);
  } else {
    throw new Error(`Unsupported file format: ${ext}. Supported: .xlsx, .xls, .csv`);
  }
  
  // Sort by date
  transactions.sort((a, b) => {
    if (a.date && b.date) {
      return a.date.localeCompare(b.date);
    }
    return 0;
  });
  
  // Extract unit ID from filename if not provided
  if (!unitId) {
    const filename = path.basename(filePath);
    const match = filename.match(/(\d{3})/);
    unitId = match ? match[1] : null;
  }
  
  return {
    unitId,
    filePath,
    fileType: ext,
    totalTransactions: transactions.length,
    transactions,
    finalBalance: transactions.length > 0 ? transactions[transactions.length - 1].balance : null
  };
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node extract-sheets-transactions.js <file-path> [unit-id]');
    console.error('\nExample:');
    console.error('  node extract-sheets-transactions.js "/path/to/unit-101.xlsx" 101');
    console.error('  node extract-sheets-transactions.js "/path/to/unit-101.csv" 101');
    process.exit(1);
  }
  
  const filePath = args[0];
  const unitId = args[1] || null;
  
  try {
    const result = await extractTransactionsFromSheets(filePath, unitId);
    
    console.log('\n✅ Extraction Complete');
    console.log('='.repeat(70));
    console.log(`Unit ID: ${result.unitId || 'Unknown'}`);
    console.log(`File Type: ${result.fileType}`);
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
    const outputPath = filePath.replace(/\.(xlsx|xls|csv)$/i, '_transactions.json');
    const { writeFile } = await import('fs/promises');
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
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('extract-sheets-transactions.js')) {
  main();
}

export { extractTransactionsFromSheets };
