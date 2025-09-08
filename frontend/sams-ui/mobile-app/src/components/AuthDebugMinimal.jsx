import React, { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';

const AuthDebugMinimal = () => {
  const { firebaseUser, samsUser, loading, error, isAuthenticated } = useAuth();
  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    console.log(`AuthDebugMinimal render #${renderCount.current}:`, {
      firebaseUser: firebaseUser?.email || 'none',
      samsUser: samsUser?.email || 'none',
      loading,
      error,
      isAuthenticated,
      timestamp: new Date().toISOString()
    });
  });

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '10px', 
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div>Renders: {renderCount.current}</div>
      <div>FB User: {firebaseUser?.email || 'none'}</div>
      <div>SAMS User: {samsUser?.email || 'none'}</div>
      <div>Loading: {loading ? 'YES' : 'NO'}</div>
      <div>Error: {error || 'none'}</div>
      <div>Authenticated: {isAuthenticated ? 'YES' : 'NO'}</div>
    </div>
  );
};

export default AuthDebugMinimal;
