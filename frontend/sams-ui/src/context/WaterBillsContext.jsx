import React, { createContext, useState, useContext, useEffect } from 'react';
import { useClient } from './ClientContext';
import debug from '../utils/debug';
import waterAPI from '../api/waterAPI';
import { getFiscalYear } from '../utils/fiscalYearUtils';

console.log('📁 [WaterBillsContext] Module loaded');

const WaterBillsContext = createContext();

// ⚠️ NO CACHING - ALL REQUESTS FETCH FRESH FROM FIRESTORE
// - No fetchInProgress deduplication
// - Cache-busting timestamp on every API call
// - No localStorage/sessionStorage
// - React state only holds current view data

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

  // Fetch water data directly from bill documents
  // NO CACHING - fetches fresh from Firestore every time
  const fetchWaterData = async (year) => {
    console.log('💧 [WaterBillsContext] fetchWaterData called:', {
      hasClient: !!selectedClient,
      clientId: selectedClient?.id,
      year
    });
    
    if (!selectedClient || !year) {
      console.log('⚠️ [WaterBillsContext] Skipping fetch - missing requirements:', {
        hasClient: !!selectedClient,
        year
      });
      debug.log('WaterBillsContext - Skipping fetch, missing client or year');
      return;
    }

    // NO DEDUPLICATION - always fetch fresh data
    // Cache-busting in waterAPI ensures we never get stale data
    
    setLoading(true);
    setError(null);
    
    try {
      // First, check billing config to determine if this is monthly or quarterly
      console.log('🔍 [WaterBillsContext] Checking billing config...');
      const configResponse = await waterAPI.getConfig(selectedClient.id);
      const billingPeriod = configResponse?.data?.billingPeriod || 'monthly';
      console.log(`📋 [WaterBillsContext] Billing period: ${billingPeriod}`);
      
      // Always fetch monthly year data for readings and carryover calculations
      // This is needed even for quarterly billing because readings are monthly
      console.log('🌐 [WaterBillsContext] Fetching MONTHLY year data for readings...');
      debug.log('WaterBillsContext - Fetching monthly water data from API for year:', year);
      
      let response;
      if (billingPeriod === 'quarterly') {
        // Fetch BOTH monthly data (for readings) AND quarterly bills (for billing display)
        console.log('🌐 [WaterBillsContext] Also fetching QUARTERLY bills for billing display...');
        const [monthlyResponse, quarterlyResponse] = await Promise.all([
          waterAPI.getBillsForYear(selectedClient.id, year),
          waterAPI.getQuarterlyBills(selectedClient.id, year)
        ]);
        
        console.log('📦 [WaterBillsContext] Monthly data received:', {
          hasResponse: !!monthlyResponse,
          hasData: !!monthlyResponse?.data,
          dataKeys: monthlyResponse?.data ? Object.keys(monthlyResponse.data) : 'none'
        });
        
        console.log('📦 [WaterBillsContext] Quarterly bills received:', {
          hasResponse: !!quarterlyResponse,
          hasData: !!quarterlyResponse?.data,
          dataLength: Array.isArray(quarterlyResponse?.data) ? quarterlyResponse.data.length : 'not array'
        });
        
        // Combine both data sources
        const monthlyData = monthlyResponse?.data || {};
        const quarterlyBills = quarterlyResponse?.data || [];
        
        // Store monthly data structure with quarterly bills attached
        const dataToSet = {
          ...monthlyData,
          quarters: quarterlyBills,
          billingPeriod: 'quarterly'
        };
        
        console.log('📊 [WaterBillsContext] Setting combined data state:', {
          monthCount: monthlyData.months?.length || 0,
          quarterCount: quarterlyBills.length
        });
        setWaterData(dataToSet);
      } else {
        // Fetch monthly bills (original behavior)
        console.log('🌐 [WaterBillsContext] Fetching MONTHLY bills for year...');
        debug.log('WaterBillsContext - Fetching monthly water bills from API for year:', year);
        response = await waterAPI.getBillsForYear(selectedClient.id, year);
        
        console.log('📦 [WaterBillsContext] Monthly API Response received:', {
          hasResponse: !!response,
          hasData: !!response?.data,
          dataKeys: response?.data ? Object.keys(response.data) : 'none'
        });
        
        // The response.data contains all 12 months of bills (direct from Firestore)
        const dataToSet = response?.data || {};
        console.log('📊 [WaterBillsContext] Setting monthly water data state:', {
          unitCount: Object.keys(dataToSet).length,
          units: Object.keys(dataToSet)
        });
        setWaterData(dataToSet);
      }
      
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
      console.log('🏁 [WaterBillsContext] Fetch complete');
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

  // CRUD operations - refresh data after changes (no cache to clear)
  const refreshAfterChange = async () => {
    if (!selectedClient || !selectedYear) return;
    
    debug.log('WaterBillsContext - Refreshing data after change');
    
    // Add small delay to allow Firestore to propagate changes
    // This prevents race condition where we fetch before write completes
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // NO CACHE - always fetch fresh with cache-busting timestamp
    await fetchWaterData(selectedYear);
  };

  const submitBatchReadings = async (readings, readingDate) => {
    try {
      debug.log('WaterBillsContext - Submitting batch readings:', readings.length);
      
      const response = await waterMeterService.submitBatchReadings(
        selectedClient.id,
        readings,
        readingDate
      );
      
      // Refresh data after change (no cache to clear)
      await refreshAfterChange();
      
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
      
      // Refresh data after change (no cache to clear)
      await refreshAfterChange();
      
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
      
      // Refresh data after change (no cache to clear)
      await refreshAfterChange();
      
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
      
      // Refresh data after change (no cache to clear)
      await refreshAfterChange();
      
      return response;
    } catch (error) {
      debug.error('WaterBillsContext - Error recording payment:', error);
      throw error;
    }
  };

  // Computed values from current state - for Dashboard integration
  // Note: waterData state refreshes on every fetch (no caching)
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

  // Helper to get all bills from current state (no cache)
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

  // Helper to get all readings from current state (no cache)
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

  // Helper to get latest readings from current state (no cache)
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
        refreshData: refreshAfterChange,
        
        // CRUD operations (always trigger fresh fetch)
        submitBatchReadings,
        importReadingsFromCSV,
        generateBills,
        recordPayment,
        
        // Computed values from current state (no cache)
        getSummaryData,
        getAllBills,
        getAllReadings,
        getLatestReadings,
        
        // Legacy compatibility (uses current state, no cache)
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