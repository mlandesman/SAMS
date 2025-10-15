# Phase 2: Payment Allocation Logic Map

**Investigation Date:** October 15, 2025  
**Agent:** Agent_Water_Investigation_Phase_2  
**Purpose:** Document the payment cascade algorithm in detail

---

## Overview

The water bills payment cascade follows a strict priority system:
1. **Oldest bills first** (sorted by fiscal year-month)
2. **Base charges before penalties** (within each bill)
3. **Full payment before partial** (pay each bill completely if possible)
4. **Overpayment to credit** (excess funds added to HOA Dues credit balance)

---

## Pseudo-Code: Expected Payment Cascade

```javascript
/**
 * Payment Cascade Algorithm
 * File: backend/services/waterPaymentsService.js
 * Lines: 296-368
 */

function cascadePayment(totalAvailableFunds, unpaidBills) {
  let remainingFunds = totalAvailableFunds;  // Payment + Credit Balance
  const billPayments = [];
  
  // Bills already sorted by date (oldest first) from _getUnpaidBillsForUnit()
  // Sort order: Document names like "2026-00", "2026-01", "2026-02"
  
  for (const bill of unpaidBills) {
    if (remainingFunds <= 0) {
      break;  // No more funds to allocate
    }
    
    // Calculate what's unpaid for this bill
    const totalDue = bill.totalAmount - bill.paidAmount;
    const baseDue = bill.currentCharge - bill.basePaid;
    const penaltyDue = bill.penaltyAmount - bill.penaltyPaid;
    
    // SCENARIO 1: Enough funds to pay bill in full
    if (remainingFunds >= totalDue) {
      billPayments.push({
        billId: bill.id,
        amountPaid: totalDue,
        baseChargePaid: baseDue,      // Pay all base
        penaltyPaid: penaltyDue,       // Pay all penalties
        newStatus: 'paid'               // Mark as paid
      });
      
      remainingFunds -= totalDue;
      continue;  // Move to next bill
    }
    
    // SCENARIO 2: Partial payment (not enough for full bill)
    if (remainingFunds > 0) {
      let toApply = remainingFunds;
      let basePaid = 0;
      let penaltyPaid = 0;
      
      // PRIORITY 1: Apply to base charge first
      if (baseDue > 0) {
        basePaid = Math.min(toApply, baseDue);
        toApply -= basePaid;
      }
      
      // PRIORITY 2: Apply remainder to penalties (if any funds left)
      if (toApply > 0 && penaltyDue > 0) {
        penaltyPaid = Math.min(toApply, penaltyDue);
        toApply -= penaltyPaid;
      }
      
      billPayments.push({
        billId: bill.id,
        amountPaid: remainingFunds,  // All remaining funds
        baseChargePaid: basePaid,
        penaltyPaid: penaltyPaid,
        newStatus: 'partial'          // Mark as partial
      });
      
      remainingFunds = 0;  // All funds exhausted
      break;  // Cannot pay any more bills
    }
  }
  
  // SCENARIO 3: Handle overpayment (funds left after all bills paid)
  if (remainingFunds > 0) {
    // Overpayment goes to credit balance
    const overpayment = remainingFunds;
    // This is added to HOA Dues credit balance
  }
  
  return {
    billPayments: billPayments,
    overpayment: remainingFunds
  };
}
```

---

## Actual Implementation in Code

### File: `backend/services/waterPaymentsService.js`

### Lines 296-301: Setup

```javascript
// STEP 4: Apply funds to bills (priority: oldest first, base charges before penalties)
let remainingFunds = totalAvailableFunds;
const billPayments = [];
let totalBaseChargesPaid = 0;
let totalPenaltiesPaid = 0;
```

**Key Variables:**
- `totalAvailableFunds` = Payment Amount + Current Credit Balance
- `remainingFunds` = Working variable that decreases as bills are paid
- `billPayments` = Array of payment allocations to be applied

---

### Lines 302-335: Full Payment Scenario

```javascript
for (const bill of unpaidBills) {
  if (remainingFunds <= 0) break;
  
  const unpaidAmount = bill.totalAmount - (bill.paidAmount || 0);
  const baseUnpaid = bill.currentCharge - (bill.basePaid || 0);
  const penaltyUnpaid = bill.penaltyAmount - (bill.penaltyPaid || 0);
  
  console.log(`📄 Bill ${bill.period}: Total due $${unpaidAmount} (Base: $${baseUnpaid}, Penalties: $${penaltyUnpaid})`);
  
  if (remainingFunds >= unpaidAmount) {
    // Pay bill in full
    billPayments.push({
      unitId: unitId,
      billId: bill.id,
      billPeriod: bill.period,
      amountPaid: this._roundCurrency(unpaidAmount),
      baseChargePaid: this._roundCurrency(baseUnpaid),
      penaltyPaid: this._roundCurrency(penaltyUnpaid),
      newStatus: 'paid'
    });
    
    console.log(`💳 Bill payment created:`, {
      billId: bill.id,
      baseChargePaid: this._roundCurrency(baseUnpaid),
      penaltyPaid: this._roundCurrency(penaltyUnpaid),
      amountPaid: this._roundCurrency(unpaidAmount)
    });
    
    totalBaseChargesPaid = this._roundCurrency(totalBaseChargesPaid + baseUnpaid);
    totalPenaltiesPaid = this._roundCurrency(totalPenaltiesPaid + penaltyUnpaid);
    remainingFunds = this._roundCurrency(remainingFunds - unpaidAmount);
    
    console.log(`✅ Bill ${bill.period} paid in full: $${unpaidAmount}`);
  }
```

**Logic:**
1. Check if `remainingFunds >= unpaidAmount`
2. If yes, create payment object with full amounts
3. Update running totals for base and penalties
4. Subtract from remaining funds
5. Continue to next bill

**Currency Rounding:**
- Uses `_roundCurrency()` to prevent floating-point errors
- Rounds to 2 decimal places: `Math.round(amount * 100) / 100`

---

### Lines 336-367: Partial Payment Scenario

```javascript
  } else if (remainingFunds > 0) {
    // Partial payment - prioritize base charges over penalties
    let amountToApply = remainingFunds;
    let basePortionPaid = 0;
    let penaltyPortionPaid = 0;
    
    if (baseUnpaid > 0) {
      basePortionPaid = Math.min(amountToApply, baseUnpaid);
      amountToApply -= basePortionPaid;
    }
    
    if (amountToApply > 0 && penaltyUnpaid > 0) {
      penaltyPortionPaid = Math.min(amountToApply, penaltyUnpaid);
    }
    
    billPayments.push({
      unitId: unitId,
      billId: bill.id,
      billPeriod: bill.period,
      amountPaid: this._roundCurrency(remainingFunds),
      baseChargePaid: this._roundCurrency(basePortionPaid),
      penaltyPaid: this._roundCurrency(penaltyPortionPaid),
      newStatus: 'partial'
    });
    
    totalBaseChargesPaid = this._roundCurrency(totalBaseChargesPaid + basePortionPaid);
    totalPenaltiesPaid = this._roundCurrency(totalPenaltiesPaid + penaltyPortionPaid);
    
    console.log(`🔸 Bill ${bill.period} partial payment: $${remainingFunds} (Base: $${basePortionPaid}, Penalties: $${penaltyPortionPaid})`);
    
    remainingFunds = 0;
  }
}
```

**Logic:**
1. Not enough to pay full bill, but some funds available
2. Calculate base portion: `Math.min(remainingFunds, baseDue)`
3. Subtract base from funds
4. Calculate penalty portion: `Math.min(remaining, penaltyDue)`
5. Create payment with 'partial' status
6. Set remaining funds to 0 (exhausted)
7. Break loop (no more bills can be paid)

**Priority Enforcement:**
- Base charges ALWAYS paid before penalties
- Even in partial payment, base gets priority
- Penalties only receive funds AFTER base is fully paid

---

### Lines 370-385: Credit Calculation

```javascript
// STEP 5: Calculate credit usage vs overpayment (IDENTICAL TO HOA LOGIC)
const newCreditBalance = this._roundCurrency(remainingFunds);
const totalUsedForBills = this._roundCurrency(totalAvailableFunds - remainingFunds);

let creditUsed = 0;
let overpayment = 0;

if (newCreditBalance >= currentCreditBalance) {
  // Overpayment scenario: Payment had extra beyond bills
  overpayment = this._roundCurrency(newCreditBalance - currentCreditBalance);
} else {
  // Credit was used to help pay bills
  creditUsed = this._roundCurrency(currentCreditBalance - newCreditBalance);
}

console.log(`💰 Credit calculation: Used $${creditUsed}, Overpaid $${overpayment}, New balance $${newCreditBalance}`);
```

**Logic:**
- `remainingFunds` becomes the new credit balance
- Compare new balance to old balance:
  - **If new ≥ old:** Overpayment occurred (added to credit)
  - **If new < old:** Credit was consumed (deducted from credit)

**Example Scenarios:**

**Scenario A: Overpayment**
- Current Credit: $100
- Payment: $500
- Bills Due: $300
- Remaining: $300
- New Credit: $300 (≥ $100)
- Overpayment: $300 - $100 = $200

**Scenario B: Credit Used**
- Current Credit: $200
- Payment: $300
- Bills Due: $450
- Total Funds: $500
- After Bills: $50
- New Credit: $50 (< $200)
- Credit Used: $200 - $50 = $150

**Scenario C: Credit Exhausted**
- Current Credit: $100
- Payment: $200
- Bills Due: $400
- Total Funds: $300
- After Bills: $0
- New Credit: $0 (< $100)
- Credit Used: $100

---

## Payment Cascade Examples

### Example 1: Simple Full Payment

**Starting State:**
- Current Credit Balance: $0
- Payment Amount: $400
- Unpaid Bills:
  - July 2025: $350 base + $49.98 penalties = $399.98

**Execution:**
```
Total Available: $400
Remaining: $400

Bill 1 (July):
  - Total Due: $399.98
  - Can pay in full? YES ($400 ≥ $399.98)
  - Base Paid: $350
  - Penalty Paid: $49.98
  - Status: 'paid'
  - Remaining: $400 - $399.98 = $0.02

End of bills.
Overpayment: $0.02
New Credit Balance: $0.02
```

**Result:**
- July bill: PAID
- Credit balance: $0.02 (overpayment)

---

### Example 2: Multi-Bill Cascade

**Starting State:**
- Current Credit Balance: $50
- Payment Amount: $900
- Unpaid Bills:
  - July 2025: $350 base + $49.98 penalties = $399.98
  - August 2025: $350 base + $49.98 penalties = $399.98
  - September 2025: $350 base + $0 penalties = $350.00

**Execution:**
```
Total Available: $900 + $50 = $950
Remaining: $950

Bill 1 (July):
  - Total Due: $399.98
  - Can pay in full? YES ($950 ≥ $399.98)
  - Base Paid: $350, Penalty Paid: $49.98
  - Status: 'paid'
  - Remaining: $950 - $399.98 = $550.02

Bill 2 (August):
  - Total Due: $399.98
  - Can pay in full? YES ($550.02 ≥ $399.98)
  - Base Paid: $350, Penalty Paid: $49.98
  - Status: 'paid'
  - Remaining: $550.02 - $399.98 = $150.04

Bill 3 (September):
  - Total Due: $350.00
  - Can pay in full? NO ($150.04 < $350.00)
  - Partial payment: $150.04
  - Base Due: $350, Penalty Due: $0
  - Base Paid: $150.04 (less than full)
  - Penalty Paid: $0
  - Status: 'partial'
  - Remaining: $0

End of bills.
Credit Used: $50 (had $50, now $0)
New Credit Balance: $0
```

**Result:**
- July bill: PAID
- August bill: PAID
- September bill: PARTIAL ($150.04 of $350 paid)
- Credit balance: $0 (used $50)

---

### Example 3: Partial with Penalty Priority

**Starting State:**
- Current Credit Balance: $0
- Payment Amount: $200
- Unpaid Bills:
  - July 2025: $350 base + $50 penalties = $400

**Execution:**
```
Total Available: $200
Remaining: $200

Bill 1 (July):
  - Total Due: $400
  - Can pay in full? NO ($200 < $400)
  - Partial payment: $200
  - Base Due: $350, Penalty Due: $50
  - Step 1: Apply to base first
    - Base Paid: min($200, $350) = $200
    - Remaining: $200 - $200 = $0
  - Step 2: Apply to penalties (if funds remain)
    - Penalty Paid: $0 (no funds left)
  - Status: 'partial'
  - Remaining: $0

End of bills.
New Credit Balance: $0
```

**Result:**
- July bill: PARTIAL ($200 toward base, $0 toward penalties)
- Remaining due: $150 base + $50 penalties = $200
- Credit balance: $0

**Key Observation:** Base charges receive priority even in partial payment.

---

### Example 4: Using Credit to Pay Bills

**Starting State:**
- Current Credit Balance: $300
- Payment Amount: $200
- Unpaid Bills:
  - July 2025: $350 base + $49.98 penalties = $399.98
  - August 2025: $350 base + $49.98 penalties = $399.98

**Execution:**
```
Total Available: $200 + $300 = $500
Remaining: $500

Bill 1 (July):
  - Total Due: $399.98
  - Can pay in full? YES ($500 ≥ $399.98)
  - Base Paid: $350, Penalty Paid: $49.98
  - Status: 'paid'
  - Remaining: $500 - $399.98 = $100.02

Bill 2 (August):
  - Total Due: $399.98
  - Can pay in full? NO ($100.02 < $399.98)
  - Partial payment: $100.02
  - Base Due: $350, Penalty Due: $49.98
  - Base Paid: $100.02
  - Penalty Paid: $0
  - Status: 'partial'
  - Remaining: $0

End of bills.
Credit Used: $300 (had $300, now $0)
New Credit Balance: $0
```

**Result:**
- July bill: PAID (using $200 payment + $199.98 credit)
- August bill: PARTIAL ($100.02 toward base)
- Credit balance: $0 (used all $300)

---

## Where is the Algorithm?

### Primary Location
**File:** `backend/services/waterPaymentsService.js`  
**Method:** `recordPayment()`  
**Lines:** 296-368

### Called By
**Route:** `POST /water/clients/:clientId/payments/record`  
**Controller:** `waterPaymentsController.recordPayment()`  
**File:** `backend/controllers/waterPaymentsController.js`

### Dependencies
**Get Unpaid Bills:**
- Method: `_getUnpaidBillsForUnit()` (lines 555-650)
- Returns: Array of bills sorted by date (oldest first)

**Get Credit Balance:**
- Method: `_getCreditBalance()` (lines 496-520)
- Calls: `hoaDuesController.getUnitDuesData()`

**Update Credit Balance:**
- Method: `_updateCreditBalance()` (lines 525-549)
- Calls: `hoaDuesController.updateCreditBalance()`

---

## Comparison: Expected vs Actual

### Expected Algorithm (from task assignment)
```
1. Oldest bill base charge
2. Oldest bill penalties
3. Next bill base charge
4. Next bill penalties
5. Continue until payment exhausted
6. Overpayment → Credit balance
7. Underpayment → Partial payment marked
```

### Actual Implementation
✅ **Matches expected** with the following observations:

1. ✅ Bills sorted oldest first (by document name)
2. ✅ Base charges paid before penalties within each bill
3. ✅ Full bills paid before partial
4. ✅ Partial payments prioritize base over penalties
5. ✅ Overpayment goes to credit balance
6. ✅ Underpayment creates partial status

### Differences from HOA Dues Pattern
The water bills payment cascade is **identical** to HOA dues cascade logic:
- Same credit balance integration
- Same overpayment/usage calculation
- Same payment + credit = total funds logic
- Same partial payment handling

**Key Difference:** HOA dues pays quarterly charges; water bills pays monthly usage.

---

## Potential Gaps in Algorithm

### Gap 1: Currency Rounding
**Observation:** Uses `_roundCurrency()` throughout (rounds to 2 decimal places)

**Potential Issue:**
- Multiple rounding operations could accumulate small errors
- Example: $100 / 3 = $33.33 + $33.33 + $33.34 = $100.00 ✓
- Example: $100 / 3 = $33.33 + $33.33 + $33.33 = $99.99 ✗

**Mitigation:** Code uses rounding consistently at each step

---

### Gap 2: Concurrency
**Observation:** No locking mechanism for concurrent payments

**Potential Issue:**
- Two simultaneous payments for same unit could cause race condition
- Both read same unpaid bills, both try to pay same bill
- Could result in duplicate payments or incorrect credit calculation

**Current State:** Relies on Firestore transaction consistency (not explicit)

---

### Gap 3: Partial Payment Display
**Observation:** Partial status set correctly in bill document

**Potential Issue:**
- Frontend might not clearly distinguish between:
  - Partial base paid, no penalties paid
  - Full base paid, partial penalties paid
  - Both partially paid

**Current Display:** Status shows "PARTIAL" but might not show which portion is partial

---

### Gap 4: Credit Balance Timing
**Observation:** Credit updated BEFORE transaction created

**Flow:**
```
1. Calculate payment allocation
2. Update credit balance in HOA Dues  ← HERE
3. Create allocations
4. Create transaction
5. Update bill documents
6. Surgical update
```

**Potential Issue:**
- If transaction creation fails after credit update
- Credit balance updated but payment not recorded
- Inconsistent state

**Current Mitigation:** None visible in code (no rollback logic)

---

## Recommendations for Gap Analysis

1. **Test multi-bill payment** to verify oldest-first logic
2. **Test partial payment** to verify base-before-penalty priority
3. **Test credit usage** to verify deduction timing and display
4. **Test overpayment** to verify credit addition
5. **Test concurrent payments** (if possible) to check for race conditions

---

**Status:** Algorithm fully documented from code. Matches expected behavior. Live testing would confirm execution and identify any runtime gaps.


