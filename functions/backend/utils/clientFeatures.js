/**
 * Client Feature Detection Utilities (Backend)
 * 
 * Centralized functions to check if a client has specific features enabled.
 * This is the backend equivalent of frontend/sams-ui/src/utils/clientFeatures.js
 * 
 * Features are determined by the client's activities menu configuration
 * stored at: clients/{clientId}/config/activities
 * 
 * Created: 2026-01-31
 * Issue: #161 - Fix incorrect hasWaterBillsProject check
 */

/**
 * Check if a client has a specific activity/feature enabled
 * 
 * Reads the client's activities configuration from Firestore and checks
 * if the menu array contains the specified activity.
 * 
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance
 * @param {string} clientId - Client ID (e.g., 'AVII', 'MTC')
 * @param {string} activityName - Activity to check (e.g., 'WaterBills', 'HOADues', 'propaneTanks')
 * @returns {Promise<boolean>} True if activity is enabled, false otherwise
 * 
 * @example
 * const hasWater = await hasActivity(db, 'AVII', 'WaterBills'); // true
 * const hasWater = await hasActivity(db, 'MTC', 'WaterBills');  // false
 * const hasPropane = await hasActivity(db, 'MTC', 'propaneTanks'); // true
 */
export async function hasActivity(db, clientId, activityName) {
  if (!db || !clientId || !activityName) {
    console.warn(`[hasActivity] Invalid parameters: db=${!!db}, clientId=${clientId}, activityName=${activityName}`);
    return false;
  }

  try {
    const activitiesRef = db.collection('clients').doc(clientId)
      .collection('config').doc('activities');
    
    const activitiesDoc = await activitiesRef.get();
    
    if (!activitiesDoc.exists) {
      console.warn(`[hasActivity] No activities config found for client: ${clientId}`);
      return false;
    }

    const data = activitiesDoc.data();
    const menu = data?.menu;

    if (!Array.isArray(menu)) {
      console.warn(`[hasActivity] Activities menu is not an array for client: ${clientId}`);
      return false;
    }

    const hasFeature = menu.some(item => item?.activity === activityName);
    
    // Log for debugging (only on first check per client/activity combo in a request)
    console.log(`[hasActivity] ${clientId} -> ${activityName}: ${hasFeature}`);
    
    return hasFeature;
  } catch (error) {
    console.error(`[hasActivity] Error checking ${activityName} for ${clientId}:`, error.message);
    return false;
  }
}

// Usage examples:
// const hasWaterBills = await hasActivity(db, clientId, 'WaterBills');
// const hasPropane = await hasActivity(db, clientId, 'propaneTanks');
