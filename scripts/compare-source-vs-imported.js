#!/usr/bin/env node

/**
 * Compare Source CSV vs Imported Transaction Totals
 * Compares sum of credits/debits by account to verify import integrity
 */

import { initializeFirebase, printEnvironmentInfo } from './client-onboarding/utils/environment-config.js';
import fs from 'fs/promises';

const CLIENT_ID = 'MTC';
const SOURCE_FILE = '../MTCdata/MTCexport.csv';

async function compareSourceVsImported() {
  try {
    console.log('🔍 Comparing source CSV vs imported transaction totals...\n');
    
    // Initialize Firebase
    const { db } = await initializeFirebase('dev');
    printEnvironmentInfo('dev');
    
    // 1. READ SOURCE CSV FILE
    console.log('📄 Reading source CSV file...');
    const csvContent = await fs.readFile(SOURCE_FILE, 'utf-8');
    const lines = csvContent.split('\n');
    
    // For cleaned export, header should be on first line
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    console.log(`   Headers: ${headers.join(', ')}`);
    console.log(`   Total data lines: ${lines.length - 1}`);
    
    // Parse source data starting from row 1 (after header)
    const sourceTransactions = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Proper CSV parsing that handles quoted fields
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim()); // Add the last value
      
      if (values.length < headers.length) continue;
      
      const transaction = {};
      headers.forEach((header, index) => {
        transaction[header] = values[index] || '';
      });
      
      // Skip empty transactions
      if (!transaction.Date || !transaction.Amount) continue;
      
      sourceTransactions.push(transaction);
    }
    
    console.log(`   Parsed ${sourceTransactions.length} source transactions`);
    
    // 2. ANALYZE SOURCE DATA BY ACCOUNT
    const sourceAccountTotals = {
      bank: { credits: 0, debits: 0, count: 0 },
      cash: { credits: 0, debits: 0, count: 0 },
      unknown: { credits: 0, debits: 0, count: 0 }
    };
    
    sourceTransactions.forEach(txn => {
      // Parse amount - remove currency symbols, commas, parentheses
      let amountStr = (txn.Amount || '').replace(/[\$,\s]/g, '');
      let amount = 0;
      
      // Handle negative amounts in parentheses like "($3,167)"
      if (amountStr.includes('(') && amountStr.includes(')')) {
        amountStr = amountStr.replace(/[()]/g, '');
        amount = -parseFloat(amountStr);
      } else {
        amount = parseFloat(amountStr);
      }
      
      if (isNaN(amount)) amount = 0;
      
      const account = (txn.Account || '').trim();
      
      let accountType = 'unknown';
      if (account === 'MTC Bank') {
        accountType = 'bank';
      } else if (account === 'Cash Account') {
        accountType = 'cash';
      }
      
      sourceAccountTotals[accountType].count++;
      
      if (amount >= 0) {
        sourceAccountTotals[accountType].credits += amount;
      } else {
        sourceAccountTotals[accountType].debits += Math.abs(amount);
      }
    });
    
    console.log('\n📊 SOURCE DATA TOTALS:');
    Object.entries(sourceAccountTotals).forEach(([account, totals]) => {
      if (totals.count > 0) {
        console.log(`   ${account.toUpperCase()}:`);
        console.log(`     Credits: $${totals.credits.toFixed(2)} (${totals.credits * 100} cents)`);
        console.log(`     Debits:  $${totals.debits.toFixed(2)} (${totals.debits * 100} cents)`);
        console.log(`     Net:     $${(totals.credits - totals.debits).toFixed(2)}`);
        console.log(`     Count:   ${totals.count} transactions`);
      }
    });
    
    // 3. GET IMPORTED DATA FROM FIREBASE
    console.log('\n🔄 Fetching imported transactions from Firebase...');
    const transactionsRef = db.collection('clients').doc(CLIENT_ID).collection('transactions');
    const querySnapshot = await transactionsRef.get();
    
    const importedTransactions = [];
    querySnapshot.docs.forEach(doc => {
      importedTransactions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`   Found ${importedTransactions.length} imported transactions`);
    
    // 4. ANALYZE IMPORTED DATA BY ACCOUNT
    const importedAccountTotals = {
      bank: { credits: 0, debits: 0, count: 0 },
      cash: { credits: 0, debits: 0, count: 0 },
      unknown: { credits: 0, debits: 0, count: 0 }
    };
    
    importedTransactions.forEach(txn => {
      const amount = txn.amount || 0; // Already in cents
      const accountType = txn.accountType || 'unknown';
      
      importedAccountTotals[accountType].count++;
      
      if (amount >= 0) {
        importedAccountTotals[accountType].credits += amount;
      } else {
        importedAccountTotals[accountType].debits += Math.abs(amount);
      }
    });
    
    console.log('\n📊 IMPORTED DATA TOTALS:');
    Object.entries(importedAccountTotals).forEach(([account, totals]) => {
      if (totals.count > 0) {
        console.log(`   ${account.toUpperCase()}:`);
        console.log(`     Credits: $${(totals.credits / 100).toFixed(2)} (${totals.credits} cents)`);
        console.log(`     Debits:  $${(totals.debits / 100).toFixed(2)} (${totals.debits} cents)`);
        console.log(`     Net:     $${((totals.credits - totals.debits) / 100).toFixed(2)}`);
        console.log(`     Count:   ${totals.count} transactions`);
      }
    });
    
    // 5. COMPARE TOTALS
    console.log('\n🔍 COMPARISON ANALYSIS:');
    console.log('=' .repeat(60));
    
    ['bank', 'cash'].forEach(accountType => {
      const source = sourceAccountTotals[accountType];
      const imported = importedAccountTotals[accountType];
      
      if (source.count > 0 || imported.count > 0) {
        console.log(`\n${accountType.toUpperCase()} ACCOUNT:`);
        
        // Count comparison
        const countDiff = imported.count - source.count;
        console.log(`   Transaction Count: Source ${source.count} vs Imported ${imported.count} (${countDiff >= 0 ? '+' : ''}${countDiff})`);
        
        // Credits comparison (convert source to cents)
        const sourceCreditsCents = source.credits * 100;
        const creditsDiff = imported.credits - sourceCreditsCents;
        console.log(`   Credits: Source $${source.credits.toFixed(2)} vs Imported $${(imported.credits / 100).toFixed(2)} (${creditsDiff >= 0 ? '+' : ''}$${(creditsDiff / 100).toFixed(2)})`);
        
        // Debits comparison (convert source to cents)
        const sourceDebitsCents = source.debits * 100;
        const debitsDiff = imported.debits - sourceDebitsCents;
        console.log(`   Debits:  Source $${source.debits.toFixed(2)} vs Imported $${(imported.debits / 100).toFixed(2)} (${debitsDiff >= 0 ? '+' : ''}$${(debitsDiff / 100).toFixed(2)})`);
        
        // Net comparison
        const sourceNet = source.credits - source.debits;
        const importedNet = (imported.credits - imported.debits) / 100;
        const netDiff = importedNet - sourceNet;
        console.log(`   Net:     Source $${sourceNet.toFixed(2)} vs Imported $${importedNet.toFixed(2)} (${netDiff >= 0 ? '+' : ''}$${netDiff.toFixed(2)})`);
        
        // Assessment
        if (Math.abs(creditsDiff) < 100 && Math.abs(debitsDiff) < 100 && countDiff === 0) {
          console.log(`   ✅ MATCH: Import appears correct for ${accountType}`);
        } else {
          console.log(`   ❌ MISMATCH: Import discrepancy detected for ${accountType}`);
        }
      }
    });
    
    console.log('\n🎯 SUMMARY:');
    console.log('If credits/debits match but balances don\'t, the issue is likely:');
    console.log('1. Manual balance adjustments not captured as transactions');
    console.log('2. Incorrect starting balances in year-end snapshot');
    console.log('3. Different calculation methods between systems');
    
  } catch (error) {
    console.error('❌ Error comparing data:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the comparison
compareSourceVsImported();