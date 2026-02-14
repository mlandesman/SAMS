/**
 * Client Access Control Middleware
 * Enforces strict client isolation and prevents cross-client data access
 * 
 * Phase 8: User Access Control System - Critical Security Implementation
 * Implementation Date: June 23, 2025
 */

import { getDb, getApp } from '../firebase.js';
import admin from 'firebase-admin';
import { createRequire } from 'module';
import { getNow } from '../services/DateService.js';
import { logDebug, logInfo, logWarn, logError } from '../../shared/logger.js';
const require = createRequire(import.meta.url);

// Load service account to get expected project ID
const getExpectedProjectId = () => {
  if (process.env.NODE_ENV === 'production') {
    return require('../sams-production-serviceAccountKey.json').project_id;
  } else if (process.env.NODE_ENV === 'staging') {
    return require('../serviceAccountKey-staging.json').project_id;
  }
  return require('../serviceAccountKey.json').project_id;
};

/**
 * Enhanced authentication middleware that includes SAMS user profile
 * This replaces the basic authenticateUser middleware with client access data
 */
export const authenticateUserWithProfile = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Invalid authorization format - use 'Bearer YOUR_TOKEN'" });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (verifyError) {
      // Re-throw with proper context for error handling below
      throw verifyError;
    }
    
    // Check if token is from correct Firebase project
    const expectedProjectId = getExpectedProjectId();
    if (decodedToken.aud !== expectedProjectId) {
      logError(`Token from wrong project. Expected: ${expectedProjectId}, Got: ${decodedToken.aud}`);
      return res.status(401).json({ error: "Token is from incorrect Firebase project" });
    }
    
    // Get user profile with role and client access information
    const db = await getDb();
    
    // Look up user by UID (original design)
    let userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    // All users should use UID-based document IDs
    // Legacy email-based lookup has been removed per ZERO TOLERANCE policy
    
    let samsProfile = null;
    if (userDoc.exists) {
      samsProfile = {
        id: userDoc.id,
        ...userDoc.data()
      };
    }
    
    // Add comprehensive user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.display_name,
      emailVerified: decodedToken.email_verified,
      samsProfile: samsProfile,
      // Helper methods
      isSuperAdmin: () => {
        return samsProfile?.globalRole === 'superAdmin';
      },
      getPropertyAccess: (clientId) => {
        // Support both field names for backwards compatibility
        return samsProfile?.propertyAccess?.[clientId] || samsProfile?.clientAccess?.[clientId] || null;
      },
      hasPropertyAccess: (clientId) => {
        if (req.user.isSuperAdmin()) return true;
        // Support both field names for backwards compatibility
        return !!(samsProfile?.propertyAccess?.[clientId] || samsProfile?.clientAccess?.[clientId]);
      }
    };
    
    logDebug(`🔐 User authenticated: ${req.user.email} - SuperAdmin: ${req.user.isSuperAdmin()}`);
    
    next();
  } catch (error) {
    logError('Authentication error:', error);
    logError('Error code:', error.code);
    logError('Error message:', error.message);
    
    // Provide specific error messages based on Firebase error codes
    let errorMessage = 'Invalid token format - not a valid Firebase token'; // Default for truly invalid tokens
    
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Token has expired - please log in again';
    } else if (error.code === 'auth/id-token-revoked') {
      errorMessage = 'Token has been revoked - please log in again';
    } else if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
      // These are the actual error codes for malformed tokens
      errorMessage = 'Invalid token format - not a valid Firebase token';
    } else if (error.code === 'auth/invalid-argument') {
      // This can happen when token is completely malformed
      errorMessage = 'Invalid token format - not a valid Firebase token';
    } else if (error.message && error.message.includes('Firebase ID token has incorrect')) {
      // This should be caught by our explicit project ID check above, but keep as fallback
      errorMessage = 'Token is from incorrect Firebase project';
    } else if (error.message && error.message.includes('Decoding Firebase ID token failed')) {
      // Generic decoding failure
      errorMessage = 'Invalid token format - not a valid Firebase token';
    }
    
    res.status(401).json({ error: errorMessage });
  }
};

/**
 * Middleware to enforce client access control
 * Prevents users from accessing clients they're not assigned to
 */
export const enforceClientAccess = async (req, res, next) => {
  try {
    const { user } = req;
    
    // Reduced CLIENT AUTH logging for cleaner backend logs (only errors)
    // logDebug('🔍 [CLIENT AUTH] Request details:', {
    //   url: req.originalUrl,
    //   method: req.method,
    //   params: req.params,
    //   body_keys: Object.keys(req.body || {}),
    //   query: req.query,
    //   originalParams: req.originalParams
    // });
    
    // CRITICAL: For multipart/form-data requests, DO NOT access req.body
    // Accessing req.body triggers Express/Firebase Functions to parse the body, consuming the stream
    // For upload routes (/clients/:clientId/documents/upload), clientId comes from URL params
    const contentType = (req.headers['content-type'] || '').toLowerCase();
    const isMultipart = contentType.startsWith('multipart/form-data');
    
    let requestedClientId;
    if (isMultipart) {
      // For multipart requests, only check params and query (body not parsed yet)
      requestedClientId = req.params.clientId || req.originalParams?.clientId || req.query.clientId;
    } else {
      // For non-multipart requests, can safely check body
      requestedClientId = req.params.clientId || req.originalParams?.clientId || req.body?.clientId || req.query.clientId;
    }
    
    // logDebug('🔍 [CLIENT AUTH] Client ID extraction result:', requestedClientId);
    
    if (!requestedClientId) {
      logError('❌ [CLIENT AUTH] No client ID found in any location');
      // Don't access req.body in error response for multipart requests
      const debugInfo = {
        params: req.params,
        originalParams: req.originalParams,
        query: req.query
      };
      if (!isMultipart) {
        debugInfo.body_keys = Object.keys(req.body || {});
      }
      return res.status(400).json({ 
        error: 'Client ID is required',
        code: 'MISSING_CLIENT_ID',
        debug: debugInfo
      });
    }
    
    // SuperAdmin can access all clients
    if (user.isSuperAdmin()) {
      // Reduced SuperAdmin access logging
      // logDebug(`✅ SuperAdmin ${user.email} accessing client ${requestedClientId}`);
      req.authorizedClientId = requestedClientId;
      return next();
    }
    
    // Check if user has access to this client
    if (!user.hasPropertyAccess(requestedClientId)) {
      logWarn(`🚫 Access denied: ${user.email} attempted to access client ${requestedClientId}`);
      return res.status(403).json({ 
        error: 'Access denied to this client',
        code: 'CLIENT_ACCESS_DENIED',
        clientId: requestedClientId
      });
    }
    
    const propertyAccess = user.getPropertyAccess(requestedClientId);
    logDebug(`✅ User ${user.email} accessing client ${requestedClientId} with role ${propertyAccess.role}`);
    
    // Add client context to request
    req.authorizedClientId = requestedClientId;
    req.clientRole = propertyAccess.role;
    req.assignedUnitId = propertyAccess.unitId;
    
    next();
  } catch (error) {
    logError('Client access enforcement error:', error);
    res.status(500).json({ error: 'Internal server error during authorization' });
  }
};

/**
 * Middleware to enforce permission-based access control
 * Checks if user has required permission for the operation
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const { user, clientRole, assignedUnitId } = req;
      
      // Enhanced SuperAdmin bypass with detailed logging
      const isSuperAdmin = user.isSuperAdmin();
      logDebug(`🔐 Permission check for ${user.email}: ${permission}`, {
        isSuperAdmin,
        email: user.email,
        globalRole: user.samsProfile?.globalRole,
        clientRole,
        permission
      });
      
      if (isSuperAdmin) {
        logDebug(`✅ SuperAdmin ${user.email} bypassing permission check for ${permission}`);
        return next();
      }
      
      // Explicit check for transaction.delete permission - SuperAdmin always allowed
      if (permission === 'transactions.delete' && user.samsProfile?.globalRole === 'superAdmin') {
        logDebug(`✅ SuperAdmin ${user.email} explicitly allowed transaction deletion`);
        return next();
      }
      
      // Check if user has the required permission based on their role
      // For system-level permissions, check global role instead of client role
      const roleToCheck = permission.startsWith('system.') ? user.samsProfile?.globalRole : clientRole;
      const hasPermission = checkUserPermission(roleToCheck, permission, assignedUnitId, req);
      
      if (!hasPermission) {
        logWarn(`🚫 Permission denied: ${user.email} lacks permission ${permission} for role ${clientRole}`);
        return res.status(403).json({ 
          error: 'Failed to delete transaction. Please ensure you have the necessary permissions and try again.',
          code: 'PERMISSION_DENIED',
          required: permission,
          userRole: clientRole
        });
      }
      
      logDebug(`✅ Permission granted: ${user.email} has ${permission} access`);
      next();
    } catch (error) {
      logError('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error during permission check' });
    }
  };
};

/**
 * Check if a user role has a specific permission
 */
function checkUserPermission(role, permission, unitId, req) {
  // Define role-based permissions
  const rolePermissions = {
    admin: [
      'client.view', 'client.manage',
      'transactions.view', 'transactions.create', 'transactions.edit', 'transactions.delete',
      'documents.view', 'documents.upload', 'documents.delete',
      'reports.view', 'reports.generate',
      'units.view', 'units.edit',
      'users.view', 'users.manage',
      'expenses.create', 'expenses.view', 'expenses.edit'
    ],
    superAdmin: [
      'system.admin', 'system.config', 'system.maintenance',
      'client.view', 'client.manage', 'client.create', 'client.delete',
      'transactions.view', 'transactions.create', 'transactions.edit', 'transactions.delete',
      'documents.view', 'documents.upload', 'documents.delete',
      'reports.view', 'reports.generate',
      'units.view', 'units.edit', 'units.create', 'units.delete',
      'users.view', 'users.manage', 'users.create', 'users.delete',
      'expenses.create', 'expenses.view', 'expenses.edit'
    ],
    unitOwner: [
      'own.transactions.view',
      'own.receipts.view', 
      'own.documents.view',
      'documents.view',
      'own.reports.view'
    ],
    unitManager: [
      'assigned.transactions.view',
      'assigned.receipts.generate',
      'assigned.documents.view',
      'documents.view',
      'assigned.reports.view'
    ]
  };
  
  const permissions = rolePermissions[role] || [];
  
  logDebug(`🔍 Checking permission for role ${role}: ${permission}`, {
    userPermissions: permissions,
    hasExactMatch: permissions.includes(permission),
    isAdmin: role === 'admin'
  });
  
  // Check for exact permission match
  if (permissions.includes(permission)) {
    logDebug(`✅ Permission found in role permissions for ${role}`);
    return true;
  }
  
  // Check for wildcard permissions (admin gets everything)
  if (role === 'admin') {
    logDebug(`✅ Admin role has wildcard access to ${permission}`);
    return true;
  }
  
  // Explicit check for admin + transactions.delete (defensive programming)
  if (role === 'admin' && permission === 'transactions.delete') {
    logDebug(`✅ Admin explicitly granted transaction deletion access`);
    return true;
  }
  
  // Handle unit-specific permissions
  if (permission.startsWith('own.') && (role === 'unitOwner' || role === 'unitManager')) {
    // Need to verify the requested resource belongs to this unit
    // This would need additional context from the specific route
    return checkUnitOwnership(req, unitId);
  }
  
  logDebug(`❌ Permission denied for role ${role}: ${permission}`);
  return false;
}

/**
 * Verify that the requested resource belongs to the user's assigned unit
 */
function checkUnitOwnership(req, userUnitId) {
  // This function would need to be implemented based on the specific
  // resource being accessed (transaction, document, etc.)
  // For now, return true if user has a unit assigned
  return !!userUnitId;
}

/**
 * Middleware to log security events for audit purposes
 * Note: Only logs successful access at DEBUG level (normal operation)
 * Failed authorization attempts are logged as WARN/ERROR by auth middleware
 */
export const logSecurityEvent = (eventType) => {
  return (req, res, next) => {
    const { user, authorizedClientId } = req;
    
    // Get clientId from params, query, or authorizedClientId
    const clientId = req.params?.clientId || req.query?.clientId || authorizedClientId;
    
    // Successful access is normal operation, not a security event - use DEBUG level
    logDebug(`🔍 Access: ${eventType}`, {
      user: user.email,
      clientId: clientId,
      timestamp: getNow().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    
    // TODO: Implement proper audit logging to database for actual security events (failures)
    next();
  };
};