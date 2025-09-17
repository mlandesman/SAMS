import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Button, Alert } from '@mui/material';
import { useAuth } from '../hooks/useAuth.jsx';

const AuthDebugger = () => {
  const { firebaseUser, samsUser, currentClient, loading, error, isAuthenticated } = useAuth();
  const [debugInfo, setDebugInfo] = useState([]);

  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    const newInfo = `${timestamp}: Auth state - Firebase: ${firebaseUser?.email || 'none'}, SAMS: ${samsUser?.email || 'none'}, Loading: ${loading}`;
    
    setDebugInfo(prev => [newInfo, ...prev.slice(0, 9)]); // Keep last 10 entries
  }, [firebaseUser, samsUser, loading]);

  const clearDebugInfo = () => {
    setDebugInfo([]);
  };

  return (
    <Card sx={{ mt: 2, mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Auth Debug Info</Typography>
          <Button size="small" onClick={clearDebugInfo}>Clear</Button>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Typography variant="body2" gutterBottom>
          <strong>Current State:</strong>
        </Typography>
        <Typography variant="body2" component="div" sx={{ mb: 2, fontFamily: 'monospace', fontSize: '0.8rem' }}>
          • Loading: {loading ? 'true' : 'false'}<br/>
          • Firebase User: {firebaseUser?.email || 'null'}<br/>
          • SAMS User: {samsUser?.email || 'null'}<br/>
          • Current Client: {currentClient || 'null'}<br/>
          • Is Authenticated: {isAuthenticated ? 'true' : 'false'}<br/>
          • User Role: {samsUser?.globalRole || 'null'}
        </Typography>
        
        <Typography variant="body2" gutterBottom>
          <strong>Recent Activity:</strong>
        </Typography>
        <Box sx={{ maxHeight: 200, overflow: 'auto', bgcolor: '#f5f5f5', p: 1, borderRadius: 1 }}>
          {debugInfo.map((info, index) => (
            <Typography key={index} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {info}
            </Typography>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default AuthDebugger;
