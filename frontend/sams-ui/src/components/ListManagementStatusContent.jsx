import React from 'react';
import GlobalSearch from './GlobalSearch';
import { useDesktopStrings } from '../hooks/useDesktopStrings';
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
  const { t } = useDesktopStrings();

  return (
    <div className="list-management-status-content">
      <GlobalSearch
        onSearch={onGlobalSearch}
        onClear={onClearGlobalSearch}
        isActive={isGlobalSearchActive}
      />
      <span className="entry-count">
        {t('list.entries', { count: entryCount })}
      </span>
    </div>
  );
};

export default ListManagementStatusContent;
