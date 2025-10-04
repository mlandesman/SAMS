# Task Assignment: Fix Import Allocation Structure to Match Working Code

**Agent:** Implementation_Agent  
**Status:** Ready for Assignment  
**Priority:** CRITICAL - Production data integrity issue  
**Estimated Effort:** 1 session  
**Created:** 2025-10-03

## Context

Import process is creating incomplete allocation structures that don't match the working AVII client data structure. The import code is missing critical fields and using wrong formats, causing:
1. Empty Unit column in Transactions view
2. Missing categories in split transaction allocations
3. Incomplete metadata that other code depends on

## Working Reference Structure

**File:** `backend/controllers/hoaDuesController.js` lines 75-154  
**Function:** `createHOAAllocations()` - This is the CORRECT structure to match

**Working AVII transaction:** `scripts/2025-09-23_115324_911.json`

## Required Fixes

### Fix 1: Add Top-Level `unitId` to Transactions

**File:** `scripts/data-augmentation-utils.js`  
**Location:** `augmentMTCTransaction()` function around line 157-226

**Current code** (line 221):
```javascript
migrationData: {
  originalAccount: accountName,
  originalAmount: mtcTransaction.Amount,
  originalDate: mtcTransaction.Date,
  unit: mtcTransaction.Unit || null,  // ❌ Nested - UI can't see it
  migratedAt: new Date().toISOString()
};
```

**Add BEFORE migrationData** (around line 215):
```javascript
// Add unitId as top-level field (UI expects this)
if (mtcTransaction.Unit) {
  augmentedData.unitId = mtcTransaction.Unit;
}
```

### Fix 2: Match Allocation Structure to Working Code

**File:** `backend/services/importService.js`  
**Location:** Lines 633-646 in `importHOADues()` method

**Replace current allocation mapping code:**
```javascript
// CURRENT (WRONG):
const allocations = hoaData.payments.map((payment, index) => {
  const monthName = this.getMonthName(payment.month);
  return {
    type: 'hoa_month',
    targetId: `hoaDues-${payment.unitId}-${year}`,
    targetName: monthName,
    data: {
      unitId: payment.unitId,
      month: payment.month,
      year: year
    },
    amount: payment.amount * 100
  };
});
```

**With WORKING structure (match hoaDuesController.js lines 81-101):**
```javascript
const allocations = hoaData.payments.map((payment, index) => {
  const monthName = this.getMonthName(payment.month);
  return {
    id: `alloc_${String(index + 1).padStart(3, '0')}`, // alloc_001, alloc_002, etc.
    type: "hoa_month",
    targetId: `month_${payment.month}_${year}`, // month_3_2026 format
    targetName: `${monthName} ${year}`, // "March 2026" format
    amount: payment.amount * 100, // Convert pesos to centavos
    percentage: null, // Required field
    categoryName: "HOA Dues", // Required for split transaction UI
    categoryId: "hoa_dues", // Required for consistency
    data: {
      unitId: payment.unitId,
      month: payment.month,
      year: year
    },
    metadata: {
      processingStrategy: "hoa_dues",
      cleanupRequired: true,
      auditRequired: true,
      createdAt: new Date().toISOString()
    }
  };
});
```

## Testing Requirements

After making changes:

1. **Purge and re-import MTC data**
2. **Verify Unit column** in Transactions view shows unit numbers
3. **Open a split transaction** and verify:
   - Categories show "HOA Dues" on each allocation line (not blank)
   - Amounts display correctly
   - Month names show with year (e.g., "March 2026")
4. **Check Firestore** - Compare imported transaction structure to working AVII transaction (`2025-09-23_115324_911`)

## Success Criteria

- [ ] Unit column populated in Transactions view
- [ ] Split transactions show category names on allocation lines
- [ ] Allocation structure matches working AVII transaction EXACTLY
- [ ] All fields present: id, type, targetId, targetName, amount, percentage, categoryName, categoryId, data, metadata

## Memory Log Requirements

**Path:** `apm_session/Memory/Phase_3_Import_System/Fix_Import_Allocation_Structure.md`

Document:
1. Exact code changes made
2. Before/after comparison of allocation structure
3. Testing results with screenshots if helpful
4. Any issues encountered

## Critical Guidelines

🚨 **DO NOT GUESS OR CHANGE OTHER FIELDS**  
- Match the working code structure EXACTLY
- Do not modify any other parts of the import system
- Use `backend/controllers/hoaDuesController.js` `createHOAAllocations()` as reference
- Compare your output to `scripts/2025-09-23_115324_911.json`

---

**Manager Notes:**  
User explicitly stated: "The code is already written and we are just fixing the import scripts." This means we should NOT be innovating or changing structures - only matching existing working patterns.

