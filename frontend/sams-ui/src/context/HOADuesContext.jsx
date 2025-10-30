import React, { createContext, useState, useContext, useEffect } from 'react';
import { useClient } from './ClientContext';
import debug from '../utils/debug';
import hoaDuesAPI from '../api/hoaDuesAPI';
import { getFiscalYear } from '../utils/fiscalYearUtils';
import { getMexicoDate } from '../utils/timezone';

console.log('📁 [HOADuesContext] Module loaded');

const HOADuesContext = createContext();

// ⚠️ NO CACHING - ALL REQUESTS FETCH FRESH FROM FIRESTORE
// - No fetchInProgress deduplication
// - Cache-busting timestamp on every API call
// - No localStorage/sessionStorage
// - React state only holds current view data

export function HOADuesProvider({ children }) {
  const { selectedClient } = useClient();
  const [duesData, setDuesData] = useState({});
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log('💰 [HOADuesContext] Component rendered:', {
    hasClient: !!selectedClient,
    clientId: selectedClient?.id,
    selectedYear,
    loading,
    hasError: !!error
  });

  // Set initial year when client is loaded - EXACT PATTERN from Water Bills
  useEffect(() => {
    console.log('📅 [HOADuesContext] Year effect triggered:', {
      hasClient: !!selectedClient,
      clientId: selectedClient?.id,
      currentYear: selectedYear
    });
    
    if (selectedClient && selectedYear === null) {
      const fiscalYearStartMonth = selectedClient.configuration?.fiscalYearStartMonth || 1;
      const currentFiscalYear = getFiscalYear(getMexicoDate(), fiscalYearStartMonth);
      
      console.log('📅 [HOADuesContext] Setting initial year:', {
        client: selectedClient.id,
        fiscalYearStartMonth,
        calculatedYear: currentFiscalYear
      });
      
      debug.log('HOADuesContext - Setting initial year based on client');
      debug.log('  Client:', selectedClient.id);
      debug.log('  Fiscal Year Start Month:', fiscalYearStartMonth);
      debug.log('  Calculated Fiscal Year:', currentFiscalYear);
      setSelectedYear(currentFiscalYear);
    }
  }, [selectedClient, selectedYear]);

  // Fetch HOA dues data directly from backend
  // NO CACHING - fetches fresh from Firestore every time
  const fetchDuesData = async (year) => {
    console.log('💰 [HOADuesContext] fetchDuesData called:', {
      hasClient: !!selectedClient,
      clientId: selectedClient?.id,
      year
    });
    
    if (!selectedClient || !year) {
      console.log('⚠️ [HOADuesContext] Skipping fetch - missing requirements:', {
        hasClient: !!selectedClient,
        year
      });
      debug.log('HOADuesContext - Skipping fetch, missing client or year');
      return;
    }

    // NO DEDUPLICATION - always fetch fresh data
    // Cache-busting in hoaDuesAPI ensures we never get stale data
    
    // Fetch from API - gets all units' dues data for the year
    console.log('🌐 [HOADuesContext] Fetching dues for year...');
    setLoading(true);
    setError(null);
    
    try {
      debug.log('HOADuesContext - Fetching HOA dues from API for year:', year);
      const response = await hoaDuesAPI.getDuesForYear(selectedClient.id, year);
      
      console.log('📦 [HOADuesContext] API Response received:', {
        hasResponse: !!response,
        unitCount: response ? Object.keys(response).length : 0,
        units: response ? Object.keys(response) : 'none'
      });
      
      // The response contains all units' dues data (direct from Firestore)
      // Update state
      const dataToSet = response || {};
      console.log('📊 [HOADuesContext] Setting dues data state:', {
        unitCount: Object.keys(dataToSet).length,
        units: Object.keys(dataToSet)
      });
      setDuesData(dataToSet);
      
      debug.log('HOADuesContext - Loaded dues data for client:', selectedClient.id, 'year:', year);
    } catch (error) {
      console.error('🚨 [HOADuesContext] Error loading dues data:', {
        message: error.message,
        status: error.status,
        stack: error.stack
      });
      debug.error('HOADuesContext - Error loading dues data:', error);
      // Don't set error state for 404s, just use empty data
      if (error.status !== 404) {
        setError('Failed to load HOA dues data');
      }
      setDuesData({});
    } finally {
      console.log('🏁 [HOADuesContext] Fetch complete');
      setLoading(false);
    }
  };

  // Fetch data when client or year changes
  useEffect(() => {
    console.log('🔄 [HOADuesContext] Data fetch effect triggered:', {
      hasClient: !!selectedClient,
      clientId: selectedClient?.id,
      selectedYear
    });
    
    if (selectedClient && selectedYear) {
      console.log('🚀 [HOADuesContext] Conditions met - calling fetchDuesData');
      fetchDuesData(selectedYear);
    } else {
      console.log('⏸️ [HOADuesContext] Conditions not met - skipping fetch:', {
        hasClient: !!selectedClient,
        selectedYear
      });
    }
  }, [selectedClient, selectedYear]);

  // CRUD operations - refresh data after changes (no cache to clear)
  const refreshAfterPayment = async () => {
    if (!selectedClient || !selectedYear) return;
    
    debug.log('HOADuesContext - Refreshing data after payment');
    
    // Add small delay to allow Firestore to propagate changes
    // This prevents race condition where we fetch before write completes
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // NO CACHE - always fetch fresh with cache-busting timestamp
    await fetchDuesData(selectedYear);
  };

  // Helper to get all units from current state (no cache)
  // Filter out creditBalances storage document
  const getAllUnits = () => {
    return Object.keys(duesData)
      .filter(unitId => unitId !== 'creditBalances')
      .map(unitId => ({
        unitId,
        ...duesData[unitId]
      }));
  };

  // Helper to get unit data from current state (no cache)
  const getUnitData = (unitId) => {
    return duesData[unitId] || null;
  };

  // Computed summary data from current state
  // Filter out creditBalances storage document
  const getSummaryData = () => {
    const units = Object.entries(duesData)
      .filter(([unitId]) => unitId !== 'creditBalances')
      .map(([, unit]) => unit);
    
    const totalDue = units.reduce((sum, unit) => 
      sum + (unit.totalDue || 0), 0
    );
    
    const totalPaid = units.reduce((sum, unit) => 
      sum + (unit.totalPaid || 0), 0
    );
    
    const totalOutstanding = totalDue - totalPaid;
    
    const unitsWithOutstanding = units.filter(unit => 
      (unit.totalDue || 0) > (unit.totalPaid || 0)
    ).length;
    
    return {
      totalDue,
      totalPaid,
      totalOutstanding,
      unitsWithOutstanding,
      unitCount: units.length
    };
  };

  // Provide units array for compatibility with HOADuesView
  // This is derived from duesData keys - units are those with dues data
  const units = getAllUnits();

  return (
    <HOADuesContext.Provider
      value={{
        // State
        duesData,
        selectedYear,
        loading,
        error,
        units,  // Derived from duesData for compatibility
        
        // Year management
        setSelectedYear,
        
        // Data fetching
        fetchDuesData,
        refreshAfterPayment,
        
        // Helper functions from current state (no cache)
        getAllUnits,
        getUnitData,
        getSummaryData,
        
        // Legacy compatibility
        refreshData: refreshAfterPayment
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
