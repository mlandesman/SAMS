#!/usr/bin/env node

/*
 * HOA Dues Payment Cleanup Script
 * 
 * This script finds HOA Dues transactions from the past 5 days and re-applies
 * their payment data to ensure proper linkage between transactions and HOA dues records.
 * 
 * Use this to clean up any orphaned payment data that lost transaction ID references.
 * 
 * Usage: node cleanup-hoa-payment-links.js [clientId] [days]
 * 
 * Examples:
 *   node cleanup-hoa-payment-links.js MTC     # Clean up MTC client, past 5 days
 *   node cleanup-hoa-payment-links.js MTC 10  # Clean up MTC client, past 10 days
 *   node cleanup-hoa-payment-links.js all     # Clean up all clients, past 5 days
 */

import { initializeFirebase, getDb } from '../firebase.js';
import { addHOADuesPayment } from '../controllers/hoaDuesController.js';

// Configuration
const DEFAULT_DAYS = 5;
const DEFAULT_CLIENT = process.argv[2] || 'MTC';
const DAYS_TO_SCAN = parseInt(process.argv[3]) || DEFAULT_DAYS;

console.log(`🔧 HOA Dues Payment Cleanup Script`);
console.log(`📅 Scanning past ${DAYS_TO_SCAN} days`);
console.log(`🏢 Target client: ${DEFAULT_CLIENT}`);
console.log(`⏰ Started at: ${new Date().toISOString()}`);
console.log(`─────────────────────────────────────────────────────────`);

async function scanTransactionsForHOADues(clientId, days) {
  const db = await getDb();
  
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  console.log(`🔍 Scanning transactions for client ${clientId}`);
  console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  try {
    const transactionsRef = db.collection(`clients/${clientId}/transactions`);
    
    // Query transactions within date range
    const snapshot = await transactionsRef
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    
    console.log(`📊 Found ${snapshot.size} total transactions in date range`);
    
    const hoaTransactions = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const isHOATransaction = data.category === 'HOA Dues' || data.metadata?.type === 'hoa_dues';
      
      if (isHOATransaction) {
        hoaTransactions.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    console.log(`🏠 Found ${hoaTransactions.length} HOA Dues transactions`);
    
    return hoaTransactions;
    
  } catch (error) {
    console.error(`❌ Error scanning transactions for ${clientId}:`, error);
    return [];
  }
}

async function analyzeHOATransaction(transaction) {
  console.log(`\n🔍 Analyzing transaction: ${transaction.id}`);
  console.log(`  💰 Amount: $${transaction.amount}`);
  console.log(`  📅 Date: ${transaction.date?.toDate?.()?.toISOString() || transaction.date}`);
  console.log(`  🏠 Metadata:`, transaction.metadata);
  
  if (!transaction.metadata?.unitId || !transaction.metadata?.year) {
    console.log(`  ⚠️  Missing required metadata (unitId/year) - skipping`);
    return null;
  }
  
  const analysis = {
    transactionId: transaction.id,
    unitId: transaction.metadata.unitId,
    year: transaction.metadata.year,
    amount: transaction.amount,
    creditBalanceAdded: transaction.creditBalanceAdded || 0,
    duesDistribution: transaction.duesDistribution || [],
    months: transaction.metadata.months || [],
    needsCleanup: false
  };
  
  console.log(`  ✅ Valid HOA transaction for Unit ${analysis.unitId}, Year ${analysis.year}`);
  
  return analysis;
}

async function checkExistingPaymentLinks(clientId, analysis) {
  const db = await getDb();
  const duesPath = `clients/${clientId}/units/${analysis.unitId}/dues/${analysis.year}`;
  
  try {
    const duesDoc = await db.doc(duesPath).get();
    
    if (!duesDoc.exists) {
      console.log(`  ⚠️  Dues document not found: ${duesPath}`);
      return { needsCleanup: false, reason: 'No dues document' };
    }
    
    const duesData = duesDoc.data();
    const payments = duesData.payments || [];
    
    // Check if any payments reference this transaction ID
    const linkedPayments = payments.filter(payment => 
      payment && payment.transactionId === analysis.transactionId
    );
    
    console.log(`  📋 Current payments in dues document: ${payments.length}`);
    console.log(`  🔗 Payments linked to this transaction: ${linkedPayments.length}`);
    
    if (linkedPayments.length === 0) {
      console.log(`  🚨 ORPHANED: No payment links found for transaction ${analysis.transactionId}`);
      return { 
        needsCleanup: true, 
        reason: 'No payment links found',
        currentPayments: payments.length,
        expectedLinks: analysis.duesDistribution?.length || analysis.months?.length || 0
      };
    } else {
      console.log(`  ✅ LINKED: Found ${linkedPayments.length} payment links`);
      linkedPayments.forEach(payment => {
        console.log(`    - Month ${payment.month}: $${payment.paid}`);
      });
      return { 
        needsCleanup: false, 
        reason: 'Already properly linked',
        linkedPayments: linkedPayments.length
      };
    }
    
  } catch (error) {
    console.error(`  ❌ Error checking payment links:`, error);
    return { needsCleanup: false, reason: 'Error checking links' };
  }
}

async function reapplyHOAPayment(clientId, analysis) {
  console.log(`\n🔧 Re-applying HOA payment for transaction ${analysis.transactionId}`);
  
  try {
    // Prepare payment data in the format expected by addHOADuesPayment
    const paymentData = {
      amount: analysis.amount,
      date: new Date(), // Use current date for the reapplication
      notes: `Payment link restored by cleanup script - Original transaction: ${analysis.transactionId}`,
      creditBalanceAdded: analysis.creditBalanceAdded
    };
    
    // Use the duesDistribution if available, otherwise reconstruct from months
    let distribution = analysis.duesDistribution;
    
    if (!distribution || distribution.length === 0) {
      // Reconstruct distribution from months metadata
      if (analysis.months && analysis.months.length > 0) {
        const amountPerMonth = analysis.amount / analysis.months.length;
        distribution = analysis.months.map(month => ({
          unitId: analysis.unitId,
          month: month,
          amount: amountPerMonth,
          year: analysis.year
        }));
        console.log(`  📊 Reconstructed distribution for ${analysis.months.length} months`);
      } else {
        console.log(`  ⚠️  No distribution or months data - treating as credit-only payment`);
        distribution = [];
      }
    }
    
    console.log(`  💾 Applying payment: $${paymentData.amount} to Unit ${analysis.unitId}`);
    console.log(`  📋 Distribution: ${distribution.length} month(s)`);
    
    // Apply the payment using the existing HOA dues controller
    const result = await addHOADuesPayment(
      clientId,
      analysis.unitId,
      analysis.year,
      paymentData,
      distribution,
      analysis.transactionId // This is the key - link it back to the original transaction
    );
    
    if (result.success) {
      console.log(`  ✅ Successfully re-applied payment for transaction ${analysis.transactionId}`);
      return { success: true, details: result };
    } else {
      console.log(`  ❌ Failed to re-apply payment: ${result.error}`);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error(`  ❌ Error re-applying HOA payment:`, error);
    return { success: false, error: error.message };
  }
}

async function cleanupClient(clientId) {
  console.log(`\n🏢 Processing client: ${clientId}`);
  console.log(`═══════════════════════════════════════════════════════════`);
  
  // Step 1: Scan for HOA transactions
  const hoaTransactions = await scanTransactionsForHOADues(clientId, DAYS_TO_SCAN);
  
  if (hoaTransactions.length === 0) {
    console.log(`✅ No HOA Dues transactions found for ${clientId} in past ${DAYS_TO_SCAN} days`);
    return { processed: 0, cleaned: 0, errors: 0 };
  }
  
  let processed = 0;
  let cleaned = 0;
  let errors = 0;
  
  // Step 2: Analyze each transaction
  for (const transaction of hoaTransactions) {
    try {
      processed++;
      
      // Analyze transaction structure
      const analysis = await analyzeHOATransaction(transaction);
      if (!analysis) {
        continue; // Skip invalid transactions
      }
      
      // Check if payment links exist
      const linkCheck = await checkExistingPaymentLinks(clientId, analysis);
      
      if (linkCheck.needsCleanup) {
        console.log(`  🔧 CLEANUP NEEDED: ${linkCheck.reason}`);
        
        // Re-apply the payment
        const result = await reapplyHOAPayment(clientId, analysis);
        
        if (result.success) {
          cleaned++;
          console.log(`  ✅ CLEANED: Successfully restored payment links`);
        } else {
          errors++;
          console.log(`  ❌ ERROR: Failed to restore payment links - ${result.error}`);
        }
      } else {
        console.log(`  ✅ OK: ${linkCheck.reason}`);
      }
      
    } catch (error) {
      errors++;
      console.error(`❌ Error processing transaction ${transaction.id}:`, error);
    }
  }
  
  return { processed, cleaned, errors };
}

async function main() {
  try {
    // Initialize Firebase
    await initializeFirebase();
    console.log(`✅ Firebase initialized successfully\n`);
    
    let totalResults = { processed: 0, cleaned: 0, errors: 0 };
    
    if (DEFAULT_CLIENT === 'all') {
      // TODO: Implement scanning all clients
      console.log(`❌ Scanning all clients not yet implemented. Please specify a client ID.`);
      process.exit(1);
    } else {
      // Process specific client
      const results = await cleanupClient(DEFAULT_CLIENT);
      totalResults = results;
    }
    
    // Summary
    console.log(`\n📊 CLEANUP SUMMARY`);
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`🔍 Transactions processed: ${totalResults.processed}`);
    console.log(`🔧 Payment links cleaned: ${totalResults.cleaned}`);
    console.log(`❌ Errors encountered: ${totalResults.errors}`);
    console.log(`✅ Cleanup completed at: ${new Date().toISOString()}`);
    
    if (totalResults.cleaned > 0) {
      console.log(`\n🎉 Successfully restored ${totalResults.cleaned} orphaned payment link(s)!`);
    }
    
    if (totalResults.errors > 0) {
      console.log(`\n⚠️  ${totalResults.errors} error(s) occurred during cleanup. Check logs above.`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ Fatal error during cleanup:`, error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { scanTransactionsForHOADues, analyzeHOATransaction, checkExistingPaymentLinks, reapplyHOAPayment };
