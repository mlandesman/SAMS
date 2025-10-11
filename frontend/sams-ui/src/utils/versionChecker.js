import { config } from '../config';
import versionConfig from '../version.json' with { type: 'json' };

/**
 * Version checking utilities for deployment mismatch detection
 */

// Cache for version info to avoid excessive API calls
let cachedBackendVersion = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get frontend version info from build-time injected constants
 */
export const getFrontendVersion = () => {
  try {
    // Get from build-time injected constants (same source as versionUtils.js)
    const version = import.meta.env.VITE_VERSION || 'unavailable';
    const buildDate = import.meta.env.VITE_BUILD_DATE || 'unavailable';
    const gitHash = import.meta.env.VITE_GIT_HASH || 'unavailable';
    const gitFullHash = import.meta.env.VITE_GIT_FULL_HASH || 'unavailable';
    const gitBranch = import.meta.env.VITE_GIT_BRANCH || 'unavailable';
    const environment = import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE || 'development';
    const buildNumber = import.meta.env.VITE_BUILD_NUMBER || 'unavailable';
    const deploymentId = import.meta.env.VITE_VERCEL_DEPLOYMENT_ID || null;

    return {
      component: 'frontend-desktop',
      version,
      buildDate,
      gitCommit: gitHash,
      gitFullHash,
      gitBranch,
      environment,
      buildNumber,
      deploymentId,
      buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP || Date.now()
    };
  } catch (error) {
    console.error('Error getting frontend version:', error);
    return {
      component: 'frontend-desktop',
      version: 'unavailable',
      buildDate: 'unavailable',
      gitCommit: 'unavailable',
      gitFullHash: 'unavailable',
      gitBranch: 'unavailable',
      environment: 'unknown',
      buildNumber: 'unavailable',
      deploymentId: null,
      buildTimestamp: Date.now()
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
 * Check if frontend and backend versions match with detailed compatibility analysis
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
        message: 'Unable to verify backend version',
        details: {
          versionMatch: false,
          gitMatch: false,
          environmentMatch: false,
          buildTimeDifference: null
        }
      };
    }
    
    // Detailed compatibility analysis
    const details = {
      versionMatch: frontend.version === backend.version,
      gitMatch: frontend.gitCommit === backend.git?.hash,
      environmentMatch: frontend.environment === backend.environment,
      buildTimeDifference: null,
      deploymentInfo: {
        frontendDeployment: frontend.deploymentId || 'local',
        backendDeployment: backend.deployment?.deploymentId || 'local',
        sameDeployment: frontend.deploymentId === backend.deployment?.deploymentId
      }
    };

    // Calculate build time difference
    if (frontend.buildTimestamp && backend.buildDate) {
      const frontendTime = new Date(frontend.buildTimestamp).getTime();
      const backendTime = new Date(backend.buildDate).getTime();
      details.buildTimeDifference = Math.abs(frontendTime - backendTime);
    }

    // Determine overall compatibility
    let compatible = true;
    let message = 'Frontend and backend versions are compatible';
    
    // Check for critical mismatches
    if (!details.versionMatch && !details.gitMatch) {
      compatible = false;
      message = `Critical version mismatch: Frontend v${frontend.version} (${frontend.gitCommit}) != Backend v${backend.version} (${backend.git?.hash})`;
    } else if (!details.gitMatch) {
      compatible = false;
      message = `Git commit mismatch: Frontend (${frontend.gitCommit}) != Backend (${backend.git?.hash}) - Same version but different code`;
    } else if (!details.versionMatch) {
      // Version mismatch but same git commit (shouldn't happen but possible)
      message = `Version number mismatch: Frontend v${frontend.version} != Backend v${backend.version} but same git commit (${frontend.gitCommit})`;
    } else if (details.buildTimeDifference > 300000) { // 5 minutes
      message = `Versions match but build times differ by ${Math.round(details.buildTimeDifference / 60000)} minutes`;
    }

    return {
      compatible,
      frontend,
      backend,
      message,
      details
    };
  } catch (error) {
    console.error('Error checking version compatibility:', error);
    return {
      compatible: 'unknown',
      error: error.message,
      message: 'Unable to check version compatibility',
      details: null
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