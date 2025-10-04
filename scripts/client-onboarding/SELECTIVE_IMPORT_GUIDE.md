# Selective Import/Purge Guide

This guide explains how to use the selective import and purge capabilities for SAMS client data management.

## Overview

The selective import/purge system allows you to:
- Purge only specific collections from production
- Import only specific collections
- Preserve static data (users, client config) while updating variable data
- Run dry-runs to preview what will be affected

## Available Collections

| Collection | Description | Dependencies | Notes |
|------------|-------------|--------------|-------|
| `clients` | Client configuration and settings | None | Root level, required for all other data |
| `users` | User accounts within the client | clients | Often preserved during reimports |
| `units` | Property units | clients | Required for HOA dues |
| `transactions` | Financial transactions | clients, accounts, categories, vendors | Updates account balances |
| `hoadues` | HOA dues records | clients, units | Requires units |
| `categories` | Transaction categories | clients | Required for transactions |
| `vendors` | Vendor records | clients | Required for transactions |
| `yearEndBalances` | Starting balances | clients, accounts | Import before transactions |
| `accounts` | Chart of accounts | clients | Required for transactions |
| `paymentMethods` | Payment methods | clients | Optional |

## Command Reference

### Selective Purge

```bash
node purge-prod-client-selective.js --client CLIENT_ID [options]
```

Options:
- `--skip-users` - Don't purge users collection
- `--skip-clients` - Don't purge client config/settings
- `--skip-units` - Don't purge units
- `--skip-vendors` - Don't purge vendors
- `--skip-categories` - Don't purge categories
- `--skip-accounts` - Don't purge accounts
- `--only <collections>` - Only purge specific collections (comma-separated)
- `--force` - Skip confirmation prompt
- `--dry-run` - Show what would be deleted without actually deleting

### Selective Import

```bash
./run-complete-import-selective.sh CLIENT_ID [options]
```

Options:
- `--skip-users` - Don't import users
- `--skip-clients` - Don't import client config/settings
- `--skip-units` - Don't import units
- `--skip-transactions` - Don't import transactions
- `--skip-hoadues` - Don't import HOA dues
- `--skip-categories` - Don't import categories
- `--skip-vendors` - Don't import vendors
- `--skip-yearend` - Don't import year-end balances
- `--skip-accounts` - Don't import accounts
- `--only <collections>` - Only import specific collections (comma-separated)
- `--data-path <path>` - Custom data path (default: ../../{CLIENT_ID}data)
- `--force` - Skip confirmation prompt

## Common Scenarios

### 1. Update Only Transactions and HOA Dues

This is useful when you need to refresh transaction data without touching user accounts or configuration.

```bash
# First, purge only transactions and HOA dues
node purge-prod-client-selective.js --client AVII --only transactions,hoadues

# Then import only those collections
./run-complete-import-selective.sh AVII --only transactions,hoadues
```

### 2. Preserve Users and Client Config

Reimport all data except users and client configuration. Useful when migrating data but keeping existing user access intact.

```bash
# Purge everything except users and client config
node purge-prod-client-selective.js --client AVII --skip-users --skip-clients

# Import everything except users and client config
./run-complete-import-selective.sh AVII --skip-users --skip-clients
```

### 3. Update Variable Data Only

Update frequently changing data (transactions, HOA dues, units) while preserving static configuration.

```bash
# Purge variable data
node purge-prod-client-selective.js --client AVII --only transactions,hoadues,units

# Import in correct order (units before HOA dues)
./run-complete-import-selective.sh AVII --only units,transactions,hoadues
```

### 4. Dry Run to Preview Changes

Check what would be deleted before actually purging.

```bash
# See what would be deleted
node purge-prod-client-selective.js --client AVII --only transactions --dry-run

# If satisfied, run without dry-run
node purge-prod-client-selective.js --client AVII --only transactions
```

### 5. Force Mode (Skip Confirmations)

Use `--force` to skip confirmation prompts in automation scripts.

```bash
# Purge without confirmation
node purge-prod-client-selective.js --client AVII --only transactions --force

# Import without confirmation
./run-complete-import-selective.sh AVII --only transactions --force
```

## Dependencies and Import Order

Some collections depend on others. The system handles these dependencies automatically, but be aware:

1. **Client** must exist before any other data
2. **Accounts** must exist before year-end balances or transactions
3. **Categories** and **Vendors** must exist before transactions
4. **Units** must exist before HOA dues
5. **Year-end balances** should be imported before transactions for correct balance calculations

## Best Practices

1. **Always backup before purging** - While the system requires backups for full purges, consider manual backups for selective operations

2. **Use dry-run first** - Preview what will be affected:
   ```bash
   node purge-prod-client-selective.js --client AVII --only transactions --dry-run
   ```

3. **Consider dependencies** - When importing transactions, ensure categories and vendors are present

4. **Preserve static data** - Keep users and client config when possible to avoid disrupting access

5. **Test in staging first** - Before running in production:
   ```bash
   FIRESTORE_ENV=staging node purge-prod-client-selective.js --client AVII --only transactions
   ```

## Troubleshooting

### Import fails due to missing dependencies

If you see errors about missing categories or vendors when importing transactions:
```bash
# Import the dependencies first
./run-complete-import-selective.sh AVII --only categories,vendors,transactions
```

### HOA dues import fails

Make sure units are imported first:
```bash
./run-complete-import-selective.sh AVII --only units,hoadues
```

### Need to see import logs

Check the migration directory:
```bash
ls -la scripts/client-onboarding/migrations/AVII-latest/
cat scripts/client-onboarding/migrations/AVII-latest/migration.log
```

## Environment Variables

- `FIRESTORE_ENV` - Set to `prod`, `staging`, or `dev` (default: `dev`)
- `IMPORT_CLIENT_ID` - Automatically set by import scripts
- `IMPORT_DATA_PATH` - Automatically set by import scripts

## Safety Features

1. **Backup verification** - Full purges require backups to exist
2. **Confirmation prompts** - Must type client ID or "analyze" to confirm
3. **Dry-run mode** - Preview changes without affecting data
4. **Detailed logging** - All operations are logged to migration directory
5. **Transaction integrity** - Import order ensures data consistency

## Advanced Usage

### Custom Collection Combinations

You can combine multiple collections in creative ways:

```bash
# Purge all financial data but keep configuration
node purge-prod-client-selective.js --client AVII \
  --only transactions,hoadues,yearEndBalances,accounts

# Import only reference data
./run-complete-import-selective.sh AVII \
  --only categories,vendors,paymentMethods
```

### Scripted Migrations

Create scripts for common operations:

```bash
#!/bin/bash
# update-transactions.sh
CLIENT=$1
echo "Updating transactions for $CLIENT..."
node purge-prod-client-selective.js --client $CLIENT --only transactions --force
./run-complete-import-selective.sh $CLIENT --only transactions --force
echo "Transaction update complete!"
```

## Summary

The selective import/purge system gives you fine-grained control over data management:
- Purge only what needs updating
- Import only what was changed
- Preserve user access and configuration
- Maintain data integrity through proper import order
- Preview changes with dry-run mode

Always consider dependencies and test in a non-production environment first!