import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../../context/ClientContext';
import { getVendors } from '../../api/vendors';
import { getMexicoDateString } from '../../utils/timezone';
import '../../styles/SandylandModalTheme.css';

/**
 * BidFormModal - Add or edit a bid
 */
function BidFormModal({ isOpen, onClose, onSave, bid = null, isEdit = false }) {
  const { selectedClient } = useClient();
  
  // Vendors list
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  
  const [formData, setFormData] = useState({
    vendorId: '',
    vendorName: '',
    vendorPhone: '',
    vendorEmail: '',
    amount: '',
    timeline: '',
    description: '',
    inclusions: '',
    exclusions: '',
    paymentTerms: '',
    submittedAt: getMexicoDateString(),
    notes: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isRevision, setIsRevision] = useState(false);
  
  // Load vendors when modal opens
  useEffect(() => {
    if (isOpen && selectedClient) {
      loadVendors();
    }
  }, [isOpen, selectedClient]);
  
  const loadVendors = async () => {
    if (!selectedClient) return;
    
    setLoadingVendors(true);
    try {
      const result = await getVendors(selectedClient.id);
      // Sort by name and filter to active only
      const activeVendors = (result.data || [])
        .filter(v => v.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name));
      setVendors(activeVendors);
    } catch (err) {
      console.error('Error loading vendors:', err);
    } finally {
      setLoadingVendors(false);
    }
  };
  
  // Populate form when editing
  useEffect(() => {
    if (bid && isEdit) {
      const currentRevision = bid.revisions[bid.currentRevision - 1];
      
      // Find vendor by name to get ID
      const matchingVendor = vendors.find(v => v.name === bid.vendorName);
      
      setFormData({
        vendorId: matchingVendor?.id || '',
        vendorName: bid.vendorName || '',
        vendorPhone: bid.vendorContact?.phone || '',
        vendorEmail: bid.vendorContact?.email || '',
        amount: currentRevision?.amount ? (currentRevision.amount / 100).toFixed(2) : '',
        timeline: currentRevision?.timeline || '',
        description: currentRevision?.description || '',
        inclusions: currentRevision?.inclusions || '',
        exclusions: currentRevision?.exclusions || '',
        paymentTerms: currentRevision?.paymentTerms || '',
        submittedAt: currentRevision?.submittedAt || getMexicoDateString(),
        notes: ''
      });
      setIsRevision(false);
    } else {
      // Reset for new bid
      setFormData({
        vendorId: '',
        vendorName: '',
        vendorPhone: '',
        vendorEmail: '',
        amount: '',
        timeline: '',
        description: '',
        inclusions: '',
        exclusions: '',
        paymentTerms: '',
        submittedAt: getMexicoDateString(),
        notes: ''
      });
      setIsRevision(false);
    }
    setErrors({});
  }, [bid, isEdit, isOpen, vendors]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };
  
  const handleVendorChange = (e) => {
    const vendorId = e.target.value;
    const vendor = vendors.find(v => v.id === vendorId);
    
    if (vendor) {
      setFormData(prev => ({
        ...prev,
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorPhone: vendor.contact?.phone || '',
        vendorEmail: vendor.contact?.email || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        vendorId: '',
        vendorName: '',
        vendorPhone: '',
        vendorEmail: ''
      }));
    }
    
    if (errors.vendorName) {
      setErrors(prev => ({ ...prev, vendorName: null }));
    }
  };
  
  const validate = () => {
    const newErrors = {};
    
    if (!formData.vendorName.trim()) {
      newErrors.vendorName = 'Vendor is required';
    }
    
    if (!formData.amount || isNaN(parseFloat(formData.amount))) {
      newErrors.amount = 'Valid amount is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    const amountCentavos = Math.round(parseFloat(formData.amount) * 100);
    
    if (isEdit && isRevision) {
      // Submit as new revision
      onSave({
        newRevision: {
          amount: amountCentavos,
          timeline: formData.timeline,
          description: formData.description,
          inclusions: formData.inclusions,
          exclusions: formData.exclusions,
          paymentTerms: formData.paymentTerms,
          submittedAt: formData.submittedAt,
          notes: formData.notes,
          documents: []
        }
      });
    } else if (isEdit) {
      // Update vendor info only
      onSave({
        vendorName: formData.vendorName,
        vendorContact: {
          phone: formData.vendorPhone,
          email: formData.vendorEmail
        }
      });
    } else {
      // Create new bid
      onSave({
        vendorName: formData.vendorName,
        vendorContact: {
          phone: formData.vendorPhone,
          email: formData.vendorEmail
        },
        amount: amountCentavos,
        timeline: formData.timeline,
        description: formData.description,
        inclusions: formData.inclusions,
        exclusions: formData.exclusions,
        paymentTerms: formData.paymentTerms,
        submittedAt: formData.submittedAt,
        notes: formData.notes
      });
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="sandyland-modal-overlay" onClick={onClose}>
      <div 
        className="sandyland-modal" 
        onClick={e => e.stopPropagation()} 
        style={{ width: '600px', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">
            {isEdit ? (isRevision ? 'Add Bid Revision' : 'Edit Bid') : 'Add New Bid'}
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
              cursor: 'pointer'
            }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="sandyland-modal-content">
          {/* Edit mode toggle */}
          {isEdit && (
            <div className="sandyland-form-section">
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={!isRevision}
                    onChange={() => setIsRevision(false)}
                  />
                  Update Vendor Info
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={isRevision}
                    onChange={() => setIsRevision(true)}
                  />
                  Add New Revision
                </label>
              </div>
            </div>
          )}
          
          {/* Vendor Information */}
          <div className="sandyland-form-section">
            <h3 className="sandyland-section-title">Vendor Information</h3>
            
            <div className="sandyland-form-row">
              <label className="sandyland-form-label" style={{ flex: 1 }}>
                Vendor *
                <select
                  name="vendorId"
                  value={formData.vendorId}
                  onChange={handleVendorChange}
                  className={`sandyland-form-input ${errors.vendorName ? 'error' : ''}`}
                  disabled={isEdit && isRevision}
                >
                  <option value="">Select a vendor...</option>
                  {loadingVendors ? (
                    <option value="" disabled>Loading vendors...</option>
                  ) : (
                    vendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))
                  )}
                </select>
                {errors.vendorName && <span className="sandyland-error-text">{errors.vendorName}</span>}
              </label>
            </div>
            
            <div className="sandyland-form-row sandyland-form-row-split" style={{ alignItems: 'flex-start' }}>
              <label className="sandyland-form-label" style={{ flex: 1 }}>
                Phone
                <input
                  type="text"
                  name="vendorPhone"
                  value={formData.vendorPhone || '-'}
                  className="sandyland-form-input"
                  readOnly
                  style={{ backgroundColor: '#f5f5f5', color: '#666' }}
                />
              </label>
              
              <label className="sandyland-form-label" style={{ flex: 1 }}>
                Email
                <input
                  type="text"
                  name="vendorEmail"
                  value={formData.vendorEmail || '-'}
                  className="sandyland-form-input"
                  readOnly
                  style={{ backgroundColor: '#f5f5f5', color: '#666' }}
                />
              </label>
            </div>
          </div>
          
          {/* Bid Details - show for new bids or revisions */}
          {(!isEdit || isRevision) && (
            <div className="sandyland-form-section">
              <h3 className="sandyland-section-title">
                {isRevision ? `Revision ${(bid?.currentRevision || 0) + 1}` : 'Bid Details'}
              </h3>
              
              <div className="sandyland-form-row sandyland-form-row-split">
                <label className="sandyland-form-label" style={{ flex: 1 }}>
                  Amount *
                  <input
                    type="text"
                    inputMode="decimal"
                    name="amount"
                    value={formData.amount}
                    onChange={(e) => {
                      // Only allow numbers and one decimal point
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                        handleChange(e);
                      }
                    }}
                    className={`sandyland-form-input ${errors.amount ? 'error' : ''}`}
                    placeholder="33000.00"
                    style={{ MozAppearance: 'textfield' }}
                  />
                  {errors.amount && <span className="sandyland-error-text">{errors.amount}</span>}
                </label>
                
                <label className="sandyland-form-label" style={{ flex: 1 }}>
                  Timeline
                  <input
                    type="text"
                    name="timeline"
                    value={formData.timeline}
                    onChange={handleChange}
                    className="sandyland-form-input"
                    placeholder="e.g., 6-8 weeks"
                  />
                </label>
              </div>
              
              <div className="sandyland-form-row sandyland-form-row-split">
                <label className="sandyland-form-label" style={{ flex: 1 }}>
                  Date Submitted
                  <input
                    type="date"
                    name="submittedAt"
                    value={formData.submittedAt}
                    onChange={handleChange}
                    className="sandyland-form-input"
                  />
                </label>
                <div style={{ flex: 1 }}>{/* Spacer to keep date in left column */}</div>
              </div>
              
              <div className="sandyland-form-row">
                <label className="sandyland-form-label" style={{ flex: 1 }}>
                  Description / Scope
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="sandyland-form-textarea"
                    placeholder="Work scope as proposed..."
                    rows="3"
                  />
                </label>
              </div>
              
              <div className="sandyland-form-row sandyland-form-row-split">
                <label className="sandyland-form-label" style={{ flex: 1 }}>
                  Inclusions
                  <textarea
                    name="inclusions"
                    value={formData.inclusions}
                    onChange={handleChange}
                    className="sandyland-form-textarea"
                    placeholder="Labor, materials, cleanup..."
                    rows="2"
                  />
                </label>
                
                <label className="sandyland-form-label" style={{ flex: 1 }}>
                  Exclusions
                  <textarea
                    name="exclusions"
                    value={formData.exclusions}
                    onChange={handleChange}
                    className="sandyland-form-textarea"
                    placeholder="Painting, electrical..."
                    rows="2"
                  />
                </label>
              </div>
              
              <div className="sandyland-form-row">
                <label className="sandyland-form-label" style={{ flex: 1 }}>
                  Payment Terms
                  <input
                    type="text"
                    name="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={handleChange}
                    className="sandyland-form-input"
                    placeholder="e.g., 50% deposit, 50% on completion"
                  />
                </label>
              </div>
              
              <div className="sandyland-form-row">
                <label className="sandyland-form-label" style={{ flex: 1 }}>
                  Notes
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    className="sandyland-form-textarea"
                    placeholder="Internal notes about this bid/revision..."
                    rows="2"
                  />
                </label>
              </div>
            </div>
          )}
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
            {isEdit ? (isRevision ? 'Add Revision' : 'Update Vendor') : 'Add Bid'}
          </button>
        </div>
      </div>
      
      {/* CSS to hide number spinners */}
      <style>{`
        input[type="text"][inputmode="decimal"]::-webkit-outer-spin-button,
        input[type="text"][inputmode="decimal"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

export default BidFormModal;
