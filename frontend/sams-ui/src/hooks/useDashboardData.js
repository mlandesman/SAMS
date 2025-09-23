import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useClient } from '../context/ClientContext';
import { useExchangeRates } from './useExchangeRates';
import { getClientAccountBalances } from '../utils/clientAccounts';
import { getOwnerInfo } from '../utils/unitUtils';
import { config } from '../config';
import debug from '../utils/debug';
import { getFiscalYear, getCurrentFiscalMonth } from '../utils/fiscalYearUtils';
import { hasWaterBills } from '../utils/clientFeatures';

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
        const currentDate = new Date();
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
        
        // Calculate dues using individual unit amounts from API data
        const monthsElapsed = currentMonth; // How many months of the year have passed
        let annualDuesTotal = 0;
        let currentMonthDuesExpected = 0;
        let totalExpectedToDate = 0;
        
        if (apiSuccess && Object.keys(duesDataFromAPI).length > 0) {
          console.log('📋 Processing individual unit scheduled amounts:');
          
          for (const unit of units) {
            const unitDues = duesDataFromAPI[unit.unitId];
            const unitScheduledAmount = unitDues?.scheduledAmount || 0;
            
            console.log(`  Unit ${unit.unitId}: $${unitScheduledAmount}/month`);
            
            // Add to totals
            annualDuesTotal += unitScheduledAmount * 12;
            currentMonthDuesExpected += unitScheduledAmount;
            totalExpectedToDate += unitScheduledAmount * monthsElapsed;
          }
          
          console.log(`📊 Total monthly expected: $${currentMonthDuesExpected.toLocaleString()}`);
          console.log(`📊 Annual dues total: $${annualDuesTotal.toLocaleString()}`);
          console.log(`📊 Total expected to date (${monthsElapsed} months): $${totalExpectedToDate.toLocaleString()}`);
        } else {
          console.log('⚠️ No API data available for individual amounts');
        }
        
        // Process payment data from API (same logic as HOADuesView)
        let totalCollected = 0;
        let currentMonthCollected = 0;
        let pastDueUnits = 0;
        let pastDueAmount = 0;
        let pastDueDetails = []; // Array to store details of past due units
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        console.log('🔍 DEBUG: Starting payment calculations');
        console.log('🔍 DEBUG: duesDataFromAPI:', duesDataFromAPI);
        console.log('🔍 DEBUG: First unit dues data:', duesDataFromAPI[units[0]?.unitId]);
        
        if (apiSuccess) {
          for (const unit of units) {
            const unitDues = duesDataFromAPI[unit.unitId];
            const unitScheduledAmount = unitDues?.scheduledAmount || 0;
            const shouldHavePaidByNow = unitScheduledAmount * monthsElapsed;
            let unitPaidTotal = 0;
            
            console.log(`🔍 DEBUG: Processing unit ${unit.unitId}:`);
            console.log(`  - Unit data:`, unit);
            console.log(`  - scheduledAmount: ${unitScheduledAmount}`);
            console.log(`  - shouldHavePaidByNow (${monthsElapsed} months): ${shouldHavePaidByNow}`);
            console.log(`  - creditBalance: ${unitDues?.creditBalance || 0}`);
            
            // Initialize currentMonthAmount outside the if block
            let currentMonthAmount = 0;
            
            if (unitDues?.payments) {
              console.log(`  - payments array:`, unitDues.payments);
              
              // Sum payments up to current month only
              unitDues.payments.forEach((payment, idx) => {
                // CRITICAL: The payments array is ALREADY in fiscal year order!
                // For AVII: payments[0] = July, payments[1] = August, etc.
                // For MTC: payments[0] = January, payments[1] = February, etc.
                const fiscalMonth = idx + 1; // Convert to 1-based fiscal month
                
                console.log(`    - Fiscal Month ${fiscalMonth}: paid=${payment.paid}, amount=${payment.amount}`);
                
                // CRITICAL: The 'paid' field is a boolean, 'amount' is in dollars from API
                const paymentAmount = (payment.paid && payment.amount) ? payment.amount : 0;
                
                // Only count payments up to and including current fiscal month
                if (paymentAmount > 0 && fiscalMonth <= currentMonth) {
                  totalCollected += paymentAmount;
                  unitPaidTotal += paymentAmount;
                  console.log(`      Added $${paymentAmount} to current paid (fiscal month ${fiscalMonth})`);
                }
              });
              console.log(`  💳 Unit ${unit.unitId} payments total: $${unitPaidTotal} (${unitDues.payments.length} payment records)`);
              
              // Get credit balance and add to unit's total paid
              const unitCreditBalance = unitDues?.creditBalance || 0;
              unitPaidTotal += unitCreditBalance;
              console.log(`  💰 Unit ${unit.unitId} credit balance: $${unitCreditBalance}, total with credit: $${unitPaidTotal}`);
              
              // Check current month payment for collection rate calculation
              // The payments array is already in fiscal year order
              const currentMonthIndex = currentMonth - 1; // Convert to 0-based index
              const currentMonthPayment = unitDues.payments[currentMonthIndex];
              currentMonthAmount = (currentMonthPayment?.paid && currentMonthPayment?.amount) ? currentMonthPayment.amount : 0;
              if (currentMonthAmount > 0) {
                currentMonthCollected += currentMonthAmount;
              }
              
              // Check if unit is past due (hasn't paid all that's owed to date including credits)
              const totalOwedForUnit = unitScheduledAmount * currentMonth;
              const totalPaidForUnit = unitPaidTotal; // Now includes credits
              if (totalPaidForUnit < totalOwedForUnit) {
                // Unit is past due on the 1st of the month
                pastDueUnits++;
                const totalPastDueForUnit = totalOwedForUnit - totalPaidForUnit;
                console.log(`  ⚠️ Unit ${unit.unitId} is past due by $${totalPastDueForUnit} total`);
                
                // Add to past due details
                const { lastName } = getOwnerInfo(unit);
                pastDueDetails.push({
                  unitId: unit.unitId,
                  owner: unit.owner || lastName || 'Unknown',
                  amountDue: totalPastDueForUnit,
                  totalOwed: totalOwedForUnit,
                  creditBalance: unitCreditBalance,
                  netDue: totalPastDueForUnit
                });
              }
            } else {
              // No payment data found for this unit - past due on the 1st
              pastDueUnits++;
              const totalPastDueForUnit = unitScheduledAmount * currentMonth;
              
              // Add to past due details (full amount due for all months)
              const { lastName } = getOwnerInfo(unit);
              const unitCreditBalance = unitDues?.creditBalance || 0;
              pastDueDetails.push({
                unitId: unit.unitId,
                owner: unit.owner || lastName || 'Unknown',
                amountDue: totalPastDueForUnit - unitCreditBalance,
                totalOwed: totalPastDueForUnit,
                creditBalance: unitCreditBalance,
                netDue: totalPastDueForUnit - unitCreditBalance
              });
            }
            
            console.log(`  - Total paid by unit (including credit): $${unitPaidTotal}`);
            
            // For past due calculation, count total unpaid amount from start of fiscal year
            // Units are past due on the 1st of the month
            const totalOwedToDate = unitScheduledAmount * currentMonth; // What they should have paid by now
            const totalPaidToDate = unitPaidTotal; // What they actually paid
            if (totalPaidToDate < totalOwedToDate) {
              const totalPastDue = totalOwedToDate - totalPaidToDate;
              pastDueAmount += totalPastDue;
              console.log(`  - Unit owes $${totalPastDue} total (should have paid $${totalOwedToDate}, paid $${totalPaidToDate})`);
            }
          }
          
          console.log('🔍 DEBUG: Final totals:');
          console.log(`  - totalCollected: $${totalCollected}`);
          console.log(`  - currentMonthCollected: $${currentMonthCollected}`);
          console.log(`  - pastDueUnits: ${pastDueUnits}`);
          console.log(`  - pastDueAmount: $${pastDueAmount}`);
        } else {
          console.log('⚠️ No API data available, skipping payment calculations');
        }
        
        // Calculate Expected Dues for Months Elapsed using individual unit amounts
        // Use the totalExpectedToDate calculated above from individual unit amounts
        const expectedDuesToDate = totalExpectedToDate;
        
        // Calculate payment breakdown - match HOA Dues view logic
        const currentlyDue = totalExpectedToDate; // Total due through current month
        const currentPaid = totalCollected; // Total actually collected (including credits)
        
        // For pre-paid amounts, include future payments AND credit balances
        let prePaidAmount = 0;
        let totalCreditBalances = 0;
        
        if (apiSuccess) {
          for (const unit of units) {
            const unitDues = duesDataFromAPI[unit.unitId];
            
            // Add credit balance to pre-paid total
            if (unitDues?.creditBalance > 0) {
              totalCreditBalances += unitDues.creditBalance;
            }
            
            // Check payments for future months (after current fiscal month)
            if (unitDues?.payments) {
              // The payments array is already in fiscal year order
              for (let fiscalMonth = currentMonth + 1; fiscalMonth <= 12; fiscalMonth++) {
                const monthIndex = fiscalMonth - 1; // Convert to 0-based index
                
                if (monthIndex < unitDues.payments.length) {
                  const payment = unitDues.payments[monthIndex];
                  const paymentAmount = (payment?.paid && payment?.amount) ? payment.amount : 0;
                  if (paymentAmount > 0) {
                    prePaidAmount += paymentAmount;
                  }
                }
              }
            }
          }
        }
        
        // Total pre-paid = future payments + credit balances
        prePaidAmount += totalCreditBalances;
        
        console.log(`🎯 Currently Due calculation: Individual unit amounts × ${monthsElapsed} months = $${currentlyDue.toLocaleString()}`);
        console.log(`🎯 Total Collected (actual payments only): $${currentPaid.toLocaleString()}`);
        console.log(`🎯 Pre-Paid Amount (future payments + credits): $${prePaidAmount.toLocaleString()}`);
        console.log(`   - Future payments: $${(prePaidAmount - totalCreditBalances).toLocaleString()}`);
        console.log(`   - Credit balances: $${totalCreditBalances.toLocaleString()}`);
        
        // Calculate payment breakdown
        console.log(`💰 Payment Breakdown:`);
        console.log(`  📋 Currently Due (through ${monthNames[currentMonth - 1]}): $${currentlyDue.toLocaleString()}`);
        console.log(`  ✅ Current Paid (actual payments): $${currentPaid.toLocaleString()}`);
        console.log(`  🔮 Pre-Paid (future + credits): $${prePaidAmount.toLocaleString()}`);
        
        // Collection Rate based on what's been collected vs what's due
        const collectionRate = currentlyDue > 0 ? (currentPaid / currentlyDue) * 100 : 0;
        
        // Debug logging to understand the calculation
        console.log('🏠 HOA Dues Calculation Debug:');
        console.log('📅 Current Date:', currentDate.toISOString());
        console.log('📆 Current Year:', currentYear);
        console.log('📊 Current Month:', currentMonth);
        console.log('⏰ Months Elapsed:', monthsElapsed);
        console.log('🏘️ Units Count:', units.length);
        console.log('💰 Annual Dues Total:', annualDuesTotal.toLocaleString());
        console.log('🎯 Expected Dues to Date (' + monthsElapsed + ' months):', expectedDuesToDate.toLocaleString());
        console.log('✅ Total Collected (YTD):', totalCollected.toLocaleString());
        console.log('📅 Current Month Expected:', currentMonthDuesExpected.toLocaleString());
        console.log('💰 Current Month Collected:', currentMonthCollected.toLocaleString());
        console.log('📊 Collection Rate (Current Obligations):', collectionRate.toFixed(1) + '%');
        console.log('🚨 Past Due Units Count:', pastDueUnits);
        console.log('💸 Past Due Amount:', pastDueAmount.toLocaleString());
        
        // Log per-unit details
        console.log('🏘️ Unit Details:');
        console.log(`🔗 API Success: ${apiSuccess}`);
        if (apiSuccess && Object.keys(duesDataFromAPI).length > 0) {
          units.forEach((unit, index) => {
            const unitDues = duesDataFromAPI[unit.unitId];
            const unitScheduledAmount = unitDues?.scheduledAmount || 0;
            console.log(`  Unit ${index + 1}: ${unit.unitId} - $${unitScheduledAmount}/month`);
          });
        } else {
          console.log('  No individual unit amounts available from API');
        }
        
        setHoaDuesStatus({
          currentlyDue: Math.round(currentlyDue), // Total due through current month (rounded)
          currentPaid: Math.round(currentPaid), // Total actually collected (rounded)
          futurePayments: Math.round(prePaidAmount), // Pre-paid amount (future + credits, rounded)
          totalCollected: Math.round(currentPaid), // Total collected year-to-date (rounded)
          collectionRate: Math.min(100, Math.max(0, collectionRate)), // Collection rate
          overdueCount: pastDueUnits,
          pastDueAmount: Math.round(pastDueAmount), // Rounded to nearest peso
          pastDueDetails: pastDueDetails, // Array of past due unit details
          monthsElapsed,
          unitsCount: units.length
        });
        
      } catch (err) {
        console.error('Error fetching HOA dues status:', err);
        setError(prev => ({ ...prev, dues: err.message }));
        
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
      
      console.log('💧 Dashboard: Client has water bills enabled, proceeding with data fetch');
      
      try {
        setLoading(prev => ({ ...prev, water: true }));
        setError(prev => ({ ...prev, water: null }));
        
        // Get current fiscal year for water bills
        const currentDate = new Date();
        const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1;
        const currentYear = getFiscalYear(currentDate, fiscalYearStartMonth);
        
        console.log('💧 Dashboard Water Bills calculation:');
        console.log('  Client:', selectedClient.id);
        console.log('  Fiscal Year:', currentYear);
        console.log('  Has Water Bills:', hasWaterBills);
        
        // Use the same aggregated data API as all water bills modules (with built-in caching)
        const waterAPI = (await import('../api/waterAPI')).default;
        let waterResponse = null;
        
        try {
          waterResponse = await waterAPI.getAggregatedData(selectedClient.id, currentYear);
          console.log('💧 Dashboard: Water API response received:', {
            hasResponse: !!waterResponse,
            hasData: !!waterResponse?.data,
            dataKeys: waterResponse?.data ? Object.keys(waterResponse.data) : 'none'
          });
          
          // Normalize response structure for dashboard processing
          if (waterResponse?.data) {
            waterResponse = { waterData: waterResponse.data };
          }
        } catch (waterError) {
          console.log('💧 Dashboard: Water API error:', waterError.message);
          if (waterError.status === 404) {
            console.log('💧 Dashboard: No water data found for this client/year (normal)');
            waterResponse = null;
          } else {
            throw waterError;
          }
        }
        
        // Calculate water bills past due information using new data structure
        let totalUnpaid = 0;
        let overdueCount = 0;
        let pastDueDetails = [];
        let totalBilled = 0;
        let totalPaid = 0;
        
        if (waterResponse && waterResponse.waterData && waterResponse.waterData.months) {
          console.log('💧 Dashboard: Processing water bills data with months structure');
          console.log('💧 Dashboard: Months available:', waterResponse.waterData.months.length);
          
          // Get current fiscal month to find the most recent bills
          const currentFiscalMonth = getCurrentFiscalMonth(currentDate, fiscalYearStartMonth);
          
          // Find the most recent month with bills generated (working backwards from current month)
          let mostRecentMonth = null;
          for (let monthIndex = currentFiscalMonth - 1; monthIndex >= 0; monthIndex--) {
            const month = waterResponse.waterData.months[monthIndex];
            if (month && month.billsGenerated) {
              mostRecentMonth = month;
              console.log(`💧 Dashboard: Found most recent bills: ${month.monthName} ${month.calendarYear}`);
              console.log(`💧 Dashboard: Month has ${Object.keys(month.units || {}).length} units`);
              break;
            }
          }
          
          if (mostRecentMonth && mostRecentMonth.units) {
            console.log('💧 Dashboard: Processing most recent bills for past due calculation');
            
            // Process the most recent bills - the penalty calculator handles grace periods automatically
            Object.entries(mostRecentMonth.units).forEach(([unitId, unitData]) => {
              const unpaidAmount = unitData.unpaidAmount || 0;
              const billAmount = unitData.billAmount || 0;
              const paidAmount = unitData.paidAmount || 0;
              
              console.log(`💧 Dashboard: Unit ${unitId} - Bill: $${billAmount}, Paid: $${paidAmount}, Unpaid: $${unpaidAmount}`);
              
              // Add to totals for collection rate
              totalBilled += billAmount;
              totalPaid += paidAmount;
              
              if (unpaidAmount > 0) {
                console.log(`💧 Dashboard: Unit ${unitId} has $${unpaidAmount} unpaid`);
                totalUnpaid += unpaidAmount;
                overdueCount++;
                
                pastDueDetails.push({
                  unitId: unitId,
                  owner: unitData.ownerLastName || 'Unknown',
                  amountDue: unpaidAmount
                });
              }
            });
          } else {
            console.log('💧 Dashboard: No bills found with generated status - no past due amounts');
          }
          
          console.log('💧 Dashboard: Water Bills Past Due Results:');
          console.log(`  - Most Recent Bills Month: ${mostRecentMonth?.monthName || 'None'}`);
          console.log(`  - Total Unpaid: $${totalUnpaid.toLocaleString()}`);
          console.log(`  - Overdue Units: ${overdueCount}`);
          console.log(`  - Total Billed: $${totalBilled.toLocaleString()}`);
          console.log(`  - Total Paid: $${totalPaid.toLocaleString()}`);
          console.log(`  - Past Due Details:`, pastDueDetails);
        } else {
          console.log('💧 Dashboard: No water data with months structure found');
        }
        
        // Calculate collection rate
        const collectionRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
        
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
      dues: () => fetchHOADuesStatus()
    }
  };
};