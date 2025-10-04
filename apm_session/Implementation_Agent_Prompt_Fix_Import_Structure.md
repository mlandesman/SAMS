# Implementation Agent Task - Fix Import Data Structure

**Manager Agent:** Manager_6  
**Task Type:** Bug Fix - Critical  
**Priority:** HIGH - Blocking Production  
**Branch:** Continue on `web-based-import-system`  
**Estimated Time:** 0.5-1 hour  

---

## Urgent Fix Required

The web-based import system is complete but cannot be used in production due to major data structure problems in the year-end balance import. You need to fix this immediately so we can refresh data before proceeding with new features.

## The Bug

The `importYearEndBalances` function in `/backend/services/importService.js` creates a completely unusable data structure:

**Currently Creates (WRONG - see scripts/2024.json):**
```javascript
{
  "accounts": [],  // EMPTY ARRAY!
  "metadata": {
    "originalData": {
      "accounts": [  // Real data buried here!
        { "id": "bank-001", "name": "MTC Bank", "balance": 16408800 }
      ]
    }
  },
  // Plus tons of garbage fields
}
```

**Must Create (CORRECT - see scripts/2025.json):**
```javascript
{
  "year": 2025,
  "date": { "_seconds": 1751241600, "_nanoseconds": 0 },
  "accounts": [  // At root level!
    { "id": "bank-001", "name": "Scotiabank", "balance": 5140200 }
  ],
  "created": { "_seconds": 1754509995, "_nanoseconds": 142000000 },
  "createdBy": "import-script"
}
```

## Your Tasks

1. **Read Full Requirements**: `/apm_session/Task_Assignment_Fix_Import_Data_Structure.md`
2. **Fix the Import Function**: Transform data to match expected structure
3. **Clean Bad Data**: Delete any incorrectly imported year-end balances
4. **Test Thoroughly**: Verify application can read the data
5. **Check Other Imports**: Quick review of other import functions

## Critical Points

- The `accounts` array must be at ROOT level, not nested in metadata
- Remove ALL unnecessary fields (metadata, totals, clientId, fiscalYear, etc.)
- Only include: year, date, accounts, created, createdBy
- Use 'import-script' for createdBy, not user email
- Compare with working AVII structure in `scripts/2025.json`
- Test with MTC data at `/MTCdata/YearEndBalances.json`

## Success Criteria

✅ Import creates exact array structure  
✅ Application reads year-end balances without errors  
✅ Clean up any bad data in Firestore  
✅ Document any other import functions that need fixes  

## Why This Is Urgent

We cannot proceed with:
- Data refresh for new features
- HOA Quarterly Collection development  
- Any production imports

Until this structure issue is fixed.

Please fix this immediately and report back with test results.

---

**Questions?** The issue is well-documented in the previous completion log. Focus on the transformation logic to convert the import data to the exact structure the application expects.