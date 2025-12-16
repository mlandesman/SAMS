/**
 * Unit Contact Structure Utilities
 * 
 * Provides normalization functions for unit owners and managers
 * Handles backward compatibility between old format (["name"]) and new format ([{name, email}])
 * 
 * Task ID: UNIT-CONTACT-CODE-UPDATE-20251216
 * Date: December 16, 2025
 */

/**
 * Normalize owners array to new structure [{name, email}]
 * Assumes new format only - converts string format if found (should not happen after migration)
 * 
 * @param {Array<Object>|undefined} owners - Owners array in [{name, email}] format
 * @returns {Array<{name: string, email: string}>} Normalized owners array
 */
export function normalizeOwners(owners) {
  if (!Array.isArray(owners)) return [];
  
  return owners.map(owner => {
    // Handle legacy string format (should be migrated, but handle gracefully)
    if (typeof owner === 'string') {
      console.warn('⚠️  Found legacy string format owner - should be migrated:', owner);
      return { name: owner.trim(), email: '' };
    }
    // New format: {name, email}
    return {
      name: (owner.name || '').trim(),
      email: (owner.email || '').trim()
    };
  }).filter(owner => owner.name); // Remove empty names
}

/**
 * Normalize managers array to new structure [{name, email}]
 * Assumes new format only - converts string format if found (should not happen after migration)
 * 
 * @param {Array<Object>|undefined} managers - Managers array in [{name, email}] format
 * @returns {Array<{name: string, email: string}>} Normalized managers array
 */
export function normalizeManagers(managers) {
  if (!Array.isArray(managers)) return [];
  
  return managers.map(manager => {
    // Handle legacy string format (should be migrated, but handle gracefully)
    if (typeof manager === 'string') {
      console.warn('⚠️  Found legacy string format manager - should be migrated:', manager);
      return { name: manager.trim(), email: '' };
    }
    // New format: {name, email}
    return {
      name: (manager.name || '').trim(),
      email: (manager.email || '').trim()
    };
  }).filter(manager => manager.name); // Remove empty names
}

/**
 * Extract owner names as array of strings (for backward compatibility)
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @returns {Array<string>} Array of owner names
 */
export function getOwnerNames(owners) {
  return normalizeOwners(owners).map(owner => owner.name);
}

/**
 * Extract manager names as array of strings (for backward compatibility)
 * 
 * @param {Array<string|Object>|undefined} managers - Managers array (old or new format)
 * @returns {Array<string>} Array of manager names
 */
export function getManagerNames(managers) {
  return normalizeManagers(managers).map(manager => manager.name);
}

/**
 * Get first owner name (for backward compatibility)
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @returns {string} First owner name or empty string
 */
export function getFirstOwnerName(owners) {
  const normalized = normalizeOwners(owners);
  return normalized.length > 0 ? normalized[0].name : '';
}

/**
 * Get first owner object (with name and email)
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @returns {{name: string, email: string}|null} First owner object or null
 */
export function getFirstOwner(owners) {
  const normalized = normalizeOwners(owners);
  return normalized.length > 0 ? normalized[0] : null;
}

/**
 * Extract owner last name from first owner (for display purposes)
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @returns {string} Last name or empty string
 */
export function getFirstOwnerLastName(owners) {
  const firstOwner = getFirstOwner(owners);
  if (!firstOwner || !firstOwner.name) return '';
  
  const nameParts = firstOwner.name.trim().split(/\s+/);
  if (nameParts.length > 1) {
    return nameParts[nameParts.length - 1];
  }
  return nameParts[0] || '';
}

/**
 * Join owner names with comma (for display)
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @param {string} separator - Separator string (default: ', ')
 * @returns {string} Comma-separated owner names
 */
export function joinOwnerNames(owners, separator = ', ') {
  return getOwnerNames(owners).join(separator);
}

/**
 * Join manager names with comma (for display)
 * 
 * @param {Array<string|Object>|undefined} managers - Managers array (old or new format)
 * @param {string} separator - Separator string (default: ', ')
 * @returns {string} Comma-separated manager names
 */
export function joinManagerNames(managers, separator = ', ') {
  return getManagerNames(managers).join(separator);
}
