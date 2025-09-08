# SAMS Version Tracking System

## Overview
This document describes the version tracking and deployment mismatch detection system implemented to help identify and resolve deployment issues quickly.

## Problem Statement
After experiencing 4 days of debugging deployment mismatches where dev worked but production failed, we needed a system to:
1. Quickly identify version mismatches between frontend and backend
2. Verify successful deployments
3. Provide clear visibility into what versions are running where

## Solution Components

### 1. Backend Version Endpoint
**Location**: `/backend/routes/version.js`
**Endpoints**:
- `GET /api/version` - Returns detailed version information
- `GET /api/version/health` - Quick health check with version

**Response Example**:
```json
{
  "component": "backend",
  "version": "0.0.1",
  "git": {
    "hash": "90ddb1b",
    "branch": "main"
  },
  "buildDate": "2025-07-03T17:30:00.000Z",
  "environment": "production",
  "deploymentUrl": "backend-liart-seven.vercel.app"
}
```

### 2. Frontend Version Checkers
**Desktop**: `/frontend/sams-ui/src/utils/versionChecker.js`
**Mobile**: `/frontend/mobile-app/src/utils/versionChecker.js`

**Features**:
- Automatic version checking on app startup
- Version compatibility detection
- Console warnings for mismatches
- Caching to avoid excessive API calls

**Usage**:
```javascript
import { initializeVersionCheck } from './utils/versionChecker';

// In your app initialization
const versionInfo = await initializeVersionCheck();
```

### 3. Visual Version Display Component
**Location**: `/frontend/sams-ui/src/components/VersionDisplay.jsx`

**Usage**:
```jsx
// Minimal footer display
<VersionDisplay position="footer" />

// Detailed display in settings
<VersionDisplay showDetails={true} />
```

### 4. Deployment Verification Script
**Location**: `/scripts/check-deployment-versions.js`

**Usage**:
```bash
# Check all environments
node scripts/check-deployment-versions.js

# Check specific environment
node scripts/check-deployment-versions.js production
node scripts/check-deployment-versions.js staging
```

**Output Example**:
```
SAMS Deployment Version Checker
Checking version consistency across all deployments...

PRODUCTION Environment:
✓ backend:
  Version: 0.0.1
  Git Commit: 90ddb1b
  Build Date: 2025-07-03T17:30:00.000Z

⚠️ VERSION MISMATCH DETECTED!
Different versions are deployed:
  backend: 90ddb1b (0.0.1)
  desktop: d02960b (0.0.1)
```

## How to Use

### During Development
1. The version checkers run automatically when you start the frontend apps
2. Check the browser console for version information
3. Look for the version display in the app footer (if implemented)

### Before Deployment
1. Run `node scripts/check-deployment-versions.js` to see current state
2. Note any existing mismatches
3. Deploy all components together using `sams-deploy --component all`

### After Deployment
1. Run `node scripts/check-deployment-versions.js` again
2. Verify all components show the same git commit hash
3. Test the application functionality
4. If issues occur, check browser console for version mismatch warnings

### Debugging Deployment Issues
1. **Check Console**: Frontend apps log version info automatically
2. **API Check**: Visit `https://backend-liart-seven.vercel.app/api/version` directly
3. **Script Check**: Run the verification script
4. **User Reports**: Users will see warnings if versions don't match

## Integration Points

### Adding Version Display to Frontend
```jsx
// In your App.jsx or Layout component
import VersionDisplay from './components/VersionDisplay';

function App() {
  return (
    <div>
      {/* Your app content */}
      <VersionDisplay position="footer" />
    </div>
  );
}
```

### Checking Versions Programmatically
```javascript
import { checkVersionCompatibility } from './utils/versionChecker';

async function handleApiError(error) {
  if (error.status === 401 || error.status === 404) {
    const compatibility = await checkVersionCompatibility();
    if (!compatibility.compatible) {
      console.error('Version mismatch may be causing this error');
      // Show user notification
    }
  }
}
```

## Best Practices

1. **Always Deploy Together**: Use `sams-deploy --component all` when possible
2. **Check Before Testing**: Run version check before testing deployments
3. **Monitor Console**: Keep browser console open during testing
4. **Document Deployments**: Note version hashes in deployment logs
5. **Quick Recovery**: If mismatch detected, redeploy the out-of-sync component

## Troubleshooting

### Backend Version Endpoint Returns 404
- Backend hasn't been deployed with the new version endpoint
- Deploy backend with latest code

### Frontend Shows "unknown" Version
- Version environment variables not set during build
- Check build process includes git information

### Version Check Script Fails
- Ensure you have `node-fetch` and `chalk` installed
- Check network connectivity to production URLs
- Verify endpoints are accessible

## Future Enhancements

1. **Automated Alerts**: Send notifications when mismatches detected
2. **Version History**: Track deployment history in database
3. **Rollback Integration**: One-click rollback to matching versions
4. **CI/CD Integration**: Prevent deployments if versions don't match
5. **User Notifications**: Show in-app alerts for version mismatches