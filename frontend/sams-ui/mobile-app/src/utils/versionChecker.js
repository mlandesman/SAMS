import { API_BASE_URL } from '../services/api';

/**
 * Version checking utilities for mobile app deployment mismatch detection
 */

// Cache for version info to avoid excessive API calls
let cachedBackendVersion = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get mobile app version info
 */
export const getMobileVersion = () => {
  try {
    // Import version from build-time generated file
    const version = import.meta.env.VITE_APP_VERSION || '0.0.1';
    const buildDate = import.meta.env.VITE_APP_BUILD_DATE || new Date().toISOString();
    const gitCommit = import.meta.env.VITE_APP_GIT_COMMIT || 'unknown';
    
    return {
      component: 'frontend-mobile',
      version,
      buildDate,
      gitCommit,
      environment: import.meta.env.MODE || 'development'
    };
  } catch (error) {
    console.error('Error getting mobile version:', error);
    return {
      component: 'frontend-mobile',
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

    const response = await fetch(`${API_BASE_URL}/version`, {
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
 * Check if mobile app and backend versions match
 */
export const checkVersionCompatibility = async () => {
  try {
    const mobile = getMobileVersion();
    const backend = await getBackendVersion();
    
    if (backend.error) {
      return {
        compatible: 'unknown',
        mobile,
        backend,
        message: 'Unable to verify backend version'
      };
    }
    
    // Check git commits if available
    if (mobile.gitCommit !== 'unknown' && backend.git?.hash) {
      const compatible = mobile.gitCommit === backend.git.hash;
      return {
        compatible,
        mobile,
        backend,
        message: compatible 
          ? 'Mobile app and backend versions match' 
          : `Version mismatch detected: Mobile (${mobile.gitCommit}) != Backend (${backend.git.hash})`
      };
    }
    
    // Fallback to version number comparison
    const compatible = mobile.version === backend.version;
    return {
      compatible,
      mobile,
      backend,
      message: compatible 
        ? 'Mobile app and backend versions match' 
        : `Version mismatch detected: Mobile (${mobile.version}) != Backend (${backend.version})`
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
  
  console.group('🔍 SAMS Mobile Version Information');
  console.log('Mobile App:', compatibility.mobile);
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
    console.warn('Mobile:', compatibility.mobile.gitCommit || compatibility.mobile.version);
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