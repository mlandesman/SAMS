# Balance Tracking System Redesign

## Overview

This document outlines a redesign of the balance tracking system in SAMS to address limitations with the current monthend balance approach. The new design shifts to a more robust model with account balances stored directly in the client document, while still maintaining yearly snapshots for historical reference.

## Current Implementation

The current implementation uses a monthend snapshot approach:

- Balance records are stored at `/clients/{clientId}/balances/{YYYY-MM}`
- Each transaction updates only itself, not the balance records
- Balance records are created at month-end
- Historical balances require accessing the appropriate month-end record

### Limitations of Current Approach

1. **Data Integrity Issues**: Editing, deleting, or adding backdated transactions invalidates all subsequent balance records
2. **Complexity**: Balance reconstruction requires finding the correct month record and applying transaction deltas
3. **Data Volume**: Creates many balance records over time (one per month)
4. **Performance**: Historical balance lookups may require multiple document reads and calculations
5. **Maintenance**: Correcting historical data requires rebuilding all subsequent monthend records

## Proposed Implementation

The new implementation combines account configuration and current balances into a direct array within the client document:

### 1. Account Storage

Store accounts directly in the client document:

```javascript
// clients/{clientId}
{
  id: "clientId",
  name: "Client Name",
  // Other client fields...
  
  accounts: [
    { name: "Cash", currency: "MXN", type: "cash", balance: 45000, updated: timestamp },
    { name: "CiBanco", currency: "MXN", type: "bank", balance: 500, updated: timestamp }
  ]
}
```

### 2. Year-End Snapshots

Create yearly snapshots of account balances:

```javascript
// clients/{clientId}/yearEndBalances/2024
{
  accounts: [
    { name: "Cash", currency: "MXN", type: "cash", balance: 42000, snapshotDate: "2024-12-31" },
    { name: "CiBanco", currency: "MXN", type: "bank", balance: 350, snapshotDate: "2024-12-31" }
  ],
  createdAt: timestamp
}
```

### 3. Balance Updates

Update balances within the account records on every transaction CRUD operation:
- **Create**: Add transaction amount to the relevant account balance
- **Update**: Adjust account balance by the delta between old and new transaction amounts
- **Delete**: Subtract transaction amount from the account balance

### 4. Balance Rebuilding

Provide a balance rebuild function that:
1. Starts from zero or a year-end snapshot
2. Processes all subsequent transactions chronologically
3. Recalculates account balances

## Benefits of New Approach

1. **Data Integrity**: Balances are updated with every transaction CRUD operation
2. **Simplicity**: Self-contained account objects with their own balances
3. **Performance**: Direct access to current balances (single document read)
4. **Flexibility**: Easy to add metadata to accounts without structural changes
5. **Maintainability**: Clear ownership of balance data, simpler rebuild process

## Required Changes

To transition from the current monthend approach to the new design:

### Database Schema Changes

1. **Account Structure Modification**:
   - Add `accounts` array to client documents
   - Populate with account metadata and current balances

2. **Year-End Collection**:
   - Create `yearEndBalances` subcollection to replace monthend records
   - Implement year-end snapshot creation process

### Code Changes

#### 1. Transaction Processing Logic

Update all transaction CRUD operations to modify account balances:

```javascript
// Current approach
createTransaction(clientId, transaction) {
  // Just store the transaction
  db.collection(`clients/${clientId}/transactions`).add(transaction);
}

// New approach
createTransaction(clientId, transaction) {
  // Store transaction
  db.collection(`clients/${clientId}/transactions`).add(transaction);
  
  // Update account balance
  updateAccountBalance(clientId, transaction.account, transaction.amount);
}
```

#### 2. Account Management

Add logic to manage account creation, modification, and deletion:

```javascript
// Add new account
function addAccount(clientId, accountDetails) {
  return db.runTransaction(async (transaction) => {
    const clientRef = db.collection('clients').doc(clientId);
    const doc = await transaction.get(clientRef);
    
    const accounts = doc.data().accounts || [];
    accounts.push({
      ...accountDetails,
      balance: 0,
      updated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    transaction.update(clientRef, { accounts });
  });
}
```

#### 3. Balance Update Function

Create a function to update account balances during transaction operations:

```javascript
async function updateAccountBalance(clientId, accountName, amount, isNew = true) {
  const clientRef = db.collection('clients').doc(clientId);
  
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(clientRef);
    const accounts = doc.data().accounts || [];
    const accountIndex = accounts.findIndex(acc => acc.name === accountName);
    
    if (accountIndex === -1) {
      throw new Error(`Account not found: ${accountName}`);
    }
    
    // Update balance
    const account = accounts[accountIndex];
    const newBalance = isNew ? account.balance + amount : amount;
    
    accounts[accountIndex] = {
      ...account,
      balance: newBalance,
      updated: admin.firestore.FieldValue.serverTimestamp()
    };
    
    transaction.update(clientRef, { accounts });
  });
}
```

#### 4. Balance Rebuilding Function

Create a function to rebuild account balances from transactions:

```javascript
async function rebuildBalances(clientId, startYear = null) {
  // Implementation as described in previous section
}
```

#### 5. API and Controller Updates

Update the following controllers and API endpoints:

- `transactionsController.js` - All CRUD operations
- `balancesController.js` - New methods for account balance management
- `clientsController.js` - Include accounts in client creation/updates

#### 6. UI Updates

- Update balance display components to read from client.accounts
- Modify transaction forms to handle balance updates
- Update account management screens


## Conclusion

This redesign addresses the fundamental limitations of the monthend balance approach by maintaining current balances directly in the client document. The approach simplifies balance tracking while maintaining historical data through year-end snapshots.

The implementation requires significant changes to both data structure and application code, but will result in a more robust, performant, and maintainable system that better handles the realities of transaction management.
