---
agent_type: Implementation
agent_id: Agent_Import_Fixes_1
handover_number: 1
last_completed_task: Fix Import System Critical Issues - Step 3 Complete, Discovered Additional Issue
---

# Implementation Agent Handover File - Import Fixes

## MANDATORY: Current TODO List (COMPLETE)

### ✅ COMPLETED TODOS:
1. ✅ **Step 1: Fix Missing getNow Import** - COMPLETE
   - Added getNow import to importService.js
   - Fixed 5 additional date violations (new Date(), Date.now())
   - Implemented client config caching for fiscal year support
   - Fixed hardcoded '2025-01-01' to use dynamic fiscal year start

2. ✅ **Step 2: Add Progress Tracking to Onboarding** - COMPLETE
   - Added startProgressPolling flag to ClientSwitchModal.jsx
   - Implemented inline polling in ImportManagement.jsx useEffect
   - Progress bars now appear immediately during onboarding

3. ✅ **Step 3: Add Pre-Import File Validation** - COMPLETE
   - Created validateRequiredFiles() in ImportFileUploader.jsx
   - Added frontend validation in ClientSwitchModal.jsx
   - Added backend validation in importService.js
   - Fixed case-insensitive file validation (Config.json vs config.json)

4. ✅ **Memory Log Created** - COMPLETE
   - Location: apm_session/Memory/Task_Completion_Logs/Fix_Import_System_Critical_Issues_2025-10-07.md
   - Documented all 3 steps plus additional fixes

### 🔴 CURRENT BLOCKER - NEW ISSUE DISCOVERED:
**Account Mapping System is Hardcoded for MTC Client**

**Problem:** During AVII import testing, discovered "No account mapping for: Scotiabank" errors. Investigation revealed the account mapping system in `/backend/utils/data-augmentation-utils.js` has hardcoded MTC-specific mappings and clientId values throughout.

**Root Cause:**
- File: `/backend/utils/data-augmentation-utils.js`
- Functions named `augmentMTCTransaction`, `augmentMTCUnit`, `augmentMTCCategory`, etc.
- Hardcoded `clientId: 'MTC'` in 5+ locations (lines 121, 135, 229, 293, 309)
- Uses hardcoded `MTC_ACCOUNT_MAPPING` instead of dynamic client account data
- Variable names use `mtcTransaction` instead of generic `transactionData`

**What Works:**
- `importService.js` line 654 already calls `getAccountsMapping()` which loads accounts dynamically from client data
- `importService.js` line 687 correctly extracts accountId: `accountMap[transaction.Account]?.id`
- The account mapping IS being loaded correctly from Client.json

**What's Broken:**
- `augmentMTCTransaction()` (line 158-241) doesn't receive the accountMap parameter
- It calls hardcoded `getMTCImportMapping()` which only has MTC Bank and Cash Account
- Line 694 in importService.js calls augmentMTCTransaction but doesn't pass accountMap

**Impact:**
- MTC imports work (hardcoded mapping matches their data)
- AVII imports fail (Scotiabank not in hardcoded mapping)
- Any new client will fail unless they have identical account names to MTC

### 🎯 NEXT STEPS TO COMPLETE:

**Phase 1: Make Account Mapping Data-Driven (IN PROGRESS)**
1. ⏳ Fix `augmentTransaction()` function signature to accept accountMap parameter
2. ⏳ Update importService.js line 694 to pass accountMap to augmentTransaction
3. ⏳ Remove hardcoded MTC_ACCOUNT_MAPPING fallback logic
4. ⏳ Test with AVII data to verify Scotiabank mapping works

**Phase 2: Remove All MTC Hardcoding**
1. ⏳ Rename all functions: augmentMTCTransaction → augmentTransaction, etc.
2. ⏳ Add clientId parameter to all augment functions
3. ⏳ Replace all `clientId: 'MTC'` with passed clientId parameter
4. ⏳ Fix variable names: mtcTransaction → transactionData throughout
5. ⏳ Update comments and logging to be generic

**Phase 3: Fix Fiscal Year Issues**
1. ⏳ Fix line 838 in importService.js: Use getFiscalYear() instead of getFullYear()
2. ⏳ Add documentation: HOADues.json contains ONLY current fiscal year (months 1-12)
3. ⏳ Fix line 237 in data-augmentation-utils.js: new Date() → getNow()
4. ⏳ Test with AVII fiscal year data (FY 2026 = July 2025 - June 2026)

**Phase 4: Testing & Validation**
1. ⏳ Test MTC import (ensure no regression)
2. ⏳ Test AVII import (verify Scotiabank account mapping works)
3. ⏳ Verify fiscal year calculations for AVII
4. ⏳ Update Memory Log with final results

## Active Memory Context

**User Preferences:**
- Michael prefers data-driven, generic solutions over hardcoded client-specific code
- Expects agents to challenge assumptions and ask clarifying questions
- Wants complete testing with real data before claiming success
- Values collaborative discussion over immediate implementation
- Requires documented proof of fixes, not just code review

**Working Insights:**
- Previous agent hardcoded MTC-specific logic that should have been data-driven
- The system was originally designed to be data-driven (getAccountsMapping exists)
- Import sequence is critical: client → config → accounts → transactions
- Client config caching pattern works well for avoiding repeated DB calls
- Case-insensitive file handling already exists via findFileCaseInsensitive()

## Task Execution Context

**Working Environment:**

**Key Files Modified:**
1. `/backend/services/importService.js` - Main import orchestration
   - Line 9-11: Added imports (DateTime, getNow, fiscal year utils)
   - Line 48: Added clientConfigCache
   - Lines 55-76: Added getClientConfig() helper
   - Lines 260-270: Cache client config after import
   - Line 694: Calls augmentMTCTransaction (needs accountMap parameter added)
   - Line 838: Uses getFullYear() - needs getFiscalYear() fix
   - Lines 1570-1602: Added validateRequiredFiles()
   - Lines 1610-1616: Call validation before import

2. `/backend/utils/data-augmentation-utils.js` - Data transformation (NEEDS REFACTORING)
   - Line 158: augmentTransaction function (renamed, needs completion)
   - Line 160: Still references mtcTransaction (should be transactionData)
   - Lines 163-174: Account mapping logic (partially updated)
   - Line 229: Hardcoded clientId: 'MTC' (needs parameter)
   - Line 237: Uses new Date() instead of getNow()
   - Line 349: Uses getFullYear() for HOA dues year
   - All augmentMTC* functions need renaming and clientId parameter

3. `/frontend/sams-ui/src/components/ClientSwitchModal.jsx`
   - Line 12: Import validateRequiredImportFiles
   - Lines 139-146: Added file validation before onboarding
   - Line 168: Added startProgressPolling flag

4. `/frontend/sams-ui/src/components/Settings/ImportManagement.jsx`
   - Lines 60-91: Inline progress polling implementation

5. `/frontend/sams-ui/src/components/ImportFileUploader.jsx`
   - Lines 33-60: validateRequiredFiles internal function
   - Lines 240-267: Exported validateRequiredImportFiles

**Critical Code Patterns:**
```javascript
// Client config caching pattern (WORKING)
const clientConfig = await this.getClientConfig();
const fiscalYearStartMonth = validateFiscalYearConfig(clientConfig);

// Account mapping pattern (WORKING in importService)
const accountMap = await this.getAccountsMapping();
const accountId = accountMap[transaction.Account]?.id;

// Fiscal year calculation (NEEDS TO BE USED)
const year = getFiscalYear(getNow(), fiscalYearStartMonth);

// Fiscal year bounds (WORKING)
const { startDate } = getFiscalYearBounds(year, fiscalYearStartMonth);
```

**Issues Identified:**
- ✅ RESOLVED: Missing getNow import
- ✅ RESOLVED: Silent onboarding progress
- ✅ RESOLVED: No file validation
- ✅ RESOLVED: Case-insensitive file names
- ✅ RESOLVED: Progress polling function scope issue
- 🔴 ACTIVE: Hardcoded MTC account mapping
- 🔴 ACTIVE: Hardcoded clientId throughout data-augmentation-utils.js
- 🔴 ACTIVE: Fiscal year calculation uses getFullYear() instead of getFiscalYear()

## Current Context

**Recent User Directives:**
1. "NO function should have MTC in the name or hardcoded" - Make everything data-driven
2. "We have the actual clientId so there is no need to hardcode it" - Pass as parameter
3. "HOADues.json contains ONLY the current fiscal year (months 1-12)" - Document this assumption
4. "Month numbers (1-12) are fiscal months, not calendar months" - Offset applied elsewhere
5. "AVII is Fiscal Year 2026 already (started July 2025)" - Current year calculation must use fiscal year

**Working State:**
- All Step 1-3 code changes accepted and deployed
- Memory Log completed and saved
- Discovered new blocker during AVII testing
- Mid-analysis of account mapping system
- Ready to implement data-driven account mapping fix

**Task Execution Insights:**
- Import sequence ensures client/config are loaded before transactions
- Client config caching prevents repeated DB calls
- Dynamic account mapping already exists but isn't being used
- The hardcoded MTC logic was added by a previous agent (should have been generic)
- Fiscal year vs calendar year distinction is critical for AVII and future clients

## Working Notes

**Development Patterns:**
- Always use getNow() from DateService, never new Date()
- Use getFiscalYear() for year calculations, not getFullYear()
- Cache client config once, reuse throughout import
- Pass dynamic data (accountMap, clientId) as parameters, don't hardcode
- Validate at both frontend (before upload) and backend (before import)

**Environment Setup:**
- Backend: `/backend/services/importService.js` - Main import orchestration
- Backend: `/backend/utils/data-augmentation-utils.js` - Data transformation (needs refactoring)
- Backend: `/backend/utils/accountMapping.js` - Has hardcoded MTC mappings (not used correctly)
- Frontend: `/frontend/sams-ui/src/components/` - Import UI components
- Test data: Firebase Storage `/imports/MTC/` and `/imports/AVII/`

**User Interaction:**
- Michael stops agents when they're about to implement wrong solutions
- Prefers discussion and validation before coding
- Values understanding the "why" behind design decisions
- Expects agents to trace through code to understand data flow
- Wants complete picture before refactoring (don't rush to fix)

**Critical Discovery:**
The data-augmentation-utils.js file header says "Enhanced Data Augmentation Utilities for MTC Migration" (line 2) and "Task ID: MTC-MIGRATION-001" (line 7). This was clearly written for MTC-specific migration and was never generalized for other clients. The entire file needs to be refactored to be client-agnostic.

**Fiscal Year Context:**
- MTC: Calendar year (January - December)
- AVII: Fiscal year (July - June), FY named by ending year
- FY 2026 = July 2025 through June 2026
- HOADues.json contains only current fiscal year (12 months)
- Month numbers in data are fiscal months (1-12), offset applied by system
- Import happening in January 2026 should detect FY 2026 for AVII

**Account Mapping Flow:**
1. Client.json has accounts array with {id, name, type}
2. importClient() writes to Firestore clients/{clientId}
3. getAccountsMapping() reads from Firestore, builds {name: {id, name, type}}
4. importTransactions() gets accountMap, extracts accountId
5. augmentTransaction() should receive accountMap but currently doesn't
6. Result: Falls back to hardcoded MTC_ACCOUNT_MAPPING which fails for AVII
