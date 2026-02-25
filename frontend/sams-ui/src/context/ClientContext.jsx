import React, { createContext, useState, useContext, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { app, db } from '../firebaseClient';
import { useAuth } from './AuthContext';
import { clearFeatureCache } from '../utils/clientFeatures';

const ClientContext = createContext();

export const ClientProvider = ({ children }) => {
  // Use auth context safely - handle cases where auth might not be ready
  let samsUser = null;
  try {
    const authContext = useAuth();
    samsUser = authContext?.samsUser;
  } catch (error) {
    // Auth context not available yet - this is normal during initialization
    console.log('Auth context not ready yet in ClientProvider');
  }
  
  // Initialize with null - we'll validate stored client when user loads
  const [selectedClient, setSelectedClient] = useState(null);
  // For non-admin users: currently selected unit (persisted per client)
  const [selectedUnitId, setSelectedUnitIdState] = useState(null);
  // Owner name(s) for selected unit (from SoA, set when useUnitAccountStatus loads)
  const [unitOwnerNames, setUnitOwnerNamesState] = useState(null);

  // Add state for client menu configuration
  const [menuConfig, setMenuConfig] = useState([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);
  const [menuError, setMenuError] = useState(null);

  // Validate stored client when user loads or changes
  useEffect(() => {
    if (samsUser && !selectedClient) {
      // Try to load saved client from localStorage and validate access
      const savedClient = localStorage.getItem('selectedClient');
      try {
        const parsedClient = savedClient ? JSON.parse(savedClient) : null;
        if (parsedClient && validatePropertyAccess(parsedClient)) {
          console.log('✅ Restored valid saved client:', parsedClient.id);
          setSelectedClient(parsedClient);
        } else if (parsedClient) {
          console.warn('🚫 Removing invalid saved client - user no longer has access:', parsedClient.id);
          localStorage.removeItem('selectedClient');
        }
      } catch (error) {
        console.error('Error parsing saved client:', error);
        localStorage.removeItem('selectedClient'); // Clear invalid data
      }
    } else if (!samsUser && selectedClient) {
      // Clear client when user logs out
      console.log('🧹 Clearing client - user logged out');
      setSelectedClient(null);
    }
  }, [samsUser]); // Only depend on samsUser changes

  // When client changes, restore selectedUnitId from localStorage for this client
  useEffect(() => {
    if (!selectedClient?.id) {
      setSelectedUnitIdState(null);
      setUnitOwnerNamesState(null);
      return;
    }
    const key = `sams_selectedUnit_${selectedClient.id}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setSelectedUnitIdState(stored);
      } else {
        setSelectedUnitIdState(null);
      }
    } catch (e) {
      setSelectedUnitIdState(null);
    }
  }, [selectedClient?.id]);

  // Log when client changes and update document title
  useEffect(() => {
    console.log('🔄 ClientContext: Client changed to:', selectedClient);
    
    // Clear feature cache when client changes
    clearFeatureCache();
    
    // Update document title with client name
    if (selectedClient) {
      const clientName = selectedClient.basicInfo?.fullName || selectedClient.name || selectedClient.id;
      document.title = `${clientName} - SAMS`;
      
      // Save to localStorage for persistence
      localStorage.setItem('selectedClient', JSON.stringify(selectedClient));
      
      // Fetch the client's menu configuration
      fetchClientMenuConfig(selectedClient.id);
    } else {
      // Reset to default title when no client selected
      document.title = 'SAMS - Sandyland Asset Management';
      
      // Clear menu when no client is selected
      setMenuConfig([]);
    }
  }, [selectedClient]);

  // Function to fetch menu configuration from Firestore
  const fetchClientMenuConfig = async (clientId) => {
    if (!clientId) return;
    
    setIsLoadingMenu(true);
    setMenuError(null);
    
    try {
      console.log(`Fetching menu configuration for client: ${clientId}`);
      const menuRef = doc(db, `clients/${clientId}/config/activities`);
      const menuSnapshot = await getDoc(menuRef);
      
      if (menuSnapshot.exists()) {
        const menuData = menuSnapshot.data();
        if (menuData.menu && Array.isArray(menuData.menu)) {
          console.log('Menu configuration loaded:', menuData.menu);
          setMenuConfig(menuData.menu);
        } else {
          console.warn('Menu configuration is empty or invalid');
          setMenuConfig([]);
        }
      } else {
        console.warn('No menu configuration found for this client');
        setMenuConfig([]);
      }
    } catch (error) {
      console.error('Error fetching menu configuration:', error);
      setMenuError(error.message);
      setMenuConfig([]);
    } finally {
      setIsLoadingMenu(false);
    }
  };

  // Validate property access before setting
  const validatePropertyAccess = (client) => {
    if (!client) return false;
    if (!samsUser) return false; // No user loaded yet - validation will happen later
    
    // SuperAdmin can access all clients
    if (samsUser.email === 'michael@landesman.com' || samsUser.globalRole === 'superAdmin') {
      return true;
    }
    
    // Check if user has access to this client
    return samsUser.propertyAccess && samsUser.propertyAccess[client.id];
  };

  const setClient = (client) => {
    console.log('🔄 ClientContext: Setting client to:', client);
    
    // If no user loaded yet, allow setting client (validation will happen when user loads)
    if (!samsUser) {
      console.log('🔄 No user loaded yet - allowing client set, will validate later');
      setSelectedClient(client);
      return true;
    }
    
    // Validate property access when user is available
    if (client && !validatePropertyAccess(client)) {
      console.error('🚫 Access denied: User does not have access to client:', client.id);
      console.warn('User property access:', samsUser?.propertyAccess ? Object.keys(samsUser.propertyAccess) : 'None');
      return false; // Reject the client change
    }
    
    setSelectedClient(client);
    return true; // Success
  };

  const setSelectedUnitId = (unitId) => {
    setSelectedUnitIdState(unitId);
    setUnitOwnerNamesState(null); // Clear until SoA loads for new unit
    if (selectedClient?.id) {
      const key = `sams_selectedUnit_${selectedClient.id}`;
      if (unitId) {
        localStorage.setItem(key, unitId);
      } else {
        localStorage.removeItem(key);
      }
    }
  };

  const setUnitOwnerNames = (names) => {
    setUnitOwnerNamesState(names);
  };

  return (
    <ClientContext.Provider value={{ 
      selectedClient, 
      setClient, 
      selectedUnitId,
      setSelectedUnitId,
      unitOwnerNames,
      setUnitOwnerNames,
      validatePropertyAccess,
      menuConfig, 
      isLoadingMenu, 
      menuError,
      refreshMenuConfig: () => selectedClient && fetchClientMenuConfig(selectedClient.id)
    }}>
      {children}
    </ClientContext.Provider>
  );
};

// Custom hook for using the client context
export function useClient() {
  return useContext(ClientContext);
};