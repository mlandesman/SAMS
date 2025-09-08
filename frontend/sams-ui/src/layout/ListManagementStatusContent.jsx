import React from 'react';
import GlobalSearch from './GlobalSearch';
import './ListManagementStatusContent.css';

/**
 * StatusBar content specifically for List Management screens
 * Shows a search icon and entry count in the center
 */
const ListManagementStatusContent = ({ 
  entryCount = 0,
  onGlobalSearch,
  onClearGlobalSearch,
  isGlobalSearchActive = false
}) => {
  return (
    <div className="list-management-status-content">
      <GlobalSearch
        onSearch={onGlobalSearch}
        onClear={onClearGlobalSearch}
        isActive={isGlobalSearchActive}
      />
      <span className="entry-count">
        Entries ({entryCount})
      </span>
    </div>
  );
};

export default ListManagementStatusContent;
