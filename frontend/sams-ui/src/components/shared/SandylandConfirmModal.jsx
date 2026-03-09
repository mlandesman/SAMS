import React from 'react';
import '../../styles/SandylandModalTheme.css';

/**
 * Reusable Sandyland-themed confirmation modal.
 * Replaces window.confirm with consistent Sandyland styling.
 */
const SandylandConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'warning', // 'warning' | 'danger' | 'info'
  disabled = false
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (disabled) return;
    onConfirm();
  };

  const getConfirmButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'sandyland-btn-danger';
      case 'warning':
        return 'sandyland-btn-warning';
      case 'info':
      default:
        return 'sandyland-btn-primary';
    }
  };

  return (
    <div className="sandyland-modal-overlay">
      <div className="sandyland-modal" style={{ width: '450px', maxWidth: '90vw' }}>
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">{title}</h2>
        </div>

        <div className="sandyland-modal-content">
          <div style={{ color: '#4a5568', fontSize: '16px', lineHeight: 1.5, margin: 0 }}>
            {typeof message === 'string' ? <p style={{ margin: 0 }}>{message}</p> : message}
          </div>
        </div>

        <div className="sandyland-modal-buttons">
          <button
            className="sandyland-btn sandyland-btn-secondary"
            onClick={onClose}
            disabled={disabled}
          >
            {cancelLabel}
          </button>

          <button
            className={`sandyland-btn ${getConfirmButtonClass()}`}
            onClick={handleConfirm}
            disabled={disabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SandylandConfirmModal;
