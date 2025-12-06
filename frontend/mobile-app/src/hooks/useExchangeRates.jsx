import { useState, useEffect } from 'react';
import { useAuth } from './useAuthStable.jsx';
import { config } from '../config/index.js';
import { auth } from '../services/firebase.js';

export const useExchangeRates = () => {
  const { currentClient } = useAuth();
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRates = async () => {
      // Handle both string clientId and object with id property
      const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
      
      if (!clientId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Get authentication token
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          throw new Error('Not authenticated');
        }
        
        // Use correct endpoint path (matches desktop)
        const response = await fetch(`${config.api.baseUrl}/system/exchange-rates/check`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch exchange rates: HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Exchange rates response:', data);
        
        // Extract rates from the nested structure
        if (data.exists && data.data && data.data.rates) {
          setRates(data.data.rates);
        } else {
          setRates(null);
          throw new Error('Invalid exchange rates data structure');
        }
      } catch (err) {
        console.error('Error fetching exchange rates:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, [currentClient]);

  return { rates, loading, error };
};