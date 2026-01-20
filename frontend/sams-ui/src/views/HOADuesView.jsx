import React, { useState, useEffect } from 'react';
import { useHOADues } from '../context/HOADuesContext';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import CreditBalanceEditModal from '../components/CreditBalanceEditModal';
import CreditBalanceHistoryModal from '../components/CreditBalanceHistoryModal';
import CreditBalanceAddModal from '../components/CreditBalanceAddModal';
import CreditBalanceRemoveModal from '../components/CreditBalanceRemoveModal';
import ActivityActionBar from '../components/common/ActivityActionBar';
import { LoadingSpinner } from '../components/common';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { getOwnerInfo } from '../utils/unitUtils';
import { isSuperAdmin, isAdmin } from '../utils/userRoles';
import { getFirstOwnerName } from '../utils/unitContactUtils.js';
import {
  getFiscalMonthNames,
  getCurrentFiscalMonth,
  calendarToFiscalMonth,
  fiscalToCalendarMonth,
  getFiscalYearLabel,
  getFiscalYear,
  isFiscalYear
} from '../utils/fiscalYearUtils';
import { getMexicoDate } from '../utils/timezone';
import { formatAsMXN } from '../utils/hoaDuesUtils';
import { centavosToPesos } from '../utils/currencyUtils';
import debug from '../utils/debug';
import ContextMenu from '../components/ContextMenu';
import PaymentDetailsModal from '../components/PaymentDetailsModal';
import './HOADuesView.css';

function HOADuesView() {
  console.log('🔴 HOADuesView component rendering');
  
  const { 
    units, 
    unitsWithOwners,
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
  
  // Get dues frequency configuration (monthly or quarterly)
  const duesFrequency = selectedClient?.feeStructure?.duesFrequency || 'monthly';
  
  // DEBUG: Log client configuration
  console.log('HOA Dues View - Selected Client:', selectedClient);
  console.log('HOA Dues View - Fiscal Year Start Month:', fiscalYearStartMonth);
  console.log('HOA Dues View - Dues Frequency:', duesFrequency);
  console.log('HOA Dues View - Selected Year:', selectedYear);
  
  // Note: selectedUnitId and selectedMonth kept for context menu navigation
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [highlightedUnit, setHighlightedUnit] = useState(null);
  
  // Credit balance edit modal state
  const [showCreditEditModal, setShowCreditEditModal] = useState(false);
  const [creditEditUnitId, setCreditEditUnitId] = useState(null);
  const [creditEditCurrentBalance, setCreditEditCurrentBalance] = useState(0);
  
  // Credit balance modals state
  const [showCreditHistoryModal, setShowCreditHistoryModal] = useState(false);
  const [showCreditAddModal, setShowCreditAddModal] = useState(false);
  const [showCreditRemoveModal, setShowCreditRemoveModal] = useState(false);
  const [creditModalUnitId, setCreditModalUnitId] = useState(null);
  const [creditModalBalance, setCreditModalBalance] = useState(0);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    type: null, // 'payment' or 'credit'
    data: null
  });
  
  // Details modal state
  const [detailsModal, setDetailsModal] = useState({
    isOpen: false,
    data: null
  });
  
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
      // Not paid - navigate to Transactions and open unified payment modal
      console.log(`💳 Opening unified payment modal for unit ${unitId}, month ${fiscalMonth}`);
      navigate('/transactions', { 
        state: { 
          openUnifiedPayment: true, 
          unitId,
          monthIndex: fiscalMonth
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
  
  // ============================================
  // CONTEXT MENU HANDLERS & HELPERS
  // ============================================
  
  /**
   * Normalize notes to string format for display/parsing
   * Handles both legacy string format and new array format
   * @param {string|Array} notes - Notes in either format
   * @returns {string} Notes as a string
   */
  const getNotesAsString = (notes) => {
    if (!notes) return '';
    if (typeof notes === 'string') return notes;
    if (Array.isArray(notes)) {
      return notes.map(n => n.text || n.note || (typeof n === 'string' ? n : '')).join(' | ');
    }
    return '';
  };
  
  // Helper to extract date/time from payment notes (format: "Nov 8, 2025 at 9:17am")
  const extractDateTimeFromPayment = (paymentData) => {
    if (!paymentData || !paymentData.notes) return null;
    
    // Handle both string and array notes format
    const notesText = getNotesAsString(paymentData.notes);
    
    // Extract transaction ID which contains date and time (2025-11-08_091704_278)
    const match = notesText.match(/(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(\d{2})_\d+/);
    if (!match) return null;
    
    const [, date, hour, minute] = match;
    
    // Format as "Nov 8, 2025 at 9:17am"
    const dateObj = new Date(date);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();
    
    // Convert to 12-hour format
    const hourNum = parseInt(hour);
    const ampm = hourNum >= 12 ? 'pm' : 'am';
    const hour12 = hourNum % 12 || 12;
    
    return `${monthName} ${day}, ${year} at ${hour12}:${minute}${ampm}`;
  };
  
  // Helper to extract payment method from notes
  const extractMethodFromNotes = (notes) => {
    if (!notes) return null;
    const notesText = getNotesAsString(notes);
    const match = notesText.match(/Payment:\s*(\w+)/i);
    return match ? match[1] : null;
  };
  
  // Handle payment cell context menu (right-click)
  const handlePaymentContextMenu = (e, unitId, fiscalMonth, quarterData) => {
    e.preventDefault();
    e.stopPropagation();
    
    const unit = units.find(u => u.unitId === unitId);
    const quarterStatus = quarterData || getPaymentStatus(unit, fiscalMonth);
    const transactionId = quarterData?.months?.find(m => m.transactionId)?.transactionId || quarterStatus.transactionId;
    
    const options = [
      {
        label: 'Make Payment',
        icon: '💳',
        onClick: () => handlePaymentClick(unitId, fiscalMonth)
      }
    ];
    
    if (transactionId) {
      options.push({
        label: 'View Details',
        icon: '📋',
        onClick: () => {
          // Get date/time for modal
          const paymentMonth = quarterData?.months?.find(m => m.notes) || quarterStatus;
          const dateTime = extractDateTimeFromPayment(paymentMonth);
          
          // Calculate total penalties from month data (convert centavos to pesos)
          let totalPenaltiesPaid = 0;
          if (quarterData) {
            totalPenaltiesPaid = quarterData.months.reduce((sum, m) => {
              const unit = units.find(u => u.unitId === unitId);
              const unitData = duesData[unit.unitId];
              const paymentIndex = m.fiscalMonth - 1;
              const payment = unitData?.payments?.[paymentIndex];
              return sum + centavosToPesos(payment?.penaltyPaid || 0);
            }, 0);
          }
          
          // Calculate actual amounts paid
          // quarterStatus.totalPaid is just the base payments (without penalties)
          // We need to add penalties to get the actual total paid
          const basePaidAmount = quarterData?.totalPaid || quarterStatus.amount;
          const totalPaidAmount = basePaidAmount + totalPenaltiesPaid;
          const totalDueAmount = quarterData?.totalDue || quarterStatus.amount; // Base charge only
          
          setDetailsModal({
            isOpen: true,
            data: {
              unitId,
              period: quarterData ? `Q${quarterData.quarterIndex + 1}` : `Month ${fiscalMonth}`,
              isQuarter: !!quarterData,
              quarter: quarterData ? `Q${quarterData.quarterIndex + 1}` : null,
              month: !quarterData ? fiscalMonth : null,
              totalDue: totalDueAmount,
              baseCharge: totalDueAmount, // Base charge = total due (without penalties)
              penalties: totalPenaltiesPaid,
              totalPaid: totalPaidAmount, // Base + Penalties
              remaining: quarterData?.remaining || 0,
              status: quarterData?.status || quarterStatus.status,
              transactionId,
              paymentDate: dateTime,
              paymentMethod: extractMethodFromNotes(quarterStatus.notes || paymentMonth?.notes),
              notes: quarterStatus.notes || paymentMonth?.notes,
              months: quarterData?.months || []
            }
          });
        }
      });
      
      options.push({
        label: 'Go to Transaction',
        icon: '🔗',
        onClick: () => {
          navigate(`/transactions?search=${transactionId}`);
        }
      });
    }
    
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      type: 'payment',
      data: { unitId, fiscalMonth, quarterData },
      options
    });
  };
  
  // Handle credit cell context menu (right-click)
  const handleCreditContextMenu = (e, unitId, creditBalance) => {
    e.preventDefault();
    e.stopPropagation();
    
    const canEditCredit = isSuperAdmin(samsUser) || isAdmin(samsUser, selectedClient?.id);
    
    const options = [];
    
    if (canEditCredit) {
      options.push({
        label: 'Edit Balance',
        icon: '✏️',
        onClick: () => {
          setCreditEditUnitId(unitId);
          setCreditEditCurrentBalance(creditBalance);
          setShowCreditEditModal(true);
        }
      });
      options.push({ type: 'divider' });
    }
    
    options.push({
      label: 'View History',
      icon: '📋',
      onClick: () => {
        setCreditModalUnitId(unitId);
        setCreditModalBalance(creditBalance);
        setShowCreditHistoryModal(true);
      }
    });
    
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      type: 'credit',
      data: { unitId, creditBalance },
      options
    });
  };
  
  // Close context menu
  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      type: null,
      data: null,
      options: []
    });
  };
  
  
  // Open unified payment modal when clicking "Add Payment" button
  // Navigates to Transactions view which hosts the UnifiedPaymentModal
  const handleAddPaymentClick = () => {
    navigate('/transactions', { 
      state: { 
        openUnifiedPayment: true,
        unitId: null,  // No pre-selection
        monthIndex: null
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

  // Close credit edit modal
  const closeCreditEditModal = () => {
    setShowCreditEditModal(false);
    setCreditEditUnitId(null);
    setCreditEditCurrentBalance(0);
  };

  // Handle credit balance update
  const handleCreditBalanceUpdate = async () => {
    // Refresh the dues data to show the updated credit balance
    await refreshData();
    closeCreditEditModal();
  };

  // Get credit balance history for a unit
  const getCreditBalanceHistory = (unitId) => {
    const unitData = duesData[unitId];
    return unitData?.creditBalanceHistory || [];
  };

  // Close credit modals
  const closeCreditModals = () => {
    setShowCreditHistoryModal(false);
    setShowCreditAddModal(false);
    setShowCreditRemoveModal(false);
    setCreditModalUnitId(null);
    setCreditModalBalance(0);
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
    const today = getMexicoDate();
    const currentFiscalMonth = getCurrentFiscalMonth(today, fiscalYearStartMonth);
    const currentFiscalYear = getFiscalYear(today, fiscalYearStartMonth);
    
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

  // ============================================
  // DISPLAY AGGREGATION FUNCTIONS
  // These functions aggregate backend-provided values for UI display
  // All underlying data comes from backend - no financial calculations
  // ============================================

  // Calculate row totals (by fiscal month) - Sum backend payment amounts for display
  const calculateMonthlyTotal = (fiscalMonth) => {
    return units.reduce((total, unit) => {
      const paymentStatus = getPaymentStatus(unit, fiscalMonth);
      return total + paymentStatus.amount;
    }, 0);
  };

  // Get unit total paid - Direct backend value
  const calculateUnitTotal = (unitId) => {
    const unitData = duesData[unitId];
    // Backend provides totalPaid (includes credit balance)
    return unitData?.totalPaid || 0;
  };

  // Calculate remaining to collect for a specific month - Sum backend values
  const calculateRemainingToCollect = (fiscalMonth) => {
    const totalDues = units.reduce((total, unit) => total + (duesData[unit.unitId]?.scheduledAmount || 0), 0);
    const totalCollected = calculateMonthlyTotal(fiscalMonth);
    return totalDues - totalCollected;
  };

  // Calculate grand total - Sum backend totalPaid values
  const calculateGrandTotal = () => {
    return units.reduce((total, unit) => total + calculateUnitTotal(unit.unitId), 0);
  };

  // Calculate total credit - Sum backend creditBalance values
  const calculateTotalCredit = () => {
    return units.reduce((total, unit) => {
      const unitData = duesData[unit.unitId];
      return total + (unitData?.creditBalance || 0);
    }, 0);
  };

  // ============================================
  // QUARTERLY DISPLAY FUNCTIONS
  // These aggregate backend payment values for quarterly view
  // ============================================
  
  /**
   * Group monthly dues data into quarters
   * Returns array of 4 quarters with aggregated payment data
   */
  const groupByQuarter = () => {
    // Generate month names for each quarter based on fiscal year start
    const monthNames = getFiscalMonthNames(fiscalYearStartMonth, { short: true });
    
    const quarters = [
      { 
        id: 'Q1', 
        name: `Q1 (${monthNames[0]}/${monthNames[1]}/${monthNames[2]})`, 
        months: [1, 2, 3], // Fiscal months 1-3
        expanded: false 
      },
      { 
        id: 'Q2', 
        name: `Q2 (${monthNames[3]}/${monthNames[4]}/${monthNames[5]})`, 
        months: [4, 5, 6], // Fiscal months 4-6
        expanded: false 
      },
      { 
        id: 'Q3', 
        name: `Q3 (${monthNames[6]}/${monthNames[7]}/${monthNames[8]})`, 
        months: [7, 8, 9], // Fiscal months 7-9
        expanded: false 
      },
      { 
        id: 'Q4', 
        name: `Q4 (${monthNames[9]}/${monthNames[10]}/${monthNames[11]})`, 
        months: [10, 11, 12], // Fiscal months 10-12
        expanded: false 
      }
    ];
    
    return quarters;
  };

  /**
   * Calculate quarter payment totals and status for a unit
   * Aggregates backend payment values for quarterly display
   * @param {Object} unit - Unit object
   * @param {Array} fiscalMonths - Array of fiscal month numbers in quarter (e.g., [1,2,3])
   * @returns {Object} Quarter payment data (all amounts from backend)
   */
  const getQuarterPaymentStatus = (unit, fiscalMonths) => {
    if (!unit || !duesData[unit.unitId]) {
      return { 
        totalDue: 0, 
        totalPaid: 0, 
        remaining: 0, 
        status: 'unpaid',
        percentPaid: 0,
        months: []
      };
    }
    
    const unitData = duesData[unit.unitId];
    const scheduledAmount = unitData.scheduledAmount || 0;
    const totalDue = scheduledAmount * 3; // 3 months per quarter
    
    let totalPaid = 0;
    const monthsData = [];
    
    fiscalMonths.forEach(fiscalMonth => {
      const paymentStatus = getPaymentStatus(unit, fiscalMonth);
      const paymentIndex = fiscalMonth - 1;
      const payment = unitData.payments?.[paymentIndex];
      
      totalPaid += paymentStatus.amount;
      monthsData.push({
        fiscalMonth,
        ...paymentStatus,
        penaltyPaid: payment?.penaltyPaid || 0  // Add penalty data explicitly
      });
    });
    
    const remaining = totalDue - totalPaid;
    const percentPaid = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;
    
    let status = 'unpaid';
    if (totalPaid >= totalDue) {
      status = 'paid';
    } else if (totalPaid > 0) {
      status = 'partial';
    }
    
    return {
      totalDue,
      totalPaid,
      remaining,
      status,
      percentPaid,
      months: monthsData
    };
  };

  /**
   * Calculate quarter totals across all units
   * Sums backend payment values for quarterly display
   * @param {Array} fiscalMonths - Array of fiscal month numbers
   * @returns {number} Total collected for quarter (from backend)
   */
  const calculateQuarterTotal = (fiscalMonths) => {
    return units.reduce((total, unit) => {
      const quarterStatus = getQuarterPaymentStatus(unit, fiscalMonths);
      return total + quarterStatus.totalPaid;
    }, 0);
  };

  /**
   * Calculate remaining to collect for quarter
   * Sums backend due/paid values for quarterly display
   * @param {Array} fiscalMonths - Array of fiscal month numbers
   * @returns {number} Total remaining for quarter (from backend)
   */
  const calculateQuarterRemaining = (fiscalMonths) => {
    return units.reduce((total, unit) => {
      const quarterStatus = getQuarterPaymentStatus(unit, fiscalMonths);
      return total + quarterStatus.remaining;
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

  // Format credit history for tooltip display
  const formatCreditHistoryTooltip = (creditHistory, currentBalance) => {
    let tooltip = `Credit Balance: ${formatAsMXN(currentBalance || 0)}`;
    
    if (!creditHistory || creditHistory.length === 0) {
      return tooltip;
    }
    
    // Show last 5 entries, most recent first
    const recentHistory = creditHistory
      .slice(-5)
      .reverse();
    
    if (recentHistory.length > 0) {
      tooltip += '\n\nRecent History:';
      
      recentHistory.forEach(entry => {
        // Handle various timestamp formats
        let dateStr = 'Unknown Date';
        if (entry.timestamp) {
          // Check for nested display object (backend formatted structure)
          if (entry.timestamp.display && typeof entry.timestamp.display === 'object') {
            // Backend returns formatted timestamp with nested display object
            if (entry.timestamp.display.display && typeof entry.timestamp.display.display === 'string') {
              dateStr = entry.timestamp.display.display;
            } else if (entry.timestamp.display.displayFull && typeof entry.timestamp.display.displayFull === 'string') {
              dateStr = entry.timestamp.display.displayFull;
            } else if (entry.timestamp.display.iso && typeof entry.timestamp.display.iso === 'string') {
              try {
                const date = new Date(entry.timestamp.display.iso);
                dateStr = date.toLocaleDateString();
              } catch (e) {
                dateStr = 'Invalid Date';
              }
            }
          } else if (entry.timestamp.displayFull && typeof entry.timestamp.displayFull === 'object') {
            // Check displayFull object
            if (entry.timestamp.displayFull.display && typeof entry.timestamp.displayFull.display === 'string') {
              dateStr = entry.timestamp.displayFull.display;
            } else if (entry.timestamp.displayFull.iso && typeof entry.timestamp.displayFull.iso === 'string') {
              try {
                const date = new Date(entry.timestamp.displayFull.iso);
                dateStr = date.toLocaleDateString();
              } catch (e) {
                dateStr = 'Invalid Date';
              }
            }
          } else if (typeof entry.timestamp.display === 'string') {
            // Direct string display
            dateStr = entry.timestamp.display;
          } else if (typeof entry.timestamp.displayFull === 'string') {
            // Direct string displayFull
            dateStr = entry.timestamp.displayFull;
          } else if (entry.timestamp.toDate) {
            // Firestore timestamp object
            try {
              const date = entry.timestamp.toDate();
              dateStr = date.toLocaleDateString();
            } catch (e) {
              dateStr = 'Invalid Date';
            }
          } else if (entry.timestamp._seconds) {
            // Firestore timestamp as plain object
            try {
              const date = new Date(entry.timestamp._seconds * 1000);
              dateStr = date.toLocaleDateString();
            } catch (e) {
              dateStr = 'Invalid Date';
            }
          } else if (typeof entry.timestamp === 'string') {
            try {
              dateStr = new Date(entry.timestamp).toLocaleDateString();
            } catch (e) {
              dateStr = entry.timestamp; // Use as-is if parsing fails
            }
          }
        } else if (entry.date) {
          try {
            dateStr = new Date(entry.date).toLocaleDateString();
          } catch (e) {
            dateStr = 'Invalid Date';
          }
        }
        
        // Format the entry type (remove underscores, capitalize)
        let typeLabel = String(entry.type || 'UNKNOWN');
        
        // Check if the type contains "[object Object]" corruption
        if (typeLabel.includes('[object Object]')) {
          // Try to extract meaningful part or use default
          if (entry.description && typeof entry.description === 'string' && !entry.description.includes('[object Object]')) {
            typeLabel = 'Credit Change';
          } else {
            typeLabel = 'Credit Change';
          }
        } else {
          // Normal formatting
          typeLabel = typeLabel
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
        
        // Handle amount formatting (convert from centavos if needed)
        let displayAmount = entry.amount || 0;
        // If amount appears to be in centavos (large integer), convert to pesos
        if (Number.isInteger(displayAmount) && Math.abs(displayAmount) > 100) {
          displayAmount = displayAmount / 100;
        }
        const amount = formatAsMXN(displayAmount);
        
        // Build the history line
        let historyLine = `${dateStr}: ${typeLabel} ${amount}`;
        
        // Add description if available (avoid showing [object Object])
        if (entry.description) {
          let descStr = typeof entry.description === 'string' 
            ? entry.description 
            : JSON.stringify(entry.description);
          
          // Clean up corrupted descriptions
          if (descStr.includes('[object Object]')) {
            // Try to extract meaningful information
            if (descStr.includes('Transaction Deletion')) {
              descStr = 'from Transaction Deletion';
            } else if (descStr.includes('Credit')) {
              descStr = 'Credit adjustment';
            } else {
              descStr = null; // Skip corrupted descriptions
            }
          }
          
          if (descStr && descStr !== '[object Object]' && descStr !== '{}') {
            historyLine += ` - ${descStr}`;
          }
        }
        
        tooltip += `\n${historyLine}`;
      });
    }
    
    return tooltip;
  };

  // Format comprehensive payment notes for tooltip
  const formatPaymentNotesTooltip = (paymentStatus, amount, paymentDate, transactionId) => {
    // Normalize notes to string format (handles both legacy string and new array format)
    const notesText = getNotesAsString(paymentStatus.notes);
    
    if (!notesText || notesText.trim() === '') {
      if (amount > 0) {
        return `Payment: ${formatAsMXN(amount)}\nTransaction: ${transactionId || 'N/A'}`;
      }
      return '';
    }
    
    // If notes already contain comprehensive info (from unified payment), return as-is
    if (notesText.includes('HOA:') || notesText.includes('Water:')) {
      return notesText;
    }
    
    // Otherwise, format basic notes with payment info
    let tooltip = `Posted: ${formatAsMXN(amount)}`;
    if (paymentDate) {
      tooltip += ` on ${paymentDate}`;
    }
    if (notesText) {
      tooltip += `\n${notesText}`;
    }
    if (transactionId) {
      tooltip += `\nTxnID: ${transactionId}`;
    }
    
    return tooltip;
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
                // Find unit config from unitsWithOwners (has owner data from API)
                const unitWithOwner = unitsWithOwners.find(u => u.unitId === unit.unitId);
                const { lastName } = getOwnerInfo(unitWithOwner || {});
                const ownerName = getFirstOwnerName(unitWithOwner?.owners) || unitWithOwner?.owner || 'No Name';
                
                return (
                  <th 
                    key={unit.unitId} 
                    className={`unit-header ${highlightedUnit === unit.unitId ? 'highlighted-unit' : ''}`}
                  >
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
              <th className="dues-label">Dues{duesFrequency === 'quarterly' ? '/Qtr' : '/Mo'}</th>
              {units.map(unit => {
                const monthlyAmount = duesData[unit.unitId]?.scheduledAmount || 0;
                const displayAmount = duesFrequency === 'quarterly' ? monthlyAmount * 3 : monthlyAmount;
                return (
                  <th key={`dues-${unit.unitId}`} className="owner-header">
                    <div className="scheduled-amount">${formatNumber(displayAmount)}</div>
                  </th>
                );
              })}
              <th className="total-scheduled-header">
                <div className="total-scheduled-amount">
                  {(() => {
                    const monthlyTotal = units.reduce((total, unit) => total + (duesData[unit.unitId]?.scheduledAmount || 0), 0);
                    const displayTotal = duesFrequency === 'quarterly' ? monthlyTotal * 3 : monthlyTotal;
                    return `$${formatNumber(displayTotal)}`;
                  })()}
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
                    onClick={() => {
                      setCreditModalUnitId(unit.unitId);
                      setCreditModalBalance(unitData.creditBalance || 0);
                      setShowCreditHistoryModal(true);
                    }}
                    onContextMenu={(e) => handleCreditContextMenu(e, unit.unitId, unitData.creditBalance || 0)}
                    title={(() => {
                      const creditBalance = unitData.creditBalance || 0;
                      let tooltip = `Credit Balance: $${formatNumber(creditBalance)}`;
                      
                      if (hasCreditHistory) {
                        const lastUpdate = unitData.creditBalanceHistory[unitData.creditBalanceHistory.length - 1];
                        if (lastUpdate?.date) {
                          tooltip += `\nLast updated: ${lastUpdate.date}`;
                        }
                      }
                      
                      tooltip += '\n\nClick: View history';
                      tooltip += '\nRight-click: More options ⋮';
                      
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
            
            {/* Conditional rendering: Quarterly or Monthly payment rows */}
            {duesFrequency === 'quarterly' ? (
              // QUARTERLY VIEW - No expand/collapse, quarters are clickable
              <>
                {groupByQuarter().map(quarter => {
                  const quarterTotal = calculateQuarterTotal(quarter.months);
                  const quarterRemaining = calculateQuarterRemaining(quarter.months);
                  
                  // Determine quarter status for CSS classes
                  const quarterIndex = parseInt(quarter.id.substring(1)) - 1; // Q1 -> 0, Q2 -> 1, etc.
                  const firstMonthOfQuarter = quarterIndex * 3 + 1; // Q1 -> 1, Q2 -> 4, etc.
                  
                  // Get status from first month of quarter (they're all grouped now)
                  const today = getMexicoDate();
                  const currentFiscalMonth = getCurrentFiscalMonth(today, fiscalYearStartMonth);
                  const currentFiscalYear = getFiscalYear(today, fiscalYearStartMonth);
                  const selectedYearIsCurrent = selectedYear === currentFiscalYear;
                  const isPastYear = selectedYear < currentFiscalYear;
                  
                  // Quarter is late if current year and we're past (or at) the first month of the quarter
                  // This means if we're in Nov (month 5) and Q2 starts at month 4, Q2 is late if unpaid
                  const isLateQuarter = (isPastYear || (selectedYearIsCurrent && currentFiscalMonth >= firstMonthOfQuarter));
                  
                  return (
                    <tr key={`quarter-${quarter.id}`} className="quarter-row">
                      <td className="row-label quarter-label">
                        {quarter.id} ({quarter.months.map(m => getFiscalMonthNames(fiscalYearStartMonth, { short: true })[m-1]).join('/')})
                      </td>
                      {units.map(unit => {
                        const quarterStatus = getQuarterPaymentStatus(unit, quarter.months);
                        
                        // Get transaction ID from first month that has one
                        const transactionId = quarterStatus.months.find(m => m.transactionId)?.transactionId || null;
                        
                        // Build concise tooltip with dynamic action text
                        const tooltipLines = [];
                        
                        // Calculate penalties from month data (convert centavos to pesos)
                        const totalPenalties = quarterStatus.months.reduce((sum, m) => {
                          // Get the penalty paid from the payment data
                          const unitData = duesData[unit.unitId];
                          const paymentIndex = m.fiscalMonth - 1;
                          const payment = unitData?.payments?.[paymentIndex];
                          return sum + centavosToPesos(payment?.penaltyPaid || 0);
                        }, 0);
                        
                        // Format payment status
                        if (quarterStatus.status === 'paid') {
                          const totalPaidWithPenalties = quarterStatus.totalPaid + totalPenalties;
                          tooltipLines.push(`${quarter.id}: $${formatNumber(totalPaidWithPenalties)} paid`);
                          if (totalPenalties > 0) {
                            tooltipLines.push(`(Base: $${formatNumber(quarterStatus.totalPaid)} + Penalty: $${formatNumber(totalPenalties)})`);
                          }
                          
                          // Get payment date/time
                          const paymentMonth = quarterStatus.months.find(m => m.notes);
                          if (paymentMonth) {
                            const dateTime = extractDateTimeFromPayment(paymentMonth);
                            if (dateTime) {
                              tooltipLines.push(`Last payment: ${dateTime}`);
                            }
                          }
                          
                          tooltipLines.push('');
                          tooltipLines.push('Click: View transaction');
                        } else if (quarterStatus.status === 'partial') {
                          tooltipLines.push(`${quarter.id}: $${formatNumber(quarterStatus.totalPaid)} of $${formatNumber(quarterStatus.totalDue)} paid`);
                          if (totalPenalties > 0) {
                            tooltipLines.push(`(Includes $${formatNumber(totalPenalties)} penalties)`);
                          }
                          tooltipLines.push(`Remaining: $${formatNumber(quarterStatus.remaining)}`);
                          tooltipLines.push('');
                          tooltipLines.push('Click: Make payment');
                        } else {
                          tooltipLines.push(`${quarter.id}: $${formatNumber(quarterStatus.totalDue)} due`);
                          tooltipLines.push('Status: Unpaid');
                          tooltipLines.push('');
                          tooltipLines.push('Click: Make payment');
                        }
                        
                        tooltipLines.push('Right-click: More options ⋮');
                        
                        const tooltip = tooltipLines.join('\n');
                        
                        // Determine CSS class
                        let statusClass = '';
                        if (quarterStatus.status === 'paid') {
                          statusClass = 'payment-paid';
                        } else if (quarterStatus.status === 'partial') {
                          statusClass = 'payment-partial';
                        } else if (isLateQuarter) {
                          statusClass = 'payment-late';
                        }
                        
                        return (
                          <td
                            key={`quarter-${quarter.id}-${unit.unitId}`}
                            className={`payment-cell quarter-cell ${statusClass} ${transactionId ? 'has-transaction' : ''} ${highlightedUnit === unit.unitId ? 'highlighted-unit' : ''}`}
                            onClick={() => handlePaymentClick(unit.unitId, firstMonthOfQuarter)}
                            onContextMenu={(e) => handlePaymentContextMenu(e, unit.unitId, firstMonthOfQuarter, {...quarterStatus, quarterIndex: quarterIndex})}
                            title={tooltip}
                          >
                            {quarterStatus.totalPaid > 0 ? (
                              <span className="payment-amount">${formatNumber(quarterStatus.totalPaid)}</span>
                            ) : ''}
                          </td>
                        );
                      })}
                      <td className="total-cell">${formatNumber(quarterTotal)}</td>
                      <td className="remaining-cell">
                        {quarterRemaining > 0 ? `$${formatNumber(quarterRemaining)}` : ''}
                      </td>
                    </tr>
                  );
                })}
              </>
            ) : (
              // MONTHLY VIEW (existing logic)
              <>
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
              const today = getMexicoDate();
              const currentFiscalMonth = getCurrentFiscalMonth(today, fiscalYearStartMonth);
              const currentFiscalYear = getFiscalYear(today, fiscalYearStartMonth);
              
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
                        onContextMenu={(e) => handlePaymentContextMenu(e, unit.unitId, fiscalMonth, null)}
                        title={paymentStatus.amount > 0 ? formatPaymentNotesTooltip(paymentStatus, paymentStatus.amount, null, paymentStatus.transactionId) : ''}
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
              </>
            )}
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
                ${formatNumber(units.reduce((total, unit) => {
                  const unitData = duesData[unit.unitId];
                  // Use backend totalDue (total expected for year) minus totalPaid
                  const unitTotalDue = unitData?.totalDue || 0;
                  const unitTotalPaid = unitData?.totalPaid || 0;
                  return total + (unitTotalDue - unitTotalPaid);
                }, 0))}
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
      
      {/* Credit Balance Edit Modal */}
      <CreditBalanceEditModal
        isOpen={showCreditEditModal}
        onClose={closeCreditEditModal}
        unitId={creditEditUnitId}
        currentBalance={creditEditCurrentBalance}
        year={selectedYear}
        onUpdate={handleCreditBalanceUpdate}
      />
      
      {/* Credit Balance History Modal */}
      <CreditBalanceHistoryModal
        isOpen={showCreditHistoryModal}
        onClose={closeCreditModals}
        unitId={creditModalUnitId}
        currentBalance={creditModalBalance}
        creditBalanceHistory={creditModalUnitId ? getCreditBalanceHistory(creditModalUnitId) : []}
        year={selectedYear}
        onUpdate={handleCreditBalanceUpdate}
      />
      
      {/* Credit Balance Add Modal */}
      <CreditBalanceAddModal
        isOpen={showCreditAddModal}
        onClose={closeCreditModals}
        unitId={creditModalUnitId}
        currentBalance={creditModalBalance}
        year={selectedYear}
        onUpdate={handleCreditBalanceUpdate}
      />
      
      {/* Credit Balance Remove Modal */}
      <CreditBalanceRemoveModal
        isOpen={showCreditRemoveModal}
        onClose={closeCreditModals}
        unitId={creditModalUnitId}
        currentBalance={creditModalBalance}
        year={selectedYear}
        onUpdate={handleCreditBalanceUpdate}
      />
      
      
      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
        options={contextMenu.options || []}
      />

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        isOpen={detailsModal.isOpen}
        onClose={() => setDetailsModal({ isOpen: false, data: null })}
        details={detailsModal.data}
      />
    </div>
  );
}

export default HOADuesView;
