# SAMS Deployment Guide

> **Last Updated**: October 11, 2025  
> **Status**: Production on Firebase

## Quick Reference

### Deploy Everything
```bash
cd frontend/sams-ui && npm run build && cd ../.. && firebase deploy
```

### Deploy Frontend Only
```bash
cd frontend/sams-ui && npm run build && cd ../.. && firebase deploy --only hosting
```

### Deploy Backend Only
```bash
firebase deploy --only functions:api
```

### Verify Deployment
```bash
curl https://sams-sandyland-prod.web.app/system/health
```

## Production URLs

- **Frontend**: https://sams-sandyland-prod.web.app
- **Custom Domain**: https://sams.sandyland.com.mx
- **Backend API**: Same domain (Firebase Hosting rewrites)
- **Firebase Console**: https://console.firebase.google.com/project/sams-sandyland-prod

## Architecture

### Frontend
- Built with Vite/React
- Deployed to Firebase Hosting
- Static files served from `frontend/sams-ui/dist/`

### Backend
- Express.js API
- Deployed as Firebase Cloud Function v2
- Source in `backend/` (copied to `functions/backend/` during deploy)
- Uses Firebase default credentials in production

### Database
- Firestore (native Firebase)
- No separate deployment needed

## Important Notes

⚠️ **DO NOT USE VERCEL** - System migrated to Firebase October 2025

✅ **Service Account Keys**
- Production uses Firebase's built-in authentication
- Local development uses `backend/serviceAccountKey.json` (gitignored)
- Never commit service account keys to git

✅ **Environment Variables**
- Frontend: `frontend/sams-ui/.env.production` (gitignored)
- Backend: Automatic in production, local uses serviceAccountKey.json

## Prerequisites

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Select project
firebase use sams-sandyland-prod
```

## Local Development

```bash
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend  
cd frontend/sams-ui && npm run dev
```

## Troubleshooting

### Check Function Logs
```bash
firebase functions:log --only api
```

### Test Endpoints
```bash
# Health check
curl https://sams-sandyland-prod.web.app/system/health

# Version
curl https://sams-sandyland-prod.web.app/system/version

# Exchange rates
curl https://sams-sandyland-prod.web.app/system/exchange-rates/check
```

### Rollback
1. Go to Firebase Console > Hosting > Release History
2. Click "Rollback" on previous version

OR deploy previous git commit:
```bash
git checkout [previous-commit]
firebase deploy
git checkout main
```

## Full Documentation

See [docs/DEPLOYMENT_PROCEDURE_2025.md](docs/DEPLOYMENT_PROCEDURE_2025.md) for complete procedures.

