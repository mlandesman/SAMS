#!/usr/bin/env node

import fs from 'fs';

function generateCategoryId(categoryName) {
  if (!categoryName) return 'cat-other';
  const result = `cat-${categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
  console.log(`Category: '${categoryName}' -> '${result}'`);
  return result;
}

function generateTransactionId(transaction, index) {
  const date = new Date(transaction.Date);
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const identifier = (transaction.Category || transaction.Vendor || 'txn')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);
  const result = `${dateStr}-${identifier}-${index}`;
  console.log(`Transaction ID: '${result}'`);
  return result;
}

// Test with first few transactions
const data = JSON.parse(fs.readFileSync('../MTCdata/Transactions.json', 'utf-8'));
data.slice(0, 3).forEach((t, i) => {
  console.log(`\n--- Transaction ${i} ---`);
  generateCategoryId(t.Category);
  generateTransactionId(t, i);
});