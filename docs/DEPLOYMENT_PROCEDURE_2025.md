# SAMS Deployment Procedure (January 2025)

**Status**: ACTIVE  
**Last Updated**: 2025-01-03  
**Priority**: CRITICAL - All agents MUST follow this procedure

## Current Deployment Status

### ⚠️ Known Issues
1. **sams-deploy CLI is BROKEN** - TypeScript build issues prevent it from running
2. **Staging environment is NOT CONFIGURED** - Vercel staging deployments will fail
3. **Manual deployment is REQUIRED** until sams-deploy is fixed

### ✅ What's Working
1. Production deployments via Vercel CLI and Firebase CLI
2. Environment variables are properly configured
3. Build processes are stable

## Approved Deployment Process

### Pre-Deployment Checklist
- [ ] Have you tested your changes locally?
- [ ] Have you run the build command to verify no errors?
- [ ] Have you checked that environment variables are correct?
- [ ] Are you deploying from the main branch?
- [ ] Have you communicated with the team about the deployment?

### Desktop Frontend Deployment (Vercel)

```bash
# 1. Navigate to desktop frontend
cd frontend/sams-ui

# 2. Install dependencies (if needed)
npm install

# 3. Build the project
npm run build

# 4. Deploy to production
vercel --prod

# 5. Verify deployment
# - Check https://sams.sandyland.com.mx
# - Test login functionality
# - Verify API connections work
```

### Mobile Frontend Deployment (Vercel)

```bash
# 1. Navigate to mobile frontend
cd frontend/mobile-app

# 2. Install dependencies (if needed)
npm install

# 3. Build the project
npm run build

# 4. Deploy to production
vercel --prod

# 5. Verify deployment
# - Check https://mobile.sams.sandyland.com.mx
# - Test PWA installation
# - Verify API connections work
```

### Backend Deployment (Firebase Functions)

```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies (if needed)
npm install

# 3. Deploy to Firebase
npm run deploy

# 4. Verify deployment
# - Check Firebase console for successful deployment
# - Test API endpoints
# - Monitor error logs
```

## Post-Deployment Verification

### Required Checks
1. **Frontend Health**
   - Can users log in?
   - Do API calls succeed?
   - Are images/assets loading?

2. **Backend Health**
   - Are all endpoints responding?
   - Check Firebase Functions logs for errors
   - Verify database connections

3. **Integration Tests**
   - Create a test transaction
   - Generate a report
   - Send a test email receipt

### If Deployment Fails

1. **Check build output** for errors
2. **Verify environment variables** in Vercel/Firebase
3. **Check deployment logs** in respective dashboards
4. **Roll back if necessary** (see Rollback section)

## Rollback Procedures

### Vercel Rollback (Frontend)
1. Go to Vercel Dashboard
2. Select the project (sams-ui or mobile-app)
3. Go to "Deployments" tab
4. Find the last working deployment
5. Click "..." menu and select "Promote to Production"

### Firebase Rollback (Backend)
1. Go to Firebase Console
2. Navigate to Functions
3. View function version history
4. Revert to previous version if available
5. OR: Deploy previous git commit:
   ```bash
   git checkout [last-working-commit]
   cd backend
   npm run deploy
   git checkout main
   ```

## Environment Configuration

### Vercel Environment Variables
Both frontend projects need these variables set in Vercel:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_BACKEND_URL` (production: https://backend-liart-seven.vercel.app)

### Firebase Configuration
Backend needs these in `.env`:
- Firebase service account credentials
- CORS configuration for allowed origins

## Deployment Schedule

### Best Practices
1. **Deploy during low-usage hours** (early morning or late evening)
2. **Notify users** of planned maintenance if major changes
3. **Have rollback plan ready** before deploying
4. **Monitor for 30 minutes** after deployment

### Deployment Windows
- **Preferred**: 6 AM - 8 AM CST
- **Acceptable**: 8 PM - 10 PM CST
- **Avoid**: Business hours (9 AM - 6 PM CST)

## Future Improvements

### sams-deploy CLI Fix (Priority: HIGH)
The TypeScript-based deployment tool needs:
1. Build configuration fixes
2. Proper npm link setup
3. Staging environment configuration
4. Testing of all deployment paths

### Staging Environment Setup (Priority: HIGH)
Need to configure:
1. Vercel staging projects
2. Staging environment variables
3. Staging database
4. Staging subdomain setup

## Agent Instructions

### For Implementation Agents
1. **ALWAYS** follow this exact procedure
2. **NEVER** attempt to use sams-deploy until fixed
3. **DOCUMENT** all deployments in your completion logs
4. **VERIFY** deployments actually succeeded

### For Manager Agents
1. **ENSURE** all task assignments reference this document
2. **VERIFY** completion logs show proper deployment
3. **REJECT** any work using non-approved deployment methods

### For Debug Agents
1. **CHECK** deployment logs when debugging issues
2. **VERIFY** correct deployment method was used
3. **DOCUMENT** any deployment-related problems

## Common Issues and Solutions

### "Command not found: vercel"
```bash
npm install -g vercel
vercel login
```

### "Firebase deployment failed"
1. Check Firebase authentication: `firebase login`
2. Verify project selection: `firebase use --add`
3. Check functions configuration

### "Build failed"
1. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
2. Check for TypeScript errors: `npm run build`
3. Verify all imports are correct

## Contact for Help

If you encounter deployment issues:
1. Document the exact error message
2. Note which step failed
3. Check relevant dashboard (Vercel/Firebase)
4. Create an issue in the Memory Bank for team visibility

---

**Remember**: This is a TEMPORARY procedure while we fix the automated deployment system. Once sams-deploy is repaired and staging is configured, we will return to the automated process.