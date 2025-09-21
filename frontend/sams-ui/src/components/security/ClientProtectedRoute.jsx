/**
 * Client Protected Route Component
 * Ensures user has access to the currently selected client before rendering content
 */

import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';

const ClientProtectedRoute = ({ children, requiredPermission = null }) => {
  const { selectedClient } = useClient();
  const { samsUser, loading } = useAuth();

  // Still loading user profile
  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  // No client selected - this should trigger client selection modal  
  if (!selectedClient) {
    console.warn('⚠️ ClientProtectedRoute: No client selected');
    return <Navigate to="/dashboard" replace />;
  }

  // User profile not loaded - wait for it
  if (!samsUser) {
    console.warn('⚠️ ClientProtectedRoute: User profile not loaded, waiting...');
    return <div className="loading-spinner">Loading user profile...</div>;
  }

  // Memoize access check to prevent re-renders
  const accessCheck = useMemo(() => {
    // Validate client access - security check
    const hasClientAccess = samsUser.globalRole === 'superAdmin' ||
                           samsUser.propertyAccess?.[selectedClient.id];

    if (!hasClientAccess) {
      console.error('🚫 ClientProtectedRoute: Access denied to client', selectedClient.id);
      // Clear the unauthorized client from context and storage
      localStorage.removeItem('selectedClient');
      return { allowed: false, reason: 'client_access_denied' };
    }

    // Check specific permission if required
    if (requiredPermission) {
      // SuperAdmin bypass - always allow
      if (samsUser.globalRole === 'superAdmin') {
        console.log('✅ ClientProtectedRoute: SuperAdmin bypass for permission:', requiredPermission);
        return { allowed: true, reason: 'superadmin_bypass' };
      } else {
        const propertyAccess = samsUser.propertyAccess?.[selectedClient.id];
        const clientRole = propertyAccess?.role;
        
        console.log('🔍 ClientProtectedRoute: Permission check details:', {
          user: samsUser.email,
          clientId: selectedClient.id,
          propertyAccess: propertyAccess,
          clientRole: clientRole,
          requiredPermission: requiredPermission,
          globalRole: samsUser.globalRole
        });
        
        const hasPermission = checkPermission(clientRole, requiredPermission);
        
        if (!hasPermission) {
          console.error('🚫 ClientProtectedRoute: Permission denied:', {
            requiredPermission,
            clientRole,
            user: samsUser.email
          });
          return { allowed: false, reason: 'permission_denied', clientRole, requiredPermission };
        }
      }
    }
    
    return { allowed: true, reason: 'access_granted' };
  }, [samsUser, selectedClient, requiredPermission]);

  // Handle access denied cases
  if (!accessCheck.allowed) {
    if (accessCheck.reason === 'client_access_denied') {
      return <Navigate to="/dashboard" replace />;
    }
    if (accessCheck.reason === 'permission_denied') {
      return (
        <div className="access-denied">
          <h3>Access Denied</h3>
          <p>You don't have permission to access this feature.</p>
          <p>Required permission: {accessCheck.requiredPermission}</p>
          <p>Your role: {accessCheck.clientRole || 'No role assigned'}</p>
        </div>
      );
    }
  }

  // All checks passed, render children
  return children;
};

/**
 * Check if user role has required permission
 */
function checkPermission(role, permission) {
  // Log for debugging
  console.log(`🔐 Checking permission: role=${role}, permission=${permission}`);
  
  const rolePermissions = {
    admin: [
      'dashboard.view',
      'client.view', 'client.manage',
      'transactions.view', 'transactions.create', 'transactions.edit', 'transactions.delete',
      'documents.view', 'documents.upload', 'documents.delete',
      'reports.view', 'reports.generate',
      'units.view', 'units.edit',
      'users.view', 'users.manage',
      'expenses.create', 'expenses.view', 'expenses.edit'
    ],
    unitOwner: [
      'dashboard.view',
      'transactions.view',
      'documents.view',
      'reports.view'
    ],
    unitManager: [
      'dashboard.view',
      'transactions.view',
      'documents.view',
      'reports.view'
    ]
  };

  const permissions = rolePermissions[role] || [];
  
  // Admin gets all permissions
  if (role === 'admin') {
    return true;
  }
  
  return permissions.includes(permission);
}

export default ClientProtectedRoute;