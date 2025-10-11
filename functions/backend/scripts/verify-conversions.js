#!/usr/bin/env node

/**
 * Verify transaction conversions worked
 */

import { getDb } from '../firebase.js';

async function verifyConversions() {
  console.log('🔍 Verifying Transaction Conversions...\n');
  
  try {
    const db = await getDb();
    const snapshot = await db.collection('clients/MTC/transactions')
      .orderBy('created', 'desc')
      .limit(20)
      .get();
    
    console.log('📊 Recent 20 Transactions After Conversion:\n');
    console.log('ID'.padEnd(25) + 'Amount'.padEnd(12) + 'Category'.padEnd(20) + 'Converted?'.padEnd(12) + 'Date');
    console.log('-'.repeat(90));
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      const absAmount = Math.abs(amount);
      const category = (data.categoryName || data.category || 'Unknown').substring(0, 19);
      const hasConversionMetadata = data.conversionMetadata ? '✅ YES' : '❌ NO';
      const date = data.date ? new Date(data.date._seconds * 1000).toISOString().split('T')[0] : 'Unknown';
      
      console.log(
        doc.id.substring(0, 24).padEnd(25) +
        amount.toString().padEnd(12) +
        category.padEnd(20) +
        hasConversionMetadata.padEnd(12) +
        date
      );
    });
    
    // Get count by conversion status
    const allSnapshot = await db.collection('clients/MTC/transactions').get();
    let convertedCount = 0;
    let smallAmounts = 0;
    
    allSnapshot.forEach(doc => {
      const data = doc.data();
      const amount = Math.abs(data.amount || 0);
      
      if (data.conversionMetadata) {
        convertedCount++;
      }
      
      if (amount < 100000 && amount > 0) {
        smallAmounts++;
      }
    });
    
    console.log(`\n📈 VERIFICATION SUMMARY:`);
    console.log(`Total transactions: ${allSnapshot.size}`);
    console.log(`Converted transactions: ${convertedCount}`);
    console.log(`Remaining small amounts: ${smallAmounts}`);
    console.log(`Conversion success rate: ${((convertedCount / allSnapshot.size) * 100).toFixed(1)}%`);
    
    if (smallAmounts > 0) {
      console.log(`\n⚠️ ${smallAmounts} transactions still have amounts under 100,000 (may need conversion)`);
    } else {
      console.log(`\n✅ All transactions appear to be in proper cents format!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyConversions();