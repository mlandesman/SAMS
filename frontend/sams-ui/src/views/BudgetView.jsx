import React, { useState } from 'react';
import { Tab, Tabs, Box, Typography, Alert, CircularProgress } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCoins,
  faChartPie
} from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../context/ClientContext';
import BudgetEntryTab from '../components/budget/BudgetEntryTab';
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
        <Box sx={{ p: 2 }}>
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
            label="Budget vs Actual" 
            icon={<FontAwesomeIcon icon={faChartPie} />}
            iconPosition="start"
            disabled
          />
        </Tabs>
      </Box>
      
      <TabPanel value={tabIndex} index={0}>
        <BudgetEntryTab />
      </TabPanel>
      
      <TabPanel value={tabIndex} index={1}>
        <div className="budget-placeholder">
          <FontAwesomeIcon icon={faChartPie} size="3x" className="placeholder-icon" />
          <h2>Budget vs Actual</h2>
          <p>Compare budgeted amounts to actual spending.</p>
          <p className="coming-soon">Coming soon</p>
        </div>
      </TabPanel>
    </div>
  );
}

export default BudgetView;

