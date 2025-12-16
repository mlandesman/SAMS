# Archived Vercel Deployment Scripts

**Archive Date**: January 2025  
**Reason**: SAMS migrated from Vercel to Firebase in October 2025

## Archived Files

### Scripts
- `sams-deploy-fixed.sh` - Vercel deployment script for desktop/mobile/backend
- `deploy-helper.sh` - Vercel deployment helper with pre-deployment checks

### TypeScript Project
- `sams-deploy/` - Complete TypeScript deployment automation system
  - Built for multi-environment deployments across Vercel and Firebase
  - Contains Vercel-specific deployers and monitoring
  - Not in active use

## Current Deployment Method

SAMS now uses Firebase exclusively:
- **Primary Script**: `deploySams.sh` (root directory)
- **NPM Scripts**: See `package.json` for `deploy`, `deploy:hosting`, etc.
- **Mobile Script**: `frontend/mobile-app/deploy.sh`

## Notes

These scripts are kept for historical reference only. Do not use for production deployments.
