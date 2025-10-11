#!/usr/bin/env node

/**
 * Full analysis of all transactions for manual review
 */

import { getDb } from '../firebase.js';

async function fullConversionAnalysis() {
  console.log('📋 FULL TRANSACTION CONVERSION ANALYSIS\n');
  
  try {
    const db = await getDb();
    const snapshot = await db.collection('clients/MTC/transactions').get();
    
    console.log(`Analyzing all ${snapshot.size} transactions...\n`);
    
    const obvious = [];
    const questionable = [];
    const normal = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      const absAmount = Math.abs(amount);
      const category = (data.categoryName || data.category || '').toLowerCase();
      const originalCategory = data.categoryName || data.category || 'Unknown';
      
      let needsConversion = false;
      let reason = '';
      let isObvious = false;
      
      // Check for bank adjustments (exception)
      const isBankAdjustment = category.includes('bank') && category.includes('adjustment');
      
      // Business Rule 1: HOA Dues - should be 3,400-40,000 pesos (340,000-4,000,000 cents)
      if (category.includes('hoa') || category.includes('dues')) {
        if (absAmount < 340000) { // Less than $3,400
          needsConversion = true;
          reason = 'HOA Dues under $3,400 - needs conversion';
          isObvious = true;
        }
      }
      
      // Business Rule 2: Special Assessments - never less than $3,000 (300,000 cents)
      else if (category.includes('special') && category.includes('assessment')) {
        if (absAmount < 300000) { // Less than $3,000
          needsConversion = true;
          reason = 'Special Assessment under $3,000 - needs conversion';
          isObvious = true;
        }
      }
      
      // Business Rule 3: Most expenses should be over $1,000 pesos (100,000 cents)
      else if (!isBankAdjustment && absAmount < 100000 && absAmount > 100) {
        if (absAmount < 10000) { // Under $100 - very suspicious
          needsConversion = true;
          reason = 'Amount under $100 - likely needs conversion';
          isObvious = true;
        } else { // $100-$1,000 - questionable
          needsConversion = true;
          reason = 'Amount $100-$1,000 - questionable for peso transaction';
          isObvious = false;
        }
      }
      
      // Business Rule 4: Anything under 4 digits (except bank adjustments)
      else if (!isBankAdjustment && absAmount < 1000 && absAmount > 0) {
        needsConversion = true;
        reason = 'Amount under 4 digits - likely unconverted';
        isObvious = true;
      }
      
      const transaction = {
        id: doc.id,
        amount: amount,
        absAmount: absAmount,
        category: originalCategory,
        currentFormatted: `$${absAmount.toLocaleString()}`,
        proposedFormatted: `$${(absAmount * 100).toLocaleString()}`,
        reason: reason,
        notes: data.notes || '',
        date: data.date ? new Date(data.date._seconds * 1000).toISOString().split('T')[0] : 'Unknown'
      };
      
      if (needsConversion) {
        if (isObvious) {
          obvious.push(transaction);
        } else {
          questionable.push(transaction);
        }
      } else {
        normal.push(transaction);
      }
    });
    
    console.log('📊 SUMMARY:');
    console.log(`Total transactions: ${snapshot.size}`);
    console.log(`Obvious conversions: ${obvious.length}`);
    console.log(`Questionable conversions: ${questionable.length}`);
    console.log(`Normal transactions: ${normal.length}`);
    
    console.log('\n✅ OBVIOUS CONVERSIONS (will be auto-converted):');
    obvious.forEach((txn, index) => {
      console.log(`${(index + 1).toString().padStart(3)}. ${txn.category.padEnd(25)} | ${txn.currentFormatted.padEnd(10)} → ${txn.proposedFormatted.padEnd(12)} | ${txn.reason}`);
    });
    
    console.log('\n❓ QUESTIONABLE CONVERSIONS - NEED YOUR REVIEW:');
    console.log('=' .repeat(100));
    questionable.forEach((txn, index) => {
      console.log(`${(index + 1).toString().padStart(3)}. Transaction ID: ${txn.id}`);
      console.log(`     Date: ${txn.date}`);
      console.log(`     Category: ${txn.category}`);
      console.log(`     Current Amount: ${txn.currentFormatted} → Proposed: ${txn.proposedFormatted}`);
      console.log(`     Reason: ${txn.reason}`);
      console.log(`     Notes: ${txn.notes || 'None'}`);
      console.log('     ---');
    });
    
    if (questionable.length === 0) {
      console.log('🎉 No questionable conversions found!');
    }
    
    console.log('\n📝 REVIEW INSTRUCTIONS:');
    console.log('Please review each questionable conversion above and decide:');
    console.log('- CONVERT: Add to obvious list for automatic conversion');
    console.log('- SKIP: Leave as-is (current amount is correct)');
    console.log('- MANUAL: Convert manually with different amount');
    
    return { obvious, questionable, normal };
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fullConversionAnalysis();