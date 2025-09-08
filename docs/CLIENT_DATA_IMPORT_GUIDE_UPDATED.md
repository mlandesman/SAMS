# Client Data Import Guide - Updated for Clean Credit Balance Architecture

## ⚠️ CRITICAL CHANGES - Clean Architecture Implementation

### Credit Balance Data Structure Changes ✅

**OLD STRUCTURE (DEPRECATED):**
```javascript
// ❌ REMOVED: Credit fields in transactions
{
  "creditBalanceAdded": 100,
  "creditUsed": 50,
  "newCreditBalance": 150
}
```

**NEW STRUCTURE (CURRENT):**
```javascript
// ✅ ONLY in HOA Dues documents
// clients/{clientId}/units/{unitId}/dues/{year}
{
  "creditBalance": 150,
  "creditBalanceHistory": [
    {
      "id": "uuid",
      "timestamp": "2025-06-22T15:29:57.000Z",
      "transactionId": "txn_abc123",
      "type": "credit_used",
      "amount": 50,
      "description": "from bank_transfer",
      "balanceBefore": 200,
      "balanceAfter": 150,
      "notes": "HOA Dues payment"
    }
  ]
}
```

## Import Process Overview

### 1. Units Import
- Import unit data first (no changes needed)
- Structure remains the same

### 2. Transactions Import
**CRITICAL: DO NOT include credit balance fields in transactions**

```javascript
// ✅ CORRECT transaction structure
{
  "date": "2025-06-22",
  "amount": 5800,
  "category": "HOA Dues",
  "transactionType": "income",
  "accountType": "Bank",
  "paymentMethod": "bank_transfer",
  "notes": "HOA Dues payment for Unit 1B",
  "unit": "1B",
  "vendor": "Deposit",
  "reference": "DUES-1B-2025",
  "metadata": {
    "type": "hoa_dues",
    "unitId": "1B",
    "year": 2025,
    "months": [6]
  }
  // ❌ DO NOT INCLUDE: creditBalanceAdded, creditUsed, newCreditBalance
}
```

### 3. HOA Dues Import
**NEW REQUIREMENT: Initialize creditBalanceHistory**

```javascript
// ✅ REQUIRED structure for HOA dues documents
{
  "creditBalance": 200,
  "scheduledAmount": 5800,
  "payments": [
    {
      "month": 1,
      "paid": 5800,
      "date": "2025-01-15T00:00:00.000Z",
      "transactionId": "txn_abc123",
      "notes": "January payment"
    }
  ],
  "creditBalanceHistory": [
    {
      "id": "starting-balance-uuid",
      "timestamp": "2025-01-01T00:00:00.000Z",
      "transactionId": null,
      "type": "starting_balance",
      "amount": 200,
      "description": "Initial credit balance",
      "balanceBefore": 0,
      "balanceAfter": 200,
      "notes": "Import initialization"
    }
  ]
}
```

## Credit Balance History Types

### Required Types for Import:

1. **starting_balance**: Initial credit balance
2. **credit_added**: Credit added from overpayments
3. **credit_used**: Credit used for payments
4. **credit_repair**: Credit added to fix negative balances
5. **credit_restored**: Credit restored from transaction deletion

## Import Script Updates Required

### Update All Import Scripts:

1. **Remove credit fields from transaction creation**
2. **Initialize creditBalanceHistory in dues documents**
3. **Set starting balances properly**

### Example Updated Import Function:

```javascript
// ✅ Updated import function
async function importHOADuesWithCreditBalance(clientId, unitId, year, duesData) {
  const duesRef = db.collection('clients').doc(clientId)
    .collection('units').doc(unitId)
    .collection('dues').doc(year.toString());
  
  // Initialize credit balance history if there's a starting balance
  const creditBalanceHistory = [];
  if (duesData.creditBalance && duesData.creditBalance > 0) {
    creditBalanceHistory.push({
      id: randomUUID(),
      timestamp: new Date(`${year}-01-01T00:00:00.000Z`).toISOString(),
      transactionId: null,
      type: 'starting_balance',
      amount: duesData.creditBalance,
      description: 'Initial credit balance',
      balanceBefore: 0,
      balanceAfter: duesData.creditBalance,
      notes: 'Import initialization'
    });
  }
  
  const finalDuesData = {
    ...duesData,
    creditBalanceHistory: creditBalanceHistory
  };
  
  await duesRef.set(finalDuesData);
}
```

## Validation Requirements

### Before Import:
1. ✅ Verify no credit fields in transaction documents
2. ✅ Verify all dues documents have creditBalanceHistory array
3. ✅ Verify credit balance matches history calculations

### After Import:
1. ✅ Run credit balance validation script
2. ✅ Verify single source of truth (no duplicates)
3. ✅ Test transaction deletion/restoration

## Migration from Old Structure

If importing from systems with the old structure:

```javascript
// Convert old structure to new
function convertOldCreditStructure(oldDuesData) {
  const creditBalanceHistory = [];
  
  // If there's an existing credit balance, create starting entry
  if (oldDuesData.creditBalance > 0) {
    creditBalanceHistory.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      transactionId: null,
      type: 'starting_balance',
      amount: oldDuesData.creditBalance,
      description: 'Migrated from old structure',
      balanceBefore: 0,
      balanceAfter: oldDuesData.creditBalance,
      notes: 'Data migration'
    });
  }
  
  return {
    ...oldDuesData,
    creditBalanceHistory: creditBalanceHistory
  };
}
```

## Important Notes

1. **Single Source of Truth**: Credit data exists ONLY in HOA dues documents
2. **No Duplication**: Never store credit fields in transactions
3. **Complete History**: Always maintain creditBalanceHistory array
4. **Referential Integrity**: Link history entries to transactions via transactionId
5. **Validation**: Always validate data consistency after import

## Scripts to Update

Update these import scripts with new structure:
- `/scripts/importMTCData.js`
- `/scripts/importHOADuesFixed.js`
- `/scripts/importTransactionsForMTC.js`
- `/frontend/sams-ui/src/utils/hoaDuesImporter.js`

All scripts should follow the clean architecture principles outlined above.