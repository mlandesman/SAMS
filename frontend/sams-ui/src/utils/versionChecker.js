import { config } from '../config';

/**
 * Version checking utilities for deployment mismatch detection
 */

// Cache for version info to avoid excessive API calls
let cachedBackendVersion = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get frontend version info
 */
export const getFrontendVersion = () => {
  try {
    // Import version from build-time generated file
    const version = import.meta.env.VITE_APP_VERSION || '0.0.1';
    const buildDate = import.meta.env.VITE_APP_BUILD_DATE || new Date().toISOString();
    const gitCommit = import.meta.env.VITE_APP_GIT_COMMIT || 'unknown';
    
    return {
      component: 'frontend-desktop',
      version,
      buildDate,
      gitCommit,
      environment: import.meta.env.MODE || 'development'
    };
  } catch (error) {
    console.error('Error getting frontend version:', error);
    return {
      component: 'frontend-desktop',
      version: 'unknown',
      buildDate: 'unknown',
      gitCommit: 'unknown',
      environment: 'unknown'
    };
  }
};

/**
 * Get backend version info
 */
export const getBackendVersion = async (forceRefresh = false) => {
  try {
    // Check cache first
    if (!forceRefresh && cachedBackendVersion && cacheTimestamp) {
      const cacheAge = Date.now() - cacheTimestamp;
      if (cacheAge < CACHE_DURATION) {
        return cachedBackendVersion;
      }
    }

    const response = await fetch(`${config.api.baseUrl}/system/version`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Backend version check failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Cache the result
    cachedBackendVersion = data;
    cacheTimestamp = Date.now();
    
    return data;
  } catch (error) {
    console.error('Error fetching backend version:', error);
    return {
      component: 'backend',
      version: 'unknown',
      error: error.message
    };
  }
};

/**
 * Check if frontend and backend versions match
 */
export const checkVersionCompatibility = async () => {
  try {
    const frontend = getFrontendVersion();
    const backend = await getBackendVersion();
    
    if (backend.error) {
      return {
        compatible: 'unknown',
        frontend,
        backend,
        message: 'Unable to verify backend version'
      };
    }
    
    // Check git commits if available
    if (frontend.gitCommit !== 'unknown' && backend.git?.hash) {
      const compatible = frontend.gitCommit === backend.git.hash;
      return {
        compatible,
        frontend,
        backend,
        message: compatible 
          ? 'Frontend and backend versions match' 
          : `Version mismatch detected: Frontend (${frontend.gitCommit}) != Backend (${backend.git.hash})`
      };
    }
    
    // Fallback to version number comparison
    const compatible = frontend.version === backend.version;
    return {
      compatible,
      frontend,
      backend,
      message: compatible 
        ? 'Frontend and backend versions match' 
        : `Version mismatch detected: Frontend (${frontend.version}) != Backend (${backend.version})`
    };
  } catch (error) {
    console.error('Error checking version compatibility:', error);
    return {
      compatible: 'unknown',
      error: error.message,
      message: 'Unable to check version compatibility'
    };
  }
};

/**
 * Display version info in console (useful for debugging)
 */
export const logVersionInfo = async () => {
  const compatibility = await checkVersionCompatibility();
  
  console.group('🔍 SAMS Version Information');
  console.log('Frontend:', compatibility.frontend);
  console.log('Backend:', compatibility.backend);
  console.log('Compatible:', compatibility.compatible);
  console.log('Message:', compatibility.message);
  console.groupEnd();
  
  return compatibility;
};

/**
 * Show version mismatch warning to user
 */
export const showVersionMismatchWarning = (compatibility) => {
  if (compatibility.compatible === false) {
    console.warn('⚠️ Version Mismatch Detected!');
    console.warn('This may cause unexpected behavior.');
    console.warn('Frontend:', compatibility.frontend.gitCommit || compatibility.frontend.version);
    console.warn('Backend:', compatibility.backend.git?.hash || compatibility.backend.version);
    
    // You could also show a user-facing notification here
    return true;
  }
  return false;
};

/**
 * Initialize version checking on app startup
 */
export const initializeVersionCheck = async () => {
  try {
    const compatibility = await checkVersionCompatibility();
    
    // Log version info in development
    if (import.meta.env.DEV) {
      await logVersionInfo();
    }
    
    // Show warning if mismatch detected
    showVersionMismatchWarning(compatibility);
    
    // Return compatibility info for app to handle
    return compatibility;
  } catch (error) {
    console.error('Error during version check initialization:', error);
    return null;
  }
};