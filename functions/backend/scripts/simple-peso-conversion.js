#!/usr/bin/env node

/**
 * Simple peso to cents conversion - focused execution
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';

async function executeConversion() {
  console.log('💰 EXECUTING PESO TO CENTS CONVERSION');
  console.log('=' .repeat(50));
  
  try {
    const db = await getDb();
    
    // First, get a count of what we're dealing with
    console.log('📊 Analyzing transactions...');
    const snapshot = await db.collection('clients/MTC/transactions').get();
    console.log(`Found ${snapshot.size} total transactions`);
    
    const toConvert = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      const absAmount = Math.abs(amount);
      const category = (data.categoryName || data.category || '').toLowerCase();
      
      // Skip bank adjustments
      const isBankAdjustment = category.includes('bank') && category.includes('adjustment');
      
      let shouldConvert = false;
      let reason = '';
      
      // HOA Dues under $3,400
      if ((category.includes('hoa') || category.includes('dues')) && absAmount < 340000) {
        shouldConvert = true;
        reason = 'HOA Dues under $3,400';
      }
      // Special Assessments under $3,000  
      else if (category.includes('special') && category.includes('assessment') && absAmount < 300000) {
        shouldConvert = true;
        reason = 'Special Assessment under $3,000';
      }
      // Everything else under $1,000 (except bank adjustments)
      else if (!isBankAdjustment && absAmount < 100000 && absAmount > 0) {
        shouldConvert = true;
        reason = 'Amount under $1,000 - peso amount';
      }
      
      if (shouldConvert) {
        toConvert.push({
          id: doc.id,
          oldAmount: amount,
          newAmount: amount * 100,
          category: data.categoryName || data.category || 'Unknown',
          reason
        });
      }
    });
    
    console.log(`\n🔄 CONVERSION PLAN:`);
    console.log(`Transactions to convert: ${toConvert.length}`);
    console.log(`Transactions to leave alone: ${snapshot.size - toConvert.length}`);
    
    if (toConvert.length === 0) {
      console.log('✅ No conversions needed!');
      return;
    }
    
    // Show first few conversions
    console.log(`\n📋 Sample conversions:`);
    toConvert.slice(0, 5).forEach((conv, i) => {
      console.log(`${i+1}. ${conv.category}: ${conv.oldAmount} → ${conv.newAmount} (${conv.reason})`);
    });
    
    if (toConvert.length > 5) {
      console.log(`... and ${toConvert.length - 5} more`);
    }
    
    console.log('\n🚀 Starting conversion...');
    
    // Execute in smaller batches
    const batchSize = 100; // Smaller batches
    let totalUpdated = 0;
    
    for (let i = 0; i < toConvert.length; i += batchSize) {
      const batch = db.batch();
      const currentBatch = toConvert.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(toConvert.length/batchSize)} (${currentBatch.length} transactions)...`);
      
      currentBatch.forEach(conv => {
        const docRef = db.collection('clients/MTC/transactions').doc(conv.id);
        batch.update(docRef, {
          amount: conv.newAmount,
          updated: admin.firestore.FieldValue.serverTimestamp(),
          conversionMetadata: {
            originalAmount: conv.oldAmount,
            convertedBy: 'simple-peso-conversion',
            convertedAt: new Date().toISOString(),
            reason: conv.reason
          }
        });
      });
      
      await batch.commit();
      totalUpdated += currentBatch.length;
      console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} complete (${totalUpdated}/${toConvert.length} total)`);
    }
    
    console.log(`\n✅ CONVERSION COMPLETE!`);
    console.log(`Total transactions converted: ${totalUpdated}`);
    console.log(`Conversion completed successfully.`);
    
    return {
      totalTransactions: snapshot.size,
      conversionsApplied: totalUpdated,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Conversion failed:', error);
    throw error;
  }
}

// Run the conversion
executeConversion()
  .then(result => {
    if (result) {
      console.log('\n🎉 Script completed successfully!');
      process.exit(0);
    }
  })
  .catch(error => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });