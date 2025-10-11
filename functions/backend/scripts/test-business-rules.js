#!/usr/bin/env node

/**
 * Test business rules for transaction conversion
 */

import { getDb } from '../firebase.js';

async function testBusinessRules() {
  console.log('🧪 Testing Business Rules for Transaction Conversion...\n');
  
  try {
    const db = await getDb();
    const snapshot = await db.collection('clients/MTC/transactions')
      .limit(20)
      .get();
    
    console.log('📊 Testing Business Rules on Sample Transactions:\n');
    console.log('ID'.padEnd(25) + 'Amount'.padEnd(10) + 'Category'.padEnd(20) + 'Decision'.padEnd(15) + 'Reason');
    console.log('-'.repeat(90));
    
    const obvious = [];
    const questionable = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      const absAmount = Math.abs(amount);
      const category = (data.categoryName || data.category || '').toLowerCase();
      const originalCategory = data.categoryName || data.category || 'Unknown';
      
      let decision = '✅ OK';
      let reason = 'Normal range';
      let needsConversion = false;
      let isObvious = false;
      
      // Check for bank adjustments (exception)
      const isBankAdjustment = category.includes('bank') && category.includes('adjustment');
      
      // Business Rule 1: HOA Dues - should be 3,400-40,000 pesos (340,000-4,000,000 cents)
      if (category.includes('hoa') || category.includes('dues')) {
        if (absAmount < 340000) { // Less than $3,400
          decision = '🔄 CONVERT';
          reason = 'HOA < $3,400';
          needsConversion = true;
          isObvious = true;
        }
      }
      
      // Business Rule 2: Special Assessments - never less than $3,000 (300,000 cents)
      else if (category.includes('special') && category.includes('assessment')) {
        if (absAmount < 300000) { // Less than $3,000
          decision = '🔄 CONVERT';
          reason = 'Special < $3,000';
          needsConversion = true;
          isObvious = true;
        }
      }
      
      // Business Rule 3: Most expenses should be over $1,000 pesos (100,000 cents)
      else if (!isBankAdjustment && absAmount < 100000 && absAmount > 100) {
        if (absAmount < 10000) { // Under $100 - very suspicious
          decision = '🔄 CONVERT';
          reason = 'Amount < $100';
          needsConversion = true;
          isObvious = true;
        } else { // $100-$1,000 - questionable
          decision = '❓ REVIEW';
          reason = '$100-$1,000 range';
          needsConversion = true;
          isObvious = false;
        }
      }
      
      // Business Rule 4: Anything under 4 digits (except bank adjustments)
      else if (!isBankAdjustment && absAmount < 1000 && absAmount > 0) {
        decision = '🔄 CONVERT';
        reason = '< 4 digits';
        needsConversion = true;
        isObvious = true;
      }
      
      if (needsConversion) {
        const candidate = {
          id: doc.id.substring(0, 20),
          amount: amount,
          category: originalCategory,
          reason: reason
        };
        
        if (isObvious) {
          obvious.push(candidate);
        } else {
          questionable.push(candidate);
        }
      }
      
      console.log(
        doc.id.substring(0, 24).padEnd(25) +
        amount.toString().padEnd(10) +
        originalCategory.substring(0, 19).padEnd(20) +
        decision.padEnd(15) +
        reason
      );
    });
    
    console.log('\n📈 RESULTS SUMMARY:');
    console.log(`Obvious conversions: ${obvious.length}`);
    console.log(`Questionable conversions: ${questionable.length}`);
    console.log(`Normal transactions: ${snapshot.size - obvious.length - questionable.length}`);
    
    if (obvious.length > 0) {
      console.log('\n✅ OBVIOUS CONVERSIONS:');
      obvious.forEach(c => {
        console.log(`  ${c.id} | ${c.amount} → ${c.amount * 100} | ${c.category} | ${c.reason}`);
      });
    }
    
    if (questionable.length > 0) {
      console.log('\n❓ QUESTIONABLE CONVERSIONS:');
      questionable.forEach(c => {
        console.log(`  ${c.id} | ${c.amount} → ${c.amount * 100} | ${c.category} | ${c.reason}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBusinessRules();