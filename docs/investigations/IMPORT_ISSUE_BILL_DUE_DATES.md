# Import Issue: Bill Due Dates Set to Import Date

**Discovered:** October 15, 2025  
**During:** Task 1 - Penalty Calculation Integration Testing  
**Severity:** 🔥 HIGH - Blocks penalty calculation  
**Status:** Identified, awaiting fix

---

## Issue Summary

When bills are imported into the system, the `dueDate` field is being set to the **import date** instead of the **correct due date based on the bill month**.

---

## Evidence

### Current State (Incorrect)
```
Month 0 (July 2025):
  Due Date: 2025-10-25  ❌ WRONG
  Should be: ~2025-07-28

Month 1 (August 2025):
  Due Date: 2025-10-25  ❌ WRONG
  Should be: ~2025-08-28

Month 2 (September 2025):
  Due Date: 2025-10-25  ❌ WRONG
  Should be: ~2025-09-28

Month 3 (October 2025):
  Due Date: 2025-10-25  ❌ WRONG
  Should be: ~2025-10-28
```

**All bills have the same due date** (October 25, 2025 = import date + 10 days grace period), regardless of which fiscal month they represent.

---

## Impact on Penalties

### Why This Blocks Penalty Calculation

The penalty calculation service correctly checks:
```javascript
const billDueDateObj = new Date(billDueDate);
const gracePeriodEnd = new Date(billDueDateObj);
gracePeriodEnd.setDate(billDueDateObj.getDate() + config.penaltyDays);

const pastGracePeriod = currentDate > gracePeriodEnd;
```

**Result:**
- July 2025 bills (created July 2025) should be 3+ months overdue
- But their `dueDate` shows October 25, 2025
- So penalty calculation thinks they're NOT overdue yet
- Penalty = $0 (incorrectly)

---

## Root Cause Analysis

### Expected Bill Due Date Logic

Bills should have due dates based on:
```
Due Date = Last day of bill month + billing day
Example: July 2025 bill → July 31, 2025 (or July 28 per config)
```

### Actual Behavior (Import)

Import is setting:
```
Due Date = Import timestamp + grace period
Example: All bills → October 25, 2025 (when import ran)
```

### Suspected Location

Import logic likely in:
- `backend/services/importService.js` (or equivalent)
- `backend/controllers/importController.js`
- Or manual import scripts

**Action Required:** Locate import code that sets `dueDate` on bill documents.

---

## Correct Due Date Calculation

### Water Bills Configuration
```javascript
// From clients/AVII/config/waterBills
{
  billingDay: 28,  // Bills due on 28th of each month
  penaltyDays: 10, // Grace period
  penaltyRate: 0.05 // 5% per month
}
```

### Correct Calculation
```javascript
// For July 2025 (fiscal month 0, calendar July 2025):
const billMonth = 7; // July
const billYear = 2025;
const billingDay = config.billingDay || 28;

// Due date = 28th of the bill month
const dueDate = new Date(billYear, billMonth - 1, billingDay);
// Result: 2025-07-28

// Grace period end = due date + grace days
const gracePeriodEnd = new Date(dueDate);
gracePeriodEnd.setDate(dueDate.getDate() + config.penaltyDays);
// Result: 2025-08-07

// Today (Oct 15) > Grace period end (Aug 7) = TRUE
// Therefore: Penalties SHOULD apply
```

---

## Test Results Without Fix

### Current Penalty Status (Before Fix)
```javascript
// All months show:
{
  penaltyAmount: 0,  // ❌ Wrong - should have penalties
  dueDate: "2025-10-25",  // ❌ Wrong - should be bill month
  status: "unpaid"
}
```

### Expected After Fix
```javascript
// July 2025 bill (3+ months overdue):
{
  penaltyAmount: >0,  // ✅ Should calculate compound penalties
  dueDate: "2025-07-28",  // ✅ Correct month
  status: "unpaid" or "overdue"
}
```

---

## Testing Plan

### After Manual Fix Applied

1. **Run Task 1 Tests Again**
   ```bash
   cd backend
   node testing/testTask1.js
   ```

2. **Expected Results**
   - Test 2: Should show penalties > $0 for July, August, September
   - Test 4: Should show high penalty coverage for unpaid bills
   - Test 5: Should verify compounding formula with real penalties

3. **Verify Calculation**
   - July 2025: ~3 months overdue = ~15.8% penalty (5% compounding)
   - August 2025: ~2 months overdue = ~10.25% penalty
   - September 2025: ~1 month overdue = ~5% penalty

---

## Recommendations

### Immediate Fix (Manual)
✅ Michael will manually adjust due dates in Firebase for testing

### Permanent Fix (Required)
🔴 **MUST FIX IMPORT LOGIC** before next import

**Action Items:**
1. Locate import code that sets bill `dueDate`
2. Change from: `dueDate = importDate + gracePeriod`
3. Change to: `dueDate = calculateBillDueDate(billMonth, billYear, config.billingDay)`
4. Create helper function:
   ```javascript
   function calculateBillDueDate(fiscalMonth, fiscalYear, billingDay) {
     // Convert fiscal month to calendar month/year
     const calendarMonth = (fiscalMonth + 7) % 12; // July = 0 → 7
     const calendarYear = fiscalMonth <= 5 ? fiscalYear - 1 : fiscalYear;
     
     // Due on billingDay of that month
     return new Date(calendarYear, calendarMonth, billingDay);
   }
   ```

5. Add validation test:
   ```javascript
   // Verify due dates match bill months
   assert(julyBill.dueDate.getMonth() === 6); // June = 6, July = 6 (0-indexed)
   ```

---

## Related Issues

This may affect:
- ✅ **Task 1**: Penalty Calculation (blocked by this)
- ⚠️ **Task 2**: Payment allocation (depends on correct penalties)
- ⚠️ **Task 3**: Delete reversal (depends on correct penalties)

---

## Status

- [x] Issue identified
- [x] Root cause documented  
- [ ] Manual fix applied (Michael doing)
- [ ] Tests re-run with corrected dates
- [ ] Import code fix identified
- [ ] Import code fix implemented
- [ ] Validation test added

---

**Next Steps:**
1. Wait for Michael's manual date correction
2. Re-run Task 1 tests
3. Verify penalties calculate correctly
4. Complete Task 1 implementation
5. Create separate issue/task for Import fix

---

**Discovered by:** Implementation Agent (Task 1)  
**Documented:** October 15, 2025, 8:06 PM  
**File:** `docs/investigations/IMPORT_ISSUE_BILL_DUE_DATES.md`

