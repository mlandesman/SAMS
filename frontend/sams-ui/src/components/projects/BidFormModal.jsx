import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../../context/ClientContext';
import { getVendors } from '../../api/vendors';
import { getMexicoDateString } from '../../utils/timezone';
import { centavosToPesos } from '../../utils/currencyUtils';
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
    submittedAt: getMexicoDateString(),
    notes: ''
  });

  const [installments, setInstallments] = useState([{ milestone: '', percentOfTotal: 100 }]);
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
        submittedAt: currentRevision?.submittedAt || getMexicoDateString(),
        notes: ''
      });

      if (currentRevision?.installments && Array.isArray(currentRevision.installments) && currentRevision.installments.length > 0) {
        setInstallments(currentRevision.installments.map(i => ({
          milestone: i.milestone || '',
          percentOfTotal: i.percentOfTotal ?? ''
        })));
      } else if (currentRevision?.paymentTerms) {
        setInstallments([{ milestone: currentRevision.paymentTerms || 'Full Payment', percentOfTotal: 100 }]);
      } else {
        setInstallments([{ milestone: '', percentOfTotal: 100 }]);
      }
      setIsRevision(false);
    } else {
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
        submittedAt: getMexicoDateString(),
        notes: ''
      });
      setInstallments([{ milestone: '', percentOfTotal: 100 }]);
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
  
  const handleAddInstallment = () => {
    setInstallments(prev => [...prev, { milestone: '', percentOfTotal: '' }]);
  };

  const handleRemoveInstallment = (index) => {
    setInstallments(prev => prev.filter((_, i) => i !== index));
  };

  const handleInstallmentChange = (index, field, value) => {
    setInstallments(prev => prev.map((row, i) =>
      i === index ? { ...row, [field]: value } : row
    ));
  };

  const installmentSum = installments.reduce((s, row) => s + (Number(row.percentOfTotal) || 0), 0);
  const installmentValid = installmentSum === 100;

  const validate = () => {
    const newErrors = {};

    if (!formData.vendorName.trim()) {
      newErrors.vendorName = 'Vendor is required';
    }

    if ((!isEdit || isRevision) && (!formData.amount || isNaN(parseFloat(formData.amount)))) {
      newErrors.amount = 'Valid amount is required';
    }

    if ((!isEdit || isRevision) && installments.length > 0) {
      for (let i = 0; i < installments.length; i++) {
        const row = installments[i];
        if (!String(row.milestone || '').trim()) {
          newErrors.installments = `Row ${i + 1}: milestone is required`;
          break;
        }
        const pct = Number(row.percentOfTotal);
        if (!Number.isInteger(pct) || pct <= 0 || pct > 100) {
          newErrors.installments = `Row ${i + 1}: percent must be 1-100`;
          break;
        }
      }
      if (!newErrors.installments && installmentSum !== 100) {
        newErrors.installments = `Installment total must be 100% (currently ${installmentSum}%)`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    const amountCentavos = Math.round(parseFloat(formData.amount) * 100);
    
    if (isEdit && isRevision) {
      onSave({
        newRevision: {
          amount: amountCentavos,
          timeline: formData.timeline,
          description: formData.description,
          inclusions: formData.inclusions,
          exclusions: formData.exclusions,
          installments: installments.map(row => ({
            milestone: String(row.milestone || '').trim(),
            percentOfTotal: Number(row.percentOfTotal) || 0
          })).filter(row => row.milestone && row.percentOfTotal > 0),
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
        installments: installments.map(row => ({
          milestone: String(row.milestone || '').trim(),
          percentOfTotal: Number(row.percentOfTotal) || 0
        })).filter(row => row.milestone && row.percentOfTotal > 0),
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
              
              <div className="sandyland-form-section" style={{ marginTop: 16 }}>
                <h4 className="sandyland-section-title" style={{ fontSize: '0.95rem', marginBottom: 8 }}>Installment Schedule</h4>
                <p className="sandyland-form-hint" style={{ marginBottom: 12, fontSize: '0.85rem' }}>
                  Define when the vendor expects payment. Percentages must total 100%.
                </p>
                {installments.map((row, index) => (
                  <div key={index} className="sandyland-form-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <label className="sandyland-form-label" style={{ flex: '1 1 180px' }}>
                      Milestone
                      <input
                        type="text"
                        value={row.milestone}
                        onChange={(e) => handleInstallmentChange(index, 'milestone', e.target.value)}
                        className={`sandyland-form-input ${errors.installments ? 'error' : ''}`}
                        placeholder="e.g., Contract Signing"
                      />
                    </label>
                    <label className="sandyland-form-label" style={{ flex: '0 1 80px' }}>
                      % of Total
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={row.percentOfTotal}
                        onChange={(e) => handleInstallmentChange(index, 'percentOfTotal', e.target.value)}
                        className={`sandyland-form-input ${errors.installments ? 'error' : ''}`}
                        placeholder="%"
                      />
                    </label>
                    {bid?.allocationSnapshot?.allocations && formData.amount && (
                      <span className="sandyland-form-hint" style={{ flex: '1 1 200px', alignSelf: 'flex-end', fontSize: '0.8rem' }}>
                        {Object.entries(bid.allocationSnapshot.allocations)
                          .filter(([, c]) => c > 0)
                          .slice(0, 3)
                          .map(([unitId, centavos]) => {
                            const amount = centavosToPesos(Math.round((centavos || 0) * (Number(row.percentOfTotal) || 0) / 100));
                            return `${unitId}: $${amount.toFixed(2)}`;
                          })
                          .join(', ')}
                        {Object.keys(bid.allocationSnapshot.allocations || {}).length > 3 ? '...' : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveInstallment(index)}
                      className="sandyland-btn sandyland-btn-secondary"
                      style={{ padding: '8px 12px', alignSelf: 'flex-end' }}
                      title="Remove row"
                      disabled={installments.length <= 1}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                ))}
                <div className="sandyland-form-row" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button type="button" onClick={handleAddInstallment} className="sandyland-btn sandyland-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FontAwesomeIcon icon={faPlus} />
                    Add installment
                  </button>
                  <span style={{ color: installmentValid ? '#2e7d32' : (installmentSum > 0 ? '#d32f2f' : '#666'), fontWeight: 500, fontSize: '0.9rem' }}>
                    {installmentSum}% of 100%
                  </span>
                  {errors.installments && <span className="sandyland-error-text">{errors.installments}</span>}
                </div>
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
