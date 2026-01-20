import React, { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { updateCreditBalance } from '../api/hoaDuesService';
import { isSuperAdmin, isAdmin } from '../utils/userRoles';
import { formatAsMXN } from '../utils/hoaDuesUtils';
import './CreditBalanceRemoveModal.css';

function CreditBalanceRemoveModal({ isOpen, onClose, unitId, currentBalance, year, onUpdate }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();
  
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if user has permission to remove credit
  const canEdit = isSuperAdmin(samsUser) || isAdmin(samsUser, selectedClient?.id);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  const handleRemove = async () => {
    if (!canEdit) {
      setError('You do not have permission to remove credits');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }

    if (amountValue > (currentBalance || 0)) {
      setError(`Cannot remove more than the current balance of ${formatAsMXN(currentBalance || 0)}`);
      return;
    }

    if (!notes.trim()) {
      setError('Please provide a note explaining why this credit is being removed');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newBalance = (currentBalance || 0) - amountValue;
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
      console.error('Error removing credit:', err);
      setError(err.message || 'Failed to remove credit');
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
  const newBalance = Math.max(0, (currentBalance || 0) - amountValue);
  const exceedsBalance = amountValue > (currentBalance || 0);

  if (!isOpen) {
    return null;
  }

  if (!canEdit) {
    return (
      <div className="modal-backdrop">
        <div className="credit-balance-remove-modal">
          <div className="modal-header">
            <h3>Access Denied</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <p>You do not have permission to remove credits.</p>
            <p>Only administrators and super administrators can remove credits.</p>
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
      <div className="credit-balance-remove-modal">
        <div className="modal-header">
          <h3>Remove Credit - Unit {unitId}</h3>
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
            <label htmlFor="amount">Amount to Remove:</label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to remove"
              step="0.01"
              min="0.01"
              max={currentBalance || 0}
              disabled={loading}
            />
          </div>

          {amountValue > 0 && (
            <div className={`balance-preview ${exceedsBalance ? 'error' : ''}`}>
              <div className="preview-label">New Balance:</div>
              <div className={`preview-amount ${exceedsBalance ? 'error' : 'negative'}`}>
                {formatAsMXN(newBalance)}
              </div>
            </div>
          )}

          {exceedsBalance && (
            <div className="validation-error">
              ⚠️ Cannot remove more than the current balance
            </div>
          )}

          <div className="form-group">
            <label htmlFor="notes">Notes (Required):</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Please explain why this credit is being removed..."
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
            onClick={handleRemove}
            disabled={loading || !amountValue || amountValue <= 0 || exceedsBalance || !notes.trim()}
          >
            {loading ? 'Removing...' : 'Remove Credit'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreditBalanceRemoveModal;
