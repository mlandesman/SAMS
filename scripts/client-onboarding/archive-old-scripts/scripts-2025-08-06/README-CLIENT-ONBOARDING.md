# Client Onboarding Guide

## Overview

This directory contains scripts for onboarding new clients to SAMS. The scripts have been updated to support multiple clients through parameterization.

## New Client Setup Workflow

### 1. Create Client Configuration
```bash
cd scripts/client-onboarding
node setup-client-config.js AVII
```

This creates at the SAMS root level:
- `/AVIIdata/` directory
- `/AVIIdata/client-config.json` template

### 2. Edit Configuration
Open `AVIIdata/client-config.json` and update:
- Company name and contact info
- Address details  
- **🚨 CRITICAL: Account Names** - MUST match exactly what's in Transactions.json
  - Check the "account" field in your Transactions.json
  - Update account names in config to match (e.g., "Scotiabank", "Petty Cash")
  - Names are case-sensitive and must match EXACTLY
- Year-end balances (in CENTS - e.g., 10000 = $100.00)
- Property information
- Primary contact details

### 3. Add Data Files
Copy JSON files to `AVIIdata/`:
- Categories.json
- Vendors.json
- PaymentMethods.json
- Units.json
- Transactions.json
- HOADues.json

### 4. Run Import
```bash
node import-client-data.js --client-id AVII
```

## Quick Start - Onboarding AVII

### Interactive Mode (Recommended)
```bash
cd scripts/client-onboarding
node import-client-data.js --interactive
```

This will:
1. Prompt for Client ID (enter: AVII)
2. Prompt for data path (default: ./AVIIdata)
3. Verify all required JSON files exist
4. Run all imports in sequence

### Command Line Mode
```bash
cd scripts/client-onboarding
node import-client-data.js --client-id AVII --data-path ../../AVIIdata --env dev
```

## How It Works

### 1. Master Orchestrator: `import-client-data.js`
- Accepts client ID and data path as parameters
- Validates data directory and required files
- Runs all import scripts in correct sequence
- Passes configuration via environment variables

### 2. Environment Variables
All import scripts now read these environment variables:
- `IMPORT_CLIENT_ID` - The client ID (e.g., AVII)
- `IMPORT_DATA_PATH` - Path to data directory
- `IMPORT_ENVIRONMENT` - Firebase environment (dev/staging/prod)

### 3. Import Sequence
1. **Client Creation** - Creates client record and collections
2. **Payment Methods** - Imports payment methods with active status
3. **Categories** - Imports expense categories
4. **Vendors** - Imports vendor records
5. **Units** - Imports property units
6. **Transactions** - Imports financial transactions
7. **HOA Dues** - Imports HOA payment records

## Required Data Files

Your data directory must contain:
- `Categories.json`
- `Vendors.json`
- `PaymentMethods.json`
- `Units.json`
- `Transactions.json`
- `HOADues.json`

Optional files:
- `Users.json` (if not present, admin users created manually)
- `AutoCategorize.json` (for transaction categorization rules)

## Adding New Clients

### Method 1: Update create-client.js
Add client configuration to `CLIENT_CONFIGS` object:

```javascript
AVII: {
  name: 'Aventuras Villas II',
  shortName: 'AVII',
  address: { ... },
  yearEndBalances: {
    bank: 0,
    cash: 0
  }
}
```

### Method 2: Use Minimal Config
For clients without predefined config, the system will create a minimal setup that can be updated later.

## Individual Script Usage

You can still run individual import scripts:

```bash
# Set environment variables
export IMPORT_CLIENT_ID=AVII
export IMPORT_DATA_PATH=../../AVIIdata

# Run individual script
node import-payment-methods-with-crud.js
```

## Troubleshooting

### "Directory not found" Error
- Ensure data directory path is correct
- Use absolute paths if needed
- Check you're in the correct working directory

### "Missing required files" Error
- Verify all JSON files are present
- Check file names match exactly (case-sensitive)
- Ensure files are valid JSON

### Import Failures
- Check Firebase credentials and environment
- Verify client doesn't already exist
- Review error messages in console
- Check generated results file: `import-results-{CLIENT_ID}-{timestamp}.json`

## Legacy Support

Original MTC scripts still work with their hardcoded values if environment variables are not set.

## Configuration Template Benefits

The new file-based configuration system provides:

1. **No Code Modifications**: Add new clients without touching any JavaScript files
2. **Version Control**: Client configurations can be tracked in git
3. **Validation**: All required fields are validated before client creation
4. **Flexibility**: Easy to override any default values
5. **Documentation**: Template serves as documentation of required fields
6. **Reusability**: Can easily duplicate configs for similar properties

## Configuration Fields Reference

See `config/client-config-template.json` for all available fields. Key sections:
- **Basic Info**: clientId, name, address, contact details
- **Financial**: Currency, fiscal year end, initial balances
- **Accounts**: Bank and cash account definitions (CRITICAL for import success)
  - Account names MUST match exactly what's in Transactions.json
  - Initial balances are automatically set from yearEndBalances
  - Typically includes one bank account and one cash account
- **Features**: Enable/disable system features per client
- **Property Info**: Type, unit count, amenities
- **Branding**: Colors, logo, website
- **Import Settings**: Date formats, currency display

### Account Configuration Example

```json
"accounts": [
  {
    "id": "bank-001",
    "name": "Scotiabank",  // Must match Transactions.json exactly!
    "type": "bank",
    "currency": "MXN",
    "initialBalance": 0  // Will be overridden by yearEndBalances.bank
  },
  {
    "id": "cash-001",
    "name": "Petty Cash",  // Must match Transactions.json exactly!
    "type": "cash",
    "currency": "MXN",
    "initialBalance": 0  // Will be overridden by yearEndBalances.cash
  }
]
```

## Next Steps

After successful import:
1. Verify data in Firebase Console
2. Create admin users for the client
3. Test login and basic functionality
4. Configure client-specific settings (activities menu, email templates)
5. Run `setup-firebase-config.js` for activity menu and email settings

---
Last Updated: July 31, 2025