# Water Bills Payment Test Suite

## Overview

This test suite diagnoses issues in the Water Bills payment system by tracking **expected vs actual** behavior at each step of the payment flow.

## Test Files

### 1. `water-payment-diagnostic-suite.js` (Comprehensive)
Full diagnostic suite that tests:
- Basic payments without penalties
- Backdated payments with penalty calculation
- Month filtering (pay only selected month)
- Preview vs Actual payment (critical comparison)
- Full payment flow (preview → record → verify)
- Surgical updates to aggregatedData

**Run:** `node tests/water-payment-diagnostic-suite.js`

### 2. `water-payment-quick-check.js` (Fast)
Quick check that compares preview vs payment calculations side-by-side.

**Run:** `node tests/water-payment-quick-check.js`

## Expected Behavior

### Payment Distribution Rules
1. **Oldest bills first** - Bills are processed in chronological order
2. **Base charges before penalties** - Base amounts paid before penalty amounts
3. **Credit integration** - Existing credit balance added to available funds
4. **Month filtering** - Only bills up to selected month are considered
5. **Backdated penalties** - Penalties recalculated based on payment date

### Penalty Calculation
- **Grace Period:** 7 days after due date
- **Penalty Rate:** 5% per month, compounded
- **Example:** $950 bill, 3 months overdue = $950 × 0.05 × 3 = $142.50 penalty

### Preview vs Actual
**CRITICAL:** Preview and actual payment MUST produce identical results.

If they differ, users see:
- ❌ Modal shows bill as "paid" but table shows "unpaid"
- ❌ Modal shows wrong penalty amounts
- ❌ Payment records but UI doesn't update

## Known Issues (As of Test Creation)

### Issue 1: `selectedMonth` Not Passed to recordPayment
**Location:** `backend/services/waterPaymentsService.js:536`

```javascript
// CURRENT (BUG):
const distribution = await this.calculatePaymentDistribution(
  clientId, unitId, amount, currentCreditBalance, paymentDate
);

// SHOULD BE:
const distribution = await this.calculatePaymentDistribution(
  clientId, unitId, amount, currentCreditBalance, paymentDate, selectedMonth
);
```

**Impact:** Preview filters bills by month, but actual payment processes ALL unpaid bills.

### Issue 2: Frontend Doesn't Send `selectedMonth` to Record Endpoint
**Location:** `frontend/sams-ui/src/components/water/WaterPaymentModal.jsx:315`

The modal calls preview with `selectedMonth` but doesn't include it when recording payment.

**Fix Needed:** Add `selectedMonth` to payment data sent to backend.

### Issue 3: Frontend Uses `dueDate` Instead of `paymentDate`
**Location:** `frontend/sams-ui/src/components/water/WaterPaymentModal.jsx:71, 224`

```javascript
// CURRENT (WRONG):
const payOnDate = selectedMonthData?.dueDate;

// SHOULD BE:
const payOnDate = paymentDate; // From the date input field
```

**Impact:** Backdated payment penalty calculation uses wrong date.

## Running Tests

### Prerequisites
```bash
# Set environment variables
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
export NODE_ENV="development"
```

### Run Full Diagnostic Suite
```bash
node tests/water-payment-diagnostic-suite.js
```

Expected output:
```
================================================================================
  WATER BILLS PAYMENT DIAGNOSTIC TEST SUITE
================================================================================

TEST: Test 1: Basic Single Payment (Current Month, No Penalties)
--------------------------------------------------------------------------------
  ✓ Bills Processed: 1 ✓
  ✓ Total Base Charges: 950 ✓
  ✓ Total Penalties: 0 ✓
  ...
PASS: Basic Single Payment
```

### Run Quick Check
```bash
node tests/water-payment-quick-check.js
```

Expected output:
```
🔍 WATER BILLS PAYMENT QUICK CHECK
================================================================================

🎬 PREVIEW CALL (with selectedMonth):
  Bills Processed: 1
  Total Base Charges: $950
  ...

💳 PAYMENT CALL (without selectedMonth - BUG):
  Bills Processed: 2  ❌ MORE BILLS!
  Total Base Charges: $1900
  ...

❌ PREVIEW AND PAYMENT CALCULATIONS DIFFER
```

## Interpreting Results

### ✅ All Tests Pass
Payment system is working correctly. Preview and actual are aligned.

### ❌ Test Failures

#### "Preview and Actual DIFFER"
- Root cause: `selectedMonth` not being passed consistently
- Fix: Update `recordPayment()` to accept and pass `selectedMonth`

#### "Penalties NOT calculated"
- Root cause: `payOnDate` not being passed or used incorrectly
- Fix: Ensure payment date flows through to penalty calculation

#### "Status unchanged after payment"
- Root cause: Surgical update not working
- Fix: Check `waterDataService.updateAggregatedDataAfterPayment()`

#### "Bills Processed count wrong"
- Root cause: Month filtering not working
- Fix: Check filter logic in `calculatePaymentDistribution()`

## Next Steps After Tests

1. **Run diagnostic suite** to identify exact failure points
2. **Review test output** to see expected vs actual at each step
3. **Fix identified issues** (see Known Issues above)
4. **Re-run tests** to verify fixes
5. **Update this README** with new findings

## Test Data Setup

Tests automatically create fresh bill data for each test:
- Client: AVII
- Unit: 101
- Bill: 2026-00 (July 2025)
- Amount: 950 pesos
- Due Date: 2025-08-07

To test other scenarios, modify test parameters in the test file.

## Maintenance

When modifying the payment system:
1. **Run tests BEFORE changes** to establish baseline
2. **Run tests AFTER changes** to verify no regressions
3. **Add new tests** for new features or edge cases
4. **Update expected values** if business rules change

## Contact

Questions or test failures? Check:
1. Backend logs for calculation details (search for 🔍 emoji)
2. Test output for expected vs actual comparison
3. `waterPaymentsService.js` for calculation logic
4. `waterRoutes.js` for API parameter passing

