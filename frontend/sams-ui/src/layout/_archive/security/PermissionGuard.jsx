/**
 * Permission Guard Component
 * Phase 8: User Access Control System - Frontend Security
 * 
 * Provides declarative permission-based access control for UI components
 * Integrates with backend security model for consistent authorization
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useClient } from '../../context/ClientContext';
import { hasPermission, canUserPerformOperation } from '../../utils/userRoles';

/**
 * PermissionGuard Component
 * Conditionally renders children based on user permissions
 * 
 * @param {Object} props
 * @param {string|string[]} props.permission - Required permission(s)
 * @param {string} props.operation - Operation type (view, create, edit, delete)
 * @param {string} props.resource - Resource type (transactions, documents, etc.)
 * @param {React.ReactNode} props.children - Content to render if authorized
 * @param {React.ReactNode} props.fallback - Content to render if not authorized
 * @param {boolean} props.hideOnDeny - If true, renders nothing when access denied
 * @param {Object} props.resourceData - Additional resource data for context-specific checks
 */
export const PermissionGuard = ({ 
  permission, 
  operation, 
  resource, 
  children, 
  fallback = null, 
  hideOnDeny = false,
  resourceData = {} 
}) => {
  const { samsUser } = useAuth();
  const { selectedClient } = useClient();

  // Determine if user has required permissions
  const hasAccess = React.useMemo(() => {
    if (!samsUser || !selectedClient) {
      return false;
    }

    // Check specific permission if provided
    if (permission) {
      const permissions = Array.isArray(permission) ? permission : [permission];
      return permissions.some(perm => 
        hasPermission(samsUser, perm, selectedClient.id)
      );
    }

    // Check operation-based permission if provided
    if (operation && resource) {
      return canUserPerformOperation(
        samsUser, 
        operation, 
        resource, 
        selectedClient.id,
        resourceData
      );
    }

    // Default to deny if no permission criteria specified
    return false;
  }, [samsUser, selectedClient, permission, operation, resource, resourceData]);

  // Render based on access level
  if (hasAccess) {
    return <>{children}</>;
  }

  if (hideOnDeny) {
    return null;
  }

  return fallback;
};

/**
 * Higher-Order Component for Permission Protection
 * Wraps components with permission checking logic
 */
export const withPermission = (permission, options = {}) => {
  return (WrappedComponent) => {
    return function PermissionProtectedComponent(props) {
      return (
        <PermissionGuard 
          permission={permission} 
          {...options}
        >
          <WrappedComponent {...props} />
        </PermissionGuard>
      );
    };
  };
};

/**
 * Hook for permission checking in functional components
 */
export const usePermission = (permission, clientId = null) => {
  const { samsUser } = useAuth();
  const { selectedClient } = useClient();
  
  const targetClientId = clientId || selectedClient?.id;

  return React.useMemo(() => {
    if (!samsUser || !targetClientId) {
      return false;
    }

    return hasPermission(samsUser, permission, targetClientId);
  }, [samsUser, permission, targetClientId]);
};

/**
 * Hook for operation-based permission checking
 */
export const useOperationPermission = (operation, resource, resourceData = {}) => {
  const { samsUser } = useAuth();
  const { selectedClient } = useClient();

  return React.useMemo(() => {
    if (!samsUser || !selectedClient) {
      return false;
    }

    return canUserPerformOperation(
      samsUser, 
      operation, 
      resource, 
      selectedClient.id,
      resourceData
    );
  }, [samsUser, selectedClient, operation, resource, resourceData]);
};

/**
 * Specialized Permission Guards for Common Use Cases
 */

export const TransactionGuard = ({ operation = 'view', children, fallback }) => (
  <PermissionGuard 
    operation={operation} 
    resource="transactions"
    children={children}
    fallback={fallback}
  />
);

export const DocumentGuard = ({ operation = 'view', children, fallback }) => (
  <PermissionGuard 
    operation={operation} 
    resource="documents"
    children={children}
    fallback={fallback}
  />
);

export const AdminGuard = ({ children, fallback = null }) => (
  <PermissionGuard 
    permission="client.manage"
    children={children}
    fallback={fallback}
  />
);

export const SuperAdminGuard = ({ children, fallback = null }) => (
  <PermissionGuard 
    permission="system.admin"
    children={children}
    fallback={fallback}
  />
);

/**
 * Role-Based Guards
 */
export const RoleGuard = ({ role, children, fallback = null }) => {
  const { samsUser } = useAuth();
  const { selectedClient } = useClient();

  const hasRole = React.useMemo(() => {
    if (!samsUser || !selectedClient) {
      return false;
    }

    // SuperAdmin check
    if (role === 'superAdmin') {
      return samsUser.email === 'michael@landesman.com' || 
             samsUser.globalRole === 'superAdmin';
    }

    // Client-specific role check
    const propertyAccess = samsUser.propertyAccess?.[selectedClient.id];
    return propertyAccess?.role === role;
  }, [samsUser, selectedClient, role]);

  return hasRole ? children : fallback;
};

export default PermissionGuard;