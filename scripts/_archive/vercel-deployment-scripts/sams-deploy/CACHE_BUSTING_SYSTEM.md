# SAMS Cache-Busting System

A comprehensive cache-busting and version management system designed to solve critical deployment caching issues experienced during SAMS development.

## 🔥 Critical Lessons Learned

This system was created to address specific deployment failures:

1. **Stale Cache Issues**: Users seeing old versions after deployment
2. **Service Worker Conflicts**: PWA caching causing app failures  
3. **CDN Cache Persistence**: Vercel edge caches serving outdated content
4. **Browser Cache Stubbornness**: Client-side caches ignoring standard headers
5. **Version Confusion**: No way to detect or notify users of updates

## 🏗️ System Architecture

### Core Components

1. **Cache Buster (`cache-buster.ts`)**
   - Generates unique filenames with timestamps
   - Updates service worker cache names
   - Forces browser cache invalidation
   - Implements CDN cache purging for Vercel
   - Handles version bumping for deployments

2. **Version Manager (`version-manager.ts`)**
   - Automatically increments versions on deployment
   - Updates shared/version.json with deployment metadata
   - Creates version tags for rollback
   - Implements "new version available" notifications

3. **Build Scripts Generator (`build-scripts.ts`)**
   - Creates environment-aware build configurations
   - Generates cache-busting integration scripts
   - Provides deployment verification tools
   - Creates rollback automation

4. **Deployment Wrapper (`deployment-wrapper.ts`)**
   - Orchestrates all cache-busting features
   - Provides unified deployment preparation
   - Handles post-deployment cache invalidation

5. **Client-Side Version Manager (`shared/utils/versionUtils.js`)**
   - Monitors for version updates
   - Shows user-friendly update notifications
   - Handles client-side cache clearing
   - Provides manual cache management tools

## 🚀 Usage

### For Desktop Deployer

The system is automatically integrated into the desktop deployer:

```typescript
// Automatic version increment
const versionMetadata = await autoIncrementDeploymentVersion(
  this.projectPath,
  this.environment,
  'patch',
  ['Desktop UI deployment', 'Cache-busting enabled']
);

// Pre-build cache busting
const cacheBustResult = await executeCacheBusting({
  environment: this.environment,
  projectPath: this.projectPath,
  buildOutputPath: path.join(this.projectPath, 'dist'),
  skipVercelPurge: false,
  skipFileRename: false
});

// Post-deployment cache purging
await this.postDeploymentCachePurge(deploymentUrl);
```

### For Mobile PWA Deployer

Enhanced with PWA-specific cache invalidation:

```typescript
// Version management with PWA features
const versionMetadata = await autoIncrementDeploymentVersion(
  this.projectPath,
  this.environment,
  'patch',
  ['Mobile PWA deployment', 'PWA cache invalidation', 'Version notifications enabled']
);

// PWA manifest updates
await this.updatePWAManifestForCacheBusting(distPath, cacheBustResult.uniqueId);

// Service worker validation
await this.validatePWAFunctionality(deploymentUrl);
```

### Manual Usage

You can also use the system manually:

```typescript
import { executeDeploymentPreparation } from './utils/deployment-wrapper';

const result = await executeDeploymentPreparation({
  projectPath: '/path/to/project',
  environment: 'production',
  target: 'mobile',
  enableCacheBusting: true,
  enableVersionNotifications: true,
  deploymentNotes: ['Critical bug fix', 'Performance improvements']
});
```

## 📁 Generated Files and Scripts

### Build Scripts (created in `build-scripts/`)

1. **`build-{environment}.sh`** - Environment-specific build script
2. **`cache-bust.js`** - Cache-busting integration
3. **`version-notifications.js`** - Version notification setup
4. **`verify-deployment.sh`** - Deployment verification
5. **`rollback.sh`** - Emergency rollback automation

### Generated Assets (in build output)

1. **`cache-bust-manifest.json`** - Cache-busting metadata
2. **`build-id.json`** - Unique build identifier
3. **`build-report.json`** - Build statistics
4. **`cache-clear.js`** - Client-side cache clearing
5. **`version-check.js`** - Version monitoring script
6. **`.htaccess`** - Cache control headers
7. **`vercel.json`** - Updated with cache headers

### Version Management Files

1. **`shared/version.json`** - Updated with deployment metadata
2. **`shared/version-history/{env}-history.json`** - Deployment history
3. **`shared/rollback-packages/`** - Emergency rollback data

## 🔧 Configuration

### Environment Variables

```bash
# Required for CDN cache purging
VERCEL_TOKEN=your_vercel_token

# Build-time variables (automatically set)
VITE_BUILD_TIME=2025-07-02T17:35:12.809Z
VITE_BUILD_ID=1720882512809-a1b2c3d4
VITE_CACHE_BUST=1720882512809
```

### Options

```typescript
interface CacheBustingConfig {
  environment: 'development' | 'staging' | 'production';
  projectPath: string;
  buildOutputPath?: string;
  skipVercelPurge?: boolean;  // Skip CDN cache purging
  skipFileRename?: boolean;   // Skip file renaming
}

interface DeploymentWrapperConfig {
  projectPath: string;
  environment: 'development' | 'staging' | 'production';
  target: 'desktop' | 'mobile';
  enableCacheBusting?: boolean;
  enableVersionNotifications?: boolean;
  enableBuildScripts?: boolean;
  deploymentNotes?: string[];
  versionIncrement?: 'patch' | 'minor' | 'major';
}
```

## 📱 Client-Side Features

### Version Notifications

Users automatically see update notifications:

```javascript
// Automatically initialized
window.SAMSVersionManager = new SAMSVersionManager();

// Manual operations
window.checkSAMSVersion();     // Check for updates
window.clearSAMSCaches();      // Clear all caches
window.getSAMSVersionInfo();   // Get version info

// Debug mode (development only)
window.SAMS_DEBUG.forceUpdate(); // Simulate update notification
```

### Cache Management

The client-side system handles:

- **Automatic version checking** every 5 minutes
- **Smart cache clearing** of old entries
- **Service worker updates** when new versions detected
- **User-friendly notifications** with refresh prompts
- **Cross-tab synchronization** of version state

## 🛠️ New NPM Scripts

The system adds these scripts to `package.json`:

```json
{
  "scripts": {
    "build:development": "chmod +x build-scripts/build-development.sh && ./build-scripts/build-development.sh",
    "build:staging": "chmod +x build-scripts/build-staging.sh && ./build-scripts/build-staging.sh", 
    "build:production": "chmod +x build-scripts/build-production.sh && ./build-scripts/build-production.sh",
    "deploy:development": "npm run build:development && sams-deploy mobile --env development",
    "deploy:staging": "npm run build:staging && sams-deploy mobile --env staging",
    "deploy:production": "npm run build:production && sams-deploy mobile --env production",
    "cache-bust": "node build-scripts/cache-bust.js",
    "setup-version-notifications": "node build-scripts/version-notifications.js",
    "verify-deployment": "chmod +x build-scripts/verify-deployment.sh && ./build-scripts/verify-deployment.sh",
    "rollback": "chmod +x build-scripts/rollback.sh && ./build-scripts/rollback.sh"
  }
}
```

## 🔍 Verification and Testing

### Deployment Verification

```bash
# Verify deployment
npm run verify-deployment https://your-deployment-url.vercel.app

# Check specific endpoints
curl -I https://your-app.com/cache-bust-manifest.json
curl -I https://your-app.com/version-check.js
```

### Cache Testing

```bash
# Test cache headers
curl -I https://your-app.com/ | grep -i cache

# Verify unique build ID
curl -s https://your-app.com/build-id.json | jq .buildId

# Check version endpoint
curl -s https://your-app.com/cache-bust-manifest.json | jq .
```

### Manual Cache Clearing

```javascript
// In browser console
clearSAMSCaches();  // Clear all application caches
checkSAMSVersion(); // Force version check
getSAMSVersionInfo(); // View current version data
```

## 🔄 Rollback Procedures

### Automatic Rollback

```bash
# Emergency rollback to previous commit
npm run rollback abc1234

# This will:
# 1. Create rollback branch
# 2. Reset to specified commit
# 3. Clean build artifacts
# 4. Rebuild application
# 5. Prepare for deployment
```

### Manual Rollback

```bash
# Find rollback package
ls shared/rollback-packages/

# Follow instructions in rollback package JSON
cat shared/rollback-packages/rollback-v1.2.3-buildid.json
```

## 📊 Monitoring and Analytics

### Build Reports

Each build generates a report in `dist/build-report.json`:

```json
{
  "target": "mobile",
  "environment": "production", 
  "buildTime": "2025-07-02T17:35:12.809Z",
  "buildSize": "1.2MB",
  "assetCount": 45,
  "buildId": "1720882512809-a1b2c3d4",
  "cacheBustingEnabled": true,
  "versionNotificationsEnabled": true
}
```

### Version History

Track all deployments in `shared/version-history/`:

```json
[
  {
    "version": "1.2.4",
    "timestamp": "2025-07-02T17:35:12.809Z",
    "environment": "production",
    "buildId": "1720882512809-a1b2c3d4",
    "deployedBy": "developer",
    "previousVersion": "1.2.3",
    "rollbackAvailable": true,
    "deploymentNotes": ["Critical bug fix", "Performance improvements"]
  }
]
```

## 🚨 Troubleshooting

### Common Issues

1. **Cache Still Stale After Deployment**
   ```bash
   # Check if CDN purging worked
   curl -I https://your-app.com/ | grep -i x-vercel-cache
   
   # Manual CDN purge
   curl -X POST -H "Authorization: Bearer $VERCEL_TOKEN" \
        "https://api.vercel.com/v1/purge/your-domain.com" \
        -d '{"purgeAll": true}'
   ```

2. **Version Notifications Not Showing**
   ```javascript
   // Check if version manager is loaded
   console.log(window.SAMSVersionManager);
   
   // Manually trigger check
   window.SAMSVersionManager.manualCheck();
   ```

3. **Service Worker Issues**
   ```javascript
   // Clear service worker caches
   navigator.serviceWorker.getRegistrations()
     .then(regs => regs.forEach(reg => reg.unregister()));
   
   // Force service worker update
   navigator.serviceWorker.getRegistrations()
     .then(regs => regs.forEach(reg => reg.update()));
   ```

4. **Build Scripts Permission Denied**
   ```bash
   # Fix permissions
   chmod +x build-scripts/*.sh
   ```

### Debug Mode

Enable debug mode in development:

```javascript
// Available debug tools
window.SAMS_DEBUG = {
  versionManager: window.SAMSVersionManager,
  forceUpdate: () => {
    localStorage.setItem('sams-current-version', 'old-version');
    window.SAMSVersionManager.checkForUpdates();
  }
};
```

## 📈 Performance Impact

### Build Time
- Additional ~5-15 seconds for cache-busting operations
- Negligible impact on normal build process

### Runtime Performance
- Version checks: ~100ms every 5 minutes
- Cache operations: ~50ms on initialization
- No impact on application performance

### Storage Usage
- ~2KB for version management localStorage
- ~5KB for cache-bust manifest
- Automatic cleanup of old cache entries

## 🔐 Security Considerations

1. **No Sensitive Data**: Cache-busting system doesn't expose sensitive information
2. **Version Validation**: All version checks use public endpoints
3. **Safe Cache Clearing**: Preserves user preferences and auth tokens
4. **CORS Compliant**: All requests respect CORS policies

## 🎯 Future Enhancements

1. **Analytics Integration**: Track cache hit/miss rates
2. **A/B Testing Support**: Version-based feature flags
3. **Progressive Updates**: Incremental cache invalidation
4. **Advanced Notifications**: Rich update notifications with changelogs
5. **Monitoring Dashboard**: Real-time deployment and cache status

---

This cache-busting system ensures that SAMS deployments are reliable, users always see the latest version, and emergency rollbacks are possible when needed. The system is designed to be automatic, comprehensive, and fail-safe.