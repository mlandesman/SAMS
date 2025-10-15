---
READY FOR IMPLEMENTATION AGENT ASSIGNMENT
PREREQUISITE: Task 1 must be complete (penalties calculating)
---

# /newIA Assignment: Task 2 - Payment Issues Resolution

## 🎯 Your Mission

You are Implementation Agent assigned to **fix 4 payment-related issues** in Water Bills. The payment cascade algorithm is CORRECT, but integration issues cause UI problems and data inconsistencies.

---

## 📖 Critical Context

### The Problems:
1. **Issue 1:** Credit balance doesn't update until page reload
2. **Issue 2:** Paid bills still show amounts due
3. **Issue 3:** Due amounts incorrect after full refresh
4. **Issue 4:** "NOBILL" error blocks overdue payments

### Investigation Finding:
> "Payment cascade algorithm matches expected behavior exactly. The 4 issues are NOT in payment logic but in: UI refresh, surgical update, data inconsistency, display logic."

### Your Fix:
Use new `/credit` endpoint (from Task 0A) and fix integration/display issues.

---

## 📋 CRITICAL REQUIREMENTS

### 1. Git Workflow (MANDATORY)
```bash
# FIRST - Verify you're on feature branch
git branch
# Must show: * feature/water-bills-issues-0-7-complete-fix

# Pull latest changes (Task 0A and Task 1)
git pull

# If not on correct branch, STOP and ask for help
```

**Read:** `/docs/GIT_WORKFLOW_FOR_WATER_BILLS_FIX.md` before starting

### 2. Prerequisite Check
**Task 1 MUST be complete** before starting this task.

Verify penalties are calculating:
```bash
# Check that Task 1 Memory Log exists
ls apm_session/Memory/Task_Completion_Logs/Task_1_Penalty_Calculation_Integration_2025-10-15.md

# If missing, wait for Task 1 to complete
```

### 3. Product Manager's Instructions
- **Credit endpoint:** MUST use `/credit` (NOT `/hoadues`)
- **Error handling:** Atomic operations only (fail whole payment if error)
- **Display logic:** Handle payments in arrears correctly
- **Testing focus:** 90% backend API testing

### 4. Complete Task Assignment
**Read this file COMPLETELY before coding:**
`apm_session/Memory/Task_Assignments/Active/Task_2_Payment_Issues_Resolution.md`

It contains:
- Detailed fix for each of 4 issues
- Backend test requirements
- Success criteria
- Memory Log requirements

---

## 🔧 Implementation Checklist

### Setup
- [ ] Read complete task assignment document
- [ ] Read git workflow document
- [ ] Verify Task 1 complete (penalties working)
- [ ] Verify on feature branch
- [ ] Pull latest changes

### Issue 1: Credit Balance
- [ ] Update waterPaymentsService to use `/credit` endpoint
- [ ] Create creditAPI.js helper
- [ ] Remove HOA Dues context dependency
- [ ] Test immediate credit update (no reload)

### Issue 2: Paid Bills Display
- [ ] Add surgical update verification
- [ ] Fix display logic for paid bills
- [ ] Handle partial payments correctly
- [ ] Test with full and partial payments

### Issue 3: Full Refresh
- [ ] Add detailed logging to trace issue
- [ ] Verify bill documents update correctly
- [ ] Implement cache clearing on refresh
- [ ] Test full rebuild shows correct data

### Issue 4: NOBILL Error
- [ ] Change logic to check total due (not current month only)
- [ ] Remove "NOBILL" error completely
- [ ] Update payment modal for all unpaid bills
- [ ] Test overdue payments work

### Testing & Commit
- [ ] Test Issue 1: Credit updates immediately
- [ ] Test Issue 2: Paid bills show $0
- [ ] Test Issue 3: Refresh shows correct data
- [ ] Test Issue 4: Can pay overdue without current bill
- [ ] Create Memory Log with issue-by-issue evidence
- [ ] Commit changes with descriptive message

---

## 🧪 Testing Requirements

**Environment:** Dev with fresh AVII data  
**Method:** Backend API testing (testHarness) - **REQUIRED FOR AUTH**  
**Client:** AVII

### ⚠️ CRITICAL: Use testHarness for ALL API Calls
All endpoints require Firebase auth tokens. Direct calls (axios/fetch/curl) will fail with 401 errors.

```bash
cd backend
node testing/testHarness.js  # Provides authenticated access
```

### Required Tests (4):

#### Test 1: Credit Balance Update (Issue 1)
```javascript
// Use $100 credit in payment
// Verify credit updates IMMEDIATELY (no reload)
// Expected: Credit decreases by $100 instantly
```

#### Test 2: Paid Bill Display (Issue 2)
```javascript
// Make full payment on bill
// Expected: displayDue = $0, displayPenalties = $0
// Make partial payment
// Expected: displayDue = remaining amount
```

#### Test 3: Full Refresh (Issue 3)
```javascript
// Clear cache, rebuild aggregatedData
// Expected: Paid bills stay paid
// Expected: Due amounts match bill documents
```

#### Test 4: Overdue Payment (Issue 4)
```javascript
// Unit with overdue but no current usage
// Expected: Can calculate totalDue
// Expected: Payment button enabled
// Expected: Payment succeeds
```

**Hard Stop:** Do NOT proceed to Task 3 until ALL 4 tests pass

---

## 📝 Memory Log

**File:** `apm_session/Memory/Task_Completion_Logs/Task_2_Payment_Issues_Resolution_2025-10-15.md`

**Must include:**
- Issue-by-issue status (before/after)
- Evidence of using `/credit` endpoint
- All 4 test results
- Confirmation: Atomic operations only
- Known issues (if any)

---

## 🚨 Critical Constraints

1. **MUST use /credit endpoint** - Not /hoadues
2. **MUST be atomic** - Fail whole payment if error
3. **DO NOT commit to main** - Stay on feature branch
4. **DO NOT skip testing** - All 4 issues must be tested
5. **DO NOT claim success without evidence** - Logs/screenshots required

---

## 📊 Expected Outcomes

### Issue 1: Credit Balance
**Before:**
- Credit: $50 → Make payment → Credit: $50 (stale) → Reload → Credit: $0 ✓

**After:**
- Credit: $50 → Make payment → Credit: $0 ✓ (immediate)

### Issue 2: Paid Bills
**Before:**
- Status: "Paid" ✓, Due: $399.98 ✗ (confusing)

**After:**
- Status: "Paid" ✓, Due: $0.00 ✓ (correct)

### Issue 3: Full Refresh
**Before:**
- Paid bill → Refresh → Due: $399.98 ✗ (data inconsistent)

**After:**
- Paid bill → Refresh → Due: $0.00 ✓ (consistent)

### Issue 4: NOBILL Error
**Before:**
- No current usage → "NOBILL" error → Cannot pay overdue ✗

**After:**
- No current usage → Total due: $800 → Payment succeeds ✓

---

## 🎯 Success Criteria

- [ ] Issue 1: Credit updates without reload
- [ ] Issue 2: Paid bills show $0 due
- [ ] Issue 3: Refresh shows correct data
- [ ] Issue 4: Can pay overdue without current bill
- [ ] Uses `/credit` endpoint (not `/hoadues`)
- [ ] Atomic operations verified
- [ ] All 4 backend tests pass
- [ ] Memory Log complete
- [ ] Changes committed to feature branch

---

## 📞 Support

**If stuck:**
- Review investigation: `docs/investigations/Phase_2_Payment_Cascade_Flow_Diagram.md`
- Check gap analysis: `docs/investigations/Phase_2_Payment_Gap_Analysis.md`
- Ask Manager Agent for clarification

**Duration:** Estimated 4-5 hours  
**Priority:** 🔥 HIGH - Critical payment issues  
**Prerequisite:** Task 1 complete  
**Status:** Ready for assignment (after Task 1)

---

**Manager Agent:** APM Manager Agent  
**Created:** October 15, 2025  
**Approved by:** Michael Landesman  
**Branch:** feature/water-bills-issues-0-7-complete-fix
