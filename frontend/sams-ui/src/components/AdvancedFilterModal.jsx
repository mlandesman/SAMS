import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faFilter, 
  faTrash,
  faCheck,
  faCalendarAlt,
  faDollarSign,
  faBuilding,
  faTag,
  faUser,
  faStickyNote
} from '@fortawesome/free-solid-svg-icons';
import './AdvancedFilterModal.css';

const AdvancedFilterModal = ({ 
  isOpen, 
  onClose, 
  onApplyFilters, 
  currentFilters = {},
  transactions = [],
  units = [],
  categories = [],
  vendors = [],
  accounts = []
}) => {
  const [filters, setFilters] = useState({
    vendor: [], // Changed to array for multiselect
    category: [], // Changed to array for multiselect
    unit: [], // Changed to array for multiselect
    account: [], // Changed to array for multiselect
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
    notes: '',
    description: ''
  });

  // State for multiselect dropdowns
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.multiselect-dropdown')) {
        setVendorDropdownOpen(false);
        setCategoryDropdownOpen(false);
        setUnitDropdownOpen(false);
        setAccountDropdownOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Initialize filters from props
  useEffect(() => {
    if (isOpen) {
      setFilters(prev => ({
        ...prev,
        ...currentFilters
      }));
    }
  }, [isOpen, currentFilters]);

  // Extract unique values from transactions for dropdowns
  const getUniqueValues = (field) => {
    const values = transactions
      .map(t => t[field])
      .filter(v => v && v.toString().trim())
      .map(v => v.toString().trim());
    return [...new Set(values)].sort();
  };

  const uniqueVendors = vendors.length > 0 ? vendors : getUniqueValues('vendorName');
  const uniqueCategories = categories.length > 0 ? categories : getUniqueValues('categoryName');
  // Handle units - they might be objects with unitId or just strings
  const uniqueUnits = units.length > 0 
    ? units.map(u => u.unitId || u.unit || u.id || u).filter(Boolean).sort()
    : getUniqueValues('unit');
  // Use backend account structure: {id, name, type} - no fallback to transaction data
  const uniqueAccounts = accounts.length > 0 ? accounts : [];
  
  // Debug logging for accounts
  console.log('🏦 AdvancedFilterModal - Accounts data received:', accounts);
  console.log('🏦 AdvancedFilterModal - uniqueAccounts processed:', uniqueAccounts);

  const handleInputChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Generic multiselect handlers
  const handleItemToggle = (field, itemName) => {
    setFilters(prev => ({
      ...prev,
      [field]: prev[field].includes(itemName)
        ? prev[field].filter(name => name !== itemName)
        : [...prev[field], itemName]
    }));
  };

  const handleClearField = (field) => {
    setFilters(prev => ({
      ...prev,
      [field]: []
    }));
  };

  // Account-specific handlers (for type-based selection)
  const handleSelectAllAccountsByType = (type) => {
    const accountsOfType = uniqueAccounts
      .filter(account => account.type === type)
      .map(account => account.name);
    
    setFilters(prev => ({
      ...prev,
      account: [...new Set([...prev.account, ...accountsOfType])]
    }));
  };

  const handleApply = () => {
    // Remove empty filters
    const cleanFilters = Object.entries(filters).reduce((acc, [key, value]) => {
      if (Array.isArray(value)) {
        // Handle arrays (like accounts)
        if (value.length > 0) {
          acc[key] = value;
        }
      } else if (value && value.toString().trim()) {
        // Handle strings
        acc[key] = value.toString().trim();
      }
      return acc;
    }, {});
    
    onApplyFilters(cleanFilters);
    onClose();
  };

  const handleClear = () => {
    setFilters({
      vendor: [], // Clear to empty array for multiselect
      category: [], // Clear to empty array for multiselect
      unit: [], // Clear to empty array for multiselect
      account: [], // Clear to empty array for multiselect
      minAmount: '',
      maxAmount: '',
      startDate: '',
      endDate: '',
      notes: '',
      description: ''
    });
  };

  const handleReset = () => {
    handleClear();
    onApplyFilters({});
    onClose();
  };

  const hasActiveFilters = Object.values(filters).some(v => 
    Array.isArray(v) ? v.length > 0 : v && v.toString().trim()
  );

  // Helper function to render multiselect dropdown
  const renderMultiselect = (field, items, isOpen, setIsOpen, displayField = 'name', options = {}) => {
    const selectedItems = filters[field] || [];
    
    return (
      <div className="multiselect-dropdown">
        <button 
          type="button"
          className="multiselect-toggle"
          onClick={() => setIsOpen(!isOpen)}
        >
          {selectedItems.length === 0 
            ? `All ${field}s` 
            : selectedItems.length === 1 
              ? selectedItems[0] 
              : `${selectedItems.length} ${field}s selected`
          }
          <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
        </button>
        
        {isOpen && (
          <div className="multiselect-dropdown-content">
            {/* Header with clear button */}
            <div className="multiselect-header">
              <button 
                type="button" 
                className="multiselect-clear"
                onClick={() => handleClearField(field)}
              >
                Clear All
              </button>
            </div>
            
            {/* Item checkboxes */}
            <div className="multiselect-options">
              {items.map((item, index) => {
                const displayName = typeof item === 'string' 
                  ? item 
                  : item[displayField] || item.name || item;
                return (
                  <label key={item.id || index} className="multiselect-option">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(displayName)}
                      onChange={() => handleItemToggle(field, displayName)}
                    />
                    <span className="checkmark"></span>
                    <span className="option-text">
                      {displayName}
                      {options.showType && item.type && (
                        <span className="account-type">({item.type})</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            
            {/* Custom quick actions */}
            {options.quickActions && (
              <div className="multiselect-quick-actions">
                {options.quickActions}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="advanced-filter-overlay">
      <div className="advanced-filter-modal">
        <div className="filter-modal-header">
          <div className="header-title">
            <FontAwesomeIcon icon={faFilter} />
            Advanced Filters
          </div>
          <button className="close-btn" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="filter-modal-content">
          <div className="filter-grid">
            {/* Vendor Filter - Multiselect */}
            <div className="filter-group">
              <label>
                <FontAwesomeIcon icon={faUser} className="field-icon" />
                Vendor/Payee ({filters.vendor.length} selected)
              </label>
              {renderMultiselect('vendor', uniqueVendors, vendorDropdownOpen, setVendorDropdownOpen, 'name')}
            </div>

            {/* Category Filter - Multiselect */}
            <div className="filter-group">
              <label>
                <FontAwesomeIcon icon={faTag} className="field-icon" />
                Category ({filters.category.length} selected)
              </label>
              {renderMultiselect('category', uniqueCategories, categoryDropdownOpen, setCategoryDropdownOpen, 'name')}
            </div>

            {/* Unit Filter - Multiselect */}
            <div className="filter-group">
              <label>
                <FontAwesomeIcon icon={faBuilding} className="field-icon" />
                Unit ({filters.unit.length} selected)
              </label>
              {renderMultiselect('unit', uniqueUnits.map(u => typeof u === 'string' ? { name: u } : u), unitDropdownOpen, setUnitDropdownOpen)}
            </div>

            {/* Account Filter - Multiselect */}
            <div className="filter-group">
              <label>
                <FontAwesomeIcon icon={faBuilding} className="field-icon" />
                Account ({filters.account.length} selected)
              </label>
              {renderMultiselect('account', uniqueAccounts, accountDropdownOpen, setAccountDropdownOpen, 'name', {
                showType: true,
                quickActions: (
                  <>
                    <button 
                      type="button" 
                      className="quick-action-btn"
                      onClick={() => handleSelectAllAccountsByType('bank')}
                    >
                      All Bank
                    </button>
                    <button 
                      type="button" 
                      className="quick-action-btn"
                      onClick={() => handleSelectAllAccountsByType('cash')}
                    >
                      All Cash
                    </button>
                  </>
                )
              })}
            </div>

            {/* Amount Range */}
            <div className="filter-group amount-range">
              <label>
                <FontAwesomeIcon icon={faDollarSign} className="field-icon" />
                Amount Range
              </label>
              <div className="amount-inputs">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minAmount}
                  onChange={(e) => handleInputChange('minAmount', e.target.value)}
                  step="0.01"
                />
                <span className="amount-separator">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxAmount}
                  onChange={(e) => handleInputChange('maxAmount', e.target.value)}
                  step="0.01"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="filter-group date-range">
              <label>
                <FontAwesomeIcon icon={faCalendarAlt} className="field-icon" />
                Date Range
              </label>
              <div className="date-inputs">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                />
                <span className="date-separator">to</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                />
              </div>
            </div>

            {/* Description Filter */}
            <div className="filter-group full-width">
              <label>
                <FontAwesomeIcon icon={faStickyNote} className="field-icon" />
                Description Contains
              </label>
              <input
                type="text"
                placeholder="Search in description..."
                value={filters.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </div>

            {/* Notes Filter */}
            <div className="filter-group full-width">
              <label>
                <FontAwesomeIcon icon={faStickyNote} className="field-icon" />
                Notes Contains
              </label>
              <input
                type="text"
                placeholder="Search in notes..."
                value={filters.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="filter-modal-footer">
          <div className="filter-actions-left">
            <button 
              className="clear-btn" 
              onClick={handleClear}
              disabled={!hasActiveFilters}
            >
              <FontAwesomeIcon icon={faTrash} />
              Clear
            </button>
            <button 
              className="reset-btn" 
              onClick={handleReset}
            >
              Reset All
            </button>
          </div>
          <div className="filter-actions-right">
            <button className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="apply-btn" 
              onClick={handleApply}
            >
              <FontAwesomeIcon icon={faCheck} />
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedFilterModal;
