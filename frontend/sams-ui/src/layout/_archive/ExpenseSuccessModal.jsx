import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import './ExpenseSuccessModal.css';

const ExpenseSuccessModal = ({ 
  isOpen, 
  onAddAnother, 
  onDone, 
  transactionData 
}) => {
  if (!isOpen) return null;

  // Format amount for display
  const formatAmount = (amount) => {
    const num = Math.abs(Number(amount || 0));
    return num.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    });
  };

  return (
    <div className="modal-overlay">
      <div className="expense-success-modal">
        <div className="success-content">
          {/* Success Icon */}
          <div className="success-icon">
            <FontAwesomeIcon icon={faCheckCircle} />
          </div>
          
          {/* Success Message */}
          <h2>Expense Saved Successfully!</h2>
          
          {/* Transaction Details */}
          {transactionData && (
            <div className="transaction-summary">
              <p className="amount">{formatAmount(transactionData.amount)}</p>
              {transactionData.category && (
                <p className="category">{transactionData.category}</p>
              )}
              {transactionData.vendor && (
                <p className="vendor">{transactionData.vendor}</p>
              )}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="button-group">
            <button 
              className="btn-secondary" 
              onClick={onAddAnother}
            >
              Add Another Expense
            </button>
            <button 
              className="btn-primary" 
              onClick={onDone}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseSuccessModal;