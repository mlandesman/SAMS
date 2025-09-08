import versionConfig from '../version.json' with { type: 'json' };

/**
 * Get comprehensive version information with environment detection
 * @returns {Object} Complete version and environment information
 */
export const getVersionInfo = () => {
  // Environment detection logic
  const getEnvironment = () => {
    // Check for explicit environment variables first
    if (process.env.REACT_APP_ENVIRONMENT) {
      return process.env.REACT_APP_ENVIRONMENT;
    }
    
    // Detect based on hostname and NODE_ENV
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        return 'development';
      } else if (hostname.includes('staging') || hostname.includes('dev-')) {
        return 'staging';
      } else {
        return 'production';
      }
    }
    
    // Fallback to NODE_ENV
    return process.env.NODE_ENV || 'development';
  };

  const environment = getEnvironment();
  
  // Environment-specific configurations
  const environmentConfigs = {
    development: {
      color: '#ff9800',
      bgColor: 'rgba(255, 152, 0, 0.1)',
      icon: '🔧',
      label: 'Development'
    },
    staging: {
      color: '#2196f3', 
      bgColor: 'rgba(33, 150, 243, 0.1)',
      icon: '🧪',
      label: 'Staging'
    },
    production: {
      color: '#4caf50',
      bgColor: 'rgba(76, 175, 80, 0.1)', 
      icon: '🚀',
      label: 'Production'
    }
  };

  const envConfig = environmentConfigs[environment] || environmentConfigs.development;

  return {
    ...versionConfig,
    environment,
    environmentConfig: envConfig,
    displayEnvironment: envConfig.label,
    buildDateFormatted: new Date(versionConfig.buildDate).toLocaleDateString(),
    buildTimeFormatted: new Date(versionConfig.buildDate).toLocaleString(),
    versionDisplay: `v${versionConfig.version}`,
    fullVersionDisplay: `${versionConfig.shortName} v${versionConfig.version} (${envConfig.label})`
  };
};

/**
 * Get environment-specific styling
 * @returns {Object} Style configuration for current environment
 */
export const getEnvironmentStyles = () => {
  const versionInfo = getVersionInfo();
  return {
    chip: {
      backgroundColor: versionInfo.environmentConfig.color,
      color: 'white',
      fontWeight: 'bold'
    },
    badge: {
      backgroundColor: versionInfo.environmentConfig.bgColor,
      color: versionInfo.environmentConfig.color,
      border: `1px solid ${versionInfo.environmentConfig.color}`
    },
    statusBar: {
      backgroundColor: versionInfo.environmentConfig.bgColor,
      color: versionInfo.environmentConfig.color
    }
  };
};

/**
 * Check if current environment is development
 * @returns {boolean}
 */
export const isDevelopment = () => {
  return getVersionInfo().environment === 'development';
};

/**
 * Check if current environment is production
 * @returns {boolean}
 */
export const isProduction = () => {
  return getVersionInfo().environment === 'production';
};

/**
 * Get version for display in navigation/headers
 * @returns {string} Formatted version string
 */
export const getDisplayVersion = () => {
  const info = getVersionInfo();
  return `${info.shortName} ${info.versionDisplay} ${info.environmentConfig.icon}`;
};

/**
 * SAMS Version Management and Cache-Busting Utilities
 * Comprehensive client-side version checking and cache invalidation
 */
class SAMSVersionManager {
  constructor(options = {}) {
    this.options = {
      checkInterval: 300000, // 5 minutes
      notificationDuration: 30000, // 30 seconds
      enableNotifications: true,
      enableAutoRefresh: false,
      storagePrefix: 'sams-',
      ...options
    };

    this.currentVersion = null;
    this.lastCheckTime = 0;
    this.notificationElement = null;
    
    this.init();
  }

  /**
   * Initialize version manager
   */
  init() {
    // Get current version from cache-bust manifest
    this.loadCurrentVersion();
    
    // Set up periodic version checking
    this.setupPeriodicChecking();
    
    // Set up visibility change monitoring
    this.setupVisibilityMonitoring();
    
    // Clear old caches on initialization
    this.clearOldCaches();
    
    console.log('🔢 SAMS Version Manager initialized');
  }

  /**
   * Load current version information
   */
  async loadCurrentVersion() {
    try {
      const response = await fetch('/cache-bust-manifest.json?t=' + Date.now());
      if (response.ok) {
        const manifest = await response.json();
        this.currentVersion = manifest.version || manifest.buildId;
        
        // Store in localStorage for comparison
        const storedVersion = localStorage.getItem(this.options.storagePrefix + 'current-version');
        if (!storedVersion) {
          localStorage.setItem(this.options.storagePrefix + 'current-version', this.currentVersion);
        }
        
        console.log('📦 Current version:', this.currentVersion);
      }
    } catch (error) {
      console.debug('Could not load version information:', error);
    }
  }

  /**
   * Check for version updates
   */
  async checkForUpdates() {
    try {
      const response = await fetch('/cache-bust-manifest.json?t=' + Date.now());
      if (!response.ok) return false;

      const manifest = await response.json();
      const newVersion = manifest.version || manifest.buildId;
      const storedVersion = localStorage.getItem(this.options.storagePrefix + 'current-version');

      if (storedVersion && storedVersion !== newVersion) {
        console.log('🆕 New version available:', storedVersion, '→', newVersion);
        
        if (this.options.enableNotifications) {
          this.showUpdateNotification(storedVersion, newVersion, manifest);
        }
        
        // Update stored version
        localStorage.setItem(this.options.storagePrefix + 'current-version', newVersion);
        
        return true;
      }

      // Update last check time
      localStorage.setItem(this.options.storagePrefix + 'last-check', Date.now().toString());
      return false;

    } catch (error) {
      console.debug('Version check failed:', error);
      return false;
    }
  }

  /**
   * Show update notification to user
   */
  showUpdateNotification(oldVersion, newVersion, manifest) {
    // Remove existing notification
    this.hideUpdateNotification();

    const notification = document.createElement('div');
    notification.id = 'sams-update-notification';
    notification.className = 'sams-update-notification';
    
    // Determine notification style based on environment
    const isProduction = manifest.environment === 'production';
    const isPWA = manifest.target === 'mobile';
    
    notification.innerHTML = \`
      <div class="sams-notification-content">
        <div class="sams-notification-header">
          <span class="sams-notification-icon">\${isPWA ? '📱' : '💻'}</span>
          <strong>SAMS Updated!</strong>
          <button class="sams-notification-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="sams-notification-body">
          <p>A new version is available</p>
          <div class="sams-version-info">
            <span class="sams-version-old">\${oldVersion}</span>
            <span class="sams-version-arrow">→</span>
            <span class="sams-version-new">\${newVersion}</span>
          </div>
          \${isProduction ? '<p class="sams-environment-badge production">Production Release</p>' : ''}
        </div>
        <div class="sams-notification-actions">
          <button class="sams-btn sams-btn-primary" onclick="window.location.reload()">
            Refresh Now
          </button>
          <button class="sams-btn sams-btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">
            Later
          </button>
        </div>
      </div>
    \`;

    // Add CSS if not already present
    if (!document.getElementById('sams-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'sams-notification-styles';
      styles.textContent = this.getNotificationCSS();
      document.head.appendChild(styles);
    }

    document.body.appendChild(notification);
    this.notificationElement = notification;

    // Auto-remove after specified duration
    setTimeout(() => {
      this.hideUpdateNotification();
    }, this.options.notificationDuration);

    // Fire custom event
    window.dispatchEvent(new CustomEvent('sams:version-update', {
      detail: { oldVersion, newVersion, manifest }
    }));
  }

  /**
   * Set up periodic version checking
   */
  setupPeriodicChecking() {
    // Initial check after a short delay
    setTimeout(() => {
      if (this.shouldCheckForUpdates()) {
        this.checkForUpdates();
      }
    }, 5000);

    // Periodic checks
    setInterval(() => {
      if (this.shouldCheckForUpdates()) {
        this.checkForUpdates();
      }
    }, this.options.checkInterval);
  }

  /**
   * Set up visibility change monitoring
   */
  setupVisibilityMonitoring() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.shouldCheckForUpdates()) {
        this.checkForUpdates();
      }
    });
  }

  /**
   * Check if we should check for updates
   */
  shouldCheckForUpdates() {
    const lastCheck = localStorage.getItem(this.options.storagePrefix + 'last-check');
    if (!lastCheck) return true;

    const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
    return timeSinceLastCheck > this.options.checkInterval;
  }

  /**
   * Clear old caches
   */
  async clearOldCaches() {
    try {
      // Clear old cache entries from localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sams-cache-') && key !== 'sams-cache-cleared') {
          // Check if the cache entry is old (more than 7 days)
          try {
            const value = localStorage.getItem(key);
            const data = JSON.parse(value);
            if (data.timestamp && Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
              keysToRemove.push(key);
            }
          } catch (e) {
            // Invalid cache entry, remove it
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Clear service worker caches if available
      if ('serviceWorker' in navigator && 'caches' in window) {
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          name.includes('sams-v') && !name.includes(this.currentVersion)
        );

        await Promise.all(oldCaches.map(name => caches.delete(name)));
        
        if (oldCaches.length > 0) {
          console.log('🧹 Cleared', oldCaches.length, 'old caches');
        }
      }

    } catch (error) {
      console.debug('Could not clear old caches:', error);
    }
  }

  /**
   * Force clear all SAMS caches
   */
  async forceClearAllCaches() {
    try {
      console.log('🔥 Force clearing all SAMS caches...');

      // Clear localStorage (keep user preferences)
      const keysToKeep = ['user-preferences', 'theme-setting', 'auth-token'];
      const backup = {};
      keysToKeep.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) backup[key] = value;
      });

      localStorage.clear();
      Object.keys(backup).forEach(key => {
        localStorage.setItem(key, backup[key]);
      });

      // Clear sessionStorage
      sessionStorage.clear();

      // Clear all service worker caches
      if ('serviceWorker' in navigator && 'caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Update service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.update()));
      }

      console.log('✅ All SAMS caches cleared');
      return true;

    } catch (error) {
      console.error('❌ Failed to clear caches:', error);
      return false;
    }
  }

  /**
   * Hide update notification
   */
  hideUpdateNotification() {
    if (this.notificationElement && this.notificationElement.parentElement) {
      this.notificationElement.remove();
      this.notificationElement = null;
    }
  }

  /**
   * Get notification CSS
   */
  getNotificationCSS() {
    return \`
      .sams-update-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        z-index: 10000;
        max-width: 380px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1);
        animation: sams-notification-slide-in 0.3s ease-out;
      }

      @keyframes sams-notification-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      .sams-notification-content {
        padding: 16px;
      }

      .sams-notification-header {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        font-weight: 600;
      }

      .sams-notification-icon {
        margin-right: 8px;
        font-size: 18px;
      }

      .sams-notification-close {
        margin-left: auto;
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: opacity 0.2s;
      }

      .sams-notification-close:hover {
        opacity: 1;
        background: rgba(255,255,255,0.1);
      }

      .sams-notification-body {
        margin-bottom: 16px;
      }

      .sams-version-info {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 8px 0;
        font-family: 'Monaco', 'Consolas', monospace;
        font-size: 12px;
      }

      .sams-version-old {
        background: rgba(255,255,255,0.1);
        padding: 2px 6px;
        border-radius: 4px;
      }

      .sams-version-arrow {
        opacity: 0.7;
      }

      .sams-version-new {
        background: rgba(46, 204, 113, 0.2);
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid rgba(46, 204, 113, 0.3);
      }

      .sams-environment-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 4px;
      }

      .sams-environment-badge.production {
        background: rgba(230, 126, 34, 0.2);
        border: 1px solid rgba(230, 126, 34, 0.3);
        color: #f39c12;
      }

      .sams-notification-actions {
        display: flex;
        gap: 8px;
      }

      .sams-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        flex: 1;
      }

      .sams-btn-primary {
        background: rgba(255,255,255,0.9);
        color: #4a5568;
      }

      .sams-btn-primary:hover {
        background: white;
        transform: translateY(-1px);
      }

      .sams-btn-secondary {
        background: transparent;
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
      }

      .sams-btn-secondary:hover {
        background: rgba(255,255,255,0.1);
      }

      @media (max-width: 480px) {
        .sams-update-notification {
          top: 10px;
          left: 10px;
          right: 10px;
          max-width: none;
        }
      }
    \`;
  }

  /**
   * Manual version check (for testing)
   */
  async manualCheck() {
    console.log('🔍 Manual version check triggered');
    return await this.checkForUpdates();
  }

  /**
   * Get version information
   */
  getVersionInfo() {
    return {
      current: this.currentVersion,
      stored: localStorage.getItem(this.options.storagePrefix + 'current-version'),
      lastCheck: localStorage.getItem(this.options.storagePrefix + 'last-check')
    };
  }
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
  // Initialize with default options
  window.SAMSVersionManager = new SAMSVersionManager();
  
  // Make utilities available globally
  window.checkSAMSVersion = () => window.SAMSVersionManager.manualCheck();
  window.clearSAMSCaches = () => window.SAMSVersionManager.forceClearAllCaches();
  window.getSAMSVersionInfo = () => window.SAMSVersionManager.getVersionInfo();
  
  // Debug utilities
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
    window.SAMS_DEBUG = {
      versionManager: window.SAMSVersionManager,
      forceUpdate: () => {
        localStorage.setItem('sams-current-version', 'old-version');
        window.SAMSVersionManager.checkForUpdates();
      }
    };
  }
}

// Export the version manager class
export { SAMSVersionManager };

// Export convenient functions for direct use
export const initializeVersionManager = (options) => new SAMSVersionManager(options);
export const checkForVersionUpdates = () => window.SAMSVersionManager?.manualCheck();
export const clearAllCaches = () => window.SAMSVersionManager?.forceClearAllCaches();