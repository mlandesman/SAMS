// Mobile-specific version utilities
export const getVersionInfo = () => {
  return {
    version: '1.0.0',
    buildDate: new Date().toISOString(),
    environment: import.meta.env.MODE || 'development',
    gitBranch: 'main',
    gitCommit: 'mobile',
    buildNumber: Date.now().toString()
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