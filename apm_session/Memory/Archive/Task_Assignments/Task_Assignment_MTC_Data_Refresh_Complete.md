# Task Assignment - Complete MTC Data Refresh Using Web Import System

**Date:** October 2, 2025  
**Priority:** CRITICAL - Blocking All Development  
**Estimated Effort:** 1-2 Implementation Agent sessions  
**Agent Type:** Implementation Agent  
**Branch:** Use existing `web-based-import-system` branch  

---

## Task Overview

Execute a complete purge and import cycle for MTC client data using the newly fixed web-based import system. This is essential to restore clean, current MTC data before proceeding with any Implementation Plan priorities.

**Critical Dependencies:**
- All import system fixes have been completed
- Web-based import UI is functional
- Import service CrossRef logic is working
- Data structure issues have been resolved

**Blocking Impact:** No new features can be developed until MTC data is properly refreshed and verified working.

---

## Phase 1: Pre-Import Preparation (15 minutes)

### Task 1.1: Verify Import System Status

**Check these completed fixes:**
1. ✅ Year-end balance import data structure (fixed September 30)
2. ✅ Import CrossRef logic and controller usage (fixed September 30) 
3. ✅ Units import document path error (status needs verification)
4. ✅ Web-based import UI with progress tracking

**Verification Steps:**
- Confirm web import UI loads at Settings → Data Management
- Check that all import components show as available
- Verify MTC data path is correctly configured

### Task 1.2: Backup Current State

**Before any purge operations:**
1. Document current MTC data state in Firebase Console
2. Note any critical data that must be preserved
3. Verify production backup exists
4. Create snapshot of current `/clients/MTC/` collections

### Task 1.3: Prepare MTC Data Files

**Data Location:** `/MTCdata/` directory
**Required Files:**
- `Categories.json`
- `Vendors.json` 
- `Units.json`
- `Transactions.json`
- `HOADues.json`
- `YearEndBalances.json`
- `Users.json` (if available)

**Verification:**
- Confirm all files exist and are readable
- Check file sizes are reasonable (not empty)
- Verify JSON format is valid

---

## Phase 2: Execute Selective Purge (30 minutes)

### Task 2.1: Access Web Import System

**Navigation:**
1. Login as superadmin to SAMS
2. Navigate to Settings
3. Access "Data Management" tab (superadmin only)
4. Verify MTC client is selected

### Task 2.2: Selective Data Purge

**CRITICAL:** Use checkboxes to select components for purge

**Recommended Purge Order:**
1. ☑️ **HOA Dues** (first - has transaction dependencies)
2. ☑️ **Transactions** (second - referenced by other data)
3. ☑️ **Year End Balances** (safe to purge)
4. ☑️ **Categories** (safe to purge)
5. ☑️ **Vendors** (safe to purge)
6. ☑️ **Units** (last - referenced by transactions/HOA)

**DO NOT PURGE:**
- ☐ Users (preserve existing user accounts)

**Execution:**
1. Select components using checkboxes
2. Click "Execute Purge" 
3. Confirm destructive operation warning
4. Monitor progress display
5. Wait for completion status
6. Verify no errors in progress log

### Task 2.3: Verify Purge Success

**Check Firebase Console:**
- `/clients/MTC/categories` - should be empty
- `/clients/MTC/vendors` - should be empty  
- `/clients/MTC/units` - should be empty
- `/clients/MTC/transactions` - should be empty
- `/clients/MTC/hoaDues` - should be empty
- `/clients/MTC/yearEndBalances` - should be empty

**Users should remain intact**

---

## Phase 3: Execute Complete Import (45 minutes)

### Task 3.1: Import Data Components

**Import Order (CRITICAL - follow this sequence):**
1. ☑️ **Categories** (first - referenced by transactions)
2. ☑️ **Vendors** (second - referenced by transactions)  
3. ☑️ **Units** (third - referenced by transactions/HOA)
4. ☑️ **Year End Balances** (independent)
5. ☑️ **Transactions** (builds CrossRef for HOA)
6. ☑️ **HOA Dues** (last - uses CrossRef from transactions)

**Execution Steps:**
1. Select components using checkboxes in correct order
2. Verify data path shows `/MTCdata/`
3. Click "Execute Import"
4. Monitor real-time progress display
5. Watch for any error messages
6. Wait for completion status

### Task 3.2: Monitor Import Progress

**For each component, verify:**
- Status shows "completed" (not "error")
- Count shows reasonable number of records
- No error messages in progress log
- Time to completion is reasonable

**Expected Approximate Counts:**
- Categories: ~20-30 records
- Vendors: ~50-100 records
- Units: ~100-200 records (depends on MTC size)
- Transactions: ~1000+ records
- HOA Dues: ~1000+ records
- Year End Balances: ~1-3 records

### Task 3.3: Handle Any Import Errors

**If errors occur:**
1. Document exact error message
2. Note which component failed
3. Check if partial import occurred
4. Review error logs in progress display
5. Determine if retry is needed or if fix required

**Common Error Scenarios:**
- File not found → Check data path configuration
- JSON parse error → Verify file format
- Controller error → May need code fix
- Firebase permission → Check authentication

---

## Phase 4: Data Verification (30 minutes)

### Task 4.1: Firebase Console Verification

**Check each collection has data:**
- `/clients/MTC/categories` - Has category records
- `/clients/MTC/vendors` - Has vendor records
- `/clients/MTC/units` - Has unit records with proper structure
- `/clients/MTC/transactions` - Has transaction records with allocations
- `/clients/MTC/hoaDues` - Has HOA dues records with payments
- `/clients/MTC/yearEndBalances` - Has year-end balance records

**Spot Check Data Quality:**
- Units have proper unitId and names
- Transactions have proper dates and amounts
- HOA dues have proper payment arrays
- Year-end balances have accounts at root level (not in metadata)

### Task 4.2: CrossRef File Verification

**Check that CrossRef was generated:**
- Look for `/MTCdata/HOA_Transaction_CrossRef.json`
- Verify file contains transaction mappings
- Check bySequence and byUnit objects have data
- Confirm totalRecords count matches expectations

### Task 4.3: Application Functional Testing

**Test Core Functions:**
1. **Dashboard Loads** - No console errors, cards show data
2. **Transactions View** - Shows imported transactions
3. **HOA Dues View** - Shows dues records with payment status
4. **Unit Report** - Can generate report for test unit
5. **List Management** - Categories, vendors, units all show data

**Critical Tests:**
- Transaction filtering works
- HOA payment modal loads
- Unit selection works in dropdowns
- No console errors related to missing data

---

## Phase 5: Production Readiness (15 minutes)

### Task 5.1: Performance Check

**Verify acceptable performance:**
- Dashboard loads in < 5 seconds
- Transaction list loads in < 10 seconds
- HOA dues view loads in < 10 seconds
- No memory leaks or excessive API calls

### Task 5.2: Data Integrity Audit

**Run these checks:**
1. Transaction totals match expected amounts
2. HOA dues payment totals are reasonable
3. Unit count matches expected property count
4. No duplicate records in any collection
5. All required fields are populated

### Task 5.3: Create Completion Report

**Document:**
- Total records imported per component
- Any errors encountered and resolved
- Performance metrics
- Data integrity verification results
- Confirmation that application functions normally

---

## Acceptance Criteria

### Data Import Success
- [ ] All selected components imported without errors
- [ ] Record counts match expectations
- [ ] CrossRef file generated successfully
- [ ] No data corruption or missing fields

### Application Functionality
- [ ] Dashboard displays correct data
- [ ] All major views load without errors
- [ ] Transaction and HOA dues systems work
- [ ] No console errors related to data

### Performance and Quality
- [ ] Acceptable load times for all views
- [ ] Data integrity checks pass
- [ ] No duplicate or corrupted records
- [ ] System ready for feature development

---

## Definition of Done

✅ Complete MTC data refresh executed successfully  
✅ All application functions verified working  
✅ Performance acceptable for production use  
✅ Data integrity confirmed  
✅ System ready for Implementation Plan priorities  
✅ Completion report documenting results  

---

## Critical Success Factors

1. **Follow Import Order**: Categories → Vendors → Units → YearEnd → Transactions → HOA
2. **Monitor Progress**: Watch for errors during each import phase
3. **Verify Data Structure**: Ensure imported data matches expected format
4. **Test Application**: Confirm all major functions work with fresh data
5. **Document Results**: Create clear completion report

---

## Memory Log Location

Create completion log at:
`/apm_session/Memory/Task_Completion_Logs/MTC_Data_Refresh_Complete_[timestamp].md`

Include:
- Import execution results for each component
- Any errors encountered and how resolved
- Data verification results
- Application functionality test results
- Performance metrics
- Confirmation system is ready for feature development

---

## Next Steps After Completion

Once MTC data refresh is complete and verified:
1. Update Implementation Plan status
2. Proceed with Priority 3: HOA Dues Quarterly Collection
3. Consider parallel development of other unblocked features
4. Archive this task as completed

This data refresh is the critical foundation for all future development work.

