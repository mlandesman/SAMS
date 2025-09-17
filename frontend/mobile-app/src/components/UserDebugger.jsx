/**
 * User Debugger Component - Shows current user info for debugging
 */

import React from 'react';
import { useAuth } from '../hooks/useAuthStable.jsx';

const UserDebugger = () => {
  const { samsUser, currentClient, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <div>Not authenticated</div>;
  }

  return (
    <div style={{
      background: '#f0f0f0',
      padding: '20px',
      margin: '20px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace'
    }}>
      <h3>User Debug Info</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Current Client:</strong> {currentClient?.id || currentClient || 'None'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Preferred Client:</strong> {samsUser?.preferredClient || 'None'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Global Role:</strong> {samsUser?.globalRole || 'None'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Email:</strong> {samsUser?.email || 'None'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Client Access:</strong>
        <pre style={{ background: 'white', padding: '10px', marginTop: '5px' }}>
          {JSON.stringify(samsUser?.clientAccess, null, 2)}
        </pre>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Full SAMS User:</strong>
        <pre style={{ background: 'white', padding: '10px', marginTop: '5px', maxHeight: '200px', overflow: 'auto' }}>
          {JSON.stringify(samsUser, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default UserDebugger;