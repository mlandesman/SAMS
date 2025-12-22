/**
 * accountsController.js
 * Management of client account data and balance operations
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getNow } from '../services/DateService.js';
import admin from 'firebase-admin';

/**
 * Fetch accounts for a client
 * @param {string} clientId - Client ID
 * @returns {Array} - Array of account objects
 */
async function getAccounts(clientId) {
  try {
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    // Return accounts array or empty array if not present
    return clientDoc.data().accounts || [];
  } catch (error) {
    console.error('❌ Error fetching accounts:', error);
    throw error;
  }
}

/**
 * Create a new account for a client
 * @param {string} clientId - Client ID
 * @param {object} accountData - Account data (name, type, currency)
 * @returns {object} - Created account
 */
async function createAccount(clientId, accountData) {
  try {
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    
    // Generate a stable ID based on account type and name
    const accountType = accountData.type || 'bank';
    const safeName = accountData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const accountId = `${accountType}-${safeName}-${getNow().getTime().toString(36)}`;
    
    // Create new account object
    const newAccount = {
      id: accountData.id || accountId,
      name: accountData.name,
      type: accountType,
      currency: accountData.currency || 'MXN',
      balance: accountData.initialBalance || 0,
      active: true,
      // Only updated timestamp - creation metadata in audit log
      updated: admin.firestore.Timestamp.now()
    };
    
    // Use a transaction for atomicity
    await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);
      
      if (!clientDoc.exists) {
        throw new Error(`Client ${clientId} not found`);
      }
      
      // Get current accounts array or initialize if missing
      const accounts = clientDoc.data().accounts || [];
      
      // Check if account name already exists
      if (accounts.some(acc => acc.name === newAccount.name)) {
        throw new Error(`Account with name "${newAccount.name}" already exists`);
      }
      
      // Add new account
      accounts.push(newAccount);
      
      // Update client document
      transaction.update(clientRef, { accounts });
    });
    
    // Log audit entry
    await writeAuditLog({
      module: 'accounts',
      action: 'create',
      parentPath: `clients/${clientId}`,
      docId: accountData.name,
      friendlyName: accountData.name,
      notes: `Created account ${accountData.name}`
    });
    
    return newAccount;
  } catch (error) {
    console.error('❌ Error creating account:', error);
    throw error;
  }
}

/**
 * Update an existing account (metadata only, not balance)
 * @param {string} clientId - Client ID
 * @param {string} accountId - Account ID
 * @param {object} updates - Fields to update
 * @returns {object} - Updated account
 */
async function updateAccount(clientId, accountId, updates) {
  try {
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    let updatedAccount = null;
    
    // Use transaction for atomicity
    await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);
      
      if (!clientDoc.exists) {
        throw new Error(`Client ${clientId} not found`);
      }
      
      // Get accounts array
      const accounts = clientDoc.data().accounts || [];
      const accountIndex = accounts.findIndex(acc => acc.id === accountId);
      
      if (accountIndex === -1) {
        throw new Error(`Account with ID ${accountId} not found`);
      }
      
      // Handle special case of name change
      const newName = updates.name;
      if (newName && newName !== accounts[accountIndex].name) {
        // Check if new name is already in use
        if (accounts.some(acc => acc.name === newName && acc.id !== accountId)) {
          throw new Error(`Account name "${newName}" is already in use`);
        }
      }
      
      // Update account fields but preserve balance and updated timestamp
      const currentAccount = accounts[accountIndex];
      accounts[accountIndex] = {
        ...currentAccount,
        ...updates,
        balance: currentAccount.balance, // Preserve balance
        updated: currentAccount.updated // Preserve last balance update timestamp
      };
      
      updatedAccount = accounts[accountIndex];
      
      // Update client document
      transaction.update(clientRef, { accounts });
    });
    
    // Log audit entry
    await writeAuditLog({
      module: 'accounts',
      action: 'update',
      parentPath: `clients/${clientId}`,
      docId: accountName,
      friendlyName: accountName,
      notes: `Updated account ${accountName}`
    });
    
    return updatedAccount;
  } catch (error) {
    console.error('❌ Error updating account:', error);
    throw error;
  }
}

/**
 * Close an account (preferred over deletion to preserve history)
 * @param {string} clientId - Client ID
 * @param {string} accountId - Account ID
 * @param {string} transferToAccountId - Optional account ID to transfer balance to
 * @returns {boolean} - Success
 */
async function closeAccount(clientId, accountId, transferToAccountId = null) {
  try {
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    
    // Use transaction for atomicity
    await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);
      
      if (!clientDoc.exists) {
        throw new Error(`Client ${clientId} not found`);
      }
      
      // Get accounts array
      const accounts = clientDoc.data().accounts || [];
      const accountIndex = accounts.findIndex(acc => acc.id === accountId);
      
      if (accountIndex === -1) {
        throw new Error(`Account with ID ${accountId} not found`);
      }
      
      // If account has non-zero balance and no transfer account, block closing
      if (accounts[accountIndex].balance !== 0 && !transferToAccountId) {
        throw new Error(`Cannot close account with non-zero balance: ${accounts[accountIndex].balance}. Specify a transfer account or zero the balance first.`);
      }
      
      // If we need to transfer the balance
      if (transferToAccountId && accounts[accountIndex].balance !== 0) {
        const targetIndex = accounts.findIndex(acc => acc.id === transferToAccountId);
        
        if (targetIndex === -1) {
          throw new Error(`Transfer account with ID ${transferToAccountId} not found`);
        }
        
        // Transfer balance
        accounts[targetIndex].balance += accounts[accountIndex].balance;
        accounts[targetIndex].updated = getNow();
        accounts[accountIndex].balance = 0;
      }
      
      // Mark the account as inactive instead of removing it
      accounts[accountIndex].active = false;
      accounts[accountIndex].closed = getNow();
      accounts[accountIndex].updated = getNow();
      
      // Update client document
      transaction.update(clientRef, { accounts });
    });
    
    // Log audit entry
    await writeAuditLog({
      module: 'accounts',
      action: 'close',
      parentPath: `clients/${clientId}`,
      docId: accountId,
      friendlyName: accountId,
      notes: `Closed account ${accountId}${transferToAccountId ? ` (balance transferred to ${transferToAccountId})` : ''}`
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error closing account:', error);
    throw error;
  }
}

/**
 * Reopen a previously closed account
 * @param {string} clientId - Client ID
 * @param {string} accountId - Account ID
 * @returns {boolean} - Success
 */
async function reopenAccount(clientId, accountId) {
  try {
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    
    // Use transaction for atomicity
    await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);
      
      if (!clientDoc.exists) {
        throw new Error(`Client ${clientId} not found`);
      }
      
      // Get accounts array
      const accounts = clientDoc.data().accounts || [];
      const accountIndex = accounts.findIndex(acc => acc.id === accountId);
      
      if (accountIndex === -1) {
        throw new Error(`Account with ID ${accountId} not found`);
      }
      
      // Mark the account as active
      accounts[accountIndex].active = true;
      delete accounts[accountIndex].closed;
      accounts[accountIndex].updated = getNow();
      
      // Update client document
      transaction.update(clientRef, { accounts });
    });
    
    // Log audit entry
    await writeAuditLog({
      module: 'accounts',
      action: 'reopen',
      parentPath: `clients/${clientId}`,
      docId: accountId,
      friendlyName: accountId,
      notes: `Reopened account ${accountId}`
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error reopening account:', error);
    throw error;
  }
}

/**
 * Delete an account (admin only, use closeAccount for normal operations)
 * @param {string} clientId - Client ID
 * @param {string} accountId - Account ID
 * @param {string} transferToAccountId - Optional account ID to transfer balance to
 * @returns {boolean} - Success
 */
async function deleteAccount(clientId, accountId, transferToAccountId = null) {
  try {
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    
    // Use transaction for atomicity
    await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);
      
      if (!clientDoc.exists) {
        throw new Error(`Client ${clientId} not found`);
      }
      
      // Get accounts array
      const accounts = clientDoc.data().accounts || [];
      const accountIndex = accounts.findIndex(acc => acc.id === accountId);
      
      if (accountIndex === -1) {
        throw new Error(`Account with ID ${accountId} not found`);
      }
      
      // If account has non-zero balance and no transfer account, block deletion
      if (accounts[accountIndex].balance !== 0 && !transferToAccountId) {
        throw new Error(`Cannot delete account with non-zero balance: ${accounts[accountIndex].balance}. Specify a transfer account or zero the balance first.`);
      }
      
      // If we need to transfer the balance
      if (transferToAccountId && accounts[accountIndex].balance !== 0) {
        const targetIndex = accounts.findIndex(acc => acc.id === transferToAccountId);
        
        if (targetIndex === -1) {
          throw new Error(`Transfer account with ID ${transferToAccountId} not found`);
        }
        
        // Transfer balance
        accounts[targetIndex].balance += accounts[accountIndex].balance;
        accounts[targetIndex].updated = getNow();
      }
      
      // Remove the account
      accounts.splice(accountIndex, 1);
      
      // Update client document
      transaction.update(clientRef, { accounts });
    });
    
    // Log audit entry
    await writeAuditLog({
      module: 'accounts',
      action: 'delete',
      parentPath: `clients/${clientId}`,
      docId: accountName,
      friendlyName: accountName,
      notes: `Deleted account ${accountName}${transferToAccount ? ` (balance transferred to ${transferToAccount})` : ''}`
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error deleting account:', error);
    throw error;
  }
}

/**
 * Update account balance
 * @param {string} clientId - Client ID
 * @param {string} accountId - Account ID (or legacy account name for backward compatibility)
 * @param {number} amount - Amount to add to balance (negative to subtract)
 * @returns {number} - New balance
 */
async function updateAccountBalance(clientId, accountId, amount) {
  try {
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    let newBalance = 0;
    let accountName = '';
    
    // Use transaction for atomicity
    await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);
      
      if (!clientDoc.exists) {
        throw new Error(`Client ${clientId} not found`);
      }
      
      // Get accounts array
      const accounts = clientDoc.data().accounts || [];
      
      // Try to find account by ID first
      let accountIndex = accounts.findIndex(acc => acc.id === accountId);
      
      // Backward compatibility: if not found by ID, try by name (legacy support)
      if (accountIndex === -1) {
        accountIndex = accounts.findIndex(acc => acc.name === accountId);
        
        // If still not found, throw error
        if (accountIndex === -1) {
          throw new Error(`Account ${accountId} not found`);
        }
      }
      
      // Check if account is active
      if (accounts[accountIndex].active === false) {
        throw new Error(`Cannot update balance for closed account ${accounts[accountIndex].name}`);
      }
      
      // Update balance
      accounts[accountIndex].balance += amount;
      accounts[accountIndex].updated = getNow();
      newBalance = accounts[accountIndex].balance;
      accountName = accounts[accountIndex].name;
      
      // Update client document
      transaction.update(clientRef, { accounts });
    });
    
    // Log audit entry for significant balance changes
    if (Math.abs(amount) >= 100) {  // Only log significant changes
      await writeAuditLog({
        module: 'accounts',
        action: 'updateBalance',
        parentPath: `clients/${clientId}`,
        docId: accountId,
        friendlyName: accountName,
        notes: `Updated balance for ${accountName} by ${amount}, new balance: ${newBalance}`
      });
    }
    
    return newBalance;
  } catch (error) {
    console.error('❌ Error updating account balance:', error);
    throw error;
  }
}

/**
 * Set account balance directly
 * @param {string} clientId - Client ID
 * @param {string} accountId - Account ID (or legacy account name for backward compatibility)
 * @param {number} newBalance - New balance value
 * @returns {number} - New balance
 */
async function setAccountBalance(clientId, accountId, newBalance) {
  try {
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    let accountName = '';
    
    // Use transaction for atomicity
    await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);
      
      if (!clientDoc.exists) {
        throw new Error(`Client ${clientId} not found`);
      }
      
      // Get accounts array
      const accounts = clientDoc.data().accounts || [];
      
      // Try to find account by ID first
      let accountIndex = accounts.findIndex(acc => acc.id === accountId);
      
      // Backward compatibility: if not found by ID, try by name (legacy support)
      if (accountIndex === -1) {
        accountIndex = accounts.findIndex(acc => acc.name === accountId);
        
        // If still not found, throw error
        if (accountIndex === -1) {
          throw new Error(`Account ${accountId} not found`);
        }
      }
      
      // Check if account is active
      if (accounts[accountIndex].active === false) {
        throw new Error(`Cannot update balance for closed account ${accounts[accountIndex].name}`);
      }
      
      // Get old balance for audit
      const oldBalance = accounts[accountIndex].balance;
      accountName = accounts[accountIndex].name;
      
      // Set balance directly
      accounts[accountIndex].balance = newBalance;
      accounts[accountIndex].updated = getNow();
      
      // Update client document
      transaction.update(clientRef, { accounts });
      
      // Log audit entry
      await writeAuditLog({
        module: 'accounts',
        action: 'setBalance',
        parentPath: `clients/${clientId}`,
        docId: accountId,
        friendlyName: accountName,
        notes: `Set balance for ${accountName} from ${oldBalance} to ${newBalance}`
      });
    });
    
    return newBalance;
  } catch (error) {
    console.error('❌ Error setting account balance:', error);
    throw error;
  }
}

/**
 * Create a year-end snapshot of account balances
 * @param {string} clientId - Client ID
 * @param {string} year - Year (YYYY)
 * @returns {Array} - Snapshot accounts
 */
async function createYearEndSnapshot(clientId, year) {
  try {
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    // Get current accounts
    const accounts = clientDoc.data().accounts || [];
    
    // Create year-end snapshot format
    const yearEndAccounts = accounts.map(account => ({
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.balance,
      active: account.active !== false, // Default to true if not specified
      snapshotDate: `${year}-12-31`
    }));
    
    // Store the snapshot
    await db
      .collection('clients')
      .doc(clientId)
      .collection('yearEndBalances')
      .doc(year)
      .set({
        accounts: yearEndAccounts,
        createdAt: getNow()
      });
    
    // Log audit entry
    await writeAuditLog({
      module: 'accounts',
      action: 'createYearEndSnapshot',
      parentPath: `clients/${clientId}/yearEndBalances/${year}`,
      docId: year,
      friendlyName: `${year} Year-End`,
      notes: `Created year-end snapshot for ${year}`
    });
    
    return yearEndAccounts;
  } catch (error) {
    console.error('❌ Error creating year-end snapshot:', error);
    throw error;
  }
}

/**
 * Get a year-end snapshot
 * @param {string} clientId - Client ID
 * @param {string} year - Year (YYYY)
 * @returns {Array} - Snapshot accounts
 */
async function getYearEndSnapshot(clientId, year) {
  try {
    const db = await getDb();
    const snapshotRef = db
      .collection('clients')
      .doc(clientId)
      .collection('yearEndBalances')
      .doc(year);
    
    const snapshot = await snapshotRef.get();
    
    if (!snapshot.exists) {
      throw new Error(`Year-end snapshot for ${year} not found`);
    }
    
    return snapshot.data();
  } catch (error) {
    console.error('❌ Error fetching year-end snapshot:', error);
    throw error;
  }
}

/**
 * List all year-end snapshots
 * @param {string} clientId - Client ID
 * @returns {Array} - Array of year-end snapshot IDs
 */
async function listYearEndSnapshots(clientId) {
  try {
    const db = await getDb();
    const snapshotsRef = db
      .collection('clients')
      .doc(clientId)
      .collection('yearEndBalances');
    
    const snapshots = await snapshotsRef.get();
    const years = [];
    
    snapshots.forEach(doc => {
      years.push({
        year: doc.id,
        createdAt: doc.data().createdAt
      });
    });
    
    return years;
  } catch (error) {
    console.error('❌ Error listing year-end snapshots:', error);
    throw error;
  }
}

/**
 * Rebuild account balances from transactions
 * @param {string} clientId - Client ID
 * @param {string} startYear - Optional starting year for rebuild
 * @returns {Array} - Updated accounts
 */
async function rebuildBalances(clientId, startYear = null) {
  try {
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    // Get current account structure
    let accounts = clientDoc.data().accounts || [];
    
    // If we have a start year, try to get the snapshot
    if (startYear) {
      try {
        const snapshot = await getYearEndSnapshot(clientId, startYear);
        
        // Map snapshot balances to current account structure
        accounts = accounts.map(account => {
          // Try to find by ID first (preferred)
          let snapshotAccount = account.id ? 
            snapshot.accounts.find(snap => snap.id === account.id) : null;
          
          // Fall back to name if no ID match
          if (!snapshotAccount) {
            snapshotAccount = snapshot.accounts.find(snap => snap.name === account.name);
          }
          
          if (snapshotAccount) {
            return {
              ...account,
              balance: snapshotAccount.balance
            };
          } else {
            return {
              ...account,
              balance: 0
            };
          }
        });
      } catch (error) {
        // If snapshot doesn't exist, zero out balances
        accounts = accounts.map(account => ({
          ...account,
          balance: 0
        }));
      }
    } else {
      // No start year, reset all balances to zero
      accounts = accounts.map(account => ({
        ...account,
        balance: 0
      }));
    }
    
    // Prepare to query transactions
    const transactionsRef = db
      .collection('clients')
      .doc(clientId)
      .collection('transactions');
    
    let query = transactionsRef.orderBy('date', 'asc');
    
    // If starting from a year, filter transactions after that year
    if (startYear) {
      const startDate = new Date(`${startYear}-12-31T23:59:59`);
      query = query.where('date', '>', startDate);
    }
    
    // Get all transactions
    const transactions = await query.get();
    
    // Process message for audit log
    let processedCount = 0;
    
    // Apply each transaction to the account balances
    transactions.forEach(doc => {
      const transaction = doc.data();
      processedCount++;
      
      // Find the account for this transaction - try accountId first
      let accountIndex = -1;
      if (transaction.accountId) {
        // Find by ID (preferred)
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
        accounts[accountIndex].balance += transaction.amount;
        
        // Update the timestamp to the latest transaction date
        if (!accounts[accountIndex].updated || 
            transaction.date > accounts[accountIndex].updated) {
          accounts[accountIndex].updated = transaction.date;
        }
      }
    });
    
    // Update the client with recalculated balances
    await clientRef.update({ 
      accounts,
      lastBalanceRebuild: getNow()
    });
    
    // Log audit entry
    await writeAuditLog({
      module: 'accounts',
      action: 'rebuildBalances',
      parentPath: `clients/${clientId}`,
      docId: clientId,
      friendlyName: clientDoc.data().name || clientId,
      notes: `Rebuilt account balances from ${startYear || 'zero'}, processed ${processedCount} transactions`
    });
    
    return accounts;
  } catch (error) {
    console.error('❌ Error rebuilding balances:', error);
    throw error;
  }
}

/**
 * Get accounts for reconciliation (bank and cash types only)
 * @param {string} clientId - Client ID
 * @returns {Array} - Array of account objects with samsBalance in pesos
 */
async function getAccountsForReconciliation(clientId) {
  try {
    const db = await getDb();
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    const accounts = clientDoc.data().accounts || [];
    
    // Filter to only bank and cash accounts, convert balance from centavos to pesos
    const reconciliationAccounts = accounts
      .filter(acc => (acc.type === 'bank' || acc.type === 'cash') && acc.active !== false)
      .map(acc => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        samsBalance: (acc.balance || 0) / 100 // Convert centavos to pesos
      }));
    
    return reconciliationAccounts;
  } catch (error) {
    console.error('❌ Error fetching accounts for reconciliation:', error);
    throw error;
  }
}

/**
 * Create reconciliation adjustment transactions
 * @param {string} clientId - Client ID
 * @param {Array} adjustments - Array of adjustment objects { accountId, accountName, samsBalance, actualBalance, difference }
 * @param {Object} user - User object from req.user
 * @returns {Array} - Results array with transaction IDs
 */
async function createReconciliationAdjustments(clientId, adjustments, user) {
  try {
    const db = await getDb();
    const { createTransaction } = await import('./transactionsController.js');
    const { formatCurrency } = await import('../utils/currencyUtils.js');
    
    // Get accounts to look up accountType
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    const accounts = clientDoc.data().accounts || [];
    const accountMap = {};
    accounts.forEach(acc => {
      accountMap[acc.id] = acc;
    });
    
    // Resolve vendor names for accounts (accounts have vendorId field)
    const vendorsRef = db.collection(`clients/${clientId}/vendors`);
    const vendorNameMap = {};
    for (const account of accounts.filter(acc => acc.type === 'bank' || acc.type === 'cash')) {
      if (account.vendorId) {
        const vendorDoc = await vendorsRef.doc(account.vendorId).get();
        if (vendorDoc.exists) {
          vendorNameMap[account.id] = vendorDoc.data().name;
        } else {
          console.warn(`⚠️ Vendor ${account.vendorId} not found for account ${account.id}`);
          vendorNameMap[account.id] = account.name; // Fallback to account name
        }
      } else {
        console.warn(`⚠️ Account ${account.id} missing vendorId field`);
        vendorNameMap[account.id] = account.name; // Fallback to account name
      }
    }
    
    const results = [];
    
    for (const adj of adjustments) {
      // Skip zero adjustments
      if (Math.abs(adj.difference) < 0.01) continue;
      
      // Look up account to get accountType and vendorId
      const account = accountMap[adj.accountId];
      if (!account) {
        throw new Error(`Account ${adj.accountId} not found`);
      }
      
      if (!account.vendorId) {
        throw new Error(`Account ${adj.accountId} missing required vendorId field`);
      }
      
      // Convert difference from pesos to centavos for storage
      const differenceCentavos = Math.round(adj.difference * 100);
      
      // Build transaction object
      // Use account.vendorId (from accounts array) and resolved vendor name
      const transaction = {
        date: getNow().toISOString().split('T')[0], // YYYY-MM-DD format
        amount: adj.difference, // Amount in pesos (can be positive or negative - will be converted to centavos by createTransaction)
        type: 'adjustment', // Use 'adjustment' type to allow both positive and negative amounts
        categoryId: 'bank-adjustments',
        categoryName: 'Bank Adjustments',
        accountId: adj.accountId,
        accountType: account.type, // Required: accountType must be present when accountId is provided
        accountName: adj.accountName, // Also include accountName for consistency
        vendorId: account.vendorId, // Use vendorId from account (e.g., "bbva", "petty-cash")
        vendorName: vendorNameMap[account.id] || account.name, // Resolved vendor name
        description: `Reconciliation adjustment for ${adj.accountName}`,
        notes: `SAMS balance: ${formatCurrency(Math.round(adj.samsBalance * 100))}, Actual: ${formatCurrency(Math.round(adj.actualBalance * 100))}, Difference: ${formatCurrency(Math.round(adj.difference * 100))}`,
        metadata: {
          source: 'reconciliation',
          samsBalance: Math.round(adj.samsBalance * 100), // Store in centavos
          actualBalance: Math.round(adj.actualBalance * 100), // Store in centavos
          reconciledBy: user.email,
          reconciledAt: getNow().toISOString()
        }
      };
      
      // Create transaction (this will automatically update account balance)
      const txnId = await createTransaction(clientId, transaction);
      
      results.push({
        accountId: adj.accountId,
        accountName: adj.accountName,
        transactionId: txnId,
        amount: adj.difference // Difference in pesos
      });
    }
    
    // Log audit entry
    if (results.length > 0) {
      await writeAuditLog({
        module: 'accounts',
        action: 'reconciliation',
        parentPath: `clients/${clientId}`,
        docId: clientId,
        friendlyName: `Reconciliation adjustments`,
        notes: `Created ${results.length} reconciliation adjustment transaction(s)`
      });
    }
    
    return results;
  } catch (error) {
    console.error('❌ Error creating reconciliation adjustments:', error);
    throw error;
  }
}

export {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  closeAccount,
  reopenAccount,
  updateAccountBalance,
  setAccountBalance,
  createYearEndSnapshot,
  getYearEndSnapshot,
  listYearEndSnapshots,
  rebuildBalances,
  getAccountsForReconciliation,
  createReconciliationAdjustments
};
