#!/usr/bin/env node

/**
 * Analyze how signs are being applied in the import
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Copy functions from import script
function getCategoryType(categoryName) {
  const incomeCategories = [
    'HOA Dues',
    'Account Credit',
    'Special Assessments',
    'Colonos Fee',
    'Interest Income',
    'Late Fees',
    'Penalty Fees',
    'Rental Income',
    'Service Fees'
  ];
  
  const normalized = categoryName.toLowerCase().trim();
  
  if (incomeCategories.some(income => 
    normalized.includes(income.toLowerCase())
  )) {
    return 'income';
  }
  
  return 'expense';
}

function applyAccountingSign(amount, categoryType) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 0;
  }
  
  // Income should be positive, expenses should be negative
  if (categoryType === 'income') {
    return Math.abs(amount);
  } else {
    return -Math.abs(amount);
  }
}

function analyzeSignApplication() {
  console.log('🔍 Analyzing sign application logic...\n');
  
  try {
    const transactionsPath = join(__dirname, '../../MTCdata/Transactions.json');
    const sourceData = JSON.parse(readFileSync(transactionsPath, 'utf8'));
    
    let expectedTotal = 0;
    let simulatedTotal = 0;
    const issues = [];
    
    sourceData.forEach((txn, index) => {
      const sourceAmount = txn.Amount || 0;
      const centavosAmount = sourceAmount * 100;
      const categoryType = getCategoryType(txn.Category);
      const finalAmount = applyAccountingSign(centavosAmount, categoryType);
      
      expectedTotal += centavosAmount;
      simulatedTotal += finalAmount;
      
      // Check for sign changes
      if (sourceAmount > 0 && finalAmount < 0) {
        issues.push({
          index,
          vendor: txn.Vendor,
          category: txn.Category,
          sourceAmount,
          centavosAmount,
          finalAmount,
          categoryType,
          issue: 'Positive amount made negative'
        });
      } else if (sourceAmount < 0 && finalAmount > 0) {
        issues.push({
          index,
          vendor: txn.Vendor,
          category: txn.Category,
          sourceAmount,
          centavosAmount,
          finalAmount,
          categoryType,
          issue: 'Negative amount made positive'
        });
      }
    });
    
    console.log('💰 TOTALS ANALYSIS:');
    console.log(`Expected total (source × 100): ${expectedTotal} cents ($${(expectedTotal / 100).toFixed(2)})`);
    console.log(`Simulated total (after sign logic): ${simulatedTotal} cents ($${(simulatedTotal / 100).toFixed(2)})`);
    console.log(`Difference: ${simulatedTotal - expectedTotal} cents ($${((simulatedTotal - expectedTotal) / 100).toFixed(2)})\n`);
    
    if (issues.length > 0) {
      console.log(`⚠️  SIGN ISSUES FOUND: ${issues.length}\n`);
      
      // Group by issue type
      const positiveToNegative = issues.filter(i => i.issue === 'Positive amount made negative');
      const negativeToPositive = issues.filter(i => i.issue === 'Negative amount made positive');
      
      if (positiveToNegative.length > 0) {
        console.log('❌ POSITIVE AMOUNTS MADE NEGATIVE:');
        console.log(`Count: ${positiveToNegative.length}`);
        const totalFlipped = positiveToNegative.reduce((sum, i) => sum + i.sourceAmount, 0);
        console.log(`Total amount flipped: $${totalFlipped.toFixed(2)}`);
        console.log(`Impact: $${(totalFlipped * 2).toFixed(2)} reduction in balance\n`);
        
        console.log('First 5 examples:');
        positiveToNegative.slice(0, 5).forEach(item => {
          console.log(`  • ${item.vendor} (${item.category})`);
          console.log(`    Source: $${item.sourceAmount} → Final: ${item.finalAmount} cents`);
          console.log(`    Category type: ${item.categoryType}`);
        });
      }
      
      if (negativeToPositive.length > 0) {
        console.log('\n✅ NEGATIVE AMOUNTS MADE POSITIVE:');
        console.log(`Count: ${negativeToPositive.length}`);
        console.log('First 5 examples:');
        negativeToPositive.slice(0, 5).forEach(item => {
          console.log(`  • ${item.vendor} (${item.category})`);
          console.log(`    Source: $${item.sourceAmount} → Final: ${item.finalAmount} cents`);
          console.log(`    Category type: ${item.categoryType}`);
        });
      }
    }
    
    // Check specific problematic categories
    console.log('\n🔍 PROBLEMATIC CATEGORY DETAILS:');
    ['Transfers', 'Bank Adjustments', 'Other', 'Colonos Fee'].forEach(category => {
      const transactions = sourceData.filter(t => t.Category === category);
      if (transactions.length > 0) {
        const categoryType = getCategoryType(category);
        const totalSource = transactions.reduce((sum, t) => sum + (t.Amount || 0), 0);
        console.log(`\n"${category}" (classified as: ${categoryType}):`);
        console.log(`  Transactions: ${transactions.length}`);
        console.log(`  Total in source: $${totalSource.toFixed(2)}`);
        console.log(`  Sample transactions:`);
        transactions.slice(0, 3).forEach(t => {
          console.log(`    • $${t.Amount} - ${t.Vendor}`);
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeSignApplication();