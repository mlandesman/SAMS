import React, { createContext, useState, useContext, useEffect } from 'react';
import { useClient } from './ClientContext';
import { recordDuesPayment as apiRecordDuesPayment, updateCreditBalance as apiUpdateCreditBalance } from '../api/hoaDuesService';
import { useTransactionsContext } from './TransactionsContext';
import { config } from '../config';
import { databaseFieldMappings } from '../utils/databaseFieldMappings';
import { getFiscalYear } from '../utils/fiscalYearUtils';
import debug from '../utils/debug';

const HOADuesContext = createContext();

// Cache utility functions
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const getCacheKey = (clientId, year) => `hoa_dues_${clientId}_${year}`;
const getUnitsCacheKey = (clientId) => `hoa_units_${clientId}`;

const isCacheValid = (timestamp) => {
  return Date.now() - timestamp < CACHE_DURATION;
};

const getFromCache = (key) => {
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (isCacheValid(timestamp)) {
        debug.log('Cache hit for key:', key);
        return data;
      }
      debug.log('Cache expired for key:', key);
    }
  } catch (error) {
    debug.error('Cache read error:', error);
  }
  return null;
};

const saveToCache = (key, data) => {
  try {
    const cacheData = { data, timestamp: Date.now() };
    // DEBUG: Log what we're saving
    if (key.includes('dues')) {
      debug.log('Saving dues data to cache:', key);
      const firstUnit = Object.keys(data)[0];
      if (firstUnit && data[firstUnit]) {
        debug.log('Sample unit data being cached:', firstUnit, data[firstUnit]);
        debug.log('Sample payment:', data[firstUnit].payments?.[0]);
      }
    }
    sessionStorage.setItem(key, JSON.stringify(cacheData));
    debug.log('Saved to cache:', key);
  } catch (error) {
    debug.error('Cache write error:', error);
    // Handle quota exceeded error
    if (error.name === 'QuotaExceededError') {
      // Clear old HOA cache entries and retry
      clearOldHOACacheEntries();
      try {
        sessionStorage.setItem(key, JSON.stringify(cacheData));
        debug.log('Saved to cache after clearing old entries:', key);
      } catch (retryError) {
        debug.error('Cache write failed even after clearing:', retryError);
      }
    }
  }
};

const clearHOACache = (clientId) => {
  // Clear both dues and units cache for the client
  const duesPattern = `hoa_dues_${clientId}`;
  const unitsPattern = `hoa_units_${clientId}`;
  
  Object.keys(sessionStorage)
    .filter(key => key.includes(duesPattern) || key.includes(unitsPattern))
    .forEach(key => {
      sessionStorage.removeItem(key);
      debug.log('Cleared cache:', key);
    });
};

const clearOldHOACacheEntries = () => {
  const pattern = /^hoa_dues_/;
  Object.keys(sessionStorage)
    .filter(key => pattern.test(key))
    .forEach(key => {
      try {
        const cached = sessionStorage.getItem(key);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (!isCacheValid(timestamp)) {
            sessionStorage.removeItem(key);
            debug.log('Removed expired cache entry:', key);
          }
        }
      } catch (error) {
        // If we can't parse it, remove it
        sessionStorage.removeItem(key);
        debug.log('Removed invalid cache entry:', key);
      }
    });
};

export function HOADuesProvider({ children }) {
  const { selectedClient } = useClient();
  const { balanceUpdateTrigger } = useTransactionsContext();
  const [units, setUnits] = useState([]);
  const [duesData, setDuesData] = useState({});
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState(null);
  
  // Initialize selectedYear with null to detect if it needs to be set
  const [selectedYear, setSelectedYear] = useState(null);
  
  // Set the initial year when client is loaded
  useEffect(() => {
    if (selectedClient && selectedYear === null) {
      const fiscalYearStartMonth = selectedClient.configuration?.fiscalYearStartMonth || 1;
      const currentFiscalYear = getFiscalYear(new Date(), fiscalYearStartMonth);
      console.log('HOADuesContext - Setting initial year based on client');
      console.log('  Client:', selectedClient.id);
      console.log('  Fiscal Year Start Month:', fiscalYearStartMonth);
      console.log('  Calculated Fiscal Year:', currentFiscalYear);
      setSelectedYear(currentFiscalYear);
    }
  }, [selectedClient, selectedYear]);
  
  // DEBUG: Log current state
  console.log('HOADuesContext - Current State');
  console.log('  Selected Client:', selectedClient?.id || 'No client');
  console.log('  Selected Year:', selectedYear);

  // Update selected year when client changes
  useEffect(() => {
    console.log('HOADuesContext - Client changed effect running');
    console.log('HOADuesContext - Effect - Selected Client:', selectedClient);
    
    if (selectedClient) {
      const clientFiscalStartMonth = selectedClient.configuration?.fiscalYearStartMonth || 1;
      const newFiscalYear = getFiscalYear(new Date(), clientFiscalStartMonth);
      console.log('HOADuesContext - Effect - Client Fiscal Start Month:', clientFiscalStartMonth);
      console.log('HOADuesContext - Effect - New Fiscal Year:', newFiscalYear);
      setSelectedYear(newFiscalYear);
    }
  }, [selectedClient]);

  // Fetch all units for the selected client
  useEffect(() => {
    if (!selectedClient || selectedYear === null) {
      console.log('HOADuesContext - Skipping units fetch:', { 
        hasClient: !!selectedClient, 
        selectedYear 
      });
      if (!selectedClient) {
        setLoading(false);
      }
      return;
    }
    
    const fetchUnits = async () => {
      // Check cache for units first
      const unitsCacheKey = getUnitsCacheKey(selectedClient.id);
      const cachedUnits = getFromCache(unitsCacheKey);
      
      if (cachedUnits) {
        debug.log(`Using cached units for client ${selectedClient.id}`);
        debug.log('Cached units structure:', cachedUnits);
        debug.log('First unit:', cachedUnits[0]);
        setUnits(cachedUnits);
        // Don't change loading state here - let fetchDuesData handle it
        // Fetch dues data with cached units
        await fetchDuesData(cachedUnits, selectedYear, false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Get auth token for API call
        const { getAuthInstance } = await import('../firebaseClient');
        const auth = getAuthInstance();
        const token = await auth.currentUser?.getIdToken();
        
        if (!token) {
          throw new Error('Failed to get authentication token');
        }
        
        // Use backend API to fetch units
        const API_BASE_URL = config.api.baseUrl;
        const response = await fetch(`${API_BASE_URL}/clients/${selectedClient.id}/units`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch units: ${response.status} ${response.statusText}`);
        }
        
        const unitsResponse = await response.json();
        debug.log('All units data:', unitsResponse);
        
        // Extract the data array from the response wrapper
        const unitsData = unitsResponse.data || unitsResponse;
        debug.log('Units structure - first unit:', unitsData[0]);
        debug.log('Does first unit have unitId?', unitsData[0]?.unitId);
        debug.log('Does first unit have id?', unitsData[0]?.id);
        setUnits(unitsData);
        
        // Cache the units data
        saveToCache(unitsCacheKey, unitsData);
        
        // After fetching units, fetch dues data for each unit
        // Don't force refresh on initial load - let cache work
        fetchDuesData(unitsData, selectedYear, false);
      } catch (error) {
        console.error('Error fetching units:', error);
        setError('Failed to load units. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchUnits();
  }, [selectedClient, selectedYear]);
  
  // Listen for balance update triggers from transaction operations
  useEffect(() => {
    if (balanceUpdateTrigger === 0) return; // Skip the initial value
    if (!selectedClient || !units.length) return;
    
    debug.log('HOA Dues: Balance update trigger received, refreshing dues data');
    // Refresh dues data when balance updates are triggered
    fetchDuesData(units, selectedYear);
  }, [balanceUpdateTrigger, selectedClient, units, selectedYear]);
  
  // Fetch dues data for all units for the selected year using backend API
  const fetchDuesData = async (unitsList, year, forceRefresh = false) => {
    if (!selectedClient || !unitsList.length) return;
    
    // Check cache first unless force refresh is requested
    const cacheKey = getCacheKey(selectedClient.id, year);
    if (!forceRefresh) {
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        debug.log(`Using cached data for client ${selectedClient.id}, year ${year}`);
        
        // Process cached data the same way we process API data
        const processedDuesData = {};
        
        // First, process what we received from cache (same as API processing)
        Object.entries(cachedData).forEach(([unitId, unitData]) => {
          if (!unitData.creditBalanceHistory) {
            unitData.creditBalanceHistory = [];
          }
          processedDuesData[unitId] = unitData;
        });
        
        // Then, ensure every unit has data (even units without dues records)
        unitsList.forEach(unit => {
          if (!processedDuesData[unit.unitId]) {
            processedDuesData[unit.unitId] = {
              creditBalance: 0,
              scheduledAmount: unit.duesAmount || 0,
              payments: Array(12).fill().map((_, i) => ({
                month: i + 1,
                paid: 0,
                amount: 0,
                date: null,
                transactionId: null,
                notes: ''
              })),
              creditBalanceHistory: []
            };
          }
        });
        
        setDuesData(processedDuesData);
        // Small delay to ensure state updates are processed
        setTimeout(() => setLoading(false), 0);
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    
    let fetchSuccessful = false;
    
    try {
      debug.log(`Attempting to fetch dues data from backend API for year ${year}`);
      
      // Get authentication headers
      const { getCurrentUser, getAuthInstance } = await import('../firebaseClient');
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        console.warn('User not authenticated');
        return;
      }
      
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        console.warn('Failed to get authentication token');
        return;
      }
      
      // Use backend API to ensure consistency
      const API_BASE_URL = config.api.baseUrl;
      const response = await fetch(`${API_BASE_URL}/hoadues/${selectedClient.id}/year/${year}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .catch(e => {
        console.warn('Network error fetching from API, will try fallback', e);
        return { ok: false };
      });
      
      if (response.ok) {
        const duesDataObj = await response.json();
        debug.log('Successfully received dues data from API:', duesDataObj);
        debug.log('API Response type:', typeof duesDataObj);
        debug.log('API Response keys:', Object.keys(duesDataObj));
        debug.log('First unit data sample:', duesDataObj[Object.keys(duesDataObj)[0]]);
        
        // Process the data and set default values for any missing units
        const processedDuesData = {};
        
        // First, process what we received from API
        Object.entries(duesDataObj).forEach(([unitId, unitData]) => {
          // Ensure creditBalanceHistory exists
          if (!unitData.creditBalanceHistory) {
            unitData.creditBalanceHistory = [];
          }
          // DEBUG: Log what we're processing
          if (unitId === '1A') {
            debug.log('Processing unit 1A data:', unitData);
            debug.log('Unit 1A payments:', unitData.payments);
            debug.log('First payment:', unitData.payments?.[0]);
          }
          processedDuesData[unitId] = unitData;
        });
        
        // Then, ensure every unit has data (even units without dues records)
        unitsList.forEach(unit => {
          if (!processedDuesData[unit.unitId]) {
            // Initialize empty dues data for this unit and year
            processedDuesData[unit.unitId] = {
              creditBalance: 0,
              scheduledAmount: unit.duesAmount || 0,
              payments: Array(12).fill().map((_, i) => ({
                month: i + 1,
                paid: 0,
                amount: 0,  // MISSING: Need amount field!
                date: null,
                transactionId: null,
                notes: ''
              })),
              creditBalanceHistory: []
            };
          }
        });
        
        debug.structured('Final processed dues data', processedDuesData);
        setDuesData(processedDuesData);
        
        // Save RAW API response to cache (not processed data)
        saveToCache(cacheKey, duesDataObj);
        
        fetchSuccessful = true;
      } else {
        console.error(`API returned status ${response.status || 'unknown'}`);
        setError('Failed to load dues data. Please try refreshing the page.');
      }
    } catch (error) {
      console.error('Error fetching dues data from API:', error);
      setError('Failed to load dues data. Please try refreshing the page.');
    }
    
    setLoading(false);
  };

  // Function to clear cache and refresh data
  const clearCacheAndRefresh = async () => {
    if (selectedClient) {
      clearHOACache(selectedClient.id);
      await fetchDuesData(units, selectedYear, true);
    }
  };

  return (
    <HOADuesContext.Provider
      value={{
        units,
        duesData,
        loading,
        error,
        selectedYear,
        setSelectedYear,
        refreshData: () => fetchDuesData(units, selectedYear, true), // Force refresh to ensure latest data
        clearCacheAndRefresh
      }}
    >
      {children}
    </HOADuesContext.Provider>
  );
}

export function useHOADues() {
  const context = useContext(HOADuesContext);
  if (!context) {
    throw new Error('useHOADues must be used within a HOADuesProvider');
  }
  return context;
}
