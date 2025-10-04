# Import Code Recovery Documentation
**Date:** 2025-09-29  
**Status:** CRITICAL - Major Breaking Changes Identified  
**Recovery Priority:** HIGH

## Executive Summary

The SAMS import pipeline is severely broken due to comprehensive architectural changes throughout the system. The archived import scripts from 2025-08-13 are incompatible with the current SAMS architecture, requiring significant updates to restore functionality.

### Critical Issues Identified:
1. **API URL Structure Changed** - All endpoints have been reorganized into domain-based routing
2. **Direct Firebase Access Removed** - All operations must go through controllers now
3. **Date/Timezone Handling Overhauled** - DateService is now mandatory for all date operations
4. **Authentication Context Required** - Scripts need proper req/res context for audit logging
5. **Field Names Changed** - Multiple database field mappings have been updated

## Found vs Missing Scripts Inventory

### Successfully Recovered Scripts:
1. ✅ `import-categories-vendors-with-crud.js` - Copied from archive
2. ✅ `import-units-with-crud.js` - Copied from archive  
3. ✅ `import-transactions-with-crud.js` - Copied from archive
4. ✅ `import-users-with-crud.js` - Copied from archive
5. ✅ `import-yearend-balances.js` - Copied from archive

### Existing Import Scripts Found:
1. `importHOADuesWithLinking.js` - Current version with transaction linking
2. `importHOADuesEnhanced.js` - Enhanced version
3. Multiple legacy HOA import scripts in various states

### Missing Critical Scripts:
1. ❌ `setup-client-config.js` - Not found in archives
2. ❌ `import-payment-methods.js` - No payment method import scripts found
3. ❌ `validate-import.js` - General validation script missing
4. ❌ HOA/Transaction cross-reference generation scripts (beyond the JSON file)

## Detailed Breaking Changes Analysis

### A. API/URL Structure Changes

#### Old Structure:
```javascript
// Direct API calls
POST /api/clients/:clientId/transactions
GET /api/clients/:clientId/vendors
PUT /api/clients/:clientId/units/:unitId
```

#### New Structure: 
```javascript
// Domain-based routing
POST /clients/:clientId/transactions
GET /clients/:clientId/vendors
PUT /clients/:clientId/units/:unitId

// Special domains:
/auth/user/...       // User management
/water/...           // Water billing
/comm/email/...      // Email communications
/admin/...           // Admin operations
/system/...          // System utilities (public)
```

### B. Database Structure Changes

#### Transaction Fields:
| Old Field | New Field | Type Change | Notes |
|-----------|-----------|-------------|--------|
| `vendor` | `vendorName` | String | Must resolve to vendorId if exists |
| `category` | `categoryName` | String | Must resolve to categoryId if exists |
| `account` | `accountName` | String | Must resolve to accountId |
| `createdAt` | (removed) | - | Handled by audit log |
| `date` | `date` | Timestamp | Must use DateService |
| - | `type` | String | Required: 'income' or 'expense' |
| - | `paymentMethod` | String | Now tracked |
| - | `duesDistribution` | Array | For HOA Dues |

#### HOA Dues Structure:
```javascript
// Old flat structure
{
  "unitId": {
    "payments": [{
      "month": 1,
      "paid": 4600,
      "notes": "..."
    }]
  }
}

// New nested structure with enhanced tracking
{
  "unitId": {
    "payments": [{
      "month": 1,
      "paid": 4600,
      "notes": "...",
      "paymentDate": Timestamp,
      "transactionId": "2024-01-03_123456_789",
      "sequenceNumber": 25001
    }],
    "metadata": {
      "lastUpdated": Timestamp,
      "lastUpdateBy": "userId"
    }
  }
}
```

### C. Date/Timezone Handling

#### Old Approach:
```javascript
// Direct Date creation
const date = new Date(data.Date);
const timestamp = admin.firestore.Timestamp.fromDate(date);
```

#### New Required Approach:
```javascript
import { DateService } from '../services/DateService.js';

const dateService = new DateService({ timezone: 'America/Cancun' });

// All dates must go through DateService
const timestamp = dateService.toFirestoreTimestamp(data.Date);

// Frontend formatting
const formattedDate = dateService.formatForFrontend(date);
// Returns: { display, iso, timestamp, mexico }
```

### D. Authentication/Authorization Changes

#### Old Scripts:
```javascript
// Direct Firebase operations
const db = await getDb();
await db.collection(`clients/${clientId}/transactions`).add(data);
```

#### New Requirements:
```javascript
// Must use controllers with proper context
import { createTransaction } from '../../backend/controllers/transactionsController.js';

// Need to mock req/res for scripts
const mockReq = {
  user: { uid: 'import_script', email: 'system@import.com' },
  params: { clientId: 'MTC' },
  body: transactionData
};

const transactionId = await createTransaction(clientId, transactionData);
```

### E. Controller vs Direct Firebase Access

#### Operations Now Requiring Controllers:
1. **Transactions** - Full CRUD through transactionsController.js
2. **Units** - Through unitsController.js  
3. **Users** - Through userManagementController.js
4. **Categories/Vendors** - Through respective controllers
5. **HOA Dues** - Through hoaDuesController.js
6. **Documents** - Through documentsController.js

#### Still Using Direct Firebase:
1. Initial client creation
2. Bulk data migrations
3. System configuration updates

## Step-by-Step Recovery Plan

### Phase 1: Update Import Scripts (Priority: HIGH)
1. **Update all API endpoints** in recovered scripts
2. **Replace date handling** with DateService
3. **Add proper authentication context** 
4. **Update field mappings** to match new structure

### Phase 2: Create Missing Scripts
1. **setup-client-config.js** - Build from template
2. **import-payment-methods.js** - New script needed
3. **validate-import.js** - Comprehensive validation

### Phase 3: Fix HOA Integration
1. Update HOA import to use new structure
2. Create proper transaction linking
3. Handle payment distributions
4. Update sequence number tracking

### Phase 4: Testing Infrastructure
1. Create test environment setup
2. Build validation suite
3. Implement rollback capability

## Risk Assessment

### High Risk Areas:
1. **Data Loss** - Incorrect field mappings could lose data
2. **Transaction ID Mismatches** - New ID generation format
3. **Date Timezone Issues** - Mexico timezone vs UTC storage
4. **Audit Trail Gaps** - Missing user context in scripts

### Mitigation Strategies:
1. Full backup before any import
2. Dry-run mode for all scripts
3. Comprehensive validation checks
4. Transaction-by-transaction logging

## Testing Requirements

### Unit Tests Needed:
1. Date conversion accuracy
2. Field mapping validation  
3. ID generation consistency
4. Amount conversion (dollars/cents)

### Integration Tests:
1. Full import flow
2. HOA/Transaction linking
3. Balance calculations
4. User access verification

### Acceptance Criteria:
1. All historical data preserved
2. No duplicate transactions
3. Correct balance calculations
4. Proper audit trails
5. User access maintained

## Implementation Timeline

### Week 1:
- Update core import scripts
- Fix date/timezone handling
- Create authentication mocking

### Week 2:
- Build missing scripts
- Update HOA integration
- Create validation suite

### Week 3:
- Testing and validation
- Documentation updates
- Production preparation

## Recommended Next Steps

1. **IMMEDIATE:** Create full backup of current production data
2. **TODAY:** Start updating import-transactions-with-crud.js as proof of concept
3. **THIS WEEK:** Build comprehensive test environment
4. **PRIORITY:** Fix date handling across all scripts

---

**NOTE:** This is a critical recovery operation. The import pipeline is the foundation for client onboarding and data migration. Without it, new clients cannot be properly onboarded to SAMS.