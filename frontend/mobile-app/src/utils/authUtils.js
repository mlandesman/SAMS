/**
 * Auth role utilities for mobile app
 * Shared logic for determining user role from samsUser
 */

/**
 * Check if user is unit owner or unit manager
 * @param {Object} samsUser - SAMS user object from auth
 * @returns {boolean}
 */
export function isOwnerOrManager(samsUser) {
  if (!samsUser) return false;
  if (samsUser.globalRole === 'unitOwner') return true;
  const clientAccess = samsUser.clientAccess || samsUser.propertyAccess || {};
  if (Object.keys(clientAccess).length === 0) return false;
  return Object.values(clientAccess).some(
    (access) => access.role === 'unitOwner' || access.role === 'unitManager'
  );
}
