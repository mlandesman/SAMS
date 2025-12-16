import React, { useState, useEffect } from 'react';
import { useClient } from '../../context/ClientContext';
import { normalizeOwners, normalizeManagers } from '../../utils/unitContactUtils.js';
import '../../styles/SandylandModalTheme.css';

/**
 * Modal for creating/editing units
 */
const UnitFormModal = ({ unit = null, isOpen, onClose, onSave }) => {
  const { selectedClient } = useClient();
  
  const [formData, setFormData] = useState({
    unitId: '',
    unitName: '',
    owners: [],  // Array of {name, email} objects
    managers: [], // Array of {name, email} objects
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

  // Migrate emails from legacy field to owner objects (aggressive migration)
  const migrateEmailsToOwners = (owners, emails) => {
    const normalizedOwners = normalizeOwners(owners);
    // Parse emails and clean them (remove empty strings, trim whitespace, remove non-printable chars)
    const emailArray = Array.isArray(emails) 
      ? emails.map(e => String(e).trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '')).filter(e => e) 
      : (emails ? String(emails).split(',').map(e => e.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '')).filter(e => e) : []);
    
    if (emailArray.length === 0) {
      return normalizedOwners;
    }
    
    // Migrate ALL emails to owners by index (overwrite existing emails)
    let migratedOwners = normalizedOwners.map((owner, index) => {
      if (emailArray[index]) {
        // Clean the email before assigning (trim and remove non-printable characters)
        const cleanEmail = emailArray[index].trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        return { ...owner, email: cleanEmail };
      }
      return owner;
    });
    
    // If there are more emails than owners, create new owner entries
    if (emailArray.length > migratedOwners.length) {
      const extraEmails = emailArray.slice(migratedOwners.length);
      extraEmails.forEach(email => {
        const cleanEmail = email.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        migratedOwners.push({ name: '', email: cleanEmail });
      });
    }
    
    return migratedOwners;
  };

  // When a unit is provided for editing, populate the form
  useEffect(() => {
    if (unit) {
      // Normalize owners/managers to new structure
      let normalizedOwners = normalizeOwners(unit.owners);
      const normalizedManagers = normalizeManagers(unit.managers);
      
      // Migrate emails from legacy field to owner objects (if emails field exists)
      if (unit.emails && (Array.isArray(unit.emails) || typeof unit.emails === 'string')) {
        normalizedOwners = migrateEmailsToOwners(unit.owners, unit.emails);
      }
      
      // Clean up owners/managers emails (trim whitespace)
      const cleanedOwners = normalizedOwners.map(owner => ({
        ...owner,
        email: owner.email ? owner.email.trim() : ''
      }));
      const cleanedManagers = normalizedManagers.map(manager => ({
        ...manager,
        email: manager.email ? manager.email.trim() : ''
      }));
      
      setFormData({
        unitId: unit.unitId || '',
        unitName: unit.unitName || '',
        owners: cleanedOwners.length > 0 ? cleanedOwners : [{ name: '', email: '' }],
        managers: cleanedManagers.length > 0 ? cleanedManagers : [],
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
        owners: [{ name: '', email: '' }], // Start with one empty owner row
        managers: [],
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
    
    // Validate owners - at least one owner with name required
    const validOwners = formData.owners.filter(owner => owner.name && owner.name.trim());
    if (validOwners.length === 0) {
      newErrors.owners = 'At least one owner name is required';
    }
    
    // Validate email formats for owners (only validate if email is provided)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    formData.owners.forEach((owner, index) => {
      // Ensure email is a string and clean it
      let email = '';
      if (owner.email) {
        email = String(owner.email).trim();
      }
      // Only validate if email is provided and not empty
      if (email) {
        // Remove any non-printable characters that might cause issues
        const cleanEmail = email.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        if (!emailRegex.test(cleanEmail)) {
          newErrors[`ownerEmail${index}`] = `Invalid email format: "${email}"`;
          console.warn(`Invalid email format detected for owner ${index}:`, {
            original: owner.email,
            cleaned: cleanEmail,
            emailType: typeof owner.email
          });
        }
      }
    });
    
    // Validate email formats for managers (only validate if email is provided)
    formData.managers.forEach((manager, index) => {
      // Ensure email is a string and clean it
      let email = '';
      if (manager.email) {
        email = String(manager.email).trim();
      }
      // Only validate if email is provided and not empty
      if (email) {
        // Remove any non-printable characters that might cause issues
        const cleanEmail = email.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        if (!emailRegex.test(cleanEmail)) {
          newErrors[`managerEmail${index}`] = `Invalid email format: "${email}"`;
          console.warn(`Invalid email format detected for manager ${index}:`, {
            original: manager.email,
            cleaned: cleanEmail,
            emailType: typeof manager.email
          });
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper functions for managing owners/managers arrays
  const updateOwner = (index, field, value) => {
    const newOwners = [...formData.owners];
    newOwners[index] = { ...newOwners[index], [field]: value };
    setFormData({ ...formData, owners: newOwners });
  };

  const addOwner = () => {
    setFormData({
      ...formData,
      owners: [...formData.owners, { name: '', email: '' }]
    });
  };

  const removeOwner = (index) => {
    const newOwners = formData.owners.filter((_, i) => i !== index);
    // Ensure at least one owner row exists
    if (newOwners.length === 0) {
      newOwners.push({ name: '', email: '' });
    }
    setFormData({ ...formData, owners: newOwners });
  };

  const updateManager = (index, field, value) => {
    const newManagers = [...formData.managers];
    newManagers[index] = { ...newManagers[index], [field]: value };
    setFormData({ ...formData, managers: newManagers });
  };

  const addManager = () => {
    setFormData({
      ...formData,
      managers: [...formData.managers, { name: '', email: '' }]
    });
  };

  const removeManager = (index) => {
    const newManagers = formData.managers.filter((_, i) => i !== index);
    setFormData({ ...formData, managers: newManagers });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Filter out empty owners/managers and normalize
      const ownersArray = formData.owners
        .map(owner => ({
          name: (owner.name || '').trim(),
          email: (owner.email || '').trim()
        }))
        .filter(owner => owner.name); // Remove entries without names
      
      const managersArray = formData.managers
        .map(manager => ({
          name: (manager.name || '').trim(),
          email: (manager.email || '').trim()
        }))
        .filter(manager => manager.name); // Remove entries without names
      
      // Don't store square meters - calculate on display only
      // Remove active field - doesn't make sense
      // Note: emails field is removed - emails are now in owner objects
      const { emails, ...formDataWithoutEmails } = formData; // Explicitly exclude emails field
      const submitData = {
        ...formDataWithoutEmails,
        owners: ownersArray,
        managers: managersArray,
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
              
              {/* Owners Section */}
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label className="required">Owners</label>
                  {formData.owners.map((owner, index) => (
                    <div key={index} className="sandyland-form-row" style={{ marginBottom: '8px', alignItems: 'flex-end' }}>
                      <div className="sandyland-form-field" style={{ flex: 1, marginRight: '8px' }}>
                        <input
                          type="text"
                          placeholder="Owner Name"
                          value={owner.name}
                          onChange={(e) => updateOwner(index, 'name', e.target.value)}
                          required={index === 0}
                        />
                      </div>
                      <div className="sandyland-form-field" style={{ flex: 1, marginRight: '8px' }}>
                        <input
                          type="email"
                          placeholder="Email (optional)"
                          value={owner.email || ''}
                          onChange={(e) => updateOwner(index, 'email', e.target.value)}
                          onBlur={(e) => {
                            // Trim email on blur to clean up whitespace
                            const trimmedEmail = e.target.value.trim();
                            if (trimmedEmail !== (owner.email || '')) {
                              updateOwner(index, 'email', trimmedEmail);
                            }
                            // Clear error if email is now valid
                            if (trimmedEmail && errors[`ownerEmail${index}`]) {
                              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                              if (emailRegex.test(trimmedEmail)) {
                                const newErrors = { ...errors };
                                delete newErrors[`ownerEmail${index}`];
                                setErrors(newErrors);
                              }
                            }
                          }}
                        />
                        {errors[`ownerEmail${index}`] && (
                          <span className="sandyland-error-text" style={{ display: 'block', marginTop: '4px' }}>
                            {errors[`ownerEmail${index}`]}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOwner(index)}
                        className="sandyland-btn sandyland-btn-secondary"
                        style={{ padding: '8px 12px', minWidth: 'auto' }}
                        disabled={formData.owners.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOwner}
                    className="sandyland-btn sandyland-btn-secondary"
                    style={{ marginTop: '8px', padding: '8px 16px' }}
                  >
                    + Add Owner
                  </button>
                  {errors.owners && <span className="sandyland-error-text">{errors.owners}</span>}
                  <span className="sandyland-helper-text">At least one owner name is required. Email is optional.</span>
                </div>
              </div>
              
              {/* Managers Section */}
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label>Unit Managers</label>
                  {formData.managers.length > 0 ? (
                    <>
                      {formData.managers.map((manager, index) => (
                        <div key={index} className="sandyland-form-row" style={{ marginBottom: '8px', alignItems: 'flex-end' }}>
                          <div className="sandyland-form-field" style={{ flex: 1, marginRight: '8px' }}>
                            <input
                              type="text"
                              placeholder="Manager Name"
                              value={manager.name}
                              onChange={(e) => updateManager(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="sandyland-form-field" style={{ flex: 1, marginRight: '8px' }}>
                            <input
                              type="email"
                              placeholder="Email (optional)"
                              value={manager.email}
                              onChange={(e) => updateManager(index, 'email', e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeManager(index)}
                            className="sandyland-btn sandyland-btn-secondary"
                            style={{ padding: '8px 12px', minWidth: 'auto' }}
                          >
                            Remove
                          </button>
                          {errors[`managerEmail${index}`] && (
                            <span className="sandyland-error-text" style={{ width: '100%', marginTop: '4px' }}>
                              {errors[`managerEmail${index}`]}
                            </span>
                          )}
                        </div>
                      ))}
                    </>
                  ) : (
                    <p style={{ fontStyle: 'italic', color: '#666', marginBottom: '8px' }}>No managers added</p>
                  )}
                  <button
                    type="button"
                    onClick={addManager}
                    className="sandyland-btn sandyland-btn-secondary"
                    style={{ marginTop: '8px', padding: '8px 16px' }}
                  >
                    + Add Manager
                  </button>
                  {errors.managers && <span className="sandyland-error-text">{errors.managers}</span>}
                  <span className="sandyland-helper-text">Managers are optional. Email is optional.</span>
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
