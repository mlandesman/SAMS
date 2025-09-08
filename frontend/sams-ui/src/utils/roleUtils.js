/**
 * Role-based access control utilities (Legacy)
 * Provides functions to check user permissions and roles
 * 
 * NOTE: This file is being replaced by the comprehensive userRoles.js system
 * These functions are maintained for backward compatibility during transition
 */

import { canAccessExpenseEntry as newCanAccessExpenseEntry, hasPermission, PERMISSIONS } from './userRoles';

/**
 * Check if the current user has admin role for expense entry
 * @param {Object} user - The authenticated user object
 * @param {string} clientId - Optional client ID for client-specific check
 * @returns {boolean} - True if user has admin access, false otherwise
 */
export const canAccessExpenseEntry = (user, clientId = null) => {
  // Use the new comprehensive role system
  return newCanAccessExpenseEntry(user, clientId);
};

/**
 * Check if user is a unit owner (read-only access)
 * @param {Object} user - The authenticated user object
 * @returns {boolean} - True if user is a unit owner
 */
export const isUnitOwner = (user) => {
  if (!user || !user.propertyAccess) {
    return false;
  }
  
  return Object.values(user.propertyAccess).some(
    access => access.role === 'unitOwner'
  );
};

/**
 * Get user's accessible client IDs
 * @param {Object} user - The authenticated user object
 * @returns {Array} - Array of client IDs the user can access
 */
export const getUserAccessibleClients = (user) => {
  if (!user || !user.propertyAccess) {
    return [];
  }
  
  return Object.keys(user.propertyAccess);
};

/**
 * Check if user has access to a specific client
 * @param {Object} user - The authenticated user object
 * @param {string} clientId - The client ID to check
 * @returns {boolean} - True if user has access to this client
 */
export const hasPropertyAccess = (user, clientId) => {
  if (!user || !user.propertyAccess || !clientId) {
    return false;
  }
  
  return user.propertyAccess.hasOwnProperty(clientId);
};