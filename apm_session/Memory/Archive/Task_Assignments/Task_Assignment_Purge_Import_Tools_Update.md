# Task Assignment - Purge and Import Tools Update

**Date:** September 29, 2025  
**Priority:** HIGH - Infrastructure Update  
**Estimated Effort:** 3-4 Implementation Agent sessions  
**Agent Type:** Implementation Agent
**Branch:** Create new branch `update-purge-import-tools`

---

## Task Overview

Update the existing purge and import tools to work with the new data structures, API endpoints, and timezone-aware date handling. These tools are critical for development environment management and client onboarding, but currently use outdated patterns that bypass our controller infrastructure.

**Business Context:**
- Purge tools clean development/staging environments for fresh testing
- Import tools onboard new clients and migrate data
- Current tools bypass controllers and don't handle timezones properly
- HOA Dues to Transaction cross-references need verification

---

## Phase 1: Analysis and Review (0.5 sessions)

### Task 1.1: Review Current Tool State

**Examine these existing files:**
1. `/scripts/purge-dev-complete.cjs` - Main purge script (CommonJS)
2. `/scripts/client-onboarding/IMPORT_GUIDE.md` - Import documentation
3. `/scripts/client-onboarding/README.md` - Onboarding guide
4. `/scripts/client-onboarding/run-complete-import.sh` - Import orchestrator
5. `/scripts/client-onboarding/*.js` - Any existing import scripts

### Task 1.2: Document Current Issues

Create a report identifying:
- Scripts using direct Firestore operations (bypassing controllers)
- Date handling without timezone awareness
- Missing scripts referenced but not implemented
- HOA Dues/Transaction relationship handling
- CommonJS vs ES module inconsistencies

### Acceptance Criteria - Phase 1
- [ ] Complete analysis report created
- [ ] All existing tools reviewed and documented
- [ ] Issues list compiled with specific examples
- [ ] HOA/Transaction relationship flow documented

---

## Phase 2: Purge Tool Modernization (1 session)

### Task 2.1: Convert purge-dev-complete.cjs to ES Module

**Current Issues:**
- Uses CommonJS (`require()`) instead of ES modules
- Direct Firestore operations bypass controllers
- No timezone handling for dates
- Hardcoded collection paths

**Required Updates:**
1. Convert to ES module syntax (`import`/`export`)
2. Add DateService for all date operations
3. Use controllers where available (transactions, HOA dues)
4. Add configuration for collection paths
5. Improve error handling and logging

**Template Structure:**
```javascript
// New purge-dev-complete.js
import { DateService, getNow } from '../backend/services/DateService.js';
import transactionsController from '../backend/controllers/transactionsController.js';
import hoaDuesController from '../backend/controllers/hoaDuesController.js';
// ... other imports

// Use controllers for data operations where available
// Only use direct Firestore for collections without controllers
```

### Task 2.2: Verify and Enhance Safety Features

**Current Features (Already Implemented):**
- ✅ Environment check (lines 57-63)
- ✅ Safety warnings and confirmation prompt
- ✅ Requires typing "PURGE DEV" exactly
- ✅ 10-second countdown before execution
- ✅ Pre and post purge reports

**Additional Enhancements Needed:**
1. Add dry-run mode flag (--dry-run)
2. Add backup metadata export before purge
3. Improve environment detection to check Firebase project ID
4. Add option to exclude additional collections
5. Add verbose logging mode

### Acceptance Criteria - Phase 2
- [ ] Purge script converted to ES modules
- [ ] DateService integrated for all dates
- [ ] Controllers used where available
- [ ] Safety features implemented
- [ ] Script tested in dev environment

---

## Phase 3: Import Tools Modernization (1.5 sessions)

### Task 3.1: Create Missing Import Scripts

**Scripts Referenced in run-complete-import.sh but Missing:**

Modern Approach (Lines 114-143):
1. `setup-client-config.js` - MISSING (needs creation)
2. `import-client-from-json.js` - MISSING (needs creation)
3. `import-yearend-balances.js` - MISSING (needs creation) 
4. `import-client-data.js` - MISSING (needs creation)

Legacy Approach (Lines 146-208):
1. `create-mtc-client.js` - MISSING (needs creation)
2. `create-default-accounts.js` - EXISTS ✓
3. `import-yearend-balances.js` - MISSING (same as above)
4. `import-payment-methods-with-crud.js` - MISSING (needs creation)
5. `import-categories-vendors-with-crud.js` - MISSING (needs creation)
6. `import-units-with-crud-refactored.js` - MISSING (needs creation)
7. `import-transactions-with-crud-refactored.js` - MISSING (needs creation)
8. `import-hoa-dues-with-crud-refactored.js` - MISSING (needs creation)
9. `import-users-with-crud.js` - MISSING (needs creation)

Validation:
1. `validate-import.js` - MISSING (needs creation)

**Priority:** Focus on Modern Approach scripts first

### Task 3.2: Update Existing Import Scripts

**Common Updates Required:**
1. Replace timestamp utilities with DateService
2. Use controllers instead of direct Firestore
3. Add transaction ID generation
4. Preserve timezone information
5. Handle HOA/Transaction relationships properly

**Import Script Template:**
```javascript
// Template for import scripts
import { DateService, getNow } from '../../backend/services/DateService.js';
import { generateTransactionId } from '../../backend/utils/transactionIdGenerator.js';
import hoaDuesController from '../../backend/controllers/hoaDuesController.js';

// Parse dates properly
const dateService = new DateService({ timezone: 'America/Cancun' });
const parsedDate = dateService.parseFromFrontend(dateString, 'yyyy-MM-dd');

// Generate IDs for transactions
const transactionId = generateTransactionId(clientId, parsedDate);

// Use controllers for data operations
await hoaDuesController.createDuesRecord(req, res);
```

### Task 3.3: Verify HOA Dues to Transaction Relationships

**Critical Requirement from Michael:**
"Review this process to see if it handles the HOA Dues cross-reference to Transactions properly"

**Analysis Required:**
1. Check how HOA_Transaction_CrossRef.json is generated (line 231)
2. Verify linking logic in import-hoa-dues scripts
3. Ensure transaction IDs are properly referenced in HOA dues
4. Test that payment deletions update HOA dues correctly
5. Validate credit balance calculations

### Task 3.4: Update run-complete-import.sh

**Requirements:**
1. Check for script existence before running
2. Add progress indicators (already has some)
3. Implement rollback capability
4. Add verification step after each import
5. Generate import summary report

### Acceptance Criteria - Phase 3
- [ ] All missing import scripts created
- [ ] Existing scripts updated to modern patterns
- [ ] DateService used throughout
- [ ] Controllers used instead of direct Firestore
- [ ] HOA/Transaction relationships preserved
- [ ] Import orchestrator updated and tested

---

## Phase 4: Integration and Testing (1 session)

### Task 4.1: Create Test Data Set

**Requirements:**
1. Sample client configuration
2. Units with various credit balances
3. HOA dues with payments (testing relationships)
4. Transactions with proper IDs
5. Water bills with readings

### Task 4.2: End-to-End Testing

**Test Sequence:**
1. Run purge on test environment
2. Verify complete data removal
3. Run import with test data
4. Verify all relationships intact
5. Check timezone preservation
6. Validate transaction IDs

### Task 4.3: Documentation Update

**Update these documents:**
1. `/scripts/client-onboarding/IMPORT_GUIDE.md` - Modern examples
2. `/scripts/client-onboarding/README.md` - New workflow
3. Create `/scripts/PURGE_IMPORT_GUIDE.md` - Comprehensive guide

### Acceptance Criteria - Phase 4
- [ ] Test data set created and documented
- [ ] Full purge/import cycle tested
- [ ] All relationships verified working
- [ ] Documentation updated
- [ ] No data corruption or timezone issues

---

## Technical Guidelines

### CRITICAL: Date Handling
```javascript
// NEVER use new Date()
import { DateService, getNow } from '../backend/services/DateService.js';

// For current timestamps
const now = getNow();

// For parsing dates
const dateService = new DateService({ timezone: 'America/Cancun' });
const timestamp = dateService.parseFromFrontend('2025-09-29', 'yyyy-MM-dd');

// For formatting
const formatted = dateService.formatForFrontend(timestamp);
```

### Controller Usage
```javascript
// DON'T: Direct Firestore
await db.collection('clients').doc(clientId).collection('hoadues').add(data);

// DO: Use controllers
const req = { 
  params: { clientId }, 
  body: duesData,
  user: { uid: 'import-script' }
};
const res = {
  status: (code) => ({ json: (data) => data }),
  json: (data) => data
};
await hoaDuesController.createDuesRecord(req, res);
```

### Transaction ID Generation
```javascript
import { generateTransactionId } from '../backend/utils/transactionIdGenerator.js';

// Generate consistent IDs
const transactionId = generateTransactionId(clientId, dateObject);
```

---

## Definition of Done

### Core Requirements
- [ ] All scripts converted to ES modules
- [ ] DateService used for all date operations
- [ ] Controllers used instead of direct Firestore
- [ ] Transaction IDs generated properly
- [ ] HOA/Transaction relationships preserved

### Quality Requirements
- [ ] No hardcoded dates or timezones
- [ ] Comprehensive error handling
- [ ] Progress logging implemented
- [ ] Safety checks in place
- [ ] Documentation updated

### Testing Requirements
- [ ] Purge tested in dev environment
- [ ] Import tested with sample data
- [ ] Relationships verified intact
- [ ] Timezone handling confirmed
- [ ] No data corruption

---

## Implementation Order

1. **Phase 1**: Analysis (understand current state)
2. **Phase 2**: Update purge tool (simpler, standalone)
3. **Phase 3**: Update import tools (complex, interdependent)
4. **Phase 4**: Integration testing (verify everything works)

---

## Success Metrics

- Zero data corruption during purge/import cycles
- All dates maintain correct timezone (America/Cancun)
- HOA Dues properly linked to Transactions
- Transaction IDs follow standard format
- Scripts run without manual intervention
- Clear documentation for future maintenance

Start with Phase 1 analysis to understand the full scope before making changes.