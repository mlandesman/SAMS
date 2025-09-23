import React, { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { updateCreditBalance } from '../api/hoaDuesService';
import { isSuperAdmin, isAdmin } from '../utils/userRoles';
import './CreditBalanceEditModal.css';

function CreditBalanceEditModal({ isOpen, onClose, unitId, currentBalance, year, onUpdate }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();
  
  const [newBalance, setNewBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if user has permission to edit credit balance
  const canEdit = isSuperAdmin(samsUser) || isAdmin(samsUser, selectedClient?.id);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewBalance(currentBalance?.toString() || '0');
      setNotes('');
      setError(null);
    }
  }, [isOpen, currentBalance]);

  const handleSave = async () => {
    if (!canEdit) {
      setError('You do not have permission to edit credit balances');
      return;
    }

    const balanceValue = parseFloat(newBalance);
    if (isNaN(balanceValue)) {
      setError('Please enter a valid number');
      return;
    }

    if (!notes.trim()) {
      setError('Please provide a note explaining this change');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateCreditBalance(
        selectedClient.id,
        unitId,
        year,
        balanceValue,
        notes.trim()
      );

      // Call the parent's update callback if provided
      if (onUpdate) {
        onUpdate();
      }

      onClose();
    } catch (err) {
      console.error('Error updating credit balance:', err);
      setError(err.message || 'Failed to update credit balance');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNewBalance(currentBalance?.toString() || '0');
    setNotes('');
    setError(null);
    onClose();
  };

  const balanceChange = parseFloat(newBalance) - (currentBalance || 0);
  const isBalanceChanged = balanceChange !== 0;

  if (!isOpen) {
    return null;
  }

  if (!canEdit) {
    return (
      <div className="modal-backdrop">
        <div className="credit-balance-modal">
          <div className="modal-header">
            <h3>Access Denied</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <p>You do not have permission to edit credit balances.</p>
            <p>Only administrators and super administrators can make credit balance adjustments.</p>
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
      <div className="credit-balance-modal">
        <div className="modal-header">
          <h3>Edit Credit Balance - Unit {unitId}</h3>
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
              ${(currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="newBalance">New Balance:</label>
            <input
              type="number"
              id="newBalance"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="Enter new credit balance"
              step="0.01"
              disabled={loading}
            />
          </div>

          {isBalanceChanged && (
            <div className={`balance-change ${balanceChange > 0 ? 'positive' : 'negative'}`}>
              Change: {balanceChange > 0 ? '+' : ''}${balanceChange.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="notes">Notes (Required):</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Please explain the reason for this credit balance adjustment..."
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
            onClick={handleSave}
            disabled={loading || !isBalanceChanged || !notes.trim()}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreditBalanceEditModal;