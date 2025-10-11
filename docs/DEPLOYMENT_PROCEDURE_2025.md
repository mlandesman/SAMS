# SAMS Deployment Procedure (October 2025)

**Status**: ACTIVE  
**Last Updated**: 2025-10-11  
**Priority**: CRITICAL - All agents MUST follow this procedure

## ⚠️ IMPORTANT: FIREBASE HOSTING ONLY

**The SAMS production system has been migrated from Vercel to Firebase Hosting and Cloud Functions v2.**

- ❌ **DO NOT USE VERCEL** - The system is no longer deployed to Vercel
- ✅ **USE FIREBASE ONLY** - All deployments are now through Firebase
- 🔥 **Single Platform** - Frontend and Backend both on Firebase

## Current Deployment Status

### ✅ What's Working
1. Production deployments via Firebase CLI
2. Firebase Cloud Functions v2 for backend API
3. Firebase Hosting for frontend
4. Automatic service account authentication in Cloud Functions
5. Environment variables properly configured
6. Build processes are stable

### 🚫 What's Deprecated
1. ~~Vercel deployment~~ - NO LONGER USED
2. ~~sams-deploy CLI~~ - Not needed with Firebase
3. ~~Separate frontend/backend hosts~~ - Now unified on Firebase

## Production Environment

- **Frontend URL**: https://sams-sandyland-prod.web.app (also: https://sams.sandyland.com.mx)
- **Backend API**: Same domain via Firebase Hosting rewrites
- **Firebase Project**: `sams-sandyland-prod`
- **Region**: us-central1
- **Node Version**: 22

## Approved Deployment Process

### Pre-Deployment Checklist
- [ ] Have you tested your changes locally?
- [ ] Have you run the build command to verify no errors?
- [ ] Are you deploying from the correct branch?
- [ ] Have you communicated with the team about the deployment?

### Full Stack Deployment (Recommended)

```bash
# From project root
# 1. Build frontend
cd frontend/sams-ui
npm run build
cd ../..

# 2. Deploy everything to Firebase
firebase deploy

# This deploys:
# - Frontend (hosting)
# - Backend API (Cloud Functions)
# - Firestore rules
# - Storage rules
```

### Frontend Only Deployment

```bash
# From project root
# 1. Build the frontend
cd frontend/sams-ui
npm run build
cd ../..

# 2. Deploy hosting only
firebase deploy --only hosting
```

### Backend Only Deployment

```bash
# From project root
# Deploy Cloud Functions only
firebase deploy --only functions:api

# Note: The predeploy script automatically copies backend files to functions/
```

### Firestore Rules Deployment

```bash
# From project root
firebase deploy --only firestore:rules
```

## How It Works

### Backend Architecture
- Backend code lives in `backend/` directory
- Firebase predeploy script copies `backend/*` to `functions/backend/`
- Cloud Function `api` wraps the Express app from `backend/index.js`
- Uses Firebase default credentials (no service account file in production)

### Frontend Architecture
- Frontend builds to `frontend/sams-ui/dist/`
- Firebase Hosting serves static files
- API calls go to same origin (empty baseUrl in production)
- Hosting rewrites route API paths to Cloud Function

### Routing Configuration
Firebase Hosting rewrites handle all API routes:
- `/system/**` → Cloud Function `api`
- `/auth/**` → Cloud Function `api`
- `/clients` and `/clients/**` → Cloud Function `api`
- `/water/**` → Cloud Function `api`
- `/hoadues/**` → Cloud Function `api`
- `/admin/**` → Cloud Function `api`
- `/comm/**` → Cloud Function `api`
- Everything else → `/index.html` (SPA)

## Post-Deployment Verification

### Required Checks
1. **Health Check**
   ```bash
   curl https://sams-sandyland-prod.web.app/system/health
   # Should return: {"status":"ok","timestamp":"...","environment":"production"}
   ```

2. **Version Check**
   ```bash
   curl https://sams-sandyland-prod.web.app/system/version
   # Should return backend version info
   ```

3. **Frontend Check**
   - Visit https://sams-sandyland-prod.web.app
   - Can users log in?
   - Do API calls succeed?
   - Are clients loading?

4. **Function Logs**
   ```bash
   firebase functions:log --only api
   # Check for errors
   ```

### If Deployment Fails

1. **Check build output** for errors
2. **Check Firebase Console** for deployment status
3. **Check function logs** for runtime errors:
   ```bash
   firebase functions:log --only api
   ```
4. **Roll back if necessary** (see Rollback section)

## Rollback Procedures

### Firebase Hosting Rollback
```bash
# Firebase keeps previous versions
# View in Firebase Console > Hosting > Release History
# Click "Rollback" on previous version
```

### Firebase Functions Rollback
```bash
# Deploy previous working version from git
git checkout [last-working-commit]
firebase deploy --only functions:api
git checkout main
```

## Environment Configuration

### Frontend Environment Variables
Configured in `frontend/sams-ui/.env.production`:
- `VITE_FIREBASE_API_KEY` - Firebase Web API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - FCM sender ID
- `VITE_FIREBASE_APP_ID` - Firebase app ID
- `VITE_API_BASE_URL` - Empty string (same origin)
- `VITE_APP_ENV` - production
- `VITE_APP_URL` - https://sams.sandyland.com.mx

### Backend Configuration
- **Production**: Uses Firebase default application credentials automatically
- **Local Development**: Uses `backend/serviceAccountKey.json` (gitignored)
- **Staging**: Uses `backend/serviceAccountKey-staging.json` (gitignored)

⚠️ **NEVER commit service account keys to git!** They are in `.gitignore`.

## Local Development

### Running Locally
```bash
# Terminal 1 - Backend
cd backend
npm install
npm start
# Runs on http://localhost:5001

# Terminal 2 - Frontend
cd frontend/sams-ui
npm install
npm run dev
# Runs on http://localhost:5173
```

### Testing with Firebase Emulators
```bash
# From project root
firebase emulators:start

# Starts:
# - Functions emulator (port 8001)
# - Firestore emulator (port 8080)
# - UI (port 4000)
```

## Security Notes

### Service Account Keys
- ❌ **NEVER commit service account keys to git**
- ✅ Keep them in local project root (they're gitignored)
- ✅ Production uses Firebase's built-in authentication
- ✅ All `*serviceAccountKey*.json` and `*firebase-adminsdk*.json` files are gitignored

### Firebase Console Access
- Only authorized developers have Firebase Console access
- Service accounts are managed in Firebase Console > Project Settings > Service Accounts

## Deployment Schedule

### Best Practices
1. **Deploy during low-usage hours** (early morning or late evening Mexico time)
2. **Monitor for 15-30 minutes** after deployment
3. **Check logs immediately** after deployment
4. **Test critical paths** (login, client selection, basic operations)

### Deployment Windows
- **Preferred**: 6 AM - 8 AM CST (Mexico)
- **Acceptable**: 8 PM - 10 PM CST (Mexico)
- **Avoid**: Business hours (9 AM - 6 PM CST)

## Agent Instructions

### For Implementation Agents
1. **ALWAYS** use Firebase CLI for deployments
2. **NEVER** attempt to deploy to Vercel
3. **DOCUMENT** all deployments in your completion logs
4. **VERIFY** deployments succeeded using the checks above
5. **MONITOR** logs after deployment

### For Manager Agents
1. **ENSURE** all task assignments reference this document
2. **VERIFY** completion logs show Firebase deployment
3. **REJECT** any work attempting Vercel deployment

### For Debug Agents
1. **CHECK** Firebase function logs when debugging issues
2. **VERIFY** correct Firebase project is selected
3. **DOCUMENT** any deployment-related problems

## Common Issues and Solutions

### "Command not found: firebase"
```bash
npm install -g firebase-tools
firebase login
firebase use sams-sandyland-prod
```

### "Firebase deployment failed"
1. Check Firebase authentication: `firebase login`
2. Verify project selection: `firebase projects:list`
3. Ensure you're on correct project: `firebase use sams-sandyland-prod`

### "Build failed"
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Clear dist: `rm -rf dist && npm run build`
3. Check for TypeScript/linting errors

### "Function deployment failed"
1. Check predeploy script output
2. Verify backend files copied to functions/backend/
3. Check function logs: `firebase functions:log`

### "CORS errors in browser"
- Frontend should use empty string for `VITE_API_BASE_URL` in production
- Check `frontend/sams-ui/src/config/index.js` returns `''` for prod

## Migration Notes (October 2025)

### What Changed
- **Removed**: Vercel hosting for frontend and backend
- **Added**: Firebase Hosting for frontend
- **Added**: Firebase Cloud Functions v2 for backend
- **Changed**: Backend uses default credentials in production
- **Changed**: Frontend API calls go to same origin

### Why Firebase?
1. **Simplicity**: Single platform for everything
2. **Cost**: More cost-effective for our usage
3. **Integration**: Better integration with Firestore/Storage
4. **Security**: No service account keys in repository
5. **Reliability**: Works perfectly in development, now in production

---

**Remember**: The development environment still works the same way (localhost). Only production deployment has changed to Firebase.
