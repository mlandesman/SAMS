#!/usr/bin/env node

/**
 * Test the detection logic for cents conversion
 */

import { getDb } from '../firebase.js';

const INCOME_CATEGORIES = [
  'HOA Dues', 'hoa dues', 'Special Assessment', 'Special Assessments', 
  'special assessment', 'hoa_dues', 'special_assessment'
];

async function testDetectionLogic() {
  console.log('🧪 Testing Detection Logic...');
  
  try {
    const db = await getDb();
    const snapshot = await db.collection('clients/MTC/transactions')
      .limit(50)
      .get();
    
    console.log(`\n📊 Testing on ${snapshot.size} transactions...\n`);
    
    const candidates = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      const absAmount = Math.abs(amount);
      const category = (data.categoryName || data.category || '').toLowerCase();
      const originalCategory = data.categoryName || data.category || 'Unknown';
      
      let needsConversion = false;
      let reason = '';
      
      // Test detection rules
      const isIncomeCategory = INCOME_CATEGORIES.some(incCat => 
        category.includes(incCat.toLowerCase())
      );
      
      if (isIncomeCategory && absAmount < 500000) {
        needsConversion = true;
        reason = 'Income category likely unconverted';
      } else if (absAmount > 50 && absAmount < 10000) {
        needsConversion = true;
        reason = 'Amount suspiciously small';
      } else if (absAmount === 10050 || absAmount === 17420) {
        needsConversion = true;
        reason = 'Specific problematic amount';
      }
      
      if (needsConversion) {
        candidates.push({
          id: doc.id.substring(0, 20),
          amount: amount,
          proposed: amount * 100,
          category: originalCategory,
          reason: reason
        });
      }
      
      // Show each transaction for debugging
      console.log(`${doc.id.substring(0, 20)} | ${amount.toString().padEnd(8)} | ${originalCategory.padEnd(15)} | ${needsConversion ? '🔄 CONVERT' : '✅ OK'}`);
    });
    
    console.log(`\n📋 DETECTION RESULTS:`);
    console.log(`Candidates found: ${candidates.length}`);
    
    if (candidates.length > 0) {
      console.log('\n🔍 CONVERSION CANDIDATES:');
      candidates.forEach(c => {
        console.log(`  ${c.id} | ${c.amount} → ${c.proposed} | ${c.category} | ${c.reason}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDetectionLogic();