#!/usr/bin/env node

/**
 * Check transaction date ranges to understand the data
 */

import { getDb } from '../firebase.js';

async function checkTransactionDates() {
  console.log('🔍 Checking transaction date ranges...\n');
  
  try {
    const db = await getDb();
    const snapshot = await db.collection('clients/MTC/transactions').get();
    
    let earliestDate = null;
    let latestDate = null;
    const yearCounts = {};
    const yearBalances = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      let date = null;
      
      // Handle different date formats
      if (data.date) {
        if (data.date._seconds) {
          date = new Date(data.date._seconds * 1000);
        } else if (data.date.toDate) {
          date = data.date.toDate();
        } else {
          date = new Date(data.date);
        }
      }
      
      if (date && !isNaN(date.getTime())) {
        if (!earliestDate || date < earliestDate) earliestDate = date;
        if (!latestDate || date > latestDate) latestDate = date;
        
        const year = date.getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
        yearBalances[year] = (yearBalances[year] || 0) + amount;
      }
    });
    
    console.log('📅 DATE RANGE:');
    console.log(`Earliest: ${earliestDate ? earliestDate.toISOString().split('T')[0] : 'Unknown'}`);
    console.log(`Latest: ${latestDate ? latestDate.toISOString().split('T')[0] : 'Unknown'}`);
    
    console.log('\n📊 TRANSACTIONS BY YEAR:');
    Object.keys(yearCounts).sort().forEach(year => {
      const balance = yearBalances[year] / 100;
      console.log(`${year}: ${yearCounts[year]} transactions, Balance: $${balance.toFixed(2)}`);
    });
    
    // Check 2024 specifically
    console.log('\n🎯 2024 ANALYSIS:');
    const snapshot2024 = await db.collection('clients/MTC/transactions')
      .where('date', '>=', new Date('2024-01-01'))
      .where('date', '<=', new Date('2024-12-31'))
      .get();
    
    let balance2024 = 0;
    let income2024 = 0;
    let expense2024 = 0;
    
    snapshot2024.forEach(doc => {
      const amount = doc.data().amount || 0;
      balance2024 += amount;
      if (amount > 0) income2024 += amount;
      else expense2024 += amount;
    });
    
    console.log(`2024 Transactions: ${snapshot2024.size}`);
    console.log(`2024 Income: $${(income2024 / 100).toFixed(2)}`);
    console.log(`2024 Expenses: $${(expense2024 / 100).toFixed(2)}`);
    console.log(`2024 Net Balance: $${(balance2024 / 100).toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTransactionDates();