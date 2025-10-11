# Vercel Frontend Setup Guide

## Current Status (2025-10-11)

### Version Control System: ✅ COMPLETE
- Version bump workflow: Working correctly
- Build-time injection: Verified and tested
- All package.json files synchronized
- Local builds: Producing correct version metadata
- Git commit: f6f35cb (v1.1.1)

### Deployment Architecture: 🔄 NEEDS CONFIGURATION

**Current State:**
- Frontend custom domain: `https://sams.sandyland.com.mx/` (serving old content)
- Vercel project URL: `https://sams-ui-tau.vercel.app/` (404 - not found)
- Backend: `https://backend-liart-seven.vercel.app/` (working, needs update)

**Issue:** GitHub → Vercel auto-deploy not configured for frontend

## Vercel Frontend Setup Steps

### Option 1: Via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Click "Add New Project"

2. **Import Git Repository**
   - Select GitHub
   - Choose repository: `mlandesman/SAMS`
   - Click "Import"

3. **Configure Build Settings**
   ```
   Framework Preset: Other
   Root Directory: Leave empty (uses root vercel.json)
   Build Command: [Uses vercel.json config]
   Output Directory: frontend/sams-ui/dist
   Install Command: npm ci
   ```

4. **Environment Variables**
   Add these in Vercel project settings:
   ```
   VITE_FIREBASE_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN
   VITE_FIREBASE_PROJECT_ID
   VITE_FIREBASE_STORAGE_BUCKET
   VITE_FIREBASE_MESSAGING_SENDER_ID
   VITE_FIREBASE_APP_ID
   VITE_FIREBASE_MEASUREMENT_ID
   VITE_USE_EMULATOR=false
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Verify version shows v1.1.1

6. **Add Custom Domain**
   - Go to: Project Settings → Domains
   - Add: `sams.sandyland.com.mx`
   - Update DNS to point to new Vercel deployment

### Option 2: Via Vercel CLI

1. **Link Project to Vercel**
   ```bash
   cd /Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS
   npx vercel link
   ```

2. **Set Environment Variables**
   ```bash
   # Copy from existing .env file or set manually
   npx vercel env add VITE_FIREBASE_API_KEY
   # ... repeat for each variable
   ```

3. **Deploy to Production**
   ```bash
   npx vercel --prod
   ```

4. **Add Custom Domain**
   ```bash
   npx vercel domains add sams.sandyland.com.mx
   ```

## Verification After Setup

### Check Deployment
```bash
# Check custom domain
curl -s https://sams.sandyland.com.mx/ | grep "SAMS v"

# Should show:
# <!-- SAMS v1.1.1 | Build: [timestamp] | Commit: f6f35cb | Environment: production -->
```

### Run Deployment Verification
```bash
cd /Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My\ Drive/Sandyland/SAMS
node scripts/verifyDeployment.js
```

## Auto-Deploy Configuration

Once connected, **every git push to main will automatically:**
1. Trigger Vercel build for both frontend and backend
2. Deploy new versions
3. Update custom domains
4. Provide deployment URLs in Vercel dashboard

## Current Build Configuration

The `vercel.json` at root is already configured correctly:
- ✅ Build command includes version stamping
- ✅ Installs shared-components first
- ✅ Builds frontend with production mode
- ✅ Output directory correctly set
- ✅ Headers configured for PWA support

## Version Control System Features

Once Vercel is configured, the version control system will automatically:

1. **Inject Version Data at Build Time**
   - Reads from package.json: v1.1.1
   - Captures git commit: f6f35cb
   - Records build timestamp
   - Detects environment: production

2. **Display in UI**
   - Status bar shows: v1.1.1 (f6f35cb)
   - About modal has full build info
   - Debug panel (Shift+Ctrl+D) shows comprehensive data

3. **Track Deployments**
   - HTML metadata for debugging
   - Vercel deployment ID captured
   - Backend/frontend version compatibility checking

## Troubleshooting

### If Build Fails
Check Vercel build logs for:
- Missing environment variables
- Build command errors
- Output directory issues

### If Version Shows Wrong
Verify:
- package.json has correct version
- Vite plugin is running during build
- Environment variables not overriding version

### If Auto-Deploy Not Working
Verify:
- GitHub integration is active in Vercel
- Webhook is configured correctly
- Production branch is set to "main"

## Summary

**Status:** Version control system is complete and production-ready. Just needs Vercel project setup to enable auto-deploy from GitHub.

**Time Required:** ~15-20 minutes to complete Vercel setup

**Impact:** Once configured, all future deployments will be automatic on git push

