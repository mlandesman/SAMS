# Production Deployment Setup Notes

**IMPORTANT**: Before running the deployment scripts, you need to configure the Firebase service account keys.

## Service Account Configuration

### Development Environment
The scripts expect a development service account key at:
- `firebase-adminsdk.json` (in project root)

### Production Environment  
The scripts expect a production service account key at:
- `firebase-keys/sams-production-firebase-adminsdk.json`

**Current Status**:
- Found `serviceAccountKey-prod.json` in project root
- This likely needs to be renamed/moved for the scripts

## Setup Steps

1. **Create firebase-keys directory** (if not exists):
```bash
mkdir -p firebase-keys
```

2. **Configure service accounts**:
```bash
# For production (update script paths or copy file)
cp serviceAccountKey-prod.json firebase-keys/sams-production-firebase-adminsdk.json

# For development (verify this exists)
# Should be firebase-adminsdk.json in root
```

3. **Update Project IDs** in scripts if needed:
- Development: `sandyland-management-system` 
- Production: `sams-production` (verify this matches your actual production project)

## Environment Variables

Make sure these are set for production deployment:
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `FIREBASE_PROJECT_ID`
- Other Firebase configuration values

## Script Modifications Needed

If your service account files are in different locations, update these lines in each script:

```javascript
// In backup-production-exchangerates.js and other prod scripts:
const PRODUCTION_SERVICE_ACCOUNT = path.join(__dirname, '../firebase-keys/sams-production-firebase-adminsdk.json');

// In export-dev-to-production.js:
const DEV_SERVICE_ACCOUNT = path.join(__dirname, '../firebase-adminsdk.json');
```

## Verification Before Deployment

1. Check Firebase project IDs match your actual projects
2. Verify service account keys have correct permissions
3. Test script connections with dry-run where available
4. Ensure Vercel has production environment configured

## Security Note

**NEVER** commit service account keys to version control. Add to `.gitignore`:
```
firebase-adminsdk.json
serviceAccountKey*.json
firebase-keys/
```