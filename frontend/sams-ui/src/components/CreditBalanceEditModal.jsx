import React, { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { updateCreditBalance, addCreditHistoryEntry } from '../api/hoaDuesService';
import { isSuperAdmin, isAdmin } from '../utils/userRoles';
import { getMexicoDateString } from '../utils/timezone';
import { formatAsMXN } from '../utils/hoaDuesUtils';
import { getFiscalYear } from '../utils/fiscalYearUtils';
import { getMexicoDate } from '../utils/timezone';
import './CreditBalanceEditModal.css';

function CreditBalanceEditModal({ isOpen, onClose, unitId, currentBalance, year, onUpdate, mode }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();
  
  // mode can be 'add', 'remove', or undefined (for edit/new balance mode)
  const isAmountMode = mode === 'add' || mode === 'remove';
  
  // Debug logging when mode changes
  React.useEffect(() => {
    if (isOpen) {
      console.log('[CREDIT EDIT MODAL] Modal opened:', { mode, isAmountMode, currentBalance });
    }
  }, [isOpen, mode, isAmountMode, currentBalance]);
  
  const [newBalance, setNewBalance] = useState('');
  const [amount, setAmount] = useState(''); // For add/remove mode
  const [entryDate, setEntryDate] = useState(getMexicoDateString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if user has permission to edit credit balance
  const canEdit = isSuperAdmin(samsUser) || isAdmin(samsUser, selectedClient?.id);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (isAmountMode) {
        // Amount mode: clear amount, set balance to current
        setAmount('');
        setNewBalance(currentBalance?.toString() || '0');
      } else {
        // Balance mode: set new balance to current balance initially
        setNewBalance(currentBalance?.toString() || '0');
        setAmount('');
      }
      setEntryDate(getMexicoDateString());
      setNotes('');
      setError(null);
    }
  }, [isOpen, currentBalance, isAmountMode]);

  const handleSave = async () => {
    if (!canEdit) {
      setError('You do not have permission to edit credit balances');
      return;
    }

    let newBalanceValue;
    
    if (isAmountMode) {
      // Amount mode: validate amount and calculate new balance
      // Ensure we're reading the latest amount value and trimming whitespace
      const amountStr = amount ? amount.toString().trim() : '';
      const amountValue = parseFloat(amountStr);
      
      console.log('[CREDIT EDIT MODAL] Amount mode save:', { 
        mode, 
        amount, 
        amountStr, 
        amountValue, 
        currentBalance,
        isNaN: isNaN(amountValue),
        isZero: amountValue === 0
      });
      
      if (!amountStr || isNaN(amountValue) || amountValue === 0) {
        setError('Please enter a valid non-zero amount');
        return;
      }
      
      // Ensure currentBalance is parsed as a number
      const currentBalanceValue = parseFloat(currentBalance) || 0;
      
      if (mode === 'add') {
        newBalanceValue = currentBalanceValue + amountValue;
        console.log('[CREDIT EDIT MODAL] Add calculation:', { currentBalanceValue, amountValue, newBalanceValue });
      } else { // mode === 'remove'
        newBalanceValue = currentBalanceValue - amountValue;
        console.log('[CREDIT EDIT MODAL] Remove calculation:', { 
          currentBalanceValue, 
          amountValue, 
          newBalanceValue,
          calculation: `${currentBalanceValue} - ${amountValue} = ${newBalanceValue}`
        });
      }
    } else {
      // Balance mode: validate new balance
      newBalanceValue = parseFloat(newBalance);
      if (isNaN(newBalanceValue)) {
        setError('Please enter a valid balance amount');
        return;
      }

      const currentBalanceValue = currentBalance || 0;
      const difference = newBalanceValue - currentBalanceValue;

      // Check if there's actually a change
      if (Math.abs(difference) < 0.01) {
        setError('New balance must be different from current balance');
        return;
      }
    }

    if (!notes.trim()) {
      setError('Please provide a note explaining this change');
      return;
    }

    if (!entryDate) {
      setError('Please select a date for this entry');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use fiscal year as fallback if year prop is not provided
      let yearToUse = year;
      if (!yearToUse) {
        const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1;
        yearToUse = getFiscalYear(getMexicoDate(), fiscalYearStartMonth);
      }
      
      if (isAmountMode) {
        // For Add/Remove: Use direct history entry API with the amount
        const amountValue = parseFloat(amount.trim());
        // For remove mode, make amount negative
        const amountToAdd = mode === 'remove' ? -amountValue : amountValue;
        
        console.log('[CREDIT EDIT MODAL] Calling addCreditHistoryEntry API:', {
          clientId: selectedClient.id,
          unitId,
          amount: amountToAdd,
          date: entryDate,
          notes: notes.trim(),
          mode
        });
        
        // Convert date to ISO string format if needed
        let dateISO = entryDate;
        if (entryDate && !entryDate.includes('T')) {
          // If it's just a date (YYYY-MM-DD), convert to ISO string
          dateISO = new Date(entryDate + 'T00:00:00').toISOString();
        } else if (entryDate) {
          dateISO = new Date(entryDate).toISOString();
        }
        
        await addCreditHistoryEntry(
          selectedClient.id,
          unitId,
          amountToAdd, // Positive for add, negative for remove
          dateISO,
          notes.trim(),
          'admin'
        );
      } else {
        // For Edit Balance: Use updateCreditBalance API with new balance
        console.log('[CREDIT EDIT MODAL] Calling updateCreditBalance API:', {
          clientId: selectedClient.id,
          unitId,
          year: yearToUse,
          newBalanceValue,
          currentBalance
        });
        
        await updateCreditBalance(
          selectedClient.id,
          unitId,
          yearToUse,
          newBalanceValue,
          notes.trim(),
          entryDate // Pass date for history entry
        );
      }

      // Call the parent's update callback if provided (this will refresh the data)
      if (onUpdate) {
        await onUpdate();
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
    setNewBalance('');
    setAmount('');
    setEntryDate(getMexicoDateString());
    setNotes('');
    setError(null);
    onClose();
  };

  // Calculate preview values based on mode
  let newBalanceValue, difference, isAdd, isRemove;
  
  if (isAmountMode) {
    const amountValue = parseFloat(amount) || 0;
    const currentBalanceValue = currentBalance || 0;
    if (mode === 'add') {
      newBalanceValue = currentBalanceValue + amountValue;
      difference = amountValue;
      isAdd = true;
      isRemove = false;
    } else { // mode === 'remove'
      newBalanceValue = currentBalanceValue - amountValue;
      difference = -amountValue;
      isAdd = false;
      isRemove = true;
    }
  } else {
    newBalanceValue = parseFloat(newBalance) || currentBalance || 0;
    const currentBalanceValue = currentBalance || 0;
    difference = newBalanceValue - currentBalanceValue;
    isAdd = difference > 0;
    isRemove = difference < 0;
  }

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
        <div className={`modal-header ${isAdd ? 'header-add' : isRemove ? 'header-remove' : ''}`}>
          <h3>
            {mode === 'add' ? '➕ Add Credit' : mode === 'remove' ? '➖ Remove Credit' : 'Edit Credit Balance'} - Unit {unitId}
          </h3>
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

          {isAmountMode ? (
            <>
              <div className="form-group">
                <label htmlFor="amount">
                  {mode === 'add' ? 'Amount to Add (Required):' : 'Amount to Remove (Required):'}
                </label>
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    console.log('[CREDIT EDIT MODAL] Amount changed:', { mode, value, currentAmount: amount });
                    setAmount(value);
                  }}
                  placeholder={mode === 'add' ? "Enter positive amount to add" : "Enter positive amount to remove"}
                  step="0.01"
                  min="0.01"
                  disabled={loading}
                  required
                />
                <div className="form-hint">
                  {mode === 'add' 
                    ? 'Enter a positive amount to add to the credit balance' 
                    : 'Enter a positive amount to remove from the credit balance'}
                </div>
              </div>

              {amount && parseFloat(amount) > 0 && (
                <div className={`balance-preview ${isAdd ? 'preview-add' : 'preview-remove'}`}>
                  <div className="preview-label">Current Balance:</div>
                  <div className="preview-amount">
                    {formatAsMXN(currentBalance || 0)}
                  </div>
                  <div className="preview-label">Change:</div>
                  <div className="preview-change">
                    {isAdd ? '+' : ''}{formatAsMXN(difference)}
                  </div>
                  <div className="preview-label">New Balance:</div>
                  <div className="preview-amount">
                    {formatAsMXN(newBalanceValue)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="newBalance">New Balance (Required):</label>
                <input
                  type="number"
                  id="newBalance"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  placeholder="Enter the new ending balance"
                  step="0.01"
                  disabled={loading}
                  required
                />
                <div className="form-hint">
                  Enter the final balance amount. The system will automatically calculate if this is an addition or removal.
                </div>
              </div>

              {Math.abs(difference) > 0.01 && (
                <div className={`balance-preview ${isAdd ? 'preview-add' : 'preview-remove'}`}>
                  <div className="preview-label">Change:</div>
                  <div className="preview-change">
                    {isAdd ? '+' : ''}{formatAsMXN(difference)}
                  </div>
                  <div className="preview-label">New Balance:</div>
                  <div className="preview-amount">
                    {formatAsMXN(newBalanceValue)}
                  </div>
                </div>
              )}
            </>
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
            <div className="form-hint">
              This entry will be created with source: "admin"
            </div>
          </div>

          <div className="form-note">
            <strong>Note:</strong> This action will create a history entry and the balance will be recalculated from all history entries.
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
            className={`btn-primary ${isAdd ? 'btn-add' : isRemove ? 'btn-remove' : ''}`} 
            onClick={handleSave}
            disabled={
              loading || 
              !notes.trim() || 
              !entryDate || 
              (isAmountMode ? (!amount || parseFloat(amount) <= 0) : (!newBalance || Math.abs(difference) < 0.01))
            }
          >
            {loading 
              ? 'Saving...' 
              : mode === 'add' 
                ? 'Add Credit' 
                : mode === 'remove' 
                  ? 'Remove Credit' 
                  : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreditBalanceEditModal;
