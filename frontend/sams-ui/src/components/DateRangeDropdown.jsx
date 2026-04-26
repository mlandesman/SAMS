import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faChevronDown, faFilter } from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../context/ClientContext';
import { useDesktopStrings } from '../hooks/useDesktopStrings';
import './DateRangeDropdown.css';

const DateRangeDropdown = ({ onDateRangeSelect, currentRange, showLabel = false, transactionCount = 0, advancedFiltersActive = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { selectedClient } = useClient();
  const { t } = useDesktopStrings();
  
  // Check if client uses fiscal year
  const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1;
  const isFiscalYear = fiscalYearStartMonth !== 1;
  
  // Get current year for fiscal year labels
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentFiscalYear = isFiscalYear ? 
    (currentDate.getMonth() + 1 >= fiscalYearStartMonth ? currentYear + 1 : currentYear) : 
    currentYear;

  const dateRanges = [
    { id: 'all', label: t('date.allTime'), value: 'all' },
    { 
      id: 'yearToDate', 
      label: isFiscalYear ? t('date.yearToDateFiscal') : t('date.yearToDate'), 
      value: 'yearToDate',
      tooltip: isFiscalYear ? `Fiscal Year ${currentFiscalYear} to current date` : undefined
    },
    { 
      id: 'previousYear', 
      label: isFiscalYear ? t('date.previousYearFiscal') : t('date.previousYear'), 
      value: 'previousYear',
      tooltip: isFiscalYear ? `Fiscal Year ${currentFiscalYear - 1}` : undefined
    },
    { id: 'currentMonth', label: t('date.currentMonth'), value: 'currentMonth' },
    { id: 'previousMonth', label: t('date.previousMonth'), value: 'previousMonth' },
    { id: 'previous3Months', label: t('date.previous3Months'), value: 'previous3Months' },
    { id: 'today', label: t('date.today'), value: 'today' },
    { id: 'yesterday', label: t('date.yesterday'), value: 'yesterday' },
    { id: 'thisWeek', label: t('date.thisWeek'), value: 'thisWeek' },
    { id: 'lastWeek', label: t('date.lastWeek'), value: 'lastWeek' },
    { id: 'custom', label: t('date.customRange'), value: 'custom' }
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
    if (!currentRange) return t('date.allTime');
    const range = dateRanges.find(r => r.id === currentRange);
    return range ? range.label : t('date.customRangeLabel');
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
        title={t('date.filterByRange')}
      >
        {showLabel ? (
          <span className="filter-label-with-count">
            {advancedFiltersActive && <FontAwesomeIcon icon={faFilter} className="filter-icon" />}
            {(advancedFiltersActive ? t('date.filtered') : getCurrentRangeLabel())} ({transactionCount})
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
            {t('date.quickFilters')}
          </div>
          {dateRanges.map((range) => (
            <button
              key={range.id}
              className={`dropdown-item ${currentRange === range.id ? 'selected' : ''}`}
              onClick={() => handleRangeSelect(range)}
              title={range.tooltip || ''}
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
