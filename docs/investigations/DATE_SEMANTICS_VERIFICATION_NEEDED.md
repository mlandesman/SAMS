# Date Semantics Verification Required

**Date:** October 15, 2025  
**Issue:** Ambiguous date field semantics in Water Bills  
**Priority:** 🟡 MEDIUM - Affects user understanding and UI labels  
**Status:** Needs UI verification

---

## Problem Statement

The `dueDate` field has ambiguous semantics. The penalty calculation code adds the grace period to `dueDate`, which suggests `dueDate` represents when the bill was issued, not when payment is actually due.

---

## Current Code Behavior

### Penalty Calculation
```javascript
// backend/services/penaltyRecalculationService.js:199-205
const billDueDateObj = new Date(billDueDate);
const gracePeriodEnd = new Date(billDueDateObj);
gracePeriodEnd.setDate(billDueDateObj.getDate() + result.details.graceDays); // +10 days

const pastGracePeriod = currentDate > gracePeriodEnd;
```

**Formula:** Penalties start when `currentDate > (dueDate + graceDays)`

### Example
- `dueDate` in database: July 20, 2025
- `penaltyDays` (grace period): 10 days
- Penalties start: July 31, 2025

---

## Semantic Options

### Option A: dueDate = "Bill Sent Date"
**Current implementation**

```javascript
Bill Document:
{
  billDate: "2025-07-01",      // When bill generated
  dueDate: "2025-07-20",       // When bill was issued/sent (misleading name!)
  // Calculated in code:
  gracePeriodEnd: "2025-07-30" // When penalties actually start
}
```

**UI should show:**
- "Bill Date: July 1, 2025"
- "Payment Due: July 30, 2025" (calculated: dueDate + grace)
- "Late after: July 30, 2025"

**Pros:**
- Matches current code behavior
- Clear separation of bill issuance vs payment deadline

**Cons:**
- Field name "dueDate" is misleading
- User confusion about what "due date" means

---

### Option B: dueDate = "Payment Deadline"
**More intuitive naming**

```javascript
Bill Document:
{
  billDate: "2025-07-01",      // When bill generated
  dueDate: "2025-07-30",       // When payment is actually due
  // Calculated in code:
  gracePeriodEnd: "2025-08-09" // When penalties start (dueDate + grace)
}
```

**UI would show:**
- "Bill Date: July 1, 2025"
- "Payment Due: July 30, 2025" (direct from dueDate field)
- "Late after: August 9, 2025" (with grace period)

**Pros:**
- Field name matches user expectation
- Clear that grace period is AFTER the due date
- Matches standard invoicing terminology

**Cons:**
- Requires code changes to penalty calculation
- Need to update how dueDate is set during bill generation

---

## What to Verify in UI

### 1. Bill Generation/Import
**Check:**
- When creating/importing a bill, what date is stored in `dueDate`?
- What label does the UI show for this field?
- Is there a separate `billDate` field?

**Files to check:**
- `frontend/sams-ui/src/components/WaterBills/BillGeneration.jsx`
- `backend/services/waterBillsService.js`

### 2. Bill Display
**Check:**
- What does the Water Bills UI show as "Due Date"?
- Does it show raw `dueDate` or `dueDate + grace`?
- What do users expect to see?

**Files to check:**
- `frontend/sams-ui/src/components/WaterBills/BillsList.jsx`
- `frontend/sams-ui/src/components/WaterBills/BillDetails.jsx`

### 3. Payment Modal
**Check:**
- When making a payment, what date does it reference?
- Does it warn about penalties and when they start?

**Files to check:**
- `frontend/sams-ui/src/components/WaterBills/PaymentModal.jsx`

---

## Recommended Actions

### Immediate (Testing)
1. **UI Verification:**
   - Check Water Bills module in dev environment
   - Note what labels are used for date fields
   - Note what dates are displayed to users
   - Check if grace period is mentioned in UI

2. **Document Current State:**
   - Screenshot the bill display
   - Screenshot the payment modal
   - Document exact labels used

3. **Test User Understanding:**
   - If "Due Date: July 20" is shown, do users understand they have until July 30?
   - Or do they think July 20 is the hard deadline?

### Short-term (If needed)
1. **Option 1: Keep code, fix labels**
   - Rename `dueDate` field → `issueDate` or `billIssuedDate`
   - Update UI labels to show "Payment Due: [dueDate + grace]"
   - Add tooltip: "Grace period of 10 days included"

2. **Option 2: Keep labels, fix code**
   - Store actual payment deadline in `dueDate`
   - Update penalty calculation to use `dueDate` directly for grace start
   - Add config for "when to show late warning" (dueDate vs grace end)

### Long-term (Recommended)
**Clarify all date fields:**
```javascript
Bill Document Structure:
{
  billDate: "2025-07-01",           // When bill generated
  paymentDueDate: "2025-07-30",     // When payment expected (what users see)
  penaltyStartDate: "2025-08-09",   // When penalties begin (calculated once)
  
  // Legacy/deprecated:
  dueDate: "2025-07-20",            // Keep for backwards compat, mark deprecated
}
```

---

## Configuration Review

**Current config** (`clients/AVII/config/waterBills`):
```javascript
{
  billingDay: 1,      // Bill generated on 1st of month
  dueDay: 10,         // What does this mean?
  penaltyDays: 10,    // Grace period
  readingDay: 1       // When meters read
}
```

**Questions:**
- What is `dueDay: 10` used for? Is this the payment deadline?
- Is `billingDay` when bill is generated or when payment is due?
- Should we have `paymentDueDay` separate from `penaltyGraceDays`?

---

## Testing Checklist

- [ ] Check UI labels for "Due Date" field
- [ ] Check what date is stored when importing bills
- [ ] Check what date is displayed in bills list
- [ ] Check if grace period is visible to users
- [ ] Check payment modal date references
- [ ] Verify penalty calculation with current dates
- [ ] Document user's mental model of "due date"
- [ ] Decide: Keep semantics or rename fields?

---

## Related Files

### Backend
- `backend/services/penaltyRecalculationService.js` - Penalty calculation logic
- `backend/services/waterBillsService.js` - Bill generation
- `backend/services/importService.js` - Bill import (where due dates set incorrectly)

### Frontend
- `frontend/sams-ui/src/components/WaterBills/` - All Water Bills UI components

### Configuration
- `clients/AVII/config/waterBills` - Billing configuration

---

## Next Steps

1. **Michael to verify in UI:**
   - Check bill generation/import UI
   - Check what "Due Date" means in bills display
   - Check if grace period is shown anywhere

2. **Implementation Agent:**
   - Wait for UI verification results
   - Update field names or calculation logic as directed
   - Update documentation to clarify semantics

3. **Documentation:**
   - Create user-facing docs explaining grace period
   - Update developer docs with clear field definitions

---

**Status:** Awaiting UI verification by Product Manager  
**Blocker:** None - Task 1 code works correctly, this is a UX clarification  
**Impact:** Medium - May confuse users about when payment is actually due

