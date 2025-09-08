import React, { useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Button,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import { LoadingSpinner } from './common';
import {
  Business,
  ChevronRight,
  Refresh,
  AdminPanelSettings,
  Home,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useClients } from '../hooks/useClients.jsx';

const ClientSelect = () => {
  const navigate = useNavigate();
  const { samsUser, currentClient, hasMultipleClients, isAdmin } = useAuth();
  const { 
    clients, 
    loading, 
    error, 
    selectClient, 
    retry, 
    hasClients, 
    isSingleClient 
  } = useClients();

  // Auto-navigate if user only has access to one client
  useEffect(() => {
    if (isSingleClient && currentClient && !loading) {
      console.log('Auto-navigating to dashboard for single client');
      // Always go to dashboard/home screen when changing clients
      navigate('/');
    }
  }, [isSingleClient, currentClient, loading, navigate]);

  const handleClientSelect = async (clientId) => {
    try {
      await selectClient(clientId);
      // Always navigate to dashboard/home screen after client selection
      navigate('/');
    } catch (error) {
      console.error('Failed to select client:', error);
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="calc(100vh - 64px)"
        p={2}
      >
        <LoadingSpinner size="large" message="Loading your clients..." />
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          Please wait...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={retry}
              startIcon={<Refresh />}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
        
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Business sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Unable to Load Clients
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please check your connection and try again.
            </Typography>
            <Button
              variant="contained"
              onClick={retry}
              startIcon={<Refresh />}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!hasClients) {
    return (
      <Box p={2}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Business sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Clients Available
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              You don't have access to any clients. Please contact your administrator.
            </Typography>
            <Button
              variant="outlined"
              onClick={retry}
              startIcon={<Refresh />}
            >
              Check Again
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Box p={2}>
        <Typography variant="h6" gutterBottom>
          Select a Client
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Choose which client to add an expense for:
        </Typography>
        
        {/* User Role Info */}
        {samsUser && (
          <Box display="flex" gap={1} mb={2}>
            <Chip
              icon={isAdmin ? <AdminPanelSettings /> : <Home />}
              label={isAdmin ? 'Administrator' : 'User'}
              color={isAdmin ? 'primary' : 'default'}
              size="small"
            />
            <Chip
              label={`${clients.length} client${clients.length > 1 ? 's' : ''}`}
              variant="outlined"
              size="small"
            />
          </Box>
        )}
      </Box>

      <Card sx={{ mx: 2 }}>
        <List sx={{ p: 0 }}>
          {clients.map((client, index) => (
            <React.Fragment key={client.id}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleClientSelect(client.id)}
                  sx={{
                    py: 2,
                    px: 3,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                    '&:active': {
                      backgroundColor: 'action.selected',
                    },
                  }}
                  className={`client-item ${currentClient === client.id ? 'selected' : ''}`}
                >
                <ListItemIcon>
                  <Business color="primary" />
                </ListItemIcon>
                
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h6" component="div">
                        {client.name}
                      </Typography>
                      {currentClient === client.id && (
                        <Chip label="Current" color="primary" size="small" />
                      )}
                    </Box>
                  }
                  secondary={
                    <span>
                      {client.description && (
                        <Typography variant="body2" color="text.secondary" component="span" display="block">
                          {client.description}
                        </Typography>
                      )}
                      <Box component="span" display="flex" gap={1} mt={0.5}>
                        <Chip
                          label={client.role}
                          size="small"
                          color={client.role === 'admin' ? 'primary' : 'default'}
                          variant="outlined"
                        />
                        {client.unitId && (
                          <Chip
                            label={`Unit ${client.unitId}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </span>
                  }
                />
                
                <ChevronRight color="action" />
              </ListItemButton>
              </ListItem>
              
              {index < clients.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </Card>

      {hasMultipleClients && (
        <Box p={2}>
          <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
            Your selection will be remembered for faster access next time.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ClientSelect;
