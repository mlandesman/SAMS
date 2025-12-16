import { readFile, writeFile, access } from 'fs/promises';
import { resolve, join } from 'path';
import { execute } from './process';
import { logger } from './logger';
import { getCurrentVersion } from './version';

export interface CacheBustingConfig {
  environment: 'development' | 'staging' | 'production';
  projectPath: string;
  buildOutputPath?: string;
  skipVercelPurge?: boolean;
  skipFileRename?: boolean;
}

export interface CacheBustResult {
  success: boolean;
  timestamp: string;
  uniqueId: string;
  filesUpdated: string[];
  cacheVersion: string;
  errors?: string[];
}

/**
 * Cache-busting utility for SAMS deployments
 * Implements critical lessons learned from deployment issues
 */
export class CacheBuster {
  private config: CacheBustingConfig;
  private timestamp: string;
  private uniqueId: string;
  private errors: string[] = [];

  constructor(config: CacheBustingConfig) {
    this.config = config;
    this.timestamp = new Date().toISOString();
    this.uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Execute complete cache-busting strategy
   */
  async execute(): Promise<CacheBustResult> {
    logger.info('🔥 Starting cache-busting process...');
    
    const filesUpdated: string[] = [];

    try {
      // 1. Generate unique filenames with timestamps
      if (!this.config.skipFileRename) {
        const renamedFiles = await this.generateUniqueFilenames();
        filesUpdated.push(...renamedFiles);
      }

      // 2. Update service worker cache names
      const swUpdated = await this.updateServiceWorkerCache();
      if (swUpdated) {
        filesUpdated.push('Service Worker Cache');
      }

      // 3. Force browser cache invalidation
      await this.forceBrowserCacheInvalidation();
      filesUpdated.push('Browser Cache Headers');

      // 4. Update version metadata
      const versionInfo = await this.updateVersionMetadata();
      filesUpdated.push('Version Metadata');

      // 5. Generate cache-busting manifest
      await this.generateCacheBustManifest();
      filesUpdated.push('Cache-Bust Manifest');

      // 6. CDN cache purging (if not skipped)
      if (!this.config.skipVercelPurge) {
        await this.purgeVercelCache();
        filesUpdated.push('Vercel CDN Cache');
      }

      logger.success('✅ Cache-busting completed successfully');

      return {
        success: true,
        timestamp: this.timestamp,
        uniqueId: this.uniqueId,
        filesUpdated,
        cacheVersion: versionInfo.version,
        errors: this.errors.length > 0 ? this.errors : undefined
      };

    } catch (error) {
      logger.error(`❌ Cache-busting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        timestamp: this.timestamp,
        uniqueId: this.uniqueId,
        filesUpdated,
        cacheVersion: '0.0.0',
        errors: [error instanceof Error ? error.message : 'Unknown error', ...this.errors]
      };
    }
  }

  /**
   * Generate unique filenames with timestamps for static assets
   */
  private async generateUniqueFilenames(): Promise<string[]> {
    const buildPath = this.config.buildOutputPath || join(this.config.projectPath, 'dist');
    const updatedFiles: string[] = [];

    try {
      await access(buildPath);
      
      // Create unique build identifier file
      const buildIdFile = join(buildPath, 'build-id.json');
      const buildIdContent = {
        buildId: this.uniqueId,
        timestamp: this.timestamp,
        environment: this.config.environment,
        version: (await getCurrentVersion()).version
      };
      
      await writeFile(buildIdFile, JSON.stringify(buildIdContent, null, 2));
      updatedFiles.push('build-id.json');

      // Update index.html with unique query parameters for assets
      const indexPath = join(buildPath, 'index.html');
      try {
        let indexContent = await readFile(indexPath, 'utf-8');
        
        // Add cache-busting query params to CSS and JS files
        const cacheBustParam = `?v=${this.uniqueId}`;
        
        // Update CSS links
        indexContent = indexContent.replace(
          /<link[^>]+href="([^"]+\.css)"[^>]*>/g,
          (match, href) => {
            return match.replace(href, `${href}${cacheBustParam}`);
          }
        );
        
        // Update JS script sources
        indexContent = indexContent.replace(
          /<script[^>]+src="([^"]+\.js)"[^>]*>/g,
          (match, src) => {
            return match.replace(src, `${src}${cacheBustParam}`);
          }
        );

        // Add meta tag for cache control
        const cacheControlMeta = `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <meta name="build-id" content="${this.uniqueId}">`;
        
        indexContent = indexContent.replace(
          '</head>',
          `    ${cacheControlMeta}\n</head>`
        );

        await writeFile(indexPath, indexContent);
        updatedFiles.push('index.html');
        
      } catch (error) {
        this.errors.push(`Failed to update index.html: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      logger.debug(`Generated unique filenames for ${updatedFiles.length} files`);
      
    } catch (error) {
      this.errors.push(`Failed to access build directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return updatedFiles;
  }

  /**
   * Update service worker cache names with new version
   */
  private async updateServiceWorkerCache(): Promise<boolean> {
    const buildPath = this.config.buildOutputPath || join(this.config.projectPath, 'dist');
    const swPath = join(buildPath, 'sw.js');
    
    try {
      await access(swPath);
      let swContent = await readFile(swPath, 'utf-8');
      
      const versionInfo = await getCurrentVersion();
      const newCacheName = `sams-v${versionInfo.version}-${this.uniqueId}`;
      
      // Update cache name patterns
      const cacheNamePatterns = [
        /const CACHE_NAME = [`'"]([^`'"]+)[`'"];?/g,
        /const APP_CACHE = [`'"]([^`'"]+)[`'"];?/g,
        /const STATIC_CACHE = [`'"]([^`'"]+)[`'"];?/g,
        /cacheName:\s*[`'"]([^`'"]+)[`'"],?/g
      ];
      
      for (const pattern of cacheNamePatterns) {
        swContent = swContent.replace(pattern, (match) => {
          return match.replace(/[`'"]([^`'"]+)[`'"]/, `'${newCacheName}'`);
        });
      }
      
      // Add cache version comment
      const versionComment = `// Cache Version: ${newCacheName}\n// Generated: ${this.timestamp}\n`;
      swContent = versionComment + swContent;
      
      await writeFile(swPath, swContent);
      
      logger.debug(`Updated service worker cache name to: ${newCacheName}`);
      return true;
      
    } catch (error) {
      this.errors.push(`Failed to update service worker: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Force browser cache invalidation by updating headers and meta tags
   */
  private async forceBrowserCacheInvalidation(): Promise<void> {
    const buildPath = this.config.buildOutputPath || join(this.config.projectPath, 'dist');
    
    // Create/update .htaccess for Apache (if applicable)
    const htaccessPath = join(buildPath, '.htaccess');
    const htaccessContent = `# Cache-busting headers - Generated ${this.timestamp}
<filesMatch "\\.(html|htm|js|css)$">
  FileETag None
  Header unset ETag
  Header set Cache-Control "max-age=0, no-cache, no-store, must-revalidate"
  Header set Pragma "no-cache"
  Header set Expires "Wed, 11 Jan 1984 05:00:00 GMT"
</filesMatch>

# Force revalidation for specific file types
<filesMatch "\\.(json|txt)$">
  Header set Cache-Control "no-cache, must-revalidate"
</filesMatch>`;

    try {
      await writeFile(htaccessPath, htaccessContent);
      logger.debug('Created .htaccess for cache control');
    } catch (error) {
      this.errors.push(`Failed to create .htaccess: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Create Vercel headers config
    const vercelHeadersPath = join(this.config.projectPath, 'vercel.json');
    try {
      let vercelConfig: any = {};
      
      // Read existing config if it exists
      try {
        const existingConfig = await readFile(vercelHeadersPath, 'utf-8');
        vercelConfig = JSON.parse(existingConfig);
      } catch {
        // File doesn't exist or is invalid, start fresh
      }

      // Add cache-busting headers
      vercelConfig.headers = [
        {
          "source": "/(.*)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "no-cache, no-store, must-revalidate"
            },
            {
              "key": "Pragma",
              "value": "no-cache"
            },
            {
              "key": "Expires",
              "value": "0"
            },
            {
              "key": "X-Build-ID",
              "value": this.uniqueId
            }
          ]
        },
        {
          "source": "/static/(.*)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable"
            }
          ]
        }
      ];

      await writeFile(vercelHeadersPath, JSON.stringify(vercelConfig, null, 2));
      logger.debug('Updated Vercel headers configuration');
      
    } catch (error) {
      this.errors.push(`Failed to update Vercel config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update version metadata with deployment information
   */
  private async updateVersionMetadata(): Promise<{version: string}> {
    const versionInfo = await getCurrentVersion();
    
    // Update shared version.json
    const sharedVersionPath = resolve(process.cwd(), '../../shared/version.json');
    
    try {
      const versionData = {
        ...versionInfo,
        deployment: {
          target: this.config.environment,
          date: this.timestamp,
          automated: true,
          buildId: this.uniqueId,
          cacheBusted: true
        },
        build: {
          timestamp: this.timestamp,
          environment: this.config.environment,
          buildNumber: this.uniqueId,
          nodeVersion: process.version,
          platform: process.platform
        }
      };
      
      await writeFile(sharedVersionPath, JSON.stringify(versionData, null, 2));
      logger.debug('Updated shared version metadata');
      
    } catch (error) {
      this.errors.push(`Failed to update version metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return versionInfo;
  }

  /**
   * Generate cache-busting manifest for client-side cache invalidation
   */
  private async generateCacheBustManifest(): Promise<void> {
    const buildPath = this.config.buildOutputPath || join(this.config.projectPath, 'dist');
    const manifestPath = join(buildPath, 'cache-bust-manifest.json');
    
    const manifest = {
      version: (await getCurrentVersion()).version,
      buildId: this.uniqueId,
      timestamp: this.timestamp,
      environment: this.config.environment,
      cacheStrategy: {
        staticAssets: 'immutable',
        htmlFiles: 'no-cache',
        apiResponses: 'revalidate',
        serviceWorker: 'immediate'
      },
      invalidationTargets: [
        'service-worker',
        'browser-cache',
        'cdn-cache',
        'local-storage'
      ],
      instructions: {
        clearLocalStorage: true,
        reloadServiceWorker: true,
        forcePageReload: true,
        purgeIndexedDB: false
      }
    };

    try {
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      logger.debug('Generated cache-bust manifest');
      
    } catch (error) {
      this.errors.push(`Failed to generate cache-bust manifest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Purge Vercel CDN cache after successful deployment
   */
  private async purgeVercelCache(): Promise<void> {
    if (!process.env.VERCEL_TOKEN) {
      this.errors.push('VERCEL_TOKEN not available, skipping CDN cache purge');
      return;
    }

    try {
      // For production, we need to purge specific domains
      const domains = this.config.environment === 'production' 
        ? ['sams.sandyland.com.mx', 'mobile.sams.sandyland.com.mx']
        : [];

      if (domains.length > 0) {
        for (const domain of domains) {
          try {
            await execute('curl', [
              '-X', 'POST',
              '-H', `Authorization: Bearer ${process.env.VERCEL_TOKEN}`,
              '-H', 'Content-Type: application/json',
              `https://api.vercel.com/v1/purge/${domain}`,
              '-d', '{"purgeAll": true}'
            ], {
              timeout: 30000,
              captureOutput: true
            });
            
            logger.debug(`Purged CDN cache for domain: ${domain}`);
          } catch (error) {
            this.errors.push(`Failed to purge CDN cache for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
      
      logger.debug('Vercel CDN cache purge completed');
      
    } catch (error) {
      this.errors.push(`CDN cache purge failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear application caches (localStorage, sessionStorage, IndexedDB)
   */
  static generateClientCacheClearScript(): string {
    return `
// SAMS Cache Clear Script - Auto-generated
(function() {
  const CACHE_CLEAR_KEY = 'sams-cache-cleared';
  const BUILD_ID = '${new Date().getTime()}';
  
  function clearAllCaches() {
    try {
      // Clear localStorage
      if (typeof localStorage !== 'undefined') {
        const keysToKeep = ['user-preferences', 'theme-setting'];
        const backup = {};
        keysToKeep.forEach(key => {
          if (localStorage.getItem(key)) {
            backup[key] = localStorage.getItem(key);
          }
        });
        localStorage.clear();
        Object.keys(backup).forEach(key => {
          localStorage.setItem(key, backup[key]);
        });
        localStorage.setItem(CACHE_CLEAR_KEY, BUILD_ID);
      }
      
      // Clear sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
      
      // Clear IndexedDB (if used)
      if ('indexedDB' in window) {
        indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name && db.name.includes('sams')) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        }).catch(() => {
          // IndexedDB operations might fail, that's ok
        });
      }
      
      // Force service worker update
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            registration.update();
          });
        });
      }
      
      console.log('SAMS caches cleared successfully');
      
    } catch (error) {
      console.warn('Some caches could not be cleared:', error);
    }
  }
  
  // Check if we need to clear caches
  const lastClear = localStorage.getItem(CACHE_CLEAR_KEY);
  if (!lastClear || lastClear !== BUILD_ID) {
    clearAllCaches();
  }
  
  // Make function available globally for manual clearing
  window.clearSAMSCaches = clearAllCaches;
})();
`;
  }
}

/**
 * Convenience function to create and execute cache buster
 */
export async function executeCacheBusting(config: CacheBustingConfig): Promise<CacheBustResult> {
  const cacheBuster = new CacheBuster(config);
  return await cacheBuster.execute();
}

/**
 * Get cache-busting script for client-side injection
 */
export function getCacheClearScript(): string {
  return CacheBuster.generateClientCacheClearScript();
}