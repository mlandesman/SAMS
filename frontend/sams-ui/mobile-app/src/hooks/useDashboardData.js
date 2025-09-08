import { useState, useEffect } from 'react';
import { useAuth } from './useAuthStable.jsx';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase.js';

export const useDashboardData = () => {
  const { samsUser, currentClient } = useAuth();
  
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
    pastDueAmount: 0
  });
  
  const [exchangeRates, setExchangeRates] = useState({
    usdToMxn: 0,
    mxnToUsd: 0,
    lastUpdated: 'Never',
    source: 'Unknown'
  });
  
  const [loading, setLoading] = useState({
    accounts: true,
    dues: true,
    rates: true
  });
  
  const [error, setError] = useState({
    accounts: null,
    dues: null,
    rates: null
  });

  // Fetch account balances - simplified version for PWA
  useEffect(() => {
    const fetchAccountBalances = async () => {
      if (!currentClient || !samsUser) return;
      
      try {
        setLoading(prev => ({ ...prev, accounts: true }));
        setError(prev => ({ ...prev, accounts: null }));
        
        // Get client document directly from Firestore
        const clientDocRef = doc(db, `clients/${currentClient}`);
        const clientSnapshot = await getDoc(clientDocRef);
        
        if (clientSnapshot.exists()) {
          const clientData = clientSnapshot.data();
          const accounts = clientData.accounts || [];
          
          // Calculate totals by account type
          let bankBalance = 0;
          let cashBalance = 0;
          
          accounts.forEach(account => {
            if (account.active !== false) { // Include active accounts
              const balance = account.balance || 0;
              if (account.type === 'bank') {
                bankBalance += balance;
              } else if (account.type === 'cash') {
                cashBalance += balance;
              }
            }
          });
          
          const totalBalance = bankBalance + cashBalance;
          
          setAccountBalances({
            total: Math.round(totalBalance),
            bank: Math.round(bankBalance),
            cash: Math.round(cashBalance),
            accounts: accounts.filter(acc => acc.active !== false)
          });
        } else {
          throw new Error('Client data not found');
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

  // Fetch HOA dues status - same logic as Desktop UI
  useEffect(() => {
    const fetchHOADuesStatus = async () => {
      if (!currentClient || !samsUser) return;
      
      try {
        setLoading(prev => ({ ...prev, dues: true }));
        setError(prev => ({ ...prev, dues: null }));
        
        // Get current year and month for calculations
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // 1-12
        
        // Fetch units directly from Firestore (same as Desktop UI)
        const unitsCollectionRef = collection(db, `clients/${currentClient}/units`);
        const unitsSnapshot = await getDocs(unitsCollectionRef);
        
        const units = [];
        unitsSnapshot.forEach(doc => {
          const unitData = {
            id: doc.id,
            ...doc.data()
          };
          units.push(unitData);
        });
        
        if (units.length === 0) {
          throw new Error('No units found for this client');
        }
        
        // Calculate Annual Dues (total amount each unit should pay x 12)
        const annualDuesTotal = units.reduce((total, unit) => {
          const monthlyAmount = unit.monthlyDues || 0;
          return total + (monthlyAmount * 12);
        }, 0);
        
        // Calculate current month dues expectations
        const currentMonthDuesExpected = units.reduce((total, unit) => {
          const monthlyAmount = unit.monthlyDues || 0;
          return total + monthlyAmount;
        }, 0);
        
        // Fetch dues data for each unit (same as Desktop UI)
        let totalCollected = 0;
        let currentMonthCollected = 0;
        let pastDueUnits = 0;
        let pastDueAmount = 0;
        const monthsElapsed = currentMonth; // How many months of the year have passed
        
        for (const unit of units) {
          const duesDocRef = doc(db, `clients/${currentClient}/units/${unit.id}/dues/${currentYear}`);
          const duesSnapshot = await getDoc(duesDocRef);
          
          let unitDues = null;
          if (duesSnapshot.exists()) {
            unitDues = duesSnapshot.data();
          }
          
          const monthlyAmount = unit.monthlyDues || 0;
          const shouldHavePaidByNow = monthlyAmount * monthsElapsed;
          let unitPaidTotal = 0;
          
          if (unitDues?.payments) {
            // Sum all payments for this unit in current year
            unitDues.payments.forEach(payment => {
              if (payment.paid > 0) {
                totalCollected += payment.paid;
                unitPaidTotal += payment.paid;
              }
            });
            console.log(`  💳 Unit ${unit.id} payments: $${unitPaidTotal} (${unitDues.payments.length} payment records)`);
            
            // Check current month payment for collection rate calculation
            const currentMonthPayment = unitDues.payments.find(p => p.month === currentMonth);
            if (currentMonthPayment && currentMonthPayment.paid > 0) {
              currentMonthCollected += currentMonthPayment.paid;
            }
            
            // Check if unit is past due (no payment for current month)
            if (!currentMonthPayment || currentMonthPayment.paid < monthlyAmount) {
              // Unit is past due if we're past the 5th of the month
              if (currentDate.getDate() > 5) {
                pastDueUnits++;
              }
            }
          } else {
            // No payment data found for this unit - consider past due if after 5th
            if (currentDate.getDate() > 5) {
              pastDueUnits++;
            }
          }
          
          // Add credit balance to total collected and unit paid total (credits count as payments received)
          const unitCreditBalance = unitDues?.creditBalance || 0;
          totalCollected += unitCreditBalance;
          unitPaidTotal += unitCreditBalance;
          
          // Calculate past due amount for this unit (including credits)
          if (unitPaidTotal < shouldHavePaidByNow) {
            pastDueAmount += (shouldHavePaidByNow - unitPaidTotal);
          }
        }
        
        // Calculate Outstanding (Annual Dues - Collected = Outstanding)
        const outstanding = annualDuesTotal - totalCollected;
        
        // Collection Rate based on CURRENT MONTH performance
        const collectionRate = currentMonthDuesExpected > 0 ? (currentMonthCollected / currentMonthDuesExpected) * 100 : 0;
        
        // Debug logging to understand the calculation
        console.log('🏠 PWA HOA Dues Calculation Debug:');
        console.log('📅 Current Date:', currentDate.toISOString());
        console.log('📆 Current Year:', currentYear);
        console.log('📊 Current Month:', currentMonth);
        console.log('🏘️ Units Count:', units.length);
        console.log('💰 Annual Dues Total:', annualDuesTotal.toLocaleString());
        console.log('✅ Total Collected (YTD):', totalCollected.toLocaleString());
        console.log('📅 Current Month Expected:', currentMonthDuesExpected.toLocaleString());
        console.log('💰 Current Month Collected:', currentMonthCollected.toLocaleString());
        console.log('⚠️ Outstanding (Annual - Collected):', outstanding.toLocaleString());
        console.log('📊 Collection Rate (Current Month):', collectionRate.toFixed(1) + '%');
        console.log('🚨 Past Due Units Count:', pastDueUnits);
        console.log('💸 Past Due Amount:', pastDueAmount.toLocaleString());
        
        setHoaDuesStatus({
          totalDue: annualDuesTotal,
          collected: totalCollected,
          outstanding: outstanding, // Annual - Collected (can be negative if overpaid)
          collectionRate: Math.min(100, Math.max(0, collectionRate)), // Cap between 0-100%
          overdueCount: pastDueUnits,
          pastDueAmount: pastDueAmount, // Amount past due for Past Due Units card
          monthsElapsed,
          unitsCount: units.length
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
          pastDueAmount: 0
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
        
        // Use the enhanced exchange rate check endpoint (same as Desktop UI)
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
        const response = await fetch(`${API_BASE_URL}/exchange-rates/check`);
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

  return {
    accountBalances,
    hoaDuesStatus,
    exchangeRates,
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