/**
 * Unit Report Component - Mobile-First Financial Report for Unit Owners
 * 
 * Displays unit-specific financial information including:
 * - Unit header with owners/managers
 * - Current status (Amount Due or Paid Through)
 * - Transaction history with touch-activated details
 * 
 * Designed for mobile-first with touch-friendly interactions
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useClient } from '../../context/ClientContext';
import './UnitReport.css';

const UnitReport = ({ unitId, onClose }) => {
  const { samsUser } = useAuth();
  const { selectedClient } = useClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    if (selectedClient?.id && unitId) {
      fetchUnitReport();
    }
  }, [selectedClient?.id, unitId]);

  const fetchUnitReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/clients/${selectedClient.id}/reports/unit/${unitId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await samsUser.getIdToken()}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
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

  // Date formatting no longer needed - API returns pre-formatted dates
  // Keeping function for backward compatibility if needed
  const formatDate = (dateValue) => {
    // If already formatted (has display property), use it
    if (dateValue?.display) return dateValue.display;
    // Otherwise return as-is or empty string
    return dateValue || '';
  };

  const handleTransactionClick = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const closeTransactionDetail = () => {
    setSelectedTransaction(null);
  };

  if (loading) {
    return (
      <div className="unit-report">
        <div className="unit-report-header">
          <h2>Loading Unit Report...</h2>
          {onClose && (
            <button className="close-button" onClick={onClose}>×</button>
          )}
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="unit-report">
        <div className="unit-report-header">
          <h2>Unit Report Error</h2>
          {onClose && (
            <button className="close-button" onClick={onClose}>×</button>
          )}
        </div>
        <div className="error-message">
          <p>Error loading unit report: {error}</p>
          <button className="retry-button" onClick={fetchUnitReport}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="unit-report">
        <div className="unit-report-header">
          <h2>No Data Available</h2>
          {onClose && (
            <button className="close-button" onClick={onClose}>×</button>
          )}
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
    
    // Parse payment data to determine which months are paid
    const paidMonths = new Set();
    if (transactions) {
      transactions.forEach(transaction => {
        if (transaction.type === 'HOA Dues' && transaction.paymentDate) {
          const paymentDate = new Date(transaction.paymentDate);
          if (paymentDate.getFullYear() === currentYear) {
            paidMonths.add(paymentDate.getMonth());
          }
        }
      });
    }
    
    return months.map((month, index) => {
      let status = 'not-due'; // Default: future months
      
      if (paidMonths.has(index)) {
        status = 'paid';
      } else if (index < currentMonth) {
        status = 'past-due';
      } else if (index === currentMonth) {
        // Current month - check if due within 15 days
        const today = new Date().getDate();
        if (today >= 15) {
          status = 'due-soon';
        }
      }
      
      return { month, status };
    });
  };

  const paymentCalendar = generatePaymentCalendar();

  return (
    <div className="unit-report">
      {/* Header Section */}
      <div className="unit-report-header">
        <h2>Unit {unit.unitId} Report</h2>
        {onClose && (
          <button className="close-button" onClick={onClose}>×</button>
        )}
      </div>

      {/* Unit Information Header */}
      <div className="unit-info-header">
        <div className="unit-number">Unit {unit.unitId}</div>
        
        {/* Owners */}
        {unit.owners.map((owner, index) => (
          <div key={`owner-${index}`} className="unit-person">
            {owner.name}
          </div>
        ))}
        
        {/* Managers */}
        {unit.managers.map((manager, index) => (
          <div key={`manager-${index}`} className="unit-person">
            {manager.name} (Mgr)
          </div>
        ))}
      </div>

      {/* Enhanced Status Card with Payment Calendar */}
      <div className="status-card enhanced">
        {/* Unit Selector Header */}
        <div className="unit-selector">
          <span>Unit: {unit.unitId}</span>
          {unit.multipleUnits && <span className="dropdown-indicator">▼</span>}
        </div>
        
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
              {currentStatus.amountDue > 0 ? (
                <span className="status-due">❌ Amount Due: {formatCurrency(currentStatus.amountDue)}</span>
              ) : (
                <span className="status-paid">✅ Paid Through {currentStatus.paidThrough || 'Current'}</span>
              )}
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

      {/* Transaction History */}
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
                className="transaction-row"
                onClick={() => handleTransactionClick(transaction)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleTransactionClick(transaction);
                  }
                }}
              >
                <div className="transaction-date">
                  {transaction.date?.display || transaction.date || ''}
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
        <div className="transaction-detail-modal" onClick={closeTransactionDetail}>
          <div 
            className="transaction-detail-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="transaction-detail-header">
              <h3>Transaction Details</h3>
              <button 
                className="close-button"
                onClick={closeTransactionDetail}
                aria-label="Close transaction details"
              >
                ×
              </button>
            </div>
            <div className="transaction-detail-body">
              <div className="detail-row">
                <span className="detail-label">Date:</span>
                <span className="detail-value">
                  {selectedTransaction.date?.display || selectedTransaction.date || ''}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value">
                  {selectedTransaction.type || 'Transaction'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Amount:</span>
                <span className="detail-value">
                  {formatCurrency(selectedTransaction.amount)}
                </span>
              </div>
              {selectedTransaction.description && (
                <div className="detail-row">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">
                    {selectedTransaction.description}
                  </span>
                </div>
              )}
              {selectedTransaction.category && (
                <div className="detail-row">
                  <span className="detail-label">Category:</span>
                  <span className="detail-value">
                    {selectedTransaction.category}
                  </span>
                </div>
              )}
              {selectedTransaction.vendor && (
                <div className="detail-row">
                  <span className="detail-label">Vendor:</span>
                  <span className="detail-value">
                    {selectedTransaction.vendor}
                  </span>
                </div>
              )}
            </div>
            <div className="transaction-detail-footer">
              <button 
                className="close-detail-button"
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