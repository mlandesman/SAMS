#!/usr/bin/env node

/*
 * HOA Dues Orphaned Payments Cleanup Script
 * 
 * This script scans all units' HOA dues payments to find orphaned references
 * to transactions that no longer exist, and optionally cleans them up.
 * 
 * Usage:
 *   node cleanup-orphaned-hoa-payments.js [--client=MTC] [--dry-run] [--year=2025]
 * 
 * Options:
 *   --client=ID    Specify client ID (default: MTC)
 *   --dry-run      Only report issues, don't fix them (default: true)
 *   --year=YYYY    Specify year to check (default: 2025)
 *   --fix          Actually perform the cleanup
 */

import { initializeFirebase, getDb } from './firebase.js';
import { writeAuditLog } from './utils/auditLogger.js';

// Parse command line arguments
const args = process.argv.slice(2);
const clientId = args.find(arg => arg.startsWith('--client='))?.split('=')[1] || 'MTC';
const year = parseInt(args.find(arg => arg.startsWith('--year='))?.split('=')[1] || '2025');
const isDryRun = !args.includes('--fix');

console.log(`🔍 HOA Dues Orphaned Payments Cleanup`);
console.log(`📅 Year: ${year}`);
console.log(`🏢 Client: ${clientId}`);
console.log(`🔧 Mode: ${isDryRun ? 'DRY RUN (report only)' : 'CLEANUP (will fix issues)'}`);
console.log(`═══════════════════════════════════════════════════════════`);

async function findOrphanedPayments() {
  try {
    await initializeFirebase();
    const db = await getDb();
    
    let totalUnits = 0;
    let totalPayments = 0;
    let orphanedPayments = [];
    let validPayments = 0;
    
    // Get all units for the client
    console.log(`📋 Scanning units for client ${clientId}...`);
    const unitsSnapshot = await db.collection(`clients/${clientId}/units`).get();
    
    if (unitsSnapshot.empty) {
      console.log(`❌ No units found for client ${clientId}`);
      return;
    }
    
    totalUnits = unitsSnapshot.size;
    console.log(`🏠 Found ${totalUnits} units to check`);
    
    // Check each unit's dues payments
    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      const unitData = unitDoc.data();
      
      console.log(`\n🔍 Checking Unit ${unitId}...`);
      
      // Get dues data for the specified year
      const duesRef = db.doc(`clients/${clientId}/units/${unitId}/dues/${year}`);
      const duesDoc = await duesRef.get();
      
      if (!duesDoc.exists) {
        console.log(`  ⚠️  No dues data for ${year}`);
        continue;
      }
      
      const duesData = duesDoc.data();
      const payments = duesData.payments || [];
      
      if (payments.length === 0) {
        console.log(`  ℹ️  No payments recorded`);
        continue;
      }
      
      console.log(`  📊 Found ${payments.length} payment records`);
      
      // Check each payment for orphaned transaction references
      for (let i = 0; i < payments.length; i++) {
        const payment = payments[i];
        totalPayments++;
        
        if (!payment || !payment.transactionId || payment.paid <= 0) {
          // Empty or zero payment - this is normal
          continue;
        }
        
        console.log(`    🔍 Checking payment ${i + 1}: Month ${payment.month}, Amount ${payment.paid}, TxnID: ${payment.transactionId}`);
        
        // Check if the transaction still exists
        const txnRef = db.doc(`clients/${clientId}/transactions/${payment.transactionId}`);
        const txnDoc = await txnRef.get();
        
        if (!txnDoc.exists) {
          // Found orphaned payment!
          console.log(`    ❌ ORPHANED: Transaction ${payment.transactionId} no longer exists`);
          orphanedPayments.push({
            unitId,
            paymentIndex: i,
            month: payment.month,
            amount: payment.paid,
            transactionId: payment.transactionId,
            date: payment.date,
            notes: payment.notes,
            duesPath: `clients/${clientId}/units/${unitId}/dues/${year}`
          });
        } else {
          console.log(`    ✅ Valid: Transaction exists`);
          validPayments++;
        }
      }
    }
    
    // Report summary
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`📊 CLEANUP SUMMARY`);
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`🏠 Units scanned: ${totalUnits}`);
    console.log(`📋 Total payment records: ${totalPayments}`);
    console.log(`✅ Valid payments: ${validPayments}`);
    console.log(`❌ Orphaned payments: ${orphanedPayments.length}`);
    
    if (orphanedPayments.length === 0) {
      console.log(`\n🎉 No orphaned payments found! All payment references are valid.`);
      return;
    }
    
    // Detailed report of orphaned payments
    console.log(`\n🔍 ORPHANED PAYMENTS DETAILS:`);
    console.log(`═══════════════════════════════════════════════════════════`);
    
    let totalOrphanedAmount = 0;
    for (const orphaned of orphanedPayments) {
      console.log(`❌ Unit ${orphaned.unitId}, Month ${orphaned.month}:`);
      console.log(`   Amount: $${orphaned.amount}`);
      console.log(`   Missing Transaction: ${orphaned.transactionId}`);
      console.log(`   Date: ${orphaned.date || 'Unknown'}`);
      console.log(`   Notes: ${orphaned.notes || 'None'}`);
      console.log(`   Path: ${orphaned.duesPath}`);
      console.log(``);
      totalOrphanedAmount += orphaned.amount;
    }
    
    console.log(`💰 Total orphaned amount: $${totalOrphanedAmount}`);
    
    // Cleanup phase
    if (isDryRun) {
      console.log(`\n🔍 DRY RUN MODE - No changes made`);
      console.log(`To actually clean up these orphaned payments, run:`);
      console.log(`node cleanup-orphaned-hoa-payments.js --client=${clientId} --year=${year} --fix`);
    } else {
      console.log(`\n🧹 CLEANING UP ORPHANED PAYMENTS...`);
      await cleanupOrphanedPayments(db, orphanedPayments);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

async function cleanupOrphanedPayments(db, orphanedPayments) {
  let cleanedCount = 0;
  
  // Group orphaned payments by dues document to minimize writes
  const paymentsByDues = {};
  for (const orphaned of orphanedPayments) {
    if (!paymentsByDues[orphaned.duesPath]) {
      paymentsByDues[orphaned.duesPath] = [];
    }
    paymentsByDues[orphaned.duesPath].push(orphaned);
  }
  
  for (const [duesPath, paymentsToClean] of Object.entries(paymentsByDues)) {
    console.log(`🧹 Cleaning ${paymentsToClean.length} orphaned payments in ${duesPath}...`);
    
    try {
      await db.runTransaction(async (transaction) => {
        // Read current dues data
        const duesRef = db.doc(duesPath);
        const duesDoc = await transaction.get(duesRef);
        
        if (!duesDoc.exists) {
          console.log(`⚠️  Dues document no longer exists: ${duesPath}`);
          return;
        }
        
        const duesData = duesDoc.data();
        const payments = [...(duesData.payments || [])];
        
        // Clear each orphaned payment
        for (const orphaned of paymentsToClean) {
          if (payments[orphaned.paymentIndex] && 
              payments[orphaned.paymentIndex].transactionId === orphaned.transactionId) {
            
            console.log(`  🗑️  Clearing month ${orphaned.month} payment (${orphaned.transactionId})`);
            payments[orphaned.paymentIndex] = {
              month: orphaned.month,
              paid: 0,
              date: null,
              transactionId: null,
              notes: null
            };
            cleanedCount++;
          }
        }
        
        // Update the dues document
        transaction.update(duesRef, { payments });
      });
      
      console.log(`✅ Cleaned orphaned payments in ${duesPath}`);
      
      // Log the cleanup operation
      await writeAuditLog({
        module: 'hoa_dues',
        action: 'cleanup_orphaned_payments',
        parentPath: duesPath,
        docId: duesPath.split('/').pop(),
        friendlyName: `HOA Dues Payment Cleanup`,
        notes: `Cleaned ${paymentsToClean.length} orphaned payment references`,
        metadata: {
          paymentsCleared: paymentsToClean.length,
          orphanedTransactionIds: paymentsToClean.map(p => p.transactionId)
        }
      });
      
    } catch (error) {
      console.error(`❌ Error cleaning ${duesPath}:`, error);
    }
  }
  
  console.log(`\n✅ CLEANUP COMPLETE`);
  console.log(`🧹 Cleaned ${cleanedCount} orphaned payment references`);
  console.log(`📝 Audit logs written for all cleanup operations`);
}

// Run the cleanup
findOrphanedPayments().then(() => {
  console.log(`\n🏁 Script completed`);
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
