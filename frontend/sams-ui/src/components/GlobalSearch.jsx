import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import './GlobalSearch.css';

const GlobalSearch = ({ onSearch, onClear, onEnter, isActive, placeholder = "Search..." }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);  // For click-outside detection
  const inputRef = useRef(null);       // For auto-focus

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
      if (containerRef.current && !containerRef.current.contains(event.target)) {
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
    } else if (e.key === 'Enter' && searchTerm.trim() && onEnter) {
      // Allow parent to handle Enter (e.g., select first result)
      onEnter(searchTerm.trim());
    }
  };

  return (
    <div className={`global-search ${isExpanded ? 'expanded' : ''} ${isActive ? 'active' : ''}`}>
      {isExpanded ? (
        <div className="search-input-container" ref={containerRef}>
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
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
          title="Search"
        >
          <FontAwesomeIcon icon={faSearch} />
        </button>
      )}
    </div>
  );
};

export default GlobalSearch;
