#!/usr/bin/env node

/**
 * Check how categories are being classified
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Copy of the function from import script
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

function checkCategoryClassification() {
  console.log('🔍 Checking category classification...\n');
  
  try {
    // Load source data
    const transactionsPath = join(__dirname, '../../MTCdata/Transactions.json');
    const sourceData = JSON.parse(readFileSync(transactionsPath, 'utf8'));
    
    // Track categories
    const categoryStats = {};
    let misclassified = [];
    
    sourceData.forEach(txn => {
      const category = txn.Category || 'Unknown';
      const amount = txn.Amount || 0;
      const expectedType = amount >= 0 ? 'income' : 'expense';
      const classifiedType = getCategoryType(category);
      
      if (!categoryStats[category]) {
        categoryStats[category] = {
          count: 0,
          totalAmount: 0,
          positiveCount: 0,
          negativeCount: 0,
          classification: classifiedType
        };
      }
      
      categoryStats[category].count++;
      categoryStats[category].totalAmount += amount;
      if (amount >= 0) categoryStats[category].positiveCount++;
      else categoryStats[category].negativeCount++;
      
      // Check for misclassification
      if (amount > 0 && classifiedType === 'expense') {
        misclassified.push({
          category,
          amount,
          vendor: txn.Vendor,
          expected: 'income',
          classified: 'expense'
        });
      }
    });
    
    console.log('📊 CATEGORY ANALYSIS:\n');
    
    // Show all categories with positive amounts that are classified as expenses
    console.log('⚠️  POSITIVE AMOUNTS CLASSIFIED AS EXPENSES:');
    Object.entries(categoryStats)
      .filter(([cat, stats]) => stats.positiveCount > 0 && stats.classification === 'expense')
      .forEach(([category, stats]) => {
        console.log(`\n"${category}":`);
        console.log(`  Classification: ${stats.classification}`);
        console.log(`  Total transactions: ${stats.count}`);
        console.log(`  Positive amounts: ${stats.positiveCount}`);
        console.log(`  Total amount: $${stats.totalAmount.toFixed(2)}`);
      });
    
    console.log('\n✅ INCOME CATEGORIES (correctly classified):');
    Object.entries(categoryStats)
      .filter(([cat, stats]) => stats.classification === 'income')
      .forEach(([category, stats]) => {
        console.log(`  • ${category}: ${stats.count} transactions, $${stats.totalAmount.toFixed(2)}`);
      });
    
    if (misclassified.length > 0) {
      console.log(`\n❌ MISCLASSIFIED TRANSACTIONS: ${misclassified.length}`);
      console.log('\nFirst 10 examples:');
      misclassified.slice(0, 10).forEach(item => {
        console.log(`  • ${item.vendor}: $${item.amount} (${item.category}) - classified as ${item.classified}, should be ${item.expected}`);
      });
      
      // Calculate impact
      const misclassifiedTotal = misclassified.reduce((sum, item) => sum + item.amount, 0);
      console.log(`\n💰 MISCLASSIFICATION IMPACT:`);
      console.log(`Total amount misclassified: $${misclassifiedTotal.toFixed(2)}`);
      console.log(`This amount × 2 = $${(misclassifiedTotal * 2).toFixed(2)} (matches the discrepancy!)`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCategoryClassification();