/**
 * Client Feature Detection Utilities
 * Simplified version for mobile PWA
 */

/**
 * Check if a client has water bills feature enabled
 * @param {Object} selectedClient - The selected client object
 * @param {Array} menuConfig - Optional menu configuration (not used in mobile, kept for compatibility)
 * @returns {boolean} True if water bills are enabled, false otherwise
 */
export const hasWaterBills = (selectedClient, menuConfig = []) => {
  if (!selectedClient) {
    return false;
  }
  
  // Method 1: Check menu configuration if provided (for future compatibility)
  if (menuConfig && menuConfig.length > 0) {
    const hasWaterBills = menuConfig.some(item => item.activity === 'WaterBills');
    if (hasWaterBills) {
      console.log('🔍 [clientFeatures] Water bills enabled for client:', selectedClient.id, '(menu config)');
      return true;
    }
  }
  
  // Method 2: Check legacy configuration.activities array (PRIMARY for mobile)
  if (selectedClient.configuration?.activities) {
    const hasWaterBills = selectedClient.configuration.activities.some(activity => 
      activity.activity === 'WaterBills'
    );
    if (hasWaterBills) {
      console.log('🔍 [clientFeatures] Water bills enabled for client:', selectedClient.id, '(legacy config)');
      return true;
    }
  }
  
  // Method 3: Check client ID as fallback (AVII has water bills)
  if (selectedClient.id === 'AVII') {
    console.log('🔍 [clientFeatures] Water bills enabled for client:', selectedClient.id, '(client ID fallback)');
    return true;
  }
  
  console.log('🔍 [clientFeatures] Water bills not available for client:', selectedClient.id);
  return false;
};

/**
 * Check if a client has HOA dues feature enabled
 * @param {Object} selectedClient - The selected client object
 * @param {Array} menuConfig - Optional menu configuration
 * @returns {boolean} True if HOA dues are enabled, false otherwise
 */
export const hasHOADues = (selectedClient, menuConfig = []) => {
  if (!selectedClient) {
    return false;
  }
  
  // Most clients have HOA dues by default
  return true;
};

