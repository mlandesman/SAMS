#!/usr/bin/env node

/**
 * TRANS-004: Analyze Transaction Cents Conversion Inconsistencies
 * 
 * This script analyzes all transactions to identify:
 * 1. Transactions likely still in dollars (unconverted)
 * 2. Income categories that were skipped during conversion
 * 3. Suspicious amounts that need manual review
 * 4. Overall data consistency patterns
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';

const INCOME_CATEGORIES = [
  'HOA Dues', 
  'Special Assessment', 
  'Special Assessments', 
  'hoa_dues', 
  'special_assessment',
  'Income',
  'Rental Income',
  'Other Income'
];

/**
 * Analyze transaction data for cents conversion inconsistencies
 */
async function analyzeTransactionCents(clientId = 'MTC') {
  console.log('🔍 Starting Transaction Cents Analysis for client:', clientId);
  console.log('=' .repeat(60));
  
  try {
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/transactions`).get();
    
    const analysis = {
      totalTransactions: 0,
      incomeTransactions: 0,
      expenseTransactions: 0,
      suspiciousAmounts: [],
      incomeCategories: new Set(),
      expenseCategories: new Set(),
      amountRanges: {
        zero: 0,
        under100: 0,      // Likely in dollars if positive
        under1000: 0,     // Possibly in dollars  
        under10000: 0,    // Suspicious range
        over10000: 0,     // Likely in cents
        over100000: 0,    // Definitely in cents
        over1000000: 0    // Large amounts in cents
      },
      conversionCandidates: [],
      categoryStats: {}
    };
    
    console.log(`📊 Processing ${snapshot.size} transactions...\n`);
    
    // Process each transaction
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = Math.abs(data.amount || 0);
      const category = data.categoryName || data.category || 'Unknown';
      const isIncome = (data.amount || 0) > 0;
      const isIncomeCategory = INCOME_CATEGORIES.some(cat => 
        category.toLowerCase().includes(cat.toLowerCase())
      );
      
      analysis.totalTransactions++;
      
      // Track income vs expense
      if (isIncome || isIncomeCategory) {
        analysis.incomeTransactions++;
        analysis.incomeCategories.add(category);
      } else {
        analysis.expenseTransactions++;
        analysis.expenseCategories.add(category);
      }
      
      // Categorize by amount ranges
      if (amount === 0) {
        analysis.amountRanges.zero++;
      } else if (amount < 100) {
        analysis.amountRanges.under100++;
      } else if (amount < 1000) {
        analysis.amountRanges.under1000++;
      } else if (amount < 10000) {
        analysis.amountRanges.under10000++;
      } else if (amount < 100000) {
        analysis.amountRanges.over10000++;
      } else if (amount < 1000000) {
        analysis.amountRanges.over100000++;
      } else {
        analysis.amountRanges.over1000000++;
      }
      
      // Track category statistics
      if (!analysis.categoryStats[category]) {
        analysis.categoryStats[category] = {
          count: 0,
          totalAmount: 0,
          avgAmount: 0,
          minAmount: Infinity,
          maxAmount: 0,
          incomeCount: 0,
          expenseCount: 0
        };
      }
      
      const catStats = analysis.categoryStats[category];
      catStats.count++;
      catStats.totalAmount += Math.abs(amount);
      catStats.minAmount = Math.min(catStats.minAmount, amount);
      catStats.maxAmount = Math.max(catStats.maxAmount, amount);
      
      if (isIncome || isIncomeCategory) {
        catStats.incomeCount++;
      } else {
        catStats.expenseCount++;
      }
      
      // Identify conversion candidates
      let needsConversion = false;
      let reason = '';
      
      // 1. Income categories were likely skipped during conversion
      if (isIncomeCategory) {
        needsConversion = true;
        reason = 'Income category likely unconverted';
      }
      // 2. Small positive amounts are suspicious (except tiny fees)
      else if (amount > 10 && amount < 10000) {
        needsConversion = true;
        reason = 'Amount suspiciously small - likely in dollars';
      }
      // 3. Round dollar amounts under 10k are suspicious
      else if (amount > 0 && amount < 10000 && amount % 100 === 0) {
        needsConversion = true;
        reason = 'Round dollar amount under 10k';
      }
      
      if (needsConversion) {
        analysis.conversionCandidates.push({
          id: doc.id,
          currentAmount: data.amount,
          absAmount: amount,
          proposedAmount: data.amount * 100,
          category: category,
          date: data.date,
          reason: reason,
          notes: data.notes || '',
          paymentMethod: data.paymentMethod || ''
        });
      }
      
      // Track suspicious amounts for manual review
      if (amount > 0 && amount < 50) {
        analysis.suspiciousAmounts.push({
          id: doc.id,
          amount: data.amount,
          category: category,
          date: data.date
        });
      }
    });
    
    // Calculate category averages
    Object.keys(analysis.categoryStats).forEach(category => {
      const stats = analysis.categoryStats[category];
      stats.avgAmount = stats.totalAmount / stats.count;
    });
    
    // Generate analysis report
    generateAnalysisReport(analysis);
    
    // Write audit log
    await writeAuditLog({
      module: 'transactionAnalysis',
      action: 'analyze_cents_conversion',
      parentPath: `clients/${clientId}`,
      docId: 'analysis',
      friendlyName: 'Transaction Cents Analysis',
      notes: `Analyzed ${analysis.totalTransactions} transactions, found ${analysis.conversionCandidates.length} conversion candidates`
    });
    
    return analysis;
    
  } catch (error) {
    console.error('❌ Error analyzing transactions:', error);
    throw error;
  }
}

/**
 * Generate detailed analysis report
 */
function generateAnalysisReport(analysis) {
  console.log('📋 TRANSACTION CENTS CONVERSION ANALYSIS REPORT');
  console.log('=' .repeat(60));
  
  // Overview
  console.log('\n📊 OVERVIEW:');
  console.log(`Total Transactions: ${analysis.totalTransactions}`);
  console.log(`Income Transactions: ${analysis.incomeTransactions}`);
  console.log(`Expense Transactions: ${analysis.expenseTransactions}`);
  console.log(`Conversion Candidates: ${analysis.conversionCandidates.length}`);
  console.log(`Suspicious Small Amounts: ${analysis.suspiciousAmounts.length}`);
  
  // Amount Distribution
  console.log('\n💰 AMOUNT DISTRIBUTION:');
  console.log(`Zero amounts: ${analysis.amountRanges.zero}`);
  console.log(`Under $1 (0-100): ${analysis.amountRanges.under100} ⚠️`);
  console.log(`Under $10 (100-1,000): ${analysis.amountRanges.under1000} ⚠️`);
  console.log(`Under $100 (1,000-10,000): ${analysis.amountRanges.under10000} ⚠️ SUSPICIOUS`);
  console.log(`$100-$1,000 (10,000-100,000): ${analysis.amountRanges.over10000}`);
  console.log(`$1,000-$10,000 (100,000-1,000,000): ${analysis.amountRanges.over100000}`);
  console.log(`Over $10,000 (1,000,000+): ${analysis.amountRanges.over1000000}`);
  
  // Income Categories
  console.log('\n📈 INCOME CATEGORIES FOUND:');
  Array.from(analysis.incomeCategories).forEach(cat => {
    const stats = analysis.categoryStats[cat];
    console.log(`  • ${cat}: ${stats.count} transactions, avg: ${stats.avgAmount.toFixed(2)}`);
  });
  
  // Top conversion candidates by category
  console.log('\n🔄 TOP CONVERSION CANDIDATES BY CATEGORY:');
  const candidatesByCategory = {};
  analysis.conversionCandidates.forEach(candidate => {
    if (!candidatesByCategory[candidate.category]) {
      candidatesByCategory[candidate.category] = [];
    }
    candidatesByCategory[candidate.category].push(candidate);
  });
  
  Object.keys(candidatesByCategory)
    .sort((a, b) => candidatesByCategory[b].length - candidatesByCategory[a].length)
    .slice(0, 10)
    .forEach(category => {
      const candidates = candidatesByCategory[category];
      const avgAmount = candidates.reduce((sum, c) => sum + c.absAmount, 0) / candidates.length;
      console.log(`  • ${category}: ${candidates.length} candidates, avg: ${avgAmount.toFixed(2)}`);
    });
  
  // Sample conversion candidates
  console.log('\n🔍 SAMPLE CONVERSION CANDIDATES:');
  analysis.conversionCandidates
    .slice(0, 10)
    .forEach(candidate => {
      console.log(`  • ID: ${candidate.id}`);
      console.log(`    Category: ${candidate.category}`);
      console.log(`    Current: ${candidate.currentAmount} → Proposed: ${candidate.proposedAmount}`);
      console.log(`    Reason: ${candidate.reason}`);
      console.log(`    Notes: ${candidate.notes || 'None'}`);
      console.log('');
    });
  
  // Warnings
  console.log('\n⚠️  CRITICAL FINDINGS:');
  const suspiciousCount = analysis.amountRanges.under10000;
  if (suspiciousCount > 0) {
    console.log(`❗ ${suspiciousCount} transactions under 10,000 units - likely unconverted dollars`);
  }
  
  const incomeConversions = analysis.conversionCandidates.filter(c => 
    c.reason.includes('Income category')
  ).length;
  if (incomeConversions > 0) {
    console.log(`❗ ${incomeConversions} income transactions likely need conversion`);
  }
  
  console.log('\n✅ Analysis complete. Review candidates before running conversion script.');
  console.log('=' .repeat(60));
}

// Execute analysis if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const clientId = process.argv[2] || 'MTC';
  analyzeTransactionCents(clientId).catch(console.error);
}

export { analyzeTransactionCents };