/**
 * Cache and Service Worker Management Utilities
 * 
 * Provides centralized utilities for managing Service Worker unregistration,
 * Cache Storage clearing, and version management using IndexedDB.
 * 
 * This module is critical for PWA zero-cache behavior while maintaining
 * installability. All functions handle errors gracefully to prevent app crashes.
 */

// IndexedDB Configuration
const DB_NAME = 'sams_cache';
const DB_VERSION = 1;
const STORE_NAME = 'metadata';
const VERSION_KEY = 'app_version';

/**
 * Opens or creates the IndexedDB database
 * @returns {Promise<IDBDatabase>} Database instance
 */
const openIndexedDB = () => {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message || 'Unknown error'}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

/**
 * Gets a value from IndexedDB metadata store
 * @param {string} key - The key to retrieve
 * @returns {Promise<any>} The stored value or null if not found
 */
const getFromIndexedDB = async (key) => {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => {
        reject(new Error(`Failed to get from IndexedDB: ${request.error?.message || 'Unknown error'}`));
      };

      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  } catch (error) {
    console.warn(`[cacheManagement] Error reading from IndexedDB:`, error);
    return null;
  }
};

/**
 * Sets a value in IndexedDB metadata store
 * @param {string} key - The key to store
 * @param {any} value - The value to store
 * @returns {Promise<void>}
 */
const setInIndexedDB = async (key, value) => {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onerror = () => {
        reject(new Error(`Failed to set in IndexedDB: ${request.error?.message || 'Unknown error'}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    console.warn(`[cacheManagement] Error writing to IndexedDB:`, error);
    // Don't throw - gracefully handle quota exceeded or other errors
  }
};

/**
 * Unregisters all Service Workers for this origin
 * @returns {Promise<boolean>} True if successful, false if no Service Workers were registered
 */
export const unregisterAllServiceWorkers = async () => {
  try {
    // Check if Service Worker API is available
    if (!('serviceWorker' in navigator)) {
      console.warn('[cacheManagement] Service Worker API is not available');
      return false;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    
    if (registrations.length === 0) {
      console.log('[cacheManagement] No Service Workers registered');
      return false;
    }

    // Unregister all Service Workers
    await Promise.all(
      registrations.map(reg => {
        console.log(`[cacheManagement] Unregistering Service Worker: ${reg.scope}`);
        return reg.unregister();
      })
    );

    console.log(`[cacheManagement] Successfully unregistered ${registrations.length} Service Worker(s)`);
    return true;
  } catch (error) {
    console.error('[cacheManagement] Error unregistering Service Workers:', error);
    return false;
  }
};

/**
 * Clears all Cache Storage entries for this origin
 * @returns {Promise<boolean>} True if successful, false if no caches exist
 */
export const clearAllCacheStorage = async () => {
  try {
    // Check if Cache API is available
    if (!('caches' in window)) {
      console.warn('[cacheManagement] Cache Storage API is not available');
      return false;
    }

    const cacheNames = await caches.keys();
    
    if (cacheNames.length === 0) {
      console.log('[cacheManagement] No Cache Storage entries found');
      return false;
    }

    // Delete all caches
    await Promise.all(
      cacheNames.map(name => {
        console.log(`[cacheManagement] Deleting cache: ${name}`);
        return caches.delete(name);
      })
    );

    console.log(`[cacheManagement] Successfully cleared ${cacheNames.length} cache(s)`);
    return true;
  } catch (error) {
    console.error('[cacheManagement] Error clearing Cache Storage:', error);
    return false;
  }
};

/**
 * Performs a hard reset: unregisters all Service Workers AND clears all Cache Storage
 * Executes both operations even if one fails
 * @returns {Promise<void>}
 */
export const performHardReset = async () => {
  console.log('[cacheManagement] Starting hard reset...');
  
  // Execute both operations independently - don't fail if one fails
  const [swResult, cacheResult] = await Promise.allSettled([
    unregisterAllServiceWorkers(),
    clearAllCacheStorage()
  ]);

  // Log results
  if (swResult.status === 'fulfilled') {
    console.log(`[cacheManagement] Service Worker unregistration: ${swResult.value ? 'success' : 'no workers found'}`);
  } else {
    console.error('[cacheManagement] Service Worker unregistration failed:', swResult.reason);
  }

  if (cacheResult.status === 'fulfilled') {
    console.log(`[cacheManagement] Cache Storage clearing: ${cacheResult.value ? 'success' : 'no caches found'}`);
  } else {
    console.error('[cacheManagement] Cache Storage clearing failed:', cacheResult.reason);
  }

  console.log('[cacheManagement] Hard reset complete');
};

/**
 * Gets the current app version from version.json
 * Tries /version.json first (served from public folder), then /public/version.json as fallback
 * @returns {Promise<string>} Version string (e.g., "1.8.0") or fallback "0.0.0"
 */
export const getCurrentAppVersion = async () => {
  try {
    // Try /version.json first (served from public folder in Vite/React apps)
    let response = await fetch('/version.json');
    
    // If that fails, try /public/version.json as fallback
    if (!response.ok) {
      response = await fetch('/public/version.json');
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch version.json: ${response.status}`);
    }

    const data = await response.json();
    const version = data?.version || '0.0.0';
    
    console.log(`[cacheManagement] Current app version: ${version}`);
    return version;
  } catch (error) {
    console.warn('[cacheManagement] Error reading version.json, using fallback:', error);
    return '0.0.0';
  }
};

/**
 * Gets the stored version from IndexedDB
 * @returns {Promise<string | null>} Stored version string or null if not found
 */
export const getStoredVersion = async () => {
  try {
    const version = await getFromIndexedDB(VERSION_KEY);
    if (version) {
      console.log(`[cacheManagement] Stored version: ${version}`);
    } else {
      console.log('[cacheManagement] No stored version found');
    }
    return version;
  } catch (error) {
    console.warn('[cacheManagement] Error reading stored version:', error);
    return null;
  }
};

/**
 * Stores a version in IndexedDB
 * @param {string} version - Version string to store (e.g., "1.8.0")
 * @returns {Promise<void>}
 */
export const storeVersion = async (version) => {
  try {
    if (!version || typeof version !== 'string') {
      throw new Error('Version must be a non-empty string');
    }

    await setInIndexedDB(VERSION_KEY, version);
    console.log(`[cacheManagement] Stored version: ${version}`);
  } catch (error) {
    console.error('[cacheManagement] Error storing version:', error);
    // Don't throw - gracefully handle errors
  }
};

/**
 * Checks if current app version differs from stored version
 * @returns {Promise<boolean>} True if versions differ (mismatch detected), false if they match or no stored version exists
 */
export const checkVersionMismatch = async () => {
  try {
    const [currentVersion, storedVersion] = await Promise.all([
      getCurrentAppVersion(),
      getStoredVersion()
    ]);

    // If no stored version exists, no mismatch (first run)
    if (!storedVersion) {
      console.log('[cacheManagement] No stored version - first run, no mismatch');
      return false;
    }

    // Compare versions
    const mismatch = currentVersion !== storedVersion;
    
    if (mismatch) {
      console.log(`[cacheManagement] Version mismatch detected: current=${currentVersion}, stored=${storedVersion}`);
    } else {
      console.log(`[cacheManagement] Versions match: ${currentVersion}`);
    }

    return mismatch;
  } catch (error) {
    console.error('[cacheManagement] Error checking version mismatch:', error);
    // On error, assume no mismatch to avoid blocking app
    return false;
  }
};
