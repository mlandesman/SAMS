import { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import { useAuth } from './useAuth';

export const useClients = () => {
  const { samsUser, currentClient, selectClient: authSelectClient } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { clients: clientsData } = await userAPI.getClients();
      setClients(clientsData);
      
      console.log(`Loaded ${clientsData.length} accessible clients`);
    } catch (error) {
      console.error('Error fetching clients:', error);
      let errorMessage = 'Failed to load clients. Please try again.';
      
      if (error.message.includes('Network error')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message.includes('403')) {
        errorMessage = 'You do not have access to any clients.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (samsUser) {
      fetchClients();
    }
  }, [samsUser]);

  const selectClient = async (clientId) => {
    try {
      await authSelectClient(clientId);
      console.log('Selected client:', clientId);
    } catch (error) {
      console.error('Error selecting client:', error);
      setError('Failed to select client');
    }
  };

  const getSelectedClient = () => {
    return clients.find(client => client.id === currentClient);
  };

  const clearSelection = () => {
    // This would need to be implemented in the auth context
    console.warn('clearSelection not implemented');
  };

  const retry = () => {
    fetchClients();
  };

  return {
    clients,
    loading,
    error,
    selectedClientId: currentClient,
    selectedClient: getSelectedClient(),
    selectClient,
    clearSelection,
    retry,
    hasClients: clients.length > 0,
    isSingleClient: clients.length === 1,
  };
};
