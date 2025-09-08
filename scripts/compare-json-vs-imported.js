#!/usr/bin/env node

/**
 * Compare JSON source vs Imported Transaction Totals
 * Compares the actual JSON file used for import vs what was imported
 */

import { initializeFirebase, printEnvironmentInfo } from './client-onboarding/utils/environment-config.js';
import fs from 'fs/promises';

const CLIENT_ID = 'MTC';
const JSON_FILE = '../MTCdata/Transactions.json';

async function compareJsonVsImported() {
  try {
    console.log('🔍 Comparing JSON source vs imported transaction totals...\n');
    
    // Initialize Firebase
    const { db } = await initializeFirebase('dev');
    printEnvironmentInfo('dev');
    
    // 1. READ JSON SOURCE FILE
    console.log('📄 Reading JSON source file...');
    const jsonContent = await fs.readFile(JSON_FILE, 'utf-8');
    const sourceTransactions = JSON.parse(jsonContent);
    
    console.log(`   Found ${sourceTransactions.length} transactions in JSON source`);
    
    // 2. ANALYZE JSON SOURCE DATA BY ACCOUNT
    const sourceAccountTotals = {
      bank: { credits: 0, debits: 0, count: 0 },
      cash: { credits: 0, debits: 0, count: 0 },
      unknown: { credits: 0, debits: 0, count: 0 }
    };
    
    sourceTransactions.forEach(txn => {
      const amount = parseFloat(txn.Amount || 0);
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
    
    console.log('\n📊 JSON SOURCE DATA TOTALS:');
    Object.entries(sourceAccountTotals).forEach(([account, totals]) => {
      if (totals.count > 0) {
        console.log(`   ${account.toUpperCase()}:`);
        console.log(`     Credits: $${totals.credits.toFixed(2)} (${(totals.credits * 100).toFixed(0)} cents)`);
        console.log(`     Debits:  $${totals.debits.toFixed(2)} (${(totals.debits * 100).toFixed(0)} cents)`);
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
    
    // 6. SAMPLE COMPARISON
    console.log('\n🔍 SAMPLE TRANSACTION COMPARISON:');
    if (sourceTransactions.length > 0 && importedTransactions.length > 0) {
      console.log('\n📄 First JSON transaction:');
      const firstSource = sourceTransactions[0];
      console.log(`   Date: ${firstSource.Date}`);
      console.log(`   Vendor: ${firstSource.Vendor}`);
      console.log(`   Amount: ${firstSource.Amount}`);
      console.log(`   Account: ${firstSource.Account}`);
      console.log(`   Category: ${firstSource.Category}`);
      
      console.log('\n📄 First imported transaction:');
      const firstImported = importedTransactions[0];
      console.log(`   Date: ${firstImported.date?.toDate ? firstImported.date.toDate().toISOString() : firstImported.date}`);
      console.log(`   Vendor: ${firstImported.vendorName || firstImported.vendorId}`);
      console.log(`   Amount: ${firstImported.amount} cents ($${(firstImported.amount / 100).toFixed(2)})`);
      console.log(`   Account: ${firstImported.accountId} (${firstImported.accountType})`);
      console.log(`   Category: ${firstImported.categoryName || firstImported.categoryId}`);
    }
    
    console.log('\n🎯 SUMMARY:');
    const totalSourceCount = sourceAccountTotals.bank.count + sourceAccountTotals.cash.count + sourceAccountTotals.unknown.count;
    const totalImportedCount = importedAccountTotals.bank.count + importedAccountTotals.cash.count + importedAccountTotals.unknown.count;
    
    console.log(`Total transactions: JSON Source ${totalSourceCount} vs Imported ${totalImportedCount} (${totalImportedCount - totalSourceCount >= 0 ? '+' : ''}${totalImportedCount - totalSourceCount})`);
    
    if (totalSourceCount === totalImportedCount && sourceAccountTotals.unknown.count === 0) {
      console.log('✅ Transaction counts match and all accounts properly mapped');
    } else if (totalSourceCount !== totalImportedCount) {
      console.log(`❌ Transaction count mismatch: ${Math.abs(totalSourceCount - totalImportedCount)} transactions difference`);
    } else if (sourceAccountTotals.unknown.count > 0) {
      console.log(`❌ Account mapping issue: ${sourceAccountTotals.unknown.count} transactions with unknown accounts`);
    }
    
  } catch (error) {
    console.error('❌ Error comparing data:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the comparison
compareJsonVsImported();