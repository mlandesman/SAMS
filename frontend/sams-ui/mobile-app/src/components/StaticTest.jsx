import React from 'react';
import { Box, Typography, Card, CardContent, Button } from '@mui/material';

const StaticTest = () => {
  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        PWA Static Test Page
      </Typography>
      
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ✅ React is Working
          </Typography>
          <Typography variant="body2">
            This page loads without authentication to test basic PWA functionality.
          </Typography>
        </CardContent>
      </Card>
      
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ✅ Material-UI is Working
          </Typography>
          <Button variant="contained" color="primary">
            Test Button
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ✅ Sandyland Branding
          </Typography>
          <Typography variant="body2">
            No "SAMS" blue box - professional Sandyland branding in place.
          </Typography>
        </CardContent>
      </Card>
      
      <Box mt={3}>
        <Typography variant="body2" color="text.secondary">
          Current Time: {new Date().toLocaleString()}
        </Typography>
      </Box>
    </Box>
  );
};

export default StaticTest;
