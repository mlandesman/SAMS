/**
 * importTransactionsForMTC.js
 * Imports MTC transactions from JSON into Firestore.
 * Removes and replaces all existing transactions for the client.
 */

// Use ES Modules imports for the backend controllers
import { createTransaction, listTransactions, deleteTransaction } from '../backend/controllers/transactionsController.js';
import { getDb } from '../backend/firebase.js';
import { normalizeDateFields } from '../backend/utils/dateNormalization.js';
import { createRequire } from 'module';

// Use require for JSON data
const require = createRequire(import.meta.url);
const transactionsData = require('../MTCdata/transHistory.json');

async function purgeOldTransactions(clientId) {
  console.log('♻️ Purging old transactions...');

  const existingTxns = await listTransactions(clientId);
  for (const txn of existingTxns) {
    await deleteTransaction(clientId, txn.id);
  }

  console.log(`✅ Deleted ${existingTxns.length} transactions.`);
}

async function importTransactionsForMTC() {
  const clientId = 'MTC';
  const db = getDb();

  // Step 1: Purge old data
  await purgeOldTransactions(clientId);

  // Step 2: Sort transactions ascending
  transactionsData.sort((a, b) => new Date(a.Date) - new Date(b.Date));

  let importedCount = 0;

  // Step 3: Import transactions
  for (const txn of transactionsData) {
    // Skip entries without valid Date
    if (!txn.Date) {
      console.warn('⚠️ Skipping entry without date');
      continue;
    }
    
    const txnDate = new Date(txn.Date);
    const accountRaw = txn.Account || '';

    let accountType = '';
    if (accountRaw === 'MTC Bank') {
      accountType = 'Bank';
    } else if (accountRaw === 'Cash Account') {
      accountType = 'Cash';
    } else {
      console.error(`❌ Unknown account type: ${accountRaw} on ${txn.Date}`);
      continue; // skip invalid
    }

    const amount = Number(txn.Amount || 0);
    
    // Only import transactions with valid data
    if (isNaN(amount) || !txnDate) {
      console.warn(`⚠️ Skipping invalid transaction data: ${txn.Date} ${txn.Amount}`);
      continue;
    }

    const txnData = {
      date: txnDate,
      vendor: txn.Vendor || '',
      category: txn.Category || '',
      notes: txn.Notes || '',
      unit: txn.Unit || '',
      amount: amount,
      accountType: accountType,
    };

    // Normalize date fields to ensure consistent JavaScript Date objects
    const normalizedData = normalizeDateFields(txnData);
    console.log('Original date:', txnData.date);
    console.log('Normalized date:', normalizedData.date);
    
    await createTransaction(clientId, normalizedData);
    importedCount++;
  }

  console.log(`✅ Import complete. ${importedCount} transactions added.`);
}

// Convert the script to an ES module
async function main() {
  try {
    await importTransactionsForMTC();
    console.log('✅ Import process completed successfully');
  } catch (err) {
    console.error('❌ Error during MTC transaction import:', err);
    process.exit(1);
  }
}

main();