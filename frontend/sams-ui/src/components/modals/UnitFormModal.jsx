import React, { useState, useEffect } from 'react';
import { useClient } from '../../context/ClientContext';
import '../../styles/SandylandModalTheme.css';

/**
 * Modal for creating/editing units
 */
const UnitFormModal = ({ unit = null, isOpen, onClose, onSave }) => {
  const { selectedClient } = useClient();
  
  const [formData, setFormData] = useState({
    unitId: '',
    unitName: '',
    owners: '',  // Will be converted to/from array
    managers: '', // Will be converted to/from array
    emails: '',  // Will be converted to/from array
    address: '',
    status: 'active',
    squareFeet: '',
    percentOwned: '',
    duesAmount: '',
    type: 'condo',
    accessCode: '',
    notes: ''
  });
  
  const [errors, setErrors] = useState({});

  // When a unit is provided for editing, populate the form
  useEffect(() => {
    if (unit) {
      setFormData({
        unitId: unit.unitId || '',
        unitName: unit.unitName || '',
        owners: Array.isArray(unit.owners) ? unit.owners.join(', ') : (unit.owners || ''),
        managers: Array.isArray(unit.managers) ? unit.managers.join(', ') : (unit.managers || ''),
        emails: Array.isArray(unit.emails) ? unit.emails.join(', ') : (unit.emails || ''),
        address: unit.address || '',
        status: unit.status || 'Occupied',
        squareFeet: unit.squareFeet || '',
        percentOwned: unit.percentOwned || '',
        duesAmount: unit.duesAmount || '',
        type: unit.type || 'condo',
        accessCode: unit.accessCode || '',
        notes: unit.notes || ''
      });
    } else {
      // Reset form for new unit
      setFormData({
        unitId: '',
        unitName: '',
        owners: '',
        managers: '',
        emails: '',
        address: '',
        status: 'active',
        squareFeet: '',
        percentOwned: '',
        duesAmount: '',
        type: 'condo',
        accessCode: '',
        notes: ''
      });
    }
    setErrors({});
  }, [unit, isOpen]);

  // Auto-calculate percentage ownership when square feet changes
  useEffect(() => {
    if (formData.squareFeet && selectedClient?.squareFeet) {
      const percentage = (parseFloat(formData.squareFeet) / parseFloat(selectedClient.squareFeet)) * 100;
      setFormData(prev => ({
        ...prev,
        percentOwned: percentage.toFixed(12) // High precision for small percentages
      }));
    }
  }, [formData.squareFeet, selectedClient?.squareFeet]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.unitId.trim()) {
      newErrors.unitId = 'Unit ID is required';
    }
    
    if (!formData.owners.trim()) {
      newErrors.owners = 'At least one owner is required';
    }
    
    // Validate email format if provided
    if (formData.emails.trim()) {
      const emailArray = formData.emails.split(',').map(email => email.trim());
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emailArray.filter(email => email && !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        newErrors.emails = `Invalid email format: ${invalidEmails.join(', ')}`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Convert comma-separated strings back to arrays
      const ownersArray = formData.owners
        .split(',')
        .map(owner => owner.trim())
        .filter(owner => owner.length > 0);
      
      const managersArray = formData.managers
        .split(',')
        .map(manager => manager.trim())
        .filter(manager => manager.length > 0);
      
      const emailsArray = formData.emails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);
      
      // Don't store square meters - calculate on display only
      // Remove active field - doesn't make sense
      const submitData = {
        ...formData,
        owners: ownersArray,
        managers: managersArray,
        emails: emailsArray,
        squareFeet: formData.squareFeet ? parseFloat(formData.squareFeet) : undefined,
        squareMeters: formData.squareFeet ? Math.round(parseFloat(formData.squareFeet) * 0.092903) : undefined,
        percentOwned: formData.percentOwned ? parseFloat(formData.percentOwned) : undefined,
        duesAmount: formData.duesAmount ? parseFloat(formData.duesAmount) : undefined,
        propertyType: formData.type || 'condo'
        // Note: Units don't have an 'id' field - unitId IS the document ID
      };
      
      // Remove undefined fields to avoid sending unnecessary data
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined || submitData[key] === '') {
          delete submitData[key];
        }
      });
      
      onSave(submitData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sandyland-modal-overlay" onClick={onClose}>
      <div className="sandyland-modal" onClick={e => e.stopPropagation()}>
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">
            {unit ? 'Edit Unit' : 'Add New Unit'}
          </h2>
        </div>
        
        <div className="sandyland-modal-content">
          <form onSubmit={handleSubmit}>
            {/* Basic Unit Information */}
            <div className="sandyland-form-section">
              <h3 className="sandyland-section-title">Basic Information</h3>
              
              <div className="sandyland-form-row">
                <div className="sandyland-form-field">
                  <label htmlFor="unitId" className="required">Unit ID</label>
                  <input
                    id="unitId"
                    name="unitId"
                    value={formData.unitId}
                    onChange={handleChange}
                    placeholder="e.g., PH-A1, 101, Unit 5B"
                    required
                  />
                  {errors.unitId && <span className="sandyland-error-text">{errors.unitId}</span>}
                </div>
                
                <div className="sandyland-form-field">
                  <label htmlFor="unitName">Unit Name</label>
                  <input
                    id="unitName"
                    name="unitName"
                    value={formData.unitName}
                    onChange={handleChange}
                    placeholder="e.g., Villa Brandini, Penthouse A"
                  />
                </div>
              </div>
              
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label htmlFor="owners" className="required">Owner Names</label>
                  <input
                    id="owners"
                    name="owners"
                    value={formData.owners}
                    onChange={handleChange}
                    placeholder="e.g., John Doe, Jane & John Smith"
                    required
                  />
                  <span className="sandyland-helper-text">Enter multiple names separated by commas (e.g., John Doe, Jane Smith)</span>
                  {errors.owners && <span className="sandyland-error-text">{errors.owners}</span>}
                </div>
              </div>
              
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label htmlFor="managers">Unit Managers</label>
                  <input
                    id="managers"
                    name="managers"
                    value={formData.managers}
                    onChange={handleChange}
                    placeholder="e.g., Property Manager, Assistant Manager"
                  />
                  <span className="sandyland-helper-text">Enter multiple managers separated by commas</span>
                  {errors.managers && <span className="sandyland-error-text">{errors.managers}</span>}
                </div>
              </div>
              
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label htmlFor="emails">Email Addresses</label>
                  <input
                    id="emails"
                    name="emails"
                    value={formData.emails}
                    onChange={handleChange}
                    placeholder="e.g., john@email.com, jane@email.com"
                  />
                  <span className="sandyland-helper-text">Enter multiple emails separated by commas</span>
                  {errors.emails && <span className="sandyland-error-text">{errors.emails}</span>}
                </div>
              </div>
              
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label htmlFor="address">Address</label>
                  <input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="e.g., 123 Main St, Unit 101"
                  />
                  {errors.address && <span className="sandyland-error-text">{errors.address}</span>}
                </div>
              </div>
              
              <div className="sandyland-form-row">
                <div className="sandyland-form-field">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                
                <div className="sandyland-form-field">
                  <label htmlFor="type">Type</label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                  >
                    <option value="condo">Condo</option>
                    <option value="house">House</option>
                    <option value="villa">Villa</option>
                    <option value="apartment">Apartment</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Financial Information */}
            <div className="sandyland-form-section">
              <h3 className="sandyland-section-title">Financial Information</h3>
              
              <div className="sandyland-form-row">
                <div className="sandyland-form-field">
                  <label htmlFor="squareFeet">Square Feet</label>
                  <input
                    id="squareFeet"
                    name="squareFeet"
                    type="number"
                    value={formData.squareFeet}
                    onChange={handleChange}
                    placeholder="e.g., 1500"
                  />
                  <span className="sandyland-helper-text">
                    Auto-calculates ownership % (Total: {selectedClient?.squareFeet ? Number(selectedClient.squareFeet).toLocaleString() : 'N/A'} sq ft)
                  </span>
                  {errors.squareFeet && <span className="sandyland-error-text">{errors.squareFeet}</span>}
                </div>
                
                <div className="sandyland-form-field">
                  <label htmlFor="percentOwned">Percentage Owned</label>
                  <input
                    id="percentOwned"
                    name="percentOwned"
                    type="text"
                    value={formData.percentOwned ? `${Number(formData.percentOwned).toFixed(4)}%` : ''}
                    className="sandyland-auto-calculated"
                    readOnly
                  />
                  <span className="sandyland-helper-text">Auto-calculated from square feet</span>
                  {errors.percentOwned && <span className="sandyland-error-text">{errors.percentOwned}</span>}
                </div>
              </div>
              
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label htmlFor="duesAmount">Monthly Dues Amount</label>
                  <input
                    id="duesAmount"
                    name="duesAmount"
                    type="number"
                    value={formData.duesAmount}
                    onChange={handleChange}
                    placeholder="e.g., 4600"
                  />
                  <span className="sandyland-helper-text">
                    {formData.duesAmount ? `MX$${Number(formData.duesAmount).toLocaleString()}` : 'Enter amount'}
                  </span>
                  {errors.duesAmount && <span className="sandyland-error-text">{errors.duesAmount}</span>}
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="sandyland-form-section">
              <h3 className="sandyland-section-title">Additional Information</h3>
              
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label htmlFor="accessCode">Access Code</label>
                  <input
                    id="accessCode"
                    name="accessCode"
                    value={formData.accessCode}
                    onChange={handleChange}
                    placeholder="Unit access code or key information"
                  />
                </div>
              </div>
              
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Any additional notes about this unit..."
                  />
                </div>
              </div>
            </div>
          </form>
        </div>
        
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
            {unit ? 'Update Unit' : 'Create Unit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnitFormModal;
