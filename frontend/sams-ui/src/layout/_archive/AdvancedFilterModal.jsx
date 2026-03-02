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
  vendors = []
}) => {
  const [filters, setFilters] = useState({
    vendor: '',
    category: '',
    unit: '',
    account: '',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
    notes: '',
    description: ''
  });

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

  const uniqueVendors = vendors.length > 0 ? vendors : getUniqueValues('vendor');
  const uniqueCategories = categories.length > 0 ? categories : getUniqueValues('category');
  const uniqueUnits = units.length > 0 ? units : getUniqueValues('unit');
  const uniqueAccounts = getUniqueValues('account');

  const handleInputChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApply = () => {
    // Remove empty filters
    const cleanFilters = Object.entries(filters).reduce((acc, [key, value]) => {
      if (value && value.toString().trim()) {
        acc[key] = value.toString().trim();
      }
      return acc;
    }, {});
    
    onApplyFilters(cleanFilters);
    onClose();
  };

  const handleClear = () => {
    setFilters({
      vendor: '',
      category: '',
      unit: '',
      account: '',
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

  const hasActiveFilters = Object.values(filters).some(v => v && v.toString().trim());

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
            {/* Vendor Filter */}
            <div className="filter-group">
              <label>
                <FontAwesomeIcon icon={faUser} className="field-icon" />
                Vendor/Payee
              </label>
              <select 
                value={filters.vendor} 
                onChange={(e) => handleInputChange('vendor', e.target.value)}
              >
                <option value="">All vendors</option>
                {uniqueVendors.map(vendor => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="filter-group">
              <label>
                <FontAwesomeIcon icon={faTag} className="field-icon" />
                Category
              </label>
              <select 
                value={filters.category} 
                onChange={(e) => handleInputChange('category', e.target.value)}
              >
                <option value="">All categories</option>
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Unit Filter */}
            <div className="filter-group">
              <label>
                <FontAwesomeIcon icon={faBuilding} className="field-icon" />
                Unit
              </label>
              <select 
                value={filters.unit} 
                onChange={(e) => handleInputChange('unit', e.target.value)}
              >
                <option value="">All units</option>
                {uniqueUnits.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            {/* Account Filter */}
            <div className="filter-group">
              <label>
                <FontAwesomeIcon icon={faBuilding} className="field-icon" />
                Account
              </label>
              <select 
                value={filters.account} 
                onChange={(e) => handleInputChange('account', e.target.value)}
              >
                <option value="">All accounts</option>
                {uniqueAccounts.map(account => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
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
