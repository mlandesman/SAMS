import React from 'react';
import '../../styles/InputModal.css';
import './DeleteConfirmationModal.css';

/**
 * Reusable confirmation modal for delete operations
 */
const DeleteConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Delete",
  message = "Are you sure you want to delete this item?",
  itemName = "",
  itemType = "item"
}) => {
  if (!isOpen) return null;

  const displayMessage = itemName 
    ? `Are you sure you want to delete the ${itemType} "${itemName}"? This action cannot be undone.`
    : message;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal delete-confirmation-modal" onClick={e => e.stopPropagation()}>
        <div className="delete-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" 
              stroke="#dc3545" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>
        
        <h3 className="modal-title">{title}</h3> 
        
        <p className="delete-message">{displayMessage}</p>
        
        <div className="modal-buttons">
          <button 
            type="button" 
            className="secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          
          <button 
            type="button" 
            className="danger"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
