/**
 * Client Access Control Middleware
 * Enforces strict client isolation and prevents cross-client data access
 * 
 * Phase 8: User Access Control System - Critical Security Implementation
 * Implementation Date: June 23, 2025
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';
// Removed email-based document ID imports - reverting to UID-based system

/**
 * Enhanced authentication middleware that includes SAMS user profile
 * This replaces the basic authenticateUser middleware with client access data
 */
export const authenticateUserWithProfile = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Get user profile with role and client access information
    const db = await getDb();
    
    // Look up user by UID (original design)
    let userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      // Legacy fallback: Try to find by email field
      const userQuery = await db.collection('users').where('email', '==', decodedToken.email).get();
      if (!userQuery.empty) {
        userDoc = userQuery.docs[0];
      }
    }
    
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
      getClientAccess: (clientId) => {
        return samsProfile?.clientAccess?.[clientId] || null;
      },
      hasClientAccess: (clientId) => {
        if (req.user.isSuperAdmin()) return true;
        return !!samsProfile?.clientAccess?.[clientId];
      }
    };
    
    console.log(`🔐 User authenticated: ${req.user.email} - SuperAdmin: ${req.user.isSuperAdmin()}`);
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware to enforce client access control
 * Prevents users from accessing clients they're not assigned to
 */
export const enforceClientAccess = async (req, res, next) => {
  try {
    const { user } = req;
    
    // Enhanced debugging for client ID extraction
    console.log('🔍 [CLIENT AUTH] Request details:', {
      url: req.originalUrl,
      method: req.method,
      params: req.params,
      body_keys: Object.keys(req.body || {}),
      query: req.query,
      originalParams: req.originalParams
    });
    
    const requestedClientId = req.params.clientId || req.originalParams?.clientId || req.body.clientId || req.query.clientId;
    
    console.log('🔍 [CLIENT AUTH] Client ID extraction result:', requestedClientId);
    
    if (!requestedClientId) {
      console.error('❌ [CLIENT AUTH] No client ID found in any location');
      return res.status(400).json({ 
        error: 'Client ID is required',
        code: 'MISSING_CLIENT_ID',
        debug: {
          params: req.params,
          originalParams: req.originalParams,
          body_keys: Object.keys(req.body || {}),
          query: req.query
        }
      });
    }
    
    // SuperAdmin can access all clients
    if (user.isSuperAdmin()) {
      console.log(`✅ SuperAdmin ${user.email} accessing client ${requestedClientId}`);
      req.authorizedClientId = requestedClientId;
      return next();
    }
    
    // Check if user has access to this client
    if (!user.hasClientAccess(requestedClientId)) {
      console.warn(`🚫 Access denied: ${user.email} attempted to access client ${requestedClientId}`);
      return res.status(403).json({ 
        error: 'Access denied to this client',
        code: 'CLIENT_ACCESS_DENIED',
        clientId: requestedClientId
      });
    }
    
    const clientAccess = user.getClientAccess(requestedClientId);
    console.log(`✅ User ${user.email} accessing client ${requestedClientId} with role ${clientAccess.role}`);
    
    // Add client context to request
    req.authorizedClientId = requestedClientId;
    req.clientRole = clientAccess.role;
    req.assignedUnitId = clientAccess.unitId;
    
    next();
  } catch (error) {
    console.error('Client access enforcement error:', error);
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
      console.log(`🔐 Permission check for ${user.email}: ${permission}`, {
        isSuperAdmin,
        email: user.email,
        globalRole: user.samsProfile?.globalRole,
        clientRole,
        permission
      });
      
      if (isSuperAdmin) {
        console.log(`✅ SuperAdmin ${user.email} bypassing permission check for ${permission}`);
        return next();
      }
      
      // Explicit check for transaction.delete permission - SuperAdmin always allowed
      if (permission === 'transactions.delete' && user.samsProfile?.globalRole === 'superAdmin') {
        console.log(`✅ SuperAdmin ${user.email} explicitly allowed transaction deletion`);
        return next();
      }
      
      // Check if user has the required permission based on their role
      const hasPermission = checkUserPermission(clientRole, permission, assignedUnitId, req);
      
      if (!hasPermission) {
        console.warn(`🚫 Permission denied: ${user.email} lacks permission ${permission} for role ${clientRole}`);
        return res.status(403).json({ 
          error: 'Failed to delete transaction. Please ensure you have the necessary permissions and try again.',
          code: 'PERMISSION_DENIED',
          required: permission,
          userRole: clientRole
        });
      }
      
      console.log(`✅ Permission granted: ${user.email} has ${permission} access`);
      next();
    } catch (error) {
      console.error('Permission check error:', error);
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
  
  console.log(`🔍 Checking permission for role ${role}: ${permission}`, {
    userPermissions: permissions,
    hasExactMatch: permissions.includes(permission),
    isAdmin: role === 'admin'
  });
  
  // Check for exact permission match
  if (permissions.includes(permission)) {
    console.log(`✅ Permission found in role permissions for ${role}`);
    return true;
  }
  
  // Check for wildcard permissions (admin gets everything)
  if (role === 'admin') {
    console.log(`✅ Admin role has wildcard access to ${permission}`);
    return true;
  }
  
  // Explicit check for admin + transactions.delete (defensive programming)
  if (role === 'admin' && permission === 'transactions.delete') {
    console.log(`✅ Admin explicitly granted transaction deletion access`);
    return true;
  }
  
  // Handle unit-specific permissions
  if (permission.startsWith('own.') && (role === 'unitOwner' || role === 'unitManager')) {
    // Need to verify the requested resource belongs to this unit
    // This would need additional context from the specific route
    return checkUnitOwnership(req, unitId);
  }
  
  console.log(`❌ Permission denied for role ${role}: ${permission}`);
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
 */
export const logSecurityEvent = (eventType) => {
  return (req, res, next) => {
    const { user, authorizedClientId } = req;
    
    console.log(`🔍 Security Event: ${eventType}`, {
      user: user.email,
      clientId: authorizedClientId,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    
    // TODO: Implement proper audit logging to database
    next();
  };
};