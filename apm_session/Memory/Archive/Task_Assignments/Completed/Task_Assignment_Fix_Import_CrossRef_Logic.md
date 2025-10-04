# Task Assignment: Fix Import CrossRef Logic and Data Flow

**Task Type:** Implementation - Import System Fix
**Priority:** CRITICAL - Blocking all imports
**Assigned Agent Type:** Implementation Agent
**Estimated Sessions:** 2-3

## Background

The import system is failing because:
1. The HOA_Transaction_CrossRef.json file is missing
2. Agents have been bypassing controllers and using direct Firebase calls
3. The CrossRef needs to be built during import by reading transaction data

## Key Understanding

**DO NOT CREATE FIRESTORE STRUCTURES DIRECTLY**
- Always use the existing controllers (unitsController, transactionsController, etc.)
- Controllers create the proper nested structures and relationships
- Only yearEndBalances lacks a controller (which is why it failed before)

## The CrossRef Problem

The import process needs to:
1. Read transactions JSON and find all "Category: HOA Dues" entries
2. Extract the sequence number from the unnamed first field (e.g., "": 25030)
3. When creating the transaction via controller, capture the generated transactionId
4. Build a CrossRef mapping: sequence number → transactionId
5. Use this when importing HOA dues to link payments to transactions

## Import Data Structure

### Transactions JSON Format
```json
{
  "": 25030,                    // <-- Sequence number (unnamed field)
  "Date": "2025-01-17T15:44:54.887Z",
  "Vendor": "Transfer Cash to Bank",
  "Category": "HOA Dues",       // <-- Key identifier for HOA payments
  "Unit": "A101",
  "Amount": -25720,
  "Account": "MTC Bank",
  "Notes": "HOA Payment for January"
}
```

### HOA Dues JSON Format
The dues records contain allocations and reference the sequence number:
```json
{
  // ... dues fields ...
  "notes": "Payment received Seq: 25030",  // <-- Links to transaction
  "allocations": [...]
}
```

## Critical Architecture Understanding: HOA Import Flow

**KEY INSIGHT: Transaction and HOA data are in DIFFERENT import files**
- Transaction import has: amount, date, vendor, category, sequence number
- HOA dues import has: payment distribution details (which months, amounts per month)
- The allocations data is ONLY available in the HOA dues import file!

## Implementation Steps

### Phase 1: Import Foundation Data

1. **Import** categories and vendors (independent, no dependencies)
2. **Import** units (no transaction dependencies)

### Phase 2: Import ALL Transactions (Including HOA) WITHOUT Allocations

1. **Read** all transactions from transaction import file
2. **Create** transactions via controller - including HOA ones but WITHOUT allocations
3. **Build** CrossRef mapping during import:
   ```javascript
   const hoaCrossRef = {
     generated: new Date().toISOString(),
     totalRecords: 0,
     bySequence: {},
     byUnit: {}
   };
   
   for (const txn of transactions) {
     const seqNumber = txn[""]; // Unnamed first field
     
     // Create transaction WITHOUT allocations (we don't have that data yet!)
     const result = await transactionsController.createTransaction({
       amount: txn.Amount,
       date: txn.Date,
       vendorName: txn.Vendor,
       categoryName: txn.Category,
       unitId: txn.Unit,
       // ... other fields, but NO allocations
     });
     
     // Save mapping for HOA transactions
     if (txn.Category === "HOA Dues" && seqNumber) {
       hoaCrossRef.bySequence[seqNumber] = {
         transactionId: result.transactionId,
         unitId: txn.Unit,
         amount: txn.Amount,
         date: txn.Date
       };
       hoaCrossRef.totalRecords++;
       
       // Also track by unit
       if (!hoaCrossRef.byUnit[txn.Unit]) {
         hoaCrossRef.byUnit[txn.Unit] = [];
       }
       hoaCrossRef.byUnit[txn.Unit].push({
         transactionId: result.transactionId,
         unitId: txn.Unit,
         amount: txn.Amount,
         date: txn.Date,
         sequenceNumber: seqNumber
       });
     }
   }
   
   // Save CrossRef to file for debugging/recovery
   await fs.writeFile(
     path.join(dataDir, 'HOA_Transaction_CrossRef.json'),
     JSON.stringify(hoaCrossRef, null, 2)
   );
   ```

### Phase 3: Import HOA Dues and UPDATE Transactions

**Step 1: Process HOA Dues Data**

1. **Read** HOA dues import file (this has the allocation details!)
2. **Parse** "Seq: NNNNN" from notes field
3. **Look up** transactionId from CrossRef
4. **Create** dues documents with transactionId
5. **Build** allocations array from dues payment data

**Step 2: UPDATE the Transaction with Allocations**

```javascript
// After creating dues documents, go back and update the transaction
const allocations = buildAllocationsFromDuesData(duesData);
await transactionsController.updateTransaction(transactionId, {
  allocations: allocations,
  categoryName: "-Split-", // Update to split transaction
  // Update other fields as needed
});
```

### Important Notes

1. **Verify** if `duesDistribution` field is legacy and can be removed
2. **Test** that transaction update preserves all original data
3. **Ensure** allocations array matches dues documents exactly

### Step 3: Fix Other Import Issues

1. **Units Import Error**: Debug why documentPath is empty
   - Check if unitId/unitNumber is being set properly
   - Ensure using unitsController.createUnit, not direct Firebase

2. **Categories/Vendors**: Ensure using proper controllers

3. **Year-End Balances**: Already fixed structure issue

## Critical Rules

1. **NEVER** use Firebase direct calls for data that has a controller
2. **ALWAYS** use the controller methods:
   - `unitsController.createUnit()`
   - `transactionsController.createTransaction()`
   - etc.
3. **ONLY** use direct Firebase for collections without controllers (like yearEndBalances)
4. **TEST** each import type individually before moving to the next

## Testing Approach

1. Start with a small test dataset (5-10 records)
2. Import transactions first, verify CrossRef builds correctly
3. Import units next
4. Import HOA dues using CrossRef
5. Verify in Firebase console that structures are correct

## Expected Outcome

- All import types working without errors
- HOA payments properly linked to transactions
- No missing CrossRef file errors
- Data structures match existing AVII production data

## Files to Review

- `/backend/services/importService.js` - Main import orchestration
- `/backend/controllers/transactionsController.js` - How to create transactions
- `/backend/controllers/unitsController.js` - How to create units
- `/scripts/data-augmentation-utils.js` - Data transformation logic
- Source data files in `/MTCdata/` and `/AVIIdata/`

Remember: The controllers know how to build the proper Firestore structures. Trust them and use them!