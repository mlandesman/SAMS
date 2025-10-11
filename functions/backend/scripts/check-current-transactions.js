#!/usr/bin/env node

/**
 * Simple script to check current transaction data and balance
 */

import { getDb } from '../firebase.js';

async function checkCurrentTransactions() {
  console.log('🔍 Checking current transaction data...\n');
  
  try {
    const db = await getDb();
    
    // Get all transactions
    const snapshot = await db.collection('clients/MTC/transactions').get();
    
    console.log(`Total transactions: ${snapshot.size}\n`);
    
    let totalBalance = 0;
    let incomeTotal = 0;
    let expenseTotal = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    let suspiciousCount = 0;
    const amountSamples = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      
      totalBalance += amount;
      
      if (amount > 0) {
        incomeTotal += amount;
        incomeCount++;
      } else {
        expenseTotal += amount;
        expenseCount++;
      }
      
      // Check for suspicious amounts (likely in dollars not cents)
      const absAmount = Math.abs(amount);
      if (absAmount > 0 && absAmount < 10000) {
        suspiciousCount++;
      }
      
      // Collect first 10 samples
      if (amountSamples.length < 10) {
        amountSamples.push({
          id: doc.id,
          amount: amount,
          category: data.categoryName || data.category || 'Unknown',
          date: data.date
        });
      }
    });
    
    console.log('💰 BALANCE SUMMARY:');
    console.log(`Total Balance: ${totalBalance} (${(totalBalance / 100).toFixed(2)} if in cents)`);
    console.log(`Income Total: ${incomeTotal} (${(incomeTotal / 100).toFixed(2)} if in cents)`);
    console.log(`Expense Total: ${expenseTotal} (${(expenseTotal / 100).toFixed(2)} if in cents)`);
    
    console.log('\n📊 TRANSACTION COUNTS:');
    console.log(`Income Transactions: ${incomeCount}`);
    console.log(`Expense Transactions: ${expenseCount}`);
    console.log(`Suspicious Small Amounts: ${suspiciousCount} ⚠️`);
    
    console.log('\n🔍 SAMPLE TRANSACTIONS:');
    amountSamples.forEach(sample => {
      console.log(`ID: ${sample.id}`);
      console.log(`  Amount: ${sample.amount} (${(sample.amount / 100).toFixed(2)} if in cents)`);
      console.log(`  Category: ${sample.category}`);
      console.log('');
    });
    
    // Check for amount patterns
    const amounts = [];
    snapshot.forEach(doc => {
      const amount = Math.abs(doc.data().amount || 0);
      if (amount > 0) amounts.push(amount);
    });
    
    amounts.sort((a, b) => a - b);
    
    console.log('\n📈 AMOUNT DISTRIBUTION:');
    console.log(`Min: ${amounts[0]} (${(amounts[0] / 100).toFixed(2)} if in cents)`);
    console.log(`Max: ${amounts[amounts.length - 1]} (${(amounts[amounts.length - 1] / 100).toFixed(2)} if in cents)`);
    console.log(`Median: ${amounts[Math.floor(amounts.length / 2)]} (${(amounts[Math.floor(amounts.length / 2)] / 100).toFixed(2)} if in cents)`);
    
    // Count by ranges
    const ranges = {
      under100: amounts.filter(a => a < 100).length,
      under1000: amounts.filter(a => a >= 100 && a < 1000).length,
      under10000: amounts.filter(a => a >= 1000 && a < 10000).length,
      under100000: amounts.filter(a => a >= 10000 && a < 100000).length,
      over100000: amounts.filter(a => a >= 100000).length
    };
    
    console.log('\n💵 AMOUNT RANGES:');
    console.log(`Under 100: ${ranges.under100} (likely < $1 if in cents)`);
    console.log(`100-1,000: ${ranges.under1000} (likely $1-$10 if in cents)`);
    console.log(`1,000-10,000: ${ranges.under10000} (likely $10-$100 if in cents) ⚠️`);
    console.log(`10,000-100,000: ${ranges.under100000} (likely $100-$1,000 if in cents)`);
    console.log(`Over 100,000: ${ranges.over100000} (likely over $1,000 if in cents)`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCurrentTransactions();