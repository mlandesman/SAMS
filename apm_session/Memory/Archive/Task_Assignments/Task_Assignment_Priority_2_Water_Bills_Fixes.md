# Task Assignment - Priority 2: Water Bills Fixes

**Date:** September 28, 2025  
**Priority:** HIGH - Production Issues  
**Estimated Effort:** 1-2 Implementation Agent sessions  
**Agent Type:** Implementation Agent

---

## Task Overview

Fix five specific issues affecting Water Bills functionality in production. These are targeted fixes to improve usability and data display accuracy.

**Business Context:**
- Water Bills system is operational for AVII client
- These fixes will improve user experience and data accuracy
- All fixes are relatively small but important for daily operations

---

## Task 2.1: Fix MonthData Consumption Display

### Issue
- **Location:** WaterBillsList.jsx:175
- **Problem:** Shows currentReading/priorReading but not consumption values
- **Root Cause:** Aggregator function not processing consumption data

### Requirements
1. Update aggregator to calculate and include consumption values
2. Display consumption in the MonthData section
3. Ensure consumption = currentReading - priorReading

### Acceptance Criteria
- [ ] Consumption values display correctly in WaterBillsList
- [ ] Calculation matches backend water bill consumption
- [ ] No regression in existing reading displays

**Effort:** 0.5 sessions

---

## Task 2.2: Change Due Date to Display Value

### Issue
- **Problem:** Due Date shows calendar picker instead of display value after bill generation
- **Expected:** Should be read-only display when bill record exists

### Requirements
1. Detect when bill has been generated
2. Switch from date picker to read-only display
3. Show formatted date value

### Acceptance Criteria
- [ ] Generated bills show due date as text, not picker
- [ ] Ungenerated bills still allow date selection
- [ ] Date format matches system standards

**Effort:** 0.25 sessions

---

## Task 2.3: Fix Reading Period to Prior Month

### Issue
- **Problem:** August 2025 readings should show "July 2025" period
- **Expected:** Display prior month for reading period

### Requirements
1. Update period display logic to show previous month
2. Ensure consistency across all water bills displays
3. Handle year boundaries correctly (Jan shows previous Dec)

### Acceptance Criteria
- [ ] Reading period shows prior month name
- [ ] Year transitions handled correctly
- [ ] All water bills views updated consistently

**Effort:** 0.25 sessions

---

## Task 2.4: Auto-Advance Readings Screen

### Issue
- **Problem:** Should advance to next available reading period automatically
- **Logic:** Last monthly readings file + 1 month

### Requirements
1. Find last readings entry in Firebase
2. Calculate next period (if last is 2026-01, show 2026-02)
3. Auto-select the calculated period on screen load

### Acceptance Criteria
- [ ] Screen loads with next reading period selected
- [ ] Handles missing months gracefully
- [ ] Manual override still available

**Effort:** 0.5 sessions

---

## Task 2.5: Auto-Advance Bills Screen

### Issue
- **Problem:** Should advance to last available reading period
- **Logic:** Show highest number monthly bill file

### Requirements
1. Find most recent bill in Firebase
2. Auto-select that period on screen load
3. If last bill is 2026-01, show 2026-01 (not advance)

### Acceptance Criteria
- [ ] Screen loads with most recent bill period selected
- [ ] Shows correct bill data immediately
- [ ] Manual period selection still works

**Effort:** 0.5 sessions

---

## Technical Notes

### Key Files to Modify
1. `/frontend/sams-ui/src/views/WaterBillsList.jsx` - Main display component
2. `/frontend/sams-ui/src/views/WaterBillsEntry.jsx` - Entry screen logic
3. `/backend/services/waterBillsAggregator.js` - Consumption calculation
4. Related Firebase query logic for finding last readings/bills

### Date Handling
- Use existing DateService and getNow() for consistency
- Follow CRITICAL_CODING_GUIDELINES.md Section 2
- Test timezone handling thoroughly

### Testing Approach
1. Test each fix independently
2. Verify no regressions in water bills functionality
3. Test with AVII client data
4. Check edge cases (year boundaries, missing data)

---

## Definition of Done
- [ ] All 5 issues fixed and tested
- [ ] No regressions in existing water bills functionality
- [ ] Code follows project conventions
- [ ] Manual testing completed with AVII data
- [ ] Memory Bank updated with implementation details

---

## Implementation Order (Recommended)
1. Fix consumption display (2.1) - Most visible issue
2. Fix auto-advance screens (2.4, 2.5) - Improve workflow
3. Fix reading period display (2.3) - Visual correction
4. Fix due date display (2.2) - Polish item

Start by investigating the water bills aggregator and display components to understand current data flow.