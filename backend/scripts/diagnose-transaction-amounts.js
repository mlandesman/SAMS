/**
 * Balance Calculation Diagnostic Script
 * DIAGNOSTIC ONLY - NO DATA MODIFICATIONS
 * 
 * Investigates the ~1000x balance inflation issue by analyzing:
 * 1. Transaction amount storage and conversion patterns
 * 2. HOA dues category income/expense inconsistencies  
 * 3. Balance calculation logic issues
 * 4. Currency conversion multipliers
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
 * Get random sample of transactions for analysis
 */
async function getRandomTransactions(sampleSize = 20, clientId = null) {
  console.log(`🔍 Fetching ${sampleSize} random transactions for analysis...`);
  
  try {
    let queryRef;
    if (clientId) {
      queryRef = db.collection('clients').doc(clientId).collection('transactions');
    } else {
      // Get transactions from all clients (flatten the nested structure)
      const clientsSnapshot = await db.collection('clients').get();
      const allTransactions = [];
      
      for (const clientDoc of clientsSnapshot.docs) {
        const transactionsSnapshot = await db.collection('clients')
          .doc(clientDoc.id)
          .collection('transactions')
          .limit(50) // Limit per client to avoid timeout
          .get();
        
        transactionsSnapshot.docs.forEach(transactionDoc => {
          allTransactions.push({
            id: transactionDoc.id,
            clientId: clientDoc.id,
            ...transactionDoc.data()
          });
        });
      }
      
      // Shuffle and take sample
      const shuffled = allTransactions.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, sampleSize);
    }
    
    const snapshot = await queryRef.limit(sampleSize * 3).get(); // Get more than needed for randomization
    const transactions = [];
    
    snapshot.docs.forEach(doc => {
      transactions.push({
        id: doc.id,
        clientId: clientId,
        ...doc.data()
      });
    });
    
    // Randomize and return sample
    const shuffled = transactions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, sampleSize);
    
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    return [];
  }
}

/**
 * Get HOA dues transactions for category analysis
 */
async function getHOADuesTransactions(clientId = null) {
  console.log(`🏠 Fetching HOA dues transactions for category analysis...`);
  
  try {
    const clientsSnapshot = await db.collection('clients').get();
    const hoaDuesTransactions = [];
    
    for (const clientDoc of clientsSnapshot.docs) {
      if (clientId && clientDoc.id !== clientId) continue;
      
      const transactionsSnapshot = await db.collection('clients')
        .doc(clientDoc.id)
        .collection('transactions')
        .get();
      
      transactionsSnapshot.docs.forEach(transactionDoc => {
        const transaction = transactionDoc.data();
        
        // Check if this is HOA dues related
        const isHOADues = (
          (transaction.categoryId && transaction.categoryId.toLowerCase().includes('hoa')) ||
          (transaction.categoryName && transaction.categoryName.toLowerCase().includes('hoa')) ||
          (transaction.category && transaction.category.toLowerCase().includes('hoa')) ||
          (transaction.description && transaction.description.toLowerCase().includes('hoa'))
        );
        
        if (isHOADues) {
          hoaDuesTransactions.push({
            id: transactionDoc.id,
            clientId: clientDoc.id,
            ...transaction
          });
        }
      });
    }
    
    return hoaDuesTransactions;
    
  } catch (error) {
    console.error('❌ Error fetching HOA dues transactions:', error);
    return [];
  }
}

/**
 * Analyze transaction amounts and conversions
 */
function analyzeTransactionAmount(transaction, index) {
  console.log(`\n📊 Transaction ${index + 1} Analysis:`);
  console.log(`  ID: ${transaction.id}`);
  console.log(`  Client: ${transaction.clientId}`);
  
  // Raw amount analysis
  const rawAmount = transaction.amount;
  console.log(`  Raw amount: ${rawAmount} (type: ${typeof rawAmount})`);
  
  // Currency analysis
  const currency = transaction.currency || 'Unknown';
  console.log(`  Currency: ${currency}`);
  
  // Category analysis 
  const categoryId = transaction.categoryId || transaction.category || 'Unknown';
  const categoryName = transaction.categoryName || 'Unknown';
  console.log(`  Category: ${categoryName} (ID: ${categoryId})`);
  
  // Account analysis
  const accountId = transaction.accountId || transaction.account || 'Unknown';
  const accountName = transaction.accountName || 'Unknown';
  const accountType = transaction.accountType || 'Unknown';
  console.log(`  Account: ${accountName} (ID: ${accountId}, Type: ${accountType})`);
  
  // Expected vs actual conversions
  const expectedDollars = (rawAmount / 100).toFixed(2);
  const expectedCents = rawAmount;
  console.log(`  Expected display (÷100): $${expectedDollars}`);
  console.log(`  Expected cents: ${expectedCents}`);
  
  // Check for potential multiplier issues
  if (typeof rawAmount === 'number') {
    const potentialIssues = [];
    
    // Check if amount is suspiciously large (indicating multiple conversions)
    if (rawAmount > 1000000) { // > $10,000 in cents
      potentialIssues.push('Amount suspiciously large (>$10,000)');
    }
    
    // Check if amount has decimal places (should be integer cents)
    if (rawAmount % 1 !== 0) {
      potentialIssues.push('Amount has decimal places (not integer cents)');
    }
    
    // Check for common multiplier errors
    if (rawAmount > 10000 && rawAmount % 10000 === 0) {
      potentialIssues.push('Possible 10000x multiplier error');
    }
    if (rawAmount > 1000 && rawAmount % 1000 === 0) {
      potentialIssues.push('Possible 1000x multiplier error');
    }
    if (rawAmount > 100 && rawAmount % 100 === 0) {
      potentialIssues.push('Possible 100x multiplier error');
    }
    
    if (potentialIssues.length > 0) {
      console.log(`  ⚠️ Potential Issues: ${potentialIssues.join(', ')}`);
    } else {
      console.log(`  ✅ Amount appears normal`);
    }
  }
  
  // Return analysis data
  return {
    id: transaction.id,
    clientId: transaction.clientId,
    rawAmount,
    currency,
    categoryId,
    categoryName,
    accountId,
    accountName,
    accountType,
    expectedDollars,
    issues: typeof rawAmount === 'number' ? [] : ['Non-numeric amount']
  };
}

/**
 * Analyze HOA dues category consistency
 */
function analyzeHOADuesCategory(transaction, index) {
  console.log(`\n🏠 HOA Dues Transaction ${index + 1}:`);
  console.log(`  ID: ${transaction.id}`);
  console.log(`  Client: ${transaction.clientId}`);
  
  // Category analysis
  const categoryId = transaction.categoryId || transaction.category || 'Unknown';
  const categoryName = transaction.categoryName || 'Unknown';
  const categoryType = transaction.categoryType || 'Unknown';
  console.log(`  Category: ${categoryName} (ID: ${categoryId})`);
  console.log(`  Category Type: ${categoryType}`);
  
  // Amount and sign analysis
  const rawAmount = transaction.amount;
  const isPositive = rawAmount > 0;
  const isNegative = rawAmount < 0;
  console.log(`  Amount: ${rawAmount} (${isPositive ? 'Positive' : isNegative ? 'Negative' : 'Zero'})`);
  
  // Transaction type analysis
  const transactionType = transaction.type || 'Unknown';
  console.log(`  Transaction Type: ${transactionType}`);
  
  // Consistency checks
  const inconsistencies = [];
  
  // HOA dues should typically be income category but often processed as expenses
  if (categoryType === 'income' && isNegative) {
    inconsistencies.push('Income category but negative amount');
  }
  if (categoryType === 'expense' && isPositive) {
    inconsistencies.push('Expense category but positive amount');
  }
  
  // Check description for context
  const description = transaction.description || '';
  console.log(`  Description: "${description}"`);
  
  if (inconsistencies.length > 0) {
    console.log(`  ⚠️ Inconsistencies: ${inconsistencies.join(', ')}`);
  } else {
    console.log(`  ✅ Category/amount consistent`);
  }
  
  return {
    id: transaction.id,
    clientId: transaction.clientId,
    categoryId,
    categoryName,
    categoryType,
    amount: rawAmount,
    isPositive,
    transactionType,
    description,
    inconsistencies
  };
}

/**
 * Simulate balance calculation with debug logging
 */
async function traceBalanceCalculation(clientId = null) {
  console.log(`\n💰 Balance Calculation Trace:`);
  
  try {
    // Get a client to test with
    if (!clientId) {
      const clientsSnapshot = await db.collection('clients').limit(1).get();
      if (clientsSnapshot.empty) {
        console.log('❌ No clients found for balance calculation test');
        return;
      }
      clientId = clientsSnapshot.docs[0].id;
    }
    
    console.log(`Testing balance calculation for client: ${clientId}`);
    
    // Get client data
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists()) {
      console.log('❌ Client not found');
      return;
    }
    
    const clientData = clientDoc.data();
    const accounts = clientData.accounts || [];
    console.log(`Client has ${accounts.length} accounts:`);
    
    accounts.forEach((account, i) => {
      console.log(`  ${i + 1}. ${account.name} (${account.type}): ${account.balance}`);
    });
    
    // Get recent transactions
    const transactionsSnapshot = await db.collection('clients')
      .doc(clientId)
      .collection('transactions')
      .orderBy('date', 'desc')
      .limit(10)
      .get();
    
    console.log(`\nProcessing ${transactionsSnapshot.size} recent transactions:`);
    
    let runningBalance = {
      cash: accounts.filter(a => a.type === 'cash').reduce((sum, a) => sum + (a.balance || 0), 0),
      bank: accounts.filter(a => a.type === 'bank').reduce((sum, a) => sum + (a.balance || 0), 0)
    };
    
    console.log(`Starting balances - Cash: ${runningBalance.cash}, Bank: ${runningBalance.bank}`);
    
    transactionsSnapshot.docs.forEach((doc, index) => {
      const transaction = doc.data();
      const amount = Number(transaction.amount || 0);
      
      console.log(`\n  Transaction ${index + 1}:`);
      console.log(`    Amount: ${amount}`);
      console.log(`    Account: ${transaction.accountId || transaction.account} (Type: ${transaction.accountType})`);
      
      // Determine account type
      let accountType = null;
      if (transaction.accountType) {
        accountType = transaction.accountType.toLowerCase();
      } else if (transaction.accountId && transaction.accountId.toLowerCase().includes('cash')) {
        accountType = 'cash';
      } else if (transaction.accountId && transaction.accountId.toLowerCase().includes('bank')) {
        accountType = 'bank';
      }
      
      console.log(`    Detected Type: ${accountType}`);
      
      if (accountType === 'cash' || accountType === 'bank') {
        const oldBalance = runningBalance[accountType];
        runningBalance[accountType] += amount;
        console.log(`    ${accountType} balance: ${oldBalance} + ${amount} = ${runningBalance[accountType]}`);
        
        // Check for suspicious changes
        const change = Math.abs(amount);
        if (change > 50000) { // > $500 in cents
          console.log(`    ⚠️ Large balance change: $${(change / 100).toFixed(2)}`);
        }
      } else {
        console.log(`    ⚠️ Could not determine account type for balance update`);
      }
    });
    
    console.log(`\nFinal calculated balances - Cash: ${runningBalance.cash}, Bank: ${runningBalance.bank}`);
    console.log(`Total: ${runningBalance.cash + runningBalance.bank}`);
    
    // Compare with stored balances
    const storedCash = accounts.filter(a => a.type === 'cash').reduce((sum, a) => sum + (a.balance || 0), 0);
    const storedBank = accounts.filter(a => a.type === 'bank').reduce((sum, a) => sum + (a.balance || 0), 0);
    
    console.log(`\nStored balances - Cash: ${storedCash}, Bank: ${storedBank}`);
    console.log(`Total stored: ${storedCash + storedBank}`);
    
    const cashDiff = Math.abs(runningBalance.cash - storedCash);
    const bankDiff = Math.abs(runningBalance.bank - storedBank);
    
    if (cashDiff > 100 || bankDiff > 100) { // > $1 difference
      console.log(`⚠️ Significant differences found:`);
      console.log(`  Cash difference: $${(cashDiff / 100).toFixed(2)}`);
      console.log(`  Bank difference: $${(bankDiff / 100).toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Error in balance calculation trace:', error);
  }
}

/**
 * Main diagnostic function
 */
async function diagnoseBulanceCalculations() {
  console.log('🔍 Starting Balance Calculation Diagnosis...');
  console.log('=====================================\n');
  
  try {
    // 1. Transaction Amount Analysis
    console.log('📊 TRANSACTION AMOUNT ANALYSIS:');
    console.log('==============================');
    
    const transactions = await getRandomTransactions(20);
    if (transactions.length === 0) {
      console.log('❌ No transactions found for analysis');
      return;
    }
    
    const transactionAnalysis = transactions.map((tx, index) => analyzeTransactionAmount(tx, index));
    
    // 2. HOA Dues Analysis
    console.log('\n\n🏠 HOA DUES ANALYSIS:');
    console.log('====================');
    
    const hoaDues = await getHOADuesTransactions();
    console.log(`Found ${hoaDues.length} HOA-related transactions`);
    
    if (hoaDues.length > 0) {
      const hoaAnalysis = hoaDues.slice(0, 10).map((tx, index) => analyzeHOADuesCategory(tx, index));
      
      // Summary of HOA inconsistencies
      const inconsistentHOA = hoaAnalysis.filter(h => h.inconsistencies.length > 0);
      console.log(`\n📋 HOA Summary: ${inconsistentHOA.length}/${hoaAnalysis.length} transactions have inconsistencies`);
    }
    
    // 3. Balance Calculation Trace
    console.log('\n\n💰 BALANCE CALCULATION TRACE:');
    console.log('=============================');
    
    await traceBalanceCalculation();
    
    // 4. Summary of Findings
    console.log('\n\n📋 DIAGNOSTIC SUMMARY:');
    console.log('=====================');
    
    // Analyze patterns in transaction amounts
    const numericAmounts = transactionAnalysis.filter(t => typeof t.rawAmount === 'number');
    const averageAmount = numericAmounts.reduce((sum, t) => sum + t.rawAmount, 0) / numericAmounts.length;
    const maxAmount = Math.max(...numericAmounts.map(t => t.rawAmount));
    const minAmount = Math.min(...numericAmounts.map(t => t.rawAmount));
    
    console.log(`Transaction Amount Statistics:`);
    console.log(`  Sample size: ${transactionAnalysis.length} transactions`);
    console.log(`  Numeric amounts: ${numericAmounts.length}`);
    console.log(`  Average amount: ${averageAmount.toFixed(0)} cents ($${(averageAmount / 100).toFixed(2)})`);
    console.log(`  Max amount: ${maxAmount} cents ($${(maxAmount / 100).toFixed(2)})`);
    console.log(`  Min amount: ${minAmount} cents ($${(minAmount / 100).toFixed(2)})`);
    
    // Check for multiplier patterns
    const largeAmounts = numericAmounts.filter(t => t.rawAmount > 100000); // > $1000
    if (largeAmounts.length > 0) {
      console.log(`\n⚠️ Large amounts found (>${1000}): ${largeAmounts.length} transactions`);
      largeAmounts.forEach(t => {
        console.log(`  ${t.id}: $${(t.rawAmount / 100).toFixed(2)} (${t.rawAmount} cents)`);
      });
    }
    
    // HOA dues summary
    if (hoaDues.length > 0) {
      const positiveHOA = hoaDues.filter(h => h.amount > 0);
      const negativeHOA = hoaDues.filter(h => h.amount < 0);
      console.log(`\nHOA Dues Summary:`);
      console.log(`  Total HOA transactions: ${hoaDues.length}`);
      console.log(`  Positive amounts: ${positiveHOA.length}`);
      console.log(`  Negative amounts: ${negativeHOA.length}`);
    }
    
    console.log('\n✅ Diagnostic analysis complete!');
    console.log('\n🔍 Key areas to investigate:');
    console.log('1. Transactions with amounts > $1000 (potential multiplier issues)');
    console.log('2. HOA dues with inconsistent category types vs amount signs');
    console.log('3. Balance calculation logic that may apply multiple conversions');
    console.log('4. Currency conversion functions that might be called multiple times');
    
  } catch (error) {
    console.error('❌ Error in diagnostic analysis:', error);
  } finally {
    process.exit(0);
  }
}

// Run the diagnostic
diagnoseBulanceCalculations();