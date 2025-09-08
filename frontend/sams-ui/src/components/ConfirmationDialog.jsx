// src/components/ConfirmationDialog.jsx
import React from 'react';
import '../styles/SandylandModalTheme.css';

/**
 * Confirmation dialog component for confirming actions like deletion
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the dialog is open
 * @param {Function} props.onClose - Function to call when closing the dialog
 * @param {Function} props.onConfirm - Function to call when confirming the action
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Dialog message
 * @param {string} props.confirmLabel - Label for the confirm button
 * @param {string} props.cancelLabel - Label for the cancel button
 * @param {string} props.confirmButtonClass - CSS class for the confirm button
 */
const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmation',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmButtonClass = 'danger'
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="sandyland-modal-overlay">
      <div className="sandyland-modal" style={{ width: '400px', maxWidth: '90vw' }}>
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">{title}</h2>
        </div>
        
        <div className="sandyland-modal-content">
          <p style={{ color: '#4a5568', fontSize: '16px', lineHeight: '1.5', margin: 0 }}>{message}</p>
        </div>
        
        <div className="sandyland-modal-buttons">
          <button 
            className="sandyland-btn sandyland-btn-secondary"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          
          <button 
            className={`sandyland-btn ${confirmButtonClass === 'danger' ? 'sandyland-btn-danger' : 'sandyland-btn-primary'}`}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;
