import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faChevronDown, faFilter } from '@fortawesome/free-solid-svg-icons';
import './DateRangeDropdown.css';

const DateRangeDropdown = ({ onDateRangeSelect, currentRange, showLabel = false, transactionCount = 0, advancedFiltersActive = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const dateRanges = [
    { id: 'all', label: 'All Time', value: 'all' },
    { id: 'yearToDate', label: 'Year to Date', value: 'yearToDate' },
    { id: 'previousYear', label: 'Previous Year', value: 'previousYear' },
    { id: 'currentMonth', label: 'Current Month', value: 'currentMonth' },
    { id: 'previousMonth', label: 'Previous Month', value: 'previousMonth' },
    { id: 'previous3Months', label: 'Previous 3 Months', value: 'previous3Months' },
    { id: 'today', label: 'Today', value: 'today' },
    { id: 'yesterday', label: 'Yesterday', value: 'yesterday' },
    { id: 'thisWeek', label: 'This Week', value: 'thisWeek' },
    { id: 'lastWeek', label: 'Last Week', value: 'lastWeek' },
    { id: 'custom', label: 'Custom Range...', value: 'custom' }
  ];

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleRangeSelect = (range) => {
    setIsOpen(false);
    onDateRangeSelect(range);
  };

  const getCurrentRangeLabel = () => {
    if (!currentRange) return 'All Time';
    const range = dateRanges.find(r => r.id === currentRange);
    return range ? range.label : 'Custom Range';
  };

  const formatDateRangeDisplay = () => {
    const now = new Date();
    const rangeLabel = getCurrentRangeLabel();
    
    // If it's "All Time", just show the current date
    if (!currentRange || currentRange === 'all') {
      return now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    
    // For other ranges, show the range label with icon
    return (
      <span className="date-range-display">
        <FontAwesomeIcon icon={faCalendarAlt} className="calendar-icon" />
        {rangeLabel}
        <FontAwesomeIcon icon={faChevronDown} className="dropdown-arrow" />
      </span>
    );
  };

  return (
    <div className="date-range-dropdown" ref={dropdownRef}>
      <button 
        className={`date-toggle-btn ${(currentRange && currentRange !== 'all') || advancedFiltersActive ? 'filtered' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Filter by date range"
      >
        {showLabel ? (
          <span className="filter-label-with-count">
            {advancedFiltersActive && <FontAwesomeIcon icon={faFilter} className="filter-icon" />}
            {advancedFiltersActive ? 'Filtered' : getCurrentRangeLabel()} ({transactionCount})
            <FontAwesomeIcon icon={faChevronDown} className="dropdown-arrow" />
          </span>
        ) : (
          formatDateRangeDisplay()
        )}
      </button>
      
      {isOpen && (
        <div className="date-dropdown-menu">
          <div className="dropdown-header">
            <FontAwesomeIcon icon={faCalendarAlt} />
            Quick Date Filters
          </div>
          {dateRanges.map((range) => (
            <button
              key={range.id}
              className={`dropdown-item ${currentRange === range.id ? 'selected' : ''}`}
              onClick={() => handleRangeSelect(range)}
            >
              {range.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DateRangeDropdown;
