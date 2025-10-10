# MANDATORY IMPORT RULES - NO EXCEPTIONS

## THE ONE RULE: NO DIRECT FIRESTORE WRITES

### ❌ FORBIDDEN - NEVER DO THIS:
```javascript
// WRONG - Direct Firestore write
await db.collection('clients/MTC/categories').add({...});
await categoryRef.set({...});
await db.collection('clients/MTC/vendors').doc(id).set({...});
```

### ✅ REQUIRED - ALWAYS DO THIS:
```javascript
// CORRECT - Use backend CRUD functions
import { createCategory } from '../../backend/controllers/categoriesController.js';
import { createVendor } from '../../backend/controllers/vendorsController.js';
import { createTransaction } from '../../backend/controllers/transactionsController.js';

await createCategory(clientId, categoryData);
await createVendor(clientId, vendorData);
await createTransaction(clientId, transactionData);
```

## Why This Matters

When you bypass CRUD functions:
- ❌ NO validation
- ❌ NO audit logs
- ❌ NO field compliance
- ❌ NO balance updates
- ❌ NO business rules
- ❌ Timestamp errors
- ❌ Field creep

## Import Scripts Must:

1. **Import backend controllers**
2. **Call CRUD functions for ALL writes**
3. **Let backend handle:**
   - Timestamps (uses `new Date()` correctly)
   - Validation
   - Audit logging
   - Field compliance
   - Business rules

## For Import Metadata

Create a new CRUD function:
```javascript
// backend/controllers/importMetadataController.js
export async function createImportMetadata(clientId, metadata) {
  // Handle timestamp properly
  // Write to correct collection
  // Return success/error
}
```

Then import scripts call:
```javascript
await createImportMetadata(clientId, {
  type: 'category',
  documentId: result.id,
  originalData: data
});
```

## NO EXCEPTIONS

Every single Firestore write MUST go through a backend CRUD function.
No direct writes. Ever. Period.