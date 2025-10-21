# Water Bills Test Suite - Quick Start

## 30-Second Start

```bash
# See the bug in action
node tests/water-payment-bug-demo.js

# Verify it's broken
node tests/water-payment-quick-check.js

# Run all tests
./tests/run-water-tests.sh all
```

## What You'll See

### If Broken (Current State):
```
❌ PREVIEW AND PAYMENT CALCULATIONS DIFFER
   Preview processes: 1 bill
   Payment processes: 2 bills
   
🐛 ROOT CAUSE:
   recordPayment() does NOT pass selectedMonth
```

### After Fixing:
```
✅ PREVIEW AND PAYMENT CALCULATIONS MATCH
   Both process: 1 bill
   All amounts identical
```

## The 3 Fixes Needed

### Fix 1: Backend Service
**File:** `backend/services/waterPaymentsService.js`
**Line:** 536
**Change:** Add `selectedMonth` parameter

```javascript
// Before
const distribution = await this.calculatePaymentDistribution(
  clientId, unitId, amount, currentCreditBalance, paymentDate
);

// After  
const distribution = await this.calculatePaymentDistribution(
  clientId, unitId, amount, currentCreditBalance, paymentDate, selectedMonth
);
```

### Fix 2: Backend Route
**File:** `backend/routes/waterRoutes.js`
**Line:** ~403 (recordWaterPayment route)
**Change:** Extract `selectedMonth` from request body

```javascript
// In the controller/route handler
const { unitId, amount, paymentDate, selectedMonth, ... } = req.body;
// Pass to service
```

### Fix 3: Frontend Modal
**File:** `frontend/sams-ui/src/components/water/WaterPaymentModal.jsx`
**Line:** ~315
**Change:** Send `selectedMonth` in payment request

```javascript
// Before
await waterAPI.recordPayment(selectedClient.id, {
  unitId,
  amount: parseFloat(amount),
  paymentDate,
  // ...
});

// After
await waterAPI.recordPayment(selectedClient.id, {
  unitId,
  amount: parseFloat(amount),
  paymentDate,
  selectedMonth: selectedMonth,  // ADD THIS
  // ...
});
```

## Workflow

1. **Before fixing:** Run tests to see what's broken
2. **Apply fixes:** Make the 3 changes above
3. **After fixing:** Run tests to verify
4. **In browser:** Test with actual UI to confirm

## That's It!

The tests will tell you exactly what's working and what's not.

No more dart-throwing. No more 15-hour debug sessions.

Just run the tests, see the problems, fix them, verify.

