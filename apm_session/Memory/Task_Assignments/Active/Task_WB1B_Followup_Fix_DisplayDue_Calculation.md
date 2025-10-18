---
task_id: WB1B-Followup
task_title: Fix displayDue Backend Calculation Bug
priority: HIGH
status: pending
estimated_effort: 1 hour
parent_task: WB1B
created_date: 2025-10-17
context: Water Bills Critical Fixes (Priority 0A)
branch: feature/water-bills-issues-0-7-complete-fix
discovered_by: Implementation_Agent_WB1B
---

# Task WB1B-Followup: Fix displayDue Backend Calculation Bug

## Context

**Parent Task:** WB1B - Frontend Use Pre-Calculated Values  
**Discovered By:** Implementation_Agent_WB1B during testing  
**Severity:** HIGH  
**Impact:** Users see incorrect total due amounts in Bills table

### What Was Discovered

During WB1B testing, the agent discovered that `displayDue` field in aggregatedData is calculated incorrectly.

**Example - Unit 105 (October 2025):**
- Monthly Bill: $1.00
- Overdue Balance: $201.50
- Penalties: $0.00
- **displayDue shows:** $1.00 ❌ (WRONG!)
- **displayDue should show:** $202.50 ✅ (Correct: $1.00 + $201.50 + $0.00)

### Root Cause

Backend sets `displayDue = billAmount` only, not including overdue and penalties.

**Current (Wrong):**
```javascript
displayDue = billAmount  // Only current month bill
```

**Should Be:**
```javascript
displayDue = billAmount + displayOverdue + displayPenalties  // Total owed
```

### Impact

- Bills table shows incorrect "Due" column amounts
- Users don't see full amount owed (missing overdue + penalties)
- Payment modal shows correct amount (uses different data source)
- Creates confusion and inconsistency

---

## Goal

Fix the backend calculation of `displayDue` to include all components: bill amount + overdue balance + penalties.

---

## Acceptance Criteria

### Functional Requirements
- [ ] **displayDue Calculation Fixed**: Include billAmount + displayOverdue + displayPenalties
- [ ] **All Units Verified**: Test with multiple units (105, 203, others)
- [ ] **Fiscal Months Tested**: Verify calculation across different months
- [ ] **Paid Bills Handled**: Ensure paid bills show $0 correctly

### Testing & Verification
- [ ] **Unit 105 Verification**: Should now show $202.50 (not $1.00)
- [ ] **Firestore Check**: Verify aggregatedData contains correct displayDue values
- [ ] **Frontend Display**: Bills table shows correct totals
- [ ] **No Regressions**: Other display fields still correct

### Code Quality
- [ ] **Clear Calculation**: Code shows formula explicitly
- [ ] **Comments Added**: Explain what displayDue represents
- [ ] **No Linting Errors**: Clean code
- [ ] **Logging**: Log displayDue calculation for debugging

---

## Implementation Guidance

### Step 1: Locate Calculation Code (15 min)

**Expected Location:** `backend/services/waterDataService.js`

**Functions to Check:**
- `_calculateUnitData()` - Likely location
- `buildYearData()` - Calls calculation functions
- `buildSingleMonthData()` - Month-specific calculations

**Search Commands:**
```bash
grep -n "displayDue" backend/services/waterDataService.js
grep -n "_calculateUnitData" backend/services/waterDataService.js
grep -n "billAmount" backend/services/waterDataService.js | grep displayDue
```

### Step 2: Review Current Calculation (15 min)

**Look for code like:**
```javascript
unitData.displayDue = unitData.billAmount;  // ❌ Current (wrong)
```

**Or similar patterns that set displayDue without including other components.**

### Step 3: Fix Calculation (15 min)

**Update to:**
```javascript
// Calculate total amount due for display (bill + overdue + penalties)
unitData.displayDue = (unitData.billAmount || 0) + 
                     (unitData.displayOverdue || 0) + 
                     (unitData.displayPenalties || 0);

// For paid bills, ensure displayDue is 0
if (unitData.status === 'paid') {
  unitData.displayDue = 0;
}
```

**Key Points:**
- Include all three components
- Handle null/undefined values with `|| 0`
- Ensure paid bills show $0
- Add comment explaining the calculation

### Step 4: Testing (15 min)

**Test Scenarios:**

1. **Unit 105 (Overdue Bill):**
   - Expected: displayDue = $1.00 + $201.50 + $0.00 = $202.50
   - Verify: Bills table shows $202.50 in Due column

2. **Unit with Penalties:**
   - Find unit with penalties > 0
   - Verify: displayDue = billAmount + displayOverdue + penaltyAmount

3. **Paid Bill:**
   - Find paid unit
   - Verify: displayDue = $0.00

4. **Current Month Bill (No Overdue):**
   - Find unit current on payments
   - Verify: displayDue = billAmount only

**Testing Method:**
```bash
# Rebuild aggregatedData with fix
POST /water/clients/AVII/aggregatedData/clear?rebuild=true

# Check Firestore
# Look at aggregatedData document for AVII
# Verify displayDue values are correct

# Check Frontend
# Open Bills view
# Verify Due column shows correct amounts
```

---

## Files to Modify

### Primary File
- `backend/services/waterDataService.js`
  - Function: `_calculateUnitData()` or similar
  - Change: Fix displayDue calculation formula

### Possible Secondary Files (Check if needed)
- `backend/services/waterBillsService.js` - If calculation done here instead
- Any other file that sets displayDue field

---

## Background Reading

### Required
1. **WB1B Memory Log:** `apm_session/Memory/Task_Completion_Logs/Task_WB1B_Frontend_Use_Precalculated_Values_2025-10-17.md`
   - See Section: "Important Findings > CRITICAL: Backend Issue Discovered"
   - Lines 108-129

2. **WB1B Review:** `apm_session/Memory/Reviews/Manager_Review_WB1B_Frontend_Precalculated_Values_2025-10-17.md`
   - See Section: "Discovery Work > Critical Backend Bug Discovered"

### Reference
- **WB1 Completion Log:** How displayDue should be calculated
- **Water Data Service:** `backend/services/waterDataService.js` - Code structure

---

## Success Metrics

### When Complete:
- ✅ displayDue = billAmount + displayOverdue + displayPenalties
- ✅ Unit 105 shows $202.50 (not $1.00)
- ✅ Bills table displays correct totals
- ✅ No regressions in other display fields
- ✅ Paid bills show $0.00 correctly

### Definition of Done:
- **Code:** Calculation formula updated
- **Testing:** Verified with Unit 105 and multiple test cases
- **Frontend:** Bills table shows correct amounts
- **Documentation:** Memory Log with testing evidence

---

## Deliverables

1. **Modified Backend File(s):**
   - Fixed displayDue calculation
   - Added clarifying comment
   - Clean code, no linting errors

2. **Testing Evidence:**
   - Firestore screenshot showing correct displayDue values
   - Frontend screenshot showing corrected Bills table
   - Test results for Unit 105 specifically

3. **Memory Log:**
   - Location: `apm_session/Memory/Task_Completion_Logs/Task_WB1B_Followup_Fix_DisplayDue_2025-10-17.md`
   - Include: Code changes, testing evidence, verification results

---

## Critical Considerations

### 1. Coordinate with Other Calculations
- Ensure displayOverdue and displayPenalties are calculated first
- displayDue depends on these values being correct
- Order of calculations matters

### 2. Paid Bills Handling
- Paid bills should show displayDue = $0
- Verify this after calculation
- Don't show historical amounts for paid bills

### 3. Null/Undefined Safety
- Use `|| 0` for all components
- Handle missing fields gracefully
- Don't create NaN values

### 4. Testing Scope
- Test with AVII data (Unit 105 + others)
- Consider edge cases (first month, no overdue, high penalties)
- Verify across fiscal year boundary

---

## Dependencies

### Requires (All Complete)
- WB1B: Frontend Use Pre-Calculated Values ✅

### Related
- WB1: Backend Data Structure (provides centavos architecture) ✅
- WB2: Penalty Calc Optimization (calculates penalties) ✅

### Blocks
- **None** - But impacts user-facing display quality

---

## Time Estimate

- **Step 1 (Locate):** 15 min
- **Step 2 (Review):** 15 min
- **Step 3 (Fix):** 15 min
- **Step 4 (Testing):** 15 min
- **Total:** 1 hour

---

## Priority Justification

**HIGH Priority because:**
1. User-facing bug (Bills table shows wrong amounts)
2. Creates confusion (inconsistent with payment modal)
3. Simple fix (one calculation formula)
4. Quick to test and verify
5. Discovered during WB1B testing (already analyzed)

**Why Not CRITICAL:**
- Payment modal shows correct amounts (users can still pay)
- Not a data corruption issue (display only)
- Has workaround (use payment modal to see real amount)

---

## Questions for Manager

**Q: Should this block WB3-WB5 progress?**
- **Recommendation:** No - can proceed in parallel
- displayDue fix is isolated
- WB3-WB5 work on different areas

**Q: Deploy separately or with WB1B?**
- **Recommendation:** Deploy together as WB1B package
- WB1B + Followup = Complete frontend/backend alignment
- Test together before production

---

## Notes

This bug was discovered by excellent testing work during WB1B. The agent correctly:
- Identified the issue with specific example (Unit 105)
- Analyzed root cause
- Provided recommended fix
- Documented thoroughly

This follow-up task should be straightforward - the analysis is already done, just need to implement the fix.

---

**Task Created:** October 17, 2025  
**Created By:** Manager Agent (based on WB1B discovery)  
**Branch:** `feature/water-bills-issues-0-7-complete-fix`  
**Ready for Assignment:** YES

