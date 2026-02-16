import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import DateTimeDisplay from '../components/DateTimeDisplay';
import GlobalSearch from '../components/GlobalSearch';
import DateRangeDropdown from '../components/DateRangeDropdown';
import ListManagementStatusContent from '../components/ListManagementStatusContent';
import { useTransactionsContext } from '../context/TransactionsContext';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useStatusBar } from '../context/StatusBarContext';
import { useVersionInfo, getEnvironmentStyles } from '../utils/versionUtils';
import AboutModal from './AboutModal';
import './StatusBar.css';

const StatusBar = ({ children }) => {
  const location = useLocation();
  const [aboutOpen, setAboutOpen] = useState(false);
  const versionInfo = useVersionInfo(); // Use hook for reactive updates
  const envStyles = getEnvironmentStyles();
  
  const { transactionCount } = useTransactionsContext();
  const {
    currentDateRange,
    handleGlobalSearch,
    handleClearGlobalSearch,
    handleDateRangeSelect,
    isGlobalSearchActive,
    advancedFilters
  } = useTransactionFilters();
  
  // Generic status bar context
  const { statusInfo, centerContent, errorMonitorStatus } = useStatusBar();
  
  const handleStatusClick = () => {
    setAboutOpen(true);
  };
  
  // Check what page we're on
  const isTransactionsPage = location.pathname === '/transactions';
  const isListManagementPage = location.pathname === '/listmanagement' || location.pathname === '/lists';

  return (
    <div className="status-bar">
      {/* Always show date/time on the left */}
      <DateTimeDisplay />
      
      {/* Center: Custom content or route-specific content */}
      <div className="status-bar-center">
        {children ? (
          children
        ) : centerContent ? (
          centerContent
        ) : isListManagementPage && statusInfo?.type === 'listManagement' ? (
          <ListManagementStatusContent
            entryCount={statusInfo.entryCount}
            onGlobalSearch={() => {}} // TODO: Implement search
            onClearGlobalSearch={() => {}} // TODO: Implement search clear
            isGlobalSearchActive={statusInfo.isSearchActive}
          />
        ) : isTransactionsPage ? (
          <>
            <GlobalSearch
              onSearch={handleGlobalSearch}
              onClear={handleClearGlobalSearch}
              isActive={isGlobalSearchActive}
            />
            <DateRangeDropdown 
              onDateRangeSelect={handleDateRangeSelect}
              currentRange={currentDateRange}
              showLabel={true}
              transactionCount={transactionCount}
              advancedFiltersActive={advancedFilters && Object.keys(advancedFilters).length > 0}
            />
          </>
        ) : null}
      </div>
      
      {/* Right side: Connection status with version */}
      <div className="status-bar-right">
        <div 
          className="connection-status-enhanced"
          onClick={handleStatusClick}
        >
          <span className="connection-indicator">●</span>
          <span className="connection-text">Connected — {versionInfo.appName}</span>
          {errorMonitorStatus && !errorMonitorStatus.loading && (
            <span
              className="error-monitor-status"
              onClick={(e) => {
                e.stopPropagation();
                errorMonitorStatus.openModal?.();
              }}
              style={{
                marginLeft: 8,
                cursor: errorMonitorStatus.openModal ? 'pointer' : 'default',
                opacity: 0.9,
                fontSize: '0.85em',
              }}
            >
              {errorMonitorStatus.error
                ? '• Unable to check errors'
                : errorMonitorStatus.count === 0
                  ? '• No system errors'
                  : `• ${errorMonitorStatus.count} system error${errorMonitorStatus.count !== 1 ? 's' : ''}`}
            </span>
          )}
          <span 
            className="version-badge"
            style={{
              backgroundColor: versionInfo.environmentConfig.color,
              color: 'white'
            }}
          >
            {versionInfo.versionDisplay}
          </span>
          <span className="environment-icon">{versionInfo.environmentConfig.icon}</span>
          <span 
            className="environment-label"
            style={{ color: versionInfo.environmentConfig.color }}
          >
            {versionInfo.displayEnvironment}
          </span>
          <span className="info-hint">ⓘ</span>
        </div>
      </div>
      
      {/* About Modal */}
      <AboutModal 
        open={aboutOpen} 
        onClose={() => setAboutOpen(false)}
        versionInfo={versionInfo}
      />
    </div>
  );
};

export default StatusBar;