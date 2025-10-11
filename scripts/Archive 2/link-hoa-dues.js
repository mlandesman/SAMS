/**
 * link-hoa-dues.js
 * 
 * Script to link HOA Dues payment records to transactions in SAMS
 * Performs matching based on multiple criteria:
 * - Unit number match
 * - Date match
 * - Amount match
 * - Sequence number in notes
 */

import { getDb, initializeFirebase } from '../backend/firebase.js';

// Initialize Firebase
console.log('🔥 Initializing Firebase Admin SDK...');
await initializeFirebase();
const db = await getDb();
console.log('✅ Firebase Admin SDK initialized');

/**
 * Link HOA Dues payments to transactions for a client
 * @param {string} clientId - Client ID
 * @returns {object} - Stats about linking process
 */
async function linkHoaDuesToTransactions(clientId) {
  console.log(`\n🔗 Linking HOA Dues payments to transactions for client ${clientId}...`);
  
  try {
    // Gather HOA Dues records
    console.log('📊 Fetching HOA Dues records...');
    const hoaDuesRef = db.collection(`clients/${clientId}/hoaDues`);
    const hoaDuesDocs = await hoaDuesRef.get();
    
    if (hoaDuesDocs.empty) {
      console.warn('⚠️ No HOA Dues records found');
      return { success: false, reason: 'no-records', linkedCount: 0 };
    }
    
    console.log(`✅ Found ${hoaDuesDocs.size} HOA Dues records`);
    
    // Gather HOA Dues transactions
    console.log('📊 Fetching HOA Dues transactions...');
    const txnRef = db.collection(`clients/${clientId}/transactions`);
    const query = txnRef.where('category', '==', 'HOA Dues');
    const txnDocs = await query.get();
    
    if (txnDocs.empty) {
      console.warn('⚠️ No HOA Dues transactions found');
      return { success: false, reason: 'no-transactions', linkedCount: 0 };
    }
    
    console.log(`✅ Found ${txnDocs.size} HOA Dues transactions`);
    
    // Extract transactions and format for matching
    const transactions = [];
    txnDocs.forEach(doc => {
      const txData = doc.data();
      transactions.push({
        id: doc.id,
        date: txData.date instanceof Date ? txData.date : new Date(txData.date),
        amount: txData.amount,
        notes: (txData.notes || '').trim(),
        unit: extractUnitFromNotes(txData.notes) || extractUnitFromNotes(txData.vendor),
        vendor: (txData.vendor || '').trim(),
        sequenceNum: extractSequenceNumber(txData.notes),
        linked: false
      });
    });
    
    // Build a map of HOA dues records by ID for efficient updating
    const hoaDuesMap = new Map();
    const unitsWithDues = new Set();
    
    // Extract HOA Dues data
    hoaDuesDocs.forEach(doc => {
      const duesData = doc.data();
      const duesRecord = {
        id: doc.id,
        ref: doc.ref,
        unitId: duesData.unitId,
        year: duesData.year,
        payments: duesData.payments || []
      };
      
      hoaDuesMap.set(doc.id, duesRecord);
      unitsWithDues.add(duesData.unitId);
    });
    
    console.log(`✅ Found dues for ${unitsWithDues.size} unique units`);
    
    // Stats for reporting
    const stats = {
      totalPayments: 0,
      linked: 0,
      unlinked: 0,
      byMatchType: {
        sequenceNumber: 0,
        unitDateAmount: 0,
        unitAmount: 0,
        dateAmount: 0,
        amount: 0
      }
    };
    
    // Process each HOA Dues record and attempt to link payments
    for (const duesRecord of hoaDuesMap.values()) {
      console.log(`\n🔍 Processing dues for Unit ${duesRecord.unitId}, Year ${duesRecord.year}`);
      
      const payments = duesRecord.payments || [];
      stats.totalPayments += payments.length;
      
      if (payments.length === 0) {
        console.log('  No payments to link');
        continue;
      }
      
      // Track which payments were linked
      const updatedPayments = [];
      
      // Try to link each payment
      for (const payment of payments) {
        // Skip payments with zero amount
        if (!payment.paid || payment.paid === 0) {
          updatedPayments.push(payment);
          continue;
        }
        
        console.log(`  🔍 Looking for match for payment of ${payment.paid} in month ${payment.month}`);
        
        // Skip if already linked
        if (payment.transactionId) {
          console.log(`    ✅ Already linked to transaction ${payment.transactionId}`);
          stats.linked++;
          updatedPayments.push(payment);
          continue;
        }
        
        // Try to find a matching transaction
        const matchedTransaction = findMatchingTransaction(
          transactions,
          duesRecord.unitId, 
          payment
        );
        
        if (matchedTransaction) {
          console.log(`    ✅ Linked to transaction ${matchedTransaction.id} (${matchedTransaction.matchType})`);
          
          // Update stats
          stats.linked++;
          stats.byMatchType[matchedTransaction.matchType]++;
          
          // Mark transaction as linked to avoid duplicate matches
          matchedTransaction.linked = true;
          
          // Add transaction ID to payment
          updatedPayments.push({
            ...payment,
            transactionId: matchedTransaction.id,
            matchType: matchedTransaction.matchType
          });
        } else {
          console.log('    ❌ No matching transaction found');
          stats.unlinked++;
          updatedPayments.push(payment);
        }
      }
      
      // Update HOA Dues record with linked payments
      await duesRecord.ref.update({
        payments: updatedPayments,
        updatedAt: new Date()
      });
      
      console.log(`  ✅ Updated dues record with linked payments`);
    }
    
    // Print summary
    console.log('\n📊 HOA Dues Linking Summary:');
    console.log(`  Total Payments: ${stats.totalPayments}`);
    console.log(`  Linked: ${stats.linked}`);
    console.log(`  Unlinked: ${stats.unlinked}`);
    console.log('\n  By Match Type:');
    console.log(`    Sequence Number: ${stats.byMatchType.sequenceNumber}`);
    console.log(`    Unit + Date + Amount: ${stats.byMatchType.unitDateAmount}`);
    console.log(`    Unit + Amount: ${stats.byMatchType.unitAmount}`);
    console.log(`    Date + Amount: ${stats.byMatchType.dateAmount}`);
    console.log(`    Amount Only: ${stats.byMatchType.amount}`);
    
    return { success: true, ...stats };
  } catch (error) {
    console.error('❌ Error linking HOA Dues:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract unit number from notes or vendor field
 * @param {string} text - Text to search for unit number
 * @returns {string|null} - Unit number or null if not found
 */
function extractUnitFromNotes(text) {
  if (!text) return null;
  
  // Pattern: 1A, 2B, 10C, etc. possibly in parentheses
  const unitPattern = /\b(\d+[A-Za-z])\b|\((\d+[A-Za-z])\)|\b(Unit\s+\d+[A-Za-z])\b/i;
  const match = text.match(unitPattern);
  
  if (match) {
    // Return the first non-undefined capturing group
    return (match[1] || match[2] || match[3]).toUpperCase();
  }
  
  return null;
}

/**
 * Extract sequence number from notes
 * @param {string} notes - Notes field to search for sequence number
 * @returns {string|null} - Sequence number or null if not found
 */
function extractSequenceNumber(notes) {
  if (!notes) return null;
  
  // Pattern: seq:123, sequence:123, seq #123, etc.
  const seqPattern = /\b(?:seq|sequence)[:\s#]+(\d+)\b/i;
  const match = notes.match(seqPattern);
  
  if (match) {
    return match[1];
  }
  
  return null;
}

/**
 * Find matching transaction for HOA Dues payment
 * Tries multiple strategies in order of decreasing confidence
 * @param {Array} transactions - Array of transaction objects
 * @param {string} unitId - Unit ID
 * @param {object} payment - Payment object
 * @returns {object|null} - Matching transaction or null if not found
 */
function findMatchingTransaction(transactions, unitId, payment) {
  // Skip payments with zero amount
  if (!payment.paid || payment.paid === 0) {
    return null;
  }
  
  const amount = payment.paid;
  const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
  const paymentMonth = payment.month;
  const paymentNotes = payment.notes || '';
  const sequenceNumber = extractSequenceNumber(paymentNotes);
  
  // Strategy 1: Match by sequence number if available
  if (sequenceNumber) {
    const seqMatch = transactions.find(tx => 
      !tx.linked && 
      tx.sequenceNum === sequenceNumber
    );
    
    if (seqMatch) {
      return { ...seqMatch, matchType: 'sequenceNumber' };
    }
  }
  
  // Strategy 2: Match by unit, date (within 7 days), and exact amount
  const dateAmountUnitMatches = transactions.filter(tx => {
    if (tx.linked) return false;
    
    // Must match amount exactly
    if (tx.amount !== amount) return false;
    
    // Must have matching unit ID
    if (tx.unit !== unitId) return false;
    
    // Date must be within 7 days if we have a payment date
    if (paymentDate && isValidDate(paymentDate)) {
      const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
      const dayDiff = Math.abs((txDate - paymentDate) / (1000 * 60 * 60 * 24));
      return dayDiff <= 7;
    }
    
    return true;
  });
  
  if (dateAmountUnitMatches.length > 0) {
    return { ...dateAmountUnitMatches[0], matchType: 'unitDateAmount' };
  }
  
  // Strategy 3: Match by unit and exact amount
  const unitAmountMatches = transactions.filter(tx => 
    !tx.linked && 
    tx.amount === amount && 
    tx.unit === unitId
  );
  
  if (unitAmountMatches.length > 0) {
    return { ...unitAmountMatches[0], matchType: 'unitAmount' };
  }
  
  // Strategy 4: Match by date (within 7 days) and exact amount
  if (paymentDate && isValidDate(paymentDate)) {
    const dateAmountMatches = transactions.filter(tx => {
      if (tx.linked) return false;
      
      // Must match amount exactly
      if (tx.amount !== amount) return false;
      
      // Date must be within 7 days
      const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
      const dayDiff = Math.abs((txDate - paymentDate) / (1000 * 60 * 60 * 24));
      return dayDiff <= 7;
    });
    
    if (dateAmountMatches.length > 0) {
      return { ...dateAmountMatches[0], matchType: 'dateAmount' };
    }
  }
  
  // Strategy 5: Match by exact amount only (least confident)
  const amountMatches = transactions.filter(tx => 
    !tx.linked && 
    tx.amount === amount
  );
  
  if (amountMatches.length > 0) {
    return { ...amountMatches[0], matchType: 'amount' };
  }
  
  // No match found
  return null;
}

/**
 * Check if date is valid
 * @param {Date} date - Date object to check
 * @returns {boolean} - Whether date is valid
 */
function isValidDate(date) {
  return date instanceof Date && !isNaN(date);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
HOA Dues Linking Tool

Usage:
  node link-hoa-dues.js <clientId> [options]

Options:
  --help     Show this help message

Example:
  node link-hoa-dues.js MTC
    `);
    process.exit(0);
  }
  
  const clientId = args[0];
  
  const result = await linkHoaDuesToTransactions(clientId);
  
  if (result.success) {
    console.log('\n✅ HOA Dues linking completed successfully');
    process.exit(0);
  } else {
    console.error('\n❌ HOA Dues linking failed:', result.reason || result.error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
