# Task Assignment - Import Tools Modernization

**Date:** September 29, 2025  
**Priority:** HIGH - Critical Infrastructure  
**Estimated Effort:** 4-5 Implementation Agent sessions  
**Agent Type:** Implementation Agent
**Branch:** Create new branch `modernize-import-tools`

---

## Task Overview

Document the logic of existing import scripts and create new modern versions that work with current SAMS architecture. The old scripts use direct Firebase SDK calls and outdated patterns. We need to preserve the business logic while updating to use controllers, DateService, and proper authentication.

**Strategy:**
1. Keep original scripts safe (add `.backup` suffix)
2. Document existing logic flow
3. Build new versions starting with simple scripts
4. Leave complex Transaction/HOA scripts for last
5. Skip setup-client-config and payment-methods (static data preserved)

---

## Phase 1: Document and Backup (0.5 sessions)

### Task 1.1: Backup Existing Import Scripts

**Create backup copies:**
```bash
cd /scripts/client-onboarding/
cp import-categories-vendors-with-crud.js import-categories-vendors-with-crud.js.backup
cp import-units-with-crud.js import-units-with-crud.js.backup
cp import-transactions-with-crud.js import-transactions-with-crud.js.backup
cp import-users-with-crud.js import-users-with-crud.js.backup
cp import-yearend-balances.js import-yearend-balances.js.backup
```

### Task 1.2: Document Existing Logic Flow

Create documentation file: `/scripts/client-onboarding/IMPORT_LOGIC_DOCUMENTATION.md`

For each script, document:
1. Purpose and data flow
2. Input data structure (from MTCdata)
3. Transformation logic
4. Output structure
5. Special business rules
6. Dependencies

### Acceptance Criteria - Phase 1
- [ ] All scripts backed up with `.backup` suffix
- [ ] Logic documentation created
- [ ] Business rules clearly identified
- [ ] Data transformations documented

---

## Phase 2: Modernize Simple Import Scripts (1.5 sessions)

### Task 2.1: Create Modern Import Utilities

**Create shared utilities file:** `import-utils-modern.js`

```javascript
// Template structure
import { DateService, getNow } from '../../backend/services/DateService.js';

// Create mock req/res for controllers
export function createMockContext(clientId, userId = 'import-script') {
  return {
    req: {
      params: { clientId },
      body: {},
      user: { uid: userId },
      headers: {},
      get: () => null
    },
    res: {
      status: (code) => ({
        json: (data) => data,
        send: (data) => data
      }),
      json: (data) => data,
      send: (data) => data
    }
  };
}

// Standard import logging
export function logImportProgress(message, data = null) {
  console.log(`[IMPORT] ${new Date().toISOString()} - ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}
```

### Task 2.2: Modernize Categories & Vendors Import

**Create new file:** `import-categories-vendors-modern.js`

**Requirements:**
1. Use categoriesController and vendorsController
2. Handle category/subcategory relationships
3. Maintain original business logic
4. Add progress logging
5. Handle errors gracefully

**Input Structure (from Categories.json):**
```json
{
  "Income": {
    "HOA Dues": true,
    "Interest": true
  },
  "Maintenance": {
    "Pool": true,
    "Grounds": true
  }
}
```

### Task 2.3: Modernize Units Import

**Create new file:** `import-units-modern.js`

**Requirements:**
1. Use proper controller endpoints
2. Map ownership information correctly
3. Handle dues amounts and credit balances
4. Preserve unit sizes and types

**Input Structure (from Units.json):**
```json
{
  "A2": {
    "owner": "Garcia Martinez Family",
    "size": "C",
    "monthlyDues": 4600,
    "email": "example@email.com"
  }
}
```

### Task 2.4: Modernize Users Import

**Create new file:** `import-users-modern.js`

**Requirements:**
1. Use userManagementController
2. Handle Firebase Auth user creation
3. Map users to units properly
4. Set appropriate roles

### Task 2.5: Modernize Year-End Balances Import

**Create new file:** `import-yearend-balances-modern.js`

**Requirements:**
1. Set initial credit balances for units
2. Use proper timestamp handling
3. Create audit trail

### Acceptance Criteria - Phase 2
- [ ] All simple imports modernized
- [ ] Controllers used instead of direct Firebase
- [ ] DateService used for all dates
- [ ] Progress logging implemented
- [ ] Error handling added
- [ ] Test with sample data

---

## Phase 3: Document Complex Import Logic (1 session)

### Task 3.1: Analyze Transaction Import Logic

**Deep dive into:**
1. Transaction ID generation algorithm
2. Account name to ID mapping
3. Category/subcategory resolution
4. Split transaction handling
5. Balance calculations

**Document in:** `TRANSACTION_IMPORT_LOGIC.md`

### Task 3.2: Analyze HOA Dues Import Logic

**Deep dive into:**
1. Payment to transaction linking
2. Sequence number extraction from notes
3. Credit balance updates
4. Monthly payment tracking
5. Cross-reference generation

**Document in:** `HOA_DUES_IMPORT_LOGIC.md`

### Task 3.3: Map Cross-Reference Requirements

**Analyze HOA_Transaction_CrossRef.json:**
```json
{
  "25001": "2024-01-03_123456_789",
  "25002": "2024-01-03_123457_790"
}
```

Document:
- How sequence numbers are extracted
- How transaction IDs are matched
- When cross-references are created
- How updates maintain integrity

### Acceptance Criteria - Phase 3
- [ ] Transaction logic fully documented
- [ ] HOA Dues logic fully documented
- [ ] Cross-reference mechanism clear
- [ ] Data flow diagrams created
- [ ] Edge cases identified

---

## Phase 4: Modernize Complex Import Scripts (2 sessions)

### Task 4.1: Create Modern Transaction Import

**Create new file:** `import-transactions-modern.js`

**Critical Requirements:**
1. Use transactionsController.createTransaction
2. Generate proper transaction IDs using same algorithm
3. Map vendor/category names to IDs
4. Handle split allocations
5. Maintain running balances
6. Use DateService for all dates

**Key Logic to Preserve:**
```javascript
// Transaction ID must match controller logic
import { generateTransactionId } from '../../backend/utils/transactionIdGenerator.js';

// Date handling must use DateService
const dateService = new DateService({ timezone: 'America/Cancun' });
const transactionDate = dateService.parseFromFrontend(transaction.Date, 'M/d/yyyy');
```

### Task 4.2: Create Modern HOA Dues Import

**Create new file:** `import-hoa-dues-modern.js`

**Critical Requirements:**
1. Use hoaDuesController
2. Extract sequence numbers from notes
3. Link payments to transactions
4. Update credit balances correctly
5. Generate cross-reference data

**Key Logic to Preserve:**
- Parse notes like "JAN-001" to extract sequence
- Match sequence to transaction ID
- Update unit credit balance history

### Task 4.3: Create Cross-Reference Validator

**Create new file:** `validate-hoa-transaction-links.js`

**Requirements:**
1. Verify all HOA payments have transaction links
2. Check transaction IDs are valid
3. Validate credit balance calculations
4. Report any orphaned payments

### Acceptance Criteria - Phase 4
- [ ] Transaction import uses controllers
- [ ] HOA Dues import maintains all links
- [ ] Cross-references properly generated
- [ ] All dates use DateService
- [ ] Validation confirms integrity

---

## Technical Guidelines

### CRITICAL: Date Handling
```javascript
// ALWAYS use DateService
import { DateService, getNow } from '../../backend/services/DateService.js';

const dateService = new DateService({ timezone: 'America/Cancun' });

// Parse dates from JSON
const date = dateService.parseFromFrontend(dateString, 'M/d/yyyy');

// Current timestamp
const now = getNow();
```

### Controller Usage Pattern
```javascript
import transactionsController from '../../backend/controllers/transactionsController.js';
import { createMockContext } from './import-utils-modern.js';

// Create context
const { req, res } = createMockContext(clientId);

// Prepare request
req.body = {
  date: transactionDate,
  vendorName: transaction.Vendor,
  categoryName: transaction.Category,
  amount: Math.abs(transaction.Amount),
  type: transaction.Amount < 0 ? 'expense' : 'income',
  accountName: transaction.Account,
  notes: transaction.Notes
};

// Call controller
await transactionsController.createTransaction(req, res);
```

### Import Script Structure
```javascript
import { logImportProgress } from './import-utils-modern.js';

export async function importData(clientId, dataPath) {
  try {
    logImportProgress('Starting import', { clientId, dataPath });
    
    // Read JSON data
    const data = JSON.parse(fs.readFileSync(path.join(dataPath, 'filename.json')));
    
    // Process each item
    for (const [key, value] of Object.entries(data)) {
      // Transform and import
    }
    
    logImportProgress('Import completed successfully');
  } catch (error) {
    logImportProgress('Import failed', { error: error.message });
    throw error;
  }
}
```

---

## Definition of Done

### Core Requirements
- [ ] All import scripts modernized (except payment methods and client config)
- [ ] Original scripts preserved as backups
- [ ] DateService used throughout
- [ ] Controllers used instead of direct Firebase
- [ ] Comprehensive documentation created

### Quality Requirements
- [ ] Transaction IDs match production format
- [ ] HOA/Transaction links maintained
- [ ] Credit balances calculate correctly
- [ ] All imports are idempotent
- [ ] Error handling prevents partial imports

### Testing Requirements
- [ ] Test with MTCdata sample files
- [ ] Verify against existing production data
- [ ] Validate all cross-references
- [ ] Check timezone handling
- [ ] Confirm no data loss

---

## Implementation Order

1. **Phase 1**: Backup and document (understand what we have)
2. **Phase 2**: Simple imports first (build confidence)
3. **Phase 3**: Deep analysis of complex logic (prepare for hardest part)
4. **Phase 4**: Complex imports last (apply all learnings)

---

## Risk Mitigation

1. **Always test in dev environment first**
2. **Take database snapshots before imports**
3. **Run validation after each import**
4. **Keep detailed logs of all operations**
5. **Have rollback plan ready**

Start with Phase 1 to ensure we preserve all existing logic before making changes.