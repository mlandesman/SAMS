# Task Assignment: Remove duesDistribution Legacy Code

**Task Type:** Code Cleanup - Remove Legacy Support
**Priority:** HIGH - Do this BEFORE import fixes to avoid confusion
**Assigned Agent Type:** Implementation Agent
**Estimated Sessions:** 1 (quick cleanup)

## Background

The `duesDistribution` field is legacy code that was replaced by the generic `allocations` array. Since we're reloading all data fresh into the system, we can remove this legacy support entirely. This will simplify the codebase and prevent confusion during the import fixes.

## Objective

Remove all `duesDistribution` legacy code from the system, leaving only the modern `allocations` array approach.

## Files to Modify

### 1. Transaction Schema
**File:** `/backend/schemas/transactionSchema.js`
- **Action:** Remove the `duesDistribution` field definition (lines ~147-151)

### 2. HOA Dues Controller  
**File:** `/backend/controllers/hoaDuesController.js`
- **Action:** Remove the code that creates `duesDistribution` (lines ~620-630)
- **Look for:** Comment "// Maintain backward compatibility - preserve original duesDistribution"
- **Keep:** Only the `allocations` array logic

### 3. Transactions Controller
**File:** `/backend/controllers/transactionsController.js`
- **Action:** Update `getHOAMonthsFromTransaction()` function (lines ~997-1005)
- **Remove:** The fallback logic that reads `duesDistribution`
- **Keep:** Only read from `allocations` array

### 4. Any Validation/Test Scripts
- **Search for:** Any other occurrences of `duesDistribution` in test files
- **Update:** Remove or update tests to only use `allocations`

## Implementation Steps

1. **Start with Schema** - Remove field definition
2. **Update Read Logic** - Fix `getHOAMonthsFromTransaction()` to only use `allocations`
3. **Remove Write Logic** - Clean up HOA controller to stop creating this field
4. **Test** - Ensure HOA payments still work correctly with only `allocations`

## Success Criteria

- No references to `duesDistribution` remain in active code
- HOA payment recording uses only `allocations` array
- Transaction queries only look at `allocations` for payment distribution
- All HOA functionality works correctly after removal

## Important Notes

- This is a BREAKING CHANGE for any existing data with only `duesDistribution`
- Since we're reloading all data, this is not a concern
- The import process will create proper `allocations` arrays
- This simplifies the upcoming import fixes by having only one pattern

## Testing

After removal, test:
1. Create an HOA payment via the UI
2. Verify it creates proper `allocations` array
3. Verify NO `duesDistribution` field is created
4. Confirm payment displays correctly in the UI

This cleanup will make the import process clearer and prevent any confusion about which field to populate.