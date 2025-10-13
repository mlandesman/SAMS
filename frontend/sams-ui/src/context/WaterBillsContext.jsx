import React, { createContext, useState, useContext, useEffect } from 'react';
import { useClient } from './ClientContext';
import debug from '../utils/debug';
import waterAPI from '../api/waterAPI';
import { getFiscalYear } from '../utils/fiscalYearUtils';

console.log('📁 [WaterBillsContext] Module loaded');

const WaterBillsContext = createContext();

// Cache is now handled by waterAPI.getAggregatedData() internally

export function WaterBillsProvider({ children }) {
  const { selectedClient } = useClient();
  const [waterData, setWaterData] = useState({});
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchInProgress, setFetchInProgress] = useState(false);

  console.log('🌊 [WaterBillsContext] Component rendered:', {
    hasClient: !!selectedClient,
    clientId: selectedClient?.id,
    selectedYear,
    loading,
    hasError: !!error,
    fetchInProgress
  });

  // Set initial year when client is loaded - EXACT PATTERN from HOA
  useEffect(() => {
    console.log('📅 [WaterBillsContext] Year effect triggered:', {
      hasClient: !!selectedClient,
      clientId: selectedClient?.id,
      currentYear: selectedYear
    });
    
    if (selectedClient && selectedYear === null) {
      const fiscalYearStartMonth = selectedClient.configuration?.fiscalYearStartMonth || 1;
      const currentFiscalYear = getFiscalYear(new Date(), fiscalYearStartMonth);
      
      console.log('📅 [WaterBillsContext] Setting initial year:', {
        client: selectedClient.id,
        fiscalYearStartMonth,
        calculatedYear: currentFiscalYear
      });
      
      debug.log('WaterBillsContext - Setting initial year based on client');
      debug.log('  Client:', selectedClient.id);
      debug.log('  Fiscal Year Start Month:', fiscalYearStartMonth);
      debug.log('  Calculated Fiscal Year:', currentFiscalYear);
      setSelectedYear(currentFiscalYear);
    }
  }, [selectedClient, selectedYear]);

  // Fetch water data using aggregated data API
  const fetchWaterData = async (year) => {
    console.log('💧 [WaterBillsContext] fetchWaterData called:', {
      hasClient: !!selectedClient,
      clientId: selectedClient?.id,
      year,
      fetchInProgress
    });
    
    if (!selectedClient || !year) {
      console.log('⚠️ [WaterBillsContext] Skipping fetch - missing requirements:', {
        hasClient: !!selectedClient,
        year
      });
      debug.log('WaterBillsContext - Skipping fetch, missing client or year');
      return;
    }

    // Prevent duplicate requests during same render cycle
    if (fetchInProgress) {
      console.log('⏸️ [WaterBillsContext] Fetch already in progress, skipping duplicate request');
      debug.log('WaterBillsContext - Deduplicating concurrent fetch request');
      return;
    }

    
    // Fetch from API using the same aggregated data endpoint as Dashboard (with built-in caching)
    console.log('🌐 [WaterBillsContext] Fetching aggregated data...');
    setFetchInProgress(true);
    setLoading(true);
    setError(null);
    
    try {
      debug.log('WaterBillsContext - Fetching water data from API for year:', year);
      const response = await waterAPI.getAggregatedData(selectedClient.id, year);
      
      console.log('📦 [WaterBillsContext] API Response received:', {
        hasResponse: !!response,
        hasData: !!response?.data,
        dataKeys: response?.data ? Object.keys(response.data) : 'none'
      });
      
      // The response.data contains the aggregated data (already cached by waterAPI)
      // Update state
      const dataToSet = response?.data || {};
      console.log('📊 [WaterBillsContext] Setting water data state:', {
        unitCount: Object.keys(dataToSet).length,
        units: Object.keys(dataToSet)
      });
      setWaterData(dataToSet);
      
      debug.log('WaterBillsContext - Loaded water data for client:', selectedClient.id, 'year:', year);
    } catch (error) {
      console.error('🚨 [WaterBillsContext] Error loading water data:', {
        message: error.message,
        status: error.status,
        stack: error.stack
      });
      debug.error('WaterBillsContext - Error loading water data:', error);
      // Don't set error state for 404s, just use empty data
      if (error.status !== 404) {
        setError('Failed to load water billing data');
      }
      setWaterData({});
    } finally {
      console.log('🏁 [WaterBillsContext] Fetch complete, clearing flags');
      setLoading(false);
      setFetchInProgress(false);
    }
  };

  // Fetch data when client or year changes
  useEffect(() => {
    console.log('🔄 [WaterBillsContext] Data fetch effect triggered:', {
      hasClient: !!selectedClient,
      clientId: selectedClient?.id,
      selectedYear
    });
    
    if (selectedClient && selectedYear) {
      console.log('🚀 [WaterBillsContext] Conditions met - calling fetchWaterData');
      fetchWaterData(selectedYear);
    } else {
      console.log('⏸️ [WaterBillsContext] Conditions not met - skipping fetch:', {
        hasClient: !!selectedClient,
        selectedYear
      });
    }
  }, [selectedClient, selectedYear]);

  // CRUD operations with cache invalidation
  const clearCacheAndRefresh = async () => {
    if (!selectedClient || !selectedYear) return;
    
    debug.log('WaterBillsContext - Clearing cache and refreshing data');
    // Clear the aggregated data cache
    const cacheKey = `water_bills_${selectedClient.id}_${selectedYear}`;
    try {
      sessionStorage.removeItem(cacheKey);
      debug.log('Cleared aggregated data cache:', cacheKey);
    } catch (error) {
      debug.error('Error clearing cache:', error);
    }
    // Clear the fetch-in-progress flag to allow fresh fetch
    setFetchInProgress(false);
    await fetchWaterData(selectedYear); // Fetch fresh data
  };

  const submitBatchReadings = async (readings, readingDate) => {
    try {
      debug.log('WaterBillsContext - Submitting batch readings:', readings.length);
      
      const response = await waterMeterService.submitBatchReadings(
        selectedClient.id,
        readings,
        readingDate
      );
      
      // CRITICAL: Clear cache and reload - SAMS Pattern
      await clearCacheAndRefresh();
      
      return response;
    } catch (error) {
      debug.error('WaterBillsContext - Error submitting readings:', error);
      throw error;
    }
  };
  
  const importReadingsFromCSV = async (file, readingDate) => {
    try {
      debug.log('WaterBillsContext - Importing readings from CSV');
      
      const response = await waterMeterService.importReadingsFromCSV(
        selectedClient.id,
        file,
        readingDate
      );
      
      // CRITICAL: Clear cache and reload - SAMS Pattern
      await clearCacheAndRefresh();
      
      return response;
    } catch (error) {
      debug.error('WaterBillsContext - Error importing CSV:', error);
      throw error;
    }
  };

  const generateBills = async (billingMonth, dueDate, options = {}) => {
    try {
      debug.log('WaterBillsContext - Generating water bills for:', billingMonth);
      
      const response = await waterMeterService.generateBills(
        selectedClient.id,
        billingMonth,
        dueDate,
        options
      );
      
      // CRITICAL: Clear cache and reload - SAMS Pattern
      await clearCacheAndRefresh();
      
      return response;
    } catch (error) {
      debug.error('WaterBillsContext - Error generating bills:', error);
      throw error;
    }
  };
  
  const recordPayment = async (billId, paymentData) => {
    try {
      debug.log('WaterBillsContext - Recording payment for bill:', billId);
      
      const response = await waterMeterService.recordPayment(
        selectedClient.id,
        billId,
        paymentData
      );
      
      // CRITICAL: Clear cache and reload - SAMS Pattern
      await clearCacheAndRefresh();
      
      return response;
    } catch (error) {
      debug.error('WaterBillsContext - Error recording payment:', error);
      throw error;
    }
  };

  // Computed values from cached data - for Dashboard integration
  const getSummaryData = () => {
    const units = Object.values(waterData);
    
    const totalOutstanding = units.reduce((sum, unit) => 
      sum + (unit.summary?.outstandingBalance || 0), 0
    );
    
    const totalBilled = units.reduce((sum, unit) => 
      sum + (unit.summary?.totalBilled || 0), 0
    );
    
    const totalPaid = units.reduce((sum, unit) => 
      sum + (unit.summary?.totalPaid || 0), 0
    );
    
    const unitsWithOutstanding = units.filter(unit => 
      unit.summary?.outstandingBalance > 0
    ).length;
    
    const totalReadings = units.reduce((sum, unit) => 
      sum + (unit.summary?.readingCount || 0), 0
    );
    
    const totalBills = units.reduce((sum, unit) => 
      sum + (unit.summary?.billCount || 0), 0
    );
    
    return {
      totalOutstanding,
      totalBilled,
      totalPaid,
      unitsWithOutstanding,
      totalReadings,
      totalBills,
      unitCount: units.length
    };
  };

  // Helper to get all bills from cached data
  const getAllBills = () => {
    const allBills = [];
    Object.values(waterData).forEach(unit => {
      if (unit.bills) {
        unit.bills.forEach(bill => {
          allBills.push({
            ...bill,
            unitId: unit.unitId,
            unitName: unit.unitName
          });
        });
      }
    });
    return allBills;
  };

  // Helper to get all readings from cached data
  const getAllReadings = () => {
    const allReadings = [];
    Object.values(waterData).forEach(unit => {
      if (unit.readings) {
        unit.readings.forEach(reading => {
          allReadings.push({
            ...reading,
            unitId: unit.unitId,
            unitName: unit.unitName
          });
        });
      }
    });
    return allReadings;
  };

  // Helper to get latest readings from cached data
  const getLatestReadings = () => {
    const latestReadings = {};
    Object.values(waterData).forEach(unit => {
      if (unit.latestReading) {
        latestReadings[unit.unitId] = {
          ...unit.latestReading,
          unitName: unit.unitName
        };
      }
    });
    return latestReadings;
  };

  return (
    <WaterBillsContext.Provider
      value={{
        // State
        waterData,
        selectedYear,
        loading,
        error,
        
        // Year management
        setSelectedYear,
        
        // Data fetching
        refreshData: clearCacheAndRefresh,
        
        // CRUD operations with cache invalidation
        submitBatchReadings,
        importReadingsFromCSV,
        generateBills,
        recordPayment,
        
        // Computed values from cache (for Dashboard)
        getSummaryData,
        getAllBills,
        getAllReadings,
        getLatestReadings,
        
        // Legacy compatibility (using cached data)
        waterBills: getAllBills(),
        meterReadings: getAllReadings(),
        latestReadings: getLatestReadings(),
        waterMeters: Object.values(waterData).map(unit => ({
          unitId: unit.unitId,
          unitName: unit.unitName,
          meterNumber: `WM-${unit.unitId}`,
          status: 'active'
        }))
      }}
    >
      {children}
    </WaterBillsContext.Provider>
  );
}

export function useWaterBills() {
  const context = useContext(WaterBillsContext);
  if (!context) {
    throw new Error('useWaterBills must be used within a WaterBillsProvider');
  }
  return context;
}