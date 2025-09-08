# Client Onboarding Scripts - MTC Data Import

**Last Updated**: July 10, 2025  
**Purpose**: Production-ready scripts for importing MTC client data

## 🔒 Production Scripts

The following scripts constitute the complete MTC data import system. These files should NOT be modified without careful consideration as they form a working, tested import pipeline.

### Core Import Scripts (with timestamps)

| Script | Permission | Size | Last Modified | Purpose |
|--------|------------|------|---------------|---------|
| `create-mtc-client.js` | 555 (locked) | 7,093 | Jul 9 19:13:45 | Creates MTC client document |
| `create-default-accounts.js` | 555 (locked) | 1,622 | Jul 9 19:14:39 | Creates bank-001 and cash-001 accounts |
| `setup-client-config.js` | 644 | ~3,500 | Jul 10 08:20 | Creates activity menu and email config |
| `import-categories-vendors-with-crud.js` | 555 (locked) | 9,033 | Jul 9 18:34:12 | Imports categories and vendors |
| `import-units-with-crud-refactored.js` | 555 (locked) | 10,756 | Jul 9 20:07:44 | Imports unit data |
| `import-transactions-with-crud-refactored.js` | 555 (locked) | 18,003 | Jul 9 22:08:29 | Imports transactions, generates cross-ref |
| `import-hoa-dues-with-crud-refactored.js` | 644 | 11,571 | Jul 10 07:48:15 | Imports HOA dues with transaction linking |

### Utility Scripts

| Script | Permission | Size | Last Modified | Purpose |
|--------|------------|------|---------------|---------|
| `purge-dev-complete.cjs` | 644 | 13,069 | Jul 9 19:00:40 | Purges all MTC data (dev only) |
| `validate-import.js` | 644 | 7,047 | Jul 9 19:22:29 | Validates imported data |
| `run-complete-import-mtcdata.sh` | 755 | 5,583 | Jul 10 07:52:10 | Automated import runner |

### Documentation

- `00-IMPORT-SEQUENCE.md` - Detailed import sequence and troubleshooting
- `LOCKED-SCRIPTS-DO-NOT-MODIFY.md` - List of locked production scripts
- `PRODUCTION-IMPORT-SUMMARY.md` - Clean directory structure and results
- `FULL_IMPORT_JULY_10.txt` - Complete successful import logs for reference
- `README.md` - This file

### Utils Directory

Contains helper functions for environment configuration and timestamp handling.

## 🚀 Quick Start

### Complete Import (Recommended)

```bash
cd scripts/client-onboarding
./run-complete-import-mtcdata.sh
```

### Manual Import Sequence

```bash
# 1. Create client and setup
node create-mtc-client.js
node setup-client-config.js
node create-default-accounts.js
node create-yearend-snapshot.js

# 2. Import reference data
node import-categories-vendors-with-crud.js

# 3. Import units
node import-units-with-crud-refactored.js

# 4. Import transactions (generates cross-reference)
node import-transactions-with-crud-refactored.js

# 5. Import HOA dues (uses cross-reference)
node import-hoa-dues-with-crud-refactored.js

# 6. Validate
node validate-import.js
```

## 📊 Import Features

### Transaction Import
- Generates document IDs based on transaction date
- Creates `HOA_Transaction_CrossRef.json` for sequence mapping
- Handles income/expense detection
- Links HOA transactions to units

### HOA Dues Import
- Extracts payment dates from notes
- Links payments to transactions via sequence numbers (97% success rate)
- Stores in unit subcollections
- Preserves credit balances

## ⚠️ Important Notes

1. **Order Matters**: Scripts MUST run in sequence
2. **No Direct Firestore**: All scripts use backend controllers
3. **Cross-Reference**: Transaction import generates file for HOA import
4. **Locked Scripts**: Do not modify scripts with 555 permissions
5. **Dev Only**: Purge script only works in development environment

## 🔍 Verification

After import, verify:
1. Client document exists at `/clients/MTC`
2. Accounts exist: `bank-001`, `cash-001`
3. Categories and vendors populated
4. Units imported with correct data
5. Transactions have proper dates and amounts
6. HOA dues linked to transactions
7. Cross-reference file exists at `../../MTCdata/HOA_Transaction_CrossRef.json`

## 🛠️ Maintenance

### To Lock HOA Import Script
Once fully tested:
```bash
chmod 555 import-hoa-dues-with-crud-refactored.js
```

### To Update for Production
1. Remove "-refactored" suffixes from script names
2. Update this README with new names
3. Lock all scripts with `chmod 555`
4. Archive old versions

## 📁 Archive

Old and unused scripts have been moved to `archive-old-scripts/` directory for reference.