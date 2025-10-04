# Selective Import/Purge System

## Overview

The selective import/purge system has been implemented to give you fine-grained control over which data collections are purged and imported. This allows you to:

- Update only specific data (e.g., just transactions)
- Preserve static data (users, client config) during reimports
- Run dry-runs to preview changes before execution

## New Scripts

### 1. `purge-prod-client-selective.js`
Selectively purge collections from production with options to:
- Skip specific collections (`--skip-users`, `--skip-clients`, etc.)
- Only purge specific collections (`--only transactions,hoadues`)
- Run in dry-run mode (`--dry-run`)
- Force execution without prompts (`--force`)

### 2. `run-complete-import-selective.sh`
Selectively import collections with options to:
- Skip specific collections (`--skip-users`, `--skip-transactions`, etc.)
- Only import specific collections (`--only transactions,units`)
- Specify custom data path (`--data-path`)
- Force execution without prompts (`--force`)

### 3. Example Scripts (in `examples/` directory)
- `update-transactions-only.sh` - Update only transaction data
- `preserve-users-reimport.sh` - Reimport everything except users/config
- `update-variable-data.sh` - Update transactions, HOA dues, and units

## Quick Start

### Update only transactions:
```bash
cd scripts/client-onboarding
node purge-prod-client-selective.js --client AVII --only transactions
./run-complete-import-selective.sh AVII --only transactions
```

### Preserve users during full reimport:
```bash
cd scripts/client-onboarding
node purge-prod-client-selective.js --client AVII --skip-users --skip-clients
./run-complete-import-selective.sh AVII --skip-users --skip-clients
```

### Dry run to see what would be deleted:
```bash
node purge-prod-client-selective.js --client AVII --only transactions --dry-run
```

## Dependencies

See `import-dependencies.json` for detailed collection dependencies. Key points:
- `clients` must exist before any other data
- `accounts` required for transactions and year-end balances
- `categories` and `vendors` required for transactions
- `units` required for HOA dues (HOA dues are stored as subcollections)

## Important Notes

1. **HOA Dues**: Currently imported as part of units (subcollection). The system can purge them separately but import happens with units.

2. **Import Order**: The system automatically handles dependencies, but be aware of the logical order when doing selective imports.

3. **Backup**: Full purges still require backups. Selective purges don't enforce this but backups are recommended.

4. **Environment**: Set `FIRESTORE_ENV` to target different environments:
   ```bash
   FIRESTORE_ENV=staging node purge-prod-client-selective.js --client AVII --dry-run
   ```

## Common Use Cases

1. **Monthly transaction updates**: Use `examples/update-transactions-only.sh`
2. **Data migration preserving users**: Use `examples/preserve-users-reimport.sh`
3. **Update variable data**: Use `examples/update-variable-data.sh`

## Full Documentation

See `SELECTIVE_IMPORT_GUIDE.md` for comprehensive documentation including:
- Detailed command reference
- All available options
- Troubleshooting guide
- Best practices
- Advanced usage examples