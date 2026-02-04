import React from 'react';
import '../../styles/InputModal.css';
import './ConfirmationModal.css';

/**
 * Reusable confirmation modal for various actions
 * Supports different variants: danger, primary, warning, success
 */
const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "primary", // 'danger', 'primary', 'warning', 'success'
  icon = null, // Custom icon SVG, or use default based on variant
  loading = false,
  disabled = false
}) => {
  if (!isOpen) return null;

  // Default icons based on variant
  const getDefaultIcon = () => {
    switch (variant) {
      case 'danger':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.3 1.55 18.64 1.56 18.99C1.57 19.34 1.68 19.68 1.87 19.97C2.06 20.26 2.33 20.49 2.64 20.64C2.95 20.79 3.3 20.86 3.65 20.83H20.35C20.7 20.86 21.05 20.79 21.36 20.64C21.67 20.49 21.94 20.26 22.13 19.97C22.32 19.68 22.43 19.34 22.44 18.99C22.45 18.64 22.36 18.3 22.18 18L13.71 3.86C13.52 3.56 13.26 3.32 12.95 3.15C12.64 2.98 12.29 2.89 11.93 2.89C11.57 2.89 11.22 2.98 10.91 3.15C10.6 3.32 10.34 3.56 10.15 3.86H10.29Z" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        );
      case 'success':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18457 2.99721 7.13633 4.39828 5.49707C5.79935 3.85782 7.69279 2.71538 9.79619 2.24015C11.8996 1.76491 14.1003 1.98234 16.07 2.86M22 4L12 14.01L9 11.01" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        );
      case 'primary':
      default:
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal confirmation-modal confirmation-modal--${variant}`} onClick={e => e.stopPropagation()}>
        <div className="confirmation-icon">
          {icon || getDefaultIcon()}
        </div>
        
        <h3 className="modal-title">{title}</h3> 
        
        <div className="confirmation-message">{message}</div>
        
        <div className="modal-buttons">
          <button 
            type="button" 
            className="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          
          <button 
            type="button" 
            className={variant}
            onClick={onConfirm}
            disabled={loading || disabled}
          >
            {loading ? (
              <>
                <span className="spinner-inline"></span>
                Processing...
              </>
            ) : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
