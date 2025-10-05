import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useClient } from '../../context/ClientContext';
import { canUserPerformOperation } from '../../utils/userRoles';
import { getMexicoDateString, getMexicoDateTime } from '../../utils/timezone';
import { databaseFieldMappings } from '../../utils/databaseFieldMappings';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import './WashModal.css';

const WashModal = ({ 
  isOpen, 
  onClose, 
  onSave,
  unitId,
  unitLabel,
  initialWashes = [],
  loading = false,
  carWashRate = 100,
  boatWashRate = 200
}) => {
  const { samsUser } = useAuth();
  const { selectedClient: currentClient } = useClient();
  
  const [washes, setWashes] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [newWash, setNewWash] = useState({
    type: 'car',
    date: getMexicoDateString()
  });
  const [error, setError] = useState('');

  // Wash pricing from props (passed from aggregated data)
  const WASH_PRICES = {
    car: carWashRate,
    boat: boatWashRate
  };

  const WASH_LABELS = {
    car: 'Car Wash',
    boat: 'Boat Wash'
  };

  // Permission checks
  const canEdit = canUserPerformOperation(samsUser, 'edit', 'waterReadings', currentClient?.id, { unitId });
  const canDelete = canUserPerformOperation(samsUser, 'delete', 'waterReadings', currentClient?.id, { unitId });
  const canCreate = canUserPerformOperation(samsUser, 'create', 'waterReadings', currentClient?.id, { unitId });

  // Helper function to log audit events
  const logAuditEvent = async (action, washData, notes = '') => {
    try {
      // Note: In a full implementation, this would call a backend API to log the audit event
      // For now, we'll log to console and could enhance to call waterAPI.logAuditEvent()
      const auditData = {
        module: 'waterReadings',
        action: action, // 'create', 'update', 'delete'
        parentPath: `clients/${currentClient?.id}/projects/waterBills/readings`,
        docId: `unit-${unitId}-wash`,
        friendlyName: `${WASH_LABELS[washData.type]} for Unit ${unitLabel}`,
        notes: notes,
        clientId: currentClient?.id,
        unitId: unitId,
        userEmail: samsUser?.email,
        timestamp: getMexicoDateTime().toISOString(),
        washData: washData
      };
      
      console.log(`🔍 Audit Log - ${action.toUpperCase()}:`, auditData);
      
      // TODO: Implement actual backend audit logging
      // await waterAPI.logAuditEvent(auditData);
      
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging failure shouldn't block the operation
    }
  };


  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setWashes([...initialWashes]);
      setEditingIndex(null);
      setNewWash({
        type: 'car',
        date: getMexicoDateString()
      });
      setError('');
    }
  }, [isOpen, initialWashes]);

  const validateWash = (wash) => {
    if (!wash.date) {
      return 'Date is required';
    }
    if (!wash.type || !['car', 'boat'].includes(wash.type)) {
      return 'Valid wash type is required';
    }
    return null;
  };

  const handleAddWash = async () => {
    // Check permissions
    if (!canCreate) {
      setError('You do not have permission to add wash entries');
      return;
    }

    const validation = validateWash(newWash);
    if (validation) {
      setError(validation);
      return;
    }

    const washEntry = {
      type: newWash.type,
      date: newWash.date,
      timestamp: getMexicoDateTime().toISOString(),
      cost: WASH_PRICES[newWash.type]
    };

    // Add to memory immediately (fast UI response)
    setWashes([...washes, washEntry]);
    setNewWash({
      type: 'car',
      date: getMexicoDateString()
    });
    setError('');
  };

  const handleEditWash = (index) => {
    // Check permissions
    if (!canEdit) {
      setError('You do not have permission to edit wash entries');
      return;
    }

    setEditingIndex(index);
    setNewWash({
      type: washes[index].type,
      date: washes[index].date
    });
    setError('');
  };

  const handleUpdateWash = async () => {
    const validation = validateWash(newWash);
    if (validation) {
      setError(validation);
      return;
    }

    const originalWash = washes[editingIndex];
    const updatedWashes = [...washes];
    const updatedWash = {
      ...updatedWashes[editingIndex],
      type: newWash.type,
      date: newWash.date,
      cost: WASH_PRICES[newWash.type],
      timestamp: getMexicoDateTime().toISOString() // Update timestamp for audit
    };
    
    updatedWashes[editingIndex] = updatedWash;

    // Log audit event with before/after comparison
    const changeNotes = `Updated wash: ${WASH_LABELS[originalWash.type]} (${originalWash.date}) → ${WASH_LABELS[updatedWash.type]} (${updatedWash.date})`;
    await logAuditEvent('update', updatedWash, changeNotes);

    setWashes(updatedWashes);
    setEditingIndex(null);
    setNewWash({
      type: 'car',
      date: new Date().toISOString().split('T')[0]
    });
    setError('');
  };

  const handleDeleteWash = async (index) => {
    // Check permissions
    if (!canDelete) {
      setError('You do not have permission to delete wash entries');
      return;
    }

    const washToDelete = washes[index];
    const confirmMessage = `Are you sure you want to delete this ${WASH_LABELS[washToDelete.type]} entry from ${formatDate(washToDelete.date)}?`;
    
    if (window.confirm(confirmMessage)) {
      // Log audit event before deletion
      await logAuditEvent('delete', washToDelete, `Deleted ${WASH_LABELS[washToDelete.type]} from ${washToDelete.date}`);

      const updatedWashes = washes.filter((_, i) => i !== index);
      setWashes(updatedWashes);
      
      // If we were editing this item, clear the form
      if (editingIndex === index) {
        setEditingIndex(null);
        setNewWash({
          type: 'car',
          date: getMexicoDateString()
        });
      }
    }
  };

  const handleSave = async () => {
    try {
      setError('');
      // Just update parent component state and close
      await onSave(unitId, washes);
      onClose();
    } catch (err) {
      console.error('Error updating washes:', err);
      setError(err.message || 'Failed to update wash entries');
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setNewWash({
      type: 'car',
      date: getMexicoDateString()
    });
  };

  const calculateTotalCost = () => {
    return washes.reduce((total, wash) => total + (WASH_PRICES[wash.type] || 0), 0);
  };

  const formatDate = (dateString) => {
    const mexDate = getMexicoDateTime(dateString);
    return mexDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Cancun'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="wash-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wash-modal">
        <div className="wash-modal-header">
          <h3>
            <i className="fas fa-car-wash"></i>
            Manage Washes - Unit {unitLabel}
          </h3>
          <button 
            className="wash-modal-close" 
            onClick={onClose}
            disabled={loading}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="wash-modal-content">
          {error && (
            <div className="wash-error-message">
              <i className="fas fa-exclamation-triangle"></i>
              {error}
            </div>
          )}

          {/* Permission Warning */}
          {!canCreate && !canEdit && !canDelete && (
            <div className="wash-permission-warning">
              <i className="fas fa-info-circle"></i>
              You have read-only access to wash entries. Contact an administrator to make changes.
            </div>
          )}

          {/* Existing Washes List */}
          <div className="wash-list-section">
            <h4>Current Washes ({washes.length})</h4>
            {washes.length === 0 ? (
              <div className="wash-list-empty">
                No wash entries for this unit.
              </div>
            ) : (
              <div className="wash-list">
                {washes.map((wash, index) => (
                  <div key={index} className="wash-item">
                    <div className="wash-item-info">
                      <div className="wash-item-type">
                        <i className={`fas ${wash.type === 'car' ? 'fa-car' : 'fa-ship'}`}></i>
                        {WASH_LABELS[wash.type]}
                      </div>
                      <div className="wash-item-date">
                        {formatDate(wash.date)}
                      </div>
                      <div className="wash-item-cost">
                        ${databaseFieldMappings.centsToDollars(wash.cost).toFixed(2)}
                      </div>
                    </div>
                    <div className="wash-item-actions">
                      {canEdit && (
                        <button 
                          className="wash-btn wash-btn-edit"
                          onClick={() => handleEditWash(index)}
                          disabled={loading || editingIndex !== null}
                          title="Edit wash entry"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          className="wash-btn wash-btn-delete"
                          onClick={() => handleDeleteWash(index)}
                          disabled={loading}
                          title="Delete wash entry"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      )}
                      {!canEdit && !canDelete && (
                        <div className="wash-item-readonly" title="Read-only access">
                          <i className="fas fa-eye"></i>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add/Edit Wash Form */}
          {(canCreate || (editingIndex !== null && canEdit)) && (
            <div className="wash-form-section">
              <h4>{editingIndex !== null ? 'Edit Wash Entry' : 'Add New Wash'}</h4>
            <div className="wash-form">
              <div className="wash-form-row">
                <div className="wash-form-group">
                  <label>Wash Type</label>
                  <div className="wash-type-selector">
                    <label className={`wash-type-option ${newWash.type === 'car' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="washType"
                        value="car"
                        checked={newWash.type === 'car'}
                        onChange={(e) => setNewWash({...newWash, type: e.target.value})}
                        disabled={loading}
                      />
                      <i className="fas fa-car"></i>
                      <span>Car Wash</span>
                      <span className="wash-price">${WASH_PRICES.car}</span>
                    </label>
                    <label className={`wash-type-option ${newWash.type === 'boat' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="washType"
                        value="boat"
                        checked={newWash.type === 'boat'}
                        onChange={(e) => setNewWash({...newWash, type: e.target.value})}
                        disabled={loading}
                      />
                      <i className="fas fa-ship"></i>
                      <span>Boat Wash</span>
                      <span className="wash-price">${WASH_PRICES.boat}</span>
                    </label>
                  </div>
                </div>
                <div className="wash-form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={newWash.date}
                    onChange={(e) => {
                      // Send date string directly - backend handles timezone conversion
                      setNewWash({...newWash, date: e.target.value});
                    }}
                    disabled={loading}
                    className="wash-date-input"
                  />
                </div>
              </div>
              <div className="wash-form-actions">
                {editingIndex !== null && (
                  <button 
                    className="wash-btn wash-btn-secondary"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Cancel Edit
                  </button>
                )}
                <button 
                  className="wash-btn wash-btn-primary"
                  onClick={editingIndex !== null ? handleUpdateWash : handleAddWash}
                  disabled={loading || !newWash.date}
                >
                  {editingIndex !== null ? 'Update Wash' : 'Add Wash'}
                </button>
              </div>
            </div>
            </div>
          )}

          {/* Summary */}
          {washes.length > 0 && (
            <div className="wash-summary">
              <div className="wash-summary-item">
                <span>Car Washes:</span>
                <span>{washes.filter(w => w.type === 'car').length}</span>
              </div>
              <div className="wash-summary-item">
                <span>Boat Washes:</span>
                <span>{washes.filter(w => w.type === 'boat').length}</span>
              </div>
              <div className="wash-summary-item wash-summary-total">
                <span>Total Cost:</span>
                <span>${calculateTotalCost()}</span>
              </div>
            </div>
          )}
        </div>

        <div className="wash-modal-footer">
          <button 
            className="wash-btn wash-btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className="wash-btn wash-btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WashModal;