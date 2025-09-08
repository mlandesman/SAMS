# Test Checklist: DESK-TRANS-001 - Transaction Filter Fix

## Test Objective
Verify that the Desktop Transaction view defaults to "Current Month" instead of showing "All Time" while loading only current year data.

## Pre-Test Setup
1. Clear browser cache and localStorage
   - Open DevTools (F12)
   - Go to Application tab
   - Clear Local Storage for http://localhost:5173
   - OR in Console: `localStorage.clear()`

2. Ensure you have transactions in both:
   - Current month (January 2025)
   - Previous months/years

## Test Steps

### Test 1: Initial Load - Clean State
1. Navigate to http://localhost:5173
2. Login with your credentials
3. Navigate to Transactions view
4. **Verify:**
   - [ ] Filter button shows "Current Month" (not "All Time")
   - [ ] Only January 2025 transactions are displayed
   - [ ] Transaction count matches current month only

### Test 2: Filter Persistence
1. Change filter to "Year to Date"
2. Refresh the page (F5)
3. **Verify:**
   - [ ] Filter remains "Year to Date" after refresh
   - [ ] Correct transactions for 2025 are shown

### Test 3: All Filter Options
Test each filter option works correctly:

1. **Current Month**
   - [ ] Shows only January 2025 transactions
   - [ ] Label shows "Current Month"

2. **Previous Month** 
   - [ ] Shows only December 2024 transactions
   - [ ] Label shows "Previous Month"

3. **Year to Date**
   - [ ] Shows all 2025 transactions
   - [ ] Label shows "Year to Date"

4. **Previous Year**
   - [ ] Shows all 2024 transactions
   - [ ] Label shows "Previous Year"

5. **All Time**
   - [ ] Shows ALL transactions from all years
   - [ ] Label shows "All Time"

### Test 4: Performance
1. Clear localStorage again: `localStorage.clear()`
2. Navigate to Transactions
3. **Verify:**
   - [ ] Initial load is faster (loading only current month)
   - [ ] No lag or delay in displaying data

## Expected Results
- ✅ Default filter is "Current Month" on fresh load
- ✅ Only current month transactions display initially
- ✅ All filter options work correctly
- ✅ Filter selection persists across page refreshes
- ✅ No mismatch between filter label and displayed data

## How to Report Issues
If any test fails:
1. Note which step failed
2. Take a screenshot showing:
   - The filter button
   - The transaction dates
   - The browser console for any errors
3. Check console for errors: `F12` → Console tab

## Quick Console Commands

```javascript
// Check current filter in localStorage
localStorage.getItem('transactionFilter')

// Check if contexts are initialized properly
// In React DevTools, search for:
// - TransactionsContext
// - TransactionFiltersContext
// Look for currentFilter and currentDateRange values

// Force clear and reload
localStorage.clear(); location.reload()
```

## Success Criteria
The fix is successful when:
1. New users see "Current Month" by default
2. Only current month data loads initially (faster performance)
3. No confusion between filter label and displayed data
4. All other filters continue to work correctly