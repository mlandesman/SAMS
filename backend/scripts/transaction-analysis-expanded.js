#!/usr/bin/env node

/**
 * Expanded transaction analysis to identify conversion patterns
 */

import { getDb } from '../firebase.js';

async function expandedTransactionAnalysis() {
  console.log('🔍 Expanded Transaction Analysis...');
  
  try {
    const db = await getDb();
    
    // Get all transactions
    console.log('📥 Fetching all transactions...');
    const snapshot = await db.collection('clients/MTC/transactions').get();
    
    console.log(`\n📊 Analyzing ${snapshot.size} transactions...\n`);
    
    const analysis = {
      total: 0,
      byRange: {
        zero: [],
        under100: [],      // Likely wrong if positive
        under1000: [],     
        under10000: [],    // Very suspicious 
        over10000: [],     
        over100000: [],    // Definitely cents
        over1000000: []    
      },
      byCategory: {},
      incomeTransactions: [],
      expenseTransactions: [],
      suspiciousTransactions: []
    };
    
    // Income categories to watch for
    const incomeKeywords = ['hoa', 'dues', 'assessment', 'income', 'rental', 'special'];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      const absAmount = Math.abs(amount);
      const category = (data.categoryName || data.category || 'Unknown').toLowerCase();
      const isIncome = amount > 0;
      const hasIncomeKeyword = incomeKeywords.some(keyword => category.includes(keyword));
      
      analysis.total++;
      
      // Categorize by amount
      if (absAmount === 0) {
        analysis.byRange.zero.push({ id: doc.id, amount, category, data });
      } else if (absAmount < 100) {
        analysis.byRange.under100.push({ id: doc.id, amount, category, data });
      } else if (absAmount < 1000) {
        analysis.byRange.under1000.push({ id: doc.id, amount, category, data });
      } else if (absAmount < 10000) {
        analysis.byRange.under10000.push({ id: doc.id, amount, category, data });
      } else if (absAmount < 100000) {
        analysis.byRange.over10000.push({ id: doc.id, amount, category, data });
      } else if (absAmount < 1000000) {
        analysis.byRange.over100000.push({ id: doc.id, amount, category, data });
      } else {
        analysis.byRange.over1000000.push({ id: doc.id, amount, category, data });
      }
      
      // Track by category
      if (!analysis.byCategory[category]) {
        analysis.byCategory[category] = { count: 0, amounts: [], avgAmount: 0 };
      }
      analysis.byCategory[category].count++;
      analysis.byCategory[category].amounts.push(absAmount);
      
      // Track income vs expense
      if (isIncome || hasIncomeKeyword) {
        analysis.incomeTransactions.push({ id: doc.id, amount, category, data });
      } else {
        analysis.expenseTransactions.push({ id: doc.id, amount, category, data });
      }
      
      // Flag suspicious transactions
      if ((absAmount > 10 && absAmount < 10000) || hasIncomeKeyword) {
        analysis.suspiciousTransactions.push({
          id: doc.id,
          amount,
          category,
          reason: absAmount < 10000 ? 'Small amount - likely unconverted' : 'Income category',
          data
        });
      }
    });
    
    // Calculate category averages
    Object.keys(analysis.byCategory).forEach(cat => {
      const amounts = analysis.byCategory[cat].amounts;
      analysis.byCategory[cat].avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    });
    
    // Generate report
    console.log('📋 ANALYSIS RESULTS');
    console.log('=' .repeat(50));
    
    console.log('\n💰 AMOUNT DISTRIBUTION:');
    console.log(`Zero: ${analysis.byRange.zero.length}`);
    console.log(`Under 100: ${analysis.byRange.under100.length} ${analysis.byRange.under100.length > 0 ? '⚠️' : ''}`);
    console.log(`100-1,000: ${analysis.byRange.under1000.length} ${analysis.byRange.under1000.length > 0 ? '⚠️' : ''}`);
    console.log(`1,000-10,000: ${analysis.byRange.under10000.length} ${analysis.byRange.under10000.length > 0 ? '🚨 SUSPICIOUS' : ''}`);
    console.log(`10,000-100,000: ${analysis.byRange.over10000.length}`);
    console.log(`100,000-1,000,000: ${analysis.byRange.over100000.length}`);
    console.log(`Over 1,000,000: ${analysis.byRange.over1000000.length}`);
    
    console.log('\n📈 TRANSACTION TYPES:');
    console.log(`Income: ${analysis.incomeTransactions.length}`);
    console.log(`Expense: ${analysis.expenseTransactions.length}`);
    console.log(`Suspicious: ${analysis.suspiciousTransactions.length}`);
    
    // Show suspicious transactions
    if (analysis.suspiciousTransactions.length > 0) {
      console.log('\n🚨 SUSPICIOUS TRANSACTIONS (First 10):');
      analysis.suspiciousTransactions.slice(0, 10).forEach(txn => {
        const date = txn.data.date ? new Date(txn.data.date._seconds * 1000).toISOString().split('T')[0] : 'Unknown';
        console.log(`  ${txn.id.substring(0, 20)} | ${txn.amount.toString().padEnd(8)} | ${txn.category.padEnd(15)} | ${txn.reason}`);
      });
    }
    
    // Show categories with small amounts
    console.log('\n📊 CATEGORIES WITH SMALL AMOUNTS:');
    Object.entries(analysis.byCategory)
      .filter(([cat, stats]) => stats.avgAmount < 10000 && stats.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .forEach(([cat, stats]) => {
        console.log(`  ${cat.padEnd(20)} | Count: ${stats.count.toString().padEnd(3)} | Avg: ${stats.avgAmount.toFixed(2)}`);
      });
    
    console.log('\n✅ Analysis complete.');
    
    return analysis;
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

expandedTransactionAnalysis();