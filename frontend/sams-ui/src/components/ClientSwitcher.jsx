import React, { useState, useEffect } from 'react';
import {
  Chip,
  Avatar,
  Menu,
  MenuItem,
  CircularProgress,
  Box,
} from '@mui/material';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { fetchClients } from '../utils/fetchClients';

const ClientSwitcher = () => {
  const { selectedClient, setSelectedClient } = useClient();
  const { samsUser } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [availableClients, setAvailableClients] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch available clients when component mounts
  useEffect(() => {
    const loadClients = async () => {
      if (!samsUser) return;
      
      setLoading(true);
      try {
        const clients = await fetchClients(samsUser);
        setAvailableClients(clients);
      } catch (error) {
        console.error('Error fetching clients:', error);
      } finally {
        setLoading(false);
      }
    };

    loadClients();
  }, [samsUser]);

  // Don't render if no client is selected or only one client available
  if (!selectedClient || availableClients.length <= 1) {
    return null;
  }

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleClientChange = (client) => {
    setSelectedClient(client);
    handleClose();
  };

  // Get client display name and initials
  const getClientName = () => {
    console.log('[ClientSwitcher] getClientName - selectedClient:', selectedClient);
    if (!selectedClient) {
      console.log('[ClientSwitcher] No selectedClient, returning null');
      return null;
    }
    const name = selectedClient.basicInfo?.fullName || selectedClient.name || selectedClient.id;
    console.log('[ClientSwitcher] Resolved client name:', name);
    return name;
  };

  const getClientInitials = () => {
    const name = getClientName();
    console.log('[ClientSwitcher] getClientInitials - name:', name, 'type:', typeof name);
    if (!name || typeof name !== 'string') {
      console.log('[ClientSwitcher] Invalid name, returning NA');
      return 'NA';
    }
    try {
      const trimmed = name.trim();
      const words = trimmed.split(' ').filter(word => word.length > 0);
      console.log('[ClientSwitcher] Processing:', { original: name, trimmed, words });
      const initials = words
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'NA';
      console.log('[ClientSwitcher] Generated initials:', initials);
      return initials;
    } catch (error) {
      console.error('[ClientSwitcher] Error in getClientInitials:', error);
      return 'NA';
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Chip
        label={getClientName()}
        onClick={handleClick}
        avatar={<Avatar sx={{ bgcolor: '#7c3aed' }}>{getClientInitials()}</Avatar>}
        variant="outlined"
        sx={{
          borderColor: '#7c3aed',
          color: '#7c3aed',
          '&:hover': {
            bgcolor: 'rgba(124, 58, 237, 0.08)',
            borderColor: '#7c3aed',
          },
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}
        className="client-switcher-chip"
      />
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 200,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }
        }}
      >
        {loading ? (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          availableClients.map(client => {
            console.log('[ClientSwitcher] Mapping client:', client);
            const clientName = client.basicInfo?.fullName || client.name || client.id;
            console.log('[ClientSwitcher] Client name resolved to:', clientName);
            
            let clientInitials = 'NA';
            try {
              if (clientName && typeof clientName === 'string') {
                const trimmed = clientName.trim();
                const words = trimmed.split(' ').filter(word => word.length > 0);
                console.log('[ClientSwitcher] Name processing:', { clientName, trimmed, words });
                if (words.length > 0) {
                  clientInitials = words
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'NA';
                }
              }
            } catch (error) {
              console.error('[ClientSwitcher] Error processing client:', error, 'client:', client);
              clientInitials = 'NA';
            }
            console.log('[ClientSwitcher] Final initials:', clientInitials);
            const isSelected = client.id === selectedClient.id;

            return (
              <MenuItem
                key={client.id}
                onClick={() => handleClientChange(client)}
                selected={isSelected}
                sx={{
                  py: 1.5,
                  px: 2,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(124, 58, 237, 0.08)',
                  },
                  '&:hover': {
                    bgcolor: 'rgba(124, 58, 237, 0.04)',
                  },
                }}
              >
                <Avatar 
                  sx={{ 
                    bgcolor: isSelected ? '#7c3aed' : '#e0e0e0',
                    color: isSelected ? 'white' : '#666',
                    width: 32,
                    height: 32,
                    fontSize: '0.875rem',
                    mr: 1.5,
                  }}
                >
                  {clientInitials}
                </Avatar>
                {clientName}
              </MenuItem>
            );
          })
        )}
      </Menu>
    </>
  );
};

export default ClientSwitcher;