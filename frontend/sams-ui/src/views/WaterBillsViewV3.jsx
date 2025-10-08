import React, { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ActivityActionBar from '../components/common/ActivityActionBar';
import WaterReadingEntry from '../components/water/WaterReadingEntry';
import WaterBillsList from '../components/water/WaterBillsList';
import WaterHistoryGrid from '../components/water/WaterHistoryGrid';
import waterAPI from '../api/waterAPI';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTint, 
  faFileInvoice, 
  faHistory,
  faChevronLeft,
  faChevronRight,
  faSync,
  faExchangeAlt
} from '@fortawesome/free-solid-svg-icons';
import './WaterBillsIntegratedView.css';
import '../components/water/WaterBillsList.css';

function WaterBillsViewV3() {
  console.log('🔍 WaterBillsViewV3 RENDERING - VERSION 3.0 WITH TABS - ' + new Date().toISOString());
  
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState('readings');
  const [selectedYear, setSelectedYear] = useState(2026); // Default to FY 2026
  const [selectedMonth, setSelectedMonth] = useState(0); // Default to July (month 0)
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Transaction linking state (following HOA Dues pattern)
  const [selectedBill, setSelectedBill] = useState(null); // Currently selected bill for transaction viewing
  
  // For now, extract unit IDs from the first successful API call
  // and create placeholder units until backend adds owner info
  const [yearData, setYearData] = useState(null);
  
  useEffect(() => {
    if (selectedClient) {
      // Fetch initial data to get unit IDs and determine auto-advance month
      waterAPI.getAggregatedData(selectedClient.id, 2026)
        .then(response => {
          setYearData(response.data);
          
          // Auto-advance to next unsaved readings month (Task 2.4)
          if (response.data?.months && response.data.months.length > 0) {
            // Find the last month that has readings data
            const monthsWithData = response.data.months
              .filter(m => m.units && Object.keys(m.units).length > 0)
              .map(m => m.month)
              .sort((a, b) => a - b);
            
            if (monthsWithData.length > 0) {
              const lastMonth = monthsWithData[monthsWithData.length - 1];
              // Set to next month (wrapping to 0 if at end of fiscal year)
              const nextMonth = lastMonth < 11 ? lastMonth + 1 : 11;
              console.log(`🔍 Auto-advancing Readings to month ${nextMonth} (last saved: ${lastMonth})`);
              setSelectedMonth(nextMonth);
            }
          }
        })
        .catch(err => console.error('Error fetching initial data:', err));
    }
  }, [selectedClient]);
  
  // Extract unit IDs from API response and create units array
  const units = React.useMemo(() => {
    if (yearData?.months?.[0]?.units) {
      return Object.keys(yearData.months[0].units).map(unitId => ({
        unitId: unitId,
        ownerName: yearData.months[0].units[unitId]?.ownerName || 'No Name Available',
        ownerLastName: yearData.months[0].units[unitId]?.ownerLastName || ''
      }));
    }
    return [];
  }, [yearData]);
  
  // Fiscal month names (AVII starts July)
  const fiscalMonthNames = [
    'July', 'August', 'September', 'October', 'November', 'December',
    'January', 'February', 'March', 'April', 'May', 'June'
  ];
  
  // Enhanced refresh function that integrates with WaterBillsList cache clearing
  const handleRefresh = async () => {
    console.log('🔄 [WaterBillsViewV3] Action Bar refresh triggered');
    
    // If we're on the Bills tab and the WaterBillsList refresh function is available, use it
    if (activeTab === 'bills' && window.waterBillsRefresh) {
      await window.waterBillsRefresh();
    } else {
      // Otherwise, just increment refresh key for other tabs
      setRefreshKey(prev => prev + 1);
    }
  };
  
  // Handle save success from reading entry
  const handleReadingSaveSuccess = () => {
    handleRefresh();
  };
  
  // Handle View Transaction button click (following HOA Dues pattern exactly)
  const handleViewTransaction = () => {
    if (selectedBill?.transactionId) {
      console.log(`💳 Navigating to transaction ID: ${selectedBill.transactionId}`);
      navigate(`/transactions?id=${selectedBill.transactionId}`);
      
      // Update sidebar activity (following HOA Dues pattern)
      try {
        const event = new CustomEvent('activityChange', { 
          detail: { activity: 'transactions' } 
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error('Error dispatching activity change event:', error);
      }
    }
  };
  
  // Bill selection handler for Action Bar integration
  const handleBillSelection = (bill) => {
    setSelectedBill(bill);
    console.log('📝 Selected bill for transaction linking:', bill);
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
    <div className="month-selector">
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
        <YearNavigation />
        <button className="action-item" onClick={handleRefresh}>
          <FontAwesomeIcon icon={faSync} />
          <span>Refresh</span>
        </button>
        {/* View Transaction button - follows task assignment pattern */}
        <button 
          className="action-item" 
          onClick={handleViewTransaction}
          disabled={!selectedBill?.transactionId}
          title={selectedBill?.transactionId ? 'View linked transaction details' : 'Select a paid bill to view transaction'}
        >
          <FontAwesomeIcon icon={faExchangeAlt} />
          <span>View Trnx</span>
        </button>
      </ActivityActionBar>
      
      <div className="water-bills-content">
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'readings' ? 'active' : ''}`}
            onClick={() => {
              console.log('🔍 Switching to readings tab');
              setActiveTab('readings');
            }}
          >
            <FontAwesomeIcon icon={faTint} />
            <span>Readings</span>
          </button>
          <button 
            className={`tab-button ${activeTab === 'bills' ? 'active' : ''}`}
            onClick={() => {
              console.log('🔍 Switching to bills tab');
              setActiveTab('bills');
            }}
          >
            <FontAwesomeIcon icon={faFileInvoice} />
            <span>Bills</span>
          </button>
          <button 
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              console.log('🔍 Switching to history tab');
              setActiveTab('history');
            }}
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
                onBillSelection={handleBillSelection}
                selectedBill={selectedBill}
                onRefresh={() => setRefreshKey(prev => prev + 1)}
              />
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="tab-panel">
              <WaterHistoryGrid 
                key={`history-${refreshKey}`}
                clientId={selectedClient.id}
                onBillSelection={handleBillSelection}
                selectedBill={selectedBill}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WaterBillsViewV3;