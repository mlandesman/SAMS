---
task_id: WB-Split-Transactions-Priority-1
priority: 🔥 HIGH (Priority 1 - Foundation for Statement of Account)
agent_type: Implementation Agent
status: READY_FOR_ASSIGNMENT
created: 2025-10-14
approved_by: Manager Agent
approval_date: 2025-10-14
estimated_effort: 2.5-3.5 hours
memory_log_path: apm_session/Memory/Task_Completion_Logs/Priority_1_Water_Bills_Split_Transactions_2025-10-14.md
dependencies: 
  - Water Bills Performance Optimization (COMPLETE - October 14)
  - Water Bills Surgical Updates (COMPLETE - October 14)
  - HOA Dues Split Transactions (Reference Pattern - COMPLETE)
enables:
  - Priority 2: HOA Dues Quarterly Collection Display
  - Priority 3: HOA Penalties
  - Priority 4: Statement of Account Report
---

# Task Assignment: Priority 1 - Water Bills Split Transactions

## Objective
Implement split transactions for Water Bills payments using the `allocations[]` pattern from HOA Dues. This provides the foundation data structure for Statement of Account report penalty detail. Also fix one remaining UI issue (auto-advance on Readings tab).

## Strategic Context

### Foundation-First Approach
This is **Priority 1** in a 4-step sequence to build Statement of Account:
1. **Priority 1:** Water Bills Split Transactions + UI Fix (THIS TASK) - Data structure for penalty detail
2. **Priority 2:** HOA Dues Quarterly Display - Report shows quarterly properly
3. **Priority 3:** HOA Penalties - Calculations stored before reporting  
4. **Priority 4:** Statement of Account - Uses all foundations

**Why This Order:** Statement of Account pulls from transactions collection. Without split allocations showing bills vs penalties separately, the report cannot display detailed breakdown.

---

## Part A: Split Transactions (2-3 hours) - FOUNDATION CRITICAL

### Current State
Water Bills payments have payment detail but not in split transaction format:
```javascript
// Current: billPayments array in metadata
payments: [{
  billPayments: [{
    period: "2025-08",
    amountPaid: 2150,
    baseChargePaid: 2000,
    penaltyPaid: 150
  }]
}]
```

### Target State
Apply HOA Dues `allocations[]` pattern:
```javascript
// Target: allocations array (matches HOA Dues + Transactions View)
allocations: [
  {
    id: "alloc_001",
    type: "water_bill",
    targetName: "August 2025 - Unit 203",
    amount: 200000, // cents
    categoryName: "Water Consumption",
    data: {
      unitId: "203",
      billId: "bill_id",
      billType: "base_charge"
    }
  },
  {
    id: "alloc_002",
    type: "water_penalty",
    targetName: "August 2025 Penalties - Unit 203",
    amount: 15000, // cents
    categoryName: "Water Penalties",
    data: {
      unitId: "203",
      billId: "bill_id",
      billType: "penalty"
    }
  }
]
```

### Key Implementation Note from Product Manager
> "We have Split transactions already built into HOA/Expense Entry and the Transactions View so the code for Water Bills is minimal -- likely just renaming the array inside the payment document to match what Transactions View is looking for (allocations[]) and ensuring that the fields in that array line up."

**Translation:** This is minimal code - just apply the existing HOA Dues pattern.

### Files to Modify

#### 1. `backend/services/waterPaymentsService.js`
Create `createWaterBillsAllocations()` function:
- Loop through `billPayments` array
- Create allocation for base charge
- Create separate allocation for penalty (only if > 0)
- Add credit allocation if applicable
- Return `allocations[]` array

Update transaction creation:
```javascript
const transactionData = {
  // ... existing fields ...
  allocations: createWaterBillsAllocations(billPayments, unitId, paymentData),
  categoryName: allocations.length > 1 ? "-Split-" : "Water Consumption"
};
```

#### 2. `functions/backend/services/waterPaymentsService.js`
Mirror changes from #1 (Firebase Functions version)

#### 3. Import Services (Both backend and functions)
Update Water Bills import to create split allocations

### Success Criteria - Part A
- ✅ Water Bills payments create `allocations[]` array
- ✅ Penalties appear as separate line items (not combined with base charge)
- ✅ Transaction category shows "-Split-" when multiple allocations
- ✅ Transactions View displays split breakdown automatically (no frontend changes needed)
- ✅ Import process creates proper split transactions

---

## Part B: Remaining UI Fix (0.5 hours) - BUNDLE FOR EFFICIENCY

### Good News: Most UI Work Already Done!

**✅ ALREADY COMPLETE (October 8 Water Bills Recovery):**
1. ✅ Due Date Display - Read-only display when bill record exists
2. ✅ Month Selector - Compact, appropriately sized pulldown
3. ✅ Date Range on Bills - Showing reading period properly
4. ✅ Auto-Advance Bills Screen - Jump to currently open bill working

### Remaining Fix

**Auto-Advance Readings Screen**
- **Issue:** Readings tab doesn't auto-advance to first unsaved month (Bills tab does)
- **File:** `frontend/sams-ui/src/views/WaterBillsViewV3.jsx` - Readings tab logic
- **Fix:** On load, check last monthly readings file and advance to next unsaved month
  - If last reading is 2026-01, show 2026-02
  - Match the Bills tab auto-advance pattern
- **Effort:** 0.5 hours

### Success Criteria - Part B
- ✅ Readings tab auto-advances to first unsaved month on load
- ✅ Matches Bills tab auto-advance behavior
- ✅ Better UX for water meter entry

---

## Testing Requirements

### Test Case 1: Single Bill with Penalty
- Pay Unit 203 June bill: $2150 ($2000 base + $150 penalty)
- **Expected:** Two allocations (base + penalty as separate line items)
- **Transaction Category:** "-Split-"

### Test Case 2: Single Bill No Penalty
- Pay bill with no penalties
- **Expected:** Single allocation (base charge only)
- **Transaction Category:** "Water Consumption" (not "-Split-")

### Test Case 3: Multiple Bills Payment
- Pay multiple bills (e.g., June + July)
- **Expected:** Multiple allocations for each bill's base + penalties
- **Transaction Category:** "-Split-"

### Test Case 4: Readings Auto-Advance
- Open Water Bills, go to Readings tab
- **Expected:** Auto-advances to first unsaved month
- **Verify:** Matches Bills tab behavior

---

## Reference Implementation

**HOA Dues Split Transaction Pattern:**
- File: `backend/controllers/hoaDuesController.js` (lines 60-140)
- Example: `scripts/2025-10-02_214147_247.json`

**Transactions View:**
- Frontend components already handle `allocations[]` array display
- No frontend changes needed for split display

---

## Critical Implementation Notes

### Must-Have for Statement of Account
1. **Penalty Separation is CRITICAL:** Report MUST show penalties as separate line items
2. **Allocation Structure:** Must match HOA Dues pattern exactly for consistency
3. **No Rework:** If not done correctly now, Statement of Account needs immediate rework

### Technical Guidelines
- **Pattern:** Follow exact same structure as HOA Dues allocations
- **Minimal Code:** Just applying existing pattern, not creating new one
- **UI:** Split transaction display works automatically
- **Testing:** Use real AVII data with penalties to validate

---

## Manager Agent Review Criteria

When reviewing completion of this task, Manager Agent will verify:
- [ ] Penalties appear as separate allocations (not combined)
- [ ] Allocation structure matches HOA Dues pattern exactly
- [ ] Transaction category shows "-Split-" when multiple allocations
- [ ] Single allocation payments show actual category (not "-Split-")
- [ ] Readings tab auto-advances to first unsaved month
- [ ] Testing demonstrates penalty separation with real data
- [ ] Code follows existing HOA Dues pattern (minimal new patterns)

**Success Definition:** Statement of Account can read transaction allocations and display bills vs penalties separately without any data transformation. Readings tab UX matches Bills tab.

---

## Deliverables

1. Updated `waterPaymentsService.js` (backend + functions) with allocation generation
2. Updated import services for split transaction support
3. Updated `WaterBillsViewV3.jsx` with Readings tab auto-advance
4. Test results showing proper split transaction display and UI fix
5. Memory log documenting implementation and testing

---

**Manager Agent Approval:** This task is READY FOR ASSIGNMENT as Priority 1. The Implementation Agent should focus on applying the proven HOA Dues pattern (minimal code) and fixing the one remaining UI issue.

**Total Effort:** 2.5-3.5 hours (2-3 splits + 0.5 UI fix)
**Strategic Value:** Foundation for Statement of Account penalty detail + Complete UX

