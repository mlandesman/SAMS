import React, { useState, useEffect } from 'react';
import { useHOADues } from '../context/HOADuesContext';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import DuesPaymentModal from '../components/DuesPaymentModal';
import CreditBalanceEditModal from '../components/CreditBalanceEditModal';
import ActivityActionBar from '../components/common/ActivityActionBar';
import { LoadingSpinner } from '../components/common';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { getOwnerInfo } from '../utils/unitUtils';
import { isSuperAdmin, isAdmin } from '../utils/userRoles';
import {
  getFiscalMonthNames,
  getCurrentFiscalMonth,
  calendarToFiscalMonth,
  fiscalToCalendarMonth,
  getFiscalYearLabel,
  getFiscalYear,
  isFiscalYear
} from '../utils/fiscalYearUtils';
import debug from '../utils/debug';
import './HOADuesView.css';

function HOADuesView() {
  console.log('🔴 HOADuesView component rendering');
  
  const { 
    units, 
    duesData, 
    loading, 
    error, 
    selectedYear, 
    setSelectedYear,
    refreshData
  } = useHOADues();
  
  console.log('🔴 HOADuesView - selectedYear from context:', selectedYear);
  
  // Get the client name from ClientContext
  const { selectedClient } = useClient();
  const { samsUser } = useAuth(); // Get user for role checking
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get fiscal year configuration
  const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1;
  
  // DEBUG: Log client configuration
  console.log('HOA Dues View - Selected Client:', selectedClient);
  console.log('HOA Dues View - Fiscal Year Start Month:', fiscalYearStartMonth);
  console.log('HOA Dues View - Selected Year:', selectedYear);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [highlightedUnit, setHighlightedUnit] = useState(null);
  
  // Credit balance edit modal state
  const [showCreditEditModal, setShowCreditEditModal] = useState(false);
  const [creditEditUnitId, setCreditEditUnitId] = useState(null);
  const [creditEditCurrentBalance, setCreditEditCurrentBalance] = useState(0);
  
  // Check for url parameters on component mount or url change
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const unitId = queryParams.get('unitId');
    const year = queryParams.get('year');
    
    // If year is specified, update the selected year
    if (year && !isNaN(Number(year))) {
      setSelectedYear(Number(year));
    }
    
    // If unitId is specified, highlight that unit
    if (unitId) {
      setHighlightedUnit(unitId);
      // Clear the highlight after 3 seconds
      setTimeout(() => {
        setHighlightedUnit(null);
      }, 3000);
    }
  }, [location.search, setSelectedYear]);
  
  // Handle payment cell click - navigate to transaction or open payment modal
  const handlePaymentClick = (unitId, fiscalMonth) => {
    // Special handling for credit row
    if (fiscalMonth === 'credit') {
      // Check if user has permission to edit credit balance
      if (isSuperAdmin(samsUser) || isAdmin(samsUser, selectedClient?.id)) {
        const unitData = duesData[unitId] || {};
        const currentBalance = unitData.creditBalance || 0;
        
        setCreditEditUnitId(unitId);
        setCreditEditCurrentBalance(currentBalance);
        setShowCreditEditModal(true);
      }
      return;
    }
    
    // Get payment data for this cell
    const unit = units.find(u => u.unitId === unitId);
    const paymentStatus = getPaymentStatus(unit, fiscalMonth);
    
    if (paymentStatus.status === 'paid' || paymentStatus.status === 'partial') {
      // Payment exists - check if we have a transaction reference
      if (paymentStatus.transactionId) {
        // Navigate to the transaction
        debug.log(`Navigating to transaction ID: ${paymentStatus.transactionId}`);
        navigate(`/transactions?id=${paymentStatus.transactionId}`);
        
        // Update sidebar activity
        try {
          const event = new CustomEvent('activityChange', { 
            detail: { activity: 'transactions' } 
          });
          window.dispatchEvent(event);
        } catch (error) {
          console.error('Error dispatching activity change event:', error);
        }
      } else {
        // Paid but no transaction reference
        alert('No Matching Transaction Record');
      }
    } else {
      // Not paid - open payment modal
      setSelectedUnitId(unitId);
      setSelectedMonth(fiscalMonth);
      setShowPaymentModal(true);
    }
  };
  
  
  // Open payment modal when clicking "Add Payment" button
  const handleAddPaymentClick = () => {
    // Always open the payment modal without pre-selecting a unit
    setSelectedUnitId(null);
    setSelectedMonth(null);
    setShowPaymentModal(true);
  };
  
  // Close payment modal
  const closePaymentModal = () => {
    setShowPaymentModal(false);
  };

  // Close credit edit modal
  const closeCreditEditModal = () => {
    setShowCreditEditModal(false);
    setCreditEditUnitId(null);
    setCreditEditCurrentBalance(0);
  };

  // Handle credit balance update
  const handleCreditBalanceUpdate = () => {
    // Refresh the dues data to show the updated credit balance
    refreshData();
    closeCreditEditModal();
  };

  // Calculate payment status for a unit in a specific fiscal month
  const getPaymentStatus = (unit, fiscalMonth) => {
    if (!unit || !duesData[unit.unitId]) {
      return { status: 'unpaid', amount: 0, notes: '', transactionId: null };
    }
    
    const unitData = duesData[unit.unitId];
    // The payments array is indexed by fiscal month (0-based)
    const paymentIndex = fiscalMonth - 1; // Convert 1-12 to 0-11
    const payment = unitData.payments?.[paymentIndex];
    const scheduledAmount = unitData.scheduledAmount || 0;
    
    if (!payment || payment.paid === undefined) {
      return { status: 'unpaid', amount: 0, notes: '', transactionId: null };
    }
    
    if (!payment.paid || payment.amount === 0) {
      return { 
        status: 'unpaid', 
        amount: 0, 
        notes: payment.notes || '',
        transactionId: payment.reference || null 
      };
    }
    
    if (payment.amount < scheduledAmount) {
      return { 
        status: 'partial', 
        amount: payment.amount, 
        notes: payment.notes || '',
        transactionId: payment.reference || null 
      };
    }
    
    return { 
      status: 'paid', 
      amount: payment.amount, 
      notes: payment.notes || '',
      transactionId: payment.reference || null 
    };
  };

  // Get CSS class for payment status
  const getPaymentStatusClass = (status, fiscalMonth) => {
    if (status === 'paid') return 'payment-paid';
    if (status === 'partial') return 'payment-partial';
    
    // Get current fiscal month and year for comparison
    const currentFiscalMonth = getCurrentFiscalMonth(new Date(), fiscalYearStartMonth);
    const currentFiscalYear = getFiscalYear(new Date(), fiscalYearStartMonth);
    
    // Compare selected year against current fiscal year
    const selectedYearIsCurrent = selectedYear === currentFiscalYear;
    const isPastYear = selectedYear < currentFiscalYear;
    const isFutureYear = selectedYear > currentFiscalYear;
    
    // If we're viewing current fiscal year and the month is current or past, mark unpaid as late
    if (selectedYearIsCurrent && fiscalMonth <= currentFiscalMonth) return 'payment-late';
    
    // If we're viewing a past fiscal year, all unpaid are late
    if (isPastYear) return 'payment-late';
    
    // Future fiscal years or future months in current fiscal year should not be highlighted as late
    return '';
  };

  // Calculate row totals (by fiscal month)
  const calculateMonthlyTotal = (fiscalMonth) => {
    return units.reduce((total, unit) => {
      const paymentStatus = getPaymentStatus(unit, fiscalMonth);
      return total + paymentStatus.amount;
    }, 0);
  };

  // Calculate unit total paid for the year including both payments and credits
  const calculateUnitTotal = (unitId) => {
    const unitData = duesData[unitId];
    if (!unitData) return 0;
    
    // Sum all payments for the year
    let paymentsTotal = 0;
    if (Array.isArray(unitData.payments)) {
      paymentsTotal = unitData.payments.reduce((total, payment) => {
        // Only sum if payment was made (paid is true) and amount exists
        return total + (payment.paid && payment.amount ? payment.amount : 0);
      }, 0);
    }
    
    // Add credit balance to total paid (credits count as payments received)
    const creditBalance = unitData.creditBalance || 0;
    
    return paymentsTotal + creditBalance;
  };

  // Calculate total amount to be collected (remaining)
  const calculateRemainingToCollect = (fiscalMonth) => {
    const totalDues = units.reduce((total, unit) => total + (duesData[unit.unitId]?.scheduledAmount || 0), 0);
    const totalCollected = calculateMonthlyTotal(fiscalMonth);
    return totalDues - totalCollected;
  };

  // Calculate grand totals
  const calculateGrandTotal = () => {
    return units.reduce((total, unit) => total + calculateUnitTotal(unit.unitId), 0);
  };

  // Calculate credit balance total
  const calculateTotalCredit = () => {
    return units.reduce((total, unit) => {
      const unitData = duesData[unit.unitId];
      return total + (unitData ? unitData.creditBalance || 0 : 0);
    }, 0);
  };

  if (loading) return <LoadingSpinner variant="logo" message="Loading HOA dues data..." size="medium" />;
  if (error) return <div className="error-container">Error: {error}</div>;
  
  // Ensure we have both units and dues data before rendering
  if (!units || units.length === 0 || !duesData || Object.keys(duesData).length === 0) {
    return <LoadingSpinner variant="logo" message="Loading HOA dues data..." size="medium" />;
  }

  // Format number with commas
  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  return (
    <div className="hoa-dues-view">
      <ActivityActionBar>
        {/* Only SuperAdmin can add HOA dues payments */}
        {isSuperAdmin(samsUser) && (
          <button className="action-item" onClick={handleAddPaymentClick}>
            <FontAwesomeIcon icon={faPlus} />
            <span>Add Payment</span>
          </button>
        )}
        <div className="year-navigation">
          <button className="year-nav-button" onClick={() => setSelectedYear(prev => prev - 1)}>
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <button className="year-nav-button" onClick={() => setSelectedYear(prev => prev + 1)}>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </ActivityActionBar>
      
      <div className="hoa-dues-table-container">
        <table className="hoa-dues-table">
          <thead>
            {/* Header row with owner (unit) */}
            <tr className="unit-header-row">
              <th className="month-header">
                <div className="year-display-container">
                  {isFiscalYear(fiscalYearStartMonth) && (
                    <span className="fiscal-year-indicator">FY</span>
                  )}
                  <div className="year-display">
                    {selectedYear}
                  </div>
                </div>
              </th>
              {units.map(unit => {
                // Get owner info using the utility function
                const { lastName } = getOwnerInfo(unit);
                
                return (
                  <th 
                    key={unit.unitId} 
                    className={`unit-header ${highlightedUnit === unit.unitId ? 'highlighted-unit' : ''}`}
                  >
                    <div className="unit-name-cell">{unit.owner}</div>
                    <div className="unit-id-cell">{unit.unitId}</div>
                    <div className="owner-lastname-cell">{lastName}</div>
                  </th>
                );
              })}
              <th className="total-header">Total Paid</th>
              <th className="remaining-header">To Be Collected</th>
            </tr>
            
            {/* Subheader row with scheduled amounts */}
            <tr className="owner-header-row">
              <th className="dues-label">Dues</th>
              {units.map(unit => (
                <th key={`dues-${unit.unitId}`} className="owner-header">
                  <div className="scheduled-amount">${formatNumber(duesData[unit.unitId]?.scheduledAmount || 0)}</div>
                </th>
              ))}
              <th className="total-scheduled-header">
                <div className="total-scheduled-amount">
                  ${formatNumber(units.reduce((total, unit) => total + (duesData[unit.unitId]?.scheduledAmount || 0), 0))}
                </div>
              </th>
              <th className="remaining-scheduled-header">
              </th>
            </tr>
          </thead>
          
          <tbody>
            {/* Credit row */}
            <tr className="credit-row">
              <td className="row-label">Credit</td>
              {units.map(unit => {
                const unitData = duesData[unit.unitId] || {};
                const hasCreditHistory = unitData.creditBalanceHistory && unitData.creditBalanceHistory.length > 0;
                const canEditCredit = isSuperAdmin(samsUser) || isAdmin(samsUser, selectedClient?.id);
                return (
                  <td 
                    key={`credit-${unit.unitId}`}
                    className={`credit-cell ${highlightedUnit === unit.unitId ? 'highlighted-unit' : ''} ${(unitData.creditBalance || 0) < 0 ? 'negative-credit' : ''} ${hasCreditHistory ? 'has-credit-history' : ''} ${canEditCredit ? 'editable' : ''}`}
                    onClick={() => handlePaymentClick(unit.unitId, 'credit')}
                    title={(() => {
                      // Generate tooltip from credit balance history array
                      let tooltip = `Credit Balance: $${formatNumber((unitData.creditBalance || 0))}`;
                      
                      if (canEditCredit) {
                        tooltip += '\n\nClick to edit credit balance';
                      }
                      
                      if (hasCreditHistory) {
                        tooltip += '\n\nHistory:\n';
                        unitData.creditBalanceHistory.forEach(entry => {
                          // Handle Firestore timestamp objects
                          const timestamp = entry.timestamp;
                          const dateStr = timestamp?.display || timestamp?.displayFull || 'Unknown Date';
                          const typeLabel = entry.type.replace(/_/g, ' ').toUpperCase();
                          tooltip += `${typeLabel}: ${entry.amount} on ${dateStr}`;
                          if (entry.description) tooltip += ` ${entry.description}`;
                          tooltip += '\n';
                        });
                      }
                      
                      return tooltip;
                    })()}
                    style={{
                      backgroundColor: (unitData.creditBalance || 0) < 0 ? '#ffebee' : 'inherit',
                      color: (unitData.creditBalance || 0) < 0 ? '#d32f2f' : 'inherit',
                      fontWeight: (unitData.creditBalance || 0) < 0 ? 'bold' : 'normal'
                    }}
                  >
                    ${formatNumber((unitData.creditBalance || 0))}
                    {(unitData.creditBalance || 0) < 0 && ' ⚠️'}
                  </td>
                );
              })}
              <td className="total-cell">${formatNumber(calculateTotalCredit())}</td>
              <td></td>
            </tr>
            
            {/* Monthly payment rows */}
            {getFiscalMonthNames(fiscalYearStartMonth, { short: true }).map((monthName, index) => {
              const fiscalMonth = index + 1; // Fiscal month 1-12
              const calendarMonth = fiscalToCalendarMonth(fiscalMonth, fiscalYearStartMonth);
              
              // Format month label with correct year
              let displayYear = selectedYear;
              // For fiscal years, if the calendar month is before the start month, it's in the fiscal year
              if (fiscalYearStartMonth > 1 && calendarMonth < fiscalYearStartMonth) {
                displayYear = selectedYear; // For FY named by ending year
              } else if (fiscalYearStartMonth > 1) {
                displayYear = selectedYear - 1; // For FY named by ending year
              }
              const monthLabel = `${monthName}-${displayYear}`;
              
              // Calculate monthly totals
              const monthlyTotal = calculateMonthlyTotal(fiscalMonth);
              
              // Only calculate remaining to collect for current/past months
              let remainingToCollect = null;
              
              // Get current fiscal month for comparison
              const currentFiscalMonth = getCurrentFiscalMonth(new Date(), fiscalYearStartMonth);
              const currentFiscalYear = getFiscalYear(new Date(), fiscalYearStartMonth);
              
              // For current fiscal year
              if (selectedYear === currentFiscalYear) {
                if (fiscalMonth <= currentFiscalMonth) {
                  remainingToCollect = calculateRemainingToCollect(fiscalMonth);
                }
              } 
              // For past fiscal years, all months should show remaining
              else if (selectedYear < currentFiscalYear) {
                remainingToCollect = calculateRemainingToCollect(fiscalMonth);
              }
              
              // Determine month styling based on selected year and current date
              let monthClass = 'future-month';
              
              // For current fiscal year, compare to current fiscal month
              if (selectedYear === currentFiscalYear) {
                monthClass = fiscalMonth > currentFiscalMonth ? 'future-month' : 'current-month';
              } 
              // Past fiscal years should all show as current (past) months
              else if (selectedYear < currentFiscalYear) {
                monthClass = 'current-month';
              }
              // Future fiscal years should all show as future months
              else {
                monthClass = 'future-month';
              }
              
              return (
                <tr key={`month-${fiscalMonth}`} className="month-row">
                  <td className={`row-label ${monthClass}`}>{monthLabel}</td>
                  {units.map(unit => {
                    const paymentStatus = getPaymentStatus(unit, fiscalMonth);
                    const hasNotes = paymentStatus.notes && paymentStatus.notes.length > 0;
                    
                    return (
                      <td 
                        key={`payment-${unit.unitId}-${fiscalMonth}`}
                        className={`payment-cell ${getPaymentStatusClass(paymentStatus.status, fiscalMonth)} ${paymentStatus.transactionId ? 'has-transaction' : ''} ${highlightedUnit === unit.unitId ? 'highlighted-unit' : ''}`}
                        onClick={() => handlePaymentClick(unit.unitId, fiscalMonth)}
                        title={hasNotes ? paymentStatus.notes : ''}
                      >
                        {paymentStatus.amount > 0 ? (
                          <span className="payment-amount">${formatNumber(paymentStatus.amount)}</span>
                        ) : ''}
                      </td>
                    );
                  })}
                  <td className="total-cell">${formatNumber(monthlyTotal)}</td>
                  <td className="remaining-cell">
                    {remainingToCollect !== null ? `$${formatNumber(remainingToCollect)}` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
          
          <tfoot>
            {/* Total row */}
            <tr className="totals-row">
              <td className="totals-label">Total Paid</td>
              {units.map(unit => (
                <td key={`total-${unit.unitId}`} className="unit-total">
                  ${formatNumber(calculateUnitTotal(unit.unitId))}
                </td>
              ))}
              <td className="grand-total">
                ${formatNumber(calculateGrandTotal())}
              </td>
              <td className="grand-remaining">
                ${formatNumber(units.reduce((total, unit) => total + (duesData[unit.unitId]?.scheduledAmount || 0) * 12, 0) - calculateGrandTotal())}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div className="hoa-dues-legend">
        <div className="legend-item">
          <div className="legend-color payment-paid"></div>
          <div className="legend-text">Paid in Full</div>
        </div>
        <div className="legend-item">
          <div className="legend-color payment-partial"></div>
          <div className="legend-text">Partial Payment</div>
        </div>
        <div className="legend-item">
          <div className="legend-color payment-late"></div>
          <div className="legend-text">Late Payment</div>
        </div>
        <div className="legend-item">
          <div className="legend-color row-label current-month"></div>
          <div className="legend-text">Current Month</div>
        </div>
        <div className="legend-item">
          <div className="legend-color"></div>
          <div className="legend-text">Hover to read payment notes</div>
        </div>
      </div>
      
      {/* Unit selector modal has been removed - now integrated into the payment modal */}
      
      {/* Add Payment Modal */}
      <DuesPaymentModal 
        isOpen={showPaymentModal}
        onClose={closePaymentModal}
        unitId={selectedUnitId}
        monthIndex={selectedMonth}
      />
      
      {/* Credit Balance Edit Modal */}
      <CreditBalanceEditModal
        isOpen={showCreditEditModal}
        onClose={closeCreditEditModal}
        unitId={creditEditUnitId}
        currentBalance={creditEditCurrentBalance}
        year={selectedYear}
        onUpdate={handleCreditBalanceUpdate}
      />
    </div>
  );
}

export default HOADuesView;
