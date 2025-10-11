/**
 * Convert existing transactions to proper accounting sign conventions
 * HOTFIX: Skip backup, apply direct conversion
 */

import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Use the same service account logic as the main backend
const getServiceAccountPath = () => {
  if (process.env.NODE_ENV === 'production') {
    return './sams-production-serviceAccountKey.json';
  } else if (process.env.NODE_ENV === 'staging') {
    return './serviceAccountKey-staging.json';
  }
  return './serviceAccountKey.json';
};

const serviceAccountPath = path.join(__dirname, '..', getServiceAccountPath());
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://sams-expense-tracker-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

// Category type cache - load from database
let categoryTypes = {};

async function loadCategoryTypes() {
  console.log('📋 Loading category types from database...');
  
  try {
    const categoriesRef = db.collection('categories');
    const snapshot = await categoriesRef.get();
    
    snapshot.docs.forEach(doc => {
      const category = doc.data();
      if (category.name && category.type) {
        categoryTypes[category.name] = category.type;
        console.log(`   ${category.name}: ${category.type}`);
      }
    });
    
    console.log(`✅ Loaded ${Object.keys(categoryTypes).length} category types`);
  } catch (error) {
    console.error('❌ Error loading categories:', error);
    throw error;
  }
}

function getCategoryType(categoryName) {
  return categoryTypes[categoryName] || null;
}

function dollarsToCents(dollars) {
  return Math.round(dollars * 100);
}

function centsToDisplay(cents) {
  return (cents / 100).toFixed(2);
}

async function convertTransactionSigns() {
  console.log('🚀 Starting transaction sign conversion...');
  
  try {
    // First load category types
    await loadCategoryTypes();
    
    // Get all transactions
    const transactionsRef = db.collection('transactions');
    const snapshot = await transactionsRef.get();
    
    let totalProcessed = 0;
    let totalConverted = 0;
    let batch = db.batch();
    let batchCount = 0;
    
    console.log(`📊 Found ${snapshot.size} transactions to process`);
    
    for (const doc of snapshot.docs) {
      const transaction = doc.data();
      totalProcessed++;
      
      // Skip if no amount or categoryName
      if (!transaction.amount || !transaction.categoryName) {
        console.log(`⚠️  Skipping transaction ${doc.id} - missing amount or categoryName`);
        continue;
      }
      
      let currentAmount = transaction.amount;
      let newAmount = currentAmount;
      let needsUpdate = false;
      
      // Use transactionType if available, otherwise fall back to category lookup
      let transactionType = transaction.transactionType || transaction.type;
      
      if (!transactionType) {
        // Fall back to category lookup
        transactionType = getCategoryType(transaction.categoryName);
      }
      
      if (transactionType === 'expense') {
        // Should be negative
        newAmount = -Math.abs(currentAmount);
        if (currentAmount > 0) {
          needsUpdate = true;
          console.log(`💸 ${transaction.categoryName} (expense): ${centsToDisplay(currentAmount)} → ${centsToDisplay(newAmount)}`);
        }
      } else if (transactionType === 'income') {
        // Should be positive
        newAmount = Math.abs(currentAmount);
        if (currentAmount < 0) {
          needsUpdate = true;
          console.log(`💰 ${transaction.categoryName} (income): ${centsToDisplay(currentAmount)} → ${centsToDisplay(newAmount)}`);
        }
      } else {
        console.log(`⚠️  Unknown transaction type for: ${transaction.categoryName} (type: ${transactionType})`);
      }
      
      // Update if needed
      if (needsUpdate) {
        batch.update(doc.ref, { amount: newAmount });
        totalConverted++;
        batchCount++;
        
        // Commit batch every 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
          console.log(`📦 Committed batch - ${totalConverted} converted so far`);
        }
      }
    }
    
    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit();
      console.log(`📦 Committed final batch`);
    }
    
    console.log(`✅ Conversion complete!`);
    console.log(`📊 Total processed: ${totalProcessed}`);
    console.log(`🔄 Total converted: ${totalConverted}`);
    
    // Calculate new balances
    await calculateFinalBalances();
    
  } catch (error) {
    console.error('❌ Error during conversion:', error);
    throw error;
  }
}

async function calculateFinalBalances() {
  console.log('\n💰 Calculating final balances...');
  
  try {
    const transactionsRef = db.collection('transactions');
    const snapshot = await transactionsRef.get();
    
    const balances = {};
    
    snapshot.docs.forEach(doc => {
      const transaction = doc.data();
      if (transaction.accountName && transaction.amount) {
        if (!balances[transaction.accountName]) {
          balances[transaction.accountName] = { total: 0, count: 0 };
        }
        balances[transaction.accountName].total += transaction.amount;
        balances[transaction.accountName].count++;
      }
    });
    
    let grandTotal = 0;
    console.log('\n📊 Final Account Balances:');
    console.log('='.repeat(50));
    
    Object.entries(balances).forEach(([accountName, data]) => {
      const displayAmount = centsToDisplay(data.total);
      console.log(`${accountName}: $${displayAmount} MXN (${data.count} transactions)`);
      grandTotal += data.total;
    });
    
    console.log('='.repeat(50));
    console.log(`💎 Grand Total: $${centsToDisplay(grandTotal)} MXN`);
    console.log(`🎯 Target: ~$184,515 MXN`);
    
    if (Math.abs(grandTotal - dollarsToCents(184515)) < dollarsToCents(5000)) {
      console.log('✅ Balance within expected range!');
    } else {
      console.log('⚠️  Balance outside expected range - review needed');
    }
    
  } catch (error) {
    console.error('❌ Error calculating balances:', error);
  }
}

// Run the conversion
if (import.meta.url === `file://${process.argv[1]}`) {
  convertTransactionSigns()
    .then(() => {
      console.log('🎉 Conversion process completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Conversion failed:', error);
      process.exit(1);
    });
}

export { convertTransactionSigns, getCategoryType, loadCategoryTypes };