#!/usr/bin/env node

/**
 * Convert all peso amounts to cents based on business rules
 * All questionable amounts are actually peso amounts that need conversion
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';

async function convertAllPesos(dryRun = true) {
  console.log('💰 PESO TO CENTS CONVERSION');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
  console.log('=' .repeat(50));
  
  try {
    const db = await getDb();
    const snapshot = await db.collection('clients/MTC/transactions').get();
    
    console.log(`\n📊 Found ${snapshot.size} transactions to analyze`);
    
    const conversions = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      const absAmount = Math.abs(amount);
      const category = (data.categoryName || data.category || '').toLowerCase();
      const originalCategory = data.categoryName || data.category || 'Unknown';
      
      let needsConversion = false;
      let reason = '';
      
      // Check for bank adjustments (exception)
      const isBankAdjustment = category.includes('bank') && category.includes('adjustment');
      
      // Business Rule 1: HOA Dues - should be 3,400+ pesos (340,000+ cents)
      if (category.includes('hoa') || category.includes('dues')) {
        if (absAmount < 340000) { // Less than $3,400
          needsConversion = true;
          reason = 'HOA Dues in pesos - convert to cents';
        }
      }
      
      // Business Rule 2: Special Assessments - should be 3,000+ pesos (300,000+ cents)
      else if (category.includes('special') && category.includes('assessment')) {
        if (absAmount < 300000) { // Less than $3,000
          needsConversion = true;
          reason = 'Special Assessment in pesos - convert to cents';
        }
      }
      
      // Business Rule 3: All other amounts under 100,000 are peso amounts
      else if (!isBankAdjustment && absAmount < 100000 && absAmount > 0) {
        needsConversion = true;
        if (category.includes('staff') && category.includes('admin')) {
          reason = 'Monthly admin fee in pesos - convert to cents';
        } else if (category.includes('colonos')) {
          reason = 'Colonos fee in pesos - convert to cents';  
        } else if (category.includes('transfer')) {
          reason = 'Transfer amount in pesos - convert to cents';
        } else if (category.includes('maintenance') || category.includes('supplies')) {
          reason = 'Maintenance/supplies in pesos - convert to cents';
        } else if (category.includes('project')) {
          reason = 'Project expense in pesos - convert to cents';
        } else {
          reason = 'Amount in pesos - convert to cents';
        }
      }
      
      if (needsConversion) {
        conversions.push({
          id: doc.id,
          originalAmount: amount,
          newAmount: amount * 100,
          category: originalCategory,
          reason: reason,
          originalFormatted: `$${absAmount.toLocaleString()}`,
          newFormatted: `$${(absAmount * 100).toLocaleString()}`
        });
      }
    });
    
    console.log(`\n🔄 CONVERSION SUMMARY:`);
    console.log(`Transactions to convert: ${conversions.length}`);
    console.log(`Normal transactions: ${snapshot.size - conversions.length}`);
    
    // Group by reason
    const byReason = {};
    conversions.forEach(conv => {
      if (!byReason[conv.reason]) {
        byReason[conv.reason] = [];
      }
      byReason[conv.reason].push(conv);
    });
    
    console.log(`\n📊 CONVERSION BREAKDOWN:`);
    Object.entries(byReason).forEach(([reason, items]) => {
      console.log(`  • ${reason}: ${items.length} transactions`);
    });
    
    // Show sample conversions
    console.log(`\n🔍 SAMPLE CONVERSIONS:`);
    conversions.slice(0, 10).forEach((conv, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${conv.category.padEnd(25)} | ${conv.originalFormatted.padEnd(10)} → ${conv.newFormatted.padEnd(12)}`);
    });
    
    if (conversions.length > 10) {
      console.log(`... and ${conversions.length - 10} more conversions`);
    }
    
    // Execute conversions if not dry run
    if (!dryRun) {
      console.log('\n🚀 EXECUTING CONVERSIONS...');
      
      let updateCount = 0;
      const batchSize = 500;
      
      for (let i = 0; i < conversions.length; i += batchSize) {
        const batch = db.batch();
        const batchConversions = conversions.slice(i, i + batchSize);
        
        batchConversions.forEach(conv => {
          const docRef = db.collection('clients/MTC/transactions').doc(conv.id);
          
          batch.update(docRef, {
            amount: conv.newAmount,
            updated: admin.firestore.FieldValue.serverTimestamp(),
            'conversionMetadata': {
              originalAmount: conv.originalAmount,
              convertedBy: 'TRANS-004-peso-conversion',
              convertedAt: new Date().toISOString(),
              reason: conv.reason
            }
          });
          
          updateCount++;
        });
        
        await batch.commit();
        console.log(`  ✅ Committed batch ${Math.floor(i / batchSize) + 1}: ${batchConversions.length} updates`);
      }
      
      console.log(`\n✅ CONVERSION COMPLETE:`);
      console.log(`Total conversions applied: ${updateCount}`);
      
      // Note: Account balance rebuild would happen here
      console.log('\n⚠️ Note: Account balances need to be rebuilt after conversion');
    }
    
    return {
      totalTransactions: snapshot.size,
      conversionsApplied: conversions.length,
      normalTransactions: snapshot.size - conversions.length,
      conversions: conversions,
      executed: !dryRun
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv[2] !== '--execute';
  
  if (dryRun) {
    console.log('ℹ️ Running in DRY RUN mode. Use --execute to apply changes.');
  }
  
  convertAllPesos(dryRun).catch(console.error);
}

export { convertAllPesos };