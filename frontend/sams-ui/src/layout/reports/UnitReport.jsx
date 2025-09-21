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

      const response = await fetch(`/clients/${selectedClient.id}/reports/unit/${unitId}`, {
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

  return (
    <div className="unit-report">
      {/* Header Section */}
      <div className="unit-report-header">
        <h2>Unit {unit.unitNumber} Report</h2>
        {onClose && (
          <button className="close-button" onClick={onClose}>×</button>
        )}
      </div>

      {/* Unit Information Header */}
      <div className="unit-info-header">
        <div className="unit-number">Unit {unit.unitNumber}</div>
        
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

      {/* Current Status Card */}
      <div className="status-card">
        <h3>Current Status</h3>
        <div className="status-content">
          {currentStatus.amountDue > 0 ? (
            <div className="status-row">
              <span className="status-label">Amount Due:</span>
              <span className="status-value amount-due">
                {formatCurrency(currentStatus.amountDue)}
              </span>
            </div>
          ) : (
            currentStatus.paidThrough && (
              <div className="status-row">
                <span className="status-label">Paid Through:</span>
                <span className="status-value paid-through">
                  {currentStatus.paidThrough}
                </span>
              </div>
            )
          )}
          <div className="status-row">
            <span className="status-label">YTD Paid:</span>
            <span className="status-value ytd-paid">
              {formatCurrency(currentStatus.ytdPaid.hoaDues)}
              {currentStatus.ytdPaid.projects > 0 && 
                ` (+ ${formatCurrency(currentStatus.ytdPaid.projects)} Projects)`
              }
            </span>
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
                  {formatDate(selectedTransaction.date)}
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