import React, { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import ActivityActionBar from '../components/common/ActivityActionBar';
import WaterReadingEntry from '../components/water/WaterReadingEntry';
import WaterBillsList from '../components/water/WaterBillsList';
import WaterHistoryGrid from '../components/water/WaterHistoryGrid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTint, 
  faFileInvoice, 
  faHistory,
  faChevronLeft,
  faChevronRight,
  faSync
} from '@fortawesome/free-solid-svg-icons';
import './WaterBillsIntegratedView.css';

function WaterBillsIntegratedView() {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();
  
  // State
  const [activeTab, setActiveTab] = useState('readings');
  const [selectedYear, setSelectedYear] = useState(2026); // Default to FY 2026
  const [selectedMonth, setSelectedMonth] = useState(0); // Default to July (month 0)
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Get units from client configuration
  const units = selectedClient?.configuration?.units || [];
  
  // Fiscal month names (AVII starts July)
  const fiscalMonthNames = [
    'July', 'August', 'September', 'October', 'November', 'December',
    'January', 'February', 'March', 'April', 'May', 'June'
  ];
  
  // Handle refresh
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };
  
  // Handle save success from reading entry
  const handleReadingSaveSuccess = () => {
    handleRefresh();
  };
  
  // Year navigation component
  const YearNavigation = () => (
    <div className="year-navigation">
      <button 
        className="year-nav-button"
        onClick={() => setSelectedYear(selectedYear - 1)}
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>
      <div className="year-display">
        <span className="year-text">FY {selectedYear}</span>
      </div>
      <button 
        className="year-nav-button"
        onClick={() => setSelectedYear(selectedYear + 1)}
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </div>
  );
  
  // Month selector for reading entry
  const MonthSelector = () => (
    <div className="month-selector-container">
      <label htmlFor="month-select">Select Month:</label>
      <select 
        id="month-select"
        value={selectedMonth} 
        onChange={(e) => setSelectedMonth(Number(e.target.value))}
        className="month-dropdown"
      >
        {fiscalMonthNames.map((month, idx) => {
          const calendarYear = idx < 6 ? selectedYear - 1 : selectedYear;
          return (
            <option key={idx} value={idx}>
              {month} {calendarYear}
            </option>
          );
        })}
      </select>
    </div>
  );
  
  if (!selectedClient) {
    return (
      <div className="water-bills-view">
        <div className="no-client-message">
          Please select a client to view water bills.
        </div>
      </div>
    );
  }
  
  return (
    <div className="water-bills-integrated-view">
      <ActivityActionBar>
        <button className="action-item" onClick={handleRefresh}>
          <FontAwesomeIcon icon={faSync} />
          <span>Refresh</span>
        </button>
      </ActivityActionBar>
      
      <div className="water-bills-content">
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'readings' ? 'active' : ''}`}
            onClick={() => setActiveTab('readings')}
          >
            <FontAwesomeIcon icon={faTint} />
            <span>Readings</span>
          </button>
          <button 
            className={`tab-button ${activeTab === 'bills' ? 'active' : ''}`}
            onClick={() => setActiveTab('bills')}
          >
            <FontAwesomeIcon icon={faFileInvoice} />
            <span>Bills</span>
          </button>
          <button 
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <FontAwesomeIcon icon={faHistory} />
            <span>History</span>
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'readings' && (
            <div className="tab-panel">
              <MonthSelector />
              <WaterReadingEntry 
                key={`reading-${refreshKey}-${selectedMonth}-${selectedYear}`}
                clientId={selectedClient.id}
                units={units}
                year={selectedYear}
                month={selectedMonth}
                onSaveSuccess={handleReadingSaveSuccess}
              />
            </div>
          )}
          
          {activeTab === 'bills' && (
            <div className="tab-panel">
              <WaterBillsList 
                key={`bills-${refreshKey}`}
                clientId={selectedClient.id}
              />
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="tab-panel">
              <WaterHistoryGrid 
                key={`history-${refreshKey}`}
                clientId={selectedClient.id}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WaterBillsIntegratedView;