import React, { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { updateCreditBalance, addCreditHistoryEntry } from '../api/hoaDuesService';
import { isSuperAdmin, isAdmin } from '../utils/userRoles';
import { getMexicoDateString } from '../utils/timezone';
import { formatAsMXN } from '../utils/hoaDuesUtils';
import { getFiscalYear } from '../utils/fiscalYearUtils';
import { getMexicoDate } from '../utils/timezone';
import { useDesktopStrings } from '../hooks/useDesktopStrings';
import './CreditBalanceEditModal.css';

function CreditBalanceEditModal({ isOpen, onClose, unitId, currentBalance, year, onUpdate, mode }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();
  const { t } = useDesktopStrings();
  
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
      setError(t('creditEdit.errorNoPermission'));
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
        setError(t('creditEdit.errorNonZeroAmount'));
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
        setError(t('creditEdit.errorValidBalance'));
        return;
      }

      const currentBalanceValue = currentBalance || 0;
      const difference = newBalanceValue - currentBalanceValue;

      // Check if there's actually a change
      if (Math.abs(difference) < 0.01) {
        setError(t('creditEdit.errorDifferentBalance'));
        return;
      }
    }

    if (!notes.trim()) {
      setError(t('creditEdit.errorExplainChange'));
      return;
    }

    if (!entryDate) {
      setError(t('creditEdit.errorSelectDate'));
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
      setError(err.message || t('creditEdit.errorUpdateFailed'));
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
            <h3>{t('creditEdit.accessDenied')}</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <p>{t('creditEdit.noPermission')}</p>
            <p>{t('creditEdit.adminOnly')}</p>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>
              {t('creditHistory.close')}
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
            {mode === 'add'
              ? `➕ ${t('creditEdit.title.add', { unitId })}`
              : mode === 'remove'
                ? `➖ ${t('creditEdit.title.remove', { unitId })}`
                : t('creditEdit.title.edit', { unitId })}
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
            <label htmlFor="currentBalance">{t('creditEdit.currentBalance')}</label>
            <div className="current-balance">
              {formatAsMXN(currentBalance || 0)}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="entryDate">{t('creditEdit.entryDateRequired')}</label>
            <input
              type="date"
              id="entryDate"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              disabled={loading}
              required
            />
            <div className="form-hint">
              {t('creditEdit.entryDateHint')}
            </div>
          </div>

          {isAmountMode ? (
            <>
              <div className="form-group">
                <label htmlFor="amount">
                  {mode === 'add' ? t('creditEdit.amountAddRequired') : t('creditEdit.amountRemoveRequired')}
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
                  placeholder={mode === 'add' ? t('creditEdit.amountAddPlaceholder') : t('creditEdit.amountRemovePlaceholder')}
                  step="0.01"
                  min="0.01"
                  disabled={loading}
                  required
                />
                <div className="form-hint">
                  {mode === 'add' 
                    ? t('creditEdit.amountAddHint')
                    : t('creditEdit.amountRemoveHint')}
                </div>
              </div>

              {amount && parseFloat(amount) > 0 && (
                <div className={`balance-preview ${isAdd ? 'preview-add' : 'preview-remove'}`}>
                  <div className="preview-label">{t('creditEdit.previewCurrent')}</div>
                  <div className="preview-amount">
                    {formatAsMXN(currentBalance || 0)}
                  </div>
                  <div className="preview-label">{t('creditEdit.previewChange')}</div>
                  <div className="preview-change">
                    {isAdd ? '+' : ''}{formatAsMXN(difference)}
                  </div>
                  <div className="preview-label">{t('creditEdit.previewNew')}</div>
                  <div className="preview-amount">
                    {formatAsMXN(newBalanceValue)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="newBalance">{t('creditEdit.newBalanceRequired')}</label>
                <input
                  type="number"
                  id="newBalance"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  placeholder={t('creditEdit.newBalancePlaceholder')}
                  step="0.01"
                  disabled={loading}
                  required
                />
                <div className="form-hint">
                  {t('creditEdit.newBalanceHint')}
                </div>
              </div>

              {Math.abs(difference) > 0.01 && (
                <div className={`balance-preview ${isAdd ? 'preview-add' : 'preview-remove'}`}>
                  <div className="preview-label">{t('creditEdit.previewChange')}</div>
                  <div className="preview-change">
                    {isAdd ? '+' : ''}{formatAsMXN(difference)}
                  </div>
                  <div className="preview-label">{t('creditEdit.previewNew')}</div>
                  <div className="preview-amount">
                    {formatAsMXN(newBalanceValue)}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="form-group">
            <label htmlFor="notes">{t('creditEdit.notesRequired')}</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('creditEdit.notesPlaceholder')}
              rows="3"
              disabled={loading}
              required
            />
            <div className="form-hint">
              {t('creditEdit.adminSourceHint')}
            </div>
          </div>

          <div className="form-note">
            <strong>{t('creditEdit.noteTitle')}</strong> {t('creditEdit.noteBody')}
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn-secondary" 
            onClick={handleCancel}
            disabled={loading}
          >
            {t('creditEdit.cancel')}
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
              ? t('creditEdit.saving')
              : mode === 'add' 
                ? t('creditHistory.addCredit')
                : mode === 'remove' 
                  ? t('creditHistory.removeCredit')
                  : t('creditEdit.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreditBalanceEditModal;
