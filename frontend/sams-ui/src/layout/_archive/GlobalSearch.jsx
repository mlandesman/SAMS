import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import './GlobalSearch.css';

const GlobalSearch = ({ onSearch, onClear, isActive }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef(null);

  const handleClose = useCallback(() => {
    setIsExpanded(false);
    if (searchTerm) {
      setSearchTerm('');
      onClear();
    }
  }, [searchTerm, onClear]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (inputRef.current && !inputRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded, handleClose]);

  const handleToggle = () => {
    if (isExpanded) {
      handleClose();
    } else {
      setIsExpanded(true);
    }
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (value.trim()) {
      onSearch(value.trim());
    } else {
      onClear();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <div className={`global-search ${isExpanded ? 'expanded' : ''} ${isActive ? 'active' : ''}`}>
      {isExpanded ? (
        <div className="search-input-container" ref={inputRef}>
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder="Search all transactions..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="search-input"
          />
          <button 
            className="search-close-btn" 
            onClick={handleClose}
            title="Clear search"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      ) : (
        <button 
          className="search-toggle-btn" 
          onClick={handleToggle}
          title="Search transactions"
        >
          <FontAwesomeIcon icon={faSearch} />
        </button>
      )}
    </div>
  );
};

export default GlobalSearch;
