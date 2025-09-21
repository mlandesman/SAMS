import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faDollarSign, 
  faCalendarAlt, 
  faBuilding, 
  faPlus,
  faTrash,
  faTag,
  faUniversity
} from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../../context/ClientContext';
import { databaseFieldMappings } from '../../utils/databaseFieldMappings';
import './SplitEntryModal.css';

const { formatCurrency, dollarsToCents, centsToDollars } = databaseFieldMappings;

/**
 * SplitEntryModal - Quicken-style split transaction entry interface
 * Allows users to allocate a single transaction across multiple budget categories
 */
const SplitEntryModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  transactionData,
  existingAllocations = [],
  categories = []
}) => {
  const { selectedClient } = useClient();
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Initialize allocations when modal opens
  useEffect(() => {
    if (isOpen) {
      initializeAllocations();
    }
  }, [isOpen, existingAllocations]);

  const initializeAllocations = () => {
    if (existingAllocations && existingAllocations.length > 0) {
      // Editing existing split transaction
      setAllocations(existingAllocations.map(allocation => ({
        id: allocation.id || Date.now() + Math.random(),
        categoryId: allocation.categoryId || '',
        categoryName: allocation.categoryName || '',
        amount: allocation.amount || '',
        notes: allocation.notes || ''
      })));
    } else {
      // New split transaction - start with one empty allocation
      setAllocations([{
        id: Date.now(),
        categoryId: '',
        categoryName: '',
        amount: '',
        notes: ''
      }]);
    }
  };

  // Calculate remaining balance
  const getRemainingBalance = () => {
    if (!transactionData?.amount) return 0;
    const transactionAmountCents = typeof transactionData.amount === 'number' 
      ? transactionData.amount 
      : dollarsToCents(transactionData.amount);
    
    const allocatedTotal = allocations.reduce((sum, allocation) => {
      if (allocation.amount === '' || allocation.amount === null || allocation.amount === undefined) {
        return sum;
      }
      const amount = typeof allocation.amount === 'number' 
        ? allocation.amount 
        : dollarsToCents(allocation.amount);
      return sum + amount;
    }, 0);
    
    return transactionAmountCents - allocatedTotal;
  };

  // Check if save is enabled (remaining balance = 0)
  const isSaveEnabled = () => {
    const remaining = getRemainingBalance();
    const hasValidAllocations = allocations.every(allocation => {
      const hasCategory = allocation.categoryName && allocation.categoryName !== '';
      const hasValidAmount = allocation.amount !== '' && allocation.amount !== null && allocation.amount !== undefined && allocation.amount > 0;
      return hasCategory && hasValidAmount;
    });
    return remaining === 0 && hasValidAllocations && allocations.length > 0;
  };

  // Add new allocation row
  const addAllocation = () => {
    const newAllocation = {
      id: Date.now() + Math.random(),
      categoryId: '',
      categoryName: '',
      amount: '',
      notes: ''
    };
    setAllocations([...allocations, newAllocation]);
  };

  // Remove allocation row
  const removeAllocation = (allocationId) => {
    if (allocations.length > 1) {
      setAllocations(allocations.filter(allocation => allocation.id !== allocationId));
    }
  };

  // Update allocation field
  const updateAllocation = (allocationId, field, value) => {
    setAllocations(allocations.map(allocation => {
      if (allocation.id === allocationId) {
        const updated = { ...allocation, [field]: value };
        
        // If category changed, update both name and ID
        if (field === 'categoryName') {
          // Categories are now always ID+name objects from UnifiedExpenseEntry
          const selectedCategory = categories.find(cat => cat.name === value);
          updated.categoryId = selectedCategory ? selectedCategory.id : '';
        }
        
        // Convert amount to cents for storage
        if (field === 'amount') {
          if (value === '' || value === null || value === undefined) {
            updated.amount = '';
          } else {
            updated.amount = typeof value === 'string' ? dollarsToCents(value) : value;
          }
        }
        
        return updated;
      }
      return allocation;
    }));
  };

  // Handle save
  const handleSave = () => {
    if (!isSaveEnabled()) return;
    
    const allocationData = allocations.map(allocation => ({
      categoryId: allocation.categoryId,
      categoryName: allocation.categoryName,
      amount: typeof allocation.amount === 'number' ? allocation.amount : dollarsToCents(allocation.amount || 0),
      notes: allocation.notes || ''
    }));
    
    onSave(allocationData);
  };

  if (!isOpen) return null;

  const transactionAmountCents = typeof transactionData?.amount === 'number' 
    ? transactionData.amount 
    : dollarsToCents(transactionData?.amount || 0);
  const remaining = getRemainingBalance();

  return (
    <div className="modal-overlay">
      <div className="split-entry-modal">
        {/* Header */}
        <div className="modal-header">
          <h2>Split Transaction: {transactionData?.vendorName || 'Unknown Vendor'}</h2>
          <button className="close-button" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Transaction Summary */}
        <div className="transaction-summary">
          <div className="summary-row">
            <FontAwesomeIcon icon={faCalendarAlt} />
            <span>{transactionData?.date || 'N/A'}</span>
          </div>
          <div className="summary-row">
            <FontAwesomeIcon icon={faBuilding} />
            <span>{transactionData?.vendorName || 'N/A'}</span>
          </div>
          <div className="summary-row">
            <FontAwesomeIcon icon={faDollarSign} />
            <span>{formatCurrency(transactionAmountCents)}</span>
          </div>
          <div className="summary-row">
            <FontAwesomeIcon icon={faUniversity} />
            <span>{transactionData?.accountType || 'N/A'}</span>
          </div>
        </div>

        {/* Running Balance */}
        <div className={`remaining-balance ${remaining === 0 ? 'balanced' : remaining < 0 ? 'over' : 'under'}`}>
          <strong>Remaining: {formatCurrency(remaining)}</strong>
        </div>

        {/* Allocations Table */}
        <div className="allocations-container">
          <table className="allocations-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((allocation, index) => (
                <tr key={allocation.id}>
                  <td>
                    <select
                      value={allocation.categoryName}
                      onChange={(e) => updateAllocation(allocation.id, 'categoryName', e.target.value)}
                      className="category-select"
                      disabled={loading}
                    >
                      <option value="">Select Category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="amount-input-container">
                      <span className="currency-symbol">$</span>
                      <input
                        type="number"
                        value={allocation.amount === '' ? '' : centsToDollars(allocation.amount)}
                        onChange={(e) => updateAllocation(allocation.id, 'amount', e.target.value)}
                        className="amount-input"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={allocation.notes}
                      onChange={(e) => updateAllocation(allocation.id, 'notes', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addAllocation();
                        }
                      }}
                      className="notes-input"
                      placeholder="Notes..."
                      maxLength={100}
                    />
                  </td>
                  <td>
                    {allocations.length > 1 && (
                      <button
                        className="remove-allocation-button"
                        onClick={() => removeAllocation(allocation.id)}
                        title="Remove allocation"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {/* Add new allocation row */}
              <tr>
                <td colSpan="4">
                  <button
                    className="add-allocation-button"
                    onClick={addAllocation}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    Add Allocation
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Error Messages */}
        {Object.keys(errors).length > 0 && (
          <div className="error-messages">
            {Object.entries(errors).map(([field, message]) => (
              <div key={field} className="error-message">
                {message}
              </div>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div className="modal-actions">
          <button 
            className="cancel-button" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className={`save-button ${isSaveEnabled() ? 'enabled' : 'disabled'}`}
            onClick={handleSave}
            disabled={!isSaveEnabled()}
          >
            Save Split
          </button>
        </div>
      </div>
    </div>
  );
};

export default SplitEntryModal;