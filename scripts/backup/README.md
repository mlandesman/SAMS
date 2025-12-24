# SAMS Backup & Restore System

Comprehensive backup and restore system for SAMS Firestore database and Firebase Storage.

## Overview

This system enables:
1. **Nightly production backups** (Firestore + Storage)
2. **Dev environment refresh** from Production data
3. **Disaster recovery** for Production

## Quick Start

### Option 1: Interactive Menu (Recommended)

Use the interactive menu system for easy access to all operations:

```bash
cd scripts/backup
./backup-menu.sh
```

This provides a user-friendly menu with all backup and restore options.

### Option 2: Command Line

### 1. Initial Setup

First, create the shared GCS bucket and configure permissions:

```bash
cd scripts/backup
./setup-gcs-bucket.sh
```

This will:
- Create the `sams-shared-backups` GCS bucket
- Configure IAM permissions for Prod and Dev service accounts
- Set up lifecycle policies (auto-delete after 30 days for nightly backups)

### 2. Create Your First Backup

```bash
./backup-prod.sh --tag=manual
```

### 3. List Available Backups

```bash
./list-backups.sh
```

### 4. Restore Dev from Production

```bash
./restore-dev-from-prod.sh --backup=latest
# or specify a date
./restore-dev-from-prod.sh --backup=2025-12-23
```

### 5. Copy Backup Off-Site (Safety)

```bash
# Copy latest backup to local storage
./copy-backup-offsite.sh --backup=latest --destination=local --compress

# Copy specific backup to local storage
./copy-backup-offsite.sh --backup=2025-12-23 --destination=local

# Copy to AWS S3
./copy-backup-offsite.sh --backup=latest --destination=s3
```

## Scripts

### `backup-menu.sh` ⭐ **NEW - Interactive Menu**

Interactive menu system for all backup and restore operations.

**Usage:**
```bash
./backup-menu.sh
```

**Features:**
- Menu-driven interface for all operations
- Color-coded output
- Safety confirmations for destructive operations
- Quick access to all backup/restore functions
- Built-in help and documentation links

**Menu Options:**
- Backup Operations (manual, nightly, pre-deploy)
- Restore Operations (Dev restore, Production disaster recovery)
- Utilities (list backups, off-site copy, verification)
- Information (quick reference, documentation)

### `setup-gcs-bucket.sh`

Creates the shared GCS bucket and configures IAM permissions.

**Usage:**
```bash
./setup-gcs-bucket.sh
```

**What it does:**
- Creates `gs://sams-shared-backups` bucket
- Grants `storage.objectAdmin` to Prod and Dev service accounts
- Grants `datastore.importExportAdmin` for Firestore operations
- Sets lifecycle policy (auto-delete after 30 days for nightly backups)

### `backup-prod.sh`

Creates a full production backup (Firestore + Storage).

**Usage:**
```bash
./backup-prod.sh [--tag=nightly|manual|pre-deploy]
```

**Tags:**
- `nightly` - Automated nightly backups (auto-deleted after 30 days)
- `manual` - Manual backups (kept indefinitely)
- `pre-deploy` - Pre-deployment backups (kept indefinitely)

**What it does:**
1. Discovers all Firestore collections dynamically
2. Exports all collections (except users) to GCS
3. Exports users collection separately
4. Syncs Firebase Storage to GCS
5. Creates manifest file with backup metadata

**Example:**
```bash
# Manual backup
./backup-prod.sh --tag=manual

# Pre-deployment backup
./backup-prod.sh --tag=pre-deploy
```

### `restore-dev-from-prod.sh`

Refreshes Dev environment with Production data (preserves Dev users).

**Usage:**
```bash
./restore-dev-from-prod.sh [--backup=latest|YYYY-MM-DD]
```

**What it does:**
1. Lists available backups
2. Imports Firestore data (excluding users collection)
3. Syncs Storage files
4. **Preserves Dev users** (not overwritten)

**Safety:**
- Requires typing "RESTORE DEV" to confirm
- Only restores non-user collections
- Dev users remain intact

**Example:**
```bash
# Restore from latest backup
./restore-dev-from-prod.sh --backup=latest

# Restore from specific date
./restore-dev-from-prod.sh --backup=2025-12-23
```

### `restore-prod.sh`

Disaster recovery for Production (includes users).

**Usage:**
```bash
./restore-prod.sh --backup=YYYY-MM-DD --confirm
```

**⚠️ CRITICAL WARNING:**
- This **OVERWRITES ALL Production data**
- Includes users collection
- Cannot be undone
- Requires typing project ID and "RESTORE PRODUCTION" to confirm

**What it does:**
1. Imports all Firestore collections (including users)
2. Imports users collection separately
3. Syncs Storage files
4. Logs all operations

**Example:**
```bash
./restore-prod.sh --backup=2025-12-23 --confirm
```

### `list-backups.sh`

Lists all available backups with metadata.

**Usage:**
```bash
./list-backups.sh [--project=prod|dev]
```

**What it shows:**
- Backup date and tag
- Timestamp
- Source project
- Firestore export status
- Storage sync status
- File count and size

**Example:**
```bash
# List all backups
./list-backups.sh

# List only production backups
./list-backups.sh --project=prod
```

### `copy-backup-offsite.sh`

Copies backups to local storage or alternative cloud storage (Google Drive/S3) for additional safety.

**Why use this?**
- GCS backups and primary data are on the same Google Cloud service
- Provides protection against GCS service-wide issues
- Enables local backup copies for quick access
- Supports multiple storage destinations

**Usage:**
```bash
./copy-backup-offsite.sh [--backup=latest|YYYY-MM-DD] [--destination=local|drive|s3] [--compress] [--local-dir=/path/to/dir]
```

**Options:**
- `--backup=latest|YYYY-MM-DD` - Backup to copy (default: latest)
- `--destination=local|drive|s3` - Where to copy (default: local)
- `--compress` - Compress backup into tar.gz file
- `--local-dir=/path` - Custom local directory (default: ~/SAMS-Backups)

**Destinations:**

1. **Local Storage** (`--destination=local`):
   - Downloads backup to local directory
   - Default location: `~/SAMS-Backups/`
   - Can compress with `--compress` flag
   - Fastest option for local access

2. **Google Drive** (`--destination=drive`):
   - Requires rclone or gdrive CLI setup
   - Provides instructions for setup
   - Falls back to local copy if tools not configured

3. **AWS S3** (`--destination=s3`):
   - Requires AWS CLI configured
   - Prompts for S3 bucket name
   - Copies directly from GCS to S3

**Examples:**
```bash
# Copy latest backup to local storage (compressed)
./copy-backup-offsite.sh --backup=latest --destination=local --compress

# Copy specific backup to local storage
./copy-backup-offsite.sh --backup=2025-12-23 --destination=local

# Copy to custom local directory
./copy-backup-offsite.sh --backup=latest --destination=local --local-dir=/backups/sams

# Copy to AWS S3
./copy-backup-offsite.sh --backup=latest --destination=s3
```

## Backup Strategy

### Firestore Collections

| Component | Treatment |
|-----------|-----------|
| All collections EXCEPT users | Backup together, restore together |
| `users` collection | Backup separately, restore only to same environment |

**Why separate users?**
- Users have Firebase Auth UIDs that are environment-specific
- Dev users ≠ Prod users
- Restoring Prod users to Dev would break authentication

### Storage Backup

| Content Path | Description |
|--------------|-------------|
| `/documents/` | Receipts, statements, uploaded files |
| `/logos/` | Client branding images |
| `/exports/` | Generated reports/exports |

## GCS Bucket Structure

```
gs://sams-shared-backups/
├── firestore/
│   ├── 2025-12-23_nightly/
│   │   ├── all_collections/      # Main Firestore export
│   │   └── users_only/           # Separate users export
│   └── 2025-12-22_nightly/
├── storage/
│   ├── 2025-12-23/
│   │   ├── documents/
│   │   ├── logos/
│   │   └── exports/
│   └── 2025-12-22/
└── manifests/
    ├── 2025-12-23_nightly.json
    └── 2025-12-22_nightly.json
```

## Manifest File Format

Each backup includes a manifest file with metadata:

```json
{
  "timestamp": "2025-12-23T03:00:00Z",
  "tag": "nightly",
  "firestore": {
    "all_collections": "gs://sams-shared-backups/firestore/2025-12-23_nightly/all_collections",
    "users_only": "gs://sams-shared-backups/firestore/2025-12-23_nightly/users_only"
  },
  "storage": {
    "path": "gs://sams-shared-backups/storage/2025-12-23",
    "files_count": 1234,
    "total_size_mb": 567
  },
  "source_project": "sams-sandyland-prod",
  "collections_backed_up": "clients,transactions,categories,vendors"
}
```

## Collection Discovery

The backup system **dynamically discovers** all Firestore collections, so you don't need to update script files when collections change.

The discovery process:
1. Checks known collections (clients, users, exchangeRates, etc.)
2. Explores client subcollections to find nested structures
3. Excludes `users` collection from main backup
4. Outputs list of collections to backup

## Prerequisites

### Required Tools

- `gcloud` CLI (Google Cloud SDK)
- `gsutil` (included with gcloud)
- `node` (for collection discovery)
- Firebase Admin SDK access

### Authentication

Ensure you're authenticated with gcloud:

```bash
gcloud auth login
gcloud config set project sams-sandyland-prod
```

### Service Accounts

The scripts use service account keys located at:
- Production: `functions/serviceAccountKey-prod.json`
- Development: `functions/serviceAccountKey-dev.json`

## Backup Schedule Recommendations

### Production Backups

1. **Nightly Backups** (automated via cron)
   ```bash
   # Add to crontab (runs at 3 AM UTC)
   0 3 * * * /path/to/scripts/backup/backup-prod.sh --tag=nightly
   ```

2. **Pre-Deployment Backups** (before major releases)
   ```bash
   ./backup-prod.sh --tag=pre-deploy
   ```

3. **Manual Backups** (before major data changes)
   ```bash
   ./backup-prod.sh --tag=manual
   ```

### Dev Environment Refresh

Refresh Dev weekly or before major testing:

```bash
./restore-dev-from-prod.sh --backup=latest
```

## Disaster Recovery Procedures

### Scenario 1: Production Data Corruption

1. **Stop all writes** to Production
2. **Identify last good backup:**
   ```bash
   ./list-backups.sh --project=prod
   ```
3. **Restore from backup:**
   ```bash
   ./restore-prod.sh --backup=YYYY-MM-DD --confirm
   ```
4. **Verify restore completed:**
   ```bash
   gcloud firestore operations list --project=sams-sandyland-prod
   ```
5. **Test Production environment**
6. **Resume operations**

### Scenario 2: Dev Environment Refresh

1. **Backup current Dev state** (optional):
   ```bash
   # Create a manual backup of Dev first
   # (Modify backup-prod.sh to backup Dev if needed)
   ```

2. **Restore from Production:**
   ```bash
   ./restore-dev-from-prod.sh --backup=latest
   ```

3. **Verify Dev users still work**
4. **Test Dev environment**

## Troubleshooting

### "Bucket not found" Error

Run the setup script:
```bash
./setup-gcs-bucket.sh
```

### "Permission denied" Error

Check IAM permissions:
```bash
gsutil iam get gs://sams-shared-backups
```

Ensure service accounts have:
- `roles/storage.objectAdmin`
- `roles/datastore.importExportAdmin`

### "Collection discovery failed"

Check service account key path:
```bash
ls functions/serviceAccountKey-prod.json
```

Verify Node.js can access Firebase Admin SDK:
```bash
node discover-collections.js sams-sandyland-prod
```

### Firestore Export/Import Taking Too Long

- Large databases can take 10-30 minutes
- Check operation status:
  ```bash
  gcloud firestore operations list --project=sams-sandyland-prod
  ```
- Operations run asynchronously - don't interrupt

### Storage Sync Issues

- Check source bucket exists:
  ```bash
  gsutil ls gs://sams-sandyland-prod.firebasestorage.app/
  ```
- Verify destination permissions
- Use `-m` flag for parallel transfers (already included)

## Best Practices

1. **Regular Backups**: Run nightly backups automatically
2. **Pre-Deployment**: Always backup before major deployments
3. **Test Restores**: Periodically test restore procedures in Dev
4. **Monitor Storage**: Check backup sizes and GCS costs
5. **Document Changes**: Note any collection structure changes
6. **Verify Backups**: Use `list-backups.sh` to verify backup integrity
7. **Off-Site Copies**: Regularly copy backups off-site using `copy-backup-offsite.sh`
   - Copy critical backups to local storage monthly
   - Consider S3 or Google Drive for long-term archival
   - Compress backups to save space when copying locally

## Cost Considerations

### GCS Storage Costs

- Standard storage: ~$0.020 per GB/month
- Lifecycle policies auto-delete nightly backups after 30 days
- Manual/pre-deploy backups kept indefinitely

### Firestore Export Costs

- Export operations: Free
- Storage of exports: Standard GCS pricing

### Network Egress

- Restores may incur egress costs
- Minimize restore frequency

## Security

- Service account keys are stored locally (gitignored)
- GCS bucket has restricted IAM permissions
- Backup manifests contain no sensitive data
- Users collection backed up separately for security
- **Off-Site Copies**: Use `copy-backup-offsite.sh` to store backups in different services/locations for additional protection

## Support

For issues or questions:
1. Check script logs
2. Review GCS bucket contents
3. Check Firestore operation status
4. Verify service account permissions

## References

- [gcloud firestore export](https://cloud.google.com/sdk/gcloud/reference/firestore/export)
- [gcloud firestore import](https://cloud.google.com/sdk/gcloud/reference/firestore/import)
- [gsutil rsync](https://cloud.google.com/storage/docs/gsutil/commands/rsync)
- [Firestore Backup Documentation](https://cloud.google.com/firestore/docs/manage-data/export-import)

