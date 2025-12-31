#!/usr/bin/env node
/**
 * EMERGENCY SCRIPT: AVII Water Bills Payment Status
 * 
 * Shows each unit's quarterly water bill amount and paid status.
 * Cross-references with transactions to identify payments that exist
 * but aren't marked as paid in the water bills system.
 * 
 * Usage: 
 *   Development: node functions/backend/scripts/emergency-avii-water-bills-status.js
 *   Production:  node functions/backend/scripts/emergency-avii-water-bills-status.js --prod
 * 
 * For production, ensure you're authenticated with gcloud ADC:
 *   gcloud auth application-default login
 *   gcloud config set project sams-sandyland-prod
 * 
 * The script will:
 * 1. List all quarterly bills for AVII (fiscal year 2026)
 * 2. For each unit, show bill amount, paid amount, due amount, and status
 * 3. Cross-reference payment transaction IDs with actual transactions
 * 4. Identify unlinked water transactions that might be payments
 * 5. Flag missing transaction references
 * 6. **CRITICAL**: Check credit balance history for water-related entries
 * 7. **CRITICAL**: Identify credit usage that isn't linked to water bill payments
 * 
 * This addresses the critical issue where credit balance was used to pay water bills
 * but the payments aren't recorded in the water bills system, causing credit balance
 * reconciliation problems.
 */

import admin from 'firebase-admin';
import { existsSync } from 'fs';
import { centavosToPesos } from '../../shared/utils/currencyUtils.js';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const CLIENT_ID = 'AVII';
const FISCAL_YEAR = 2026;

// Check for --prod flag to use production with ADC
const useProduction = process.argv.includes('--prod');
const productionProjectId = 'sams-sandyland-prod';

async function initializeFirebase() {
  if (useProduction) {
    // Use Application Default Credentials for production
    console.log(`🌍 Environment: PRODUCTION`);
    console.log(`🔥 Firebase Project: ${productionProjectId}`);
    console.log(`🔑 Using Application Default Credentials (ADC)`);
    console.log(`   Run 'gcloud auth application-default login' if not authenticated\n`);
    
    // Clear GOOGLE_APPLICATION_CREDENTIALS if it's set to placeholder/invalid path
    // This ensures applicationDefault() uses ADC instead of trying to read a file
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
        (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') || 
         !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
      console.log(`⚠️  Clearing invalid GOOGLE_APPLICATION_CREDENTIALS env var`);
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: productionProjectId
      });
    }
    
    return admin.firestore();
  } else {
    // Use service account key for development (via getDb from firebase.js)
    const { getDb } = await import('../firebase.js');
    return await getDb();
  }
}

async function main() {
  console.log('🚨 EMERGENCY: AVII Water Bills Payment Status Report\n');
  console.log('='.repeat(80));
  
  const db = await initializeFirebase();
  
  // 1. Get all quarterly bills for AVII
  const billsRef = db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills');
  
  const billsSnapshot = await billsRef.get();
  
  // Filter for quarterly bills (YYYY-Q# format)
  const quarterlyBills = [];
  billsSnapshot.docs.forEach(doc => {
    const billId = doc.id;
    const data = doc.data();
    
    // Match quarterly format: 2026-Q1, 2026-Q2, etc.
    if (/^\d{4}-Q[1-4]$/.test(billId) && data.fiscalYear === FISCAL_YEAR) {
      quarterlyBills.push({
        billId,
        ...data
      });
    }
  });
  
  // Sort by quarter
  quarterlyBills.sort((a, b) => {
    const qA = parseInt(a.billId.split('-Q')[1]);
    const qB = parseInt(b.billId.split('-Q')[1]);
    return qA - qB;
  });
  
  console.log(`\n📊 Found ${quarterlyBills.length} quarterly bill(s) for fiscal year ${FISCAL_YEAR}\n`);
  
  if (quarterlyBills.length === 0) {
    console.log('⚠️  No quarterly bills found. Check if bills have been generated.');
    process.exit(1);
  }
  
  // 2. Get all transactions for AVII to cross-reference
  const transactionsRef = db.collection('clients').doc(CLIENT_ID)
    .collection('transactions');
  
  const transactionsSnapshot = await transactionsRef.get();
  const transactionsMap = new Map();
  
  transactionsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    transactionsMap.set(doc.id, {
      id: doc.id,
      amount: data.amount || 0,
      date: data.date,
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      unitId: data.unitId,
      allocations: data.allocations || [],
      notes: data.notes || ''
    });
  });
  
  console.log(`📝 Loaded ${transactionsMap.size} transactions for cross-reference\n`);
  
  // 2b. Get credit balance data for all units
  const creditBalancesRef = db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances');
  
  const creditBalancesDoc = await creditBalancesRef.get();
  const creditBalancesData = creditBalancesDoc.exists ? creditBalancesDoc.data() : {};
  
  console.log(`💰 Loaded credit balance data for ${Object.keys(creditBalancesData).length} unit(s)\n`);
  
  // 3. Process each quarterly bill
  const allUnitStatuses = [];
  
  for (const bill of quarterlyBills) {
    const billId = bill.billId;
    const quarter = billId.split('-Q')[1];
    const units = bill.bills?.units || {};
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`QUARTER Q${quarter} (${billId})`);
    console.log(`Due Date: ${bill.dueDate || 'N/A'}`);
    console.log(`Bill Date: ${bill.billDate || 'N/A'}`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Get all unit IDs and sort them
    const unitIds = Object.keys(units).sort();
    
    for (const unitId of unitIds) {
      const unitBill = units[unitId];
      
      // Extract bill data (all amounts in centavos)
      const totalAmount = unitBill.totalAmount || 0;
      const paidAmount = unitBill.paidAmount || 0;
      const basePaid = unitBill.basePaid || 0;
      const penaltyPaid = unitBill.penaltyPaid || 0;
      const status = unitBill.status || 'unpaid';
      const payments = unitBill.payments || [];
      
      // Convert to pesos for display
      const totalPesos = centavosToPesos(totalAmount);
      const paidPesos = centavosToPesos(paidAmount);
      const basePaidPesos = centavosToPesos(basePaid);
      const penaltyPaidPesos = centavosToPesos(penaltyPaid);
      const duePesos = totalPesos - paidPesos;
      
      // Check payment transactions
      const paymentTransactionIds = [];
      const missingTransactions = [];
      
      for (const payment of payments) {
        const txnId = payment.transactionId;
        if (txnId) {
          paymentTransactionIds.push(txnId);
          if (!transactionsMap.has(txnId)) {
            missingTransactions.push(txnId);
          }
        }
      }
      
      // Check for water-related transactions that might not be linked
      const waterTransactions = [];
      transactionsMap.forEach((txn, txnId) => {
        if (txn.unitId === unitId && 
            (txn.categoryId === 'water-consumption' || 
             txn.categoryName?.toLowerCase().includes('water'))) {
          // Check if this transaction is allocated to this quarter
          const hasWaterAllocation = txn.allocations?.some(alloc => {
            return alloc.type === 'water_consumption' || 
                   alloc.type === 'water_penalty' ||
                   alloc.targetId?.includes('water') ||
                   alloc.targetName?.toLowerCase().includes('water');
          });
          
          if (hasWaterAllocation && !paymentTransactionIds.includes(txnId)) {
            const txnDate = txn.date?.toDate ? txn.date.toDate().toISOString().split('T')[0] : 
                           (txn.date?.toString() || 'no date');
            waterTransactions.push({
              id: txnId,
              amount: centavosToPesos(txn.amount),
              date: txnDate,
              notes: txn.notes
            });
          }
        }
      });
      
      // Check credit balance history for water-related entries
      const unitCreditData = creditBalancesData[unitId];
      const creditHistory = unitCreditData?.history || [];
      const waterCreditEntries = [];
      let totalCreditUsedForWater = 0; // in centavos
      
      // Helper function to safely parse dates
      const safeParseDate = (dateValue) => {
        if (!dateValue) return null;
        try {
          // Handle Firestore Timestamp objects
          if (dateValue.toDate && typeof dateValue.toDate === 'function') {
            return dateValue.toDate();
          }
          // Handle string or number dates
          const date = new Date(dateValue);
          // Check if date is valid
          if (isNaN(date.getTime())) {
            return null;
          }
          return date;
        } catch (error) {
          return null;
        }
      };
      
      // Also check for credit entries around the bill due date that might be related
      const billDueDate = safeParseDate(bill.dueDate);
      const billDate = safeParseDate(bill.billDate);
      
      // Get the months included in this quarterly bill
      const readingsIncluded = bill.readingsIncluded || [];
      const billMonths = readingsIncluded.map(r => {
        // Extract month from reading ID (e.g., "2026-00" = July, "2026-01" = August)
        const monthMatch = r.docId?.match(/(\d{4})-(\d{2})/);
        if (monthMatch) {
          const year = parseInt(monthMatch[1]);
          const month = parseInt(monthMatch[2]);
          // Fiscal year 2026 starts July 2025, so month 0 = July 2025
          return { year, month, label: r.label || `Month ${month}` };
        }
        return null;
      }).filter(Boolean);
      
      for (const entry of creditHistory) {
        const entryDate = safeParseDate(entry.timestamp || entry.date);
        
        // Check if entry is water-related
        const isWaterRelated = entry.notes?.toLowerCase().includes('water') ||
                              entry.description?.toLowerCase().includes('water') ||
                              entry.source === 'waterBills' ||
                              entry.source === 'water';
        
        // Check if entry is near the bill date (within 90 days) and credit was used
        const isNearBillDate = entryDate && billDueDate && 
                              !isNaN(entryDate.getTime()) && !isNaN(billDueDate.getTime()) &&
                              Math.abs(entryDate - billDueDate) < (90 * 24 * 60 * 60 * 1000);
        
        // Check if entry date falls within the bill's month range
        let isInBillPeriod = false;
        if (entryDate && !isNaN(entryDate.getTime()) && billMonths.length > 0) {
          const entryYear = entryDate.getFullYear();
          const entryMonth = entryDate.getMonth() + 1; // JavaScript months are 0-indexed
          
          // Check if entry is in any of the bill's months
          // For fiscal year 2026: month 0 = July 2025 (month 7), month 1 = August 2025 (month 8), etc.
          for (const billMonth of billMonths) {
            const expectedCalendarMonth = billMonth.month + 7; // Fiscal month 0 = calendar month 7 (July)
            const expectedYear = billMonth.year - 1; // Fiscal year 2026 = calendar year 2025 for first 6 months
            
            if (entryYear === expectedYear && entryMonth === expectedCalendarMonth) {
              isInBillPeriod = true;
              break;
            }
          }
        }
        
        // Check if credit amount matches any portion of the bill
        const creditAmountPesos = entry.amount < 0 ? centavosToPesos(Math.abs(entry.amount)) : 0;
        const amountMatchesBill = creditAmountPesos > 0 && (
          Math.abs(creditAmountPesos - totalPesos) < 0.01 || // Exact match
          creditAmountPesos > totalPesos * 0.5 || // At least 50% of bill
          totalPesos - creditAmountPesos < 500 // Within $500 of bill
        );
        
        // Include if: (1) explicitly water-related OR (2) credit used near bill date OR (3) in bill period OR (4) amount matches bill
        if (entry.amount < 0 && (isWaterRelated || isNearBillDate || isInBillPeriod || amountMatchesBill)) {
          // Negative amount = credit used
          const creditUsedPesos = centavosToPesos(Math.abs(entry.amount));
          totalCreditUsedForWater += Math.abs(entry.amount);
          
          // Check if this credit usage is linked to a water bill payment
          const linkedToBill = paymentTransactionIds.includes(entry.transactionId || '');
          
          // Get transaction details if available
          const txn = entry.transactionId ? transactionsMap.get(entry.transactionId) : null;
          const txnAmount = txn ? centavosToPesos(txn.amount) : null;
          const txnDate = txn?.date?.toDate ? txn.date.toDate().toISOString().split('T')[0] : 
                         (txn?.date?.toString() || null);
          
          // Check if transaction has water allocations
          const hasWaterAllocation = txn?.allocations?.some(alloc => 
            alloc.type === 'water_consumption' || 
            alloc.type === 'water_penalty' ||
            alloc.targetId?.includes('water') ||
            alloc.targetName?.toLowerCase().includes('water')
          );
          
          // Safely format date
          let formattedDate = 'no date';
          if (entryDate && !isNaN(entryDate.getTime())) {
            try {
              formattedDate = entryDate.toISOString().split('T')[0];
            } catch (error) {
              formattedDate = entry.timestamp?.toString() || entry.date?.toString() || 'no date';
            }
          }
          
          waterCreditEntries.push({
            transactionId: entry.transactionId || 'none',
            amount: creditUsedPesos,
            date: formattedDate,
            notes: entry.notes || entry.description || 'no notes',
            linkedToBill,
            isWaterRelated,
            isNearBillDate,
            isInBillPeriod,
            amountMatchesBill,
            entry,
            transactionDetails: txn ? {
              exists: true,
              amount: txnAmount,
              date: txnDate,
              hasWaterAllocation,
              categoryId: txn.categoryId,
              categoryName: txn.categoryName,
              notes: txn.notes
            } : { exists: false }
          });
        }
      }
      
      // Calculate current credit balance
      const currentCreditBalance = unitCreditData ? getCreditBalance(unitCreditData) : 0;
      const currentCreditBalancePesos = centavosToPesos(currentCreditBalance);
      
      // Status indicator
      let statusIcon = '❌';
      if (status === 'paid') statusIcon = '✅';
      else if (status === 'partial') statusIcon = '⚠️';
      
      // Build status line
      const statusLine = {
        quarter: `Q${quarter}`,
        unitId,
        billAmount: totalPesos,
        paidAmount: paidPesos,
        dueAmount: duePesos,
        status,
        statusIcon,
        paymentCount: payments.length,
        transactionIds: paymentTransactionIds,
        missingTransactions: missingTransactions.length > 0 ? missingTransactions : null,
        unlinkedTransactions: waterTransactions.length > 0 ? waterTransactions : null,
        creditUsedForWater: centavosToPesos(totalCreditUsedForWater),
        waterCreditEntries: waterCreditEntries.length,
        unlinkedCreditEntries: waterCreditEntries.filter(e => !e.linkedToBill).length,
        currentCreditBalance: currentCreditBalancePesos
      };
      
      allUnitStatuses.push(statusLine);
      
      // Print unit status
      console.log(`Unit ${unitId}:`);
      console.log(`  Bill Amount:    $${totalPesos.toFixed(2)}`);
      console.log(`  Paid Amount:    $${paidPesos.toFixed(2)} (Base: $${basePaidPesos.toFixed(2)}, Penalty: $${penaltyPaidPesos.toFixed(2)})`);
      console.log(`  Due Amount:     $${duePesos.toFixed(2)}`);
      console.log(`  Status:         ${statusIcon} ${status.toUpperCase()}`);
      console.log(`  Payments:       ${payments.length} payment(s) recorded`);
      
      if (paymentTransactionIds.length > 0) {
        console.log(`  Transaction IDs: ${paymentTransactionIds.join(', ')}`);
        
        // Verify each transaction exists
        for (const txnId of paymentTransactionIds) {
          const txn = transactionsMap.get(txnId);
          if (txn) {
            const txnAmount = centavosToPesos(txn.amount);
            const txnDate = txn.date?.toDate ? txn.date.toDate().toISOString().split('T')[0] : 
                           (txn.date?.toString() || 'no date');
            console.log(`    ✓ ${txnId}: $${txnAmount.toFixed(2)} (${txnDate})`);
          } else {
            console.log(`    ✗ ${txnId}: MISSING TRANSACTION (referenced but not found)`);
          }
        }
      } else {
        console.log(`  Transaction IDs: NONE (no transaction links found)`);
      }
      
      // Show unlinked transactions
      if (waterTransactions.length > 0) {
        console.log(`  ⚠️  UNLINKED TRANSACTIONS (water payments not linked to this bill):`);
        waterTransactions.forEach(txn => {
          console.log(`    - ${txn.id}: $${txn.amount.toFixed(2)} (${txn.date || 'no date'})`);
          if (txn.notes) {
            console.log(`      Notes: ${txn.notes.substring(0, 100)}${txn.notes.length > 100 ? '...' : ''}`);
          }
        });
      }
      
      // Show missing transactions
      if (missingTransactions.length > 0) {
        console.log(`  ❌ MISSING TRANSACTIONS (referenced but not found in transactions collection):`);
        missingTransactions.forEach(txnId => {
          console.log(`    - ${txnId}`);
        });
      }
      
      // Show credit balance information
      console.log(`  💰 Credit Balance: $${currentCreditBalancePesos.toFixed(2)}`);
      
      if (waterCreditEntries.length > 0) {
        console.log(`  💳 Credit Used for Water: $${centavosToPesos(totalCreditUsedForWater).toFixed(2)} (${waterCreditEntries.length} entry/entries)`);
        
        const unlinkedCredit = waterCreditEntries.filter(e => !e.linkedToBill);
        if (unlinkedCredit.length > 0) {
          console.log(`  ⚠️  UNLINKED CREDIT USAGE (credit used but not linked to water bill payments):`);
          unlinkedCredit.forEach(entry => {
            console.log(`    ┌─ Credit Entry Details:`);
            console.log(`    │  Transaction ID: ${entry.transactionId || 'none'}`);
            console.log(`    │  Credit Amount: $${entry.amount.toFixed(2)}`);
            console.log(`    │  Entry Date: ${entry.date}`);
            console.log(`    │  Explicitly Water-Related: ${entry.isWaterRelated ? 'Yes' : 'No'}`);
            console.log(`    │  Near Bill Date: ${entry.isNearBillDate ? 'Yes' : 'No'}`);
            console.log(`    │  In Bill Period: ${entry.isInBillPeriod ? 'Yes' : 'No'}`);
            console.log(`    │  Amount Matches Bill: ${entry.amountMatchesBill ? 'Yes' : 'No'}`);
            
            if (entry.notes && entry.notes !== 'no notes') {
              console.log(`    │  Notes: ${entry.notes.substring(0, 100)}${entry.notes.length > 100 ? '...' : ''}`);
            }
            
            if (entry.transactionDetails.exists) {
              const txn = entry.transactionDetails;
              console.log(`    ├─ Transaction Details:`);
              console.log(`    │  Transaction Amount: $${txn.amount.toFixed(2)}`);
              console.log(`    │  Transaction Date: ${txn.date || 'no date'}`);
              console.log(`    │  Category: ${txn.categoryName || txn.categoryId || 'unknown'}`);
              console.log(`    │  Has Water Allocation: ${txn.hasWaterAllocation ? 'Yes' : 'No'}`);
              if (txn.notes) {
                console.log(`    │  Transaction Notes: ${txn.notes.substring(0, 100)}${txn.notes.length > 100 ? '...' : ''}`);
              }
              
              // Compare amounts
              const creditAmount = entry.amount;
              const txnAmount = txn.amount;
              const billAmount = totalPesos;
              
              console.log(`    ├─ Amount Analysis:`);
              console.log(`    │  Credit Used: $${creditAmount.toFixed(2)}`);
              console.log(`    │  Transaction Amount: $${txnAmount.toFixed(2)}`);
              console.log(`    │  Bill Amount: $${billAmount.toFixed(2)}`);
              
              if (Math.abs(txnAmount - billAmount) < 0.01) {
                console.log(`    │  ⚠️  Transaction amount matches bill amount - likely paid full bill!`);
              } else if (txnAmount > billAmount) {
                console.log(`    │  ⚠️  Transaction amount exceeds bill amount - may have paid multiple bills`);
              } else if (Math.abs(creditAmount - billAmount) < 0.01) {
                console.log(`    │  ⚠️  Credit amount matches bill amount - credit likely paid full bill!`);
              } else if (creditAmount < billAmount && creditAmount + txnAmount >= billAmount) {
                console.log(`    │  ⚠️  Credit + Transaction = $${(creditAmount + txnAmount).toFixed(2)} (covers bill)`);
              }
            } else {
              console.log(`    └─ Transaction: NOT FOUND (transaction ID: ${entry.transactionId || 'none'})`);
            }
            console.log(`    └─────────────────────────────────────────────────────────`);
          });
        }
      } else {
        console.log(`  💳 Credit Used for Water: $0.00 (no water-related credit entries found)`);
      }
      
      console.log('');
    }
  }
  
  // 4. Summary table
  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY TABLE');
  console.log(`${'='.repeat(80)}\n`);
  
  console.log('Quarter | Unit | Bill Amount | Paid Amount | Due Amount | Status | Payments | Credit Used | Credit Balance | Issues');
  console.log('-'.repeat(120));
  
  for (const status of allUnitStatuses) {
    const issues = [];
    if (status.missingTransactions) issues.push(`${status.missingTransactions.length} missing txn`);
    if (status.unlinkedTransactions) issues.push(`${status.unlinkedTransactions.length} unlinked txn`);
    if (status.unlinkedCreditEntries > 0) issues.push(`🚨 ${status.unlinkedCreditEntries} unlinked credit`);
    const issuesStr = issues.length > 0 ? issues.join(', ') : 'None';
    
    console.log(
      `${status.quarter.padEnd(7)} | ` +
      `${status.unitId.padEnd(4)} | ` +
      `$${status.billAmount.toFixed(2).padStart(10)} | ` +
      `$${status.paidAmount.toFixed(2).padStart(10)} | ` +
      `$${status.dueAmount.toFixed(2).padStart(10)} | ` +
      `${status.statusIcon} ${status.status.padEnd(6)} | ` +
      `${status.paymentCount.toString().padStart(8)} | ` +
      `$${status.creditUsedForWater.toFixed(2).padStart(11)} | ` +
      `$${status.currentCreditBalance.toFixed(2).padStart(14)} | ` +
      `${issuesStr}`
    );
  }
  
  // 5. Critical issues summary
  const criticalIssues = allUnitStatuses.filter(s => 
    s.missingTransactions || s.unlinkedTransactions || s.unlinkedCreditEntries > 0 || (s.status !== 'paid' && s.dueAmount > 0)
  );
  
  if (criticalIssues.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('🚨 CRITICAL ISSUES SUMMARY');
    console.log(`${'='.repeat(80)}\n`);
    
    const unpaid = criticalIssues.filter(s => s.status !== 'paid' && s.dueAmount > 0);
    const missingTxns = criticalIssues.filter(s => s.missingTransactions);
    const unlinkedTxns = criticalIssues.filter(s => s.unlinkedTransactions);
    
    if (unpaid.length > 0) {
      console.log(`⚠️  ${unpaid.length} unit(s) with outstanding balances:`);
      unpaid.forEach(s => {
        console.log(`   - Unit ${s.unitId} (Q${s.quarter}): $${s.dueAmount.toFixed(2)} due`);
      });
      console.log('');
    }
    
    if (missingTxns.length > 0) {
      console.log(`❌ ${missingTxns.length} unit(s) with missing transaction references:`);
      missingTxns.forEach(s => {
        console.log(`   - Unit ${s.unitId} (Q${s.quarter}): ${s.missingTransactions.length} missing transaction(s)`);
        s.missingTransactions.forEach(txnId => {
          console.log(`     • ${txnId}`);
        });
      });
      console.log('');
    }
    
    if (unlinkedTxns.length > 0) {
      console.log(`⚠️  ${unlinkedTxns.length} unit(s) with unlinked water transactions:`);
      unlinkedTxns.forEach(s => {
        console.log(`   - Unit ${s.unitId} (Q${s.quarter}): ${s.unlinkedTransactions.length} unlinked transaction(s)`);
        s.unlinkedTransactions.forEach(txn => {
          console.log(`     • ${txn.id}: $${txn.amount.toFixed(2)} (${txn.date || 'no date'})`);
        });
      });
      console.log('');
    }
    
    const unlinkedCredit = criticalIssues.filter(s => s.unlinkedCreditEntries > 0);
    if (unlinkedCredit.length > 0) {
      console.log(`🚨 ${unlinkedCredit.length} unit(s) with CREDIT BALANCE DISCREPANCIES:`);
      console.log(`   ⚠️  CRITICAL: Credit was used for water bills but payments not recorded in water bills system!`);
      unlinkedCredit.forEach(s => {
        console.log(`   - Unit ${s.unitId} (Q${s.quarter}):`);
        console.log(`     • Credit used: $${s.creditUsedForWater.toFixed(2)}`);
        console.log(`     • Unlinked credit entries: ${s.unlinkedCreditEntries}`);
        console.log(`     • Current credit balance: $${s.currentCreditBalance.toFixed(2)}`);
        console.log(`     • Water bill status: ${s.status} (Due: $${s.dueAmount.toFixed(2)})`);
        console.log(`     ⚠️  ACTION REQUIRED: Link credit usage to water bill payments or record missing payments`);
      });
      console.log('');
    }
  } else {
    console.log(`\n✅ No critical issues found. All bills are properly linked and paid.`);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('Report complete.');
  console.log(`${'='.repeat(80)}\n`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

