# Phase 3: Delete Data Structure Reversal Map

**Investigation Date:** October 15, 2025  
**Agent:** Agent_Water_Investigation_Phase_3  
**Purpose:** Document expected vs actual data structure changes during delete/reversal

---

## A. Bill Document Reversal

### Bill Document Structure (Water Bills)
**Collection Path:** `clients/{clientId}/projects/waterBills/bills/{YYYY-MM}`

---

### BEFORE Delete (Bill is PAID)

```javascript
{
  bills: {
    month: 3,  // October (0-based: 0=July, 3=October in fiscal year 2026)
    fiscalYear: 2026,
    generatedDate: "2025-10-11T04:41:34.116Z",
    units: {
      "203": {
        // Basic Charges
        currentCharge: 350,
        previousBalance: 0,
        
        // Penalties
        penalties: 49.98,
        penaltyDetails: {
          dayslate: 11,
          penaltyRate: 2,
          calculatedPenalty: 14.14,
          carryoverPenalty: 35.84
        },
        
        // Totals
        totalAmount: 399.98,  // currentCharge + penalties
        
        // Payment Information - THIS IS WHAT NEEDS TO BE REVERSED
        paidAmount: 399.98,      // ← NEEDS TO BE RESET TO 0
        basePaid: 350,            // ← NEEDS TO BE RESET TO 0
        penaltyPaid: 49.98,       // ← NEEDS TO BE RESET TO 0
        status: "paid",           // ← NEEDS TO CHANGE TO "unpaid"
        
        // Payment Record
        lastPayment: {            // ← NEEDS TO BE CLEARED
          amount: 399.98,
          transactionId: "2025-10-15_123456_789",
          date: "2025-10-15T20:30:00.000Z",
          method: "eTransfer",
          baseChargePaid: 350,
          penaltyPaid: 49.98
        },
        
        // Possible payments array (if exists)
        payments: [              // ← MAY NEED TO BE CLEARED
          {
            amount: 399.98,
            transactionId: "2025-10-15_123456_789",
            date: "2025-10-15T20:30:00.000Z",
            method: "eTransfer"
          }
        ],
        
        // Consumption Data (unchanged by delete)
        consumption: 5.2,
        previousReading: 1234.5,
        currentReading: 1239.7,
        ratePerM3: 67.31
      }
    }
  },
  metadata: {
    lastUpdated: "2025-10-15T20:30:00.000Z",
    updatedBy: "system"
  }
}
```

---

### AFTER Delete (EXPECTED STATE)

```javascript
{
  bills: {
    month: 3,
    fiscalYear: 2026,
    generatedDate: "2025-10-11T04:41:34.116Z",
    units: {
      "203": {
        // Basic Charges (UNCHANGED)
        currentCharge: 350,
        previousBalance: 0,
        
        // Penalties (SHOULD BE REINSTATED OR RECALCULATED)
        penalties: 49.98,        // ← Question: Keep existing or recalculate?
        penaltyDetails: {
          dayslate: 11,           // ← Question: Recalculate with current date?
          penaltyRate: 2,
          calculatedPenalty: 14.14,
          carryoverPenalty: 35.84
        },
        
        // Totals (UNCHANGED)
        totalAmount: 399.98,
        
        // Payment Information (REVERSED)
        paidAmount: 0,            // ✅ SHOULD BE 0
        basePaid: 0,              // ✅ SHOULD BE 0
        penaltyPaid: 0,           // ✅ SHOULD BE 0
        status: "unpaid",         // ✅ SHOULD BE "unpaid"
        
        // Payment Record (CLEARED)
        lastPayment: null,        // ✅ SHOULD BE null
        
        // Payments array (CLEARED if exists)
        payments: [],             // ✅ SHOULD BE empty or not present
        
        // Consumption Data (UNCHANGED)
        consumption: 5.2,
        previousReading: 1234.5,
        currentReading: 1239.7,
        ratePerM3: 67.31
      }
    }
  },
  metadata: {
    lastUpdated: "2025-10-15T21:00:00.000Z",  // ← Updated timestamp
    updatedBy: "system"
  }
}
```

---

### AFTER Delete (ACTUAL STATE - BASED ON CODE ANALYSIS)

**Status:** ⚠️ UNCERTAIN - Code suggests it should work, but evidence shows it doesn't

**Code Analysis (lines 1270-1276):**
```javascript
firestoreTransaction.update(billRef, {
  [`bills.units.${unitId}.paidAmount`]: newPaidAmount,      // Calculated as 0
  [`bills.units.${unitId}.basePaid`]: newBasePaid,          // Calculated as 0
  [`bills.units.${unitId}.penaltyPaid`]: newPenaltyPaid,    // Calculated as 0
  [`bills.units.${unitId}.status`]: newStatus,              // Calculated as "unpaid"
  [`bills.units.${unitId}.lastPayment`]: null               // Cleared
});
```

**Expected After Code Execution:**
```javascript
{
  bills: {
    units: {
      "203": {
        paidAmount: 0,          // ✓ Code sets to 0
        basePaid: 0,            // ✓ Code sets to 0
        penaltyPaid: 0,         // ✓ Code sets to 0
        status: "unpaid",       // ✓ Code sets to "unpaid"
        lastPayment: null,      // ✓ Code sets to null
        // Other fields unchanged
      }
    }
  }
}
```

**Reported Actual State (User Observations):**
```javascript
{
  bills: {
    units: {
      "203": {
        paidAmount: 399.98,     // ✗ STILL PAID - WHY?
        basePaid: 350,          // ✗ STILL PAID - WHY?
        penaltyPaid: 49.98,     // ✗ STILL PAID - WHY?
        status: "paid",         // ✗ STILL PAID - WHY?
        lastPayment: {...},     // ✗ STILL EXISTS - WHY?
      }
    }
  }
}
```

**Hypothesis for Discrepancy:**
1. **Option A:** Firestore update not persisting (transaction rollback?)
2. **Option B:** Surgical recalc overwriting the changes
3. **Option C:** Frontend displaying cached data
4. **Option D:** Update path syntax issue (nested field updates)
5. **Option E:** Another process updating after delete

**Evidence Needed:**
- Firestore console inspection immediately after delete
- Backend logs showing update execution
- Surgical recalc logs showing what it updates

---

## B. Credit Balance Reversal

### Scenario 1: Payment USED Credit

#### BEFORE Payment (Initial State)
```javascript
// HOA Dues Document: clients/AVII/units/203/dues/2026
{
  creditBalance: 50000,  // $500.00 in centavos
  creditBalanceHistory: [
    {
      id: "uuid-001",
      timestamp: "2025-10-10T10:00:00.000Z",
      transactionId: "prev_txn_001",
      type: "credit_added",
      amount: 50000,
      description: "Overpayment from previous transaction",
      balanceBefore: 0,
      balanceAfter: 50000
    }
  ]
}
```

#### AFTER Payment (Credit Used)
```javascript
// Water Bill Payment: $400 total, $100 from credit + $300 cash
// Transaction ID: "2025-10-15_123456_789"
{
  creditBalance: 40000,  // $400.00 - credit reduced by $100 (10000 centavos)
  creditBalanceHistory: [
    {
      id: "uuid-001",
      timestamp: "2025-10-10T10:00:00.000Z",
      transactionId: "prev_txn_001",
      type: "credit_added",
      amount: 50000,
      description: "Overpayment from previous transaction",
      balanceBefore: 0,
      balanceAfter: 50000
    },
    {
      id: "uuid-002",
      timestamp: "2025-10-15T20:30:00.000Z",
      transactionId: "2025-10-15_123456_789",  // ← This transaction
      type: "credit_used",
      amount: 10000,  // $100 used
      description: "Used for Water Bill payment",
      balanceBefore: 50000,
      balanceAfter: 40000
    }
  ]
}
```

#### AFTER Delete (EXPECTED - Credit Restored)
```javascript
{
  creditBalance: 50000,  // ✅ SHOULD BE $500 (restored)
  creditBalanceHistory: [
    {
      id: "uuid-001",
      timestamp: "2025-10-10T10:00:00.000Z",
      transactionId: "prev_txn_001",
      type: "credit_added",
      amount: 50000,
      description: "Overpayment from previous transaction",
      balanceBefore: 0,
      balanceAfter: 50000
    },
    // ✅ credit_used entry REMOVED
    {
      id: "uuid-003",
      timestamp: "2025-10-15T21:00:00.000Z",
      transactionId: "2025-10-15_123456_789_reversal",  // ← Reversal entry
      type: "credit_restored",
      amount: 10000,
      description: "from Water Bill Transaction Deletion",
      balanceBefore: 40000,
      balanceAfter: 50000
    }
  ]
}
```

#### AFTER Delete (ACTUAL - Credit NOT Restored)
```javascript
{
  creditBalance: 40000,  // ✗ STILL $400 - Credit NOT restored
  creditBalanceHistory: [
    {
      id: "uuid-001",
      timestamp: "2025-10-10T10:00:00.000Z",
      transactionId: "prev_txn_001",
      type: "credit_added",
      amount: 50000,
      description: "Overpayment from previous transaction",
      balanceBefore: 0,
      balanceAfter: 50000
    },
    {
      id: "uuid-002",
      timestamp: "2025-10-15T20:30:00.000Z",
      transactionId: "2025-10-15_123456_789",
      type: "credit_used",
      amount: 10000,
      description: "Used for Water Bill payment",
      balanceBefore: 50000,
      balanceAfter: 40000
    }
    // ✗ NO reversal entry added
    // ✗ credit_used entry NOT removed
  ]
}
```

**Root Cause:** `executeWaterBillsCleanupWrite()` does NOT include credit reversal code.

---

### Scenario 2: Payment CREATED Credit (Overpayment)

#### BEFORE Payment
```javascript
{
  creditBalance: 0,  // No credit
  creditBalanceHistory: []
}
```

#### AFTER Payment (Overpayment Creates Credit)
```javascript
// Water Bill: $400 total, paid $500 → $100 credit created
{
  creditBalance: 10000,  // $100 credit created
  creditBalanceHistory: [
    {
      id: "uuid-001",
      timestamp: "2025-10-15T20:30:00.000Z",
      transactionId: "2025-10-15_123456_789",
      type: "credit_added",
      amount: 10000,
      description: "Overpayment on Water Bill",
      balanceBefore: 0,
      balanceAfter: 10000
    }
  ]
}
```

#### AFTER Delete (EXPECTED - Credit Removed)
```javascript
{
  creditBalance: 0,  // ✅ SHOULD BE $0 (credit removed)
  creditBalanceHistory: [
    // ✅ credit_added entry REMOVED
    {
      id: "uuid-002",
      timestamp: "2025-10-15_21:00:00.000Z",
      transactionId: "2025-10-15_123456_789_reversal",
      type: "credit_removed",
      amount: 10000,
      description: "from Water Bill Transaction Deletion",
      balanceBefore: 10000,
      balanceAfter: 0
    }
  ]
}
```

#### AFTER Delete (ACTUAL - Credit NOT Removed)
```javascript
{
  creditBalance: 10000,  // ✗ STILL $100 - Credit NOT removed
  creditBalanceHistory: [
    {
      id: "uuid-001",
      timestamp: "2025-10-15T20:30:00.000Z",
      transactionId: "2025-10-15_123456_789",
      type: "credit_added",
      amount: 10000,
      description: "Overpayment on Water Bill",
      balanceBefore: 0,
      balanceAfter: 10000
    }
    // ✗ NO reversal entry
    // ✗ credit_added entry NOT removed
  ]
}
```

**Root Cause:** Same - no credit reversal code in Water Bills cleanup.

---

## C. aggregatedData Impact

### aggregatedData Document Structure
**Collection Path:** `clients/{clientId}/projects/waterBills/aggregatedData/{fiscalYear}`

This document contains pre-calculated summary data for fast UI loading.

---

### BEFORE Payment
```javascript
{
  year: 2026,
  lastCalculated: "2025-10-11T04:41:34.116Z",
  lastPenaltyUpdate: "2025-10-11T04:41:34.116Z",
  
  months: [
    // ... July, August, September (months 0-2)
    {
      // October 2025 (month 3)
      month: 3,
      fiscalMonth: "October",
      units: {
        "203": {
          unitId: "203",
          ownerName: "García",
          
          // Consumption (unchanged by payment/delete)
          consumption: 5.2,
          previousReading: 1234.5,
          currentReading: 1239.7,
          
          // Charges (unchanged by payment/delete)
          currentCharge: 350,
          penalties: 49.98,
          totalAmount: 399.98,
          
          // Payment Status - THIS CHANGES
          paidAmount: 0,           // ← BEFORE: unpaid
          unpaidAmount: 399.98,
          status: "unpaid",        // ← BEFORE: unpaid
          
          // Payment Record
          transactionId: null,
          payments: []
        }
      }
    }
  ],
  
  summary: {
    totalConsumption: 52.3,
    totalCharges: 3500,
    totalPenalties: 499.8,
    totalAmount: 3999.8,
    totalPaid: 0,
    totalUnpaid: 3999.8,
    billsPaid: 0,
    billsUnpaid: 10,
    billsPartial: 0
  }
}
```

---

### AFTER Payment (Surgical Update)
```javascript
{
  year: 2026,
  lastCalculated: "2025-10-15T20:30:05.000Z",  // ← Updated
  lastPenaltyUpdate: "2025-10-15T20:30:05.000Z",  // ← Updated (surgical)
  
  months: [
    {
      month: 3,
      fiscalMonth: "October",
      units: {
        "203": {
          // Consumption (unchanged)
          consumption: 5.2,
          previousReading: 1234.5,
          currentReading: 1239.7,
          
          // Charges (unchanged)
          currentCharge: 350,
          penalties: 49.98,
          totalAmount: 399.98,
          
          // Payment Status - UPDATED
          paidAmount: 399.98,      // ← AFTER: paid
          unpaidAmount: 0,         // ← AFTER: 0
          status: "paid",          // ← AFTER: paid
          
          // Payment Record
          transactionId: "2025-10-15_123456_789",
          payments: [
            {
              amount: 399.98,
              transactionId: "2025-10-15_123456_789",
              date: "2025-10-15T20:30:00.000Z",
              method: "eTransfer"
            }
          ]
        }
      }
    }
  ],
  
  summary: {
    totalConsumption: 52.3,
    totalCharges: 3500,
    totalPenalties: 499.8,
    totalAmount: 3999.8,
    totalPaid: 399.98,       // ← Updated
    totalUnpaid: 3600.00,    // ← Updated
    billsPaid: 1,            // ← Updated
    billsUnpaid: 9,          // ← Updated
    billsPartial: 0
  }
}
```

---

### AFTER Delete (EXPECTED - Surgical Update Reverses)
```javascript
{
  year: 2026,
  lastCalculated: "2025-10-15T21:00:05.000Z",  // ✅ SHOULD update
  lastPenaltyUpdate: "2025-10-15T21:00:05.000Z",  // ✅ SHOULD update (surgical)
  
  months: [
    {
      month: 3,
      fiscalMonth: "October",
      units: {
        "203": {
          // Consumption (unchanged)
          consumption: 5.2,
          previousReading: 1234.5,
          currentReading: 1239.7,
          
          // Charges (unchanged)
          currentCharge: 350,
          penalties: 49.98,
          totalAmount: 399.98,
          
          // Payment Status - SHOULD REVERT
          paidAmount: 0,           // ✅ SHOULD BE 0
          unpaidAmount: 399.98,    // ✅ SHOULD BE total
          status: "unpaid",        // ✅ SHOULD BE unpaid
          
          // Payment Record
          transactionId: null,     // ✅ SHOULD BE null
          payments: []             // ✅ SHOULD BE empty
        }
      }
    }
  ],
  
  summary: {
    totalConsumption: 52.3,
    totalCharges: 3500,
    totalPenalties: 499.8,
    totalAmount: 3999.8,
    totalPaid: 0,            // ✅ SHOULD revert
    totalUnpaid: 3999.8,     // ✅ SHOULD revert
    billsPaid: 0,            // ✅ SHOULD revert
    billsUnpaid: 10,         // ✅ SHOULD revert
    billsPartial: 0
  }
}
```

---

### AFTER Delete (ACTUAL - NO UPDATE)
```javascript
{
  year: 2026,
  lastCalculated: "2025-10-15T20:30:05.000Z",  // ✗ NOT updated
  lastPenaltyUpdate: "2025-10-15T20:30:05.000Z",  // ✗ NOT updated (CRITICAL EVIDENCE)
  
  months: [
    {
      month: 3,
      fiscalMonth: "October",
      units: {
        "203": {
          // Consumption (unchanged)
          consumption: 5.2,
          previousReading: 1234.5,
          currentReading: 1239.7,
          
          // Charges (unchanged)
          currentCharge: 350,
          penalties: 49.98,
          totalAmount: 399.98,
          
          // Payment Status - STILL SHOWS PAID
          paidAmount: 399.98,      // ✗ STILL paid
          unpaidAmount: 0,         // ✗ STILL 0
          status: "paid",          // ✗ STILL paid
          
          // Payment Record
          transactionId: "2025-10-15_123456_789",  // ✗ STILL present
          payments: [...]          // ✗ STILL present
        }
      }
    }
  ],
  
  summary: {
    totalPaid: 399.98,       // ✗ NOT reverted
    totalUnpaid: 3600.00,    // ✗ NOT reverted
    billsPaid: 1,            // ✗ NOT reverted
    billsUnpaid: 9           // ✗ NOT reverted
  }
}
```

**Critical Evidence:** `lastPenaltyUpdate` timestamp NOT changing proves surgical update NOT executing or NOT working.

---

## D. Surgical Update vs Full Recalc

### Question: Why doesn't full refresh fix bill status?

#### Full Recalc Process (calculateYearSummary)
**File:** `backend/services/waterDataService.js`  
**Function:** `calculateYearSummary(clientId, year)`

**Process:**
1. Fetches ALL bill documents for the year
2. Fetches ALL reading documents for the year
3. Recalculates consumption, charges, penalties
4. Builds unit data from scratch
5. Writes to aggregatedData document
6. **Key:** Reads bill documents as source of truth

**Question:** If bill documents are updated to "unpaid" by delete, why doesn't full recalc reflect that?

**Hypothesis 1:** Bill documents NOT actually updated (Firestore transaction failed?)
**Hypothesis 2:** Full recalc reading cached bill data
**Hypothesis 3:** Full recalc logic has a bug reading bill payment status

---

#### Surgical Update Process (updateAggregatedDataAfterPayment)
**File:** `backend/services/waterDataService.js`  
**Function:** `updateAggregatedDataAfterPayment(clientId, year, affectedUnitsAndMonths)`

**Process (Optimized Oct 14):**
1. Reads existing aggregatedData
2. For each affected unit/month:
   - Reads unit data from aggregatedData (existing)
   - Fetches ONLY the updated bill document
   - Updates payment fields (paidAmount, status, etc.)
   - Replaces unit data in aggregatedData
3. Recalculates year summary
4. Writes aggregatedData back

**Design Question:** Is this function designed for payment REVERSALS?
- **For Payments:** Bill goes from unpaid → paid, amounts increase
- **For Reversals:** Bill goes from paid → unpaid, amounts decrease to 0

**Code Review Needed:**
- Does it handle paidAmount going to 0?
- Does it handle status changing to "unpaid"?
- Does it validate changes or blindly copy from bill?

**Evidence:** Function is CALLED after delete (lines 920-925), but `lastPenaltyUpdate` NOT updating suggests it's failing or not executing.

---

## E. Data Consistency Issues

### Issue 1: Three Sources of Truth Conflict

**During Delete Operation:**
1. **Bill Document** (in bills collection)
2. **aggregatedData Document** (pre-calculated cache)
3. **Transaction Document** (being deleted)

**Current Problem:**
- Delete updates Bill Document (maybe?)
- Delete does NOT update aggregatedData (surgical update not working?)
- Transaction Document deleted successfully
- **Result:** Bill and aggregatedData out of sync

---

### Issue 2: Credit Balance Orphaned

**Credit Balance Lives In:** HOA Dues document  
**Water Bill Payment Affects:** Credit balance via credit history  
**Water Bill Delete Should:** Reverse credit via credit history  
**Current Reality:** Water Bill delete does NOTHING with credit

**Result:**
- Credit used stays consumed
- Credit added stays present
- Credit history shows transaction ID that no longer exists
- Credit balance incorrect

---

### Issue 3: Payment History Inconsistency

**Bill Document Shows:** Payment still present (or cleared to null?)  
**aggregatedData Shows:** Payment still recorded  
**Transaction Document:** DELETED (no longer exists)  
**Credit History:** Shows transaction ID  
**Frontend Display:** Shows bill as "paid"

**Problem:** Transaction reference exists in multiple places, but transaction itself deleted.

---

## F. Testing Scenarios

### Test 1: Simple Payment (No Credit, Single Bill)
**Setup:**
- Unit 203, October 2025
- Bill: $400 total
- Payment: $400 cash, no credit used
- Transaction ID: "test_001"

**Expected After Delete:**
- Bill: paidAmount = 0, status = "unpaid", lastPayment = null
- aggregatedData: paidAmount = 0, status = "unpaid"
- Credit: No change (no credit involved)
- Year summary: totalPaid decreases by $400

**Test:** Does simple case work? Or is even this broken?

---

### Test 2: Payment Using Credit
**Setup:**
- Unit 203, October 2025
- Bill: $400 total
- Initial credit: $500
- Payment: $100 credit + $300 cash
- Transaction ID: "test_002"

**Expected After Delete:**
- Bill: paidAmount = 0, status = "unpaid", lastPayment = null
- aggregatedData: paidAmount = 0, status = "unpaid"
- Credit: Restored from $400 to $500
- Credit history: Entry added for restoration

**Test:** Does credit reversal work at all?

---

### Test 3: Overpayment Creating Credit
**Setup:**
- Unit 203, October 2025
- Bill: $400 total
- Payment: $500 cash
- Overpayment: $100 → credit created
- Transaction ID: "test_003"

**Expected After Delete:**
- Bill: paidAmount = 0, status = "unpaid", lastPayment = null
- aggregatedData: paidAmount = 0, status = "unpaid"
- Credit: Removed from $100 to $0
- Credit history: Entry added for removal

**Test:** Does credit removal work?

---

### Test 4: Multi-Month Payment
**Setup:**
- Unit 203, July-October 2025 (4 bills)
- Total: $1600
- Payment: $1600 cash
- Transaction ID: "test_004"

**Expected After Delete:**
- All 4 bills: paidAmount = 0, status = "unpaid", lastPayment = null
- aggregatedData: All 4 months show unpaid
- Year summary: totalPaid decreases by $1600

**Test:** Does multi-month reversal work? Or only first month?

---

## G. Root Cause Hypotheses

### Hypothesis 1: Firestore Transaction Rollback
**Theory:** Update code executes but Firestore transaction rolls back  
**Evidence Needed:** Backend logs showing transaction commit/rollback  
**Likelihood:** Low - transaction document successfully deleted

---

### Hypothesis 2: Surgical Update Overwrites
**Theory:** Bill updated correctly, but surgical update overwrites with old data  
**Evidence Needed:** Firestore document timestamps, surgical update logs  
**Likelihood:** Medium - surgical update called after bill update

---

### Hypothesis 3: Bill Update Not Persisting
**Theory:** Firestore update syntax issue with nested fields  
**Evidence Needed:** Firestore logs, document inspection immediately after delete  
**Likelihood:** Medium - nested field updates can be tricky

---

### Hypothesis 4: Frontend Cache Display
**Theory:** Bill actually updated, but frontend displays cached data  
**Evidence Needed:** Firestore console vs frontend display comparison  
**Likelihood:** Low - user reports "even after refresh"

---

### Hypothesis 5: Surgical Update Not Designed for Reversals
**Theory:** Surgical update function doesn't handle paid → unpaid correctly  
**Evidence Needed:** Code review of `updateAggregatedDataAfterPayment()`  
**Likelihood:** High - function optimized for payments, not reversals

---

## H. Data Structure Fix Checklist

### Bill Document Updates
- [x] Code exists to update paidAmount → 0
- [x] Code exists to update basePaid → 0
- [x] Code exists to update penaltyPaid → 0
- [x] Code exists to update status → "unpaid"
- [x] Code exists to clear lastPayment
- [ ] Verify update persists to Firestore
- [ ] Verify surgical update doesn't overwrite

### Credit Balance Updates
- [ ] Code to read HOA Dues document
- [ ] Code to read credit history
- [ ] Code to calculate credit reversal
- [ ] Code to update credit balance
- [ ] Code to update credit history

### aggregatedData Updates
- [ ] Verify surgical update handles reversals
- [ ] Verify lastPenaltyUpdate timestamp updates
- [ ] Verify year summary recalculates correctly
- [ ] Verify full recalc reads bill changes

---

**Data Structure Map Status:** Complete - Ready for testing validation


