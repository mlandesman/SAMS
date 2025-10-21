import React, { useState, useEffect } from 'react';
import { useClient } from '../../context/ClientContext';
import { useWaterBills } from '../../context/WaterBillsContext';
import { useNavigate } from 'react-router-dom';
import waterAPI from '../../api/waterAPI';
import WaterPaymentModal from './WaterPaymentModal';
import { databaseFieldMappings } from '../../utils/databaseFieldMappings';
import './WaterBillsList.css';

const WaterBillsList = ({ clientId, onBillSelection, selectedBill, onRefresh }) => {
  // TEMPORARY: Phase 1 - Single month display only
  // TODO: Phase 2 will add cross-month aggregation
  const ENABLE_AGGREGATION = false;  // Will be enabled in Phase 2
  
  const { selectedClient } = useClient();
  const { waterData, loading: contextLoading, error: contextError, refreshData } = useWaterBills();
  const navigate = useNavigate();
  const [billingConfig, setBillingConfig] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(0); // Start with July (month 0)
  const [selectedDueDate, setSelectedDueDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [availableReadingMonths, setAvailableReadingMonths] = useState([]);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedUnitForPayment, setSelectedUnitForPayment] = useState(null);
  
  // Cache refresh key to force re-fetch when needed
  const [refreshKey, setRefreshKey] = useState(0);

  // Get units from client configuration
  const units = selectedClient?.configuration?.units || [];

  useEffect(() => {
    if (clientId) {
      fetchBillingConfig();
      fetchAvailableReadingMonths();
    }
}, [clientId, refreshKey]);

  const fetchAvailableReadingMonths = async () => {
    try {
      console.log('🔍 [WaterBillsList] fetchAvailableReadingMonths called for clientId:', clientId);
      
      // Fetch reading months from the readings API to populate bills dropdown
      const response = await waterAPI.getReadingsForYear(clientId, 2026);
      
      console.log('📡 [WaterBillsList] getReadingsForYear response:', response);
      
      if (response.success && response.data?.months) {
        const readingMonths = [];
        
        // Find highest month with readings data
        let highestMonthWithReadings = -1;
        for (let i = 0; i < 12; i++) {
          const monthData = response.data.months[i];
          if (monthData && Object.keys(monthData).length > 0) {
            highestMonthWithReadings = i;
          }
        }
        
        // Show months up to highest + 1 (for bill generation)
        const maxMonth = Math.min(highestMonthWithReadings + 2, 12);
        
        for (let i = 0; i < maxMonth; i++) {
          const monthData = response.data.months[i];
          const hasReadings = monthData && Object.keys(monthData).length > 0;
          const calendarYear = i < 6 ? 2025 : 2026;
          const monthName = new Date(calendarYear, i, 1).toLocaleDateString('en-US', { month: 'long' });
          
          readingMonths.push({
            month: i,
            monthName,
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

  const generateBills = async (month) => {
    try {
      setGenerating(true);
      setError('');
      setMessage('');
      
      if (!selectedDueDate) {
        setError('Please select a due date before generating bills');
        return;
      }
      
      await waterAPI.generateBillsNew(clientId, 2026, month, { dueDate: selectedDueDate });
      
      // Refresh data to show new bills
      await refreshData();
      setMessage('Bills generated successfully!');
    } catch (error) {
      console.error('Error generating bills:', error);
      setError(error.response?.data?.error || 'Failed to generate bills');
    } finally {
      setGenerating(false);
    }
  };

  // Manual refresh function - delegates to parent's refresh handler
  const handleRefresh = async () => {
    console.log(`🔄 [WaterBillsList] Manual refresh triggered - delegating to parent`);
    
    // Notify parent component to handle the full refresh
    if (onRefresh) {
      await onRefresh();
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

  if (contextLoading) {
    return <div className="loading-container">Loading water bills...</div>;
  }

  if (contextError) {
    return <div className="error-message">{contextError}</div>;
  }

  if (!waterData) {
    return <div className="no-data-message">No water billing data available</div>;
  }

  const monthData = waterData.months[selectedMonth];
  const hasBills = hasBillsForMonth(monthData);
  
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
      
      Object.values(monthData.units || {}).forEach(unit => {
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
                {month.monthName} {month.calendarYear}
                {!month.hasReadings ? ' (No readings)' : ''}
              </option>
            ))}
          </select>
        </div>
        
        <div className="due-date-selector">
          <label htmlFor="due-date-select">Due Date:</label>
          {hasBills && monthData?.dueDate ? (
            // Show read-only date when bills are already generated
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
            onClick={() => generateBills(selectedMonth)}
            disabled={hasBills || generating || !selectedDueDate}
            className="btn btn-primary generate-bills-btn"
          >
            {generating ? 'Generating...' : `Generate Bills for ${monthData.monthName}`}
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

      <div className="bills-table-container">
        <table className="bills-table">
          <thead>
            <tr>
              <th className="text-left">Unit</th>
              <th className="text-left">Owner</th>
              <th className="text-right">Usage (m³)</th>
              <th className="text-right">Monthly Charge</th>
              <th className="text-right">Washes</th>
              <th className="text-right">Overdue</th>
              <th className="text-right">Penalties</th>
              <th className="text-right">Due</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(monthData.units).map(([unitId, unit]) => {
              // Find unit to get owner name - will come from backend eventually
              const unitConfig = units.find(u => (u.unitId || u.id) === unitId);
              const ownerName = unitConfig?.ownerLastName || unitConfig?.ownerName || 
                               unit.ownerName || unit.ownerLastName || 'No Name Available';
              
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
              const penalties = unit.displayTotalPenalties || 0;  // Use cumulative penalties
              const overdue = unit.displayOverdue || 0;
              const due = unit.displayTotalDue || 0;  // Use total due amount
              
              
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
                  // TASK 2 ISSUE 4: Allow payment if ANY amount due (includes nobill with overdue)
                  // Michael: "Only need to check the Due amount... If there is amount Due, let them pay it!"
                  setSelectedUnitForPayment(unitId);
                  setShowPaymentModal(true);
                }
              };
              
              // Handle monthly charge click (payment modal)
              const handleMonthlyChargeClick = (e) => {
                e.stopPropagation(); // Prevent row selection
                setSelectedUnitForPayment(unitId);
                setShowPaymentModal(true);
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
                        className={`link-button status-button ${getStatusClass(unit.status || 'unpaid')}`}
                        onClick={handleStatusClick}
                        title={due > 0 ? 
                          `Click to record payment for Unit ${unitId}` : 
                          'No payment needed'
                        }
                      >
                        {(unit.status || 'unpaid').toUpperCase()}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td colSpan="2" className="text-right"><strong>Total</strong></td>
              <td className="text-right"><strong>{formatNumber(monthTotals.consumption)}</strong></td>
              <td className="text-right"><strong>${formatCurrency(monthTotals.billAmount)}</strong></td>
              <td className="text-right"><strong>${monthTotals.washes.toFixed(2)}</strong></td>
              <td className="text-right">
                {monthTotals.penalties > 0 ? (
                  <strong>${formatCurrency(monthTotals.penalties)}</strong>
                ) : (
                  <strong>$0.00</strong>
                )}
              </td>
              <td className="text-right"><strong>${formatCurrency(monthTotals.total)}</strong></td>
              <td className="text-right"><strong>${formatCurrency(monthTotals.paid)}</strong></td>
              <td className="text-right"><strong>${formatCurrency(monthTotals.due)}</strong></td>
              <td className="text-center">-</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bills-summary">
        <div className="summary-item">
          <span className="summary-label">Month Billed:</span>
          <span className="summary-value">${formatCurrency(monthTotals.billAmount)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Month Paid:</span>
          <span className="summary-value paid">${formatCurrency(monthTotals.paid)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Month Due:</span>
          <span className="summary-value unpaid">${formatCurrency(monthTotals.due)}</span>
        </div>
        {monthTotals.penalties > 0 && (
          <div className="summary-item">
            <span className="summary-label">Month Penalties:</span>
            <span className="summary-value overdue">${formatCurrency(monthTotals.penalties)}</span>
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
          refreshData();
        }}
      />
    </div>
  );
};

export default WaterBillsList;