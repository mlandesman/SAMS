import React, { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { updateCreditBalance } from '../api/hoaDuesService';
import { isSuperAdmin, isAdmin } from '../utils/userRoles';
import { formatAsMXN } from '../utils/hoaDuesUtils';
import './CreditBalanceAddModal.css';

function CreditBalanceAddModal({ isOpen, onClose, unitId, currentBalance, year, onUpdate }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();
  
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if user has permission to add credit
  const canEdit = isSuperAdmin(samsUser) || isAdmin(samsUser, selectedClient?.id);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  const handleAdd = async () => {
    if (!canEdit) {
      setError('You do not have permission to add credits');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }

    if (!notes.trim()) {
      setError('Please provide a note explaining why this credit is being added');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newBalance = (currentBalance || 0) + amountValue;
      await updateCreditBalance(
        selectedClient.id,
        unitId,
        year,
        newBalance,
        notes.trim()
      );

      // Call the parent's update callback if provided
      if (onUpdate) {
        onUpdate();
      }

      onClose();
    } catch (err) {
      console.error('Error adding credit:', err);
      setError(err.message || 'Failed to add credit');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setAmount('');
    setNotes('');
    setError(null);
    onClose();
  };

  const amountValue = parseFloat(amount) || 0;
  const newBalance = (currentBalance || 0) + amountValue;

  if (!isOpen) {
    return null;
  }

  if (!canEdit) {
    return (
      <div className="modal-backdrop">
        <div className="credit-balance-add-modal">
          <div className="modal-header">
            <h3>Access Denied</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <p>You do not have permission to add credits.</p>
            <p>Only administrators and super administrators can add credits.</p>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="credit-balance-add-modal">
        <div className="modal-header">
          <h3>Add Credit - Unit {unitId}</h3>
          <button className="close-button" onClick={handleCancel}>×</button>
        </div>
        
        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="currentBalance">Current Balance:</label>
            <div className="current-balance">
              {formatAsMXN(currentBalance || 0)}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="amount">Amount to Add:</label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to add"
              step="0.01"
              min="0.01"
              disabled={loading}
            />
          </div>

          {amountValue > 0 && (
            <div className="balance-preview">
              <div className="preview-label">New Balance:</div>
              <div className="preview-amount positive">
                {formatAsMXN(newBalance)}
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="notes">Notes (Required):</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Please explain why this credit is being added..."
              rows="3"
              disabled={loading}
              required
            />
          </div>

          <div className="form-note">
            <strong>Note:</strong> This action will be logged in the audit trail and credit balance history.
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn-secondary" 
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleAdd}
            disabled={loading || !amountValue || amountValue <= 0 || !notes.trim()}
          >
            {loading ? 'Adding...' : 'Add Credit'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreditBalanceAddModal;
