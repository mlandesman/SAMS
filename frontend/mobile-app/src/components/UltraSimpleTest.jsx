import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
} from '@mui/material';

const UltraSimpleTest = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  console.log('UltraSimpleTest rendering');

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
        Ultra Simple Test
      </Typography>
      
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent>
          <TextField
            fullWidth
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Button
            fullWidth
            variant="contained"
            onClick={() => alert(`Email: ${email}, Password: ${password}`)}
            sx={{ py: 1.5 }}
          >
            Test Button
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UltraSimpleTest;
