import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../../context/ClientContext';
import '../../styles/SandylandModalTheme.css';

/**
 * Modal for creating/editing categories
 */
const CategoryFormModal = ({ category = null, isOpen, onClose, onSave }) => {
  const { selectedClient } = useClient();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'expense',
    status: 'active',
    notBudgeted: false
  });
  
  const [errors, setErrors] = useState({});

  // When a category is provided for editing, populate the form
  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        description: category.description || '',
        type: category.type || 'expense',
        status: category.status || 'active',
        notBudgeted: category.notBudgeted || false
      });
    } else {
      // Reset form for new category
      setFormData({
        name: '',
        description: '',
        type: 'expense',
        status: 'active',
        notBudgeted: false
      });
    }
    setErrors({});
  }, [category, isOpen]);

  // Handle field changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
      newErrors.name = 'Category name is required';
    }
    
    if (!formData.type.trim()) {
      newErrors.type = 'Category type is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSave(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sandyland-modal-overlay" onClick={onClose}>
      <div className="sandyland-modal" onClick={e => e.stopPropagation()} style={{ width: '600px' }}>
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">
            {category ? 'Edit Category' : 'Add New Category'}
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
                Category Name *
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`sandyland-form-input ${errors.name ? 'error' : ''}`}
                  placeholder="e.g., Utilities, Maintenance, etc."
                  required
                />
                {errors.name && <span className="sandyland-error-text">{errors.name}</span>}
              </label>
            </div>
            
            <div className="sandyland-form-row">
              <label className="sandyland-form-label">
                Description
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="sandyland-form-textarea"
                  placeholder="Optional description of this category..."
                  rows="2"
                />
              </label>
            </div>
          </div>

          {/* Classification Section */}
          <div className="sandyland-form-section">
            <h3 className="sandyland-section-title">Classification</h3>
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                Type *
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className={`sandyland-form-select ${errors.type ? 'error' : ''}`}
                  required
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
                {errors.type && <span className="sandyland-error-text">{errors.type}</span>}
              </label>
              
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
              
              <label className="sandyland-form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
                <input
                  type="checkbox"
                  name="notBudgeted"
                  checked={formData.notBudgeted}
                  onChange={handleChange}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'normal' }}>Not Budgeted</span>
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
            {category ? 'Update Category' : 'Create Category'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryFormModal;
