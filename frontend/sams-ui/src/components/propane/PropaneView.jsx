import React, { useState, useEffect } from 'react';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import PropTypes from 'prop-types';
import PropaneHistoryTable from './PropaneHistoryTable';
import ActivityActionBar from '../common/ActivityActionBar';
import { useParams } from 'react-router-dom';
import '../../layout/ActionBar.css';
import './PropaneView.css';

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

  const handleYearChange = (delta) => {
    const newYear = selectedYear + delta;
    setSelectedYear(newYear);
  };

  return (
    <div className="view-container">
      {/* ACTION BAR with Year Navigation */}
      <ActivityActionBar>
        {/* Year Navigation (rightmost) */}
        <div className="year-navigation" style={{ marginLeft: 'auto' }}>
          <button 
            className="year-nav-button"
            onClick={() => handleYearChange(-1)}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <div className="year-display">
            <span className="year-text">{selectedYear}</span>
          </div>
          <button 
            className="year-nav-button"
            onClick={() => handleYearChange(1)}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </ActivityActionBar>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
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
          hideYearNavigation={true}
        />
      </TabPanel>
    </div>
  );
};

export default PropaneView;
