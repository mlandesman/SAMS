import { useState, useEffect } from 'react';

// Fetch version config at runtime from public folder (not bundled)
let versionConfig = null;
let versionLoadPromise = null;
const versionListeners = new Set();

// Load version config (will be fetched from /version.json in public folder)
const loadVersionConfig = async () => {
  if (versionConfig) return versionConfig;
  
  if (!versionLoadPromise) {
    versionLoadPromise = fetch('/version.json')
      .then(r => r.json())
      .then(data => {
        versionConfig = data;
        cachedVersionConfig = data;
        if (typeof window !== 'undefined') {
          window.__SAMS_VERSION__ = data?.version || 'unknown';
        }
        // Notify all listeners
        versionListeners.forEach(listener => listener(data));
        return data;
      })
      .catch(error => {
        console.warn('Could not load version.json, using defaults', error);
        const defaultConfig = {
          version: '0.0.1',
          appName: 'SAMS',
          shortName: 'SAMS',
          buildDate: new Date().toISOString(),
          git: { hash: 'unknown', branch: 'unknown' }
        };
        versionConfig = defaultConfig;
        cachedVersionConfig = defaultConfig;
        return defaultConfig;
      });
  }
  
  return versionLoadPromise;
};

// Subscribe to version updates
const subscribeToVersionUpdates = (callback) => {
  versionListeners.add(callback);
  // If version is already loaded, call immediately
  if (versionConfig) {
    callback(versionConfig);
  }
  return () => versionListeners.delete(callback);
};

// Synchronous version for immediate use (may have stale data on first load)
let cachedVersionConfig = {
  version: '0.0.1',
  appName: 'SAMS',
  shortName: 'SAMS',
  buildDate: new Date().toISOString(),
  git: { hash: 'unknown', branch: 'unknown' },
  build: { buildNumber: 'loading...' }
};

// Load version immediately
loadVersionConfig();

/**
 * Get comprehensive version information with environment detection
 * @returns {Object} Complete version and environment information
 */
export const getVersionInfo = () => {
  const config = versionConfig || cachedVersionConfig;
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
    ...config,
    environment,
    environmentConfig: envConfig,
    displayEnvironment: envConfig.label,
    buildDateFormatted: new Date(config.buildDate).toLocaleDateString(),
    buildTimeFormatted: new Date(config.buildDate).toLocaleString(),
    versionDisplay: `v${config.version}`,
    fullVersionDisplay: `${config.shortName} v${config.version} (${envConfig.label})`
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
 * React hook to use version info with automatic updates
 * @returns {Object} Version information that updates when loaded
 */
export const useVersionInfo = () => {
  const [version, setVersion] = useState(() => getVersionInfo());
  
  useEffect(() => {
    // Subscribe to version updates
    const unsubscribe = subscribeToVersionUpdates((newVersion) => {
      setVersion(getVersionInfo());
    });
    
    // Load version if not already loaded
    if (!versionConfig) {
      loadVersionConfig();
    }
    
    return unsubscribe;
  }, []);
  
  return version;
};

// Also export the subscribe function for non-React usage
export { subscribeToVersionUpdates, loadVersionConfig };