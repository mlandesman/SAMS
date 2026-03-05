import React, { useState } from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import { useAuth } from '../hooks/useAuth.jsx';
import AuthDebugger from './AuthDebugger.jsx';

// Test component to verify authentication integration
const AuthTest = () => {
  const { 
    firebaseUser, 
    samsUser, 
    currentClient, 
    login, 
    logout, 
    loading, 
    error,
    selectClient 
  } = useAuth();
  
  const [testResult, setTestResult] = useState('');

  const runAuthTest = async () => {
    try {
      setTestResult('Testing authentication...');
      
      // Test with known credentials
      await login('michael@landesman.com', 'SamsTest123!');
      
      setTestResult('✅ Authentication test passed!');
    } catch (error) {
      setTestResult(`❌ Authentication test failed: ${error.message}`);
    }
  };

  const testClientSelection = async () => {
    try {
      setTestResult('Testing client selection...');
      await selectClient('MTC');
      setTestResult('✅ Client selection test passed!');
    } catch (error) {
      setTestResult(`❌ Client selection test failed: ${error.message}`);
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h6" gutterBottom>
        Sandyland Authentication Test
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box mb={2}>
        <Typography><strong>Firebase User:</strong> {firebaseUser?.email || 'Not logged in'}</Typography>
        <Typography><strong>SAMS User:</strong> {samsUser?.email || 'Not loaded'}</Typography>
        <Typography><strong>User Role:</strong> {samsUser?.globalRole || 'Unknown'}</Typography>
        <Typography><strong>Current Client:</strong> {currentClient || 'None selected'}</Typography>
      </Box>
      
      {testResult && (
        <Alert severity={testResult.includes('✅') ? 'success' : 'info'} sx={{ mb: 2 }}>
          {testResult}
        </Alert>
      )}
      
      <Box display="flex" gap={2} flexWrap="wrap">
        {!firebaseUser ? (
          <Button variant="contained" onClick={runAuthTest} disabled={loading}>
            Test Login
          </Button>
        ) : (
          <>
            <Button variant="outlined" onClick={testClientSelection} disabled={loading}>
              Test Client Selection
            </Button>
            <Button variant="outlined" onClick={logout} disabled={loading}>
              Logout
            </Button>
          </>
        )}
      </Box>
      
      {samsUser && (
        <Box mt={3}>
          <Typography variant="subtitle2" gutterBottom>Client Access:</Typography>
          <pre style={{ fontSize: '12px', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
            {JSON.stringify(samsUser.clientAccess, null, 2)}
          </pre>
        </Box>
      )}
      
      <AuthDebugger />
    </Box>
  );
};

export default AuthTest;
