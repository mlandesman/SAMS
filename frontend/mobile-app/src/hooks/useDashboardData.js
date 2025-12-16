import { useState, useEffect } from 'react';
import { useAuth } from './useAuthStable.jsx';
import { useClients } from './useClients.jsx';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase.js';
import { config } from '../config/index.js';
import { getFiscalYear, getCurrentFiscalMonth } from '../utils/fiscalYearUtils.js';
import { getMexicoDate } from '../utils/timezone.js';
import { hasWaterBills } from '../utils/clientFeatures.js';
import waterAPI from '../api/waterAPI.js';
import { getFirstOwnerLastName } from '../utils/unitContactUtils.js';

export const useDashboardData = () => {
  const { samsUser, currentClient } = useAuth();
  const { selectedClient } = useClients();
  
  const [accountBalances, setAccountBalances] = useState({
    total: 0,
    bank: 0,
    cash: 0,
    accounts: []
  });
  
  const [hoaDuesStatus, setHoaDuesStatus] = useState({
    totalDue: 0,
    collected: 0,
    outstanding: 0,
    collectionRate: 0,
    overdueCount: 0,
    pastDueAmount: 0,
    pastDueDetails: [] // Array of { unitId, owner, amountDue }
  });
  
  const [exchangeRates, setExchangeRates] = useState({
    usdToMxn: 0,
    mxnToUsd: 0,
    lastUpdated: 'Never',
    source: 'Unknown'
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
    rates: true,
    water: false
  });
  
  const [error, setError] = useState({
    accounts: null,
    dues: null,
    rates: null,
    water: null
  });

  // Fetch account balances - using API endpoint (matches desktop)
  useEffect(() => {
    const fetchAccountBalances = async () => {
      if (!currentClient || !samsUser) return;
      
      try {
        setLoading(prev => ({ ...prev, accounts: true }));
        setError(prev => ({ ...prev, accounts: null }));
        
        // Get authentication token
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          throw new Error('Not authenticated');
        }
        
        // Call API endpoint (same as desktop)
        const response = await fetch(
          `${config.api.baseUrl}/clients/${currentClient}/balances/current`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          // API returns centavos - convert to dollars (divide by 100)
          const bankBalance = result.data.bankBalance || 0;
          const cashBalance = result.data.cashBalance || 0;
          const totalBalance = bankBalance + cashBalance;
          
          setAccountBalances({
            total: Math.round(totalBalance / 100), // Convert centavos to dollars
            bank: Math.round(bankBalance / 100),
            cash: Math.round(cashBalance / 100),
            accounts: result.data.accounts || []
          });
        } else {
          throw new Error(result.error || 'Invalid response format');
        }
        
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
  }, [currentClient, samsUser]);

  // Fetch HOA dues status - using API endpoint (matches desktop)
  useEffect(() => {
    const fetchHOADuesStatus = async () => {
      if (!currentClient || !samsUser) return;
      
      try {
        setLoading(prev => ({ ...prev, dues: true }));
        setError(prev => ({ ...prev, dues: null }));
        
        // Get authentication token
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          throw new Error('Not authenticated');
        }
        
        // Get client configuration for fiscal year and billing frequency
        const clientDocRef = doc(db, `clients/${currentClient}`);
        const clientSnapshot = await getDoc(clientDocRef);
        const clientData = clientSnapshot.exists() ? clientSnapshot.data() : {};
        const fiscalYearStartMonth = clientData.configuration?.fiscalYearStartMonth || 1; // Default to calendar year
        const duesFrequency = clientData.feeStructure?.duesFrequency || 'monthly'; // Default to monthly
        
        // Get current fiscal year and month
        const currentDate = getMexicoDate();
        const fiscalYear = getFiscalYear(currentDate, fiscalYearStartMonth);
        const fiscalMonth = getCurrentFiscalMonth(currentDate, fiscalYearStartMonth);
        const calendarMonth = currentDate.getMonth() + 1; // 1-12
        
        // Calculate how many months are due based on billing frequency (same as desktop)
        let monthsDue = 0;
        if (duesFrequency === 'quarterly') {
          // For quarterly: Count quarters whose due date has passed
          for (let quarter = 0; quarter < 4; quarter++) {
            const quarterFirstMonth = quarter * 3 + 1; // Q1=1, Q2=4, Q3=7, Q4=10
            if (fiscalMonth >= quarterFirstMonth) {
              monthsDue += 3; // Entire quarter is due
            }
          }
        } else {
          // Monthly: Each month through current month
          monthsDue = fiscalMonth;
        }
        
        console.log('🏠 PWA: HOA Dues Configuration:', {
          clientId: currentClient,
          fiscalYearStartMonth,
          duesFrequency,
          currentDate: currentDate.toISOString(),
          calendarMonth,
          fiscalYear,
          fiscalMonth,
          monthsDue,
          apiUrl: `${config.api.baseUrl}/hoadues/${currentClient}/year/${fiscalYear}`
        });
        
        // Call API endpoint (same as desktop)
        const response = await fetch(
          `${config.api.baseUrl}/hoadues/${currentClient}/year/${fiscalYear}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!response.ok) {
          if (response.status === 404) {
            // No HOA dues data for this client (e.g., AVII might be water-only)
            console.log('⚠️ No HOA dues data found for client (may be water-only)');
            setHoaDuesStatus({
              totalDue: 0,
              collected: 0,
              outstanding: 0,
              collectionRate: 0,
              overdueCount: 0,
              pastDueAmount: 0,
              pastDueDetails: [],
              monthsElapsed: fiscalMonth,
              unitsCount: 0
            });
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const duesDataFromAPI = await response.json();
        
        // Fetch units data to get owner information for past due details
        let units = [];
        try {
          const unitsResponse = await fetch(
            `${config.api.baseUrl}/clients/${currentClient}/units`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          if (unitsResponse.ok) {
            const unitsData = await unitsResponse.json();
            units = unitsData.data || unitsData;
          }
        } catch (err) {
          console.warn('⚠️ Could not fetch units for owner info:', err);
        }
        
        console.log('🏠 PWA: API Response received:', {
          hasData: !!duesDataFromAPI,
          unitCount: duesDataFromAPI ? Object.keys(duesDataFromAPI).length : 0,
          unitIds: duesDataFromAPI ? Object.keys(duesDataFromAPI).slice(0, 5) : [],
          sampleUnit: duesDataFromAPI ? Object.values(duesDataFromAPI)[0] : null,
          unitsLoaded: units.length
        });
        
        if (!duesDataFromAPI || Object.keys(duesDataFromAPI).length === 0) {
          // Empty response - no dues data
          console.log('⚠️ Empty API response - no dues data');
          setHoaDuesStatus({
            totalDue: 0,
            collected: 0,
            outstanding: 0,
            collectionRate: 0,
            overdueCount: 0,
            pastDueAmount: 0,
            pastDueDetails: [],
            monthsElapsed: fiscalMonth,
            unitsCount: 0
          });
          return;
        }
        
        // Process API response to calculate dashboard metrics (matching desktop logic)
        // Filter out creditBalances storage document
        const unitEntries = Object.entries(duesDataFromAPI)
          .filter(([unitId]) => unitId !== 'creditBalances');
        
        const unitsCount = unitEntries.length;
        
        // Calculate summary metrics from backend dues data (matching desktop)
        let currentPaid = 0; // Payments only (no credit balances)
        let totalDue = 0;
        let totalExpectedToDate = 0;
        let currentMonthCollected = 0;
        let pastDueUnits = 0;
        let pastDueAmount = 0;
        const pastDueDetails = []; // Array for detailed past due information (matching desktop)
        
        console.log('🏠 PWA: Processing', unitsCount, 'units for fiscal year', fiscalYear);
        
        unitEntries.forEach(([unitId, unitData]) => {
          const scheduledAmount = unitData?.scheduledAmount || 0;
          
          // Calculate expected for this unit based on billing frequency
          let unitTotalDue = 0;
          if (duesFrequency === 'quarterly') {
            // For quarterly: Calculate based on complete quarters that have passed
            const currentQuarter = Math.floor((fiscalMonth - 1) / 3); // Q1=0, Q2=1, Q3=2, Q4=3
            const monthsInPastQuarters = currentQuarter * 3; // Quarters 0-current (not including current)
            
            // Add complete past quarters
            unitTotalDue = scheduledAmount * monthsInPastQuarters;
            
            // Add current quarter if its due date has passed
            const currentQuarterFirstMonth = currentQuarter * 3 + 1;
            if (fiscalMonth >= currentQuarterFirstMonth) {
              unitTotalDue += scheduledAmount * 3; // Full quarter expected
            }
          } else {
            // Monthly: Each month counted individually
            unitTotalDue = scheduledAmount * monthsDue;
          }
          
          totalDue += unitTotalDue;
          
          // Calculate actual BASE payments made (excluding penalties and credits) - matching desktop
          let unitBasePaid = 0;
          const payments = unitData?.payments;
          
          if (payments && Array.isArray(payments)) {
            payments.forEach((payment, index) => {
              // Only count payments that are marked as paid (matching desktop line 335)
              if (payment?.paid && payment?.amount > 0) {
                unitBasePaid += payment.amount; // Base payment only
              }
            });
            
            // Current month collection (fiscal month, 0-based index)
            const currentMonthIndex = fiscalMonth - 1;
            const currentMonthPayment = payments[currentMonthIndex];
            if (currentMonthPayment?.paid && currentMonthPayment?.amount) {
              currentMonthCollected += currentMonthPayment.amount;
            }
          }
          
          currentPaid += unitBasePaid; // Use base payments only (matching desktop)
          
          // Calculate expected to date based on billing frequency (matching desktop)
          if (duesFrequency === 'quarterly') {
            const currentQuarter = Math.floor((fiscalMonth - 1) / 3);
            const monthsInPastQuarters = currentQuarter * 3;
            totalExpectedToDate += scheduledAmount * monthsInPastQuarters;
            
            const currentQuarterFirstMonth = currentQuarter * 3 + 1;
            if (fiscalMonth >= currentQuarterFirstMonth) {
              totalExpectedToDate += scheduledAmount * 3;
            }
          } else {
            totalExpectedToDate += scheduledAmount * monthsDue;
          }
          
          // Calculate past due for this unit (matching desktop logic)
          let unitPastDue = 0;
          if (payments && Array.isArray(payments)) {
            if (duesFrequency === 'quarterly') {
              // Check quarters: If due date passed, count entire quarter
              for (let quarter = 0; quarter < 4; quarter++) {
                const quarterFirstMonth = quarter * 3 + 1;
                if (fiscalMonth >= quarterFirstMonth) {
                  for (let i = 0; i < 3; i++) {
                    const monthIndex = quarter * 3 + i;
                    const payment = payments[monthIndex];
                    const paidAmount = payment?.amount || 0;
                    const shortfall = scheduledAmount - paidAmount;
                    if (shortfall > 0) {
                      unitPastDue += shortfall;
                    }
                  }
                }
              }
            } else {
              // Monthly billing: Check each month individually
              for (let m = 1; m <= fiscalMonth; m++) {
                const monthIndex = m - 1;
                const payment = payments[monthIndex];
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
            
            // Get owner lastName from units array (matching desktop pattern)
            const unitWithOwner = units.find(u => (u.unitId || u.id) === unitId);
            const ownerLastName = getFirstOwnerLastName(unitWithOwner?.owners) || '';
            
            // Add to pastDueDetails array for display (matching desktop pattern)
            pastDueDetails.push({
              unitId: unitId,
              owner: ownerLastName, // Last name for display
              amountDue: Math.round(unitPastDue)
            });
          }
        });
        
        // Calculate pre-paid amounts - sum credit balances + future payment values (matching desktop)
        let prePaidAmount = 0;
        let totalCreditBalances = 0;
        unitEntries.forEach(([unitId, unitData]) => {
          // Sum credit balances
          const creditBalance = unitData?.creditBalance || 0;
          if (creditBalance > 0) {
            totalCreditBalances += creditBalance;
          }
          
          // Sum future payment amounts (payments for months > current month)
          if (unitData?.payments && Array.isArray(unitData.payments)) {
            for (let futureMonth = fiscalMonth + 1; futureMonth <= 12; futureMonth++) {
              const monthIndex = futureMonth - 1;
              if (monthIndex < unitData.payments.length) {
                const payment = unitData.payments[monthIndex];
                const paymentAmount = payment?.amount || 0;
                if (paymentAmount > 0) {
                  prePaidAmount += paymentAmount;
                }
              }
            }
          }
        });
        prePaidAmount += totalCreditBalances;
        
        // Calculate currently due (total expected to date through current month) - matching desktop
        const currentlyDue = totalExpectedToDate || 0;
        
        // Collection rate based on what's been collected vs what's due (matching desktop)
        const collectionRate = currentlyDue > 0 ? (currentPaid / currentlyDue) * 100 : 0;
        
        console.log('🏠 PWA HOA Dues (matching desktop calculation):');
        console.log('📅 Fiscal Year:', fiscalYear, 'Fiscal Month:', fiscalMonth, 'Months Due:', monthsDue);
        console.log('🏘️ Units:', unitsCount);
        console.log('💰 Currently Due (to date):', currentlyDue.toLocaleString());
        console.log('✅ Current Paid (payments only):', currentPaid.toLocaleString());
        console.log('💳 Pre-Paid (credits + future):', prePaidAmount.toLocaleString());
        console.log('📊 Collection Rate:', collectionRate.toFixed(1) + '%');
        console.log('🚨 Past Due Units:', pastDueUnits, 'Amount:', pastDueAmount.toLocaleString());
        
        setHoaDuesStatus({
          totalDue: Math.round(currentlyDue), // Use currentlyDue for consistency with desktop
          collected: Math.round(currentPaid), // Payments only (matching desktop)
          outstanding: Math.round(currentlyDue - currentPaid), // Outstanding = due - paid
          collectionRate: Math.min(100, Math.max(0, collectionRate)),
          overdueCount: pastDueUnits,
          pastDueAmount: Math.round(pastDueAmount),
          pastDueDetails: pastDueDetails || [], // Detailed past due information (matching desktop)
          monthsElapsed: fiscalMonth,
          unitsCount: unitsCount,
          prePaid: Math.round(prePaidAmount) // Add pre-paid for future use
        });
        
      } catch (err) {
        console.error('Error fetching HOA dues status:', err);
        setError(prev => ({ ...prev, dues: err.message }));
        
        // Fallback to zero data on error
        setHoaDuesStatus({
          totalDue: 0,
          collected: 0,
          outstanding: 0,
          collectionRate: 0,
          overdueCount: 0,
          pastDueAmount: 0,
          pastDueDetails: [],
          monthsElapsed: 0,
          unitsCount: 0
        });
      } finally {
        setLoading(prev => ({ ...prev, dues: false }));
      }
    };

    fetchHOADuesStatus();
  }, [currentClient, samsUser]);

  // Fetch exchange rates using the enhanced exchange rate service (same as Desktop UI)
  useEffect(() => {
    const fetchExchangeRates = async () => {
      if (!currentClient || !samsUser) return;
      
      try {
        setLoading(prev => ({ ...prev, rates: true }));
        setError(prev => ({ ...prev, rates: null }));
        
        console.log('📊 PWA: Fetching current exchange rate data...');
        
        // Get authentication token
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          throw new Error('Not authenticated');
        }
        
        // Use the enhanced exchange rate check endpoint (same as Desktop UI)
        const response = await fetch(`${config.api.baseUrl}/system/exchange-rates/check`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const result = await response.json();
        
        if (result.exists && result.data) {
          console.log(`📊 PWA: Exchange rate loaded from ${result.date}${result.fallback ? ' (fallback)' : ''}`);
          
          // Extract all currency rates from the data structure
          const rates = result.data.rates || {};
          
          // Extract rates for all supported currencies
          const usdToMxnRate = rates.MXN_USD?.originalRate || 
                             rates.MXN_USD?.rate ? (1 / rates.MXN_USD.rate) : 
                             result.data.USD_to_MXN || 0;
          
          const cadToMxnRate = rates.MXN_CAD?.originalRate || 
                             rates.MXN_CAD?.rate ? (1 / rates.MXN_CAD.rate) : 0;
          
          const eurToMxnRate = rates.MXN_EUR?.originalRate || 
                             rates.MXN_EUR?.rate ? (1 / rates.MXN_EUR.rate) : 0;
          
          const mxnToCopRate = rates.MXN_COP?.rate || 0;
          
          setExchangeRates({
            // Multi-currency rates (all to MXN)
            rates: {
              USD: usdToMxnRate,
              CAD: cadToMxnRate,
              EUR: eurToMxnRate,
              COP: mxnToCopRate > 0 ? (1 / mxnToCopRate) : 0, // Convert MXN_COP to COP_MXN
              MXN: 1 // Base currency
            },
            // Legacy compatibility
            usdToMxn: usdToMxnRate,
            mxnToUsd: usdToMxnRate ? (1 / usdToMxnRate) : 0,
            lastUpdated: result.date || 'Never',
            source: rates.MXN_USD?.source || 'Exchange Rate Service',
            fallback: result.fallback || false,
            current: result.current !== false
          });
        } else {
          console.log('📊 PWA: No exchange rate data available');
          setExchangeRates({
            usdToMxn: 0,
            mxnToUsd: 0,
            lastUpdated: 'Never',
            source: 'No Data'
          });
        }
        
      } catch (err) {
        console.error('❌ PWA: Error fetching exchange rates:', err);
        setError(prev => ({ ...prev, rates: err.message }));
        
        // Fallback to zero rates on error
        setExchangeRates({
          usdToMxn: 0,
          mxnToUsd: 0,
          lastUpdated: 'Never',
          source: 'Error'
        });
      } finally {
        setLoading(prev => ({ ...prev, rates: false }));
      }
    };

    fetchExchangeRates();
  }, [currentClient, samsUser]);

  // Fetch Water Bills Past Due data (only for clients with water bills enabled)
  useEffect(() => {
    const fetchWaterBillsStatus = async () => {
      if (!currentClient || !samsUser || !selectedClient) {
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
      
      // Check if this client has water bills enabled
      const clientHasWaterBills = hasWaterBills(selectedClient);
      
      if (!clientHasWaterBills) {
        console.log('💧 PWA: Client does not have water bills enabled, skipping');
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
      
      console.log('💧 PWA: Client has water bills enabled, fetching water bills status');
      
      try {
        setLoading(prev => ({ ...prev, water: true }));
        setError(prev => ({ ...prev, water: null }));
        
        // Get current fiscal year for water bills
        const currentDate = getMexicoDate();
        // AVII uses July-start fiscal year (month 7), check config first
        let fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth;
        
        // Fallback: AVII specifically uses July-start (month 7)
        if (!fiscalYearStartMonth && currentClient === 'AVII') {
          fiscalYearStartMonth = 7;
          console.log('💧 PWA: Using AVII default fiscal year start month: July (7)');
        } else if (!fiscalYearStartMonth) {
          fiscalYearStartMonth = 1; // Default to calendar year
        }
        
        const currentYear = getFiscalYear(currentDate, fiscalYearStartMonth);
        
        console.log('💧 PWA Water Bills calculation:', {
          clientId: currentClient,
          currentDate: currentDate.toISOString(),
          fiscalYearStartMonth,
          fiscalYear: currentYear,
          calendarYear: currentDate.getFullYear(),
          calendarMonth: currentDate.getMonth() + 1
        });
        
        // Check billing config first (monthly vs quarterly)
        let billingPeriod = 'monthly';
        try {
          const configResponse = await waterAPI.getBillingConfig(currentClient);
          billingPeriod = configResponse?.data?.billingPeriod || 'monthly';
          console.log(`💧 PWA: Billing period is ${billingPeriod}`);
        } catch (err) {
          console.warn('⚠️ Could not fetch billing config, defaulting to monthly:', err);
        }
        
        // Fetch bills for the current year
        let billsResponse;
        if (billingPeriod === 'quarterly') {
          // For quarterly, we need to use aggregated data or process differently
          // For now, use getBillsForYear which should handle both
          console.log('💧 PWA: Fetching quarterly bills data...');
          billsResponse = await waterAPI.getBillsForYear(currentClient, currentYear);
        } else {
          console.log('💧 PWA: Fetching monthly bills data...');
          billsResponse = await waterAPI.getBillsForYear(currentClient, currentYear);
        }
        
        console.log('💧 PWA: Bills response received:', {
          hasResponse: !!billsResponse,
          hasData: !!billsResponse?.data,
          hasMonths: !!billsResponse?.data?.months,
          monthsCount: billsResponse?.data?.months?.length || 0
        });
        
        // Calculate summary from bills data
        let totalUnpaid = 0;
        let totalBilled = 0;
        let totalPaid = 0;
        const pastDueDetails = [];
        const unitTotals = {}; // Track unpaid amounts per unit
        
        if (billsResponse?.data?.months) {
          // Process all months
          billsResponse.data.months.forEach(monthData => {
            if (monthData.units) {
              Object.entries(monthData.units).forEach(([unitId, unitBill]) => {
                const billed = unitBill.totalAmount || 0;
                const paid = unitBill.paidAmount || 0;
                const unpaid = billed - paid;
                
                totalBilled += billed;
                totalPaid += paid;
                totalUnpaid += unpaid;
                
                // Track unpaid per unit
                if (unpaid > 0) {
                  if (!unitTotals[unitId]) {
                    unitTotals[unitId] = 0;
                  }
                  unitTotals[unitId] += unpaid;
                }
              });
            }
          });
          
          // Build past due details
          Object.entries(unitTotals).forEach(([unitId, amountDue]) => {
            pastDueDetails.push({
              unitId,
              owner: '', // Will be populated if units are fetched
              amountDue: Math.round(amountDue)
            });
          });
        }
        
        // Fetch units to get owner names for past due details
        if (pastDueDetails.length > 0) {
          try {
            const token = await auth.currentUser?.getIdToken();
            const unitsResponse = await fetch(
              `${config.api.baseUrl}/clients/${currentClient}/units`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            if (unitsResponse.ok) {
              const unitsData = await unitsResponse.json();
              const units = unitsData.data || unitsData;
              
              // Add owner names to past due details
              pastDueDetails.forEach(detail => {
                const unit = units.find(u => (u.unitId || u.id) === detail.unitId);
                const ownerLastName = getFirstOwnerLastName(unit?.owners);
                if (ownerLastName) {
                  detail.owner = ownerLastName;
                }
              });
            }
          } catch (err) {
            console.warn('⚠️ Could not fetch units for owner names:', err);
          }
        }
        
        const collectionRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
        
        console.log('💧 PWA Water Bills Summary:', {
          totalUnpaid: Math.round(totalUnpaid),
          totalBilled: Math.round(totalBilled),
          totalPaid: Math.round(totalPaid),
          collectionRate: Math.round(collectionRate * 100) / 100,
          overdueCount: pastDueDetails.length
        });
        
        setWaterBillsStatus({
          totalUnpaid: Math.round(totalUnpaid),
          overdueCount: pastDueDetails.length,
          pastDueDetails,
          totalBilled: Math.round(totalBilled),
          totalPaid: Math.round(totalPaid),
          collectionRate: Math.min(100, Math.max(0, collectionRate))
        });
        
      } catch (err) {
        console.error('💧 PWA: Error fetching water bills status:', err);
        setError(prev => ({ ...prev, water: err.message }));
        
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
  }, [currentClient, samsUser, selectedClient]);

  return {
    accountBalances,
    hoaDuesStatus,
    exchangeRates,
    waterBillsStatus,
    loading,
    error,
    refresh: {
      accounts: () => {
        // Trigger refetch by updating dependency
        setLoading(prev => ({ ...prev, accounts: true }));
      },
      dues: () => {
        setLoading(prev => ({ ...prev, dues: true }));
      },
      rates: () => {
        setLoading(prev => ({ ...prev, rates: true }));
      }
    }
  };
};