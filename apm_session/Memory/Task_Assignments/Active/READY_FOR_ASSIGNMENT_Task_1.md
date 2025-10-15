---
READY FOR IMPLEMENTATION AGENT ASSIGNMENT
---

# /newIA Assignment: Task 1 - Penalty Calculation Integration

## 🎯 Your Mission

You are Implementation Agent assigned to **fix the root cause** of Water Bills Issues 0-7. Penalties are not being calculated ($0 for all units). Your job is to integrate the existing, working penalty calculation code into the nightly aggregatedData build routine.

---

## 📖 Critical Context

### The Problem:
- All units show $0 penalties (even never-paid units)
- `penaltiesApplied: false` in all bill metadata
- Penalty calculation code EXISTS and is PERFECT
- Problem: It's never being CALLED

### Your Fix:
Add penalty calculation to 2 places:
1. **Nightly aggregatedData build** (automatic at 1am)
2. **Surgical update after payment** (per-unit recalc)

### Investigation Finding:
> "The fast path optimization reuses existing data (including stale $0 penalties) for performance, but skips the penalty refresh that should happen."

---

## 📋 CRITICAL REQUIREMENTS

### 1. Git Workflow (MANDATORY)
```bash
# FIRST - Verify you're on feature branch
git branch
# Must show: * feature/water-bills-issues-0-7-complete-fix

# If not, STOP and ask for help
```

**Read:** `/docs/GIT_WORKFLOW_FOR_WATER_BILLS_FIX.md` before starting

### 2. Product Manager's Instructions
- **Integration point:** Add to EXISTING nightly routine (no new cron job)
- **Surgical update:** Same code as bulk, but array of 1 unit instead of many
- **Strong consistency:** No temporary inconsistencies allowed
- **Testing focus:** 90% backend API testing (use testHarness)

### 3. Complete Task Assignment
**Read this file COMPLETELY before coding:**
`apm_session/Memory/Task_Assignments/Active/Task_1_Penalty_Calculation_Integration.md`

It contains:
- Step-by-step implementation guide
- 5 required backend tests
- Success criteria
- Memory Log requirements

---

## 🔧 Implementation Checklist

- [ ] Read complete task assignment document
- [ ] Read git workflow document
- [ ] Verify on feature branch
- [ ] Locate `calculateYearSummary()` function
- [ ] Add `_applyPenaltiesToMonth()` call in build loop
- [ ] Update `lastPenaltyUpdate` timestamp
- [ ] Verify surgical update includes penalty calc
- [ ] Add optional `specificUnitId` parameter (if needed)
- [ ] Test 1: Verify penalties currently $0
- [ ] Test 2: Manual refresh calculates penalties
- [ ] Test 3: Surgical update includes penalties
- [ ] Test 4: All units have correct penalties
- [ ] Test 5: Penalty calculation formula correct
- [ ] Create Memory Log with before/after evidence
- [ ] Commit changes with descriptive message

---

## 🧪 Testing Requirements

**Environment:** Dev with fresh AVII data  
**Method:** Backend API testing (testHarness)  
**Client:** AVII  
**Test Unit:** 203 (or any unit with overdue bills)

### Minimum Tests:
1. Confirm penalties = $0 before fix
2. Run manual refresh, confirm penalties > $0
3. Make payment, confirm surgical update works
4. Check all units, confirm penalties applied
5. Verify calculation formula (base × rate)

**Hard Stop:** Do NOT proceed to Task 2 until ALL 5 tests pass

---

## 📝 Memory Log

**File:** `apm_session/Memory/Task_Completion_Logs/Task_1_Penalty_Calculation_Integration_2025-10-15.md`

**Must include:**
- Before/after comparison (penalties $0 → penalties > $0)
- Which functions were modified
- All 5 test results with evidence
- Confirmation: No new cron job created
- Confirmation: Surgical = bulk with 1 unit parameter

---

## 🚨 Critical Constraints

1. **DO NOT create new cron job** - Add to existing routine
2. **DO NOT separate surgical/bulk logic** - Same function, different params
3. **DO NOT commit to main** - Stay on feature branch
4. **DO NOT skip testing** - All 5 tests required
5. **DO NOT claim success without evidence** - Screenshots/logs required

---

## 📊 Expected Outcome

### Before Your Fix:
```javascript
{
  unitId: "203",
  penalties: 0,
  penaltiesApplied: false,
  totalAmount: 39998  // Only base, no penalties
}
```

### After Your Fix:
```javascript
{
  unitId: "203",
  penalties: 2000,  // $20.00 (5% of $400)
  penaltiesApplied: true,
  totalAmount: 41998  // Base + penalties
}
```

---

## 🎯 Success Criteria

- [ ] Penalties calculated during nightly build
- [ ] Penalties calculated during surgical update
- [ ] All overdue bills show penalties > $0
- [ ] `penaltiesApplied` = true after calculation
- [ ] No new cron job created
- [ ] All 5 backend tests pass
- [ ] Memory Log complete
- [ ] Changes committed to feature branch

---

## 📞 Support

**If stuck:**
- Review investigation: `docs/investigations/Phase_1_Penalty_Calculation_Flow_Diagram.md`
- Check code reference: `docs/investigations/Phase_1_Penalty_Code_Reference.md`
- Ask Manager Agent for clarification

**Duration:** Estimated 3-4 hours  
**Priority:** 🚨 CRITICAL - Root cause of Issues 0-7  
**Status:** Ready for assignment

---

**Manager Agent:** APM Manager Agent  
**Created:** October 15, 2025  
**Approved by:** Michael Landesman  
**Branch:** feature/water-bills-issues-0-7-complete-fix
