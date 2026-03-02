import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { auth, onAuthStateChanged } from '../services/firebase';

const MinimalAuthTest = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    console.log(message);
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    addLog('Setting up auth listener');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      addLog(`Auth state changed: ${user ? user.email : 'No user'}`);
      setAuthUser(user);
    }, (error) => {
      addLog(`AUTH ERROR: ${error.message}`);
      console.error('Firebase auth error:', error);
    });

    return () => {
      addLog('Cleaning up auth listener');
      unsubscribe();
    };
  }, []); // Empty dependency array

  const handleSubmit = (e) => {
    e.preventDefault();
    addLog(`Form submitted: ${email}`);
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
        Minimal Auth Test
      </Typography>
      
      <Card sx={{ width: '100%', maxWidth: 500, mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Auth Status: {authUser ? authUser.email : 'Not authenticated'}
          </Typography>
          
          <Typography variant="h6" gutterBottom>
            Console Logs:
          </Typography>
          {logs.map((log, index) => (
            <Typography key={index} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {log}
            </Typography>
          ))}
        </CardContent>
      </Card>
      
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              type="email"
              label="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                addLog(`Email input changed: ${e.target.value}`);
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              type="password"
              label="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                addLog(`Password input changed`);
              }}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ py: 1.5 }}
            >
              Test Submit
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MinimalAuthTest;
