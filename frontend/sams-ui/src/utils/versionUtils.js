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