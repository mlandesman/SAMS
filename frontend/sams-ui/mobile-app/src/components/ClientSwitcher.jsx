import React, { useState } from 'react';
import {
  Box,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  ListItemAvatar,
  ListItemText
} from '@mui/material';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useClients } from '../hooks/useClients.jsx';

const ClientSwitcher = ({ currentClient, onClientChange }) => {
  const { samsUser } = useAuth();
  const { clients, selectedClient } = useClients();
  const [anchorEl, setAnchorEl] = useState(null);
  
  // Use fetched clients data if available, otherwise fall back to clientAccess
  const availableClients = clients.length > 0 ? clients.map(client => ({
    id: client.id,
    name: client.basicInfo?.fullName || client.fullName || client.name || client.id,
    initials: (client.basicInfo?.fullName || client.fullName || client.name || client.id).substring(0, 2).toUpperCase()
  })) : [];
  
  // If no clients fetched yet, use clientAccess as fallback
  if (availableClients.length === 0 && samsUser?.clientAccess) {
    Object.entries(samsUser.clientAccess).forEach(([clientId, access]) => {
      if (access.role) {
        availableClients.push({
          id: clientId,
          name: access.name || clientId,
          initials: (access.name || clientId).substring(0, 2).toUpperCase()
        });
      }
    });
  }
  
  // Find current client object - prefer selectedClient from hook
  const currentClientObj = selectedClient ? {
    id: selectedClient.id,
    name: selectedClient.basicInfo?.fullName || selectedClient.fullName || selectedClient.name || selectedClient.id,
    initials: (selectedClient.basicInfo?.fullName || selectedClient.fullName || selectedClient.name || selectedClient.id).substring(0, 2).toUpperCase()
  } : availableClients.find(
    client => client.id === currentClient
  ) || {
    id: currentClient,
    name: currentClient || 'Select Client',
    initials: (currentClient || 'SC').substring(0, 2).toUpperCase()
  };
  
  const handleClick = (event) => {
    if (availableClients.length > 1) {
      setAnchorEl(event.currentTarget);
    }
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const handleClientSelect = (client) => {
    if (onClientChange) {
      onClientChange(client.id);
    }
    handleClose();
  };
  
  return (
    <Box display="flex" justifyContent="center" mb={2}>
      <Chip
        label={currentClientObj.name}
        onClick={handleClick}
        avatar={<Avatar sx={{ bgcolor: '#1976d2' }}>{currentClientObj.initials}</Avatar>}
        variant="outlined"
        sx={{
          maxWidth: '250px',
          fontSize: '0.875rem',
          cursor: availableClients.length > 1 ? 'pointer' : 'default',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          '&:hover': availableClients.length > 1 ? {
            backgroundColor: 'rgba(255, 255, 255, 1)',
          } : {}
        }}
      />
      
      {availableClients.length > 1 && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          PaperProps={{
            sx: { 
              maxWidth: '300px',
              mt: 1
            }
          }}
        >
          {availableClients.map(client => (
            <MenuItem
              key={client.id}
              onClick={() => handleClientSelect(client)}
              selected={client.id === currentClientObj.id}
              sx={{
                py: 1.5,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                }
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: '#1976d2', width: 32, height: 32 }}>
                  {client.initials}
                </Avatar>
              </ListItemAvatar>
              <ListItemText 
                primary={client.name}
                primaryTypographyProps={{ fontSize: '0.875rem' }}
              />
            </MenuItem>
          ))}
        </Menu>
      )}
    </Box>
  );
};

export default ClientSwitcher;