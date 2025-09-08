import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
} from '@mui/material';

const SuperSimpleTest = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [logs, setLogs] = useState([]);
  const [renderCount, setRenderCount] = useState(0);

  // Track renders - FIXED to prevent infinite loop
  useEffect(() => {
    const newRenderCount = renderCount + 1;
    setRenderCount(newRenderCount);
    const log = `Render #${newRenderCount} at ${new Date().toLocaleTimeString()}`;
    console.log(log);
    setLogs(prev => [...prev.slice(-4), log]);
  }, []); // Empty dependency array to run only on mount

  // Catch any errors
  useEffect(() => {
    const errorHandler = (event) => {
      console.error('Error caught:', event.error);
      setLogs(prev => [...prev.slice(-4), `ERROR: ${event.error.message}`]);
    };

    const unhandledRejectionHandler = (event) => {
      console.error('Unhandled rejection:', event.reason);
      setLogs(prev => [...prev.slice(-4), `REJECTION: ${event.reason}`]);
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', { email, password });
    setLogs(prev => [...prev.slice(-4), `SUBMIT: ${email}`]);
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
        Super Simple Test (Render #{renderCount})
      </Typography>
      
      <Card sx={{ width: '100%', maxWidth: 500, mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Logs:
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
                console.log('Email changing to:', e.target.value);
                setEmail(e.target.value);
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              type="password"
              label="Password"
              value={password}
              onChange={(e) => {
                console.log('Password changing');
                setPassword(e.target.value);
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

export default SuperSimpleTest;
