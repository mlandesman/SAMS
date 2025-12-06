/**
 * Security Utilities for SAMS Multi-Tenant System
 * Provides helper functions for access control and data isolation
 * 
 * Phase 8: User Access Control System - Critical Security Implementation
 * Implementation Date: June 23, 2025
 */

import { getNow } from '../services/DateService.js';

/**
 * Validate that a user can access a specific client
 */
export function validateClientAccess(user, clientId) {
  if (!user || !clientId) {
    return { allowed: false, reason: 'Missing user or client ID' };
  }
  
  // SuperAdmin can access everything
  if (user.isSuperAdmin()) {
    return { allowed: true, reason: 'SuperAdmin access' };
  }
  
  // Check client access
  // Note: Middleware uses hasPropertyAccess/getPropertyAccess (not hasClientAccess)
  if (!user.hasPropertyAccess?.(clientId)) {
    return { 
      allowed: false, 
      reason: `User ${user.email} not authorized for client ${clientId}` 
    };
  }
  
  return { allowed: true, reason: 'Valid client access' };
}

/**
 * Get filtered client list based on user access
 */
export function getAuthorizedClients(user, allClients) {
  if (!user) return [];
  
  // SuperAdmin sees all clients
  if (user.isSuperAdmin()) {
    return allClients;
  }
  
  // Filter to only clients user has access to
  if (!user.samsProfile?.propertyAccess) return [];
  
  const authorizedClientIds = Object.keys(user.samsProfile.propertyAccess);
  return allClients.filter(client => authorizedClientIds.includes(client.id));
}

/**
 * Check if user can perform a specific operation on a resource
 */
export function canUserPerformOperation(user, operation, resourceType, clientId, resourceData = {}) {
  // SuperAdmin can do everything
  if (user.isSuperAdmin()) {
    return { allowed: true, reason: 'SuperAdmin access' };
  }
  
  // Validate client access first
  const propertyAccess = validateClientAccess(user, clientId);
  if (!propertyAccess.allowed) {
    return propertyAccess;
  }
  
  // Note: Middleware uses getPropertyAccess (not getClientAccess)
  const userClientAccess = user.getPropertyAccess?.(clientId);
  const userRole = userClientAccess?.role;
  
  // Define operation permissions by role
  const operationPermissions = {
    // Admin can do everything within their clients
    admin: {
      transactions: ['view', 'create', 'edit', 'delete'],
      documents: ['view', 'upload', 'delete'],
      units: ['view', 'edit', 'manage'],
      users: ['view', 'manage'],
      reports: ['view', 'generate'],
      expenses: ['view', 'create', 'edit']
    },
    
    // Unit owners can only view their own data
    unitOwner: {
      transactions: ['view'],
      documents: ['view'],
      units: ['view'],
      reports: ['view']
    },
    
    // Unit managers have limited management capabilities
    unitManager: {
      transactions: ['view', 'create'],
      documents: ['view', 'upload'],
      units: ['view'],
      reports: ['view', 'generate']
    }
  };
  
  const allowedOps = operationPermissions[userRole]?.[resourceType] || [];
  
  if (!allowedOps.includes(operation)) {
    return { 
      allowed: false, 
      reason: `Role ${userRole} cannot ${operation} ${resourceType}` 
    };
  }
  
  // Additional checks for unit-specific roles
  if ((userRole === 'unitOwner' || userRole === 'unitManager') && userClientAccess.unitId) {
    // For unit-specific roles, verify resource belongs to their unit
    if (resourceData.unitId && resourceData.unitId !== userClientAccess.unitId) {
      return { 
        allowed: false, 
        reason: `Access limited to unit ${userClientAccess.unitId}` 
      };
    }
  }
  
  return { allowed: true, reason: `Valid ${operation} access for ${userRole}` };
}

/**
 * Generate secure database query filters based on user access
 */
export function getSecureQueryFilters(user, clientId, collectionType) {
  const filters = {};
  
  // SuperAdmin doesn't need filters (can see everything)
  if (user.isSuperAdmin()) {
    return filters;
  }
  
  // Validate client access
  const propertyAccess = validateClientAccess(user, clientId);
  if (!propertyAccess.allowed) {
    throw new Error(`Unauthorized client access: ${propertyAccess.reason}`);
  }
  
  // Note: Middleware uses getPropertyAccess (not getClientAccess)
  const userClientAccess = user.getPropertyAccess?.(clientId);
  const userRole = userClientAccess?.role;
  
  // Add role-based filters
  switch (userRole) {
    case 'admin':
      // Admins can see all data for their assigned client
      break;
      
    case 'unitOwner':
    case 'unitManager':
      // Unit-specific roles only see their unit's data
      if (userClientAccess.unitId) {
        filters.unitId = userClientAccess.unitId;
      }
      break;
  }
  
  return filters;
}

/**
 * Sanitize user data before sending to frontend
 */
export function sanitizeUserData(userData, requestingUser) {
  if (!userData) return null;
  
  const sanitized = {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    isActive: userData.isActive,
    lastLoginDate: userData.lastLoginDate,
    firebaseMetadata: userData.firebaseMetadata,
    // Include new profile fields
    canLogin: userData.canLogin,
    accountState: userData.accountState,
    profile: userData.profile,
    notifications: userData.notifications
  };
  
  // Only SuperAdmin or the user themselves can see full profile
  if (requestingUser.isSuperAdmin() || requestingUser.uid === userData.id) {
    sanitized.globalRole = userData.globalRole;
    sanitized.propertyAccess = userData.propertyAccess;
    sanitized.preferredClient = userData.preferredClient;
    sanitized.createdDate = userData.createdDate;
    sanitized.createdBy = userData.createdBy;
    sanitized.creationMethod = userData.creationMethod;
    sanitized.mustChangePassword = userData.mustChangePassword;
  } else {
    // Other users only see basic info
    sanitized.role = 'user'; // Generic role for privacy
  }
  
  return sanitized;
}

/**
 * Validate document access based on client and user permissions
 */
export function validateDocumentAccess(user, documentPath, operation = 'view') {
  // Extract client ID from document path (format: clients/CLIENT_ID/documents/...)
  const pathParts = documentPath.split('/');
  if (pathParts[0] !== 'clients' || !pathParts[1]) {
    return { allowed: false, reason: 'Invalid document path format' };
  }
  
  const clientId = pathParts[1];
  
  // Check client access
  const propertyAccess = validateClientAccess(user, clientId);
  if (!propertyAccess.allowed) {
    return propertyAccess;
  }
  
  // Check operation permissions
  const operationCheck = canUserPerformOperation(user, operation, 'documents', clientId);
  if (!operationCheck.allowed) {
    return operationCheck;
  }
  
  return { allowed: true, reason: 'Valid document access' };
}

/**
 * Create audit log entry for security events
 */
export function createSecurityAuditLog(user, action, resource, clientId, details = {}) {
  return {
    timestamp: getNow().toISOString(),
    userId: user.uid,
    userEmail: user.email,
    action: action,
    resource: resource,
    clientId: clientId,
    success: details.success !== false, // Default to true unless explicitly false
    details: details,
    userAgent: details.userAgent,
    ipAddress: details.ipAddress
  };
}

/**
 * Check for potential security violations
 */
export function detectSecurityViolation(user, requestedClientId, resourceType, operation) {
  const violations = [];
  
  // Check for client access violation
  // Note: Middleware uses hasPropertyAccess/getPropertyAccess (not hasClientAccess)
  if (!user.isSuperAdmin() && !user.hasPropertyAccess?.(requestedClientId)) {
    violations.push({
      type: 'UNAUTHORIZED_CLIENT_ACCESS',
      severity: 'HIGH',
      message: `User ${user.email} attempted to access client ${requestedClientId} without authorization`
    });
  }
  
  // Check for suspicious patterns
  if (operation === 'delete' && resourceType === 'users') {
    violations.push({
      type: 'SENSITIVE_OPERATION',
      severity: 'MEDIUM',
      message: `User ${user.email} attempting to delete user data`
    });
  }
  
  return violations;
}