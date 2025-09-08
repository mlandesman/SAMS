# Account Balance System

## Implementation Status - COMPLETED (June 9, 2025)

✅ **IMPLEMENTED**: The new account balance system has been fully implemented and is now active in the SAMS application.

### What's Working
- Balance bar in TransactionsView now reads from client document accounts array
- Real-time balance display for cash and bank accounts
- Balance rebuild script for recalculating from year-end snapshots
- Proper cache management for performance
- Legacy code removed and system simplified

### Migration Complete
- All legacy `lastKnownBalances` functionality has been removed
- Monthly balance snapshot dependencies eliminated
- TransactionsView updated to use new `clientAccounts.js` utility

The SAMS system now implements a new approach to tracking client account balances. Rather than storing monthly balance snapshots, each client document contains an array of account objects with current balances. This documentation explains the system, how to use it, and migration procedures.

## Core Concepts

### Account Structure

Each client document contains an `accounts` array with account objects that use stable IDs:

```javascript
accounts: [
  {
    id: "cash-001",
    name: "Cash",
    type: "cash",
    currency: "MXN",
    balance: 5000.00,
    active: true,
    created: Timestamp,
    updated: Timestamp
  },
  {
    id: "bank-cibanco-001",
    name: "CiBanco",
    type: "bank",
    currency: "MXN",
    balance: 10000.00,
    active: true,
    created: Timestamp,
    updated: Timestamp
  }
]
```

### Standard Account Types

The system uses two primary accounts:
- **Cash**: Tracks physical cash transactions
- **CiBanco**: Tracks bank account transactions

### Account Lifecycle Management

Accounts follow a defined lifecycle:

1. **Active**: Normal operating state
2. **Closed**: Account is no longer in use but history is preserved
   - Closed accounts cannot have new transactions
   - Balances of closed accounts should be zero (transferred to another account)
   - Historical transactions remain linked to the account ID

This approach allows:
- **Account Renaming**: Banks can rebrand or names can be corrected
- **Account Replacement**: When switching banks, close the old account and create a new one
- **Multiple Currencies**: Support for multiple accounts with different currencies
- **Data Integrity**: All transactions maintain their correct historical context

### Historical Data

- **Year-end Snapshots**: Stored in the `yearEndBalances` subcollection to preserve historical record
- **Transaction History**: All transaction records are maintained for complete audit trail

## API Endpoints

### Account Management

- `GET /api/clients/:clientId/accounts` - List all accounts for a client
- `POST /api/clients/:clientId/accounts` - Create a new account
- `PUT /api/clients/:clientId/accounts/:accountId` - Update account details
- `PATCH /api/clients/:clientId/accounts/:accountId/close` - Close an account (with optional transfer)
- `PATCH /api/clients/:clientId/accounts/:accountId/reopen` - Reopen a closed account
- `DELETE /api/clients/:clientId/accounts/:accountId` - Delete an account (admin only, rarely used)

### Balance Operations

- `PATCH /api/clients/:clientId/accounts/:accountId/balance` - Update account balance
- `POST /api/clients/:clientId/accounts/rebuild` - Rebuild all account balances from transactions
- `POST /api/clients/:clientId/accounts/year-end/:year` - Create a year-end balance snapshot

## Transaction Balance Integration

The system automatically updates account balances whenever:
1. A transaction is created - adds the amount to the specified account
2. A transaction is updated - adjusts balances based on changes to amount or account
3. A transaction is deleted - reverses the amount from the affected account

## Migration Tools

The `balance-migration.js` script in the `scripts` directory provides tools for:

1. Creating standard accounts for a client
2. Rebuilding account balances from transaction history
3. Creating year-end snapshots
4. Cleaning up old monthly balance documents

### Usage

```bash
# Full migration for a client
node scripts/balance-migration.js <clientId> --full

# Options:
# --accounts      Create standard accounts array
# --rebuild       Rebuild account balances from transactions
# --year-end      Create a year-end snapshot
# --delete-month  Delete monthly balance records
# --all           Create accounts + year-end snapshot + delete monthly records
# --full          Complete migration (all operations + rebuild)
```

## Testing

The `test-accounts.js` script demonstrates basic account operations and balance integration:

```bash
# Run the test script
node scripts/test-accounts.js
```

## Implementation Notes

1. **Balance Consistency**: Transaction operations use Firestore transactions to ensure data consistency
2. **Audit Logging**: All significant balance changes are recorded in the audit log
3. **Defaults**: New clients are initialized with standard "Cash" and "CiBanco" accounts
4. **Error Handling**: Balance operations include comprehensive error handling to prevent data corruption
