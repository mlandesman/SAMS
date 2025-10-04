# Task Assignment - Fix Import Data Structure Mapping

**Date:** September 30, 2025  
**Priority:** HIGH - Blocking Production Use  
**Estimated Effort:** 0.5-1 Implementation Agent session  
**Agent Type:** Implementation Agent  
**Branch:** Use existing `web-based-import-system` branch  

---

## Task Overview

Fix the critical data structure issues in the year-end balance import function. The import currently:
1. Creates an empty accounts array at root level
2. Buries the actual account data in `metadata.originalData.accounts`
3. Adds tons of unnecessary fields

**Impact:** Without this fix, the web-based import system cannot be used in production as it creates unusable year-end balance documents.

---

## The Problem

### Current (Incorrect) Import Creates:
```javascript
{
  "_id": "2024",
  "accounts": [],  // EMPTY! Actual data is buried in metadata
  "createdAt": { "_seconds": 1759203773, "_nanoseconds": 0 },
  "createdBy": "michael@landesman.com",
  "clientId": "MTC",
  "fiscalYear": 2024,
  "date": "2024-12-31",
  "totals": { "assets": 0, "liabilities": 0, "equity": 0, "netPosition": 0 },
  "metadata": {
    "source": "import",
    "importDate": "2025-09-30T03:42:53.148Z",
    "originalData": {
      "year": 2024,
      "date": "2024-12-31",
      "accounts": [  // ACTUAL DATA BURIED HERE!
        { "id": "bank-001", "name": "MTC Bank", "balance": 16408800 },
        { "id": "cash-001", "name": "Cash", "balance": 500000 }
      ]
    },
    // ... more nested junk
  }
}
```

### Application Expects (from AVII working example):
```javascript
{
  "_id": "2025",
  "year": 2025,
  "date": { "_seconds": 1751241600, "_nanoseconds": 0 },
  "accounts": [  // Accounts at ROOT level
    { "id": "bank-001", "name": "Scotiabank", "balance": 5140200 },
    { "id": "cash-001", "name": "Petty Cash", "balance": 0 }
  ],
  "created": { "_seconds": 1754509995, "_nanoseconds": 142000000 },
  "createdBy": "import-script"
}
```

---

## Required Changes

### 1. Fix importYearEndBalances Function

**File:** `/backend/services/importService.js`

The current implementation is completely wrong. It needs a full rewrite to create the correct structure:

```javascript
async importYearEndBalances() {
  const data = await this.loadJsonFile('YearEndBalances.json');
  const results = { success: 0, failed: 0, errors: [] };
  
  for (const yearData of data) {
    try {
      // Create ONLY the required fields - no metadata, no totals, no garbage
      const transformedData = {
        year: yearData.year,
        date: this.dateService.parseFromFrontend(yearData.date, 'M/d/yyyy'),
        created: getNow(),
        createdBy: 'import-script',
        accounts: yearData.accounts.map(account => ({
          id: account.id,
          name: account.name,
          balance: account.balance
        }))
      };
      
      // Save to correct path
      const yearDocRef = this.db
        .collection('clients').doc(this.clientId)
        .collection('yearEndBalances').doc(yearData.year.toString());
        
      await yearDocRef.set(transformedData);
      
      await this.auditLog.log('yearEndBalance.import', {
        clientId: this.clientId,
        year: yearData.year,
        accountCount: transformedData.accounts.length
      });
      
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Year ${yearData.year}: ${error.message}`);
    }
  }
  
  return results;
}
```

**Key Points:**
- NO metadata object
- NO totals object
- NO clientId, fiscalYear, or other extra fields
- Accounts array at ROOT level, not nested
- Use 'import-script' for createdBy, not user email

### 2. Clean Up Existing Bad Data

Before testing the fix, delete the incorrectly imported year-end balance data:

1. Check Firestore for `/clients/MTC/yearEndBalances/2024` 
2. Delete this document - it has empty accounts array with data buried in metadata
3. Also check for any other years that may have been imported incorrectly
4. Document which documents were deleted

### 3. Test Other Import Functions

Review and test these import functions for similar issues:
- `importCategories()`
- `importVendors()` 
- `importUsers()`
- `importUnits()`

Ensure they all create the correct data structures expected by the application.

---

## Testing Requirements

1. **Dry Run First**: Test with dry run mode enabled
2. **Structure Validation**: Verify the imported structure matches exactly
3. **Application Testing**: Ensure the application can read the imported data
4. **No Extra Fields**: Confirm only required fields are imported

### Test Data Location
Use MTC client data at: `/MTCdata/YearEndBalances.json`

### Verification Steps:
1. Run import with dry run
2. Check Firestore structure in Firebase Console
3. Test application features that use year-end balances
4. Verify no console errors

---

## Acceptance Criteria

- [ ] Year-end balance import creates correct array structure
- [ ] Only required fields are included (id, name, balance)
- [ ] Top-level fields match expected format
- [ ] Existing bad data cleaned up
- [ ] Other import functions verified/fixed
- [ ] Application successfully reads imported data
- [ ] No console errors when accessing year-end balances

---

## Definition of Done

✅ Import creates exact structure expected by application  
✅ All test data imports successfully  
✅ Application features using year-end balances work correctly  
✅ Memory log documenting changes and test results  

---

## Code Quality Requirements

- Follow CRITICAL_CODING_GUIDELINES.md
- Use DateService for all date operations
- No hardcoded values
- Proper error handling
- Clear comments explaining the transformation

---

## Memory Log Location

Create your completion log at:
`/apm_session/Memory/Phase_Import_Tools_Modernization/Fix_Import_Data_Structure_Complete_[timestamp].md`

Include:
- Exact changes made to fix the issue
- Test results showing correct structure
- List of any other import functions that needed fixes
- Confirmation that application works with imported data