import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PaymentDetailsModal.css';

/**
 * Modal to display detailed payment information
 * Used for HOA payment cells with full transaction details
 */
function PaymentDetailsModal({ isOpen, onClose, details }) {
  const navigate = useNavigate();

  if (!isOpen || !details) return null;

  const handleGoToTransaction = () => {
    if (details.transactionId) {
      navigate(`/transactions?search=${details.transactionId}`);
      onClose();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="payment-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{details.isQuarter ? `Quarter ${details.quarter}` : `Month ${details.month}`} Payment Details</h2>
          <button className="modal-close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Summary Section */}
          <div className="details-section">
            <h3>Summary</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Period:</span>
                <span className="detail-value">{details.period}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Unit:</span>
                <span className="detail-value">{details.unitId}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className={`detail-value status-${details.status}`}>
                  {details.status === 'paid' ? '✓ Paid' : 
                   details.status === 'partial' ? '◐ Partial' : 
                   '○ Unpaid'}
                </span>
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div className="details-section">
            <h3>Financial Details</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Total Due:</span>
                <span className="detail-value">{formatCurrency(details.totalDue)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Base Charge:</span>
                <span className="detail-value">{formatCurrency(details.baseCharge)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Penalties:</span>
                <span className="detail-value">{formatCurrency(details.penalties)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Total Paid:</span>
                <span className="detail-value detail-highlight">{formatCurrency(details.totalPaid)}</span>
              </div>
              {details.remaining > 0 && (
                <div className="detail-item">
                  <span className="detail-label">Remaining:</span>
                  <span className="detail-value detail-warning">{formatCurrency(details.remaining)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Information */}
          {details.transactionId && (
            <div className="details-section">
              <h3>Payment Information</h3>
              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Date:</span>
                  <span className="detail-value">{formatDate(details.paymentDate)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Transaction ID:</span>
                  <span className="detail-value detail-monospace">{details.transactionId}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Method:</span>
                  <span className="detail-value">{details.paymentMethod || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes Section */}
          {details.notes && (
            <div className="details-section">
              <h3>Notes</h3>
              <div className="notes-box">
                {details.notes}
              </div>
            </div>
          )}

          {/* Monthly Breakdown (for quarters) */}
          {details.isQuarter && details.months && details.months.length > 0 && (
            <div className="details-section">
              <h3>Monthly Breakdown</h3>
              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Amount Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {details.months.map((month, index) => (
                    <tr key={index}>
                      <td>{month.fiscalMonth}</td>
                      <td>{formatCurrency(month.amount)}</td>
                      <td className={`status-${month.status}`}>{month.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {details.transactionId && (
            <button className="btn-primary" onClick={handleGoToTransaction}>
              Go to Transaction
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default PaymentDetailsModal;

