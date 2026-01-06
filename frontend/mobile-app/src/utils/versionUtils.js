// Mobile-specific version utilities
// Version should match the main SAMS version in Implementation_Plan.md

const APP_VERSION = '1.5.6';
const BUILD_DATE = '2026-01-05';

export const getVersionInfo = () => {
  const env = import.meta.env.MODE || 'development';
  const isProd = env === 'production';
  
  // Environment-specific config
  const environmentConfigs = {
    development: {
      icon: '🔧',
      color: '#2196F3',
      label: 'Development'
    },
    staging: {
      icon: '🧪',
      color: '#FF9800',
      label: 'Staging'
    },
    production: {
      icon: '🚀',
      color: '#4CAF50',
      label: 'Production'
    }
  };
  
  const envConfig = environmentConfigs[env] || environmentConfigs.development;
  
  return {
    // Basic version info
    version: APP_VERSION,
    versionDisplay: `v${APP_VERSION}`,
    buildDate: BUILD_DATE,
    buildDateFormatted: new Date(BUILD_DATE + 'T12:00:00').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    buildNumber: Date.now().toString(),
    
    // Environment info
    environment: env,
    displayEnvironment: envConfig.label,
    environmentConfig: envConfig,
    
    // App identity
    appName: 'SAMS Mobile',
    shortName: 'SAMS',
    fullName: 'Sandyland Asset Management System',
    description: 'Mobile property management for HOA communities',
    
    // Company info
    companyName: 'Sandyland Property Management',
    copyright: new Date().getFullYear(),
    developers: ['Michael Landesman', 'Claude AI'],
    
    // Features list for About screen
    features: [
      'PWA Support',
      'Multi-Client Management',
      'Financial Reporting',
      'Document Storage',
      'Unit Management'
    ],
    
    // Git info (static for now)
    gitBranch: 'main',
    gitCommit: 'mobile-pwa'
  };
};

export const getEnvironmentStyles = () => {
  const env = import.meta.env.MODE || 'development';
  
  const styles = {
    development: {
      backgroundColor: '#2196F3',
      color: '#ffffff'
    },
    staging: {
      backgroundColor: '#FF9800',
      color: '#ffffff'
    },
    production: {
      backgroundColor: '#4CAF50',
      color: '#ffffff'
    }
  };
  
  return styles[env] || styles.development;
};

// Export version for quick access
export const VERSION = APP_VERSION;
