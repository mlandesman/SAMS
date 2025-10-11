/**
 * SAMS Configuration System
 * Environment-aware configuration for development and production
 * 
 * Features:
 * - Automatic environment detection
 * - Explicit override support via environment variables
 * - Development/Production API URL switching
 * - Firebase configuration management
 */

// Unified baseURL configuration - eliminates dual pattern confusion
const getUnifiedApiUrl = () => {
  // 1. Explicit environment variable (highest priority)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 2. Production environment auto-detection
  // In production, API is served from same domain via Firebase hosting rewrites
  if (import.meta.env.PROD) {
    return '';  // Empty string = same origin (Firebase handles routing)
  }
  
  // 3. Development fallback
  return 'http://localhost:5001';  // Clean base (no /api suffix)
};

export const config = {
  // API Configuration
  api: {
    baseUrl: getUnifiedApiUrl(),            // Single unified baseURL (no /api suffix)
    timeout: 30000, // 30 seconds
  },
  
  // Firebase Configuration
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  },
  
  // Environment info for debugging
  environment: {
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    mode: import.meta.env.MODE,
  },
  
  // Feature Flags
  features: {
    debugMode: import.meta.env.DEV,
    showDevTools: import.meta.env.DEV,
    maintenanceMode: import.meta.env.VITE_MAINTENANCE_MODE === 'true',
  },
  
  // Application Settings
  app: {
    name: 'SAMS',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: import.meta.env.MODE || 'development',
  }
};

// Validate required configuration in production
if (import.meta.env.PROD && typeof window !== 'undefined') {
  const required = ['apiKey', 'authDomain', 'projectId'];
  required.forEach(key => {
    if (!config.firebase[key]) {
      console.error(`Missing required Firebase config: ${key}`);
    }
  });
}

// Development logging
if (import.meta.env.DEV && typeof window !== 'undefined') {
  console.log('🔧 SAMS Unified Config:', {
    apiUrl: config.api.baseUrl,
    environment: import.meta.env.MODE,
    viteEnv: import.meta.env.VITE_API_BASE_URL || 'not set',
    firebase: config.firebase.projectId ? '✓ Configured' : '❌ Missing',
    maintenanceMode: config.features.maintenanceMode,
    configType: 'unified-baseurl-v1'
  });
}