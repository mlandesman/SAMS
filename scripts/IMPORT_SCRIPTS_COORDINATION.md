# Import Scripts Coordination Guide

**Task ID**: IMPORT-SCRIPTS-UPDATE-001  
**Coordinator**: Subagent 6  
**Date**: July 4, 2025

## Overview

This document coordinates the update of all MTC data import scripts to conform to the new field structure specifications. All subagents should use the shared utilities created by the coordinator.

## Shared Utilities (Created by Coordinator)

### 1. `utils/environment-config.js`
- Centralized environment configuration (dev/prod/staging)
- Firebase initialization with proper service account handling
- Environment confirmation prompts for production safety
- **Note**: Uses ES modules (was auto-converted)
- Usage:
  ```javascript
  import { initializeFirebase, printEnvironmentInfo, confirmEnvironment } from './utils/environment-config.js';
  ```

### 2. `utils/timestamp-converter.js`
- Comprehensive timestamp conversion utilities
- Handles all date formats (Date, string, Unix timestamp, Firebase Timestamp)
- Generates transaction document IDs with proper format
- Usage:
  ```javascript
  import { toFirestoreTimestamp, generateTransactionDocId, getCurrentTimestamp } from './utils/timestamp-converter.js';
  ```

### 3. `utils/field-validator.js`
- Field validation against specifications
- Collection-specific validation rules
- Document ID format validation
- Removes deprecated fields automatically
- Usage:
  ```javascript
  import { validateCollectionData, validateDocumentId, removeDeprecatedFields } from './utils/field-validator.js';
  ```

## Master Scripts (Created by Coordinator)

### 1. `import-all-mtc-data.js`
- Master import script that coordinates all collection imports
- Supports dry-run and validate-only modes
- Environment selection via command line
- Progress tracking and error reporting
- Usage:
  ```bash
  node import-all-mtc-data.js dev --dry-run
  node import-all-mtc-data.js prod --validate-only
  ```

### 2. `verify-import.js`
- Comprehensive verification of imported data
- Validates against field specifications
- Checks reference integrity
- Generates detailed reports
- Usage:
  ```bash
  node verify-import.js dev --client MTC --detailed
  ```

## Subagent Implementation Guidelines

### Common Pattern for All Import Scripts

**Important**: All scripts in this project use ES modules (`"type": "module"` in package.json)

```javascript
#!/usr/bin/env node

import { initializeFirebase, printEnvironmentInfo, confirmEnvironment } from './utils/environment-config.js';
import { toFirestoreTimestamp, getCurrentTimestamp } from './utils/timestamp-converter.js';
import { validateCollectionData, removeDeprecatedFields } from './utils/field-validator.js';

async function main() {
  // Parse environment
  const env = process.argv[2] || 'dev';
  
  // Print environment info
  printEnvironmentInfo(env);
  
  // Confirm if production
  const confirmed = await confirmEnvironment(env);
  if (!confirmed) {
    console.log('Import cancelled');
    return;
  }
  
  // Initialize Firebase
  const { db } = initializeFirebase(env);
  
  // Your import logic here...
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

### Required Changes by Collection

#### Subagent 1: Clients
- Use new nested structure for basicInfo, contactInfo, propertyInfo
- Validate status, clientType, legalType enums
- Ensure document ID is uppercase code

#### Subagent 2: Users
- Document ID MUST be Firebase Auth UID
- Implement propertyAccess structure
- Set default notifications (all true)
- Remove deprecated fields: globalRole, isActive, lastLogin

#### Subagent 3: Transactions
- Generate document IDs using `generateTransactionDocId()`
- Store amounts in cents (positive numbers)
- Implement hybrid approach: store both vendorId and vendorName
- Add duesDistribution when categoryName = 'HOA Dues'

#### Subagent 4: Categories & Vendors
- Remove categoryName from vendors
- Remove budgetAmount and sortOrder from categories
- Ensure proper vendorType enum validation

#### Subagent 5: Units & HOA Dues
- Add new unit fields: squareFeet, ownershipPercentage, additionalNotes
- Ensure HOA dues payments array has exactly 12 elements
- Set creditBalance default to 0
- Remove month field from payment elements

## Testing Protocol

1. **Always test in Dev first**
   ```bash
   node your-script.js dev --dry-run
   ```

2. **Validate data structure**
   ```bash
   node verify-import.js dev --client MTC
   ```

3. **Check for deprecated fields**
   - The field-validator utility automatically removes them
   - Verify with audit scripts

4. **Reference integrity**
   - Ensure vendorIds exist before importing transactions
   - Ensure categories exist before importing transactions

## Integration Steps

1. Each subagent updates their assigned scripts
2. Test individually in dev environment
3. Coordinator runs master import script
4. Verify with verification script
5. Document any issues found
6. Coordinate fixes if needed
7. Final production deployment (with extreme caution)

## Critical Warnings

1. **NEVER** import to production without testing in Dev
2. **ALWAYS** use Firestore Timestamp objects for dates
3. **ALWAYS** validate data before writing
4. **ALWAYS** backup before production imports
5. **NEVER** mix old and new field structures

## Communication Protocol

- Report completion status to coordinator
- Document any blockers or issues
- Share validation reports
- Coordinate on reference dependencies

## Success Metrics

- 100% field specification compliance
- Zero data loss during import
- All required fields populated
- No deprecated fields remaining
- Successful validation reports

---

**Note**: This is a living document. Updates will be made as implementation progresses.