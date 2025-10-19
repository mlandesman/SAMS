# TD-018: Water Bills - Surgical Update Penalty Calculation

**Priority:** 🔥 HIGH  
**Category:** Technical Debt  
**Module:** Water Bills - Surgical Updates  
**Created:** October 18, 2025  
**Status:** 🔴 OPEN  

## Problem Statement

Surgical updates after water bill payments may not be running the surgical penalty calculation, which is necessary for partial payments and proper penalty recalculation.

## Background

### Surgical Update System (Completed October 14, 2025)
The surgical update system was implemented to provide near-instant UI refresh after payments:
- **Performance:** 94% improvement (8000ms → 503-728ms)
- **User Experience:** Payment → UI update in 1-2 seconds
- **Architecture:** Only recalculates affected unit instead of entire dataset

### Penalty Calculation Optimization (Completed October 17, 2025)
The penalty calculation was optimized for unit-scoped updates:
- **Performance:** 6x-9x speedup (2000-3000ms → 319ms)
- **Efficiency:** 83.3% reduction in bills processed
- **Integration:** Designed for surgical updates and delete reversals

## Current Behavior

**After Payment Recording:**
1. Bills updated with payment information
2. Surgical update triggered: `waterDataService.updateAggregatedDataAfterPayment()`
3. **Question:** Does this trigger penalty recalculation for affected units?

**If Penalties NOT Recalculated:**
- Partial payments may show incorrect penalties
- Overdue amounts may not update properly
- displayDue, displayPenalties, displayOverdue may be stale

## Technical Analysis

### Surgical Update Code Location
**File:** `backend/services/waterPaymentsService.js` (lines 538-551)

```javascript
// STEP 10: Surgical update - Update Firestore aggregatedData
try {
  const affectedUnitsAndMonths = billPayments.map(bp => ({
    unitId: bp.unitId,
    monthId: bp.billId
  }));
  await waterDataService.updateAggregatedDataAfterPayment(clientId, fiscalYear, affectedUnitsAndMonths);
  console.log(`✅ [PAYMENT] Surgical update completed - UI will auto-refresh`);
} catch (error) {
  console.warn(`⚠️ [PAYMENT] Surgical update failed (non-critical):`, error.message);
}
```

### Penalty Recalculation Code Location
**File:** `backend/services/penaltyRecalculationService.js`

**Optimized for Surgical Updates:**
- `recalculatePenalties(clientId, fiscalYear, unitId)` - Unit-scoped
- Skips paid bills for efficiency
- Designed for integration with surgical updates

### Integration Question
**Does `waterDataService.updateAggregatedDataAfterPayment()` call penalty recalculation?**

**If YES:** System is working correctly, no issue  
**If NO:** Penalties become stale after partial payments

## Potential Impact

### Scenario 1: Partial Payment
1. Unit has $1,000 due ($800 base + $200 penalties)
2. Owner pays $500 (partial payment)
3. Surgical update runs
4. **If penalties NOT recalculated:** Shows $200 penalties still (incorrect)
5. **Expected:** Penalties should recalculate on remaining $500 balance

### Scenario 2: Multiple Bills
1. Unit has 3 unpaid bills with penalties
2. Owner pays 2 bills in full
3. Surgical update runs
4. **If penalties NOT recalculated:** Third bill may show stale penalty amount
5. **Expected:** Third bill penalties should update based on new overdue status

### Scenario 3: Overpayment
1. Unit pays more than bills due
2. Excess goes to credit balance
3. Surgical update runs
4. **If penalties NOT recalculated:** May show penalties on paid bills
5. **Expected:** All penalties cleared for paid bills

## Root Cause Analysis

### Hypothesis 1: Penalty Calculation Not Integrated
- `updateAggregatedDataAfterPayment()` only updates aggregatedData document
- Does not trigger penalty recalculation
- Penalties remain stale until manual refresh

### Hypothesis 2: Penalty Calculation Integrated But Failing
- Penalty recalculation is called but failing silently
- Error caught and logged as "non-critical"
- Penalties not updating despite attempt

### Hypothesis 3: Penalty Calculation Not Needed
- Penalties already updated during payment recording
- Surgical update only refreshes aggregatedData
- System working as designed (no issue)

## Investigation Required

### Step 1: Code Review
**File:** `backend/services/waterDataService.js`  
**Function:** `updateAggregatedDataAfterPayment()`  
**Question:** Does this function call penalty recalculation?

### Step 2: Test Partial Payment
1. Record partial payment on bill with penalties
2. Check surgical update console logs
3. Verify penalty amount in aggregatedData
4. Compare to manual refresh result

### Step 3: Verify Integration
- Check if `penaltyRecalculationService` is imported
- Verify `recalculatePenalties()` is called with unit scope
- Ensure penalties are recalculated for affected units only

## Proposed Solution (If Issue Confirmed)

### Integration Approach
**File:** `backend/services/waterDataService.js`  
**Function:** `updateAggregatedDataAfterPayment()`

```javascript
// After updating aggregatedData, recalculate penalties for affected units
const { default: penaltyService } = await import('./penaltyRecalculationService.js');

for (const unit of affectedUnits) {
  await penaltyService.recalculatePenalties(clientId, fiscalYear, unit.unitId);
}
```

### Performance Consideration
- Unit-scoped penalty recalculation is already optimized (319ms)
- Adding to surgical update should maintain 1-2 second total time
- Much faster than manual refresh (10+ seconds)

## Acceptance Criteria

- ✅ Surgical update triggers penalty recalculation for affected units
- ✅ Partial payments show correct updated penalty amounts
- ✅ Multiple bill payments update penalties correctly
- ✅ Performance remains under 2 seconds total
- ✅ No silent failures in penalty calculation
- ✅ Console logs show penalty recalculation occurring

## Testing Scenarios

1. **Partial Payment Test:**
   - Bill: $1,000 ($800 base + $200 penalties)
   - Pay: $500
   - Verify: Penalties recalculate on remaining $500

2. **Multiple Bills Test:**
   - 3 unpaid bills with penalties
   - Pay 2 bills in full
   - Verify: Third bill penalties update correctly

3. **Overpayment Test:**
   - Pay more than bills due
   - Verify: Penalties cleared on paid bills

4. **Performance Test:**
   - Measure total surgical update time
   - Ensure remains under 2 seconds
   - Compare to manual refresh (10+ seconds)

## Related Work

- **WB2: Penalty Calc Optimization** (October 17, 2025) - ✅ COMPLETE
- **Surgical Update Implementation** (October 14, 2025) - ✅ COMPLETE
- **WB_DATA_FIX: Payment Modal** (October 18, 2025) - ✅ COMPLETE

## Estimated Effort

**Investigation:** 1 hour
- Code review: 30 minutes
- Test partial payment: 30 minutes

**Implementation (if needed):** 1-2 hours
- Integrate penalty recalculation: 1 hour
- Testing and verification: 1 hour

**Total:** 2-3 hours

## Dependencies

- Surgical Update System (Complete)
- Penalty Calculation Optimization (Complete)
- No blocking dependencies

## Priority Rationale

**HIGH Priority Because:**
- Affects financial accuracy (penalties)
- Impacts partial payment scenarios (common)
- Recently completed systems (surgical updates + penalty calc)
- Should be integrated if not already

## Next Steps

1. **Investigate:** Review `updateAggregatedDataAfterPayment()` code
2. **Test:** Record partial payment and verify penalty update
3. **Fix:** Integrate penalty recalculation if not present
4. **Verify:** Test all scenarios with proper penalty updates

---

**Created By:** Manager Agent  
**Date:** October 18, 2025  
**Priority:** HIGH (Financial accuracy impact)  
**Target:** Investigate immediately, fix if issue confirmed
