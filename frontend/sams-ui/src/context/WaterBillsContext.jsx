import React, { createContext, useState, useContext, useEffect } from 'react';
import { useClient } from './ClientContext';
import debug from '../utils/debug';
import * as waterMeterService from '../api/waterMeterService';
import { getFiscalYear } from '../utils/fiscalYearUtils';

console.log('📁 [WaterBillsContext] Module loaded');

const WaterBillsContext = createContext();

// Cache utility functions - EXACT COPY from HOA Pattern
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const getCacheKey = (clientId, year) => `water_bills_${clientId}_${year}`;

const isCacheValid = (timestamp) => {
  return Date.now() - timestamp < CACHE_DURATION;
};

const getFromCache = (key) => {
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (isCacheValid(timestamp)) {
        debug.log('Water cache hit for key:', key);
        return data;
      }
      debug.log('Water cache expired for key:', key);
    }
  } catch (error) {
    debug.error('Water cache read error:', error);
  }
  return null;
};

const saveToCache = (key, data) => {
  try {
    const cacheData = { data, timestamp: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(cacheData));
    debug.log('Saved water data to cache:', key);
  } catch (error) {
    debug.error('Water cache write error:', error);
    // Handle quota exceeded error
    if (error.name === 'QuotaExceededError') {
      clearOldWaterCacheEntries();
      try {
        sessionStorage.setItem(key, JSON.stringify(cacheData));
        debug.log('Saved to cache after clearing old entries:', key);
      } catch (retryError) {
        debug.error('Cache write failed even after clearing:', retryError);
      }
    }
  }
};

const clearWaterCache = (clientId) => {
  // Clear all water cache entries for the client
  const pattern = `water_bills_${clientId}`;
  
  Object.keys(sessionStorage)
    .filter(key => key.includes(pattern))
    .forEach(key => {
      sessionStorage.removeItem(key);
      debug.log('Cleared water cache:', key);
    });
};

const clearOldWaterCacheEntries = () => {
  const pattern = /^water_bills_/;
  Object.keys(sessionStorage)
    .filter(key => pattern.test(key))
    .forEach(key => {
      try {
        const cached = sessionStorage.getItem(key);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (!isCacheValid(timestamp)) {
            sessionStorage.removeItem(key);
            debug.log('Removed expired water cache entry:', key);
          }
        }
      } catch (error) {
        // If we can't parse it, remove it
        sessionStorage.removeItem(key);
        debug.log('Removed invalid water cache entry:', key);
      }
    });
};

export function WaterBillsProvider({ children }) {
  const { selectedClient } = useClient();
  const [waterData, setWaterData] = useState({});
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log('🌊 [WaterBillsContext] Component rendered:', {
    hasClient: !!selectedClient,
    clientId: selectedClient?.id,
    selectedYear,
    loading,
    hasError: !!error
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

  // Fetch water data with caching - EXACT PATTERN from HOA
  const fetchWaterData = async (year, forceRefresh = false) => {
    console.log('💧 [WaterBillsContext] fetchWaterData called:', {
      hasClient: !!selectedClient,
      clientId: selectedClient?.id,
      year,
      forceRefresh
    });
    
    if (!selectedClient || !year) {
      console.log('⚠️ [WaterBillsContext] Skipping fetch - missing requirements:', {
        hasClient: !!selectedClient,
        year
      });
      debug.log('WaterBillsContext - Skipping fetch, missing client or year');
      return;
    }

    const cacheKey = getCacheKey(selectedClient.id, year);
    console.log('🔑 [WaterBillsContext] Cache key:', cacheKey);
    
    // Check cache first unless force refresh
    if (!forceRefresh) {
      console.log('🔍 [WaterBillsContext] Checking cache...');
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        console.log('✅ [WaterBillsContext] Cache HIT! Using cached data:', {
          cacheKey,
          dataKeys: Object.keys(cachedData),
          unitCount: Object.keys(cachedData).length
        });
        debug.log('WaterBillsContext - Using cached data for year:', year);
        setWaterData(cachedData);
        setLoading(false);
        return;
      } else {
        console.log('❌ [WaterBillsContext] Cache MISS - will fetch from API');
      }
    } else {
      console.log('🔄 [WaterBillsContext] Force refresh - skipping cache');
    }

    // Fetch from API
    console.log('🌐 [WaterBillsContext] Starting API fetch...');
    setLoading(true);
    setError(null);
    
    try {
      debug.log('WaterBillsContext - Fetching water data from API for year:', year);
      const response = await waterMeterService.fetchAllWaterDataForYear(selectedClient.id, year);
      
      console.log('📦 [WaterBillsContext] API Response received:', {
        hasResponse: !!response,
        hasWaterData: !!response?.waterData,
        unitCount: response?.unitCount,
        year: response?.year
      });
      
      // Save to cache
      if (response?.waterData) {
        console.log('💾 [WaterBillsContext] Saving to cache:', cacheKey);
        saveToCache(cacheKey, response.waterData);
      }
      
      // Update state
      const dataToSet = response?.waterData || {};
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
      console.log('🏁 [WaterBillsContext] Fetch complete, setting loading to false');
      setLoading(false);
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
    clearWaterCache(selectedClient.id);
    await fetchWaterData(selectedYear, true); // Force refresh
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