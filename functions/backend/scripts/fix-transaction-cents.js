#!/usr/bin/env node

/**
 * TRANS-004: Fix Transaction Cents Conversion Data Inconsistency
 * 
 * This script identifies and fixes transactions that were not properly
 * converted to cents during the migration.
 * 
 * Detection Logic:
 * 1. Income categories (HOA Dues, Special Assessments) - likely unconverted
 * 2. Amounts under 10,000 (excluding tiny fees) - suspicious range
 * 3. Round dollar amounts that should be larger
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { updateAccountBalance, rebuildBalances } from '../controllers/accountsController.js';

// Income categories that were likely skipped during conversion
const INCOME_CATEGORIES = [
  'HOA Dues', 
  'hoa dues',
  'Special Assessment', 
  'Special Assessments', 
  'special assessment',
  'special assessments',
  'hoa_dues', 
  'special_assessment',
  'Income',
  'Rental Income',
  'Other Income'
];

/**
 * Detect transactions that need cents conversion using business rules
 */
function detectConversionCandidates(transactions) {
  const obvious = [];      // Clear conversions to apply automatically
  const questionable = []; // Require manual review
  
  transactions.forEach(({ id, data }) => {
    const amount = data.amount || 0;
    const absAmount = Math.abs(amount);
    const category = (data.categoryName || data.category || '').toLowerCase();
    const originalCategory = data.categoryName || data.category || 'Unknown';
    
    let needsConversion = false;
    let reason = '';
    let confidence = 'medium';
    let isObvious = false;
    
    // Check for bank adjustments (exception)
    const isBankAdjustment = category.includes('bank') && category.includes('adjustment');
    
    // Business Rule 1: HOA Dues - should be 3,400-40,000 pesos (340,000-4,000,000 cents)
    if (category.includes('hoa') || category.includes('dues')) {
      if (absAmount < 340000) { // Less than $3,400
        needsConversion = true;
        reason = 'HOA Dues under $3,400 - needs conversion';
        confidence = 'high';
        isObvious = true;
      }
    }
    
    // Business Rule 2: Special Assessments - never less than $3,000 (300,000 cents)
    else if (category.includes('special') && category.includes('assessment')) {
      if (absAmount < 300000) { // Less than $3,000
        needsConversion = true;
        reason = 'Special Assessment under $3,000 - needs conversion';
        confidence = 'high';
        isObvious = true;
      }
    }
    
    // Business Rule 3: Most expenses should be over $1,000 pesos (100,000 cents)
    else if (!isBankAdjustment && absAmount < 100000 && absAmount > 100) { // $1-$1,000 range
      if (absAmount < 10000) { // Under $100 - very suspicious
        needsConversion = true;
        reason = 'Amount under $100 - likely needs conversion';
        confidence = 'high';
        isObvious = true;
      } else { // $100-$1,000 - questionable
        needsConversion = true;
        reason = 'Amount $100-$1,000 - questionable for peso transaction';
        confidence = 'medium';
        isObvious = false;
      }
    }
    
    // Business Rule 4: Anything under 4 digits (except bank adjustments)
    else if (!isBankAdjustment && absAmount < 1000 && absAmount > 0) {
      needsConversion = true;
      reason = 'Amount under 4 digits - likely unconverted';
      confidence = 'high';
      isObvious = true;
    }
    
    if (needsConversion) {
      const candidate = {
        id,
        originalData: data,
        currentAmount: amount,
        proposedAmount: amount * 100,
        category: originalCategory,
        reason,
        confidence,
        date: data.date,
        notes: data.notes || '',
        // Format for display
        currentFormatted: `$${absAmount.toLocaleString()}`,
        proposedFormatted: `$${(absAmount * 100).toLocaleString()}`,
        // Business context
        isBankAdjustment
      };
      
      if (isObvious) {
        obvious.push(candidate);
      } else {
        questionable.push(candidate);
      }
    }
  });
  
  return { obvious, questionable };
}

/**
 * Main function to fix transaction cents conversion
 */
async function fixTransactionCents(clientId = 'MTC', dryRun = true) {
  console.log('🔧 TRANS-004: Fix Transaction Cents Conversion');
  console.log(`Client: ${clientId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
  console.log('=' .repeat(60));
  
  try {
    const db = await getDb();
    
    // Fetch all transactions
    console.log('📥 Fetching all transactions...');
    const snapshot = await db.collection(`clients/${clientId}/transactions`).get();
    console.log(`📊 Found ${snapshot.size} transactions to analyze`);
    
    // Convert to array for processing
    const transactions = [];
    snapshot.forEach(doc => {
      transactions.push({ id: doc.id, data: doc.data() });
    });
    
    // Detect conversion candidates using business rules
    console.log('\n🔍 Detecting conversion candidates using business rules...');
    const { obvious, questionable } = detectConversionCandidates(transactions);
    
    console.log(`\n📋 DETECTION RESULTS:`);
    console.log(`Total transactions: ${transactions.length}`);
    console.log(`Obvious conversions: ${obvious.length} (will be auto-converted)`);
    console.log(`Questionable conversions: ${questionable.length} (need manual review)`);
    console.log(`Total candidates: ${obvious.length + questionable.length}`);
    console.log(`Conversion rate: ${(((obvious.length + questionable.length) / transactions.length) * 100).toFixed(1)}%`);
    
    // Show obvious conversions
    console.log(`\n✅ OBVIOUS CONVERSIONS (${obvious.length}):`);
    obvious.slice(0, 15).forEach((candidate, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${candidate.category.padEnd(20)} | ${candidate.currentFormatted.padEnd(10)} → ${candidate.proposedFormatted.padEnd(12)} | ${candidate.reason}`);
    });
    
    if (obvious.length > 15) {
      console.log(`... and ${obvious.length - 15} more obvious conversions`);
    }
    
    // Show questionable conversions
    console.log(`\n❓ QUESTIONABLE CONVERSIONS (${questionable.length}) - NEED REVIEW:`);
    questionable.forEach((candidate, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${candidate.category.padEnd(20)} | ${candidate.currentFormatted.padEnd(10)} → ${candidate.proposedFormatted.padEnd(12)} | ${candidate.reason}`);
    });
    
    // Group obvious by reason
    const obviousByReason = {};
    obvious.forEach(candidate => {
      if (!obviousByReason[candidate.reason]) {
        obviousByReason[candidate.reason] = [];
      }
      obviousByReason[candidate.reason].push(candidate);
    });
    
    console.log(`\n📊 OBVIOUS CONVERSION BREAKDOWN:`);
    Object.entries(obviousByReason).forEach(([reason, items]) => {
      console.log(`  • ${reason}: ${items.length} transactions`);
    });
    
    // Execute conversions if not dry run
    if (!dryRun) {
      console.log('\n🚀 EXECUTING CONVERSIONS...');
      
      const batch = db.batch();
      let updateCount = 0;
      
      // Only convert obvious candidates automatically
      console.log(`\n🔧 Converting ${obvious.length} obvious candidates...`);
      
      for (const candidate of obvious) {
        const docRef = db.collection(`clients/${clientId}/transactions`).doc(candidate.id);
        
        batch.update(docRef, {
          amount: candidate.proposedAmount,
          updated: admin.firestore.FieldValue.serverTimestamp(),
          'conversionMetadata': {
            originalAmount: candidate.currentAmount,
            convertedBy: 'TRANS-004-fix-script',
            convertedAt: new Date().toISOString(),
            reason: candidate.reason,
            businessRule: 'obvious-conversion'
          }
        });
        
        updateCount++;
        
        // Batch in groups of 500 (Firestore limit)
        if (updateCount % 500 === 0) {
          await batch.commit();
          console.log(`  ✅ Committed batch of ${updateCount} updates`);
        }
      }
      
      // Commit remaining updates
      if (updateCount % 500 !== 0) {
        await batch.commit();
        console.log(`  ✅ Committed final batch`);
      }
      
      console.log(`\n✅ CONVERSION COMPLETE:`);
      console.log(`Obvious conversions applied: ${updateCount}`);
      console.log(`Questionable conversions skipped: ${questionable.length}`);
      
      if (questionable.length > 0) {
        console.log(`\n📝 QUESTIONABLE CONVERSIONS LOG:`);
        console.log(`The following ${questionable.length} transactions need manual review:`);
        questionable.forEach((candidate, index) => {
          console.log(`${(index + 1).toString().padStart(3)}. ID: ${candidate.id}`);
          console.log(`     Category: ${candidate.category}`);
          console.log(`     Current: ${candidate.currentFormatted} → Proposed: ${candidate.proposedFormatted}`);
          console.log(`     Reason: ${candidate.reason}`);
          console.log(`     Notes: ${candidate.notes || 'None'}`);
          console.log('');
        });
      }
      
      // Rebuild account balances
      console.log('\n🔄 Rebuilding account balances...');
      await rebuildBalances(clientId);
      console.log('✅ Account balances rebuilt');
      
      // Log audit entry
      await writeAuditLog({
        module: 'transactionConversion',
        action: 'fix_cents_conversion',
        parentPath: `clients/${clientId}`,
        docId: 'conversion-fix',
        friendlyName: 'TRANS-004 Cents Conversion Fix',
        notes: `Converted ${updateCount} obvious transactions from dollars to cents. Skipped ${questionable.length} questionable conversions for manual review.`
      });
    }
    
    return {
      totalTransactions: transactions.length,
      obviousConversions: obvious.length,
      questionableConversions: questionable.length,
      totalCandidates: obvious.length + questionable.length,
      obvious: obvious,
      questionable: questionable,
      executed: !dryRun
    };
    
  } catch (error) {
    console.error('❌ Error fixing transaction cents:', error);
    throw error;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const clientId = process.argv[2] || 'MTC';
  const dryRun = process.argv[3] !== '--execute';
  
  if (dryRun) {
    console.log('ℹ️ Running in DRY RUN mode. Use --execute to apply changes.');
  }
  
  fixTransactionCents(clientId, dryRun).catch(console.error);
}

export { fixTransactionCents, detectConversionCandidates };