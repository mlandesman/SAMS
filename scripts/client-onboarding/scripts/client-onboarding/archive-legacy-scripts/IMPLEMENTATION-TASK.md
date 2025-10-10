# IMPLEMENTATION TASK: Fix API-Calling Import Scripts

## Background
The working import scripts in this directory use backend API calls (like `createTransaction()`) which is the correct approach because it:
- Validates all data through backend business rules
- Writes audit logs automatically
- Updates account balances properly
- Handles transaction linking correctly
- Stores metadata in appropriate collections

## Current Issue
After the property access refactoring, these scripts may have:
- Incorrect field names (e.g., `clientAccess` → `propertyAccess`)
- Wrong file paths
- Outdated API endpoints

## Task Requirements

### 1. Test Current State
Run the API-calling import scripts to identify what specifically is broken:
```bash
cd /scripts/client-onboarding
node import-all-mtc-complete.js
```

### 2. Fix Known Issues
**CONFIRMED ISSUE**: Import paths are wrong due to scripts being moved to subdirectory

**Required fixes:**
- Change `../backend/firebase.js` to `../../backend/firebase.js` in all import scripts
- Change `../backend/controllers/` to `../../backend/controllers/` in all import scripts
- Update field names from `clientAccess` to `propertyAccess` if needed
- Fix any other relative path references that changed
- Update API endpoint URLs if needed
- Ensure proper error handling for API calls

**Error seen in testing:**
```
Cannot find module '/Users/.../scripts/backend/firebase.js' imported from /Users/.../scripts/client-onboarding/import-categories-vendors-with-crud.js
```

**Fix required:**
All imports need to go up one more directory level since scripts are now in client-onboarding subdirectory.

### 3. Critical Requirements
- **DO NOT** rewrite to use direct Firestore writes
- **DO NOT** bypass the backend API validation system
- **MUST** preserve calls to `createTransaction()`, `createCategory()`, etc.
- **MUST** maintain audit logging functionality
- **MUST** preserve transaction linking logic

### 4. Expected Results After Fix
- All transactions created through backend API
- Audit logs present in database
- Account balances updated properly
- Transaction linking working (HOA dues → transactions)
- Metadata stored in separate `importMetadata` collection

### 5. Test Validation
After fixes, verify:
- Balance ~$184K MXN
- Audit logs collection populated
- Transaction links > 0 (should be ~65 HOA dues linked)
- All data in correct locations per backend validation

## Files to Focus On
- `import-transactions-with-crud.js` - Main transaction import
- `import-categories-vendors-with-crud.js` - Categories/vendors
- `import-units-with-crud.js` - Units
- `import-all-mtc-complete.js` - Orchestration script
- `run-complete-import.sh` - Shell wrapper

## Success Criteria
- Import runs without errors
- All validation passes
- Audit logs created
- Balance calculations correct
- Transaction linking functional

## Agent Requirements
- Must understand backend API architecture
- Must preserve existing validation system
- Must make surgical fixes, not rewrites
- Must test thoroughly before declaring complete