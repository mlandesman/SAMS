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

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useClient } from '../../context/ClientContext';
import { useDesktopLanguage } from '../../context/DesktopLanguageContext';
import { normalizeOwners, normalizeManagers } from '../../utils/unitContactUtils.js';
import { getMexicoDateTime } from '../../utils/timezone';
import './UnitReport.css';

const UnitReport = ({ unitId, onClose }) => {
  const { samsUser } = useAuth();
  const { selectedClient } = useClient();
  const { language } = useDesktopLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const isSpanish = language === 'ES';

  const readText = (value) => {
    if (value == null) return '';
    return String(value).trim();
  };

  const pickDisplayText = (localizedValue, sourceValue) => {
    if (isSpanish) {
      const localized = readText(localizedValue);
      if (localized) return localized;
    }
    return readText(sourceValue);
  };

  const getTransactionDateDisplay = (transaction) =>
    pickDisplayText(transaction?.dateDisplayLocalized, transaction?.date?.display || transaction?.date || '');

  const getTransactionTypeDisplay = (transaction) =>
    pickDisplayText(transaction?.typeLocalized, transaction?.type || 'Transaction');

  const getTransactionDescriptionDisplay = (transaction) =>
    pickDisplayText(transaction?.descriptionLocalized, transaction?.description);

  const getTransactionCategoryDisplay = (transaction) =>
    pickDisplayText(transaction?.categoryLocalized, transaction?.category);

  const getTransactionVendorDisplay = (transaction) =>
    pickDisplayText(transaction?.vendorLocalized, transaction?.vendor);

  const fetchUnitReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/clients/${selectedClient.id}/reports/unit/${unitId}?lang=${language}`, {
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
  }, [selectedClient?.id, unitId, samsUser, language]);

  useEffect(() => {
    if (selectedClient?.id && unitId) {
      fetchUnitReport();
    }
  }, [selectedClient?.id, unitId, fetchUnitReport]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount || 0);
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
    
    const mexicoNow = getMexicoDateTime();
    const currentMonth = mexicoNow.getMonth();
    const currentYear = mexicoNow.getFullYear();
    
    // Parse payment data to determine which months are paid
    const paidMonths = new Set();
    if (transactions) {
      transactions.forEach(transaction => {
        if (transaction.type === 'HOA Dues' && transaction.paymentDate) {
          const paymentDate = getMexicoDateTime(transaction.paymentDate);
          if (!Number.isNaN(paymentDate.getTime()) && paymentDate.getFullYear() === currentYear) {
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
        const today = mexicoNow.getDate();
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
                <span className="status-due">
                  ❌ Amount Due: {pickDisplayText(currentStatus.amountDueDisplayLocalized, formatCurrency(currentStatus.amountDue))}
                </span>
              ) : (
                <span className="status-paid">
                  ✅ Paid Through {pickDisplayText(currentStatus.paidThroughLocalized, currentStatus.paidThrough || 'Current')}
                </span>
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
                  {getTransactionDateDisplay(transaction)}
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
                  {getTransactionDateDisplay(selectedTransaction)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value">
                  {getTransactionTypeDisplay(selectedTransaction)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Amount:</span>
                <span className="detail-value">
                  {formatCurrency(selectedTransaction.amount)}
                </span>
              </div>
              {getTransactionDescriptionDisplay(selectedTransaction) && (
                <div className="detail-row">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">
                    {getTransactionDescriptionDisplay(selectedTransaction)}
                  </span>
                </div>
              )}
              {getTransactionCategoryDisplay(selectedTransaction) && (
                <div className="detail-row">
                  <span className="detail-label">Category:</span>
                  <span className="detail-value">
                    {getTransactionCategoryDisplay(selectedTransaction)}
                  </span>
                </div>
              )}
              {getTransactionVendorDisplay(selectedTransaction) && (
                <div className="detail-row">
                  <span className="detail-label">Vendor:</span>
                  <span className="detail-value">
                    {getTransactionVendorDisplay(selectedTransaction)}
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