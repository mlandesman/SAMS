# SAMS Backup Scripts - Quick Reference

## 🎯 Quick Start - Use the Menu!

**Easiest way to use the system:**
```bash
cd scripts/backup
./backup-menu.sh
```

This provides an interactive menu for all operations.

---

# SAMS Backup Scripts - Quick Reference

## By Function

### Setup
| Script | Purpose | Command |
|--------|---------|---------|
| `setup-gcs-bucket.sh` | Create GCS bucket & configure permissions | `./setup-gcs-bucket.sh` |

### Backup
| Script | Purpose | Command |
|--------|---------|---------|
| `backup-prod.sh` | Create production backup | `./backup-prod.sh --tag=manual`<br>`./backup-prod.sh --tag=nightly`<br>`./backup-prod.sh --tag=pre-deploy` |

### Restore
| Script | Purpose | Command |
|--------|---------|---------|
| `restore-dev-from-prod.sh` | Restore Dev from Prod (preserves Dev users) | `./restore-dev-from-prod.sh --backup=latest`<br>`./restore-dev-from-prod.sh --backup=YYYY-MM-DD` |
| `restore-prod.sh` | Disaster recovery for Production | `./restore-prod.sh --backup=YYYY-MM-DD --confirm` |

### List & Copy
| Script | Purpose | Command |
|--------|---------|---------|
| `list-backups.sh` | List available backups | `./list-backups.sh`<br>`./list-backups.sh --project=prod`<br>`./list-backups.sh --project=dev` |
| `copy-backup-offsite.sh` | Copy backup to local/S3/Drive | `./copy-backup-offsite.sh --backup=latest --destination=local`<br>`./copy-backup-offsite.sh --backup=latest --destination=local --compress`<br>`./copy-backup-offsite.sh --backup=latest --destination=s3` |

## By Platform

### macOS / Linux
All scripts work on macOS and Linux:
```bash
cd scripts/backup
chmod +x *.sh  # Make executable (one-time)
./script-name.sh [options]
```

### Windows (WSL / Git Bash)
All scripts work in WSL or Git Bash:
```bash
cd scripts/backup
bash script-name.sh [options]
```

## Common Workflows

### Daily Backup
```bash
./backup-prod.sh --tag=nightly
```

### Pre-Deployment Backup
```bash
./backup-prod.sh --tag=pre-deploy
```

### Refresh Dev Environment
```bash
./list-backups.sh
./restore-dev-from-prod.sh --backup=latest
```

### Off-Site Backup Copy
```bash
# Local compressed copy
./copy-backup-offsite.sh --backup=latest --destination=local --compress

# AWS S3 copy
./copy-backup-offsite.sh --backup=latest --destination=s3
```

### Disaster Recovery
```bash
./list-backups.sh --project=prod
./restore-prod.sh --backup=YYYY-MM-DD --confirm
```

## Prerequisites

- **gcloud CLI** - Required for all scripts
- **gsutil** - Included with gcloud
- **Node.js** - Required for collection discovery
- **AWS CLI** - Required only for S3 destination
- **rclone/gdrive** - Required only for Google Drive destination

## Quick Commands Cheat Sheet

```bash
# Setup (one-time)
./setup-gcs-bucket.sh

# Backup
./backup-prod.sh --tag=manual

# List
./list-backups.sh

# Restore Dev
./restore-dev-from-prod.sh --backup=latest

# Copy Off-Site
./copy-backup-offsite.sh --backup=latest --destination=local --compress

# Disaster Recovery (Production)
./restore-prod.sh --backup=YYYY-MM-DD --confirm
```

