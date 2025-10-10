# Task Assignment - Update Legacy Import Scripts with DateService

**Date:** September 29, 2025  
**Priority:** HIGH - Production Critical  
**Estimated Effort:** 2-3 Implementation Agent sessions  
**Agent Type:** Implementation Agent
**Branch:** Continue on current branch `fix-transaction-date-timezone`

---

## Task Overview

Update the legacy import scripts to use DateService while preserving all their working business logic. These scripts have proven functionality including account mapping, validation, and HOA cross-references. We need to add proper timezone handling to prevent date sliding issues while keeping everything else that works.

**Philosophy:**
- Preserve what works (business logic, validation, mappings)
- Fix what's broken (date handling, hard-coded paths)
- Make client-agnostic (support MTC, AVII, and future clients)
- Do it right, not fast

---

## Phase 1: Analyze Legacy Scripts (0.5 sessions)

### Task 1.1: Inventory Legacy Import Scripts

**Locate and document all working legacy scripts:**
```bash
cd /scripts/client-onboarding
ls -la import-*-with-crud.js.backup
```

Expected scripts:
- `import-categories-vendors-with-crud.js`
- `import-units-with-crud.js`
- `import-transactions-with-crud.js`
- `import-users-with-crud.js`
- `import-yearend-balances.js`

### Task 1.2: Analyze Date Handling Issues

**For each script, document:**
1. Where dates are parsed or created
2. Current date handling method
3. Timezone assumptions
4. Potential date sliding risks

**Pay special attention to:**
- Transaction dates (critical for ID generation)
- Payment dates in HOA dues
- Timestamp fields
- Any date arithmetic

### Task 1.3: Review Dependencies

**Document critical dependencies:**
- `data-augmentation-utils.js` - account mapping logic
- `accountMapping.js` - client-specific mappings
- Firebase initialization patterns
- Controller usage patterns

### Acceptance Criteria - Phase 1
- [ ] All date handling code identified
- [ ] Risk assessment for each date operation
- [ ] Dependencies documented
- [ ] Clear plan for DateService integration

---

## Phase 2: Create Enhanced Legacy Scripts (1.5 sessions)

### Task 2.1: Create Base Import Configuration

**Create new file:** `import-config.js`

```javascript
import { DateService } from '../../backend/services/DateService.js';
import admin from 'firebase-admin';
import { initializeApp } from '../../backend/config/firebase.js';

export const dateService = new DateService({ timezone: 'America/Cancun' });

export function getImportConfig(clientId, dataPath) {
  return {
    clientId,
    dataPath: dataPath || `/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/${clientId}data`,
    dateService,
    environment: process.env.FIRESTORE_ENV || 'dev'
  };
}

export async function initializeImport(clientId) {
  // Initialize Firebase with proper environment
  const db = await initializeApp();
  
  console.log(`\n🔥 Import initialized for ${clientId}`);
  console.log(`📁 Environment: ${process.env.FIRESTORE_ENV || 'dev'}`);
  console.log(`🕐 Timezone: America/Cancun`);
  
  return db;
}
```

### Task 2.2: Update Transaction Import Script

**Create new file:** `import-transactions-enhanced.js`

Key updates:
1. Add DateService for all date parsing
2. Make client-agnostic (remove MTC hard-coding)
3. Add command-line argument support
4. Keep ALL existing business logic

```javascript
import { dateService, getImportConfig, initializeImport } from './import-config.js';
import { augmentTransaction, validateAugmentedTransaction } from '../data-augmentation-utils.js';
import transactionsController from '../../backend/controllers/transactionsController.js';

// Parse dates properly
function parseTransactionDate(dateString) {
  // Handle various date formats from source data
  // Always use dateService to ensure timezone consistency
  return dateService.parseFromFrontend(dateString, 'M/d/yyyy');
}
```

### Task 2.3: Update HOA Dues Import Script

**Critical requirements:**
1. Parse payment dates using DateService
2. Extract sequence numbers correctly
3. Maintain cross-reference generation
4. Handle credit balance calculations

### Task 2.4: Update Units Import Script

**Requirements:**
1. Keep existing unit/owner mapping logic
2. Add DateService for any timestamp fields
3. Support different client configurations

### Task 2.5: Create Client Configuration Support

**Update accountMapping.js to support multiple clients:**

```javascript
export function getClientImportMapping(clientId) {
  const mappings = {
    MTC: {
      accounts: {
        "MTC Bank": "bank-001",
        "Cash Account": "cash-001",
        "Cash": "cash-001"
      }
    },
    AVII: {
      accounts: {
        "AVII Bank": "bank-001",
        "AVII Cash": "cash-001",
        "Cash": "cash-001"
      }
    }
  };
  
  return mappings[clientId] || {};
}
```

### Acceptance Criteria - Phase 2
- [ ] All scripts use DateService consistently
- [ ] Client-agnostic implementation
- [ ] Command-line argument support
- [ ] All business logic preserved
- [ ] Account mappings for both MTC and AVII

---

## Phase 3: Test Enhanced Scripts (0.5 sessions)

### Task 3.1: Test with MTC Data

**Test sequence:**
1. Dry run with small dataset
2. Verify dates don't shift
3. Check transaction ID generation
4. Validate HOA cross-references
5. Confirm account mappings work

### Task 3.2: Test with AVII Data

**Prepare AVII test:**
1. Create AVII account mappings
2. Test with subset of AVII data
3. Verify all transformations work
4. Check credit balance calculations

### Task 3.3: Create Test Validation Suite

**Create:** `validate-import-enhanced.js`

Validations:
- All dates in correct timezone
- Transaction IDs match expected format
- HOA payments linked correctly
- Account balances reconcile
- No orphaned records

### Acceptance Criteria - Phase 3
- [ ] MTC import works without date issues
- [ ] AVII import works with proper mappings
- [ ] All validations pass
- [ ] No timezone-related bugs

---

## Phase 4: Create Production Import Process (0.5 sessions)

### Task 4.1: Create Master Import Script

**Create:** `run-import-enhanced.sh`

Features:
- Client selection via arguments
- Environment selection
- Automatic dependency checking
- Progress tracking
- Rollback capability

```bash
#!/bin/bash
# Enhanced import script with DateService support

CLIENT_ID=$1
DATA_PATH=$2
COMPONENTS=$3  # Optional: specific components to import

# Validate inputs
if [ -z "$CLIENT_ID" ]; then
    echo "Usage: ./run-import-enhanced.sh <CLIENT_ID> [DATA_PATH] [COMPONENTS]"
    exit 1
fi

# Set proper environment
export TZ='America/Cancun'
echo "🕐 Timezone set to America/Cancun"
```

### Task 4.2: Document DateService Requirements

**Create:** `DATE_HANDLING_GUIDE.md`

Document:
1. Why DateService is critical
2. Common date formats in source data
3. How to handle edge cases
4. Timezone considerations

### Task 4.3: Create Migration Checklist

**For each client import:**
- [ ] Account mappings configured
- [ ] Date formats verified
- [ ] Test import run
- [ ] Validation completed
- [ ] Rollback plan ready

### Acceptance Criteria - Phase 4
- [ ] Production-ready import process
- [ ] Clear documentation
- [ ] Repeatable and reliable
- [ ] Supports all clients

---

## Technical Guidelines

### CRITICAL: Date Handling Patterns

```javascript
// NEVER use this:
const date = new Date(dateString);

// ALWAYS use this:
import { dateService } from './import-config.js';

// For various source formats:
const date1 = dateService.parseFromFrontend('1/15/2025', 'M/d/yyyy');
const date2 = dateService.parseFromFrontend('2025-01-15', 'yyyy-MM-dd');
const date3 = dateService.parseFromFrontend('01/15/2025', 'MM/dd/yyyy');

// For transaction IDs:
import { generateTransactionId } from '../../backend/utils/transactionIdGenerator.js';
const txId = generateTransactionId(clientId, date);
```

### Controller Integration Pattern

```javascript
// Keep the existing controller usage
const req = {
  params: { clientId },
  body: transactionData,
  user: { uid: 'import-script' }
};

const res = {
  status: (code) => ({ json: (data) => data }),
  json: (data) => data
};

await transactionsController.createTransaction(req, res);
```

### Preserve Business Logic

```javascript
// Keep ALL of these critical functions:
- augmentTransaction() - applies account mappings
- validateAugmentedTransaction() - ensures data integrity
- extractUnitFromDuesNotes() - parses HOA unit references
- generateCrossReference() - links HOA to transactions
```

---

## Definition of Done

### Core Requirements
- [ ] All dates use DateService
- [ ] No timezone-related bugs
- [ ] Client-agnostic implementation
- [ ] All business logic preserved
- [ ] Account mappings work for all clients

### Quality Requirements
- [ ] No hard-coded paths
- [ ] Comprehensive error handling
- [ ] Progress logging throughout
- [ ] Validation at each step
- [ ] Documentation updated

### Testing Requirements
- [ ] MTC import tested
- [ ] AVII import tested
- [ ] Date consistency verified
- [ ] Cross-references validated
- [ ] Account balances correct

---

## Success Metrics

- Zero date-related errors
- All imports preserve exact timezone (America/Cancun)
- Business logic unchanged from legacy scripts
- Support for multiple clients without code changes
- Reproducible imports with consistent results

Start with Phase 1 to understand current date handling before making changes.