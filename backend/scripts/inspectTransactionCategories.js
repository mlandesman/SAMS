// Script to inspect transaction categories in MTC
// Run with: node backend/scripts/inspectTransactionCategories.js

import { initializeFirebase, getDb } from '../firebase.js';

async function inspectCategories() {
  try {
    console.log('🔥 Initializing Firebase...');
    await initializeFirebase();
    const db = await getDb();
    
    const clientId = 'MTC';
    console.log(`📊 Inspecting transactions for client: ${clientId}`);
    
    // Get all transactions
    const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
    const transactionsSnapshot = await transactionsRef.get();
    
    console.log(`📋 Found ${transactionsSnapshot.size} total transactions`);
    
    // Collect all unique categories
    const categories = new Set();
    const categoryCounts = {};
    const sampleTransactions = [];
    
    transactionsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const category = data.category || '(no category)';
      categories.add(category);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      
      // Collect sample transactions that might be project-related
      const categoryLower = category.toLowerCase();
      const notesLower = (data.notes || '').toLowerCase();
      const vendorLower = (data.vendor || '').toLowerCase();
      
      if (categoryLower.includes('project') || 
          categoryLower.includes('special') ||
          categoryLower.includes('assessment') ||
          notesLower.includes('propane') ||
          notesLower.includes('elevator') ||
          notesLower.includes('roof') ||
          notesLower.includes('column') ||
          vendorLower.includes('jorge juan') ||
          vendorLower.includes('irbin') ||
          vendorLower.includes('vertical city') ||
          vendorLower.includes('omar peña')) {
        sampleTransactions.push({
          transactionId: doc.id,
          date: data.date,
          category: category,
          vendor: data.vendor || '',
          amount: data.amount || 0,
          notes: data.notes || '',
          unitId: data.unitId || ''
        });
      }
    });
    
    console.log('\n📊 All Categories Found:');
    const sortedCategories = Array.from(categories).sort();
    sortedCategories.forEach(cat => {
      console.log(`  ${cat}: ${categoryCounts[cat]} transactions`);
    });
    
    console.log('\n🔍 Sample Project-Related Transactions:');
    sampleTransactions.slice(0, 20).forEach(tx => {
      console.log(`\n  TransactionId: ${tx.transactionId}`);
      console.log(`    Date: ${tx.date}`);
      console.log(`    Category: ${tx.category}`);
      console.log(`    Vendor: ${tx.vendor}`);
      console.log(`    Amount: ${tx.amount} centavos (M$${(tx.amount / 100).toFixed(2)})`);
      console.log(`    UnitId: ${tx.unitId}`);
      console.log(`    Notes: ${tx.notes}`);
    });
    
    if (sampleTransactions.length > 20) {
      console.log(`\n  ... and ${sampleTransactions.length - 20} more potential matches`);
    }
    
    console.log('\n✅ Inspection complete!');
    
  } catch (error) {
    console.error('❌ Error inspecting categories:', error);
    process.exit(1);
  }
}

inspectCategories();

