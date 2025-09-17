import React from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Box } from '@mui/material';
import { useAuth } from '../hooks/useAuthStable.jsx';

const RoleProtectedRoute = ({ children, requiredRole, fallbackPath = '/' }) => {
  const { samsUser, isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // Loading handled by parent components
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const userRole = samsUser?.globalRole;
  const hasRequiredRole = () => {
    console.log('RoleProtectedRoute Debug:', {
      requiredRole,
      userRole,
      samsUser: samsUser,
      clientAccess: samsUser?.clientAccess
    });
    
    switch (requiredRole) {
      case 'admin':
        return userRole === 'admin' || userRole === 'superAdmin';
      case 'maintenance':
        // For MVP, allow maintenance role or admin/superAdmin
        return userRole === 'maintenance' || userRole === 'admin' || userRole === 'superAdmin';
      case 'unitOwner':
        // Check both globalRole and clientAccess for flexibility
        const hasUnitOwnerRole = userRole === 'unitOwner' || 
          (samsUser?.clientAccess && 
           Object.values(samsUser.clientAccess).some(access => {
             // Check if user has unitOwner or unitManager in unitAssignments
             if (access.unitAssignments) {
               return Object.values(access.unitAssignments).some(unit => 
                 unit.role === 'unitOwner' || unit.role === 'unitManager'
               );
             }
             // Also check direct role (backward compatibility)
             return access.role === 'unitOwner' || access.role === 'unitManager';
           }));
        console.log('Unit Owner Check Result:', {
          hasUnitOwnerRole,
          userRole,
          clientAccess: samsUser?.clientAccess,
          accessRoles: samsUser?.clientAccess ? 
            Object.values(samsUser.clientAccess).map(a => a.role) : []
        });
        return hasUnitOwnerRole;
      default:
        return true; // No specific role required
    }
  };

  if (!hasRequiredRole()) {
    return (
      <Box p={2}>
        <Alert severity="warning">
          You don't have permission to access this feature. 
          {requiredRole === 'admin' ? 
            ' Administrator access is required.' : 
            requiredRole === 'maintenance' ?
            ' Maintenance worker access is required.' :
            ' This feature is not available for your account type.'
          }
        </Alert>
      </Box>
    );
  }

  return children;
};

export default RoleProtectedRoute;
