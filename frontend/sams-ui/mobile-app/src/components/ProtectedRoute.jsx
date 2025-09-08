import React from 'react';
import { Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { LoadingSpinner } from './common';
import { useAuth } from '../hooks/useAuthStable.jsx';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="calc(100vh - 64px)"
      >
        <LoadingSpinner size="medium" />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default ProtectedRoute;
