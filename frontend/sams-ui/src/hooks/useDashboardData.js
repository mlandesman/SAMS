import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useClient } from '../context/ClientContext';
import { useHOADues } from '../context/HOADuesContext';
import { useExchangeRates } from './useExchangeRates';
import { getClientAccountBalances } from '../utils/clientAccounts';
import { getOwnerInfo } from '../utils/unitUtils';
import { config } from '../config';
import debug from '../utils/debug';
import { getFiscalYear, getCurrentFiscalMonth } from '../utils/fiscalYearUtils';
import { hasWaterBills } from '../utils/clientFeatures';
import { getMexicoDate } from '../utils/timezone';

// Cache utility functions (same as HOADuesContext)
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
        console.log('Dashboard cache hit for key:', key);
        return data;
      }
      console.log('Dashboard cache expired for key:', key);
    }
  } catch (error) {
    console.error('Dashboard cache read error:', error);
  }
  return null;
};

const saveToCache = (key, data) => {
  try {
    const cacheData = { data, timestamp: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(cacheData));
    console.log('Dashboard saved to cache:', key);
  } catch (error) {
    console.error('Dashboard cache write error:', error);
  }
};

export const useDashboardData = () => {
  const { samsUser } = useAuth();
  const { selectedClient, menuConfig, isLoadingMenu } = useClient();
  const { exchangeRate, loading: exchangeLoading } = useExchangeRates();
  
  const [accountBalances, setAccountBalances] = useState({
    total: 0,
    bank: 0,
    cash: 0,
    accounts: []
  });
  
  const [hoaDuesStatus, setHoaDuesStatus] = useState({
    currentlyDue: 0,
    currentPaid: 0,
    futurePayments: 0,
    totalCollected: 0,
    collectionRate: 0,
    overdueCount: 0
  });
  
  const [waterBillsStatus, setWaterBillsStatus] = useState({
    totalUnpaid: 0,
    overdueCount: 0,
    pastDueDetails: [],
    totalBilled: 0,
    totalPaid: 0,
    collectionRate: 0
  });
  
  const [loading, setLoading] = useState({
    accounts: true,
    dues: true,
    water: true,
    rates: exchangeLoading
  });
  
  const [error, setError] = useState({
    accounts: null,
    dues: null,
    water: null,
    rates: null
  });

  // Fetch account balances using the real BalanceBar system
  useEffect(() => {
    const fetchAccountBalances = async () => {
      if (!selectedClient || !samsUser) {
        // Clear data when no client selected
        setAccountBalances({
          total: 0,
          bank: 0,
          cash: 0,
          accounts: []
        });
        return;
      }
      
      try {
        setLoading(prev => ({ ...prev, accounts: true }));
        setError(prev => ({ ...prev, accounts: null }));
        
        // Use the real account balance system from BalanceBar
        const accountsData = await getClientAccountBalances(selectedClient.id, false);
        
        // Calculate totals by account type
        const bankBalance = accountsData.bankBalance || 0;
        const cashBalance = accountsData.cashBalance || 0;
        const totalBalance = bankBalance + cashBalance;
        
        // Structure the data for the dashboard (convert cents to dollars)
        const balanceData = {
          total: Math.round(totalBalance / 100),
          bank: Math.round(bankBalance / 100),
          cash: Math.round(cashBalance / 100),
          accounts: accountsData.accounts || []
        };
        
        setAccountBalances(balanceData);
      } catch (err) {
        console.error('Error fetching account balances:', err);
        setError(prev => ({ ...prev, accounts: err.message }));
        
        // Fallback to zero balances on error
        setAccountBalances({
          total: 0,
          bank: 0,
          cash: 0,
          accounts: []
        });
      } finally {
        setLoading(prev => ({ ...prev, accounts: false }));
      }
    };

    fetchAccountBalances();
  }, [selectedClient, samsUser]);

  // Fetch HOA dues status
  useEffect(() => {
    const fetchHOADuesStatus = async () => {
      if (!selectedClient || !samsUser) {
        // Clear data when no client selected
        setHoaDuesStatus({
          currentlyDue: 0,
          currentPaid: 0,
          futurePayments: 0,
          totalCollected: 0,
          collectionRate: 0,
          overdueCount: 0
        });
        return;
      }
      
      try {
        setLoading(prev => ({ ...prev, dues: true }));
        setError(prev => ({ ...prev, dues: null }));
        
        // Get current fiscal year and month for calculations
        const currentDate = getMexicoDate();
        const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1;
        const currentYear = getFiscalYear(currentDate, fiscalYearStartMonth);
        const currentMonth = getCurrentFiscalMonth(currentDate, fiscalYearStartMonth);
        
        console.log('📊 Dashboard HOA Dues calculation:');
        console.log('  Fiscal Year Start Month:', fiscalYearStartMonth);
        console.log('  Current Fiscal Year:', currentYear);
        console.log('  Current Fiscal Month:', currentMonth);
        
        // Check cache for units first
        const unitsCacheKey = getUnitsCacheKey(selectedClient.id);
        const cachedUnits = getFromCache(unitsCacheKey);
        
        let units = [];
        
        if (cachedUnits) {
          debug.log(`Dashboard using cached units for client ${selectedClient.id}`);
          units = cachedUnits;
        } else {
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
          debug.log('Dashboard units API response:', unitsResponse);
          
          // Extract the data array from the response wrapper
          units = unitsResponse.data || unitsResponse;
          debug.log('Dashboard units structure - first unit:', units[0]);
          
          // Cache the units data
          saveToCache(unitsCacheKey, units);
        }
        
        if (units.length === 0) {
          throw new Error('No units found for this client');
        }
        
        // Check cache for dues data
        const duesCacheKey = getCacheKey(selectedClient.id, currentYear);
        const cachedDues = getFromCache(duesCacheKey);
        
        let duesDataFromAPI = null;
        let apiSuccess = false;
        
        if (cachedDues) {
          debug.log(`Dashboard using cached dues data for client ${selectedClient.id}, year ${currentYear}`);
          duesDataFromAPI = cachedDues;
          apiSuccess = true;
        } else {
          // Fetch dues data using the same API as HOADuesView
          try {
            // Get authentication token (same as HOADuesView)
            const { getCurrentUser, getAuthInstance } = await import('../firebaseClient');
            const currentUser = getCurrentUser();
            
            if (currentUser) {
              const auth = getAuthInstance();
              const token = await auth.currentUser?.getIdToken();
              
              if (token) {
                // Use same API endpoint as HOADuesView
                const API_BASE_URL = config.api.baseUrl;
                const response = await fetch(`${API_BASE_URL}/hoadues/${selectedClient.id}/year/${currentYear}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                });
                
                if (response.ok) {
                  duesDataFromAPI = await response.json();
                  apiSuccess = true;
                  console.log('📋 Successfully received dues data from API:', duesDataFromAPI);
                  
                  // Cache the dues data
                  saveToCache(duesCacheKey, duesDataFromAPI);
                } else {
                  console.log('⚠️ API response not ok:', response.status);
                  duesDataFromAPI = {};
                  apiSuccess = false;
                }
              }
            }
          } catch (error) {
            console.log('⚠️ Error fetching from API:', error);
            duesDataFromAPI = {};
            apiSuccess = false;
          }
        }
        
        if (!apiSuccess) {
          console.log('⚠️ Failed to get dues data from API, calculations will be 0');
        }
        
        // ============================================
        // DASHBOARD CALCULATIONS - TRUST BACKEND VALUES
        // All amounts come from backend, we only aggregate for dashboard display
        // ============================================
        
        const monthsElapsed = currentMonth;
        
        // Calculate summary metrics from backend dues data
        let totalCollected = 0;
        let totalDue = 0;
        let pastDueAmount = 0;
        let pastDueUnits = 0;
        const pastDueDetails = []; // Array for hover tooltip data
        
        // Dashboard-specific calculations - aggregate backend values for display
        // Calculate expected dues to date (months elapsed × backend scheduledAmount)
        let totalExpectedToDate = 0;
        let currentMonthDuesExpected = 0;
        
        if (duesDataFromAPI && Object.keys(duesDataFromAPI).length > 0) {
          // Filter out creditBalances storage document - it's not a real unit
          Object.entries(duesDataFromAPI)
            .filter(([unitId]) => unitId !== 'creditBalances')
            .forEach(([unitId, unitData]) => {
              const scheduledAmount = unitData?.scheduledAmount || 0; // From backend
              const unitTotalPaid = unitData?.totalPaid || 0; // From backend
              const duesFrequency = selectedClient?.configuration?.feeStructure?.duesFrequency || 'monthly';
              
              // Calculate totalDue based on billing frequency (backend returns 0)
              let unitTotalDue = 0;
              if (duesFrequency === 'quarterly') {
                // For quarterly: Calculate based on quarters that have passed
                for (let quarter = 0; quarter < 4; quarter++) {
                  const quarterFirstMonth = quarter * 3 + 1;
                  if (currentMonth >= quarterFirstMonth) {
                    // This quarter is due - count all 3 months
                    unitTotalDue += scheduledAmount * 3;
                  }
                }
              } else {
                // For monthly: Count each month through currentMonth
                unitTotalDue = scheduledAmount * monthsElapsed;
              }
              
              totalCollected += unitTotalPaid;
              totalDue += unitTotalDue;
              
              // Calculate past due for THIS unit by checking unpaid bills
              // For quarterly billing: If quarter is past due, count ALL 3 months
              let unitPastDue = 0;
              if (unitData?.payments && Array.isArray(unitData.payments)) {
                
                if (duesFrequency === 'quarterly') {
                  // Check quarters: If due date passed, count entire quarter
                  for (let quarter = 0; quarter < 4; quarter++) {
                    const quarterFirstMonth = quarter * 3 + 1; // Q1=1, Q2=4, Q3=7, Q4=10
                    
                    // Quarter is past due if we're past the first month of the quarter
                    if (currentMonth >= quarterFirstMonth) {
                      // Check all 3 months of this quarter
                      for (let i = 0; i < 3; i++) {
                        const monthIndex = quarter * 3 + i;
                        const payment = unitData.payments[monthIndex];
                        const paidAmount = payment?.amount || 0;
                        const shortfall = scheduledAmount - paidAmount;
                        if (shortfall > 0) {
                          unitPastDue += shortfall;
                        }
                      }
                    }
                  }
                } else {
                  // Monthly billing: Check each month individually (existing logic)
                  for (let m = 1; m <= currentMonth; m++) {
                    const monthIndex = m - 1;
                    const payment = unitData.payments[monthIndex];
                    const paidAmount = payment?.amount || 0;
                    const shortfall = scheduledAmount - paidAmount;
                    if (shortfall > 0) {
                      unitPastDue += shortfall;
                    }
                  }
                }
              }
              
              if (unitPastDue > 0) {
                pastDueAmount += unitPastDue;
                pastDueUnits += 1;
                
                // Get owner lastName from units array (same pattern as Water Bills)
                const unitWithOwner = units.find(u => u.unitId === unitId);
                const ownerLastName = unitWithOwner?.owners?.[0]?.split(' ').pop() || '';
                
                // Add to pastDueDetails array for hover tooltip (same pattern as Water Bills)
                pastDueDetails.push({
                  unitId: unitId,
                  owner: ownerLastName, // Last name for display
                  amountDue: Math.round(unitPastDue)
                });
              }
              
              // Calculate expected to date based on billing frequency
              if (duesFrequency === 'quarterly') {
                // For quarterly: Calculate based on complete quarters that have passed
                const currentQuarter = Math.floor((currentMonth - 1) / 3); // Q1=0, Q2=1, Q3=2, Q4=3
                const monthsInPastQuarters = currentQuarter * 3; // Quarters 0-current (not including current)
                
                // Add complete past quarters
                totalExpectedToDate += scheduledAmount * monthsInPastQuarters;
                
                // Add current quarter if its due date has passed
                const currentQuarterFirstMonth = currentQuarter * 3 + 1;
                if (currentMonth >= currentQuarterFirstMonth) {
                  totalExpectedToDate += scheduledAmount * 3; // Full quarter expected
                }
                
                // Current quarter is expected (all 3 months)
                currentMonthDuesExpected += scheduledAmount * 3;
              } else {
                // Monthly: Each month counted individually (existing logic)
                totalExpectedToDate += scheduledAmount * monthsElapsed;
                currentMonthDuesExpected += scheduledAmount;
              }
            });
        }
        
        // Calculate current month collected - sum backend payment amounts
        let currentMonthCollected = 0;
        if (duesDataFromAPI && Object.keys(duesDataFromAPI).length > 0) {
          Object.entries(duesDataFromAPI)
            .filter(([unitId]) => unitId !== 'creditBalances')
            .forEach(([unitId, unitData]) => {
              if (unitData?.payments && Array.isArray(unitData.payments)) {
                const currentMonthIndex = currentMonth - 1; // Convert to 0-based index
                const currentMonthPayment = unitData.payments[currentMonthIndex];
                if (currentMonthPayment?.paid && currentMonthPayment?.amount) {
                  currentMonthCollected += currentMonthPayment.amount; // From backend
                }
              }
            });
        }
        
        // Calculate pre-paid amounts - sum backend credit + future payment values
        let prePaidAmount = 0;
        let totalCreditBalances = 0;
        if (duesDataFromAPI && Object.keys(duesDataFromAPI).length > 0) {
          Object.entries(duesDataFromAPI)
            .filter(([unitId]) => unitId !== 'creditBalances')
            .forEach(([unitId, unitData]) => {
              // Sum backend credit balances
              const creditBalance = unitData?.creditBalance || 0; // From backend
              if (creditBalance > 0) {
                totalCreditBalances += creditBalance;
              }
              
              // Sum backend future payment amounts
              if (unitData?.payments && Array.isArray(unitData.payments)) {
                for (let fiscalMonth = currentMonth + 1; fiscalMonth <= 12; fiscalMonth++) {
                  const monthIndex = fiscalMonth - 1;
                  if (monthIndex < unitData.payments.length) {
                    const payment = unitData.payments[monthIndex];
                    const paymentAmount = payment?.amount || 0; // Amount is already in pesos
                    if (paymentAmount > 0) {
                      prePaidAmount += paymentAmount;
                    }
                  }
                }
              }
            });
        }
        prePaidAmount += totalCreditBalances;
        
        // Calculate currently due (total expected to date through current month)
        const currentlyDue = totalExpectedToDate || 0;
        const currentPaid = totalCollected || 0;
        
        // Collection rate based on what's been collected vs what's due
        const collectionRate = currentlyDue > 0 ? (currentPaid / currentlyDue) * 100 : 0;
        
        console.log('🏠 HOA Dues Dashboard (using backend data):');
        console.log('  Total Collected:', totalCollected);
        console.log('  Total Due:', totalDue);
        console.log('  Currently Due (to date):', currentlyDue);
        console.log('  Past Due Amount:', pastDueAmount);
        console.log('  Past Due Units:', pastDueUnits);
        console.log('  Current Month Collected:', currentMonthCollected);
        console.log('  Pre-paid Amount:', prePaidAmount);
        console.log('  Collection Rate:', collectionRate.toFixed(1) + '%');
        
        setHoaDuesStatus({
          currentlyDue: Math.round(currentlyDue) || 0,
          currentPaid: Math.round(currentPaid) || 0,
          futurePayments: Math.round(prePaidAmount) || 0,
          totalCollected: Math.round(currentPaid) || 0,
          collectionRate: Math.min(100, Math.max(0, collectionRate)) || 0,
          overdueCount: pastDueUnits || 0,
          pastDueAmount: Math.round(pastDueAmount) || 0,
          pastDueDetails: pastDueDetails || [],
          monthsElapsed: monthsElapsed || 0,
          unitsCount: units.length || 0
        });
        
      } catch (err) {
        console.error('Error fetching HOA dues status:', err);
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
        setError(prev => ({ ...prev, dues: err.message || 'Unknown error' }));
        
        // Fallback to zero data on error
        setHoaDuesStatus({
          currentlyDue: 0,
          currentPaid: 0,
          futurePayments: 0,
          totalCollected: 0,
          collectionRate: 0,
          overdueCount: 0
        });
      } finally {
        setLoading(prev => ({ ...prev, dues: false }));
      }
    };

    fetchHOADuesStatus();
  }, [selectedClient, samsUser]);

  // Fetch Water Bills Past Due data (using WaterBillsContext pattern)
  useEffect(() => {
    const fetchWaterBillsStatus = async () => {
      if (!selectedClient || !samsUser) {
        // Clear data when no client selected
        setWaterBillsStatus({
          totalUnpaid: 0,
          overdueCount: 0,
          pastDueDetails: [],
          totalBilled: 0,
          totalPaid: 0,
          collectionRate: 0
        });
        return;
      }
      
      // Wait for menu config to load before checking water bills
      if (isLoadingMenu) {
        console.log('💧 Dashboard: Menu still loading, waiting...');
        return;
      }
      
      // Check if this client has water bills enabled using centralized utility
      const clientHasWaterBills = hasWaterBills(selectedClient, menuConfig);
      
      if (!clientHasWaterBills) {
        console.log('💧 Dashboard: Client does not have water bills enabled, skipping');
        setWaterBillsStatus({
          totalUnpaid: 0,
          overdueCount: 0,
          pastDueDetails: [],
          totalBilled: 0,
          totalPaid: 0,
          collectionRate: 0
        });
        setLoading(prev => ({ ...prev, water: false }));
        return;
      }
      
      console.log('💧 Dashboard: Client has water bills enabled, making lightweight API call');
      
      try {
        setLoading(prev => ({ ...prev, water: true }));
        setError(prev => ({ ...prev, water: null }));
        
        // Get current fiscal year for water bills
        const currentDate = getMexicoDate();
        const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1;
        const currentYear = getFiscalYear(currentDate, fiscalYearStartMonth);
        
        console.log('💧 Dashboard Water Bills calculation:');
        console.log('  Client:', selectedClient.id);
        console.log('  Fiscal Year:', currentYear);
        console.log('  Has Water Bills:', clientHasWaterBills);
        
        // Use the new preview API to get real-time water bills summary
        const waterAPI = (await import('../api/waterAPI')).default;
        let previewResponse = null;
        
        try {
          // Get water bills data (all 12 months)
          previewResponse = await waterAPI.getBillsForYear(selectedClient.id, currentYear);
          console.log('💧 Dashboard: Water bills response received:', {
            hasResponse: !!previewResponse,
            hasData: !!previewResponse?.data,
            hasSummary: !!previewResponse?.data?.summary,
            summaryKeys: previewResponse?.data?.summary ? Object.keys(previewResponse.data.summary) : 'none'
          });
        } catch (previewError) {
          console.log('💧 Dashboard: Water aggregated data API error:', previewError.message);
          if (previewError.status === 404) {
            console.log('💧 Dashboard: No water data found for this client/year (normal)');
            previewResponse = null;
          } else {
            throw previewError;
          }
        }
        
        // Extract summary data from the new preview API response
        let totalUnpaid = 0;
        let overdueCount = 0;
        let pastDueDetails = [];
        let totalBilled = 0;
        let totalPaid = 0;
        let collectionRate = 0;
        
        if (previewResponse && previewResponse.data && previewResponse.data.summary) {
          const summary = previewResponse.data.summary;
          
          console.log('💧 Dashboard: Using summary from aggregated data API:');
          console.log('  Summary data:', summary);
          
          // Use calculated values from aggregated data API
          totalUnpaid = summary.totalUnpaid || 0;
          totalBilled = summary.totalBilled || 0;
          totalPaid = summary.totalPaid || 0;
          collectionRate = summary.collectionRate || 0;
          overdueCount = summary.overdueDetails?.length || 0;
          pastDueDetails = summary.overdueDetails || [];
          
          console.log('💧 Dashboard: Water Bills Summary (from aggregated data):');
          console.log(`  - Total Unpaid: $${totalUnpaid.toLocaleString()}`);
          console.log(`  - Total Billed: $${totalBilled.toLocaleString()}`);
          console.log(`  - Total Paid: $${totalPaid.toLocaleString()}`);
          console.log(`  - Collection Rate: ${collectionRate}%`);
          console.log(`  - Overdue Units: ${overdueCount}`);
          console.log(`  - Overdue Details:`, pastDueDetails);
        } else {
          console.log('💧 Dashboard: No summary data found in aggregated data response');
        }
        
        console.log('💧 Dashboard: Final water bills status being set:', {
          totalUnpaid: Math.round(totalUnpaid),
          overdueCount,
          totalBilled: Math.round(totalBilled),
          totalPaid: Math.round(totalPaid),
          collectionRate: Math.round(collectionRate * 100) / 100
        });
        
        setWaterBillsStatus({
          totalUnpaid: Math.round(totalUnpaid),
          overdueCount: overdueCount,
          pastDueDetails: pastDueDetails,
          totalBilled: Math.round(totalBilled),
          totalPaid: Math.round(totalPaid),
          collectionRate: Math.min(100, Math.max(0, collectionRate))
        });
        
      } catch (error) {
        console.error('💧 Dashboard: Error fetching water bills status:', {
          message: error.message,
          stack: error.stack
        });
        setError(prev => ({ ...prev, water: error.message }));
        
        // Fallback to zero data on error
        setWaterBillsStatus({
          totalUnpaid: 0,
          overdueCount: 0,
          pastDueDetails: [],
          totalBilled: 0,
          totalPaid: 0,
          collectionRate: 0
        });
      } finally {
        setLoading(prev => ({ ...prev, water: false }));
      }
    };

    fetchWaterBillsStatus();
  }, [selectedClient, samsUser, isLoadingMenu, menuConfig]);

  // Update exchange rates loading state
  useEffect(() => {
    setLoading(prev => ({ ...prev, rates: exchangeLoading }));
  }, [exchangeLoading]);

  // Clear caches when client changes (but not on initial load)
  const [previousClientId, setPreviousClientId] = useState(null);
  useEffect(() => {
    if (selectedClient && previousClientId && selectedClient.id !== previousClientId) {
      console.log(`🧹 [useDashboardData] Client changed from ${previousClientId} to ${selectedClient.id} - clearing caches`);
      
      // Clear all cache entries for the previous client
      const currentYear = new Date().getFullYear() + 1; // AVII uses FY 2026 for 2025 calendar year
      
      try {
        // Clear all possible cache keys for the previous client
        const keysToRemove = [
          getCacheKey(previousClientId, currentYear),
          getCacheKey(previousClientId, currentYear - 1),
          getUnitsCacheKey(previousClientId),
          `water_bills_${previousClientId}_${currentYear}`,
          `water_bills_${previousClientId}_${currentYear - 1}`
        ];
        
        console.log(`🧹 [useDashboardData] Clearing cache keys:`, keysToRemove);
        
        keysToRemove.forEach(key => {
          sessionStorage.removeItem(key);
          console.log(`🧹 [useDashboardData] Removed cache key: ${key}`);
        });
        
        console.log(`✅ [useDashboardData] Cleared caches for previous client ${previousClientId}`);
      } catch (error) {
        console.error('Error clearing dashboard caches:', error);
      }
    }
    
    if (selectedClient) {
      setPreviousClientId(selectedClient.id);
    }
  }, [selectedClient?.id, previousClientId]);

  const exchangeRates = {
    usdToMxn: exchangeRate?.USD_to_MXN || 0,
    mxnToUsd: exchangeRate?.USD_to_MXN ? (1 / exchangeRate.USD_to_MXN) : 0,
    lastUpdated: exchangeRate?.date ? new Date(exchangeRate.date).toLocaleDateString() : 'Never',
    source: exchangeRate?.source || 'Unknown'
  };

  return {
    accountBalances,
    hoaDuesStatus,
    waterBillsStatus,
    exchangeRates,
    loading,
    error,
    refresh: {
      accounts: () => fetchAccountBalances(),
      dues: () => fetchHOADuesStatus(),
      water: () => fetchWaterBillsStatus()
    }
  };
};