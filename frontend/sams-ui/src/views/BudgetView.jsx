import React, { useState, useEffect, useCallback } from 'react';
import { Tab, Tabs, Box, Typography, Alert, CircularProgress } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCoins,
  faChartPie,
  faFileAlt
} from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../context/ClientContext';
import { useStatusBar } from '../context/StatusBarContext';
import BudgetEntryTab from '../components/budget/BudgetEntryTab';
import BudgetReportTab from '../components/budget/BudgetReportTab';
import './BudgetView.css';

// TabPanel component to handle tab content
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`budget-tabpanel-${index}`}
      aria-labelledby={`budget-tab-${index}`}
      className="budget-tabpanel"
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Main Budget View component
function BudgetView() {
  const { selectedClient } = useClient();
  const [tabIndex, setTabIndex] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [zoomMode, setZoomMode] = useState('custom');
  const { setCenterContent, clearCenterContent } = useStatusBar();

  const handleZoomChange = useCallback((event) => {
    const value = event.target.value;
    
    if (value === 'page-width' || value === 'single-page') {
      setZoomMode(value);
      if (value === 'page-width') {
        setZoom(0.8);
      } else if (value === 'single-page') {
        setZoom(0.5);
      }
    } else {
      setZoomMode('custom');
      setZoom(Number(value));
    }
  }, []);

  // Register zoom control in the StatusBar center when on Budget Report tab
  useEffect(() => {
    if (tabIndex !== 1) {
      clearCenterContent();
      return;
    }

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
  }, [zoom, zoomMode, tabIndex, setCenterContent, clearCenterContent, handleZoomChange]);

  if (!selectedClient) {
    return (
      <div className="budget-view">
        <Alert severity="info" sx={{ mt: 2 }}>
          Please select a client to manage budgets
        </Alert>
      </div>
    );
  }

  return (
    <div className="budget-view">
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabIndex} 
          onChange={(_, newValue) => setTabIndex(newValue)} 
          aria-label="budget tabs"
          className="budget-tabs"
        >
          <Tab 
            label="Budget Entry" 
            icon={<FontAwesomeIcon icon={faCoins} />}
            iconPosition="start"
          />
          <Tab 
            label="Budget Report" 
            icon={<FontAwesomeIcon icon={faFileAlt} />}
            iconPosition="start"
          />
        </Tabs>
      </Box>
      
      <TabPanel value={tabIndex} index={0}>
        <BudgetEntryTab />
      </TabPanel>
      
      <TabPanel value={tabIndex} index={1}>
        <BudgetReportTab zoom={zoom} zoomMode={zoomMode} />
      </TabPanel>
    </div>
  );
}

export default BudgetView;

