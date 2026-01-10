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
    // Determine transaction type (expense = negative, income = positive)
    const transactionAmountCents = typeof transactionData?.amount === 'number' 
      ? transactionData.amount 
      : (transactionData?.amount ? dollarsToCents(transactionData.amount) : 0);
    const isExpense = transactionAmountCents <= 0;
    
    console.log('🔄 Initializing allocations:', { 
      existingAllocationsCount: existingAllocations?.length || 0, 
      transactionAmountCents, 
      isExpense 
    });
    
    if (existingAllocations && existingAllocations.length > 0) {
      // Editing existing split transaction
      // CRITICAL: Allocations from database are ALREADY stored in CENTAVOS (cents) as INTEGERS
      // Do NOT convert them - they're already in the correct format
      // Only ensure they're integers (handle any floating point values from bad writes)
      setAllocations(existingAllocations.map((allocation, index) => {
        let amountInCentavos = allocation.amount || 0;
        
        console.log(`🔄 Loading allocation ${index + 1}:`, {
          categoryName: allocation.categoryName,
          originalAmount: allocation.amount,
          amountType: typeof allocation.amount
        });
        
        // Allocations from database are ALREADY in centavos (cents) - ensure they're integers
        if (typeof amountInCentavos === 'number') {
          // Round to integer (handles any floating point values from bad writes)
          amountInCentavos = Math.round(amountInCentavos);
          // Ensure negative for expenses (match transaction sign)
          if (isExpense && amountInCentavos > 0) {
            amountInCentavos = -Math.abs(amountInCentavos);
            console.log(`  Made negative for expense: ${amountInCentavos} centavos`);
          } else if (!isExpense && amountInCentavos < 0) {
            amountInCentavos = Math.abs(amountInCentavos);
            console.log(`  Made positive for income: ${amountInCentavos} centavos`);
          } else {
            console.log(`  Rounded to integer centavos: ${amountInCentavos}`);
          }
        } else if (typeof amountInCentavos === 'string' && amountInCentavos !== '') {
          // String value, parse and round to integer
          const numValue = parseFloat(amountInCentavos);
          if (!isNaN(numValue)) {
            amountInCentavos = Math.round(numValue);
            // Ensure negative for expenses
            if (isExpense && amountInCentavos > 0) {
              amountInCentavos = -Math.abs(amountInCentavos);
            } else if (!isExpense && amountInCentavos < 0) {
              amountInCentavos = Math.abs(amountInCentavos);
            }
            console.log(`  Parsed and rounded to integer centavos: ${amountInCentavos}`);
          } else {
            amountInCentavos = 0;
            console.log(`  Invalid amount string: "${amountInCentavos}", defaulting to 0`);
          }
        }
        
        console.log(`  Final allocation ${index + 1}: ${allocation.categoryName || 'No category'} = ${amountInCentavos} centavos (integer)`);
        
        return {
          id: allocation.id || Date.now() + Math.random(),
          categoryId: allocation.categoryId || '',
          categoryName: allocation.categoryName || '',
          amount: amountInCentavos, // Already in centavos, ensure integer
          notes: allocation.notes || ''
        };
      }));
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
    if (!transactionData?.amount) {
      console.log('⚠️ No transaction amount available');
      return 0;
    }
    
    // CRITICAL: transactionData.amount should ALREADY be in centavos (cents) as an integer
    // If it's a string (from formData), convert from dollars to centavos (for new splits)
    // If it's a number, assume it's already in centavos
    let transactionAmountCentavos = typeof transactionData.amount === 'number' 
      ? Math.round(transactionData.amount) // Already in centavos, ensure integer
      : Math.round(dollarsToCents(transactionData.amount)); // Convert from dollars to centavos (for new splits)
    
    // Ensure transaction amount is negative for expenses (expenses are always negative in centavos)
    if (transactionAmountCentavos > 0) {
      transactionAmountCentavos = -Math.abs(transactionAmountCentavos);
    }
    
    console.log('💰 Transaction amount (centavos, integer):', transactionAmountCentavos);
    
    const allocatedTotal = allocations.reduce((sum, allocation) => {
      if (allocation.amount === '' || allocation.amount === null || allocation.amount === undefined) {
        return sum;
      }
      // allocation.amount should already be in centavos (from initialization or user input)
      // If it's a string, user is typing dollars - convert to centavos (for user input)
      // If it's a number, it's already in centavos from initialization or previous user input
      let amount = typeof allocation.amount === 'number' 
        ? Math.round(allocation.amount) // Already in centavos, ensure integer
        : Math.round(dollarsToCents(allocation.amount || 0)); // User typing dollars, convert to centavos
      
      // Ensure allocation amounts are negative for expenses (matching transaction amount sign)
      // If amount is positive, make it negative to match expense format
      if (amount > 0 && transactionAmountCentavos < 0) {
        amount = -Math.abs(amount);
      }
      
      console.log(`  Allocation: ${allocation.categoryName || 'No category'} = ${amount} centavos (integer)`);
      return sum + amount;
    }, 0);
    
    console.log('💰 Allocated total (centavos, integer):', allocatedTotal);
    
    // For expenses: transactionAmountCentavos is negative, allocatedTotal is negative
    // Use absolute values for comparison (both should be negative, but we compare magnitudes)
    const remaining = Math.abs(transactionAmountCentavos) - Math.abs(allocatedTotal);
    console.log('💰 Remaining balance (centavos):', remaining);
    
    return remaining;
  };

  // Check if save is enabled (remaining balance = 0)
  const isSaveEnabled = () => {
    const remaining = getRemainingBalance();
    // Allow small rounding differences (within 1 cent)
    const isBalanced = Math.abs(remaining) <= 1;
    
    console.log('🔍 Save enabled check:', { remaining, isBalanced });
    
    const hasValidAllocations = allocations.length > 0 && allocations.every((allocation, index) => {
      const hasCategory = allocation.categoryName && allocation.categoryName !== '';
      // Amount can be positive (will be converted to negative) or negative (already in expense format)
      // Also handle string amounts (user input)
      let amountValue = 0;
      if (allocation.amount === '' || allocation.amount === null || allocation.amount === undefined) {
        amountValue = 0;
      } else if (typeof allocation.amount === 'string') {
        // String input (user typing), convert to cents
        const numValue = parseFloat(allocation.amount);
        amountValue = isNaN(numValue) ? 0 : Math.abs(dollarsToCents(numValue));
      } else if (typeof allocation.amount === 'number') {
        // Already in cents (positive or negative), use absolute value
        amountValue = Math.abs(allocation.amount);
      }
      
      const hasValidAmount = amountValue > 0;
      console.log(`  Allocation ${index + 1}: category=${hasCategory}, amount=${amountValue}, valid=${hasValidAmount}`);
      return hasCategory && hasValidAmount;
    });
    
    const isEnabled = isBalanced && hasValidAllocations;
    console.log('🔍 Save enabled result:', { isBalanced, hasValidAllocations, isEnabled, allocationsCount: allocations.length });
    
    return isEnabled;
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
        
        // Convert amount to centavos (cents) for storage - must be INTEGER
        if (field === 'amount') {
          if (value === '' || value === null || value === undefined) {
            updated.amount = '';
          } else {
            // User enters dollars in input field, convert to centavos (integers)
            // If value is string (user typing), it's dollars - convert to centavos
            // If value is number, it might be from existing allocation (already in centavos) or from user input (dollars)
            // For safety, always treat user input as dollars and convert
            let amountInCentavos;
            if (typeof value === 'string') {
              // User typing dollars - convert to centavos (integers)
              const numValue = parseFloat(value);
              amountInCentavos = isNaN(numValue) ? 0 : Math.round(dollarsToCents(numValue));
            } else if (typeof value === 'number') {
              // If number, check if it looks like dollars (< 1000) or centavos (>= 1000)
              // For user input in number field, treat as dollars if < 1000
              // But actually, the input always gives us a string, so if we get a number here,
              // it's likely from existing allocation (already in centavos) - just round to integer
              amountInCentavos = Math.round(value);
            } else {
              amountInCentavos = 0;
            }
            
            // Determine if this is an expense transaction (negative amount) or income (positive)
            const transactionAmountCentavos = typeof transactionData?.amount === 'number' 
              ? Math.round(transactionData.amount) 
              : Math.round(dollarsToCents(transactionData?.amount || 0));
            const isExpense = transactionAmountCentavos <= 0;
            
            // For expenses, ensure allocation amounts are negative (matching transaction)
            // User enters positive value in input (dollars), we convert to negative centavos (integers) for storage
            if (isExpense && amountInCentavos > 0) {
              amountInCentavos = -Math.abs(amountInCentavos);
            } else if (!isExpense && amountInCentavos < 0) {
              amountInCentavos = Math.abs(amountInCentavos);
            }
            
            // CRITICAL: Ensure amount is an INTEGER (centavos)
            updated.amount = Math.round(amountInCentavos);
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
    
    // CRITICAL: All allocations should already be in centavos (cents) as integers
    // Just ensure they're properly formatted before saving
    const allocationData = allocations.map(allocation => {
      // allocation.amount should already be in centavos (from updateAllocation or initialization)
      // Ensure it's an integer
      let amount = typeof allocation.amount === 'number' 
        ? Math.round(allocation.amount) // Already in centavos, ensure integer
        : 0; // If it's a string here, something went wrong - default to 0
      
      // If amount is somehow a string at this point, it shouldn't happen, but handle it
      if (typeof allocation.amount === 'string' && allocation.amount !== '') {
        // User might have left an incomplete entry, but save validation should prevent this
        const numValue = parseFloat(allocation.amount);
        amount = isNaN(numValue) ? 0 : Math.round(dollarsToCents(numValue));
      }
      
      // Amount should already be negative for expenses (from updateAllocation), but ensure it
      const transactionAmountCentavos = typeof transactionData?.amount === 'number' 
        ? Math.round(transactionData.amount) 
        : Math.round(dollarsToCents(transactionData?.amount || 0));
      const isExpense = transactionAmountCentavos <= 0;
      
      // For expenses, ensure amounts are negative (matching transaction amount sign)
      if (isExpense && amount > 0) {
        amount = -Math.abs(amount);
      } else if (!isExpense && amount < 0) {
        amount = Math.abs(amount);
      }
      
      // CRITICAL: Ensure amount is an INTEGER (centavos) before saving
      amount = Math.round(amount);
      
      return {
        categoryId: allocation.categoryId,
        categoryName: allocation.categoryName,
        amount: amount, // INTEGER in centavos (cents)
        notes: allocation.notes || ''
      };
    });
    
    console.log('💾 Saving allocations (centavos, integers):', allocationData);
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
                        value={allocation.amount === '' ? '' : centsToDollars(Math.abs(allocation.amount || 0))}
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