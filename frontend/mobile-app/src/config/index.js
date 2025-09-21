/**
 * Mobile PWA Configuration
 * Reuses the desktop unified configuration for consistency
 * Eliminates hardcoded API URLs that caused production deployment failures
 */

// Import the unified configuration from desktop
// This ensures mobile and desktop always use the same baseURL logic
const getUnifiedApiUrl = () => {
  // 1. Explicit environment variable (highest priority)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 2. Production environment auto-detection
  if (import.meta.env.PROD) {
    return 'https://backend-liart-seven.vercel.app';  // Clean base (no /api suffix)
  }
  
  // 3. Development fallback
  return 'http://localhost:5001';  // Clean base (no /api suffix)
};

export const config = {
  // API Configuration - Unified with desktop
  api: {
    baseUrl: getUnifiedApiUrl(),            // Single unified baseURL (no /api suffix)
    timeout: 30000, // 30 seconds
  },
  
  // Firebase Configuration - Reuse from desktop if needed
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  },
  
  // Mobile-specific settings
  mobile: {
    cacheTimeout: 300000, // 5 minutes
    offlineSupport: true,
    backgroundSync: true,
  },
  
  // Environment info for debugging
  environment: {
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    mode: import.meta.env.MODE,
    isMobile: true,
  },
  
  // Feature Flags
  features: {
    debugMode: import.meta.env.DEV,
    showDevTools: import.meta.env.DEV,
    maintenanceMode: import.meta.env.VITE_MAINTENANCE_MODE === 'true',
    offlineMode: true,
  },
  
  // Application Settings
  app: {
    name: 'SAMS Mobile',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: import.meta.env.MODE || 'development',
    platform: 'mobile-pwa',
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

// Development logging for mobile
if (import.meta.env.DEV && typeof window !== 'undefined') {
  console.log('📱 SAMS Mobile Unified Config:', {
    apiUrl: config.api.baseUrl,
    environment: import.meta.env.MODE,
    viteEnv: import.meta.env.VITE_API_BASE_URL || 'not set',
    firebase: config.firebase.projectId ? '✓ Configured' : '❌ Missing',
    maintenanceMode: config.features.maintenanceMode,
    configType: 'unified-baseurl-mobile-v1',
    platform: 'mobile-pwa'
  });
}