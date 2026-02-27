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
  const clientAccess = samsUser?.clientAccess || samsUser?.propertyAccess;
  const hasRequiredRole = () => {
    switch (requiredRole) {
      case 'admin':
        return userRole === 'admin' || userRole === 'superAdmin';
      case 'maintenance':
        return userRole === 'maintenance' || userRole === 'admin' || userRole === 'superAdmin';
      case 'unitOwner': {
        if (userRole === 'unitOwner') return true;
        if (!clientAccess) return false;
        return Object.values(clientAccess).some(access => {
          if (access.unitAssignments) {
            return Object.values(access.unitAssignments).some(unit => 
              unit.role === 'unitOwner' || unit.role === 'unitManager'
            );
          }
          return access.role === 'unitOwner' || access.role === 'unitManager';
        });
      }
      default:
        return true;
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
