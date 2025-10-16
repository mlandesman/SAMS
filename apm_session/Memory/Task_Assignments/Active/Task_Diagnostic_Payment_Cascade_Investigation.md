# Task Assignment: Payment Cascade Diagnostic Investigation

**Task ID:** WB-Diagnostic-Payment-Cascade  
**Agent:** Implementation_Agent_Diagnostic  
**Priority:** 🚨 CRITICAL  
**Estimated Duration:** 2-3 hours  
**Created:** October 16, 2025  
**Branch:** `feature/water-bills-issues-0-7-complete-fix`

---

## 🎯 Mission

Create a comprehensive backend diagnostic system to trace the exact payment cascade calculation and identify where payment allocation is failing. A payment of $1,080.50 for 3 bills should fully pay all bills, but instead October bill is short $69.50.

**Critical Finding:** Transaction export shows `integrityCheck.isValid: false` - allocations total MORE than payment amount.

---

## 🚨 Problem Statement

### The Math Error

**Payment Input:**
- Amount: $1,080.50
- Credit Available: $1,000.00
- Total Funds: $2,080.50

**Bills to Pay (Unit 102):**
1. August 2025: $220.50
2. September 2025: $210.00
3. October 2025: $650.00
4. **Total Due:** $1,080.50

**Expected Result:**
- All 3 bills marked as "paid"
- Each bill: paidAmount = totalAmount
- Status: "paid" for all

**Actual Result (from aggregatedData):**
- August: ✅ paid ($220.50 / $220.50)
- September: ✅ paid ($210.00 / $210.00)
- October: ❌ unpaid ($580.50 / $650.00) - **SHORT $69.50**

### The Mystery

Where did the $69.50 go? The payment cascade algorithm should allocate $1,080.50 across exactly $1,080.50 in bills. But October is receiving $69.50 less than it should.

---

## 📋 Your Freedom and Tools

### Development Environment Access

**You have FULL permission to:**
1. ✅ Create new test units in Dev environment
2. ✅ Modify any existing unit data
3. ✅ Delete any test data
4. ✅ Set HOA Dues amounts for test units
5. ✅ Assign credit balances to test units
6. ✅ Create water bills with known amounts
7. ✅ Make test payments and delete them
8. ✅ Reload Dev environment (takes ~5 minutes)

### Recommended Approach

**Option A: Create Clean Test Unit**
- Create a new unit ID (e.g., "TEST-999" or use existing unitId)
- Set up controlled scenario from scratch:
  - Known HOA credit balance (e.g., $500.00)
  - Known water bills (e.g., 3 bills: $100, $200, $300)
  - Known due dates and penalty amounts
- Make test payment with exact known values
- Trace every calculation step
- **Benefit:** Clean slate, no legacy data interference

**Option B: Use Existing Unit**
- Pick any existing unit (e.g., Unit 102 from problem report)
- Document current state
- Make test payment
- Trace calculations
- **Benefit:** Real production-like data patterns

**Your Choice:** Select the approach that gives you the most confidence in diagnosing the issue.

---

## 🔍 Investigation Requirements

### Phase 1: Create Diagnostic Test Framework

**Goal:** Build a backend test that captures EVERY step of payment cascade calculation.

**Create:** `backend/testing/diagnosticPaymentCascade.js`

**Required Logging (trace every step):**

```javascript
// 1. INITIAL STATE
console.log('=== PAYMENT DIAGNOSTIC START ===');
console.log('Client:', clientId);
console.log('Unit:', unitId);
console.log('Payment Amount:', amount);
console.log('Credit Balance Before:', creditBalanceBefore);
console.log('Total Funds Available:', totalAvailable);

// 2. UNPAID BILLS QUERY
console.log('=== FETCHING UNPAID BILLS ===');
console.log('Bills Found:', bills.length);
bills.forEach(bill => {
  console.log(`Bill ${bill.id}:`, {
    totalAmount: bill.totalAmount,
    paidAmount: bill.paidAmount,
    unpaidAmount: bill.unpaidAmount,
    currentCharge: bill.currentCharge,
    penaltyAmount: bill.penaltyAmount,
    basePaid: bill.basePaid,
    penaltyPaid: bill.penaltyPaid,
    status: bill.status
  });
});

// 3. PAYMENT ALLOCATION (CRITICAL - LOG EVERY ITERATION)
console.log('=== PAYMENT CASCADE ALLOCATION ===');
let remainingFunds = totalAvailable;
bills.forEach((bill, index) => {
  console.log(`\n--- Processing Bill ${index + 1}: ${bill.id} ---`);
  console.log('Remaining Funds BEFORE:', remainingFunds);
  console.log('Bill Unpaid Amount:', bill.unpaidAmount);
  console.log('Base Unpaid:', bill.currentCharge - bill.basePaid);
  console.log('Penalty Unpaid:', bill.penaltyAmount - bill.penaltyPaid);
  
  // Log the allocation decision
  if (remainingFunds >= bill.unpaidAmount) {
    console.log('Decision: FULL PAYMENT');
    console.log('Amount Applied:', bill.unpaidAmount);
  } else if (remainingFunds > 0) {
    console.log('Decision: PARTIAL PAYMENT');
    console.log('Funds to Apply:', remainingFunds);
    // Log base vs penalty split
  } else {
    console.log('Decision: NO PAYMENT (funds exhausted)');
  }
  
  console.log('Remaining Funds AFTER:', remainingFundsAfter);
});

// 4. FINAL ALLOCATION ARRAY
console.log('=== FINAL ALLOCATIONS ===');
allocations.forEach(alloc => {
  console.log(`Allocation ${alloc.id}:`, {
    type: alloc.type,
    targetId: alloc.targetId,
    amount: alloc.amount,
    categoryName: alloc.categoryName
  });
});
console.log('Total Allocated:', totalAllocated);
console.log('Payment Amount:', paymentAmount);
console.log('Difference:', totalAllocated - paymentAmount);

// 5. BILL UPDATES
console.log('=== BILL DOCUMENT UPDATES ===');
billPayments.forEach(bp => {
  console.log(`Bill ${bp.billId} update:`, {
    amountPaid: bp.amountPaid,
    baseChargePaid: bp.baseChargePaid,
    penaltyPaid: bp.penaltyPaid,
    newStatus: bp.newStatus
  });
});

// 6. AFTER FIRESTORE WRITE - READ BACK
console.log('=== VERIFICATION: READ BACK BILL DOCUMENTS ===');
// Re-fetch each bill and log actual stored values
verificationBills.forEach(bill => {
  console.log(`Bill ${bill.id} ACTUAL in Firestore:`, {
    paidAmount: bill.paidAmount,
    basePaid: bill.basePaid,
    penaltyPaid: bill.penaltyPaid,
    status: bill.status,
    totalAmount: bill.totalAmount
  });
});

// 7. SURGICAL UPDATE TRACE
console.log('=== SURGICAL UPDATE ===');
console.log('Affected Units/Months:', affectedUnitsAndMonths);
// Log what surgical update reads and writes

// 8. FINAL STATE
console.log('=== FINAL STATE VERIFICATION ===');
console.log('Credit Balance After:', creditBalanceAfter);
console.log('Credit Used:', creditUsed);
// Read aggregatedData and log actual values displayed to user

console.log('=== PAYMENT DIAGNOSTIC COMPLETE ===');
```

### Phase 2: Create Controlled Test Scenario

**If Creating New Unit:**

1. **Set Up Test Unit** (use Firestore Admin SDK or manual)
   - Unit ID: Document your choice
   - HOA Credit Balance: $500.00
   - Water Bills: Create 3 bills with known amounts
     - Bill 1 (2026-01): $200.00 base + $5.00 penalty = $205.00 total
     - Bill 2 (2026-02): $300.00 base + $10.00 penalty = $310.00 total
     - Bill 3 (2026-03): $150.00 base + $0.00 penalty = $150.00 total
   - **Total Due:** $665.00

2. **Test Payment Scenario**
   - Make payment of $400.00 (using $265.00 credit = $665.00 total)
   - **Expected:** All 3 bills fully paid
   - **Trace:** Every calculation step

3. **Alternative Scenario** (Exact Problem Reproduction)
   - Set up bills matching the actual problem:
     - Bill 1: $220.50
     - Bill 2: $210.00
     - Bill 3: $650.00
   - Credit: $1,000.00
   - Payment: $1,080.50
   - **Expected:** All paid
   - **Trace:** Find where $69.50 goes missing

**If Using Existing Unit:**

1. **Document Current State**
   - Screenshot or export all current bill data
   - Note credit balance before test
   - Save aggregatedData document

2. **Make Test Payment**
   - Use controlled amounts
   - Capture full diagnostic log

3. **Restore State After Test** (if needed)
   - Delete test transaction
   - Restore original data

### Phase 3: Identify Root Cause

**Compare these calculations:**

1. **Payment Cascade Math** (lines 302-368 in waterPaymentsService.js)
   - Is `remainingFunds` calculated correctly?
   - Is credit balance deducted properly?
   - Is the loop logic correct?
   - Are amounts in correct units (dollars vs cents)?

2. **Allocation Creation** (lines 25-136 in waterPaymentsService.js)
   - Do allocations sum to total payment?
   - Is credit allocation correct (positive or negative)?
   - Are bill allocations matching cascade decisions?

3. **Bill Update Logic** (lines 655-720 in waterPaymentsService.js)
   - Are paidAmount updates correct?
   - Is basePaid + penaltyPaid = total paid?
   - Are updates actually persisted to Firestore?

4. **Surgical Update** (waterDataService.js)
   - Does surgical update read updated bills correctly?
   - Does it recalculate amounts correctly?
   - Is aggregatedData written with correct values?

**Key Questions to Answer:**

1. ❓ Where exactly does the $69.50 discrepancy occur?
2. ❓ Is it in cascade calculation, allocation creation, or bill update?
3. ❓ Is credit balance being double-counted or incorrectly subtracted?
4. ❓ Are there unit conversion issues (dollars vs cents)?
5. ❓ Does the integrity check failure point to the root cause?

---

## 📤 Deliverables

### 1. Diagnostic Test Suite

**File:** `backend/testing/diagnosticPaymentCascade.js`

**Must Include:**
- Complete payment flow from start to finish
- DETAILED logging of every calculation step
- Verification reads after each write operation
- Clear documentation of test scenario

### 2. Diagnostic Report

**File:** `apm_session/Memory/Task_Completion_Logs/Diagnostic_Payment_Cascade_Investigation_2025-10-16.md`

**Must Include:**
- Test scenario description (unit, bills, amounts)
- Complete log output (formatted for readability)
- Line-by-line analysis of where error occurs
- Root cause identification with evidence
- Recommendation for fix

### 3. Evidence Files

- Full console log output saved to file
- Before/After Firestore document snapshots
- Transaction document export (like the example JSON)
- AggregatedData document snapshots

### 4. Code Annotations

**Add diagnostic comments to:**
- `backend/services/waterPaymentsService.js` - Mark suspicious lines
- `backend/services/waterDataService.js` - Mark surgical update issues

---

## 🎯 Success Criteria

**This task is complete when you can answer:**

1. ✅ **What is the exact root cause?** (with evidence)
2. ✅ **Where does the $69.50 go?** (exact line of code)
3. ✅ **Why does the integrity check fail?** (allocation sum ≠ payment)
4. ✅ **Is the issue in cascade, allocations, bill updates, or surgical update?**
5. ✅ **What is the recommended fix?** (specific code changes needed)

**You DO NOT need to:**
- ❌ Fix the code (diagnostic only)
- ❌ Modify production code permanently
- ❌ Create UI tests
- ❌ Test on production environment

---

## 📚 Key Files to Review

### Payment Flow
- `backend/services/waterPaymentsService.js` (lines 198-720)
  - `recordPayment()` - Entry point
  - Payment cascade algorithm (302-368)
  - `createWaterBillsAllocations()` (25-136)
  - `_updateBillsWithPayments()` (655-720)

### Surgical Update
- `backend/services/waterDataService.js`
  - `updateAggregatedDataAfterPayment()` - Surgical update
  - `buildSingleUnitData()` - Unit data calculation

### Credit Balance
- `backend/controllers/hoaDuesController.js`
  - `getUnitDuesData()` - Credit balance read
  - `updateCreditBalance()` - Credit balance write

### Investigation Documents (Already Complete)
- `docs/investigations/Phase_2_Payment_Cascade_Flow_Diagram.md`
- `docs/investigations/Phase_1_Penalty_Calculation_Flow_Diagram.md`

---

## 🚦 Task Status

- [ ] **Phase 1:** Diagnostic test framework created
- [ ] **Phase 2:** Controlled test scenario executed
- [ ] **Phase 3:** Root cause identified with evidence
- [ ] **Phase 4:** Diagnostic report completed
- [ ] **Final:** Manager Agent review

---

## 💡 Hints and Tips

### Debugging Strategy

1. **Start Simple:** Use small, round numbers for test scenario
2. **One Variable at a Time:** Test without credit first, then add credit
3. **Verify Each Step:** Read back from Firestore after each write
4. **Compare Working System:** Look at HOA Dues payment flow as reference
5. **Unit Conversion:** Check if amounts are dollars vs cents at each step

### Common Gotchas in Payment Systems

- ❌ Double-counting credit balance (subtract twice)
- ❌ Credit balance in wrong units (dollars vs cents)
- ❌ Allocation amounts don't match cascade decisions
- ❌ Surgical update overwrites correct bill updates
- ❌ Partial payment logic has off-by-one error
- ❌ Bill totals recalculated incorrectly after payment

### Evidence Collection

**For each test run, capture:**
1. Complete console log (save to .txt file)
2. Firestore bill documents BEFORE payment (JSON export)
3. Firestore bill documents AFTER payment (JSON export)
4. Transaction document (JSON export)
5. AggregatedData BEFORE surgical update (JSON export)
6. AggregatedData AFTER surgical update (JSON export)

---

## 🤝 Communication

**When blocked:**
- Document what you've tried
- Show diagnostic evidence
- Ask specific questions about business logic

**When complete:**
- Show the smoking gun (exact line where error occurs)
- Provide evidence (logs, diffs, calculations)
- Recommend fix approach (but don't implement yet)

---

**Remember:** You have FULL freedom to manipulate Dev environment data. Don't hesitate to create clean test scenarios. Dev reload takes 5 minutes - use it if you need fresh data.

**Your Mission:** Find the bug with irrefutable evidence. We need to see EXACTLY where the math goes wrong.

Good hunting! 🎯

