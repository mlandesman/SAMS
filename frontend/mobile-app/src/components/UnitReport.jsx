/**
 * Unit Report Component for Mobile PWA
 * Mobile-first financial report for unit owners
 * 
 * Features:
 * - Touch-optimized interface
 * - Real API integration
 * - Transaction detail modal
 * - Responsive design
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { normalizeOwners, normalizeManagers } from '../utils/unitContactUtils.js';
import './UnitReport.css';

const UnitReport = ({ unitId, onClose }) => {
  const { samsUser, currentClient, firebaseUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [currentUnitId, setCurrentUnitId] = useState(unitId);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  useEffect(() => {
    console.log('UnitReport: Effect triggered with:', { currentClient, currentUnitId });
    
    // Handle both string clientId and object with id property
    const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
    
    if (clientId && currentUnitId) {
      console.log('UnitReport: Fetching report for client:', clientId, 'unit:', currentUnitId);
      fetchUnitReport();
    } else {
      console.log('UnitReport: Missing required data:', { clientId, currentUnitId });
    }
  }, [currentClient, currentUnitId]);

  // Fetch available units for the current user and client
  useEffect(() => {
    const fetchAvailableUnits = async () => {
      const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
      if (!clientId || !firebaseUser) return;

      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
        const token = await firebaseUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/clients/${clientId}/units/user-access`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const units = await response.json();
          console.log('Frontend: Available units received:', units);
          setAvailableUnits(units);
        }
      } catch (err) {
        console.error('Error fetching user units:', err);
      }
    };

    fetchAvailableUnits();
  }, [currentClient, firebaseUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUnitDropdown && !event.target.closest('.unit-selector-container')) {
        setShowUnitDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUnitDropdown]);

  const fetchUnitReport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Handle both string clientId and object with id property
      const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
      
      if (!clientId) {
        throw new Error('No client selected');
      }
      
      if (!firebaseUser) {
        throw new Error('No authenticated user');
      }
      
      console.log('UnitReport: Fetching from:', `/clients/${clientId}/reports/unit/${currentUnitId}`);
      console.log('UnitReport: Firebase user:', firebaseUser ? 'Yes' : 'No');

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      const token = await firebaseUser.getIdToken();
      console.log('UnitReport: Got token:', token ? 'Yes' : 'No', token?.length || 0, 'chars');
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/reports/unit/${currentUnitId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      // Normalize owners/managers to ensure consistent structure
      if (data.unit) {
        data.unit.owners = normalizeOwners(data.unit.owners);
        data.unit.managers = normalizeManagers(data.unit.managers);
      }
      setReportData(data);
    } catch (err) {
      console.error('Error fetching unit report:', err);
      setError(err.message || 'Failed to load unit report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleTransactionClick = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const closeTransactionDetail = () => {
    setSelectedTransaction(null);
  };

  const handleUnitChange = (newUnitId) => {
    // TODO: Fix backend security check in /backend/routes/reports.js line 37
    // Currently it only allows unitOwners to access their primary unit
    // Need to also check clientAccess.unitAssignments array for units they manage
    setCurrentUnitId(newUnitId);
    setShowUnitDropdown(false);
  };

  if (loading) {
    return (
      <div className="unit-report-mobile">
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
          <p>Loading your financial report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="unit-report-mobile">
        <div className="error-container">
          <div className="error-message">
            <h3>Unable to Load Report</h3>
            <p>{error}</p>
            <button className="retry-button" onClick={fetchUnitReport}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="unit-report-mobile">
        <div className="error-container">
          <p>No report data available for this unit.</p>
        </div>
      </div>
    );
  }

  const { unit, currentStatus, transactions } = reportData;

  // Generate payment calendar data
  const generatePaymentCalendar = () => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Check if we have payment data from the report
    const paymentData = reportData?.paymentCalendar || reportData?.payments;
    
    return months.map((month, index) => {
      let status = 'not-due'; // Default: future months
      
      // Check payment data if available
      if (paymentData && paymentData[index + 1]) {
        const payment = paymentData[index + 1];
        if (payment.paid > 0) {
          status = 'paid';
        } else if (index < currentMonth) {
          status = 'past-due';
        } else if (index === currentMonth) {
          // Current month - check if due
          const today = new Date().getDate();
          if (today >= 1) {
            status = 'due-soon';
          }
        }
      } else {
        // No payment data - use simple logic
        if (index < currentMonth) {
          status = 'past-due';
        } else if (index === currentMonth) {
          const today = new Date().getDate();
          if (today >= 1) {
            status = 'due-soon';
          }
        }
      }
      
      return { month, status };
    });
  };

  const paymentCalendar = generatePaymentCalendar();

  return (
    <div className="unit-report-mobile">

      {/* Unit Information */}
      <div className="unit-info-section">
        <div className="unit-number-display">Unit {unit.unitId}</div>
        
        <div className="people-list">
          {unit.owners.map((owner, index) => (
            <div key={`owner-${index}`} className="person-item">
              {owner.name}
            </div>
          ))}
          
          {unit.managers.map((manager, index) => (
            <div key={`manager-${index}`} className="person-item manager">
              {manager.name} (Mgr)
            </div>
          ))}
        </div>
      </div>

      {/* Unit Selector Container */}
      <div className="unit-selector-container">
        <div 
          className={`unit-selector ${availableUnits.length > 1 ? 'clickable' : ''} ${showUnitDropdown ? 'dropdown-open' : ''}`} 
          onClick={() => {
            console.log('Unit selector clicked, available units:', availableUnits.length);
            if (availableUnits.length > 1) {
              setShowUnitDropdown(!showUnitDropdown);
            }
          }}
        >
          <span>Unit: {unit.unitId}</span>
          {availableUnits.length > 1 && <span className="dropdown-indicator">{showUnitDropdown ? '▲' : '▼'}</span>}
        </div>
        
        {/* Unit Dropdown Menu */}
        {showUnitDropdown && availableUnits.length > 1 && (
          <div className="unit-dropdown">
            {availableUnits.map((availUnit) => (
              <div 
                key={availUnit.unitId}
                className={`unit-dropdown-item ${availUnit.unitId === currentUnitId ? 'selected' : ''}`}
                onClick={() => handleUnitChange(availUnit.unitId)}
              >
                Unit {availUnit.unitId}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Status Card with Payment Calendar */}
      <div className="status-card enhanced">
        
        {/* Financial Summary */}
        <div className="financial-summary">
          <div className="summary-row">
            <span className="label">YTD Total:</span>
            <span className="value">{formatCurrency(currentStatus.ytdPaid.hoaDues + currentStatus.ytdPaid.projects)}</span>
          </div>
          <div className="summary-row">
            <span className="label">Credit Balance:</span>
            <span className="value">{formatCurrency(currentStatus.creditBalance || 0)}</span>
          </div>
          <div className="summary-row">
            <span className="label">Status:</span>
            <span className="value">
              {(() => {
                const today = new Date();
                const currentMonth = today.getMonth();
                const currentDay = today.getDate();
                
                // Check if payment is due in the next 30 days
                const isDueSoon = currentDay >= 1 && currentStatus.amountDue > 0 && currentStatus.amountDue <= (currentStatus.ytdPaid.hoaDues / currentMonth || 0);
                
                if (currentStatus.amountDue > 0) {
                  // Determine if past due or just due
                  const monthlyAmount = currentStatus.ytdPaid.hoaDues / (currentMonth || 1);
                  const pastDueAmount = currentStatus.amountDue - monthlyAmount;
                  
                  if (pastDueAmount > 0) {
                    // Past due - show past due amount plus current month
                    return <span className="status-due">Past Due {formatCurrency(currentStatus.amountDue)}</span>;
                  } else {
                    // Due within 30 days but otherwise current
                    return <span className="status-due">Due {formatCurrency(currentStatus.amountDue)}</span>;
                  }
                } else {
                  // All paid up
                  return <span className="status-paid">Current</span>;
                }
              })()}
            </span>
          </div>
        </div>
        
        {/* Payment Calendar Grid */}
        <div className="payment-calendar">
          <div className="calendar-row">
            {paymentCalendar.slice(0, 6).map((item, index) => (
              <div key={index} className={`calendar-cell ${item.status}`}>
                {item.month}
              </div>
            ))}
          </div>
          <div className="calendar-row">
            {paymentCalendar.slice(6, 12).map((item, index) => (
              <div key={index + 6} className={`calendar-cell ${item.status}`}>
                {item.month}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="transactions-section">
        <h3>Recent Transactions</h3>
        {transactions.length === 0 ? (
          <div className="no-transactions">
            <p>No transactions found for this unit.</p>
          </div>
        ) : (
          <div className="transactions-list">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="transaction-item"
                onClick={() => handleTransactionClick(transaction)}
              >
                <div className="transaction-date">
                  {formatDate(transaction.date)}
                </div>
                <div className="transaction-amount">
                  {formatCurrency(transaction.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="transaction-modal-overlay" onClick={closeTransactionDetail}>
          <div 
            className="transaction-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="transaction-modal-header">
              <h3>Transaction Details</h3>
              <button 
                className="modal-close-button"
                onClick={closeTransactionDetail}
              >
                ×
              </button>
            </div>
            
            <div className="transaction-modal-content">
              <div className="detail-item">
                <span className="detail-label">Date</span>
                <span className="detail-value">
                  {formatDate(selectedTransaction.date)}
                </span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Amount</span>
                <span className="detail-value amount">
                  {formatCurrency(selectedTransaction.amount)}
                </span>
              </div>
              
              {selectedTransaction.description && (
                <div className="detail-item">
                  <span className="detail-label">Description</span>
                  <span className="detail-value description">
                    {selectedTransaction.description}
                  </span>
                </div>
              )}
              
              {selectedTransaction.category && (
                <div className="detail-item">
                  <span className="detail-label">Category</span>
                  <span className="detail-value">
                    {selectedTransaction.category}
                  </span>
                </div>
              )}
              
              {selectedTransaction.paymentMethod && (
                <div className="detail-item">
                  <span className="detail-label">Payment Method</span>
                  <span className="detail-value">
                    {selectedTransaction.paymentMethod}
                  </span>
                </div>
              )}
            </div>
            
            <div className="transaction-modal-footer">
              <button 
                className="modal-close-button-full"
                onClick={closeTransactionDetail}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitReport;