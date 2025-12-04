import React, { useState, useEffect, useCallback } from 'react';
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
import StatementOfAccountTab from '../components/reports/StatementOfAccountTab';
import BudgetActualTab from '../components/reports/BudgetActualTab';
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
  const { selectedClient } = useClient();
  const [tabIndex, setTabIndex] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const { setCenterContent, clearCenterContent } = useStatusBar();

  const handleZoomChange = useCallback((event) => {
    const value = Number(event.target.value);
    setZoom(value);
  }, []);

  // Register zoom control in the StatusBar center when on Reports
  useEffect(() => {
    const zoomControl = (
      <div className="status-zoom-control">
        <span className="status-zoom-label">Zoom</span>
        <select
          className="status-zoom-select"
          value={zoom}
          onChange={handleZoomChange}
        >
          <option value={0.75}>75%</option>
          <option value={1.0}>100%</option>
          <option value={1.25}>125%</option>
          <option value={1.5}>150%</option>
          <option value={2.0}>200%</option>
        </select>
      </div>
    );

    setCenterContent(zoomControl);

    return () => {
      clearCenterContent();
    };
  }, [zoom, setCenterContent, clearCenterContent, handleZoomChange]);

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
    <div className="reports-view">
      <div className="reports-header">
        <h1>Reports</h1>
        <p className="reports-subtitle">Generate and manage financial reports</p>
      </div>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
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
        {tabIndex === 0 && <StatementOfAccountTab zoom={zoom} />}
        {tabIndex === 1 && <BudgetActualTab zoom={zoom} />}
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

