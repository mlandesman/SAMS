# SAMS Deployment Guide for Agents

## Overview

This guide provides step-by-step instructions for deploying SAMS with proper version control and verification. **All agents must follow this guide exactly** to ensure consistent deployments.

## Version Control System

### Version Numbering
- **Format**: `major.minor.patch` (e.g., `1.2.0`)
- **Source of Truth**: `shared/version.json` and `package.json` files
- **Build-Time Injection**: Version data is injected into bundles during build

### Version Bump Rules
- **Major** (`1.0.0` → `2.0.0`): Breaking changes, API changes, database migrations
- **Minor** (`1.1.0` → `1.2.0`): New features, backward compatible additions
- **Patch** (`1.1.0` → `1.1.1`): Bug fixes, no new features

## Pre-Deployment Checklist

### 1. Code Quality Checks
```bash
# Ensure working directory is clean
git status

# Run linting (if available)
npm run lint

# Verify all tests pass (when available)
npm test
```

### 2. Version Bump (if needed)
```bash
# For bug fixes
npm run version:bump:patch

# For new features  
npm run version:bump:minor

# For breaking changes
npm run version:bump:major
```

### 3. Pre-deployment Verification
```bash
# Verify version files are updated
npm run version:validate

# Check compatibility matrix
cat shared/version-compatibility.json
```

## Deployment Process

### Standard Deployment (Recommended)

#### Step 1: Commit and Push
```bash
# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: Add water bills split transactions (v1.2.0)"

# Push to main branch (triggers Vercel deployment)
git push origin main
```

#### Step 2: Monitor Deployment
- **Vercel Dashboard**: Check deployment status at [vercel.com/dashboard](https://vercel.com/dashboard)
- **Build Logs**: Monitor build process for any errors
- **Expected Build Time**: 2-5 minutes for full deployment

#### Step 3: Verify Deployment
```bash
# Run deployment verification script
npm run deploy:verify
```

### Manual Deployment (Emergency Only)

#### Frontend Deployment
```bash
# Build for production
cd frontend/sams-ui
npm run build:production

# Deploy to Firebase (if needed)
firebase deploy --only hosting
```

#### Backend Deployment
```bash
# Backend auto-deploys via Vercel on git push
# No manual deployment needed unless emergency
```

## Post-Deployment Verification

### 1. Automated Verification
```bash
# Run the verification script
npm run deploy:verify
```

**Expected Output:**
```
🚀 DEPLOYMENT VERIFICATION RESULTS
============================================================
✅ Overall Status: SUCCESS
✅ Frontend: healthy - https://sandyland-management-system.web.app
   Version: v1.2.0 (abc1234)
✅ Backend: healthy - https://backend-liart-seven.vercel.app
   Version: v1.2.0 (abc1234)
✅ Compatibility: Versions are compatible
💡 RECOMMENDATIONS:
   ✅ Deployment is healthy and compatible
```

### 2. Manual Verification

#### Check Frontend
1. Navigate to: https://sandyland-management-system.web.app
2. Check Status Bar: Should show correct version and git hash
3. Open About Modal: Should display comprehensive build info
4. Test Version Check: Shift+Ctrl+V should show matching versions

#### Check Backend
1. Test API endpoint: https://backend-liart-seven.vercel.app/api/version
2. Verify version matches frontend
3. Check git commit hash matches

### 3. User Acceptance Testing
- Test core functionality
- Verify new features work as expected
- Check for any console errors
- Test with different user roles

## Troubleshooting

### Common Issues

#### Version Mismatch
**Symptoms**: Version Check shows different versions for frontend/backend
**Solution**:
1. Check if both deployments completed successfully
2. Verify git commit hashes match in Vercel dashboard
3. Run `npm run deploy:verify` for detailed analysis
4. If mismatch persists, redeploy backend

#### Build Failures
**Symptoms**: Vercel build fails or shows errors
**Solution**:
1. Check build logs in Vercel dashboard
2. Verify all dependencies are in package.json
3. Check for TypeScript/ESLint errors
4. Ensure version bump commands completed successfully

#### Stale Version Data
**Symptoms**: Version displays show old information
**Solution**:
1. Clear browser cache (Ctrl+F5)
2. Check if Vercel deployment actually completed
3. Verify version stamping ran during build
4. Check Vercel environment variables

### Emergency Procedures

#### Rollback Deployment
```bash
# Find previous working commit
git log --oneline -10

# Reset to previous commit
git reset --hard <previous-commit-hash>

# Force push (WARNING: Destructive)
git push origin main --force

# Verify rollback
npm run deploy:verify
```

#### Hot Fix Deployment
```bash
# Make minimal fix
# Bump patch version
npm run version:bump:patch

# Commit and push
git add .
git commit -m "fix: Critical bug fix (v1.2.1)"
git push origin main

# Verify immediately
npm run deploy:verify
```

## Environment-Specific Notes

### Production Environment
- **URL**: https://sandyland-management-system.web.app
- **Backend**: https://backend-liart-seven.vercel.app
- **Environment**: `production`
- **Cache**: Aggressive caching enabled

### Staging Environment (Future)
- **URL**: https://staging.sandyland-management-system.web.app
- **Backend**: https://staging.backend-liart-seven.vercel.app
- **Environment**: `staging`
- **Cache**: Moderate caching

### Development Environment
- **URL**: http://localhost:5173
- **Backend**: http://localhost:5001
- **Environment**: `development`
- **Cache**: No caching

## Agent Guidelines

### DO's
- ✅ Always run `npm run deploy:verify` after deployment
- ✅ Use descriptive commit messages with version numbers
- ✅ Test deployment in browser after verification script passes
- ✅ Document any issues or deviations from this guide
- ✅ Keep version numbers in sync across frontend/backend

### DON'Ts
- ❌ Skip version bumping when making changes
- ❌ Deploy without running verification script
- ❌ Use `git push --force` unless absolutely necessary
- ❌ Ignore build warnings or errors
- ❌ Deploy on Friday afternoons without approval

### Communication Protocol
1. **Before Deployment**: Notify team of planned deployment
2. **During Deployment**: Monitor Vercel dashboard
3. **After Deployment**: Share verification results
4. **If Issues**: Document problems and solutions

## Version History

| Date | Version | Agent | Changes |
|------|---------|-------|---------|
| 2025-10-11 | 1.1.0 | Implementation Agent | Initial deployment guide |
| 2025-10-11 | 1.2.0 | Implementation Agent | Added version control system |

## Support

For deployment issues:
1. Check this guide first
2. Review Vercel build logs
3. Run verification script with `--verbose` flag
4. Contact team lead if issues persist

---

**Remember**: Proper deployment verification saves hours of debugging time. Always verify your deployments!
