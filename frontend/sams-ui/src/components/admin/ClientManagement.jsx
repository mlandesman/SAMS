/**
 * Client Management Component
 * SuperAdmin-only CRUD interface for managing clients
 * 
 * Phase 12: Client Management CRUD Prerequisites
 * Implementation Date: June 26, 2025
 */

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Alert, 
  Chip,
  Avatar
} from '@mui/material';
import { 
  Business as BusinessIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { createClientApi, getClientsApi, updateClientApi, deleteClientApi } from '../../api/clientManagement';
import ClientFormModal from '../modals/ClientFormModal';
import { LoadingSpinner } from '../common';
import { MEXICO_TIMEZONE } from '../../utils/timezone';
import './ClientManagement.css';

const ClientManagement = ({ 
  onSelectionChange, 
  onItemCountChange,
  onViewDetail,
  refreshTrigger,
  searchTerm = ''
}) => {
  const { samsUser } = useAuth();
  
  // State management
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  

  // Check SuperAdmin access
  const isSuperAdmin = samsUser?.email === 'michael@landesman.com' || samsUser?.globalRole === 'superAdmin';

  // Load clients on component mount and refresh trigger
  useEffect(() => {
    if (isSuperAdmin) {
      loadClients();
    }
  }, [isSuperAdmin, refreshTrigger]);

  // Handle selection change callback
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedClient);
    }
  }, [selectedClient, onSelectionChange]);

  // Filter clients based on search term
  const filteredClients = clients.filter(client => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const fullName = client.summary?.fullName?.toLowerCase() || '';
    const displayName = client.summary?.displayName?.toLowerCase() || '';
    const clientType = client.summary?.clientType?.toLowerCase() || '';
    
    return fullName.includes(searchLower) || 
           displayName.includes(searchLower) || 
           clientType.includes(searchLower);
  });

  // Handle item count change callback  
  useEffect(() => {
    if (onItemCountChange) {
      onItemCountChange(filteredClients.length);
    }
  }, [filteredClients.length, onItemCountChange]);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getClientsApi();
      if (response.success) {
        setClients(response.data || []);
      } else {
        throw new Error(response.error || 'Failed to load clients');
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
      setError(err.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (clientData) => {
    try {
      setError(null);
      setSuccess(null);
      
      const response = await createClientApi(clientData);
      if (response.success) {
        setSuccess('Client created successfully');
        loadClients(); // Refresh the list
        return response;
      } else {
        throw new Error(response.error || 'Failed to create client');
      }
    } catch (err) {
      console.error('Failed to create client:', err);
      setError(err.message || 'Failed to create client');
      throw err;
    }
  };

  const handleRowClick = (client) => {
    setSelectedClient(client);
  };

  const handleRowDoubleClick = (client) => {
    // Set selection first
    setSelectedClient(client);
    if (onSelectionChange) {
      onSelectionChange(client);
    }
    // Then trigger View Details modal
    if (onViewDetail) {
      onViewDetail();
    }
  };

  const handleUpdateClient = async (clientId, updates) => {
    try {
      setError(null);
      setSuccess(null);
      
      const response = await updateClientApi(clientId, updates);
      if (response.success) {
        setSuccess('Client updated successfully');
        setSelectedClient(null);
        loadClients(); // Refresh the list
        return response;
      } else {
        throw new Error(response.error || 'Failed to update client');
      }
    } catch (err) {
      console.error('Failed to update client:', err);
      setError(err.message || 'Failed to update client');
      throw err;
    }
  };

  const handleDeleteClient = async (clientId) => {
    try {
      setError(null);
      
      const response = await deleteClientApi(clientId);
      // This will return a 501 "Feature Coming Soon" response
      if (response.featureStatus === 'PLANNED') {
        setError(response.message || 'Feature Coming Soon: Client deletion is not yet implemented');
      } else {
        throw new Error(response.error || 'Unexpected response');
      }
    } catch (err) {
      console.error('Delete attempt:', err);
      setError(err.message || 'Client deletion is not yet available');
    }
  };

  // Format date for display using Mexico timezone
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      let date;
      
      // Handle Firestore timestamp objects from API
      if (timestamp && typeof timestamp === 'object') {
        // Handle Firebase Timestamp with _seconds/_nanoseconds (from API response)
        if (timestamp._seconds !== undefined) {
          date = new Date(timestamp._seconds * 1000);
        }
        // Handle Firestore timestamp objects with toDate method
        else if (typeof timestamp.toDate === 'function') {
          date = timestamp.toDate();
        }
        // Handle timestamp objects with seconds property
        else if (timestamp.seconds !== undefined) {
          date = new Date(timestamp.seconds * 1000);
        }
        // Handle other object types that might have nanoseconds
        else {
          date = new Date(timestamp);
        }
      }
      // Handle ISO string or milliseconds
      else {
        date = new Date(timestamp);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date value:', timestamp);
        return 'Invalid Date';
      }
      
      // Format using Mexico timezone (America/Cancun)
      return date.toLocaleDateString('en-US', {
        timeZone: MEXICO_TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'timestamp:', timestamp);
      return 'Invalid Date';
    }
  };

  // Get status chip color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  // Clear messages after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Access control check
  if (!isSuperAdmin) {
    return (
      <Box className="client-management-access-denied">
        <Alert severity="error">
          <Typography variant="h6">Access Denied</Typography>
          <Typography>
            Client Management is only available to SuperAdmin users.
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return <LoadingSpinner variant="logo" message="Loading clients..." size="medium" />;
  }

  return (
    <Box className="client-management-container">
      {/* Status Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Clients Table */}
      <TableContainer component={Paper} className="client-management-table">
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Client</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Last Modified</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary">
                    {searchTerm ? 'No clients match your search' : 'No clients found'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow 
                  key={client.id} 
                  hover 
                  selected={selectedClient?.id === client.id}
                  onClick={() => handleRowClick(client)}
                  onDoubleClick={() => handleRowDoubleClick(client)}
                  style={{ cursor: 'pointer' }}
                  className={selectedClient?.id === client.id ? 'selected' : ''}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar 
                        src={client.summary?.iconUrl || client.summary?.logoUrl} 
                        sx={{ width: 40, height: 40, mr: 2 }}
                      >
                        <BusinessIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {client.summary?.fullName || 'Unnamed Client'}
                        </Typography>
                        {client.summary?.displayName && (
                          <Typography variant="body2" color="text.secondary">
                            {client.summary.displayName}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {client.summary?.clientType || 'Unknown'}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Chip 
                      label={client.summary?.status || 'unknown'} 
                      color={getStatusColor(client.summary?.status)}
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(client.summary?.createdAt)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(client.summary?.lastModified)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ClientManagement;
export { ClientFormModal };