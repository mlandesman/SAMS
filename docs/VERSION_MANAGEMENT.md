# SAMS Version Management Guide

**Last Updated**: October 11, 2025  
**Status**: ACTIVE

## Overview

SAMS uses semantic versioning (MAJOR.MINOR.PATCH) with automated version bumping, git tagging, and deployment.

## Quick Start

### Bump Version and Deploy

```bash
# Patch version (1.0.0 → 1.0.1) - Bug fixes
./scripts/bump-version.sh patch

# Minor version (1.0.0 → 1.1.0) - New features
./scripts/bump-version.sh minor

# Major version (1.0.0 → 2.0.0) - Breaking changes
./scripts/bump-version.sh major
```

That's it! The script will:
1. ✅ Bump the version number
2. ✅ Update all package.json files
3. ✅ Update version.json with build info and git hash
4. ✅ Commit the changes
5. ✅ Create a git tag
6. ✅ Build the frontend
7. ✅ Deploy to Firebase
8. ✅ Push to GitHub with tags

## Version Display

### For Users
- **Status Bar**: Bottom right shows version badge with environment
- **About Modal**: Click status bar to see full build information
- **Keyboard Shortcut**: `Shift + Ctrl + V` opens About modal

### What Users See
- Version number (e.g., `v1.0.2`)
- Environment (Development 🔧, Staging 🧪, Production 🚀)
- Connection status
- Build date

### What Developers See (About Modal)
- Full version number
- Build date and time
- Build number (YYMMDDhhmm format)
- Git commit hash
- Git branch
- Node version
- Platform
- Environment
- Company info
- Feature list

## Semantic Versioning

We follow standard semantic versioning:

### MAJOR version (X.0.0)
Increment when you make **incompatible** changes:
- Database schema changes requiring migration
- Breaking API changes
- Major architectural changes
- Removing features

### MINOR version (1.X.0)
Increment when you add **backwards-compatible** functionality:
- New features
- New API endpoints
- New UI components
- Performance improvements

### PATCH version (1.0.X)
Increment for **backwards-compatible** bug fixes:
- Bug fixes
- Security patches
- Minor UI tweaks
- Documentation updates

## How It Works

### Version Files

1. **`shared/version.json`** - Master version file
   ```json
   {
     "version": "1.0.2",
     "buildDate": "2025-10-11T23:31:35.123Z",
     "buildNumber": "251011.1831",
     "environment": "development",
     "git": {
       "hash": "9ab0d04",
       "branch": "main"
     },
     "build": {
       "timestamp": "2025-10-11T23:31:35.123Z",
       "nodeVersion": "v22.15.0",
       "platform": "darwin"
     }
   }
   ```

2. **`frontend/sams-ui/package.json`** - NPM version
3. **`frontend/sams-ui/version.json`** - Copy of shared version
4. **`frontend/mobile-app/package.json`** - Mobile app NPM version
5. **`frontend/mobile-app/version.json`** - Mobile app version copy

### Build Process

When you run the bump script:

1. **Version Bump**
   - `scripts/updateVersion.js` reads current version
   - Increments based on type (patch/minor/major)
   - Updates all package.json files
   - Captures git information (hash, branch, commit date)
   - Generates build number from timestamp
   - Writes to `shared/version.json`
   - Copies to frontend directories

2. **Git Operations**
   - Commits version changes
   - Creates annotated git tag (e.g., `v1.0.2`)
   - Pushes to GitHub with tags

3. **Build**
   - Runs `npm run build` in frontend/sams-ui
   - Vite bakes version.json into bundle
   - Build artifacts go to `frontend/sams-ui/dist/`

4. **Deployment**
   - `firebase deploy` deploys everything
   - Frontend to Firebase Hosting
   - Backend to Cloud Functions v2
   - Version info available in production

## Manual Version Update (Without Deploy)

If you just want to update version info without deploying:

```bash
# Update version with current git info
node scripts/updateVersion.js update

# Bump version only (no deploy)
node scripts/updateVersion.js bump patch
```

## Checking Versions

### In Code (Frontend)
```javascript
import { getVersionInfo } from './utils/versionUtils';

const versionInfo = getVersionInfo();
console.log(versionInfo.version);  // "1.0.2"
console.log(versionInfo.build.buildNumber);  // "251011.1831"
console.log(versionInfo.git.hash);  // "9ab0d04"
```

### Via API (Backend)
```bash
curl https://sams-sandyland-prod.web.app/system/version
```

Returns:
```json
{
  "component": "backend",
  "version": "0.0.1",
  "buildDate": "2025-10-11T17:36:22.901Z",
  "environment": "production",
  "nodeVersion": "v22.20.0"
}
```

## Frontend/Backend Compatibility

### Current Approach
- Frontend and backend versions are **independent**
- They don't need to match for the system to work
- Backend rarely changes compared to frontend

### Version Check on Login
The app performs a version check when you log in:
- Fetches backend version from `/system/version`
- Compares with frontend version
- Shows warning if there are issues
- Displays in dev tools console

### Keyboard Shortcut
Press `Shift + Ctrl + V` to see:
- Frontend version
- Backend version
- Compatibility status
- Git hashes (if available)

## Environment Detection

The system auto-detects the environment:

### Production
- Hostname: `sams-sandyland-prod.web.app` or `sams.sandyland.com.mx`
- Badge: 🚀 Production (green)
- NODE_ENV: `production`

### Staging
- Hostname contains: `staging` or `dev-`
- Badge: 🧪 Staging (blue)

### Development
- Hostname: `localhost` or `127.0.0.1`
- Badge: 🔧 Development (orange)

## Agent Instructions

### When Deploying New Features

1. **Determine version bump type**:
   - Bug fix → `patch`
   - New feature → `minor`
   - Breaking change → `major`

2. **Run the bump script**:
   ```bash
   ./scripts/bump-version.sh <type>
   ```

3. **Verify deployment**:
   - Check https://sams-sandyland-prod.web.app
   - Look at status bar for new version
   - Open About modal to verify build info

4. **Document in commit**:
   - The script auto-commits with message: `chore: bump version to X.Y.Z`
   - Add detailed notes in PR description

### When NOT to Bump Version

- Documentation-only changes
- Changes to development tools
- Changes to tests
- Internal refactoring with no user-facing changes
- Changes to deployment scripts

For these, just deploy normally:
```bash
cd frontend/sams-ui && npm run build && cd ../.. && firebase deploy
```

## Troubleshooting

### "Version still shows old number"
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Clear browser cache
- Try incognito window
- Check if deployment actually completed

### "Git hash shows 'unknown'"
- Make sure you've committed your changes
- Run `git status` to check
- The script needs a clean git state

### "Build number doesn't match"
- Build number is timestamp-based (YYMMDDhhmm)
- It will differ between local and production builds
- This is normal and expected

### "Backend version different from frontend"
- This is OK! They don't need to match
- Backend changes less frequently
- Check compatibility status in About modal

## Best Practices

1. **Always commit before bumping**
   - Ensure git is clean: `git status`
   - Commit your feature first
   - Then run bump script

2. **Use meaningful version numbers**
   - Don't skip versions
   - Follow semantic versioning rules
   - Document major changes in release notes

3. **Test before deploying**
   - Test locally first (`npm run dev`)
   - Verify build works (`npm run build`)
   - Then deploy

4. **Monitor after deployment**
   - Check Firebase Console for errors
   - Test critical paths (login, main features)
   - Watch logs for 15-30 minutes

5. **Communicate deployments**
   - Let team know about major deployments
   - Note any breaking changes
   - Update documentation

## Files Reference

- **`scripts/bump-version.sh`** - Main deployment script
- **`scripts/updateVersion.js`** - Version management logic
- **`shared/version.json`** - Master version file
- **`frontend/sams-ui/src/utils/versionUtils.js`** - Version utility functions
- **`frontend/sams-ui/src/layout/StatusBar.jsx`** - Status bar display
- **`frontend/sams-ui/src/layout/AboutModal.jsx`** - About modal display
- **`backend/routes/version.js`** - Backend version endpoint

## Migration Notes

This system was implemented on October 11, 2025, during the Firebase migration. Previous versioning attempts were abandoned due to Vercel compatibility issues.

The new system is:
- ✅ Simple to use (one command)
- ✅ Automated (no manual steps)
- ✅ Git-integrated (tags, hashes, branches)
- ✅ Firebase-compatible
- ✅ Displays correctly in all environments

