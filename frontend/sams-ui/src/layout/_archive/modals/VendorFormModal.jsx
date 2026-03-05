import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { getCategories } from '../../api/categories';
import { useClient } from '../../context/ClientContext';
import { LoadingSpinner, useLoadingSpinner } from '../common';
import '../../styles/SandylandModalTheme.css';

/**
 * Modal for creating/editing vendors
 */
const VendorFormModal = ({ vendor = null, isOpen, onClose, onSave }) => {
  const { selectedClient } = useClient();
  const { isLoading: isSaving, withLoading } = useLoadingSpinner();
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    contactName: '',
    phone: '',
    email: '',
    notes: '',
    status: 'active'
  });
  
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Fetch categories when modal opens
  useEffect(() => {
    const fetchCategoriesData = async () => {
      if (!isOpen || !selectedClient) return;
      
      setLoadingCategories(true);
      try {
        const result = await getCategories(selectedClient.id);
        setCategories(result.data || []);
      } catch (error) {
        console.error('❌ Error fetching categories:', error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategoriesData();
  }, [isOpen, selectedClient]);

  // When a vendor is provided for editing, populate the form
  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name || '',
        category: vendor.category || '',
        contactName: vendor.contactName || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        notes: vendor.notes || '',
        status: vendor.status || 'active'
      });
    } else {
      // Reset form for new vendor
      setFormData({
        name: '',
        category: '',
        contactName: '',
        phone: '',
        email: '',
        notes: '',
        status: 'active'
      });
    }
    setErrors({});
  }, [vendor, isOpen]);

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
      newErrors.name = 'Vendor name is required';
    }
    
    // Category is now optional - no validation needed
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      await withLoading(async () => {
        await onSave({
          ...formData,
          id: vendor ? vendor.id : null // Preserve ID if editing
        });
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sandyland-modal-overlay" onClick={onClose}>
      <div className="sandyland-modal" onClick={e => e.stopPropagation()} style={{ width: '600px' }}>
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">
            {vendor ? 'Edit Vendor' : 'Add New Vendor'}
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
                Vendor Name *
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`sandyland-form-input ${errors.name ? 'error' : ''}`}
                  placeholder="Enter vendor name"
                  required
                />
                {errors.name && <span className="sandyland-error-text">{errors.name}</span>}
              </label>
            </div>
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                Category
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="sandyland-form-select"
                  disabled={loadingCategories}
                >
                  <option value="">Select a category (optional)</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {loadingCategories && (
                  <LoadingSpinner variant="logo" size="small" message="Loading categories..." />
                )}
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
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="sandyland-form-section">
            <h3 className="sandyland-section-title">Contact Information</h3>
            
            <div className="sandyland-form-row">
              <label className="sandyland-form-label">
                Contact Name
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  className="sandyland-form-input"
                  placeholder="Enter contact person's name"
                />
              </label>
            </div>
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                Phone
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="sandyland-form-input"
                  placeholder="Enter phone number"
                />
              </label>
              
              <label className="sandyland-form-label">
                Email
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`sandyland-form-input ${errors.email ? 'error' : ''}`}
                  placeholder="Enter email address"
                />
                {errors.email && <span className="sandyland-error-text">{errors.email}</span>}
              </label>
            </div>
          </div>

          {/* Additional Information Section */}
          <div className="sandyland-form-section">
            <h3 className="sandyland-section-title">Additional Information</h3>
            
            <div className="sandyland-form-row">
              <label className="sandyland-form-label">
                Notes
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="sandyland-form-textarea"
                  placeholder="Any additional notes about this vendor..."
                  rows="3"
                />
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
            disabled={loadingCategories || isSaving}
          >
            {isSaving ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LoadingSpinner variant="logo" size="small" color="white" show={true} />
                <span>{vendor ? 'Updating...' : 'Creating...'}</span>
              </div>
            ) : (
              vendor ? 'Update Vendor' : 'Create Vendor'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorFormModal;
