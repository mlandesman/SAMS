// src/components/FilterSwitchModal.jsx
import React, { useState, useEffect } from 'react';
import './FilterSwitchModal.css';

function FilterSwitchModal({ onClose, onFilterSelected, selectedFilter: initialFilter }) {
  const [selectedFilter, setSelectedFilter] = useState(initialFilter || 'all');

  useEffect(() => {
    // Update the selected filter if it changes externally
    if (initialFilter) {
      setSelectedFilter(initialFilter);
    }
  }, [initialFilter]);

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'yearToDate', label: 'Year to Date' },
    { value: 'previousYear', label: 'Previous Year' },
    { value: 'currentMonth', label: 'Current Month' },
    { value: 'previousMonth', label: 'Previous Month' },
    { value: 'previous3Months', label: 'Previous 3 Months' },
  ];

  const handleFilterChange = (e) => {
    setSelectedFilter(e.target.value);
  };

  const handleApply = () => {
    onFilterSelected(selectedFilter);
    onClose();
  };

  return (
    <div className="filter-modal">
      <div className="filter-modal-content">
        <span className="filter-close" onClick={onClose}>
          &times;
        </span>
        <h2>Filter Transactions</h2>
        
        <div className="filter-options">
          <label htmlFor="filter-select">Select time period:</label>
          <select 
            id="filter-select" 
            value={selectedFilter} 
            onChange={handleFilterChange}
            className="filter-dropdown"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-actions">
          <button className="filter-cancel" onClick={onClose}>Cancel</button>
          <button className="filter-apply" onClick={handleApply}>Apply Filter</button>
        </div>
      </div>
    </div>
  );
}

export default FilterSwitchModal;