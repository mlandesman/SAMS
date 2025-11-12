# Client Onboarding Scripts

**Last Updated**: August 6, 2025  
**Purpose**: Unified client data import system for SAMS

## 🚀 Quick Start

```bash
# Import any client data
./run-complete-import.sh <CLIENT_ID> [DATA_PATH]

# Examples:
./run-complete-import.sh MTC                    # Uses default ../../MTCdata
./run-complete-import.sh AVII ../../AVIIdata    # Custom data path
./run-complete-import.sh NEWCLIENT ../../data   # New client

# Environment selection:
FIRESTORE_ENV=staging ./run-complete-import.sh MTC
FIRESTORE_ENV=prod ./run-complete-import.sh MTC
```

## 📁 Directory Structure

```
client-onboarding/
├── run-complete-import.sh           # Main unified import script
├── IMPORT_GUIDE.md                  # Detailed usage guide
├── README.md                        # This file
│
├── Import Scripts (Called by main script)
│   ├── import-client-from-json.js   # Modern JSON-based client import
│   ├── import-client-data.js        # Imports all client data
│   ├── create-mtc-client.js         # Legacy client creation
│   ├── create-default-accounts.js   # Account creation
│   ├── create-yearend-snapshot.js   # Year-end balance snapshot
│   ├── import-categories-vendors-with-crud.js
│   ├── import-payment-methods-with-crud.js
│   ├── import-units-with-crud-refactored.js
│   ├── import-transactions-with-crud-refactored.js
│   └── import-hoa-dues-with-crud-refactored.js
│
├── Setup & Validation
│   ├── setup-client-config.js       # Creates config templates (preserves existing)
│   ├── setup-firebase-config.js     # Firebase configuration
│   └── validate-import.js           # Post-import validation
│
├── Templates
│   ├── client-config-template.json  # Client configuration template
│   └── config-template.json         # Subcollection config template
│
├── utils/                           # Helper functions
│   ├── environment-config.js
│   ├── field-validator.js
│   ├── timestamp-converter.js
│   └── ...
│
└── archive-old-scripts/             # Archived/deprecated scripts
    └── scripts-2025-08-06/          # Today's archive
```

## 🔑 Key Features

1. **Unified Import**: Single script handles all clients and environments
2. **Config Protection**: Won't overwrite existing client-config.json or config.json
3. **Environment Support**: Dev, Staging, and Production via FIRESTORE_ENV
4. **Auto-detection**: Detects modern vs legacy import approach
5. **Validation**: Includes post-import validation
6. **Cross-reference**: Generates HOA Transaction cross-reference files

## 📝 Notes

- Always run from the `scripts/client-onboarding` directory
- Set `FIRESTORE_ENV` before running for non-dev environments
- See `IMPORT_GUIDE.md` for detailed documentation
- Old/deprecated scripts are archived in `archive-old-scripts/`

## 🏢 Client-Specific Configurations

### AVII (Quarterly Billing)
**AVII uses quarterly billing for both HOA Dues and Water Bills**

**Setup Steps:**
```bash
# 1. Create AVII client (if not exists)
# 2. Configure for quarterly billing
node scripts/client-onboarding/setup-avii-config.js

# 3. Validate configuration
node scripts/client-onboarding/validate-avii-quarterly.js

# 4. Import data
./run-complete-import.sh AVII ../../AVIIdata

# 5. Generate quarterly water bills
node backend/scripts/generateWaterQ1Bills.js
```

**Key Settings:**
- Fiscal year: July 1 - June 30
- HOA Dues: Quarterly (Q1, Q2, Q3, Q4)
- Water Bills: Quarterly (bill IDs: 2026-Q1, 2026-Q2, etc.)
- Penalty grace period: 30 days (vs 10 days for monthly)
- Configuration: `config/avii-import-config.js`

### MTC (Monthly Billing)
**MTC uses monthly billing for both HOA Dues and Water Bills**

**Setup Steps:**
```bash
# Standard import process
./run-complete-import.sh MTC
```

**Key Settings:**
- Fiscal year: January 1 - December 31
- HOA Dues: Monthly (one bill per month)
- Water Bills: Monthly (bill IDs: 2025-00, 2025-01, etc.)
- Penalty grace period: 10 days
- Configuration: `config/mtc-import-config.js`

## ⚠️ Important

- The setup-client-config.js script will preserve existing configuration files
- Account names in client-config.json must match those in Transactions.json
- All amounts should be in cents (multiply dollars by 100)
- AVII requires quarterly billing configuration before data import
- Run `validate-avii-quarterly.js` to verify quarterly billing is properly configured