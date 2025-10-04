# Task Assignment: Update Purge and Import Tools

**Task ID:** UPDATE-PURGE-IMPORT-TOOLS-001  
**Priority:** HIGH  
**Created:** 2025-09-29  
**Status:** PENDING

## Executive Summary

Update all purge and import scripts to work with the new data structures, endpoints, and timezone handling implemented during the recent fixes. These tools are critical for client onboarding and development environment management.

## Current State Analysis

### Purge Tools

1. **Primary Purge Script**: `/scripts/purge-dev-complete.cjs`
   - Uses direct Firestore operations
   - Preserves `exchangeRates` and `users` collections
   - Has recursive collection discovery
   - Uses batch operations for deletion
   - No timezone awareness

2. **Enhanced Purge Script**: `/scripts/enhanced-client-purge-with-audit.js`
   - Uses audit logging
   - Archives data before deletion
   - Handles Storage files
   - Uses direct Firestore operations
   - No timezone handling

### Import Tools

1. **Main Import Orchestrator**: `/scripts/client-onboarding/run-complete-import.sh`
   - Detects modern vs legacy import approach
   - Runs scripts in sequence
   - Environment-aware (dev/staging/prod)
   - Missing several referenced scripts

2. **HOA Dues Import**: `/scripts/importHOADuesWithLinking.js`
   - Uses old timestamp converter utilities
   - Links payments to transactions via sequence numbers
   - Hardcodes year as '2025'
   - Direct Firestore writes
   - No use of controllers

3. **Transaction Import**: `/scripts/importTransactionsForMTC.js`
   - Uses controllers correctly
   - Has date normalization
   - Doesn't handle timezone properly
   - Missing transaction ID generation logic

4. **Balance Rebuild**: `/scripts/rebuildBalancesForMTC.js`
   - Uses controllers
   - Outdated timestamp conversion
   - No timezone handling

## Required Updates

### 1. Timezone and Date Handling

All scripts need to be updated to use the new DateService:

```javascript
import { DateService } from '../backend/services/DateService.js';

// Instead of old timestamp converters:
const dateService = new DateService();
const firestoreTimestamp = dateService.toFirestoreTimestamp(date, timezone);
```

### 2. Controller Usage

Scripts should use controllers instead of direct Firestore operations:

```javascript
// OLD: Direct Firestore
await db.collection('clients').doc(clientId).collection('hoaDues').doc(unitId).set(data);

// NEW: Use controllers
import { createHOADues } from '../backend/controllers/hoaDuesController.js';
await createHOADues(clientId, unitId, year, data);
```

### 3. Transaction ID Generation

Import scripts need to use the centralized ID generation:

```javascript
import { generateTransactionId } from '../backend/utils/transactionIdGenerator.js';

const transactionId = await generateTransactionId(clientId, transactionData);
```

### 4. Data Structure Updates

Update field names and structures to match current specifications:

- HOA Dues: Remove deprecated fields, use new payment structure
- Transactions: Include proper timezone-aware dates
- Accounts: Use new balance tracking fields

### 5. API Endpoint Integration

For scripts that might be run remotely, add API endpoint support:

```javascript
// Support both direct controller and API approaches
const useAPI = process.env.USE_API === 'true';

if (useAPI) {
  await axios.post(`${API_BASE_URL}/api/clients/${clientId}/transactions`, data);
} else {
  await createTransaction(clientId, data);
}
```

## Detailed Task List

### Phase 1: Create Missing Core Scripts

1. **Create Modern Import Scripts** (`/scripts/client-onboarding/`)
   - [ ] `import-client-from-json.js` - Create client from config
   - [ ] `import-client-data.js` - Import all data types
   - [ ] `import-yearend-balances.js` - Import year-end snapshots
   - [ ] `import-categories-vendors-with-crud.js`
   - [ ] `import-payment-methods-with-crud.js`
   - [ ] `import-units-with-crud-refactored.js`
   - [ ] `import-transactions-with-crud-refactored.js`
   - [ ] `import-hoa-dues-with-crud-refactored.js`
   - [ ] `validate-import.js` - Post-import validation

### Phase 2: Update Existing Scripts

2. **Update Purge Scripts**
   - [ ] Convert `purge-dev-complete.cjs` to ES modules
   - [ ] Add DateService integration
   - [ ] Use controllers instead of direct Firestore
   - [ ] Add progress tracking and better error handling
   - [ ] Create `purge-client-complete.js` that works for any client

3. **Update Import Scripts**
   - [ ] Update `importHOADuesWithLinking.js`:
     - Use DateService for timestamps
     - Use HOA Dues controller
     - Dynamic year handling
     - Proper timezone support
   - [ ] Update `importTransactionsForMTC.js`:
     - Add transaction ID generation
     - Proper timezone handling
     - Better error recovery
   - [ ] Update `rebuildBalancesForMTC.js`:
     - Use DateService
     - Handle timezones properly
     - Support multiple clients

### Phase 3: Create Utility Scripts

4. **Create New Utility Scripts**
   - [ ] `verify-timezone-data.js` - Check all dates have proper timezones
   - [ ] `migrate-to-new-structure.js` - Update existing data to new format
   - [ ] `generate-import-template.js` - Create import file templates
   - [ ] `compare-environments.js` - Compare data between environments

### Phase 4: Documentation and Testing

5. **Update Documentation**
   - [ ] Update `IMPORT_GUIDE.md` with new script names
   - [ ] Create `PURGE_GUIDE.md` for purge operations
   - [ ] Document timezone handling requirements
   - [ ] Add troubleshooting section

6. **Create Test Scripts**
   - [ ] `test-import-small-dataset.js` - Test with minimal data
   - [ ] `test-purge-safety.js` - Verify preservation rules
   - [ ] `test-timezone-import.js` - Verify timezone handling

## Implementation Guidelines

### Code Standards

1. **Use ES Modules** (not CommonJS)
2. **Use async/await** consistently
3. **Implement proper error handling** with try/catch
4. **Add progress indicators** for long operations
5. **Use controllers** instead of direct Firestore access
6. **Centralize configuration** in environment files

### Safety Requirements

1. **Always confirm** destructive operations
2. **Create backups** before purging
3. **Validate environment** before operations
4. **Log all operations** with audit trail
5. **Test in dev** before staging/production

### Template Structure

```javascript
/**
 * Script Name and Purpose
 * Task ID: UPDATE-PURGE-IMPORT-TOOLS-001
 * 
 * Features:
 * - Uses controllers for all operations
 * - Timezone-aware date handling
 * - Proper error handling and recovery
 * - Audit logging for all changes
 */

import { initializeFirebase } from '../backend/firebase.js';
import { DateService } from '../backend/services/DateService.js';
import { writeAuditLog } from '../backend/utils/auditLogger.js';
// ... other imports

const dateService = new DateService();

async function main() {
  const startTime = Date.now();
  
  try {
    // Initialize
    await initializeFirebase();
    
    // Verify environment
    const env = process.env.FIRESTORE_ENV || 'dev';
    console.log(`Environment: ${env}`);
    
    // Get user confirmation
    const confirmed = await confirmOperation();
    if (!confirmed) {
      console.log('Operation cancelled by user');
      return;
    }
    
    // Execute operation
    await performOperation();
    
    // Log completion
    const duration = Date.now() - startTime;
    console.log(`✅ Completed in ${duration}ms`);
    
  } catch (error) {
    console.error('❌ Operation failed:', error);
    await writeAuditLog({
      module: 'script-name',
      action: 'error',
      notes: error.message,
      clientId: 'SYSTEM'
    });
    process.exit(1);
  }
}

main();
```

## Success Criteria

1. **All scripts use DateService** for date handling
2. **All scripts use controllers** for data operations
3. **Timezone data preserved** through import/export
4. **Transaction IDs generated correctly**
5. **Audit logs created** for all operations
6. **No direct Firestore writes** in scripts
7. **All imports create valid** data structures
8. **Purge operations preserve** required collections

## Testing Checklist

- [ ] Import creates transactions with proper IDs
- [ ] Import preserves timezone information
- [ ] HOA Dues link correctly to transactions
- [ ] Balances calculate correctly with timezones
- [ ] Purge preserves exchangeRates and users
- [ ] Purge creates complete backups
- [ ] All operations create audit logs
- [ ] Scripts work across all environments

## Notes

- The transaction ID fix must be complete before updating import scripts
- Consider creating a script library for common operations
- All date operations should account for user's local timezone
- Import scripts should validate data before processing
- Consider adding dry-run mode for all destructive operations

## Dependencies

- Completion of transaction ID generation fix
- DateService implementation
- Updated controllers with timezone support
- Audit logging system