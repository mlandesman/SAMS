import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
} from '@mui/material';
import {
  Business as BusinessIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';

const ClientSelector = ({ clients, selected, onSelect, samsUser }) => {
  console.log('🏢 ClientSelector received:', { clients, selected, samsUser });
  
  // Get client details from user's client access
  const getClientInfo = (clientId) => {
    const access = samsUser?.clientAccess?.[clientId];
    return {
      id: clientId,
      name: access?.clientName || clientId,
      role: access?.role || 'user',
    };
  };

  if (!clients || clients.length === 0) {
    return (
      <Box p={3}>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          No clients available
        </Typography>
      </Box>
    );
  }

  const clientList = clients.map(getClientInfo);
  console.log('🏢 Client list processed:', clientList);

  if (clientList.length === 1) {
    const client = clientList[0];
    return (
      <Card className="client-selector-single">
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <BusinessIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">{client.name}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" mb={3}>
            You have access to this client
          </Typography>
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={() => onSelect(client.id)}
            className="client-select-button"
          >
            Add Expense for {client.name}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box className="client-selector-multiple">
      <Grid container spacing={2}>
        {clientList.map((client) => (
          <Grid item xs={12} key={client.id}>
            <Card 
              className={`client-card ${selected === client.id ? 'selected' : ''}`}
              onClick={() => onSelect(client.id)}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" flex={1}>
                    <BusinessIcon color="primary" sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="h6" component="div">
                        {client.name}
                      </Typography>
                      <Box display="flex" alignItems="center" mt={0.5}>
                        <Chip
                          label={client.role}
                          size="small"
                          color={client.role === 'admin' ? 'primary' : 'default'}
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  </Box>
                  <ChevronRightIcon color="action" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ClientSelector;
