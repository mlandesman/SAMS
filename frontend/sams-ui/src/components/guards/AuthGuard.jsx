import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PropTypes from 'prop-types';

/**
 * AuthGuard component to protect routes from unauthenticated access.
 * Redirects to root if user is not authenticated.
 */
function AuthGuard({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // Show nothing while checking authentication status
  if (loading) {
    return null;
  }

  // Redirect to root if not authenticated
  if (!isAuthenticated) {
    console.log('AuthGuard: User not authenticated, redirecting to root');
    return <Navigate to="/" replace />;
  }

  // User is authenticated, render children
  return children;
}

AuthGuard.propTypes = {
  children: PropTypes.node.isRequired
};

export default AuthGuard;