/**
 * Comprehensive Unit Access Authorization
 * Supports Admin/SuperAdmin, Unit Owners, and Unit Managers
 */

/**
 * Check if a user has access to a specific unit
 * @param {Object} propertyAccess - User's property access object
 * @param {string} requestedUnitId - Unit ID being requested
 * @param {string} userGlobalRole - User's global role (from samsProfile)
 * @returns {boolean} - Whether access is granted
 */
const hasUnitAccess = (propertyAccess, requestedUnitId, userGlobalRole = null) => {
  // Admin/SuperAdmin have unrestricted access to ALL units
  // This is CRITICAL for management tools like Unit Report
  if (['admin', 'superAdmin'].includes(userGlobalRole) || 
      ['admin', 'superAdmin'].includes(propertyAccess.role)) {
    return true;
  }
  
  // Direct unit ownership
  if (propertyAccess.role === 'unitOwner' && propertyAccess.unitId === requestedUnitId) {
    return true;
  }
  
  // Unit management assignments (NEW LOGIC)
  if (propertyAccess.unitAssignments && Array.isArray(propertyAccess.unitAssignments)) {
    return propertyAccess.unitAssignments.some(assignment => 
      assignment.unitId === requestedUnitId && 
      ['unitManager', 'unitOwner'].includes(assignment.role)
    );
  }
  
  return false;
};

/**
 * Express middleware to require unit access
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
const requireUnitAccess = (req, res, next) => {
  const { unitId } = req.params;
  const clientId = req.originalParams?.clientId || req.params.clientId;
  const propertyAccess = req.user.propertyAccess[clientId];
  const userGlobalRole = req.user.samsProfile?.globalRole; // CRITICAL: Include global role
  
  if (!hasUnitAccess(propertyAccess, unitId, userGlobalRole)) {
    return res.status(403).json({ 
      error: 'Access denied to this unit',
      unitId: unitId,
      userRole: propertyAccess.role,
      globalRole: userGlobalRole,
      debug: process.env.NODE_ENV === 'development' ? {
        propertyAccess,
        requestedUnit: unitId
      } : undefined
    });
  }
  
  next();
};

export {
  hasUnitAccess,
  requireUnitAccess
};