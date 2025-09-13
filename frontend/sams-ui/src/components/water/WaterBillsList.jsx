import React, { useState, useEffect } from 'react';
import { useClient } from '../../context/ClientContext';
import { useNavigate } from 'react-router-dom';
import waterAPI from '../../api/waterAPI';
import WaterPaymentModal from './WaterPaymentModal';
import './WaterBillsList.css';

const WaterBillsList = ({ clientId, onBillSelection, selectedBill, onRefresh }) => {
  // TEMPORARY: Phase 1 - Single month display only
  // TODO: Phase 2 will add cross-month aggregation
  const ENABLE_AGGREGATION = false;  // Will be enabled in Phase 2
  
  const { selectedClient } = useClient();
  const navigate = useNavigate();
  const [yearData, setYearData] = useState(null);
  const [billingConfig, setBillingConfig] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(0); // Start with July (month 0)
  const [selectedDueDate, setSelectedDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedUnitForPayment, setSelectedUnitForPayment] = useState(null);
  
  // Cache refresh key to force re-fetch when needed
  const [refreshKey, setRefreshKey] = useState(0);

  // Get units from client configuration
  const units = selectedClient?.configuration?.units || [];

  useEffect(() => {
    if (clientId) {
      fetchYearData();
      fetchBillingConfig();
    }
  }, [clientId, refreshKey]);

  const fetchYearData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await waterAPI.getAggregatedData(clientId, 2026);
      console.log('Aggregated data received:', response);
      setYearData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching water data:', error);
      setError('Failed to load water bills data');
      setLoading(false);
    }
  };

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
      await fetchYearData();
      setMessage('Bills generated successfully!');
    } catch (error) {
      console.error('Error generating bills:', error);
      setError(error.response?.data?.error || 'Failed to generate bills');
    } finally {
      setGenerating(false);
    }
  };

  // Manual refresh function for user-triggered cache clearing
  const handleRefresh = async () => {
    console.log(`🔄 [WaterBillsList] Manual refresh triggered`);
    setYearData(null);
    setError('');
    setMessage('Clearing cache and refreshing data...');
    
    try {
      // Clear the backend cache first to force fresh penalty recalculation
      await waterAPI.clearCache(clientId);
      console.log(`✅ [WaterBillsList] Cache cleared for client ${clientId}`);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
    
    setRefreshKey(prev => prev + 1);
    
    // Notify parent component about refresh
    if (onRefresh) {
      onRefresh();
    }
    
    // The useEffect will trigger fetchYearData due to refreshKey change
    // Clear the message after a short delay
    setTimeout(() => setMessage(''), 2000);
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

  if (loading) {
    return <div className="loading-container">Loading water bills...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!yearData) {
    return <div className="no-data-message">No water billing data available</div>;
  }

  const monthData = yearData.months[selectedMonth];
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
      let monthPenalties = 0;
      
      Object.values(monthData.units || {}).forEach(unit => {
        const monthlyCharge = unit.billAmount || 0;
        const penalties = unit.penaltyAmount || 0;
        const total = unit.totalAmount || (monthlyCharge + penalties);
        const paid = unit.paidAmount || 0;
        
        monthConsumption += unit.consumption || 0;
        monthCharges += monthlyCharge;
        monthPenalties += penalties;
        monthTotal += total;
        monthPaid += paid;
      });
      
      return {
        consumption: monthConsumption,
        billAmount: monthCharges,
        penalties: monthPenalties,
        total: monthTotal,
        paid: monthPaid,
        due: monthTotal - monthPaid
      };
    } else {
      // Phase 2: Will implement full aggregation
      // Placeholder for Phase 2 implementation
      return { consumption: 0, billAmount: 0, penalties: 0, total: 0, paid: 0, due: 0 };
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
            {yearData.months.map((month, idx) => (
              <option key={idx} value={idx}>
                {month.monthName} {month.calendarYear}
              </option>
            ))}
          </select>
        </div>
        
        <div className="due-date-selector">
          <label htmlFor="due-date-select">Due Date:</label>
          <input 
            type="date" 
            id="due-date-select"
            value={selectedDueDate}
            onChange={(e) => setSelectedDueDate(e.target.value)}
            className="due-date-input"
            required
          />
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

      <div className="bills-table-container">
        <table className="bills-table">
          <thead>
            <tr>
              <th className="text-left">Unit</th>
              <th className="text-left">Owner</th>
              <th className="text-right">Usage (m³)</th>
              <th className="text-right">Monthly Charge</th>
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
              const penalties = unit.penaltyAmount || 0;   // Penalties from previous months
              const overdue = unit.previousBalance || 0;   // Overdue amounts from previous months
              const due = monthlyCharge + overdue + penalties;  // Total amount to clear account
              
              
              // Create bill object for selection/transaction linking
              const billData = {
                unitId,
                period: monthData.monthName + ' ' + monthData.calendarYear,
                monthlyCharge,
                penalties,
                due,
                status: unit.status || 'unpaid',
                transactionId: unit.transactionId || null, // Transaction ID for linking
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
                
                
                if (unit.status === 'paid' && unit.transactionId) {
                  // Navigate to transaction (following HOA Dues pattern exactly)
                  console.log(`💳 Navigating to transaction ID: ${unit.transactionId}`);
                  navigate(`/transactions?id=${unit.transactionId}`);
                  
                  // Update sidebar activity
                  try {
                    const event = new CustomEvent('activityChange', { 
                      detail: { activity: 'transactions' } 
                    });
                    window.dispatchEvent(event);
                  } catch (error) {
                    console.error('Error dispatching activity change event:', error);
                  }
                } else if (unit.status === 'paid' && !unit.transactionId) {
                  alert('No Matching Transaction Record');
                } else if (unit.status === 'unpaid' || unit.status === 'partial') {
                  // Open payment modal for unpaid/partial bills (more intuitive UX)
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
                        title={unit.status === 'unpaid' || unit.status === 'partial' ? 
                          `Click to record payment for Unit ${unitId}` : 
                          'No action available'
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
        onSuccess={() => {
          // Refresh bills data to show updated payment status
          fetchYearData();
          console.log('✅ Payment recorded - refreshing bill data');
        }}
      />
    </div>
  );
};

export default WaterBillsList;