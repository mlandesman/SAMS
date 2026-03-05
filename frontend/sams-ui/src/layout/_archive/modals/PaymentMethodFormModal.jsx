import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../../context/ClientContext';
import '../../styles/SandylandModalTheme.css';

/**
 * Modal for creating/editing payment methods
 */
const PaymentMethodFormModal = ({ paymentMethod = null, isOpen, onClose, onSave }) => {
  const { selectedClient } = useClient();
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'bank',
    currency: 'MX$ (Mexican Pesos)',
    details: '',
    status: 'active'
  });
  
  const [errors, setErrors] = useState({});

  // When a payment method is provided for editing, populate the form
  useEffect(() => {
    if (paymentMethod) {
      setFormData({
        name: paymentMethod.name || '',
        type: paymentMethod.type || 'bank',
        currency: paymentMethod.currency || 'MX$ (Mexican Pesos)',
        details: paymentMethod.details || '',
        status: paymentMethod.status || 'active'
      });
    } else {
      // Reset form for new payment method
      setFormData({
        name: '',
        type: 'bank',
        currency: 'MX$ (Mexican Pesos)',
        details: '',
        status: 'active'
      });
    }
    setErrors({});
  }, [paymentMethod, isOpen]);

  // Handle field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  // Validate the form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Payment method name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSave({
        ...formData,
        id: paymentMethod ? paymentMethod.id : null // Preserve ID if editing
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sandyland-modal-overlay" onClick={onClose}>
      <div className="sandyland-modal" onClick={e => e.stopPropagation()} style={{ width: '600px' }}>
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">
            {paymentMethod ? 'Edit Payment Method' : 'Add New Payment Method'}
          </h2>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '24px',
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="sandyland-modal-content">
          {/* Basic Information Section */}
          <div className="sandyland-form-section">
            <h3 className="sandyland-section-title">Basic Information</h3>
            
            <div className="sandyland-form-row">
              <label className="sandyland-form-label">
                Payment Method Name *
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`sandyland-form-input ${errors.name ? 'error' : ''}`}
                  placeholder="e.g., Wise, Chase Bank, Cash, etc."
                  required
                />
                {errors.name && <span className="sandyland-error-text">{errors.name}</span>}
              </label>
            </div>
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                Type
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="sandyland-form-select"
                  required
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="digital">Digital Wallet</option>
                  <option value="other">Other</option>
                </select>
              </label>
              
              <label className="sandyland-form-label">
                Currency
                <input
                  type="text"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="sandyland-form-input"
                  placeholder="e.g., MX$ (Mexican Pesos), USD, CAD"
                />
              </label>
            </div>
            
            <div className="sandyland-form-row">
              <label className="sandyland-form-label">
                Account Number
                <textarea
                  name="details"
                  value={formData.details}
                  onChange={handleChange}
                  className="sandyland-form-textarea"
                  placeholder="Account number, username, or other identifying details..."
                  rows="2"
                />
              </label>
            </div>
          </div>

          {/* Settings Section */}
          <div className="sandyland-form-section">
            <h3 className="sandyland-section-title">Settings</h3>
            
            <div className="sandyland-form-row">
              <label className="sandyland-form-label">
                Status
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="sandyland-form-select"
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          </div>
        </form>
        
        <div className="sandyland-modal-buttons">
          <button 
            type="button" 
            className="sandyland-btn sandyland-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          
          <button 
            type="submit" 
            className="sandyland-btn sandyland-btn-primary"
            onClick={handleSubmit}
          >
            {paymentMethod ? 'Update Payment Method' : 'Create Payment Method'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodFormModal;
