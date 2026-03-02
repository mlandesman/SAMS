/**
 * Generic Notification Modal for Success/Error Messages
 * Used for email sending, WhatsApp sharing, and other operations
 */

import React from 'react';
import './NotificationModal.css';

const NotificationModal = ({ 
  isOpen, 
  onClose, 
  type = 'success', // 'success', 'error', 'warning', 'info'
  title,
  message,
  details = [],
  actionButton = null,
  autoClose = false,
  autoCloseDelay = 3000
}) => {
  
  React.useEffect(() => {
    if (autoClose && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📧';
    }
  };

  const getTypeClass = () => {
    return `notification-modal-${type}`;
  };

  return (
    <div className="notification-modal-overlay" onClick={onClose}>
      <div className={`notification-modal ${getTypeClass()}`} onClick={e => e.stopPropagation()}>
        <div className="notification-modal-header">
          <div className="notification-modal-icon">
            {getIcon()}
          </div>
          <h3 className="notification-modal-title">{title}</h3>
          <button 
            className="notification-modal-close" 
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="notification-modal-body">
          <p className="notification-modal-message">{message}</p>
          
          {details.length > 0 && (
            <div className="notification-modal-details">
              {details.map((detail, index) => (
                <div key={index} className="notification-detail-item">
                  <strong>{detail.label}:</strong> {detail.value}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="notification-modal-footer">
          {actionButton && (
            <button 
              className="notification-action-button"
              onClick={actionButton.onClick}
            >
              {actionButton.text}
            </button>
          )}
          <button 
            className="notification-close-button"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
