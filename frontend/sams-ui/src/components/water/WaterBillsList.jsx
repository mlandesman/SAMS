import React, { useState, useEffect } from 'react';
import { useClient } from '../../context/ClientContext';
import { useWaterBills } from '../../context/WaterBillsContext';
import { useNavigate } from 'react-router-dom';
import waterAPI from '../../api/waterAPI';
import WaterPaymentModal from './WaterPaymentModal';
import { databaseFieldMappings } from '../../utils/databaseFieldMappings';
import { getOwnerInfo } from '../../utils/unitUtils';
import { getMexicoDateString, getMexicoDate } from '../../utils/timezone';
import { getFiscalYear, getCurrentFiscalMonth, getFiscalQuarter } from '../../utils/fiscalYearUtils';
import './WaterBillsList.css';

// Helper function to get current quarter based on fiscal month
const getCurrentQuarter = (clientConfig) => {
  if (!clientConfig) return 1; // Default to Q1
  const fiscalYearStartMonth = clientConfig.configuration?.fiscalYearStartMonth || 7;
  const currentDate = getMexicoDate();
  const fiscalMonth = getCurrentFiscalMonth(currentDate, fiscalYearStartMonth);
  return getFiscalQuarter(fiscalMonth);
};

// Helper function to get default due date (~15 days from now)
const getDefaultDueDate = () => {
  const today = getMexicoDate();
  const defaultDate = new Date(today);
  defaultDate.setDate(defaultDate.getDate() + 15);
  return getMexicoDateString(defaultDate);
};

const WaterBillsList = ({ clientId, onBillSelection, selectedBill, onRefresh }) => {
  console.log('🚀 [WaterBillsList] Component mounted with clientId:', clientId);
  
  // TEMPORARY: Phase 1 - Single month display only
  // TODO: Phase 2 will add cross-month aggregation
  const ENABLE_AGGREGATION = false;  // Will be enabled in Phase 2
  
  const { selectedClient } = useClient();
  const { waterData, loading: contextLoading, error: contextError, refreshData } = useWaterBills();
  const navigate = useNavigate();
  const [billingConfig, setBillingConfig] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(0); // Start with July (month 0)
  const [selectedQuarter, setSelectedQuarter] = useState(() => getCurrentQuarter(selectedClient)); // For quarterly billing - default to current quarter
  const [selectedDueDate, setSelectedDueDate] = useState(getDefaultDueDate());
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [availableReadingMonths, setAvailableReadingMonths] = useState([]);
  const [quarterlyBills, setQuarterlyBills] = useState([]);
  const [quarterlyLoading, setQuarterlyLoading] = useState(false);
  const [unitsWithOwners, setUnitsWithOwners] = useState([]); // Units with owner data
  const [generationResult, setGenerationResult] = useState(null); // For minimal generator result display
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedUnitForPayment, setSelectedUnitForPayment] = useState(null);
  
  // Cache refresh key to force re-fetch when needed
  const [refreshKey, setRefreshKey] = useState(0);

  // Get units from API with owner data (not from configuration)
  const units = unitsWithOwners;

  // Fetch units with owner data from API
  const fetchUnitsWithOwners = async () => {
    if (!selectedClient) return;
    
    try {
      const { getAuthInstance } = await import('../../firebaseClient');
      const { config } = await import('../../config');
      const token = await getAuthInstance().currentUser.getIdToken();

      const response = await fetch(`${config.api.baseUrl}/clients/${selectedClient.id}/units`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const unitsResponse = await response.json();
        const unitsData = unitsResponse.data || unitsResponse;
        console.log('👥 [WaterBillsList] Loaded units with owner data:', unitsData.length, 'units');
        setUnitsWithOwners(unitsData);
      } else {
        console.warn(`Failed to fetch units with owner data for client ${selectedClient.id}`);
        setUnitsWithOwners([]);
      }
    } catch (error) {
      console.error('Error fetching units with owner data:', error);
      setUnitsWithOwners([]);
    }
  };

  // Fetch units when client changes
  useEffect(() => {
    if (selectedClient) {
      fetchUnitsWithOwners();
    } else {
      setUnitsWithOwners([]);
    }
  }, [selectedClient]);

  useEffect(() => {
    console.log('🔄 [WaterBillsList] useEffect triggered:', { clientId, refreshKey });
    if (clientId) {
      console.log('✅ [WaterBillsList] clientId exists, calling functions');
      fetchBillingConfig();
      fetchAvailableReadingMonths();
    } else {
      console.log('❌ [WaterBillsList] No clientId, skipping functions');
    }
  }, [clientId, refreshKey]);

  useEffect(() => {
    // Fetch quarterly bills if billing period is quarterly
    if (billingConfig?.billingPeriod === 'quarterly' && clientId) {
      fetchQuarterlyBills();
    }
  }, [billingConfig, clientId, refreshKey]);

  const fetchAvailableReadingMonths = async () => {
    try {
      console.log('🔍 [WaterBillsList] fetchAvailableReadingMonths called for clientId:', clientId);
      
      // Fetch reading months from the readings API to populate bills dropdown
      const response = await waterAPI.getReadingsForYear(clientId, 2026);
      
      console.log('📡 [WaterBillsList] getReadingsForYear response:', response);
      console.log('📊 [WaterBillsList] Response data.months:', response.data?.months);
      console.log('📊 [WaterBillsList] Response.months:', response.months);
      console.log('📊 [WaterBillsList] Response structure:', Object.keys(response));
      
      // Try both possible response structures
      const monthsData = response.months || response.data?.months;
      console.log('📊 [WaterBillsList] Using months data:', monthsData);
      
      if (response.success && monthsData) {
        const readingMonths = [];
        
        // Find highest month with readings data
        let highestMonthWithReadings = -1;
        for (let i = 0; i < 12; i++) {
          const monthData = monthsData[i];
          console.log(`🔍 [WaterBillsList] Month ${i} data:`, monthData);
          if (monthData && Object.keys(monthData).length > 0) {
            highestMonthWithReadings = i;
            console.log(`✅ [WaterBillsList] Month ${i} has readings data`);
          }
        }
        console.log(`📈 [WaterBillsList] Highest month with readings: ${highestMonthWithReadings}`);
        
        // Show months up to highest + 1 (for bill generation)
        const maxMonth = Math.min(highestMonthWithReadings + 2, 12);
        
        for (let i = 0; i < maxMonth; i++) {
          const monthData = monthsData[i];
          const hasReadings = monthData && Object.keys(monthData).length > 0;
          
          // Map fiscal year months to calendar months
          // Fiscal year 2026: July 2025 (month 0), August 2025 (month 1), ..., June 2026 (month 11)
          const fiscalMonthIndex = i;
          const calendarMonthIndex = (i + 6) % 12; // July (6) becomes month 0, August (7) becomes month 1, etc.
          const calendarYear = i < 6 ? 2025 : 2026; // First 6 months (July-Dec) are 2025, next 6 months (Jan-Jun) are 2026
          
          const monthName = new Date(calendarYear, calendarMonthIndex, 1).toLocaleDateString('en-US', { month: 'long' });
          const fiscalYearDisplay = `2026-${fiscalMonthIndex.toString().padStart(2, '0')}`;
          
          console.log(`📅 [WaterBillsList] Adding fiscal month ${fiscalMonthIndex}: ${monthName} ${calendarYear} (${fiscalYearDisplay}) (hasReadings: ${hasReadings})`);
          
          readingMonths.push({
            month: fiscalMonthIndex,
            monthName: `${monthName} ${calendarYear}`,
            fiscalYearDisplay,
            calendarYear,
            hasReadings
          });
        }
        
        setAvailableReadingMonths(readingMonths);
        console.log(`📖 Found ${readingMonths.length} months for bill generation (highest readings: ${highestMonthWithReadings}, showing up to: ${maxMonth-1})`);
      }
    } catch (error) {
      console.error('Error fetching reading months:', error);
      // Fallback to showing bill months if readings fetch fails
      if (waterData?.months) {
        const billMonths = waterData.months.map((month, idx) => ({
          month: idx,
          monthName: month.monthName,
          calendarYear: month.calendarYear,
          hasReadings: false
        }));
        setAvailableReadingMonths(billMonths);
      }
    }
  };

  // Auto-advance to most recent bill period when data loads
  useEffect(() => {
    if (waterData?.months && waterData.months.length > 0) {
      // Find the last month that has bills (has transaction IDs or bill amounts)
      const monthsWithBills = waterData.months
        .filter(m => {
          if (!m.units) return false;
          // Check if any unit has a transaction ID or bill amount
          return Object.values(m.units).some(unit => 
            unit.transactionId || (unit.billAmount && unit.billAmount > 0)
          );
        })
        .map(m => m.month)
        .sort((a, b) => a - b);
      
      if (monthsWithBills.length > 0) {
        const lastBillMonth = monthsWithBills[monthsWithBills.length - 1];
        console.log(`🔍 Auto-advancing Bills to month ${lastBillMonth} (most recent bill)`);
        setSelectedMonth(lastBillMonth);
      }
    }
  }, [waterData]);

  // Fetch bills data when selected month changes
  const fetchBillingConfig = async () => {
    try {
      const response = await waterAPI.getConfig(clientId);
      console.log('Billing config received:', response);
      setBillingConfig(response.data);
    } catch (error) {
      console.error('Error fetching billing config:', error);
      // Don't show error to user, just log it
    }
  };

  const fetchQuarterlyBills = async () => {
    try {
      setQuarterlyLoading(true);
      setError('');
      const response = await waterAPI.getQuarterlyBills(clientId, 2026);
      console.log('📊 [WaterBillsList] Quarterly bills API response:', response);
      console.log('📊 [WaterBillsList] Quarterly bills data:', response.data);
      const bills = response.data || [];
      console.log(`📊 [WaterBillsList] Found ${bills.length} quarterly bills`);
      bills.forEach(bill => {
        console.log(`  - ${bill._billId || 'unknown'}: Q${bill.fiscalQuarter}, ${Object.keys(bill.bills?.units || {}).length} units`);
      });
      setQuarterlyBills(bills);
    } catch (error) {
      console.error('❌ [WaterBillsList] Error fetching quarterly bills:', error);
      setError('Failed to load quarterly bills: ' + (error.message || 'Unknown error'));
    } finally {
      setQuarterlyLoading(false);
    }
  };


  const generateBills = async (month) => {
    try {
      setGenerating(true);
      setError('');
      setMessage('');
      setGenerationResult(null);
      
      if (!selectedDueDate) {
        setError('Please select a due date before generating bills');
        return;
      }
      
      await waterAPI.generateBillsNew(clientId, 2026, month, { dueDate: selectedDueDate });
      
      // Refresh data to show new bills
      if (billingConfig?.billingPeriod === 'quarterly') {
        // Add small delay to allow Firestore to propagate changes
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchQuarterlyBills();
      } else {
        await refreshData();
      }
      
      // Show appropriate success message based on billing period
      const successMsg = billingConfig?.billingPeriod === 'quarterly' 
        ? 'Quarterly bill generated successfully!' 
        : 'Bills generated successfully!';
      setMessage(successMsg);
    } catch (error) {
      console.error('Error generating bills:', error);
      setError(error.response?.data?.error || 'Failed to generate bills');
    } finally {
      setGenerating(false);
    }
  };

  // Generate quarterly bill (minimal generator)
  const generateQuarterlyBill = async () => {
    try {
      setGenerating(true);
      setError('');
      setMessage('');
      setGenerationResult(null);
      
      if (!selectedDueDate) {
        setError('Please select a due date before generating bills');
        return;
      }

      // Get current fiscal year from client config
      const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 7;
      const currentFiscalYear = getFiscalYear(getMexicoDate(), fiscalYearStartMonth);
      
      // Call backend endpoint for quarterly bill generation
      // For quarterly: POST with { year, dueDate, quarter } - quarter parameter tells backend which quarter to generate
      // The backend controller checks billingPeriod and handles quarterly vs monthly
      const token = await waterAPI.getAuthToken();
      const { config } = await import('../../config');
      
      const response = await fetch(
        `${config.api.baseUrl}/water/clients/${clientId}/bills/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            year: currentFiscalYear, 
            dueDate: selectedDueDate,
            quarter: selectedQuarter // Pass selected quarter to backend
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Extract summary from response
      const summary = result.data?.summary || {};
      setGenerationResult({
        success: true,
        units: summary.totalUnits || 0,
        total: summary.totalBilled || 0
      });
      
      setMessage('Quarterly bill generated successfully!');
      
      // Refresh quarterly bills list
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchQuarterlyBills();
      
    } catch (error) {
      console.error('Error generating quarterly bill:', error);
      const errorMessage = error.message || 'Failed to generate quarterly bill';
      setError(errorMessage);
      setGenerationResult(null);
    } finally {
      setGenerating(false);
    }
  };

  // Manual refresh function - delegates to parent's refresh handler
  const handleRefresh = async () => {
    console.log(`🔄 [WaterBillsList] Manual refresh triggered`);
    
    // Refresh based on billing period
    if (billingConfig?.billingPeriod === 'quarterly') {
      await fetchQuarterlyBills();
    } else {
      // Notify parent component to handle the full refresh
      if (onRefresh) {
        await onRefresh();
      }
    }
    
    // Increment refresh key to trigger local re-render
    setRefreshKey(prev => prev + 1);
  };
  
  // Expose refresh function to parent via onRefresh callback
  React.useEffect(() => {
    if (onRefresh) {
      // Store the refresh function reference so parent can call it
      window.waterBillsRefresh = handleRefresh;
    }
  }, [onRefresh, clientId]);

  const hasBillsForMonth = (monthData) => {
    if (!monthData) return false;
    
    // Check if bills were actually generated for this month (backend sets this flag)
    return monthData.billsGenerated === true;
  };

  const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return '0.00';
    return amount.toFixed(2);
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '';
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Helper function for status colors (Phase 1)
  const getStatusClass = (status) => {
    switch(status) {
      case 'paid': 
        return 'status-paid';
      case 'partial': 
        return 'status-partial';
      case 'unpaid': 
      default: 
        return 'status-unpaid';
    }
  };

  // Check if quarterly billing
  const isQuarterly = billingConfig?.billingPeriod === 'quarterly';
  
  if (contextLoading || (isQuarterly && quarterlyLoading)) {
    return <div className="loading-container">Loading water bills...</div>;
  }

  if (contextError) {
    return <div className="error-message">{contextError}</div>;
  }

  // Quarterly bills flow to table display; generator controls live in the main controls-bar below.

  // For quarterly billing, get the selected quarter's bill
  let monthData = null;
  let hasBills = false;
  
  if (isQuarterly) {
    console.log(`🔍 [WaterBillsList] Looking for Q${selectedQuarter} bill`);
    console.log(`🔍 [WaterBillsList] Available quarterly bills:`, quarterlyBills.map(b => `Q${b.fiscalQuarter}`));
    const selectedQuarterBill = quarterlyBills.find(b => b.fiscalQuarter === selectedQuarter);
    console.log(`🔍 [WaterBillsList] Selected quarter bill:`, selectedQuarterBill ? `Found Q${selectedQuarterBill.fiscalQuarter}` : 'NOT FOUND');
    
    if (selectedQuarterBill && selectedQuarterBill.bills?.units) {
      console.log(`🔍 [WaterBillsList] Transforming ${Object.keys(selectedQuarterBill.bills.units).length} units`);
      // Transform quarterly bill structure to match monthly structure
      // Backend already converts currency fields to pesos, so use them directly
      const transformedUnits = {};
      Object.entries(selectedQuarterBill.bills.units).forEach(([unitId, unitBill]) => {
        // Get owner name from units list using getOwnerInfo utility
        const unitConfig = units.find(u => (u.unitId || u.id) === unitId);
        const ownerInfo = getOwnerInfo(unitConfig || {});
        const ownerLastName = ownerInfo.lastName || 'NO NAME AVAILABLE';
        
        // Calculate unpaid amount (total - paid)
        const unpaidAmount = (unitBill.totalAmount || 0) - (unitBill.paidAmount || 0);
        
        transformedUnits[unitId] = {
          ownerLastName: ownerLastName,
          consumption: unitBill.totalConsumption || 0,
          billAmount: unitBill.waterCharge || 0, // Already in pesos from backend
          totalAmount: unitBill.totalAmount || 0, // Already in pesos
          paidAmount: unitBill.paidAmount || 0, // Already in pesos
          unpaidAmount: unpaidAmount,
          penaltyAmount: unitBill.penaltyAmount || 0, // Already in pesos
          totalPenalties: unitBill.penaltyAmount || 0, // For display consistency
          displayPenalties: unitBill.penaltyAmount || 0, // Current penalties for this bill
          displayTotalDue: unpaidAmount, // Total amount still owed
          displayOverdue: 0, // Quarterly bills: no prior-period overdue in this view
          displayTotalPenalties: unitBill.penaltyAmount || 0,
          status: unitBill.status || 'unpaid',
          carWashCount: unitBill.carWashCount || 0,
          boatWashCount: unitBill.boatWashCount || 0,
          currentReading: {
            washes: unitBill.washes || []
          },
          payments: unitBill.payments || [], // For transaction linking in status cell
          // Add monthly breakdown for reference (still in centavos, but not used in Bills tab display)
          monthlyBreakdown: unitBill.monthlyBreakdown || []
        };
      });
      
      monthData = {
        units: transformedUnits,
        billsGenerated: true,
        month: selectedQuarterBill.readingsIncluded?.[0]?.month || 0,
        dueDate: selectedQuarterBill.dueDate
      };
      hasBills = true;
      console.log(`✅ [WaterBillsList] Q${selectedQuarter} bill found and transformed, hasBills=${hasBills}`);
    } else {
      console.log(`⚠️ [WaterBillsList] Q${selectedQuarter} bill not found or has no units`);
    }
  } else {
    // Monthly billing - use existing logic
    if (!waterData) {
      return <div className="no-data-message">No water billing data available</div>;
    }
    monthData = waterData.months?.[selectedMonth];
    hasBills = hasBillsForMonth(monthData);
  }
  
  // Debug logging for August bills issue
  if (selectedMonth === 1) { // August is month 1
    console.log('🔍 August Bills Debug:');
    console.log('Month Data:', monthData);
    console.log('Has Bills:', hasBills);
    if (monthData?.units) {
      Object.entries(monthData.units).forEach(([unitId, unit]) => {
        if (unit.billAmount > 0) {
          console.log(`Unit ${unitId} has billAmount:`, unit.billAmount);
        }
      });
    }
  }

  // Calculate totals for the selected month (Phase 1: Single month only)
  const calculateSummary = () => {
    if (!ENABLE_AGGREGATION) {
      // Phase 1: Just show current month totals
      let monthTotal = 0;
      let monthPaid = 0;
      let monthConsumption = 0;
      let monthCharges = 0;
      let monthWashes = 0;
      let monthPenalties = 0;
      
      // Safety check for monthData
      if (!monthData || !monthData.units) {
        console.log('⚠️ [WaterBillsList] No month data available for summary calculation');
        return {
          monthTotal: 0,
          monthPaid: 0,
          monthConsumption: 0,
          monthCharges: 0,
          monthWashes: 0,
          monthPenalties: 0
        };
      }
      
      Object.values(monthData.units).forEach(unit => {
        const monthlyCharge = unit.billAmount || 0;
        
        // Calculate wash charges from currentReading.washes array
        let washCharges = 0;
        if (unit.currentReading?.washes && Array.isArray(unit.currentReading.washes)) {
          const totalWashCents = unit.currentReading.washes.reduce((total, wash) => {
            return total + (wash.cost || 0);
          }, 0);
          washCharges = databaseFieldMappings.centsToDollars(totalWashCents);
        }
        
        // Backend pre-calculates these values (WB1) - no fallback calculation needed
        const penalties = unit.penaltyAmount || 0;
        const total = unit.totalAmount || 0;  // Pre-calculated by backend
        const paid = unit.paidAmount || 0;
        
        monthConsumption += unit.consumption || 0;
        monthCharges += monthlyCharge;
        monthWashes += washCharges;
        monthPenalties += penalties;
        monthTotal += total;
        monthPaid += paid;
      });
      
      return {
        consumption: monthConsumption,
        billAmount: monthCharges,
        washes: monthWashes,
        penalties: monthPenalties,
        total: monthTotal,
        paid: monthPaid,
        due: monthTotal - monthPaid
      };
    } else {
      // Phase 2: Will implement full aggregation
      // Placeholder for Phase 2 implementation
      return { consumption: 0, billAmount: 0, washes: 0, penalties: 0, total: 0, paid: 0, due: 0 };
    }
  };
  
  const monthTotals = calculateSummary();

  return (
    <div className="water-bills-container">
      <div className="controls-bar">
        {isQuarterly ? (
          <div className="quarter-selector">
            <label htmlFor="quarter-select">Select Quarter:</label>
            <select 
              id="quarter-select"
              value={selectedQuarter} 
              onChange={(e) => setSelectedQuarter(Number(e.target.value))}
              className="quarter-dropdown"
            >
              <option value={1}>Q1 (Jul-Sep)</option>
              <option value={2}>Q2 (Oct-Dec)</option>
              <option value={3}>Q3 (Jan-Mar)</option>
              <option value={4}>Q4 (Apr-Jun)</option>
            </select>
          </div>
        ) : (
          <div className="month-selector">
            <label htmlFor="month-select">Select Month:</label>
            <select 
              id="month-select"
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="month-dropdown"
            >
              {availableReadingMonths.map((month) => (
                <option key={month.month} value={month.month}>
                  {month.fiscalYearDisplay} - {month.monthName}
                  {!month.hasReadings ? ' (No readings)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="due-date-selector">
          <label htmlFor="due-date-select">Due Date:</label>
          {isQuarterly && hasBills ? (
            // Show quarter's due date
            <div className="due-date-display">
              {quarterlyBills.find(b => b.fiscalQuarter === selectedQuarter)?.dueDate 
                ? new Date(quarterlyBills.find(b => b.fiscalQuarter === selectedQuarter).dueDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })
                : 'N/A'}
            </div>
          ) : hasBills && monthData?.dueDate ? (
            // Show read-only date when bills are already generated (monthly)
            <div className="due-date-display">
              {new Date(monthData.dueDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
          ) : (
            // Show date picker when bills not yet generated
            <input 
              type="date" 
              id="due-date-select"
              value={selectedDueDate}
              onChange={(e) => setSelectedDueDate(e.target.value)}
              className="due-date-input"
              required
            />
          )}
        </div>
        
        <div className="controls-buttons">
          <button 
            onClick={() => (isQuarterly ? generateQuarterlyBill() : generateBills(selectedMonth))}
            disabled={hasBills || generating || !selectedDueDate}
            className="btn btn-primary generate-bills-btn"
          >
            {generating ? 'Generating...' : 
              billingConfig?.billingPeriod === 'quarterly' 
                ? 'Generate Quarterly Bill' 
                : `Generate Bills for ${availableReadingMonths.find(m => m.month === selectedMonth)?.monthName || `Month ${selectedMonth}`}`
            }
          </button>
        </div>
      </div>

      {message && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i> {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i> {error}
        </div>
      )}

      {contextError && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i> {contextError}
        </div>
      )}

      {(monthData && monthData.units) || (!isQuarterly && availableReadingMonths.find(m => m.month === selectedMonth)?.hasReadings) ? (
        <div className="bills-table-container">
          <table className="bills-table">
            <thead>
              <tr>
                <th className="text-left">Unit</th>
                <th className="text-left">Owner</th>
                <th className="text-right">Usage (m³)</th>
                <th className="text-right">{isQuarterly ? 'Quarterly Charge' : 'Monthly Charge'}</th>
                <th className="text-right">Washes</th>
                <th className="text-right">Overdue</th>
                <th className="text-right">Penalties</th>
                <th className="text-right">Due</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {monthData?.units ? (
                // Show bills data if it exists
                Object.entries(monthData.units).map(([unitId, unit]) => {
              // Find unit to get owner name using getOwnerInfo utility
              const unitConfig = units.find(u => (u.unitId || u.id) === unitId);
              const ownerInfo = getOwnerInfo(unitConfig || {});
              const ownerName = ownerInfo.lastName || 'No Name Available';
              
              // Calculate display values with new column structure
              const monthlyCharge = unit.billAmount || 0;  // Current month only
              
              // Calculate wash charges from currentReading.washes array
              let washCharges = 0;
              if (unit.currentReading?.washes && Array.isArray(unit.currentReading.washes)) {
                const totalWashCents = unit.currentReading.washes.reduce((total, wash) => {
                  return total + (wash.cost || 0);
                }, 0);
                washCharges = databaseFieldMappings.centsToDollars(totalWashCents);
              }
              
              // Backend pre-calculates all display values in aggregatedData (WB1)
              // Values already converted from centavos to pesos by API layer (WB1A)
              // For paid bills, backend sets these to 0 automatically
              const penalties = unit.displayPenalties || 0;  // Current month penalties only
              const overdue = unit.displayOverdue || 0;      // Prior months unpaid + their penalties
              const due = unit.displayTotalDue || 0;         // Total due (overdue + current + penalties)
              
              
              // Get most recent payment's transaction ID from payments array
              const payments = unit.payments || [];
              const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;
              const transactionId = lastPayment?.transactionId || null;
              
              // Create bill object for selection/transaction linking
              const billData = {
                unitId,
                period: monthData.monthName + ' ' + monthData.calendarYear,
                monthlyCharge,
                penalties,
                due,
                status: unit.status || 'unpaid',
                transactionId: transactionId, // Transaction ID from most recent payment
                billNotes: unit.billNotes,
                consumption: unit.consumption || 0
              };
              
              // Handle row click for bill selection
              const handleRowClick = () => {
                if (onBillSelection) {
                  onBillSelection(billData);
                }
              };
              
              // Handle status cell click (transaction navigation OR payment modal)
              const handleStatusClick = (e) => {
                e.stopPropagation(); // Prevent row selection
                
                // Get transaction ID from payments array
                const payments = unit.payments || [];
                const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;
                const transactionId = lastPayment?.transactionId || null;
                
                // DEBUG: Log click handling for Unit 203
                if (unitId === '203') {
                  console.log(`🐛 [WATER_BILLS_UI] Unit ${unitId} status click:`, {
                    unitStatus: unit.status,
                    hasPayments: payments.length > 0,
                    payments: payments,
                    lastPayment: lastPayment,
                    transactionId: transactionId,
                    willNavigate: unit.status === 'paid' && transactionId
                  });
                }
                
                if (unit.status === 'paid' && transactionId) {
                  // Navigate to transaction (following HOA Dues pattern exactly)
                  console.log(`💳 Navigating to transaction ID: ${transactionId}`);
                  navigate(`/transactions?id=${transactionId}`);
                  
                  // Update sidebar activity
                  try {
                    const event = new CustomEvent('activityChange', { 
                      detail: { activity: 'transactions' } 
                    });
                    window.dispatchEvent(event);
                  } catch (error) {
                    console.error('Error dispatching activity change event:', error);
                  }
                } else if (unit.status === 'paid' && !transactionId) {
                  alert('No Matching Transaction Record');
                } else if (due > 0) {
                  // Navigate to Transactions and open unified payment modal
                  console.log(`💳 Opening unified payment modal for unit ${unitId}`);
                  navigate('/transactions', { 
                    state: { 
                      openUnifiedPayment: true, 
                      unitId
                    }
                  });
                  
                  // Update sidebar activity
                  try {
                    const event = new CustomEvent('activityChange', { 
                      detail: { activity: 'transactions' } 
                    });
                    window.dispatchEvent(event);
                  } catch (error) {
                    console.error('Error dispatching activity change event:', error);
                  }
                }
              };
              
              // Handle monthly charge click (navigate to unified payment modal)
              const handleMonthlyChargeClick = (e) => {
                e.stopPropagation(); // Prevent row selection
                console.log(`💳 Opening unified payment modal for unit ${unitId}`);
                navigate('/transactions', { 
                  state: { 
                    openUnifiedPayment: true, 
                    unitId
                  }
                });
                
                // Update sidebar activity
                try {
                  const event = new CustomEvent('activityChange', { 
                    detail: { activity: 'transactions' } 
                  });
                  window.dispatchEvent(event);
                } catch (error) {
                  console.error('Error dispatching activity change event:', error);
                }
              };
              
              const isSelected = selectedBill && selectedBill.unitId === unitId;
              
              return (
                <tr 
                  key={unitId} 
                  className={`bill-row ${isSelected ? 'selected' : ''}`}
                  onClick={handleRowClick}
                >
                  <td className="unit-id text-left">{unitId}</td>
                  <td className="owner-name text-left">{ownerName}</td>
                  <td className="consumption text-right">{formatNumber(unit.consumption || 0)}</td>
                  <td 
                    className="monthly-charge text-right clickable-cell"
                    onClick={handleMonthlyChargeClick}
                    title={unit.billNotes || `Click to record payment for Unit ${unitId}`}
                  >
                    ${formatCurrency(monthlyCharge)}
                  </td>
                  <td className="washes text-right">
                    {washCharges > 0 ? (
                      <span className="wash-amount" title={
                        unit.currentReading?.washes 
                          ? `Car: ${unit.currentReading.washes.filter(w => w.type === 'car').length}, Boat: ${unit.currentReading.washes.filter(w => w.type === 'boat').length}`
                          : 'Wash charges'
                      }>
${washCharges.toFixed(2)}
                      </span>
                    ) : ''}
                  </td>
                  <td className="overdue text-right">
                    {overdue > 0 ? (
                      <span className="overdue-amount">${formatCurrency(overdue)}</span>
                    ) : '$0.00'}
                  </td>
                  <td className="penalties text-right">
                    {penalties > 0 ? (
                      <span className="penalty-amount">${formatCurrency(penalties)}</span>
                    ) : '$0.00'}
                  </td>
                  <td className="due text-right">
                    {due > 0 ? (
                      <span className="due-amount">${formatCurrency(due)}</span>
                    ) : (
                      <span className="paid-up">$0.00</span>
                    )}
                  </td>
                  <td className="status text-center">
                    {unit.status === 'paid' && unit.transactionId ? (
                      <button 
                        className="link-button paid-status"
                        onClick={handleStatusClick}
                        title="Click to view transaction details"
                      >
                        PAID
                      </button>
                    ) : (
                      <button 
                        className={'link-button status-button ' + getStatusClass(unit.status || 'unpaid')}
                        onClick={handleStatusClick}
                        title={due > 0 ? 
                          'Click to record payment for Unit ' + unitId : 
                          'No payment needed'
                        }
                      >
                        {(unit.status || 'unpaid').toUpperCase()}
                      </button>
                    )}
                  </td>
                </tr>
              );
                })
              ) : (
                // Show readings data when bills don't exist yet
                availableReadingMonths.find(m => m.month === selectedMonth)?.hasReadings ? (
                  // Show readings data in table format
                  units.map((unit) => {
                    const unitId = unit.unitId || unit.id;
                    const ownerName = unit.ownerLastName || unit.ownerName || 'No Name Available';
                    
                    // For now, show placeholder data - we need to fetch readings data
                    const consumption = 0; // TODO: Get from readings data
                    const ratePerM3 = billingConfig?.ratePerM3 || 5000; // In centavos
                    const monthlyCharge = (consumption * ratePerM3) / 100; // Convert to pesos
                    
                    return (
                      <tr key={unitId}>
                        <td className="unit-id text-left">{unitId}</td>
                        <td className="owner-name text-left">{ownerName}</td>
                        <td className="consumption text-right">{formatNumber(consumption)}</td>
                        <td className="monthly-charge text-right">${formatCurrency(monthlyCharge)}</td>
                        <td className="washes text-right">$0.00</td>
                        <td className="overdue text-right">$0.00</td>
                        <td className="penalties text-right">$0.00</td>
                        <td className="due text-right">${formatCurrency(monthlyCharge)}</td>
                        <td className="status text-center">
                          <span className="status-nobill">NOBILL</span>
                        </td>
                      </tr>
                    );
                  }).filter(Boolean)
                ) : (
                  <tr>
                    <td colSpan="9" className="text-center">
                      <div className="no-readings-message">
                        <p>No readings data available for this month.</p>
                        <p>Please enter readings first before generating bills.</p>
                      </div>
                    </td>
                  </tr>
                )
              )}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td colSpan="2" className="text-right"><strong>Total</strong></td>
              <td className="text-right"><strong>{formatNumber(monthTotals.consumption || 0)}</strong></td>
              <td className="text-right"><strong>${formatCurrency(monthTotals.billAmount || 0)}</strong></td>
              <td className="text-right"><strong>${(monthTotals.washes || 0).toFixed(2)}</strong></td>
              <td className="text-right">
                {(monthTotals.penalties || 0) > 0 ? (
                  <strong>${formatCurrency(monthTotals.penalties || 0)}</strong>
                ) : (
                  <strong>$0.00</strong>
                )}
              </td>
              <td className="text-right"><strong>${formatCurrency(monthTotals.total || 0)}</strong></td>
              <td className="text-right"><strong>${formatCurrency(monthTotals.paid || 0)}</strong></td>
              <td className="text-right"><strong>${formatCurrency(monthTotals.due || 0)}</strong></td>
              <td className="text-center">-</td>
            </tr>
          </tfoot>
        </table>
        </div>
      ) : (
        <div className="no-bills-message">
          <p>No bills data available for the selected {isQuarterly ? 'quarter' : 'month'}.</p>
          <p>Select a {isQuarterly ? 'quarter' : 'month'} from the dropdown above to view or generate bills.</p>
        </div>
      )}

      <div className="bills-summary">
        <div className="summary-item">
          <span className="summary-label">{isQuarterly ? 'Quarter' : 'Month'} Billed:</span>
          <span className="summary-value">${formatCurrency(monthTotals.billAmount || 0)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">{isQuarterly ? 'Quarter' : 'Month'} Paid:</span>
          <span className="summary-value paid">${formatCurrency(monthTotals.paid || 0)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">{isQuarterly ? 'Quarter' : 'Month'} Due:</span>
          <span className="summary-value unpaid">${formatCurrency(monthTotals.due || 0)}</span>
        </div>
        {(monthTotals.penalties || 0) > 0 && (
          <div className="summary-item">
            <span className="summary-label">{isQuarterly ? 'Quarter' : 'Month'} Penalties:</span>
            <span className="summary-value overdue">${formatCurrency(monthTotals.penalties || 0)}</span>
          </div>
        )}
      </div>

      {/* Water Payment Modal */}
      <WaterPaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedUnitForPayment(null);
        }}
        unitId={selectedUnitForPayment}
        selectedMonth={selectedMonth}
        onSuccess={() => {
          // Refresh bills data to show updated payment status (no cache to clear)
          console.log('✅ Payment recorded - refreshing data');
          
          // Direct refresh - no cache invalidation needed
          if (billingConfig?.billingPeriod === 'quarterly') {
            fetchQuarterlyBills();
          } else {
            refreshData();
          }
        }}
      />
    </div>
  );
};

export default WaterBillsList;