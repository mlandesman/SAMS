import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faReceipt, faCalendarAlt, faUser, faTag, faDollarSign, faFileInvoice, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import HOADuesTransactionCard from './HOADuesTransactionCard';
import './TransactionDetails.css';

function TransactionDetails({ transaction, onEdit, onDelete }) {
  if (!transaction) return null;
  
  // Format the date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    // Added better error handling and debugging for date formatting
    try {
      console.log('Formatting date:', JSON.stringify(date));
      
      let dateObj;
      if (date.toDate) {
        dateObj = date.toDate();
      } else if (date._seconds) {
        // Handle Firestore timestamp objects
        console.log('Converting Firestore timestamp:', date._seconds);
        dateObj = new Date(date._seconds * 1000);
      } else {
        dateObj = new Date(date);
      }
      
      console.log('Converted date object:', dateObj);
      
      if (isNaN(dateObj.getTime())) {
        console.error('Invalid date conversion result:', dateObj);
        return 'Invalid date';
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting date:', e, date);
      return 'Error formatting date';
    }
  };
  
  // Format amount with appropriate sign and currency
  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return 'N/A';
    return amount < 0 
      ? `-$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      : `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };
  
  return (
    <div className="transaction-details">
      <div className="transaction-details-header">
        <h2>
          <FontAwesomeIcon icon={faReceipt} /> 
          Transaction Details
        </h2>
        <div className="transaction-actions">
          <button className="edit-button" onClick={() => onEdit(transaction)}>
            <FontAwesomeIcon icon={faEdit} /> Edit
          </button>
          <button className="delete-button" onClick={() => onDelete(transaction)}>
            <FontAwesomeIcon icon={faTrash} /> Delete
          </button>
        </div>
      </div>
      
      <div className="transaction-details-content">
        <div className="transaction-field">
          <div className="field-label">
            <FontAwesomeIcon icon={faCalendarAlt} /> Date
          </div>
          <div className="field-value">{formatDate(transaction.date)}</div>
        </div>
        
        <div className="transaction-field">
          <div className="field-label">
            <FontAwesomeIcon icon={faUser} /> Vendor
          </div>
          <div className="field-value">{transaction.vendor || 'N/A'}</div>
        </div>
        
        <div className="transaction-field">
          <div className="field-label">
            <FontAwesomeIcon icon={faTag} /> Category
          </div>
          <div className="field-value">{transaction.category || 'N/A'}</div>
        </div>
        
        <div className="transaction-field">
          <div className="field-label">
            <FontAwesomeIcon icon={faDollarSign} /> Amount
          </div>
          <div className={`field-value ${transaction.amount < 0 ? 'negative-amount' : 'positive-amount'}`}>
            {formatAmount(transaction.amount)}
          </div>
        </div>
        
        <div className="transaction-field">
          <div className="field-label">
            <FontAwesomeIcon icon={faFileInvoice} /> Notes
          </div>
          <div className="field-value notes-field">{transaction.notes || 'No notes'}</div>
        </div>
        
        {/* Add other transaction fields as needed */}
        
        {/* HOA Dues specific metadata card */}
        {transaction.metadata?.type === 'hoa_dues' && (
          <HOADuesTransactionCard metadata={transaction.metadata} />
        )}
      </div>
    </div>
  );
}

export default TransactionDetails;
