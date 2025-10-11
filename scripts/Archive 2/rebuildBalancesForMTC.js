/**
 * rebuildBalancesForMTC.js
 * Recalculates and rewrites monthly balances for MTC client based on existing transactions.
 */

// Use ES Modules imports for the backend controllers
import { listTransactions } from '../backend/controllers/transactionsController.js';
import { createBalance, deleteBalance, listBalances } from '../backend/controllers/balancesController.js';
import { getDb } from '../backend/firebase.js';
import { dateToTimestamp, convertDatesToTimestamps, normalizeDates } from './utils/timestampConverter.js';

async function rebuildBalancesForMTC() {
  const clientId = 'MTC';

  // Step 1: Load all transactions
  let transactions = await listTransactions(clientId);
  if (transactions.length === 0) {
    console.log('❌ No transactions found. Aborting.');
    return;
  }

  // Step 2: Purge old balances
  const existingBalances = await listBalances(clientId);
  for (const bal of existingBalances) {
    await deleteBalance(clientId, bal.id);
  }
  console.log(`🧹 Deleted ${existingBalances.length} old balances.`);

  // Step 3: Sort transactions DESCENDING (newest → oldest)
  transactions.sort((a, b) => b.date.toDate() - a.date.toDate());

  // Step 4: Initialize starting balances
  let cashBalance = 43600.0;
  let bankBalance = 140396.7;

  let currentMonthKey = '';
  let monthEndMap = {};

  for (const txn of transactions) {
    const txnDate = txn.date.toDate();
    const monthKey = `${txnDate.getFullYear()}-${String(txnDate.getMonth() + 1).padStart(2, '0')}`;

    // Save month-end if we haven't yet
    if (!monthEndMap[monthKey]) {
      monthEndMap[monthKey] = {
        cashBalance,
        bankBalance,
        closingDate: txnDate,
      };
    }

    const amount = Number(txn.amount || 0);
    const accountType = txn.accountType;

    if (accountType === 'Cash') {
      cashBalance -= amount;
    } else if (accountType === 'Bank') {
      bankBalance -= amount;
    } else {
      console.warn(`⚠️ Unknown accountType for txn on ${txnDate.toISOString()}`);
    }
  }

  // Step 5: Write new balances
  for (const [monthKey, { cashBalance, bankBalance, closingDate }] of Object.entries(monthEndMap)) {
    const balanceData = {
      cashBalance: Number(cashBalance.toFixed(2)),
      bankBalance: Number(bankBalance.toFixed(2)),
      closingDate: dateToTimestamp(closingDate),
    };
    await createBalance(clientId, monthKey, balanceData);
    console.log(`📅 Rewrote balance for ${monthKey}`);
  }

  console.log(`✅ Done. ${Object.keys(monthEndMap).length} monthly balances rebuilt.`);
}

// Convert the script to an ES module
async function main() {
  try {
    await rebuildBalancesForMTC();
    console.log('✅ Balances rebuild completed successfully');
  } catch (err) {
    console.error('❌ Error rebuilding balances:', err);
    process.exit(1);
  }
}

main();