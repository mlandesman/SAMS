# SAMS Client Data Import Guide

## Quick Start

Use the unified import script for ALL client imports:

```bash
cd scripts/client-onboarding
./run-complete-import.sh <CLIENT_ID> [DATA_PATH]
```

## Examples

### Import MTC Data
```bash
./run-complete-import.sh MTC
# or explicitly:
./run-complete-import.sh MTC ../../MTCdata
```

### Import AVII Data
```bash
./run-complete-import.sh AVII ../../AVIIdata
```

### Import New Client
```bash
./run-complete-import.sh NEWCLIENT ../../NEWCLIENTdata
```

## Environment Selection

Set FIRESTORE_ENV before running to target different environments:

```bash
# Development (default)
./run-complete-import.sh MTC

# Staging
FIRESTORE_ENV=staging ./run-complete-import.sh MTC

# Production
FIRESTORE_ENV=prod ./run-complete-import.sh MTC
```

## Important Features

1. **Config File Protection**: The script will NOT overwrite existing `client-config.json` or `config.json` files in your data directory
2. **Auto-detection**: Automatically detects whether to use modern JSON import or legacy step-by-step import
3. **Environment-aware**: Shows correct Firebase project based on FIRESTORE_ENV
4. **Validation**: Runs validation scripts if available
5. **Cross-reference**: Generates HOA Transaction cross-reference files

## Data Directory Structure

Your data directory should contain:
- `client-config.json` - Client configuration (required)
- `config.json` - Subcollection config (activities, email)
- `Categories.json` - Category definitions
- `Vendors.json` - Vendor list
- `PaymentMethods.json` - Payment methods
- `Units.json` - Unit definitions
- `Transactions.json` - Transaction records
- `HOADues.json` - HOA dues records

## Troubleshooting

If import fails:
1. Check that all required JSON files exist in the data directory
2. Verify FIRESTORE_ENV matches your intended target
3. Ensure client-config.json has correct structure
4. Check account names match between client-config.json and Transactions.json