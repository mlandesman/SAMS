/**
 * Display Sign Diagnostic Script
 * DIAGNOSTIC ONLY - NO DATA MODIFICATIONS
 * 
 * Investigates the negative display values issue by analyzing:
 * 1. Transaction amount signs in database vs display
 * 2. Income vs expense classification logic
 * 3. Balance calculation sign handling
 * 4. Frontend display conversion logic
 */

import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import path from 'path';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  await readFile(new URL('../serviceAccountKey.json', import.meta.url))
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://sams-8b2f5-default-rtdb.firebaseio.com/'
});

const db = admin.firestore();

/**
 * Get transactions with detailed sign analysis
 */
async function analyzeTransactionSigns(sampleSize = 20, clientId = null) {
  console.log(`🔍 Analyzing transaction signs and classifications...`);
  
  try {
    // Get client transactions
    if (!clientId) {
      const clientsSnapshot = await db.collection('clients').limit(1).get();
      if (clientsSnapshot.empty) {
        console.log('❌ No clients found');
        return [];
      }
      clientId = clientsSnapshot.docs[0].id;
    }
    
    console.log(`Analyzing client: ${clientId}`);
    
    const transactionsSnapshot = await db.collection('clients')
      .doc(clientId)
      .collection('transactions')
      .limit(sampleSize)
      .get();
    
    const transactions = [];
    transactionsSnapshot.docs.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return transactions;
    
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    return [];
  }
}

/**
 * Get categories with income/expense classification
 */
async function getCategoriesClassification(clientId) {
  console.log(`📋 Fetching category classifications...`);
  
  try {
    const categoriesSnapshot = await db.collection('clients')
      .doc(clientId)
      .collection('categories')
      .get();
    
    const categories = {};
    categoriesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      categories[data.name] = {
        id: doc.id,
        type: data.type || 'unknown',
        name: data.name
      };
    });
    
    return categories;
    
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    return {};
  }
}

/**
 * Analyze transaction sign logic
 */
function analyzeTransactionSign(transaction, categories, index) {
  console.log(`\n💰 Transaction ${index + 1} Sign Analysis:`);
  console.log(`  ID: ${transaction.id}`);
  
  // Amount analysis
  const rawAmount = transaction.amount;
  const isPositive = rawAmount > 0;
  const isNegative = rawAmount < 0;
  const absAmount = Math.abs(rawAmount);
  const displayAmount = (absAmount / 100).toFixed(2);
  
  console.log(`  Raw Amount: ${rawAmount} centavos`);
  console.log(`  Display Amount: $${displayAmount} MXN`);
  console.log(`  Sign: ${isPositive ? 'Positive' : isNegative ? 'Negative' : 'Zero'}`);
  
  // Category analysis
  const categoryName = transaction.categoryName || 'Unknown';
  const category = categories[categoryName];
  const categoryType = category ? category.type : 'unknown';
  
  console.log(`  Category: ${categoryName}`);
  console.log(`  Category Type: ${categoryType}`);
  
  // Transaction type analysis
  const transactionType = transaction.type || 'unknown';
  console.log(`  Transaction Type: ${transactionType}`);
  
  // Business logic analysis
  const expectedSign = getExpectedSign(categoryName, categoryType);
  const signIsCorrect = (expectedSign === 'positive' && isPositive) || 
                       (expectedSign === 'negative' && isNegative) ||
                       expectedSign === 'either';
  
  console.log(`  Expected Sign: ${expectedSign}`);
  console.log(`  Sign Correct: ${signIsCorrect ? '✅' : '❌'}`);
  
  // Special cases
  const specialNotes = [];
  
  // HOA Dues should be positive (income)
  if (categoryName.toLowerCase().includes('hoa') && isNegative) {
    specialNotes.push('HOA dues showing as negative (should be positive income)');
  }
  
  // Expenses should typically be negative (outflow)
  if (['maintenance', 'staff', 'utilities'].some(type => 
    categoryName.toLowerCase().includes(type)) && isPositive) {
    specialNotes.push('Expense showing as positive (should be negative outflow)');
  }
  
  // Very large amounts
  if (absAmount > 5000000) { // > $50,000 MXN
    specialNotes.push(`Very large amount: $${displayAmount} MXN`);
  }
  
  if (specialNotes.length > 0) {
    console.log(`  ⚠️ Special Notes: ${specialNotes.join(', ')}`);
  }
  
  return {
    id: transaction.id,
    rawAmount,
    displayAmount,
    sign: isPositive ? 'positive' : 'negative',
    categoryName,
    categoryType,
    expectedSign,
    signIsCorrect,
    specialNotes
  };
}

/**
 * Determine expected sign based on category
 */
function getExpectedSign(categoryName, categoryType) {
  const categoryLower = categoryName.toLowerCase();
  
  // HOA Dues are income (positive)
  if (categoryLower.includes('hoa')) {
    return 'positive';
  }
  
  // Account credits are positive
  if (categoryLower.includes('credit')) {
    return 'positive';
  }
  
  // Most other categories are expenses (negative)
  if (categoryLower.includes('maintenance') || 
      categoryLower.includes('staff') || 
      categoryLower.includes('utilities') ||
      categoryLower.includes('supplies')) {
    return 'negative';
  }
  
  // Use category type if available
  if (categoryType === 'income') {
    return 'positive';
  }
  if (categoryType === 'expense') {
    return 'negative';
  }
  
  return 'either';
}

/**
 * Analyze balance calculation with signs
 */
async function analyzeBalanceCalculationSigns(clientId) {
  console.log(`\n🧮 Balance Calculation Sign Analysis:`);
  
  try {
    // Get client with current balances
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      console.log('❌ Client not found');
      return;
    }
    
    const clientData = clientDoc.data();
    const accounts = clientData.accounts || [];
    
    console.log(`Client current balances:`);
    let totalBalance = 0;
    accounts.forEach((account, i) => {
      const balance = account.balance || 0;
      const displayBalance = (balance / 100).toFixed(2);
      console.log(`  ${account.name}: ${balance} centavos ($${displayBalance} MXN)`);
      totalBalance += balance;
    });
    
    const totalDisplay = (totalBalance / 100).toFixed(2);
    console.log(`  TOTAL: ${totalBalance} centavos ($${totalDisplay} MXN)`);
    
    // Get recent transactions to trace calculation
    const transactionsSnapshot = await db.collection('clients')
      .doc(clientId)
      .collection('transactions')
      .orderBy('date', 'desc')
      .limit(10)
      .get();
    
    console.log(`\nRecent transactions impact on balance:`);
    transactionsSnapshot.docs.forEach((doc, index) => {
      const transaction = doc.data();
      const amount = transaction.amount || 0;
      const displayAmount = (Math.abs(amount) / 100).toFixed(2);
      const sign = amount >= 0 ? '+' : '-';
      const categoryName = transaction.categoryName || 'Unknown';
      
      console.log(`  ${index + 1}. ${categoryName}: ${sign}$${displayAmount} MXN (${amount} centavos)`);
      
      // Check if this transaction would inflate balance incorrectly
      if (amount > 1000000) { // > $10,000 MXN
        console.log(`    ⚠️ Large positive impact on balance`);
      }
      if (amount < -1000000) { // < -$10,000 MXN  
        console.log(`    ⚠️ Large negative impact on balance`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error in balance calculation analysis:', error);
  }
}

/**
 * Main diagnostic function
 */
async function diagnoseDisplaySigns() {
  console.log('🔍 Starting Display Sign Diagnosis...');
  console.log('=======================================\n');
  
  try {
    // 1. Get sample transactions
    const transactions = await analyzeTransactionSigns(15);
    if (transactions.length === 0) {
      console.log('❌ No transactions found for analysis');
      return;
    }
    
    const clientId = 'MTC'; // Based on previous analysis
    
    // 2. Get category classifications
    const categories = await getCategoriesClassification(clientId);
    console.log(`Found ${Object.keys(categories).length} categories`);
    
    // 3. Analyze each transaction's sign logic
    console.log(`\n💰 TRANSACTION SIGN ANALYSIS:`);
    console.log('============================');
    
    const signAnalysis = transactions.map((tx, index) => 
      analyzeTransactionSign(tx, categories, index)
    );
    
    // 4. Balance calculation analysis
    await analyzeBalanceCalculationSigns(clientId);
    
    // 5. Summary of findings
    console.log(`\n\n📋 SIGN ANALYSIS SUMMARY:`);
    console.log('========================');
    
    const positiveTransactions = signAnalysis.filter(t => t.sign === 'positive');
    const negativeTransactions = signAnalysis.filter(t => t.sign === 'negative');
    const incorrectSigns = signAnalysis.filter(t => !t.signIsCorrect);
    
    console.log(`Transaction Sign Distribution:`);
    console.log(`  Positive amounts: ${positiveTransactions.length}`);
    console.log(`  Negative amounts: ${negativeTransactions.length}`);
    console.log(`  Incorrect signs: ${incorrectSigns.length}`);
    
    if (incorrectSigns.length > 0) {
      console.log(`\n⚠️ Transactions with incorrect signs:`);
      incorrectSigns.forEach(t => {
        console.log(`  ${t.id}: ${t.categoryName} (${t.sign}, expected ${t.expectedSign})`);
      });
    }
    
    // HOA specific analysis
    const hoaTransactions = signAnalysis.filter(t => 
      t.categoryName.toLowerCase().includes('hoa')
    );
    console.log(`\nHOA Dues Sign Analysis:`);
    console.log(`  Total HOA transactions: ${hoaTransactions.length}`);
    const negativeHOA = hoaTransactions.filter(t => t.sign === 'negative');
    console.log(`  Negative HOA transactions: ${negativeHOA.length}`);
    
    if (negativeHOA.length > 0) {
      console.log(`  ⚠️ HOA dues showing as negative (problem identified):`);
      negativeHOA.forEach(t => {
        console.log(`    ${t.id}: $${t.displayAmount} MXN`);
      });
    }
    
    console.log('\n✅ Display sign analysis complete!');
    console.log('\n🔍 Key findings:');
    console.log('1. Check if HOA dues are incorrectly showing as negative');
    console.log('2. Verify expense transactions are properly signed as negative');  
    console.log('3. Confirm balance calculation handles signs correctly');
    console.log('4. Review frontend display logic for sign conversion');
    
  } catch (error) {
    console.error('❌ Error in display sign analysis:', error);
  } finally {
    process.exit(0);
  }
}

// Run the diagnostic
diagnoseDisplaySigns();