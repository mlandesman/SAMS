import React, { useState, useEffect } from 'react';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import PropTypes from 'prop-types';
import PropaneHistoryTable from './PropaneHistoryTable';
import { useParams } from 'react-router-dom';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`propane-tabpanel-${index}`}
      aria-labelledby={`propane-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

const PropaneView = () => {
  const { clientId } = useParams();
  const [tabValue, setTabValue] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
          Propane Tank Levels
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
          MTC - Marina Turquesa Condominiums
        </Typography>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="History" />
          {/* Future: <Tab label="Current Month" /> */}
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <PropaneHistoryTable 
          clientId={clientId || 'MTC'} 
          year={selectedYear}
          onYearChange={setSelectedYear}
        />
      </TabPanel>
    </Box>
  );
};

export default PropaneView;
