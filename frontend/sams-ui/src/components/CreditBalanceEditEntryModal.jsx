import React, { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { updateCreditHistoryEntry } from '../api/hoaDuesService';
import { isSuperAdmin, isAdmin } from '../utils/userRoles';
import { getMexicoDateString } from '../utils/timezone';
import './CreditBalanceEditEntryModal.css';

function CreditBalanceEditEntryModal({ isOpen, onClose, unitId, entry, onUpdate }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();
  
  const [entryDate, setEntryDate] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if user has permission to edit credit balance
  const canEdit = isSuperAdmin(samsUser) || isAdmin(samsUser, selectedClient?.id);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && entry) {
      // Parse timestamp to get date (YYYY-MM-DD format for date input)
      let dateStr = '';
      if (entry.timestamp) {
        if (entry.timestamp.raw && typeof entry.timestamp.raw === 'string') {
          const date = new Date(entry.timestamp.raw);
          dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (typeof entry.timestamp === 'string') {
          const date = new Date(entry.timestamp);
          dateStr = date.toISOString().split('T')[0];
        }
      }
      
      // Amount is already in pesos from getAllDuesDataForYear
      setEntryDate(dateStr || getMexicoDateString().split('T')[0]);
      setAmount((entry.amount || 0).toString());
      setNotes(entry.notes || '');
      setSource(entry.source || 'admin');
      setError(null);
    }
  }, [isOpen, entry]);

  const handleSave = async () => {
    if (!canEdit) {
      setError('You do not have permission to edit credit history entries');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue)) {
      setError('Please enter a valid amount');
      return;
    }

    if (!notes.trim()) {
      setError('Please provide notes explaining this entry');
      return;
    }

    if (!entryDate) {
      setError('Please select a date for this entry');
      return;
    }

    if (!source.trim()) {
      setError('Please provide a source');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert date to ISO string format
      const dateISO = new Date(entryDate).toISOString();
      
      await updateCreditHistoryEntry(
        selectedClient.id,
        unitId,
        entry.id,
        {
          date: dateISO,
          amount: amountValue, // API will convert to centavos
          notes: notes.trim(),
          source: source.trim()
        }
      );

      // Call the parent's update callback if provided (this will refresh the data)
      if (onUpdate) {
        await onUpdate();
      }

      onClose();
    } catch (err) {
      console.error('Error updating credit history entry:', err);
      setError(err.message || 'Failed to update credit history entry');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEntryDate('');
    setAmount('');
    setNotes('');
    setSource('');
    setError(null);
    onClose();
  };

  if (!isOpen || !entry) {
    return null;
  }

  if (!canEdit) {
    return (
      <div className="modal-backdrop">
        <div className="credit-balance-edit-entry-modal">
          <div className="modal-header">
            <h3>Access Denied</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <p>You do not have permission to edit credit history entries.</p>
            <p>Only administrators and super administrators can edit entries.</p>
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
      <div className="credit-balance-edit-entry-modal">
        <div className="modal-header">
          <h3>Edit Credit History Entry - Unit {unitId}</h3>
          <button className="close-button" onClick={handleCancel}>×</button>
        </div>
        
        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="entryDate">Entry Date (Required):</label>
            <input
              type="date"
              id="entryDate"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              disabled={loading}
              required
            />
            <div className="form-hint">
              This date will be used to sort the history chronologically
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="amount">Amount (Required):</label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              step="0.01"
              disabled={loading}
              required
            />
            <div className="form-hint">
              Positive values add credit, negative values remove credit
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes (Required):</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Please explain this credit history entry..."
              rows="3"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="source">Source (Required):</label>
            <select
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={loading}
              required
            >
              <option value="admin">admin</option>
              <option value="running_balance_computation">running_balance_computation</option>
              <option value="unifiedPayment">unifiedPayment</option>
              <option value="hoaDues">hoaDues</option>
              <option value="waterBills">waterBills</option>
            </select>
          </div>

          <div className="form-note">
            <strong>Note:</strong> After saving, the history will be resorted chronologically and the balance will be recalculated.
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
            disabled={loading || !entryDate || !amount || !notes.trim() || !source.trim()}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreditBalanceEditEntryModal;
