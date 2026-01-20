import React from 'react';
import '../styles/SandylandModalTheme.css';
import './CreditBalanceConfirmModal.css';

/**
 * Confirmation modal for credit balance operations (edit/delete)
 * Follows the standard Sandyland modal theme
 */
const CreditBalanceConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'warning' // 'warning', 'danger', 'info'
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  // Determine button class based on type
  const getConfirmButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'sandyland-btn-danger';
      case 'warning':
        return 'sandyland-btn-warning';
      default:
        return 'sandyland-btn-primary';
    }
  };

  return (
    <div className="sandyland-modal-overlay">
      <div className="sandyland-modal credit-balance-confirm-modal" style={{ width: '450px', maxWidth: '90vw' }}>
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">{title}</h2>
        </div>
        
        <div className="sandyland-modal-content">
          <p className="confirm-message">{message}</p>
        </div>
        
        <div className="sandyland-modal-buttons">
          <button 
            className="sandyland-btn sandyland-btn-secondary"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          
          <button 
            className={`sandyland-btn ${getConfirmButtonClass()}`}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditBalanceConfirmModal;
