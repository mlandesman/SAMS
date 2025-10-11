/**
 * cleanup-mtc-dates.js
 * One-time cleanup script to normalize date fields in existing MTC transactions
 * 
 * This script fixes the inconsistent date formats issue where imported transactions
 * have Firestore Timestamp objects while UI-created transactions have JavaScript Date strings.
 * 
 * Run with: node backend/scripts/cleanup-mtc-dates.js
 */

import { getDb } from '../firebase.js';
import { normalizeDateFields, isValidJavaScriptDate } from '../utils/dateNormalization.js';

async function cleanupMTCDates() {
  try {
    console.log('🚀 Starting MTC date cleanup process...');
    
    const db = await getDb();
    const clientId = 'MTC';
    
    // Get all MTC transactions
    console.log('📖 Reading MTC transactions...');
    const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
    const snapshot = await transactionsRef.get();
    
    if (snapshot.empty) {
      console.log('ℹ️ No transactions found for MTC client');
      return;
    }
    
    console.log(`📊 Found ${snapshot.size} transactions to analyze`);
    
    let processedCount = 0;
    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    let errorCount = 0;
    
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore batch limit
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        processedCount++;
        
        // Check if date fields need normalization
        let needsUpdate = false;
        
        // Check main date field
        if (data.date) {
          if (!isValidJavaScriptDate(data.date)) {
            console.log(`🔧 Transaction ${doc.id} has non-JS Date in 'date' field:`, typeof data.date);
            needsUpdate = true;
          }
        }
        
        // Check createdAt field
        if (data.createdAt) {
          if (!isValidJavaScriptDate(data.createdAt)) {
            console.log(`🔧 Transaction ${doc.id} has non-JS Date in 'createdAt' field:`, typeof data.createdAt);
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          // Normalize the date fields
          const normalizedData = normalizeDateFields(data);
          
          console.log(`📝 Updating transaction ${doc.id}:`);
          console.log(`   Original date: ${data.date} (${typeof data.date})`);
          console.log(`   Normalized date: ${normalizedData.date} (${typeof normalizedData.date})`);
          
          // Add to batch
          batch.update(doc.ref, normalizedData);
          batchCount++;
          fixedCount++;
          
          // Execute batch if we hit the limit
          if (batchCount >= BATCH_SIZE) {
            console.log(`💾 Committing batch of ${batchCount} updates...`);
            await batch.commit();
            
            // Start new batch
            const newBatch = db.batch();
            Object.setPrototypeOf(batch, Object.getPrototypeOf(newBatch));
            Object.assign(batch, newBatch);
            batchCount = 0;
          }
        } else {
          alreadyCorrectCount++;
        }
        
        // Progress indicator
        if (processedCount % 100 === 0) {
          console.log(`⏳ Processed ${processedCount}/${snapshot.size} transactions...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing transaction ${doc.id}:`, error);
        errorCount++;
      }
    }
    
    // Commit any remaining updates
    if (batchCount > 0) {
      console.log(`💾 Committing final batch of ${batchCount} updates...`);
      await batch.commit();
    }
    
    console.log('\n✅ MTC date cleanup completed!');
    console.log('📊 Summary:');
    console.log(`   - Total transactions processed: ${processedCount}`);
    console.log(`   - Transactions fixed: ${fixedCount}`);
    console.log(`   - Already correct: ${alreadyCorrectCount}`);
    console.log(`   - Errors encountered: ${errorCount}`);
    
    if (fixedCount > 0) {
      console.log('\n🎯 Verification Steps:');
      console.log('1. Check Firebase Console to verify all transactions have consistent date formats');
      console.log('2. Test frontend to confirm all transactions display properly');
      console.log('3. Try the "All Time" filter to ensure all transactions are visible');
    }
    
  } catch (error) {
    console.error('❌ Cleanup script failed:', error);
    process.exit(1);
  }
}

// Add validation function to check results
async function validateCleanup() {
  try {
    console.log('\n🔍 Validating cleanup results...');
    
    const db = await getDb();
    const clientId = 'MTC';
    
    const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
    const snapshot = await transactionsRef.get();
    
    let validCount = 0;
    let invalidCount = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Check if date is a proper JavaScript Date
      if (data.date && isValidJavaScriptDate(data.date)) {
        validCount++;
      } else {
        invalidCount++;
        console.log(`❌ Invalid date in transaction ${doc.id}:`, data.date);
      }
    });
    
    console.log(`✅ Validation complete:`);
    console.log(`   - Valid JavaScript Dates: ${validCount}`);
    console.log(`   - Invalid dates: ${invalidCount}`);
    
    return invalidCount === 0;
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
}

// Run cleanup and validation
async function main() {
  try {
    await cleanupMTCDates();
    
    console.log('\n⏳ Running validation...');
    const isValid = await validateCleanup();
    
    if (isValid) {
      console.log('\n🎉 All transactions now have consistent JavaScript Date formats!');
    } else {
      console.log('\n⚠️ Some transactions still have invalid date formats. Please review the logs above.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  }
}

main();