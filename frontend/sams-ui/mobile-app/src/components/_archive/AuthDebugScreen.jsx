import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { useAuth } from '../hooks/useAuthStable.jsx';

const AuthDebugScreen = () => {
  const { user, login, logout, loading, error, clearError, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [logs, setLogs] = useState([]);
  const renderCount = useRef(0);

  const addLog = (message) => {
    console.log('AUTH DEBUG:', message);
    setLogs(prev => [...prev.slice(-8), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Track renders - FIXED
  useEffect(() => {
    renderCount.current++;
    console.log('AUTH DEBUG: Render #', renderCount.current);
  }); // No dependencies, just track renders

  // Track auth state changes - FIXED
  useEffect(() => {
    const message = `Auth state - User: ${user ? user.email : 'None'}, Loading: ${loading}, Error: ${error}, Authenticated: ${isAuthenticated}`;
    console.log('AUTH DEBUG:', message);
    setLogs(prev => [...prev.slice(-8), `${new Date().toLocaleTimeString()}: ${message}`]);
  }, [user, loading, error, isAuthenticated]);

  // Track user changes specifically
  useEffect(() => {
    if (user) {
      addLog(`User object changed: ${JSON.stringify(user)}`);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    addLog(`Attempting login with ${email}`);
    try {
      await login(email, password);
      addLog('Login attempt completed');
    } catch (error) {
      addLog(`Login failed: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    addLog('Attempting logout');
    try {
      await logout();
      addLog('Logout completed');
    } catch (error) {
      addLog(`Logout failed: ${error.message}`);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        backgroundColor: 'grey.100',
      }}
    >
      <Typography variant="h4" gutterBottom>
        Auth Debug Screen (Render #{renderCount.current})
      </Typography>
      
      <Card sx={{ width: '100%', maxWidth: 600, mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Auth State:
          </Typography>
          <Typography variant="body2">User: {user ? user.email : 'None'}</Typography>
          <Typography variant="body2">Loading: {loading ? 'Yes' : 'No'}</Typography>
          <Typography variant="body2">Error: {error || 'None'}</Typography>
          <Typography variant="body2">Authenticated: {isAuthenticated ? 'Yes' : 'No'}</Typography>
          
          <Typography variant="h6" sx={{ mt: 2 }} gutterBottom>
            Debug Logs:
          </Typography>
          {logs.map((log, index) => (
            <Typography key={index} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
              {log}
            </Typography>
          ))}
        </CardContent>
      </Card>
      
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              type="email"
              label="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                addLog(`Email changed: ${e.target.value}`);
              }}
              disabled={loading}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              type="password"
              label="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                addLog('Password changed');
              }}
              disabled={loading}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ py: 1.5, mb: 2 }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>

            {isAuthenticated && (
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                onClick={handleLogout}
                disabled={loading}
                sx={{ py: 1.5 }}
              >
                Sign Out
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuthDebugScreen;
