#!/usr/bin/env node

/**
 * Quick check of transaction amounts to identify conversion issues
 */

import { getDb } from '../firebase.js';

async function quickTransactionCheck() {
  console.log('🔍 Quick Transaction Amount Check...');
  
  try {
    const db = await getDb();
    const snapshot = await db.collection('clients/MTC/transactions')
      .orderBy('created', 'desc')
      .limit(20)
      .get();
    
    console.log('\n📊 Last 20 Transactions:');
    console.log('ID'.padEnd(25) + 'Amount'.padEnd(12) + 'Category'.padEnd(20) + 'Date');
    console.log('-'.repeat(80));
    
    const amounts = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      const category = data.categoryName || data.category || 'Unknown';
      const date = data.date ? new Date(data.date._seconds * 1000).toISOString().split('T')[0] : 'Unknown';
      
      amounts.push(Math.abs(amount));
      
      console.log(
        doc.id.substring(0, 24).padEnd(25) + 
        amount.toString().padEnd(12) + 
        category.substring(0, 19).padEnd(20) + 
        date
      );
    });
    
    // Quick statistics
    console.log('\n📈 Quick Stats:');
    console.log(`Total transactions checked: ${amounts.length}`);
    console.log(`Average amount: ${(amounts.reduce((a, b) => a + b, 0) / amounts.length).toFixed(2)}`);
    console.log(`Min amount: ${Math.min(...amounts)}`);
    console.log(`Max amount: ${Math.max(...amounts)}`);
    console.log(`Under 10,000: ${amounts.filter(a => a > 0 && a < 10000).length} ⚠️`);
    console.log(`Over 100,000: ${amounts.filter(a => a > 100000).length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

quickTransactionCheck();