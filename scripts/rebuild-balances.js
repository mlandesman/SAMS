/**
 * Rebuild account balances from year-end snapshot
 * 
 * This script recalculates the current balance for a client
 * starting from a year-end snapshot and applying all subsequent
 * transactions. The result is written back to the client's 
 * accounts array.
 * 
 * Usage:
 *   node rebuild-balances.js <clientId> <year>
 * 
 * Example:
 *   node rebuild-balances.js MTC 2024
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { getFiscalYearBounds, validateFiscalYearConfig } from '../backend/utils/fiscalYearUtils.js';
const require = createRequire(import.meta.url);

// Get service account key - look in backend directory
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

/**
 * Rebuild client account balances from year-end snapshot
 * @param {string} clientId - Client ID
 * @param {string} startYear - Year to start from (YYYY)
 * @returns {Array} - Updated accounts
 */
async function rebuildBalances(clientId, startYear) {
  try {
    console.log(`\n🔄 Rebuilding balances for client ${clientId} from ${startYear} snapshot...`);
    
    // Get client document
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    // Get client fiscal year configuration
    const clientData = clientDoc.data();
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    
    // Get current account structure
    let accounts = clientData.accounts || [];
    
    if (accounts.length === 0) {
      throw new Error(`No accounts found for client ${clientId}`);
    }
    
    console.log(`Found ${accounts.length} accounts for client ${clientId}`);
    
    // Get year-end snapshot
    const snapshotRef = db
      .collection('clients')
      .doc(clientId)
      .collection('yearEndBalances')
      .doc(startYear.toString());
    
    const snapshot = await snapshotRef.get();
    
    if (!snapshot.exists) {
      throw new Error(`Year-end snapshot for ${startYear} not found`);
    }
    
    console.log(`Found year-end snapshot for ${startYear}`);
    
    // Get snapshot accounts
    const snapshotAccounts = snapshot.data().accounts || [];
    
    if (snapshotAccounts.length === 0) {
      throw new Error(`No accounts in year-end snapshot for ${startYear}`);
    }
    
    console.log(`Found ${snapshotAccounts.length} accounts in snapshot`);
    
    // Calculate fiscal year end date for snapshot reference
    const { endDate: yearEndDate } = getFiscalYearBounds(parseInt(startYear), fiscalYearStartMonth);
    const snapshotDateStr = yearEndDate.toISOString().split('T')[0];
    
    console.log(`📅 Rebuild Script - Fiscal Year Config: Start month ${fiscalYearStartMonth}`);
    console.log(`📅 Year ${startYear} ends on: ${snapshotDateStr}`);
    
    // Map snapshot balances to current account structure
    accounts = accounts.map(account => {
      // Try to find snapshot account by ID first
      let snapshotAccount = account.id ? 
        snapshotAccounts.find(snap => snap.id === account.id) : null;
      
      // If not found by ID, try by name (for backward compatibility)
      if (!snapshotAccount) {
        snapshotAccount = snapshotAccounts.find(snap => snap.name === account.name);
      }
      
      return {
        ...account,
        balance: snapshotAccount ? snapshotAccount.balance : 0,
        lastRebuildSnapshot: snapshotDateStr
      };
    });
    
    // Get transactions after the snapshot date
    const { endDate } = getFiscalYearBounds(parseInt(startYear), fiscalYearStartMonth);
    // Add one millisecond to get start of next period
    const startDate = new Date(endDate.getTime() + 1);
    console.log(`📅 Processing transactions after: ${startDate.toISOString()}`);
    console.log(`Fetching transactions after ${startDate.toISOString()}`);
    
    const transactionsRef = db
      .collection('clients')
      .doc(clientId)
      .collection('transactions');
    
    const query = transactionsRef
      .where('date', '>', startDate)
      .orderBy('date', 'asc');
    
    const transactions = await query.get();
    
    console.log(`Found ${transactions.size} transactions after the snapshot date`);
    
    // Apply each transaction to the account balances
    let processedCount = 0;
    
    transactions.forEach(doc => {
      const transaction = doc.data();
      processedCount++;
      
      // Find the account for this transaction - try accountId first
      let accountIndex = -1;
      if (transaction.accountId) {
        accountIndex = accounts.findIndex(acc => acc.id === transaction.accountId);
      } 
      
      // Fall back to account name if no match by ID
      if (accountIndex === -1 && transaction.account) {
        accountIndex = accounts.findIndex(acc => acc.name === transaction.account);
      }
      
      // Fall back to accountType for legacy transactions
      if (accountIndex === -1 && transaction.accountType) {
        // Map old accountType values to account names
        const accountType = transaction.accountType;
        if (accountType === 'Cash') {
          accountIndex = accounts.findIndex(acc => acc.id === 'cash-001' || acc.name === 'Cash');
        } else if (accountType === 'Bank') {
          accountIndex = accounts.findIndex(acc => acc.id === 'bank-cibanco-001' || acc.name === 'CiBanco');
        }
      }
      
      if (accountIndex !== -1) {
        // Update the balance based on the transaction amount
        const amount = Number(transaction.amount || 0);
        accounts[accountIndex].balance += amount;
        
        // Update the timestamp to the latest transaction date
        if (!accounts[accountIndex].updated || 
            transaction.date.toDate() > accounts[accountIndex].updated.toDate()) {
          accounts[accountIndex].updated = transaction.date;
        }
      } else {
        console.warn(`⚠️ No matching account found for transaction ${doc.id}`);
        console.warn(`Account: ${transaction.account || transaction.accountType || 'Unknown'}`);
      }
    });
    
    // Update the client with recalculated balances
    await clientRef.update({ 
      accounts,
      lastBalanceRebuild: new Date(),
      lastBalanceRebuildSource: `${startYear} year-end snapshot`
    });
    
    console.log(`\n✅ Successfully rebuilt account balances from ${startYear} snapshot`);
    console.log(`Processed ${processedCount} transactions`);
    
    // Display the updated balances
    console.log('\nUpdated account balances:');
    accounts.forEach(account => {
      console.log(`${account.name} (${account.id}): ${account.balance}`);
    });
    
    return accounts;
  } catch (error) {
    console.error(`❌ Error rebuilding balances:`, error);
    throw error;
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const clientId = args[0];
const year = args[1];

if (!clientId || !year) {
  console.error('Usage: node rebuild-balances.js <clientId> <year>');
  process.exit(1);
}

// Main function
(async () => {
  try {
    await rebuildBalances(clientId, year);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
