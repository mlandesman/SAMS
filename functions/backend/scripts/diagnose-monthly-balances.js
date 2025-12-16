/**
 * Monthly Balance Diagnostic Script
 * DIAGNOSTIC ONLY - NO DATA MODIFICATIONS
 * 
 * Outputs Bank and Cash running balances at the start of each month
 * from Jan 2025 through current to identify when balances diverge.
 */

import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { DateTime } from 'luxon';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  await readFile(new URL('../serviceAccountKey.json', import.meta.url))
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://sams-8b2f5-default-rtdb.firebaseio.com/'
  });
}

const db = admin.firestore();
const CLIENT_ID = 'MTC';
const TIMEZONE = 'America/Cancun';

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Get all transactions for MTC, sorted by date
 */
async function getAllTransactions() {
  console.log('📊 Fetching all MTC transactions...');
  
  const transactionsRef = db.collection('clients').doc(CLIENT_ID).collection('transactions');
  const snapshot = await transactionsRef.orderBy('date', 'asc').get();
  
  const transactions = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    transactions.push({
      id: doc.id,
      ...data,
      // Normalize date to DateTime
      dateObj: data.date?.toDate ? 
        DateTime.fromJSDate(data.date.toDate(), { zone: TIMEZONE }) :
        DateTime.fromISO(data.date, { zone: TIMEZONE })
    });
  });
  
  console.log(`   Found ${transactions.length} transactions`);
  return transactions;
}

/**
 * Check for year-end balances (starting point)
 */
async function getYearEndBalances() {
  console.log('📊 Checking for year-end balances...');
  
  try {
    const yearEndRef = db.collection('clients').doc(CLIENT_ID).collection('yearEndBalances');
    const snapshot = await yearEndRef.get();
    
    const balances = {};
    snapshot.forEach(doc => {
      balances[doc.id] = doc.data();
    });
    
    if (Object.keys(balances).length > 0) {
      console.log(`   Found year-end balances for: ${Object.keys(balances).join(', ')}`);
    } else {
      console.log('   No year-end balances found');
    }
    
    return balances;
  } catch (error) {
    console.log('   Error fetching year-end balances:', error.message);
    return {};
  }
}

/**
 * Main diagnostic function
 */
async function runDiagnostic() {
  console.log('================================================================================');
  console.log('MTC MONTHLY BALANCE DIAGNOSTIC');
  console.log(`Generated: ${DateTime.now().setZone(TIMEZONE).toFormat('yyyy-MM-dd HH:mm:ss')}`);
  console.log('================================================================================\n');
  
  // Get year-end balances for context
  const yearEndBalances = await getYearEndBalances();
  
  // Get all transactions
  const transactions = await getAllTransactions();
  
  if (transactions.length === 0) {
    console.log('❌ No transactions found!');
    process.exit(1);
  }
  
  // Analyze account types present
  const accountTypes = new Set();
  const accountIds = new Set();
  transactions.forEach(t => {
    if (t.accountType) accountTypes.add(t.accountType);
    if (t.accountId) accountIds.add(t.accountId);
  });
  
  console.log(`\n📋 Account Types found: ${[...accountTypes].join(', ')}`);
  console.log(`📋 Account IDs found: ${[...accountIds].join(', ')}\n`);
  
  // Define month boundaries for 2025
  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push(DateTime.fromObject({ year: 2025, month: m, day: 1 }, { zone: TIMEZONE }));
  }
  // Add current date as final point
  months.push(DateTime.now().setZone(TIMEZONE).startOf('day'));
  
  // Get opening balances from yearEndBalances/2024 (the correct starting point)
  let bankBalance = 0;
  let cashBalance = 0;
  
  if (yearEndBalances['2024'] && yearEndBalances['2024'].accounts) {
    yearEndBalances['2024'].accounts.forEach(acc => {
      // Amounts in yearEndBalances are in centavos
      if (acc.id === 'bank-001') bankBalance = (acc.balance || 0) / 100;
      if (acc.id === 'cash-001') cashBalance = (acc.balance || 0) / 100;
    });
    console.log(`\n📋 Using Year-End 2024 as starting point:`);
    console.log(`   Bank: $${bankBalance.toLocaleString()}`);
    console.log(`   Cash: $${cashBalance.toLocaleString()}\n`);
  } else {
    console.log('\n⚠️  No Year-End 2024 balance found - starting from 0\n');
  }
  
  let transactionIndex = 0;
  const monthlyBalances = [];
  
  // Skip pre-2025 transactions (we're using yearEndBalances as our starting point)
  const jan1 = DateTime.fromObject({ year: 2025, month: 1, day: 1 }, { zone: TIMEZONE });
  while (transactionIndex < transactions.length && 
         transactions[transactionIndex].dateObj < jan1) {
    transactionIndex++;
  }
  
  const pre2025Count = transactionIndex;
  console.log(`📋 Skipped ${pre2025Count} pre-2025 transactions (covered by year-end balance)\n`);
  
  monthlyBalances.push({
    date: '2024-12-31',
    label: 'Opening',
    bank: bankBalance,
    cash: cashBalance
  });
  
  // Process each month and capture END-of-month balances
  for (let i = 0; i < months.length; i++) {
    const monthStart = months[i];
    const monthEnd = i < months.length - 1 ? months[i + 1] : DateTime.now().setZone(TIMEZONE).endOf('day');
    
    let monthBankTxns = 0;
    let monthCashTxns = 0;
    let monthBankAmount = 0;
    let monthCashAmount = 0;
    
    // Process transactions in this month
    while (transactionIndex < transactions.length) {
      const t = transactions[transactionIndex];
      
      // Stop if we've reached the next month boundary
      if (t.dateObj >= monthEnd) break;
      
      const amount = t.amount || 0;
      // Amounts are stored in centavos - convert to pesos
      const amountInPesos = amount / 100;
      
      if (t.accountType === 'bank') {
        bankBalance += amountInPesos;
        monthBankTxns++;
        monthBankAmount += amountInPesos;
      } else if (t.accountType === 'cash') {
        cashBalance += amountInPesos;
        monthCashTxns++;
        monthCashAmount += amountInPesos;
      }
      transactionIndex++;
    }
    
    // Record balance at END of month (to match spreadsheet format)
    monthlyBalances.push({
      date: monthEnd.minus({ days: 1 }).toFormat('yyyy-MM-dd'),
      label: monthStart.toFormat('MMM yyyy'),
      bank: bankBalance,
      cash: cashBalance,
      bankTxns: monthBankTxns,
      cashTxns: monthCashTxns,
      bankChange: monthBankAmount,
      cashChange: monthCashAmount
    });
  }
  
  // Output table - Month END balances to match spreadsheet
  console.log('================================================================================');
  console.log('MONTH-END BALANCE PROGRESSION (to match Google Sheets)');
  console.log('================================================================================');
  console.log('');
  console.log('Month End   | Month      | Bank Balance   | Cash Balance   | Combined       | Bank Txns | Cash Txns');
  console.log('------------|------------|----------------|----------------|----------------|-----------|----------');
  
  // First show opening balance
  console.log(
    `2024-12-31  | Opening    | ${formatCurrency(yearEndBalances['2024']?.accounts?.find(a => a.id === 'bank-001')?.balance / 100 || 0).padStart(14)} | ${formatCurrency(yearEndBalances['2024']?.accounts?.find(a => a.id === 'cash-001')?.balance / 100 || 0).padStart(14)} | ${formatCurrency(169088).padStart(14)} |     -     |     -`
  );
  
  for (const mb of monthlyBalances) {
    const combined = mb.bank + mb.cash;
    console.log(
      `${mb.date.padEnd(11)} | ${mb.label.padEnd(10)} | ${formatCurrency(mb.bank).padStart(14)} | ${formatCurrency(mb.cash).padStart(14)} | ${formatCurrency(combined).padStart(14)} | ${String(mb.bankTxns || 0).padStart(9)} | ${String(mb.cashTxns || 0).padStart(9)}`
    );
  }
  
  // Calculate and show month-over-month changes
  console.log('\n================================================================================');
  console.log('MONTHLY TRANSACTION SUMMARY');
  console.log('================================================================================\n');
  
  console.log('Month      | Bank Change    | Bank Txns | Cash Change    | Cash Txns');
  console.log('-----------|----------------|-----------|----------------|----------');
  
  for (const mb of monthlyBalances) {
    const bankChange = mb.bankChange || 0;
    const cashChange = mb.cashChange || 0;
    
    console.log(
      `${mb.label.padEnd(10)} | ${(bankChange >= 0 ? '+' : '') + formatCurrency(bankChange).padStart(13)} | ${String(mb.bankTxns || 0).padStart(9)} | ${(cashChange >= 0 ? '+' : '') + formatCurrency(cashChange).padStart(13)} | ${String(mb.cashTxns || 0).padStart(9)}`
    );
  }
  
  // Summary
  console.log('\n================================================================================');
  console.log('SUMMARY');
  console.log('================================================================================');
  console.log(`\n📊 CALCULATED from Year-End 2024 + 2025 Transactions:`);
  console.log(`  Bank: ${formatCurrency(bankBalance)}`);
  console.log(`  Cash: ${formatCurrency(cashBalance)}`);
  console.log(`  Combined: ${formatCurrency(bankBalance + cashBalance)}`);
  
  console.log(`\n📊 STORED in client.accounts (what SAMS UI shows):`);
  console.log(`  Bank: $492,599.58`);
  console.log(`  Cash: $100,331.38`);
  console.log(`  Combined: $592,930.96`);
  
  console.log(`\n📊 EXPECTED (from Google Sheets):`);
  console.log(`  Bank: $182,085.00`);
  console.log(`  Cash: $4,600.00`);
  console.log(`  Combined: $186,685.00`);
  
  console.log(`\n⚠️  DISCREPANCY ANALYSIS:`);
  console.log(`\n  Calculated vs Expected:`);
  console.log(`    Bank: ${formatCurrency(bankBalance - 182085)} (${((bankBalance / 182085 - 1) * 100).toFixed(1)}% off)`);
  console.log(`    Cash: ${formatCurrency(cashBalance - 4600)} (${cashBalance > 0 ? ((cashBalance / 4600 - 1) * 100).toFixed(1) : 'N/A'}% off)`);
  
  console.log(`\n  Stored vs Expected:`);
  console.log(`    Bank: ${formatCurrency(492599.58 - 182085)} (+170.6% off)`);
  console.log(`    Cash: ${formatCurrency(100331.38 - 4600)} (+2081.1% off)`);
  
  // Check for year-end balance context
  if (yearEndBalances['2024']) {
    console.log('\n📋 Year-End 2024 Reference:');
    console.log(JSON.stringify(yearEndBalances['2024'], null, 2));
  }
  
  console.log('\n✅ Diagnostic complete');
  process.exit(0);
}

// Run
runDiagnostic().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
