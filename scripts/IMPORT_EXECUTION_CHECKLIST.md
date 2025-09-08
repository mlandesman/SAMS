# Import Execution Checklist

**Date**: July 4, 2025
**Purpose**: Step-by-step guide for executing data import after purge

## Pre-Import Checklist

### ✅ Verify Purge Completion
```bash
# Check that purge is complete
FIRESTORE_ENV=dev node verify-purge-complete.js

# Expected output:
# - Only /exchangeRates and /users collections remain
# - No subcollections under /clients
# - No /auditLogs collection
```

### ✅ Verify Environment
```bash
# Confirm you're in dev
echo $FIRESTORE_ENV
# Should output: dev

# If not set:
export FIRESTORE_ENV=dev
```

### ✅ Check Data Files
```bash
# Verify all data files exist
ls -la data/MTC*.json
ls -la data/Units.json data/UnitSizes.json
ls -la data/HOADues2025.json
```

## Import Execution Options

### Option A: Complete Master Script (Recommended if TODOs completed)
```bash
cd /Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS/scripts

# Dry run first
FIRESTORE_ENV=dev node import-all-mtc-data.js --dry-run

# Review output, then execute
FIRESTORE_ENV=dev node import-all-mtc-data.js
```

### Option B: Individual Scripts in Order (Current State)
```bash
cd /Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS/scripts

# 1. Import Client (Required First)
FIRESTORE_ENV=dev node client-onboarding/import-client-data.js

# 2. Import Users
FIRESTORE_ENV=dev node import-users-with-audit.js

# 3. Import Categories
FIRESTORE_ENV=dev node import-categories-vendors-with-crud.js --categories-only

# 4. Import Vendors
FIRESTORE_ENV=dev node import-categories-vendors-with-crud.js --vendors-only

# 5. Setup Accounts
FIRESTORE_ENV=dev node setup-accounts.js

# 6. Import Units
FIRESTORE_ENV=dev node import-units-with-crud.js

# 7. Import Transactions
FIRESTORE_ENV=dev node import-transactions-with-crud.js

# 8. Import HOA Dues
FIRESTORE_ENV=dev node importHOADuesFixed.js
```

## Post-Import Validation

### 1. Run Import Verification
```bash
FIRESTORE_ENV=dev node verify-import.js

# Expected output:
# ✅ All collections present
# ✅ Document ID formats correct
# ✅ Required fields populated
# ✅ No deprecated fields
```

### 2. Run Data Statistics
```bash
FIRESTORE_ENV=dev node verify-data.js

# Expected output:
# - Transaction count and date ranges
# - Category distribution
# - Account balances
# - HOA dues status
```

### 3. Quick Manual Checks
```bash
# Check a few key records
FIRESTORE_ENV=dev node -e "
const admin = require('firebase-admin');
// Quick checks script
"
```

## Troubleshooting

### If Import Fails

1. **Check Error Messages**: Look for specific field validation errors
2. **Verify Data Files**: Ensure JSON files aren't corrupted
3. **Check Permissions**: Verify service account has write access
4. **Review Logs**: Check console output for specific failures

### Common Issues

**Issue**: "Collection not found" errors
**Solution**: Ensure client was imported first

**Issue**: Timestamp conversion errors
**Solution**: Check date formats in source data

**Issue**: Validation failures
**Solution**: Review field requirements in specifications

## Success Criteria

✅ All imports complete without errors
✅ Verification scripts pass
✅ Document counts match expected:
- Client: 1 (MTC)
- Users: ~10-20
- Categories: ~15
- Vendors: ~50
- Accounts: 2-4
- Units: 24
- Transactions: ~400+
- HOA Dues: 24 units × years

## Next Steps After Success

1. **Test Application**: Login and verify data displays correctly
2. **Run Codebase Updates**: Deploy the 10 agents for code changes
3. **Integration Testing**: Full end-to-end testing
4. **Production Planning**: Schedule production deployment

## Emergency Rollback

If critical issues found:
```bash
# Re-run purge
FIRESTORE_ENV=dev node purge-dev-complete.js

# Restore from backup if available
# Or re-import with fixes
```

## Notes

- Keep terminal open to monitor progress
- Each import shows progress indicators
- Total time: ~10-15 minutes for all imports
- Verify after each major collection if uncertain