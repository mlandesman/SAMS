/**
 * Get comprehensive version information with environment detection
 * Reads from build-time injected constants instead of JSON files
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
  
  // Get version data from build-time injected constants
  const getBuildTimeVersionData = () => {
    try {
      // Try to parse the full version data injected by Vite plugin
      const fullVersionData = import.meta.env.VITE_VERSION_FULL;
      if (fullVersionData && typeof fullVersionData === 'string') {
        return JSON.parse(fullVersionData);
      }
    } catch (error) {
      console.warn('Could not parse full version data:', error);
    }

    // Fallback to individual environment variables
    return {
      version: import.meta.env.VITE_VERSION || '1.0.0',
      buildDate: import.meta.env.VITE_BUILD_DATE || new Date().toISOString(),
      environment: import.meta.env.VITE_ENVIRONMENT || environment,
      git: {
        hash: import.meta.env.VITE_GIT_HASH || 'unknown',
        fullHash: import.meta.env.VITE_GIT_FULL_HASH || 'unknown',
        branch: import.meta.env.VITE_GIT_BRANCH || 'unknown',
        lastCommitDate: import.meta.env.VITE_GIT_COMMIT_DATE || null
      },
      build: {
        timestamp: import.meta.env.VITE_BUILD_DATE || new Date().toISOString(),
        environment: import.meta.env.VITE_ENVIRONMENT || environment,
        nodeVersion: import.meta.env.VITE_NODE_VERSION || 'unknown',
        platform: import.meta.env.VITE_PLATFORM || 'unknown',
        buildNumber: import.meta.env.VITE_BUILD_NUMBER || 'unknown'
      },
      deployment: {
        vercelDeploymentId: import.meta.env.VITE_VERCEL_DEPLOYMENT_ID || null
      },
      appName: import.meta.env.VITE_APP_NAME || 'SAMS',
      shortName: import.meta.env.VITE_APP_SHORT_NAME || 'SAMS',
      companyName: import.meta.env.VITE_COMPANY_NAME || 'Sandyland Properties',
      copyright: import.meta.env.VITE_COPYRIGHT || '2025',
      developers: import.meta.env.VITE_DEVELOPERS ? JSON.parse(import.meta.env.VITE_DEVELOPERS) : ['Michael Landesman', 'Claude AI'],
      features: import.meta.env.VITE_FEATURES ? JSON.parse(import.meta.env.VITE_FEATURES) : [
        'PWA Support',
        'Multi-Client Management',
        'Financial Reporting',
        'Document Storage',
        'Unit Management'
      ],
      description: import.meta.env.VITE_APP_DESCRIPTION || 'Comprehensive property management system for condominiums and HOAs'
    };
  };

  const versionData = getBuildTimeVersionData();
  
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

  const envConfig = environmentConfigs[versionData.environment] || environmentConfigs.development;

  return {
    ...versionData,
    environmentConfig: envConfig,
    displayEnvironment: envConfig.label,
    buildDateFormatted: new Date(versionData.buildDate).toLocaleDateString(),
    buildTimeFormatted: new Date(versionData.buildDate).toLocaleString(),
    versionDisplay: `v${versionData.version}`,
    fullVersionDisplay: `${versionData.shortName} v${versionData.version} (${envConfig.label})`,
    // Enhanced display with git hash
    versionWithHash: `v${versionData.version} (${versionData.git.hash})`,
    fullVersionWithHash: `${versionData.shortName} v${versionData.version} (${versionData.git.hash}) - ${envConfig.label}`
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