/**
 * Client Feature Detection Utilities
 * Centralized functions to check if a client has specific features enabled
 */

// Memoization cache for feature checks
const featureCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cache key for feature checking
 */
const getCacheKey = (clientId, feature, menuConfigHash) => {
  return `${clientId}_${feature}_${menuConfigHash}`;
};

/**
 * Get hash of menu config for cache key
 */
const getMenuConfigHash = (menuConfig) => {
  if (!menuConfig || menuConfig.length === 0) return 'empty';
  return menuConfig.map(item => item.activity).sort().join(',');
};

/**
 * Check if a client has water bills feature enabled
 * @param {Object} selectedClient - The selected client object
 * @param {Array} menuConfig - The menu configuration from ClientContext
 * @returns {boolean} True if water bills are enabled, false otherwise
 */
export const hasWaterBills = (selectedClient, menuConfig = []) => {
  if (!selectedClient) {
    return false;
  }
  
  // Create cache key based on client and menu config
  const menuConfigHash = getMenuConfigHash(menuConfig);
  const cacheKey = getCacheKey(selectedClient.id, 'waterBills', menuConfigHash);
  
  // Check cache first
  const cached = featureCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.result;
  }
  
  // Perform the actual check
  let result = false;
  
  // Method 1: Check menu configuration from Firestore (PRIMARY)
  if (menuConfig && menuConfig.length > 0) {
    result = menuConfig.some(item => item.activity === 'WaterBills');
    if (result) {
      // Cache positive results and log once
      featureCache.set(cacheKey, { result, timestamp: Date.now() });
      console.log('🔍 [clientFeatures] Water bills enabled for client:', selectedClient.id);
      return result;
    }
  }
  
  // Method 2: Check legacy configuration.activities array (fallback)
  if (selectedClient.configuration?.activities) {
    result = selectedClient.configuration.activities.some(activity => 
      activity.activity === 'WaterBills'
    );
    if (result) {
      // Cache positive results and log once
      featureCache.set(cacheKey, { result, timestamp: Date.now() });
      console.log('🔍 [clientFeatures] Water bills enabled for client:', selectedClient.id, '(legacy config)');
      return result;
    }
  }
  
  // Cache negative results and log once (with less verbosity)
  featureCache.set(cacheKey, { result: false, timestamp: Date.now() });
  console.log('🔍 [clientFeatures] Water bills not available for client:', selectedClient.id);
  return false;
};

/**
 * Check if a client has HOA dues feature enabled
 * @param {Object} selectedClient - The selected client object
 * @param {Array} menuConfig - The menu configuration from ClientContext
 * @returns {boolean} True if HOA dues are enabled, false otherwise
 */
export const hasHOADues = (selectedClient, menuConfig = []) => {
  if (!selectedClient) {
    return false;
  }
  
  // Most clients have HOA dues by default
  // This function exists for consistency and future expansion
  return true;
};

/**
 * Check if a client has transactions feature enabled
 * @param {Object} selectedClient - The selected client object
 * @param {Array} menuConfig - The menu configuration from ClientContext
 * @returns {boolean} True if transactions are enabled, false otherwise
 */
export const hasTransactions = (selectedClient, menuConfig = []) => {
  if (!selectedClient) {
    return false;
  }
  
  // Most clients have transactions by default
  return true;
};

/**
 * Clear feature cache (useful when client changes)
 * @param {string} clientId - Optional client ID to clear specific client cache
 */
export const clearFeatureCache = (clientId = null) => {
  if (clientId) {
    // Clear cache entries for specific client
    for (const [key] of featureCache) {
      if (key.startsWith(`${clientId}_`)) {
        featureCache.delete(key);
      }
    }
    console.log('🧹 [clientFeatures] Cleared feature cache for client:', clientId);
  } else {
    // Clear all cache
    featureCache.clear();
    console.log('🧹 [clientFeatures] Cleared all feature cache');
  }
};

/**
 * Get all enabled features for a client
 * @param {Object} selectedClient - The selected client object
 * @param {Array} menuConfig - The menu configuration from ClientContext
 * @returns {Object} Object with feature flags
 */
export const getClientFeatures = (selectedClient, menuConfig = []) => {
  return {
    waterBills: hasWaterBills(selectedClient, menuConfig),
    hoaDues: hasHOADues(selectedClient, menuConfig),
    transactions: hasTransactions(selectedClient, menuConfig)
  };
};