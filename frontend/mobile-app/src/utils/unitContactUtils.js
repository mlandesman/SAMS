/**
 * Unit Contact Structure Utilities (Mobile App)
 * 
 * Provides normalization functions for unit owners and managers
 * Handles backward compatibility between old format (["name"]) and new format ([{name, email}])
 * 
 * Task ID: UNIT-CONTACT-CODE-UPDATE-20251216
 * Date: December 16, 2025
 */

/**
 * Normalize owners array to new structure [{name, email}]
 * Handles both old format (["name"]) and new format ([{name, email}])
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @returns {Array<{name: string, email: string}>} Normalized owners array
 */
export function normalizeOwners(owners) {
  if (!Array.isArray(owners)) return [];
  
  return owners.map(owner => {
    if (typeof owner === 'string') {
      return { name: owner.trim(), email: '' };
    }
    return {
      name: (owner.name || '').trim(),
      email: (owner.email || '').trim()
    };
  }).filter(owner => owner.name); // Remove empty names
}

/**
 * Normalize managers array to new structure [{name, email}]
 * Handles both old format (["name"]) and new format ([{name, email}])
 * 
 * @param {Array<string|Object>|undefined} managers - Managers array (old or new format)
 * @returns {Array<{name: string, email: string}>} Normalized managers array
 */
export function normalizeManagers(managers) {
  if (!Array.isArray(managers)) return [];
  
  return managers.map(manager => {
    if (typeof manager === 'string') {
      return { name: manager.trim(), email: '' };
    }
    return {
      name: (manager.name || '').trim(),
      email: (manager.email || '').trim()
    };
  }).filter(manager => manager.name); // Remove empty names
}

/**
 * Extract owner last name from first owner (for display purposes)
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @returns {string} Last name or empty string
 */
export function getFirstOwnerLastName(owners) {
  const normalized = normalizeOwners(owners);
  if (normalized.length === 0 || !normalized[0].name) return '';
  
  const nameParts = normalized[0].name.trim().split(/\s+/);
  if (nameParts.length > 1) {
    return nameParts[nameParts.length - 1];
  }
  return nameParts[0] || '';
}
