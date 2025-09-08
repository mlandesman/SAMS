# Import Scripts Fixes Needed

## Summary
The import scripts have two main issues that need to be fixed:

### 1. Path Issues
All scripts have `../...` instead of `..` in their file paths.

**Fix:**
```bash
# Run this for all import scripts
sed -i '' 's/\.\.\/\.\.\.\/MTCdata\//..\/MTCdata\//g' *.js
```

### 2. Firebase Initialization Issues
Scripts are importing from `../backend/firebase.js` which uses a different firebase-admin package, causing Timestamp compatibility issues.

**Current (Wrong):**
```javascript
import { initializeFirebase, getDb } from '../backend/firebase.js';
```

**Should be:**
```javascript
import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';
```

Then initialize like:
```javascript
const { db, admin } = await initializeFirebase('dev');
```

## Scripts Successfully Fixed and Tested

1. **import-users-fixed.js** ✅
   - Successfully imported 9 users
   - Created Firebase Auth accounts
   - Linked users to units

2. **import-categories-vendors-fixed.js** ✅
   - Successfully imported 26 categories
   - Successfully imported 24 vendors
   - Properly handled object structure in JSON

## Scripts Still Needing Fixes

1. **import-units.js**
   - Path issue fixed but Firebase initialization needs update
   - Need to pass db instance properly

2. **import-transactions.js**
   - Path issues
   - Firebase initialization

3. **importHOADues.js**
   - Path issues
   - Firebase initialization
   - Syntax error (missing comma)

## Quick Test Commands

After fixing, test each individually:
```bash
cd scripts
node import-users-fixed.js
node import-categories-vendors-fixed.js
node import-units.js  # After fixing
node import-transactions.js  # After fixing
node importHOADues.js  # After fixing
```

## Complete Import Script

Once all are fixed, use:
```bash
./run-complete-import-mtcdata.sh
```

## Important Notes

- Users need passwords with 6+ characters (we prefix with "MTC")
- Firebase Auth UIDs are used as document IDs
- All timestamps must use getCurrentTimestamp() from utils
- Check JSON structure - some have objects not strings