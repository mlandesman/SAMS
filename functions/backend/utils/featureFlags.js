/**
 * Feature Flags Utility
 *
 * Per SAMS Feature_Flag_Requirements.md section 9.2
 * Flags stored in Firestore at system/featureFlags (system-level, deployment-scoped)
 *
 * @module featureFlags
 */

import { getDb } from '../firebase.js';

let cachedFlags = null;
let cacheExpiry = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Get all feature flags from Firestore (cached)
 * @returns {Promise<Object>} Flags object
 */
export async function getFeatureFlags() {
  const now = Date.now();
  if (cachedFlags && now < cacheExpiry) {
    return cachedFlags;
  }
  const db = await getDb();
  const doc = await db.doc('system/featureFlags').get();
  cachedFlags = doc.exists ? doc.data() : {};
  cacheExpiry = now + CACHE_TTL;
  return cachedFlags;
}

/**
 * Check if a feature is enabled
 * @param {string} featureName - Feature flag name
 * @returns {Promise<boolean>} True if enabled
 */
export async function isFeatureEnabled(featureName) {
  const flags = await getFeatureFlags();
  return flags[featureName]?.enabled === true;
}
