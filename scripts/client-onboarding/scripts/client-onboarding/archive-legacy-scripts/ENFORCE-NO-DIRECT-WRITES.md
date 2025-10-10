# How to ENFORCE No Direct Firestore Writes

## Option 1: Remove Firebase Admin from Import Scripts

### Current Problem:
```javascript
import { initializeFirebase, getDb } from '../../backend/firebase.js';
const db = await getDb(); // THIS ALLOWS DIRECT WRITES!
```

### Solution:
```javascript
// DO NOT import firebase.js or getDb
// ONLY import controller functions
import { createCategory } from '../../backend/controllers/categoriesController.js';
import { createVendor } from '../../backend/controllers/vendorsController.js';
```

## Option 2: Create Import-Specific API Module

Create `/backend/api/import-api.js`:
```javascript
// ONLY exports CRUD functions, NO database access
export { createCategory } from '../controllers/categoriesController.js';
export { createVendor } from '../controllers/vendorsController.js';
export { createTransaction } from '../controllers/transactionsController.js';
export { createImportMetadata } from '../controllers/importMetadataController.js';
// NO export of getDb or firebase!
```

Import scripts then:
```javascript
import * as API from '../../backend/api/import-api.js';
// Can ONLY use API.createCategory(), etc.
// NO access to database
```

## Option 3: Validation Script that Fails on Direct Writes

Add to validation checklist:
```javascript
// Check if script imports getDb or firebase
const scriptContent = fs.readFileSync(scriptPath, 'utf8');
if (scriptContent.includes('getDb') || 
    scriptContent.includes('db.collection') ||
    scriptContent.includes('.add(') ||
    scriptContent.includes('.set(')) {
  console.error('❌ SCRIPT USES DIRECT FIRESTORE WRITES!');
  process.exit(1);
}
```

## Option 4: Create a Linter Rule

`.eslintrc.json` rule:
```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [{
        "name": "../../backend/firebase.js",
        "message": "Import controllers instead of firebase directly"
      }]
    }]
  }
}
```

## Option 5: Code Review Checklist

Before accepting ANY import script fix:
1. Search for `getDb` - should be 0 results
2. Search for `db.collection` - should be 0 results  
3. Search for `.add(` - should be 0 results
4. Search for `.set(` - should be 0 results
5. Only imports should be controller functions

## Recommended Approach

1. **Immediate**: Remove `getDb` imports from all import scripts
2. **Short-term**: Create import-api.js module
3. **Long-term**: Add linter rules
4. **Every PR**: Enforce code review checklist

## The Key Change

Instead of:
```javascript
import { getDb } from '../../backend/firebase.js';
const db = await getDb();
await db.collection('clients/MTC/categories').add({...}); // WRONG!
```

Force this pattern:
```javascript
import { createCategory } from '../../backend/controllers/categoriesController.js';
await createCategory(clientId, data); // ONLY WAY!
```

No database access = No direct writes!