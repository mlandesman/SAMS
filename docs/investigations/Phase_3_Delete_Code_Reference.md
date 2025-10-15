# Phase 3: Delete Code Reference Document

**Investigation Date:** October 15, 2025  
**Agent:** Agent_Water_Investigation_Phase_3  
**Purpose:** Complete code reference for delete/reversal system

---

## Primary Delete Functions

### 1. deleteTransaction()
**File:** `backend/controllers/transactionsController.js`  
**Lines:** 696-1016 (320 lines)  
**Type:** Main controller function  
**Exported:** Yes (used by routes)

**Signature:**
```javascript
async function deleteTransaction(clientId, txnId)
```

**Purpose:** Main entry point for transaction deletion with conditional cleanup logic

**Parameters:**
- `clientId` (string): Client ID (e.g., "AVII", "MTC")
- `txnId` (string): Transaction ID to delete

**Returns:**
- `true` on success
- `false` on error

**Flow:**
1. Read transaction document from Firestore
2. Detect transaction type (HOA vs Water vs Other)
3. Start Firestore atomic transaction
4. PHASE 1: Read all required documents (dues, bills)
5. PHASE 2: Execute all writes (delete, cleanup, updates)
6. Commit Firestore transaction
7. POST-DELETE: Surgical recalc (if water)
8. POST-DELETE: Balance rebuild (if HOA)
9. POST-DELETE: Cache invalidation
10. Write audit log
11. Return success/failure

**Key Variables:**
- `originalData`: Transaction document data before deletion
- `isHOATransaction`: Boolean flag for HOA Dues detection
- `isWaterTransaction`: Boolean flag for Water Bills detection
- `hoaCleanupExecuted`: Boolean flag for HOA cleanup execution
- `waterCleanupExecuted`: Boolean flag for Water Bills cleanup execution
- `hoaCleanupDetails`: Object with HOA cleanup results
- `waterCleanupDetails`: Object with Water Bills cleanup results

**Transaction Type Detection (Lines 725-753):**
```javascript
// HOA Detection
const isHOATransaction = originalData.category === 'HOA Dues' || 
                        originalData.metadata?.type === 'hoa_dues';

// Water Detection
const isWaterTransaction = originalData.categoryId === 'water_payments' || 
                          originalData.categoryName === 'Water Payments';
```

**Critical Sections:**
- **Lines 766-787:** HOA Dues document read
- **Lines 789-820:** Water Bills documents query and read
- **Lines 838-870:** HOA cleanup execution
- **Lines 872-891:** Water Bills cleanup execution
- **Lines 894-940:** Post-delete surgical recalc for Water Bills
- **Lines 998-1009:** Post-delete cache invalidation

**Logging:**
- Entry: "🚀 [BACKEND] deleteTransaction called"
- Detection: "🏠 [BACKEND] HOA Transaction check: true/false"
- Detection: "💧 [BACKEND] Water Transaction check: true/false"
- Completion: Audit log written with cleanup details

**Error Handling:**
- Try/catch wrapper around entire function
- Transaction rollback on Firestore error
- Surgical recalc failure doesn't fail deletion (wrapped in try/catch)
- Cache invalidation failure doesn't fail deletion (wrapped in try/catch)

**Dependencies:**
- `getDb()` from `../firebase.js`
- `writeAuditLog()` from `../utils/auditLogger.js`
- `updateAccountBalance()` from `./accountsController.js`
- `rebuildBalances()` from `./accountsController.js`
- `getNow()` from `../services/DateService.js`
- `executeHOADuesCleanupWrite()` (same file)
- `executeWaterBillsCleanupWrite()` (same file)
- `waterDataService` dynamically imported for surgical recalc

---

### 2. executeHOADuesCleanupWrite() - WORKING REFERENCE
**File:** `backend/controllers/transactionsController.js`  
**Lines:** 1050-1225 (175 lines)  
**Type:** Cleanup helper function  
**Status:** ✅ WORKS CORRECTLY

**Signature:**
```javascript
function executeHOADuesCleanupWrite(firestoreTransaction, duesRef, duesData, originalData, txnId)
```

**Purpose:** Reverse HOA Dues payment by cleaning dues document

**Parameters:**
- `firestoreTransaction`: Firestore transaction object (for atomic operations)
- `duesRef`: Document reference to HOA Dues document
- `duesData`: Current dues document data
- `originalData`: Original transaction data (with allocations/duesDistribution)
- `txnId`: Transaction ID being deleted

**Returns:**
```javascript
{
  creditBalanceReversed: number,  // Centavos (can be negative)
  monthsCleared: number,           // Count of months cleared
  newCreditBalance: number         // New credit balance in centavos
}
```

**Implementation Steps:**

**Step 1: Extract Credit Balance (Lines 1068-1080)**
```javascript
const currentCreditBalance = duesData.creditBalance || 0;

// Handle payments as either array or object
let currentPayments = duesData.payments || [];
if (!Array.isArray(currentPayments) && typeof currentPayments === 'object') {
  const paymentsArray = [];
  for (let i = 0; i < 12; i++) {
    paymentsArray[i] = currentPayments[i] || null;
  }
  currentPayments = paymentsArray;
}
```

**Step 2: Analyze Credit History (Lines 1086-1128)**
```javascript
const creditHistory = duesData.creditBalanceHistory || [];
const transactionEntries = creditHistory.filter(entry => entry.transactionId === txnId);

let creditBalanceReversal = 0;

for (const entry of transactionEntries) {
  if (entry.type === 'credit_added') {
    creditBalanceReversal -= entry.amount; // Subtract added credit
  } else if (entry.type === 'credit_used') {
    creditBalanceReversal += entry.amount; // Restore used credit
  } else if (entry.type === 'credit_repair') {
    creditBalanceReversal -= entry.amount; // Reverse repair
  }
}

const newCreditBalance = Math.max(0, currentCreditBalance + creditBalanceReversal);
```

**Step 3: Clear Payment Entries (Lines 1129-1158)**
```javascript
let monthsCleared = 0;
const updatedPayments = [...currentPayments];

const monthsData = getHOAMonthsFromTransaction(originalData);

monthsData.forEach(monthData => {
  const monthIndex = monthData.month - 1;
  const payment = updatedPayments[monthIndex];
  
  if (payment && payment.reference === txnId) {
    monthsCleared++;
    updatedPayments[monthIndex] = {
      amount: 0,
      date: null,
      notes: null,
      paid: false,
      reference: null
    };
  }
});
```

**Step 4: Update Credit History (Lines 1160-1177)**
```javascript
let creditBalanceHistory = Array.isArray(duesData.creditBalanceHistory) 
  ? [...duesData.creditBalanceHistory] 
  : [];

// Remove old entries
creditBalanceHistory = creditBalanceHistory.filter(entry => entry.transactionId !== txnId);

// Add reversal entry
if (creditBalanceReversal !== 0) {
  creditBalanceHistory.push({
    id: randomUUID(),
    timestamp: getNow().toISOString(),
    transactionId: txnId + '_reversal',
    type: creditBalanceReversal > 0 ? 'credit_restored' : 'credit_removed',
    amount: Math.abs(creditBalanceReversal),
    description: 'from Transaction Deletion',
    balanceBefore: currentCreditBalance,
    balanceAfter: newCreditBalance
  });
}
```

**Step 5: Update Dues Document (Lines 1199-1207)**
```javascript
const updateData = {
  creditBalance: newCreditBalance,
  payments: updatedPayments,
  creditBalanceHistory: creditBalanceHistory
};

firestoreTransaction.update(duesRef, updateData);
```

**Why This Works:**
- Uses credit history as source of truth
- Handles all credit scenarios (added, used, repair)
- Updates both balance AND history
- All operations within atomic transaction
- Comprehensive logging
- Returns useful cleanup details

**Key Design Patterns:**
- **Clean Architecture:** Credit data not duplicated in transaction
- **Event Sourcing:** Credit history as immutable log
- **Atomic Operations:** All writes in Firestore transaction
- **Defensive Coding:** Checks for data structure variations

---

### 3. executeWaterBillsCleanupWrite() - BROKEN IMPLEMENTATION
**File:** `backend/controllers/transactionsController.js`  
**Lines:** 1228-1280 (52 lines)  
**Type:** Cleanup helper function  
**Status:** ❌ BROKEN - Missing credit reversal

**Signature:**
```javascript
async function executeWaterBillsCleanupWrite(firestoreTransaction, waterBillDocs, originalData, txnId, clientId)
```

**Purpose:** Reverse Water Bills payment by cleaning bill documents

**Parameters:**
- `firestoreTransaction`: Firestore transaction object
- `waterBillDocs`: Array of bill documents paid by this transaction
- `originalData`: Original transaction data
- `txnId`: Transaction ID being deleted
- `clientId`: Client ID (e.g., "AVII")

**Returns:**
```javascript
{
  billsReversed: number,        // Count of bills reversed
  totalCreditReversed: number   // Always 0 (not implemented)
}
```

**Current Implementation:**

```javascript
async function executeWaterBillsCleanupWrite(firestoreTransaction, waterBillDocs, originalData, txnId, clientId) {
  console.log(`🧹 [BACKEND] Processing Water Bills cleanup write operations for transaction ${txnId}`);
  
  let billsReversed = 0;
  let totalCreditReversed = 0;  // ❌ Never used
  
  // Process each water bill document
  for (const billDoc of waterBillDocs) {
    const { ref: billRef, id: billId, data: billData, unitBill } = billDoc;
    const unitId = originalData.unitId;
    
    console.log(`💧 [BACKEND] Reversing payment for water bill ${billId} Unit ${unitId}`);
    
    // Get payment info from lastPayment
    const lastPayment = unitBill.lastPayment;
    if (!lastPayment || lastPayment.transactionId !== txnId) {
      console.warn(`⚠️ [BACKEND] Skipping bill ${billId} - payment transaction ID mismatch`);
      continue;
    }
    
    // Calculate reversed amounts
    const paidAmountToReverse = lastPayment.amount || 0;
    const basePaidToReverse = lastPayment.baseChargePaid || 0;
    const penaltyPaidToReverse = lastPayment.penaltyPaid || 0;
    
    // Calculate new totals after reversal
    const newPaidAmount = Math.max(0, (unitBill.paidAmount || 0) - paidAmountToReverse);
    const newBasePaid = Math.max(0, (unitBill.basePaid || 0) - basePaidToReverse);
    const newPenaltyPaid = Math.max(0, (unitBill.penaltyPaid || 0) - penaltyPaidToReverse);
    
    // Determine new status
    const totalAmount = unitBill.totalAmount || 0;
    let newStatus = 'unpaid';
    if (newPaidAmount >= totalAmount) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }
    
    console.log(`💧 [BACKEND] Bill ${billId} reversal: paid ${unitBill.paidAmount} → ${newPaidAmount}, status ${unitBill.status} → ${newStatus}`);
    
    // Update the water bill document
    firestoreTransaction.update(billRef, {
      [`bills.units.${unitId}.paidAmount`]: newPaidAmount,
      [`bills.units.${unitId}.basePaid`]: newBasePaid,
      [`bills.units.${unitId}.penaltyPaid`]: newPenaltyPaid,
      [`bills.units.${unitId}.status`]: newStatus,
      [`bills.units.${unitId}.lastPayment`]: null
    });
    
    billsReversed++;
  }
  
  // ❌ MISSING: Credit balance reversal code
  // ❌ MISSING: Credit history update code
  // ❌ MISSING: HOA Dues document update
  
  console.log(`✅ [BACKEND] Water Bills cleanup complete: ${billsReversed} bills reversed`);
  
  return {
    billsReversed: billsReversed,
    totalCreditReversed: totalCreditReversed  // Always 0
  };
}
```

**Missing Implementation (CRITICAL):**

```javascript
// ❌ THIS CODE SHOULD EXIST BUT DOESN'T:

// After processing all bills, handle credit reversal
const unitId = originalData.unitId;
const fiscalYear = parseInt(waterBillDocs[0].id.split('-')[0]);
const duesPath = `clients/${clientId}/units/${unitId}/dues/${fiscalYear}`;
const duesRef = db.doc(duesPath);
const duesDoc = await firestoreTransaction.get(duesRef);

if (duesDoc.exists) {
  const duesData = duesDoc.data();
  
  // Read credit history
  const creditHistory = duesData.creditBalanceHistory || [];
  const transactionEntries = creditHistory.filter(entry => entry.transactionId === txnId);
  
  // Calculate credit reversal
  let creditBalanceReversal = 0;
  for (const entry of transactionEntries) {
    if (entry.type === 'credit_added') {
      creditBalanceReversal -= entry.amount;
    } else if (entry.type === 'credit_used') {
      creditBalanceReversal += entry.amount;
    }
  }
  
  // Update credit balance and history
  if (creditBalanceReversal !== 0) {
    const newCreditBalance = Math.max(0, duesData.creditBalance + creditBalanceReversal);
    
    let updatedCreditHistory = creditHistory.filter(entry => entry.transactionId !== txnId);
    updatedCreditHistory.push({
      id: randomUUID(),
      timestamp: getNow().toISOString(),
      transactionId: txnId + '_reversal',
      type: creditBalanceReversal > 0 ? 'credit_restored' : 'credit_removed',
      amount: Math.abs(creditBalanceReversal),
      description: 'from Water Bill Transaction Deletion',
      balanceBefore: duesData.creditBalance,
      balanceAfter: newCreditBalance
    });
    
    firestoreTransaction.update(duesRef, {
      creditBalance: newCreditBalance,
      creditBalanceHistory: updatedCreditHistory
    });
    
    totalCreditReversed = creditBalanceReversal;
    console.log(`✅ [BACKEND] Reversed credit balance: ${creditBalanceReversal} centavos`);
  }
}
```

**Why It's Broken:**
- No code to read HOA Dues document
- No code to read credit history
- No code to calculate credit reversal
- No code to update credit balance
- No code to update credit history
- Credit operations completely missing

---

### 4. getHOAMonthsFromTransaction() - Helper Function
**File:** `backend/controllers/transactionsController.js`  
**Lines:** 1023-1048 (25 lines)  
**Type:** Helper function  
**Status:** ✅ Works (used by HOA Dues cleanup)

**Signature:**
```javascript
function getHOAMonthsFromTransaction(transactionData)
```

**Purpose:** Extract month data from transaction (supports both allocations and duesDistribution)

**Parameters:**
- `transactionData`: Transaction document data

**Returns:**
```javascript
[
  { month: number, unitId: string, year: number, amount: number },
  // ... for each month paid
]
```

**Implementation:**
```javascript
function getHOAMonthsFromTransaction(transactionData) {
  // Check for allocations first (new format)
  if (transactionData.allocations && transactionData.allocations.length > 0) {
    return transactionData.allocations
      .filter(allocation => allocation.type === "hoa_month")
      .map(allocation => ({
        month: allocation.data.month,
        unitId: allocation.data.unitId,
        year: allocation.data.year,
        amount: allocation.amount
      }));
  }
  
  // Fallback to duesDistribution (legacy format)
  if (transactionData.duesDistribution && transactionData.duesDistribution.length > 0) {
    return transactionData.duesDistribution.map(dues => ({
      month: dues.month,
      unitId: dues.unitId,
      year: dues.year,
      amount: dues.amount
    }));
  }
  
  // No HOA month data found
  return [];
}
```

**Usage:** Called by `executeHOADuesCleanupWrite()` to identify which months to clear

**Note:** Water Bills doesn't have an equivalent helper because it uses `waterBillDocs` array directly

---

## Integration Functions

### 5. updateAggregatedDataAfterPayment() - Surgical Update
**File:** `backend/services/waterDataService.js`  
**Lines:** ~536-557 (estimated - need exact line numbers)  
**Type:** Service method  
**Status:** ⚠️ UNCLEAR - Called but might not work for reversals

**Signature:**
```javascript
async updateAggregatedDataAfterPayment(clientId, year, affectedUnitsAndMonths)
```

**Purpose:** Surgically update aggregatedData for specific units/months after payment

**Parameters:**
- `clientId`: Client ID
- `year`: Fiscal year
- `affectedUnitsAndMonths`: Array of `{ unitId, monthId }` objects

**Called From:**
- Line 920-925 in `deleteTransaction()` after Water Bills cleanup
- Also called after normal Water Bills payments

**Implementation (Based on Oct 14 Memory Log):**
```javascript
async updateAggregatedDataAfterPayment(clientId, year, affectedUnitsAndMonths) {
  // Read existing aggregatedData
  const dataRef = db.doc(`clients/${clientId}/projects/waterBills/aggregatedData/${year}`);
  const dataDoc = await dataRef.get();
  const data = dataDoc.data();
  
  // For each affected unit/month
  for (const { unitId, monthId } of affectedUnitsAndMonths) {
    const monthIndex = parseInt(monthId.split('-')[1]); // Extract month from "YYYY-MM"
    
    // Get existing unit data (optimization from Oct 14)
    const existingUnitData = data.months[monthIndex].units[unitId];
    
    // Build updated unit data (fast path - only fetch bill, reuse rest)
    const updatedUnitData = await this.buildSingleUnitData(
      clientId, year, monthIndex, unitId, 
      existingUnitData  // Pass existing data for optimization
    );
    
    // Replace in aggregatedData
    data.months[monthIndex].units[unitId] = updatedUnitData;
  }
  
  // Recalculate year summary
  data.summary = this.calculateYearSummary(data.months);
  
  // Update lastPenaltyUpdate timestamp
  data.lastPenaltyUpdate = getNow().toISOString();
  
  // Write back to Firestore
  await dataRef.update(data);
}
```

**Critical Questions:**

**Q1: Is this function designed for payment REVERSALS?**
- **For Payments:** Bill goes unpaid → paid, amounts increase
- **For Reversals:** Bill goes paid → unpaid, amounts decrease to 0
- **Code Review Needed:** Does it handle both directions?

**Q2: Why isn't `lastPenaltyUpdate` updating after delete?**
- Code shows it should update: `data.lastPenaltyUpdate = getNow().toISOString()`
- Evidence shows it doesn't: Timestamp stays static after delete
- **Hypothesis:** Function not executing, or failing silently

**Q3: Should delete use this function at all?**
- **Option A:** Use surgical update (current approach)
- **Option B:** Trigger full recalc instead
- **Option C:** Skip update, let next load recalc

---

### 6. buildSingleUnitData() - Surgical Update Helper
**File:** `backend/services/waterDataService.js`  
**Lines:** 177-259 (estimated)  
**Type:** Service method  
**Status:** ✅ Optimized Oct 14, but unclear if handles reversals

**Signature:**
```javascript
async buildSingleUnitData(clientId, year, month, unitId, existingUnitData = null)
```

**Purpose:** Build or update data for a single unit in a specific month

**Parameters:**
- `clientId`: Client ID
- `year`: Fiscal year
- `month`: Month index (0-11)
- `unitId`: Unit ID
- `existingUnitData`: Optional existing unit data (for fast path)

**Returns:** Updated unit data object

**Implementation (From Oct 14 Optimization):**
```javascript
async buildSingleUnitData(clientId, year, month, unitId, existingUnitData = null) {
  // OPTIMIZATION: Fast path if existing data provided
  if (existingUnitData) {
    console.log(`⚡ [SURGICAL] Using existing unit data, fetching only updated bill`);
    
    // Only fetch updated bill document
    const bills = await this.fetchBills(clientId, year, month);
    const bill = bills?.bills?.units?.[unitId];
    
    // Update only payment-related fields
    return {
      ...existingUnitData,  // Keep existing consumption, charges, etc.
      paidAmount: bill.paidAmount || 0,
      unpaidAmount: bill.totalAmount - (bill.paidAmount || 0),
      status: this.calculateStatus(bill),
      transactionId: bill.lastPayment?.transactionId || null,
      payments: bill.payments || []
    };
  }
  
  // Full calculation if no existing data
  // ... [full calculation code]
}
```

**Critical Analysis:**
- **For Payments:** Bill.paidAmount increases, status changes to "paid"
- **For Reversals:** Bill.paidAmount should be 0, status should be "unpaid"
- **Question:** Does `calculateStatus()` correctly handle paidAmount = 0?
- **Question:** Does this read the UPDATED bill after delete, or cached bill?

---

### 7. calculateYearSummary() - Full Recalc
**File:** `backend/services/waterDataService.js`  
**Function:** `calculateYearSummary(clientId, year)`  
**Type:** Service method  
**Status:** ⚠️ SHOULD fix data, but doesn't according to reports

**Purpose:** Rebuild entire aggregatedData from bill/reading documents

**Process:**
1. Fetch ALL bill documents for year
2. Fetch ALL reading documents for year
3. Calculate consumption, charges, penalties for all units
4. Build complete aggregatedData structure
5. Write to Firestore

**Critical Question:** Why doesn't full refresh fix bill status after delete?

**Hypothesis 1:** Bill documents NOT actually updated (transaction failed?)
- **Test:** Check Firestore console immediately after delete
- **Evidence Needed:** Bill document state in Firestore

**Hypothesis 2:** Full recalc reads cached bill data
- **Test:** Check if cache cleared before recalc
- **Evidence Needed:** Cache invalidation logs

**Hypothesis 3:** Full recalc logic doesn't read payment status correctly
- **Test:** Code review of bill reading logic
- **Evidence Needed:** How does it determine paid/unpaid status?

---

## Architecture Questions & Recommendations

### Question 1: Should Surgical Update Be Used for Deletes?

**Current Implementation:** Yes, surgical update called after delete

**Arguments FOR:**
- Faster than full recalc (~500ms vs 8000ms)
- Consistent with payment flow
- Only updates affected units

**Arguments AGAINST:**
- Surgical update optimized for payments, not reversals
- Might not handle paid → unpaid correctly
- Full recalc is "safer" (rebuilds from source documents)

**Recommendation:**
- **Short-term:** Fix surgical update to handle reversals correctly
- **Long-term:** Consider triggering full recalc after delete (simpler, safer)

---

### Question 2: Where Should Credit Reversal Happen?

**Option A:** In `executeWaterBillsCleanupWrite()` (like HOA pattern)
- **Pros:** All cleanup in one place, atomic with bill updates
- **Cons:** Makes function longer, requires HOA Dues document read

**Option B:** In separate `reverseCreditForTransaction()` function
- **Pros:** Single responsibility, reusable
- **Cons:** Requires two Firestore transaction operations

**Option C:** In surgical update logic
- **Pros:** Happens automatically with aggregatedData update
- **Cons:** Mixing concerns, less clear

**Recommendation:** **Option A** - Follow HOA pattern, keep cleanup in one atomic function

---

### Question 3: Should Penalties Be Recalculated or Restored?

**Current Behavior:** Penalties stay as they were when bill was paid

**Option A:** Restore penalties from bill document (no recalculation)
- **Pros:** Fast, preserves historical penalties
- **Cons:** Penalties might be outdated if bill now older

**Option B:** Recalculate penalties using current date
- **Pros:** Accurate to current date
- **Cons:** Slower, changes historical state

**Option C:** Let surgical update/full recalc handle it
- **Pros:** Consistent with rest of system
- **Cons:** Adds complexity

**Recommendation:** **Option A** - Restore existing penalties, let next scheduled recalc update if needed

---

### Question 4: Should Delete Validate Payment Can Be Reversed?

**Current Behavior:** Delete succeeds even if reversal incomplete

**Option A:** Validate before delete (check credit exists, bills exist, etc.)
- **Pros:** Prevents partial reversals
- **Cons:** More complex, slower

**Option B:** Allow partial reversal (current approach)
- **Pros:** Simple, delete always succeeds
- **Cons:** Can leave data inconsistent

**Option C:** Validate AND rollback on reversal failure
- **Pros:** Ensures consistency
- **Cons:** Complex error handling

**Recommendation:** **Option C** - Since using Firestore transactions, leverage atomic rollback

---

## Code Fix Implementation Plan

### Fix 1: Add Credit Reversal to executeWaterBillsCleanupWrite()
**Location:** After line 1276 (before function end)  
**Lines to Add:** ~80 lines  
**Complexity:** Low - copy/adapt from HOA pattern  
**Testing:** Credit used, credit added, no credit scenarios

### Fix 2: Verify Bill Update Persistence
**Location:** Lines 1270-1276  
**Action:** Add Firestore console logging before/after update  
**Complexity:** Trivial - logging only  
**Testing:** Inspect Firestore immediately after delete

### Fix 3: Fix or Replace Surgical Update for Reversals
**Location:** `backend/services/waterDataService.js`  
**Options:**
- A) Modify `updateAggregatedDataAfterPayment()` to detect reversals
- B) Create separate `reverseAggregatedDataAfterDelete()` function
- C) Replace surgical update with full recalc trigger  
**Complexity:** Medium  
**Testing:** Multi-month delete, verify aggregatedData correct

### Fix 4: Update Return Object
**Location:** Line 1278-1282  
**Action:** Return comprehensive cleanup details  
**Complexity:** Trivial  
**Testing:** Verify audit logs show credit reversal

---

**Code Reference Status:** Complete - Ready for implementation planning


