import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useClient } from '../context/ClientContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileInvoice,
  faChartLine,
  faHistory,
  faChartPie
} from '@fortawesome/free-solid-svg-icons';
import { Box, Tabs, Tab } from '@mui/material';
import { useStatusBar } from '../context/StatusBarContext';
import ActivityActionBar from '../components/common/ActivityActionBar';
import StatementOfAccountTab from '../components/reports/StatementOfAccountTab';
import BudgetActualTab from '../components/reports/BudgetActualTab';
import '../layout/ActionBar.css';
import './ReportsView.css';

function ActivityTab() {
  return (
    <div className="reports-tab-content">
      <div className="reports-placeholder">
        <FontAwesomeIcon icon={faChartLine} size="3x" className="placeholder-icon" />
        <h2>Activity Reports</h2>
        <p>View activity and transaction history reports.</p>
        <p className="coming-soon">Coming soon</p>
      </div>
    </div>
  );
}

function ReportsView() {
  const location = useLocation();
  const { selectedClient } = useClient();
  
  // Handle navigation state for direct tab selection
  const getInitialTab = () => {
    if (location.state?.activeTab === 'budget-actual') return 1;
    if (location.state?.activeTab === 'activity') return 2;
    return 0;
  };
  
  const [tabIndex, setTabIndex] = useState(getInitialTab);
  const [zoom, setZoom] = useState(1.0);
  const [zoomMode, setZoomMode] = useState('custom'); // 'custom', 'page-width', 'single-page'
  const { setCenterContent, clearCenterContent } = useStatusBar();

  const handleZoomChange = useCallback((event) => {
    const value = event.target.value;
    
    if (value === 'page-width' || value === 'single-page') {
      setZoomMode(value);
      // Calculate zoom based on container and content width
      // For now, use reasonable defaults - will be calculated dynamically when iframe loads
      if (value === 'page-width') {
        // Assume standard 8.5" page width (816px) fits in ~1000px container
        setZoom(0.8);
      } else if (value === 'single-page') {
        // Assume standard 11" page height (1056px) fits in ~600px container
        setZoom(0.5);
      }
    } else {
      setZoomMode('custom');
      setZoom(Number(value));
    }
  }, []);

  // Register zoom control in the StatusBar center when on Reports
  useEffect(() => {
    const zoomControl = (
      <div className="status-zoom-control">
        <span className="status-zoom-label">Zoom</span>
        <select
          className="status-zoom-select"
          value={zoomMode === 'custom' ? zoom : zoomMode}
          onChange={handleZoomChange}
        >
          <optgroup label="Fit">
            <option value="page-width">Page Width</option>
            <option value="single-page">Single Page</option>
          </optgroup>
          <optgroup label="Percentage">
            <option value={0.75}>75%</option>
            <option value={1.0}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={2.0}>200%</option>
          </optgroup>
        </select>
      </div>
    );

    setCenterContent(zoomControl);

    return () => {
      clearCenterContent();
    };
  }, [zoom, zoomMode, setCenterContent, clearCenterContent, handleZoomChange]);

  if (!selectedClient) {
    return (
      <div className="reports-view">
        <div className="reports-placeholder">
          <p>Please select a client to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* ACTION BAR */}
      <ActivityActionBar>
        {/* No actions needed for Reports view - client name is sufficient */}
      </ActivityActionBar>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, newIndex) => setTabIndex(newIndex)}
          aria-label="reports tabs"
          className="reports-tabs"
        >
          <Tab
            label="Statement of Account"
            icon={<FontAwesomeIcon icon={faFileInvoice} />}
            iconPosition="start"
          />
          <Tab
            label="Budget vs Actual"
            icon={<FontAwesomeIcon icon={faChartPie} />}
            iconPosition="start"
          />
          <Tab
            label="Activity"
            icon={<FontAwesomeIcon icon={faChartLine} />}
            iconPosition="start"
            disabled
          />
          <Tab
            label="History (Soon)"
            icon={<FontAwesomeIcon icon={faHistory} />}
            iconPosition="start"
            disabled
          />
        </Tabs>
      </Box>

      <div className="reports-content">
        {tabIndex === 0 && <StatementOfAccountTab zoom={zoom} zoomMode={zoomMode} />}
        {tabIndex === 1 && <BudgetActualTab zoom={zoom} zoomMode={zoomMode} />}
        {tabIndex === 2 && <ActivityTab />}
        {tabIndex === 3 && (
          <div className="reports-tab-content">
            <div className="reports-placeholder">
              <FontAwesomeIcon icon={faHistory} size="3x" className="placeholder-icon" />
              <h2>Report History</h2>
              <p>View previously generated reports.</p>
              <p className="coming-soon">Coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportsView;

