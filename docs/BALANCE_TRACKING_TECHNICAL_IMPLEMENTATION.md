# Balance System Redesign: Technical Implementation

## IMPLEMENTATION STATUS - COMPLETED ✅

**Implementation Date**: June 9, 2025

### Summary of Implementation
The balance system redesign has been fully implemented with the following changes:

#### ✅ Completed Tasks:
1. **Frontend Implementation**
   - Created `clientAccounts.js` utility for account balance management
   - Updated `TransactionsView.jsx` to use new account-based balance system
   - Removed legacy `lastKnownBalances` dependency
   - Implemented proper caching and refresh logic

2. **Backend Tools**
   - Created `rebuild-balances.js` script for balance recalculation
   - Added `rebuild-balances.sh` shell wrapper
   - Implemented transaction replay from year-end snapshots

3. **Code Cleanup**
   - Removed unused state variables (`cashDelta`, `bankDelta`)
   - Eliminated legacy balance calculation logic
   - Simplified balance bar display logic

#### 🎯 Key Files Implemented:
- `/frontend/sams-ui/src/utils/clientAccounts.js` - Account balance utility
- `/scripts/rebuild-balances.js` - Balance rebuild script
- `/rebuild-balances.sh` - Command-line wrapper
- Updated `/frontend/sams-ui/src/views/TransactionsView.jsx`

#### 🚀 Usage:
- Balance bar now shows real-time account balances
- Run `./rebuild-balances.sh <clientId> <year>` to recalculate balances
- System automatically caches balance queries for performance

---

This technical document outlines specific implementation details for transitioning from the current monthend balance system to the new account-based balance system.

## Data Structures

### Current Structure

```
/clients/{clientId}                           // Client document
/clients/{clientId}/balances/{YYYY-MM}        // Month-end balances
/clients/{clientId}/config/accounts           // Account configuration
/clients/{clientId}/transactions/{txnId}      // Transaction records
```

### New Structure

```
/clients/{clientId}                           // Client document with embedded accounts array
/clients/{clientId}/yearEndBalances/{YYYY}    // Year-end balance snapshots
/clients/{clientId}/transactions/{txnId}      // Transaction records (unchanged)
```

## Code Implementation

### 1. Client Schema Update

Add the accounts array to the client schema:

```javascript
const clientSchema = {
  id: String,
  name: String,
  // ... other existing fields
  
  accounts: [
    {
      name: String,          // Account name (e.g., "Cash", "CiBanco")
      type: String,          // Account type (e.g., "cash", "bank", "credit")
      currency: String,      // Currency code (e.g., "MXN", "USD")
      balance: Number,       // Current balance
      updated: Timestamp     // Last update timestamp
    }
  ]
};
```

### 2. Backend Functions

#### Account Management Functions

```javascript
// Create new account
async function createAccount(clientId, accountData) {
  const newAccount = {
    name: accountData.name,
    type: accountData.type || 'bank',
    currency: accountData.currency || 'MXN',
    balance: accountData.initialBalance || 0,
    updated: admin.firestore.FieldValue.serverTimestamp()
  };
  
  const clientRef = db.collection('clients').doc(clientId);
  
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(clientRef);
    
    if (!doc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    // Get current accounts or initialize empty array
    const accounts = doc.data().accounts || [];
    
    // Check if account name already exists
    if (accounts.some(acc => acc.name === newAccount.name)) {
      throw new Error(`Account ${newAccount.name} already exists`);
    }
    
    // Add new account to the array
    accounts.push(newAccount);
    
    // Update the client document
    transaction.update(clientRef, { accounts });
    
    return newAccount;
  });
}

// Update existing account details (not balance)
async function updateAccount(clientId, accountName, updates) {
  const clientRef = db.collection('clients').doc(clientId);
  
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(clientRef);
    
    if (!doc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    const accounts = doc.data().accounts || [];
    const index = accounts.findIndex(acc => acc.name === accountName);
    
    if (index === -1) {
      throw new Error(`Account ${accountName} not found`);
    }
    
    // Update account fields but preserve balance and name
    accounts[index] = {
      ...accounts[index],
      ...updates,
      name: accountName, // Preserve original name
      balance: accounts[index].balance, // Preserve balance
      updated: admin.firestore.FieldValue.serverTimestamp()
    };
    
    transaction.update(clientRef, { accounts });
    
    return accounts[index];
  });
}

// Delete account
async function deleteAccount(clientId, accountName, transferToAccount = null) {
  const clientRef = db.collection('clients').doc(clientId);
  
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(clientRef);
    
    if (!doc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    const accounts = doc.data().accounts || [];
    const index = accounts.findIndex(acc => acc.name === accountName);
    
    if (index === -1) {
      throw new Error(`Account ${accountName} not found`);
    }
    
    // If balance is not zero and no transfer account specified
    if (accounts[index].balance !== 0 && !transferToAccount) {
      throw new Error(`Account ${accountName} has non-zero balance. Specify transfer account or zero balance first.`);
    }
    
    // If we need to transfer balance
    if (transferToAccount && accounts[index].balance !== 0) {
      const targetIndex = accounts.findIndex(acc => acc.name === transferToAccount);
      
      if (targetIndex === -1) {
        throw new Error(`Transfer account ${transferToAccount} not found`);
      }
      
      // Transfer balance to target account
      accounts[targetIndex].balance += accounts[index].balance;
      accounts[targetIndex].updated = admin.firestore.FieldValue.serverTimestamp();
    }
    
    // Remove the account
    accounts.splice(index, 1);
    
    transaction.update(clientRef, { accounts });
    
    return true;
  });
}
```

#### Balance Update Functions

```javascript
// Update account balance (for transaction operations)
async function updateAccountBalance(clientId, accountName, amount) {
  const clientRef = db.collection('clients').doc(clientId);
  
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(clientRef);
    
    if (!doc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    const accounts = doc.data().accounts || [];
    const index = accounts.findIndex(acc => acc.name === accountName);
    
    if (index === -1) {
      throw new Error(`Account ${accountName} not found`);
    }
    
    // Update balance
    accounts[index].balance += amount;
    accounts[index].updated = admin.firestore.FieldValue.serverTimestamp();
    
    transaction.update(clientRef, { accounts });
    
    return accounts[index].balance;
  });
}

// Set balance directly (for adjustments or corrections)
async function setAccountBalance(clientId, accountName, newBalance) {
  const clientRef = db.collection('clients').doc(clientId);
  
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(clientRef);
    
    if (!doc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    const accounts = doc.data().accounts || [];
    const index = accounts.findIndex(acc => acc.name === accountName);
    
    if (index === -1) {
      throw new Error(`Account ${accountName} not found`);
    }
    
    // Set balance directly
    accounts[index].balance = newBalance;
    accounts[index].updated = admin.firestore.FieldValue.serverTimestamp();
    
    transaction.update(clientRef, { accounts });
    
    return newBalance;
  });
}
```

#### Balance Rebuild Function

```javascript
// Rebuild all account balances from transactions
async function rebuildClientBalances(clientId, startYear = null) {
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    throw new Error(`Client ${clientId} not found`);
  }
  
  // Get current account structure
  let accounts = clientDoc.data().accounts || [];
  
  // If we have a start year, try to get the snapshot
  if (startYear) {
    const snapshotRef = db
      .collection('clients')
      .doc(clientId)
      .collection('yearEndBalances')
      .doc(startYear.toString());
    
    const snapshot = await snapshotRef.get();
    
    if (snapshot.exists) {
      // Use account balances from year-end snapshot
      const snapshotAccounts = snapshot.data().accounts;
      
      // Map snapshot balances to current account structure
      accounts = accounts.map(account => {
        const snapshotAccount = snapshotAccounts.find(snap => snap.name === account.name);
        return {
          ...account,
          balance: snapshotAccount ? snapshotAccount.balance : 0
        };
      });
    } else {
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
    const startDate = new Date(`${startYear}-12-31T23:59:59Z`);
    query = query.where('date', '>', startDate);
  }
  
  // Get all transactions
  const transactions = await query.get();
  
  // Apply each transaction to the account balances
  transactions.forEach(doc => {
    const transaction = doc.data();
    
    // Find the account for this transaction
    const accountIndex = accounts.findIndex(acc => acc.name === transaction.account);
    
    if (accountIndex !== -1) {
      // Update the balance based on the transaction amount
      accounts[accountIndex].balance += transaction.amount;
      
      // Update the timestamp to the latest transaction date
      if (!accounts[accountIndex].updated || 
          transaction.date.toDate() > accounts[accountIndex].updated.toDate()) {
        accounts[accountIndex].updated = transaction.date;
      }
    }
  });
  
  // Update the client with recalculated balances
  await clientRef.update({ 
    accounts,
    lastBalanceRebuild: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return accounts;
}
```

#### Year-End Snapshot Function

```javascript
// Create a year-end snapshot of account balances
async function createYearEndSnapshot(clientId, year) {
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    throw new Error(`Client ${clientId} not found`);
  }
  
  const accounts = clientDoc.data().accounts || [];
  
  // Create year-end snapshot format (includes only essential fields)
  const yearEndAccounts = accounts.map(account => ({
    name: account.name,
    type: account.type,
    currency: account.currency,
    balance: account.balance,
    snapshotDate: `${year}-12-31`
  }));
  
  // Store the snapshot
  await db
    .collection('clients')
    .doc(clientId)
    .collection('yearEndBalances')
    .doc(year.toString())
    .set({
      accounts: yearEndAccounts,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  
  return yearEndAccounts;
}
```

### 3. Transaction CRUD Updates

Modify transaction CRUD operations to update account balances:

```javascript
// Create transaction
async function createTransaction(clientId, transactionData) {
  // Validate transaction data
  // ...
  
  const db = admin.firestore();
  const batch = db.batch();
  
  // Add transaction document
  const transactionRef = db
    .collection('clients')
    .doc(clientId)
    .collection('transactions')
    .doc(); // Auto-generate ID
  
  batch.set(transactionRef, {
    ...transactionData,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Update account balance
  await updateAccountBalance(clientId, transactionData.account, transactionData.amount);
  
  await batch.commit();
  
  return transactionRef.id;
}

// Update transaction
async function updateTransaction(clientId, transactionId, updatedData) {
  const db = admin.firestore();
  
  // Get the original transaction
  const transactionRef = db
    .collection('clients')
    .doc(clientId)
    .collection('transactions')
    .doc(transactionId);
  
  const originalDoc = await transactionRef.get();
  
  if (!originalDoc.exists) {
    throw new Error(`Transaction ${transactionId} not found`);
  }
  
  const originalData = originalDoc.data();
  
  // Start a transaction for atomicity
  await db.runTransaction(async (transaction) => {
    // If amount or account changed, update balances
    if (updatedData.amount !== originalData.amount || 
        updatedData.account !== originalData.account) {
      
      // If account changed, update both accounts
      if (updatedData.account !== originalData.account) {
        // Reverse original transaction
        await updateAccountBalance(clientId, originalData.account, -originalData.amount);
        
        // Apply to new account
        await updateAccountBalance(clientId, updatedData.account, updatedData.amount);
      } else {
        // Same account, just update the amount difference
        const amountDifference = updatedData.amount - originalData.amount;
        await updateAccountBalance(clientId, originalData.account, amountDifference);
      }
    }
    
    // Update the transaction document
    transaction.update(transactionRef, {
      ...updatedData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  
  return transactionId;
}

// Delete transaction
async function deleteTransaction(clientId, transactionId) {
  const db = admin.firestore();
  
  // Get the transaction to be deleted
  const transactionRef = db
    .collection('clients')
    .doc(clientId)
    .collection('transactions')
    .doc(transactionId);
  
  const doc = await transactionRef.get();
  
  if (!doc.exists) {
    throw new Error(`Transaction ${transactionId} not found`);
  }
  
  const transactionData = doc.data();
  
  // Start a transaction for atomicity
  await db.runTransaction(async (transaction) => {
    // Reverse the effect on account balance
    await updateAccountBalance(clientId, transactionData.account, -transactionData.amount);
    
    // Delete the transaction document
    transaction.delete(transactionRef);
  });
  
  return true;
}
```

### 5. API Endpoints

Add these endpoints to the API:

```javascript
// Account management endpoints
app.post('/api/clients/:clientId/accounts', createAccountHandler);
app.put('/api/clients/:clientId/accounts/:accountName', updateAccountHandler);
app.delete('/api/clients/:clientId/accounts/:accountName', deleteAccountHandler);

// Balance management endpoints
app.post('/api/clients/:clientId/rebuild-balances', rebuildBalancesHandler);
app.post('/api/clients/:clientId/year-end-snapshot/:year', createYearEndSnapshotHandler);
app.get('/api/clients/:clientId/year-end-balances/:year', getYearEndBalancesHandler);

```

## Frontend Changes

### 1. Client Component Updates

Update client view components to display account balances:

```jsx
function ClientAccounts({ client }) {
  const accounts = client.accounts || [];
  
  return (
    <div className="accounts-panel">
      <h3>Accounts</h3>
      
      <table className="accounts-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Type</th>
            <th>Currency</th>
            <th>Balance</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(account => (
            <tr key={account.name}>
              <td>{account.name}</td>
              <td>{account.type}</td>
              <td>{account.currency}</td>
              <td className={account.balance < 0 ? 'negative-balance' : ''}>
                {formatCurrency(account.balance, account.currency)}
              </td>
              <td>{formatDate(account.updated)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 2. Transaction Form Updates

Ensure transaction forms include proper account selection:

```jsx
function TransactionForm({ client, onSubmit }) {
  // Form state
  const [form, setForm] = useState({
    account: '',
    amount: 0,
    description: '',
    date: new Date()
  });
  
  // Get accounts from client
  const accounts = client.accounts || [];
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Account</label>
        <select 
          value={form.account} 
          onChange={(e) => setForm({...form, account: e.target.value})}
          required
        >
          <option value="">Select Account</option>
          {accounts.map(account => (
            <option key={account.name} value={account.name}>
              {account.name} ({formatCurrency(account.balance, account.currency)})
            </option>
          ))}
        </select>
      </div>
      
      {/* Other form fields */}
    </form>
  );
}
```

## Conclusion

This technical implementation plan provides a detailed roadmap for transitioning from the monthend balance approach to the direct account balance model. By following these implementation steps, the system will gain improved data integrity, performance, and maintainability.
