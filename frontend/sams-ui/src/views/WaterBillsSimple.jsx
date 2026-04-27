import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, TextField, Typography, Paper, Alert, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { useClient } from '../context/ClientContext';
import { config } from '../config';
import { getFiscalYear } from '../utils/fiscalYearUtils';
import { getMexicoDateTime } from '../utils/timezone';
import { useDesktopStrings } from '../hooks/useDesktopStrings';
import './HOADuesView.css';

function WaterBillsSimple() {
  const { selectedClient } = useClient();
  const { t, language } = useDesktopStrings();
  
  // MONTH SELECTOR STATE - FIRST PRIORITY
  const [selectedMonth, setSelectedMonth] = useState(getMexicoDateTime().getMonth());
  const [selectedYear, setSelectedYear] = useState(getMexicoDateTime().getFullYear());
  
  // Readings state
  const [readings, setReadings] = useState({});
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  
  const locale = language === 'ES' ? 'es-MX' : 'en-US';
  const nowMexico = getMexicoDateTime();
  const monthNames = Array.from({ length: 12 }, (_value, monthIndex) =>
    new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2000, monthIndex, 1))
  );
  const fiscalMonthLabels = ['JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN']
    .map((_, index) => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2000, (index + 6) % 12, 1)).replace('.', '').toUpperCase());
  
  // Get auth token
  const getToken = async () => {
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    return await auth.currentUser?.getIdToken();
  };
  
  // Save readings
  const saveReadings = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      // Reading taken in month X represents consumption for month X-1
      // BUT we store it based on when the reading was taken, not consumption month
      // August 2025 reading = stored as August fiscal month (month 1 of FY 2026)
      
      // Calculate fiscal year and month based on READING month (not consumption month)
      let fiscalYear, fiscalMonth;
      if (selectedMonth >= 6) { // July-December readings
        fiscalYear = selectedYear + 1;
        fiscalMonth = selectedMonth - 6;
      } else { // January-June readings
        fiscalYear = selectedYear;
        fiscalMonth = selectedMonth + 6;
      }
      
      // For display purposes, get consumption month name
      let consumptionMonth = selectedMonth - 1;
      let consumptionYear = selectedYear;
      if (consumptionMonth < 0) {
        consumptionMonth = 11;
        consumptionYear = selectedYear - 1;
      }
      
      console.log(`Saving: Reading taken in ${monthNames[selectedMonth]} ${selectedYear} for ${monthNames[consumptionMonth]} ${consumptionYear} consumption as FY ${fiscalYear} month ${fiscalMonth}`);
      
      const token = await getToken();
      const response = await fetch(
        `${config.api.baseUrl}/clients/${selectedClient.id}/water/readings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            year: fiscalYear,
            month: fiscalMonth,
            readings
          })
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setMessage(
          t('water.savedReadings', {
            readingMonth: monthNames[selectedMonth],
            readingYear: selectedYear,
            consumptionMonth: monthNames[consumptionMonth],
            consumptionYear
          })
        );
        setReadings({});
        loadHistory();
      } else {
        setError(data.error || t('water.saveFailed'));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch units from backend
  const fetchUnits = useCallback(async () => {
    if (!selectedClient) return;
    
    try {
      setLoadingUnits(true);
      const token = await getToken();
      
      const response = await fetch(
        `${config.api.baseUrl}/clients/${selectedClient.id}/units`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const unitsData = data.data || data;
        setUnits(unitsData);
      }
    } catch (err) {
      console.error('Error fetching units:', err);
    } finally {
      setLoadingUnits(false);
    }
  }, [selectedClient]);
  
  // Load history
  const loadHistory = useCallback(async () => {
    if (!selectedClient) return;
    
    try {
      const token = await getToken();
      // Get fiscal year properly
      const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 7; // AVII starts in July
      const fiscalYear = getFiscalYear(getMexicoDateTime(), fiscalYearStartMonth);
      
      const response = await fetch(
        `${config.api.baseUrl}/clients/${selectedClient.id}/water/readings/${fiscalYear}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      if (data.success) {
        console.log('History data loaded:', data);
        if (data.detailedData) {
          console.log('📊 Consumption calculations available:');
          const july = data.detailedData[0];
          if (july && july['101']) {
            console.log('  Unit 101 July: Reading=' + july['101'].reading + 
                       ', Prior=' + july['101'].prior + 
                       ', Consumption=' + july['101'].consumption);
          }
        }
        setHistoryData(data);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  }, [selectedClient]);
  
  // Load units and history on mount
  useEffect(() => {
    if (selectedClient) {
      fetchUnits();
      loadHistory();
    }
  }, [selectedClient, fetchUnits, loadHistory]);
  
  if (!selectedClient) {
    return <Alert severity="info">{t('water.selectClient')}</Alert>;
  }
  
  return (
    <div className="hoa-dues-view">
      <div className="hoa-dues-content">
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        
        {/* ENTRY SECTION */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>{t('water.title')}</Typography>
          
          {/* MONTH SELECTOR - FIRST UI ELEMENT! */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>{t('water.month')}</InputLabel>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                label={t('water.month')}
              >
                {monthNames.map((month, index) => (
                  <MenuItem key={index} value={index}>{month}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>{t('water.year')}</InputLabel>
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                label={t('water.year')}
              >
                {[2024, 2025, 2026].map(year => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          {/* READING INPUTS */}
          <Typography variant="subtitle1" gutterBottom>{t('water.enterReadings')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2, mb: 3 }}>
            {units.map(unit => {
              const unitId = unit.unitId || unit.id;
              return (
                <TextField
                  key={unitId}
                  label={t('water.unitLabel', { unitId })}
                  type="number"
                  value={readings[unitId] || ''}
                  onChange={(e) => setReadings({...readings, [unitId]: parseInt(e.target.value)})}
                  size="small"
                />
              );
            })}
            <TextField
              label={t('water.commonArea')}
              type="number"
              value={readings.commonArea || ''}
              onChange={(e) => setReadings({...readings, commonArea: parseInt(e.target.value)})}
              size="small"
            />
          </Box>
          
          <Button variant="contained" onClick={saveReadings} disabled={loading}>
            {t('water.saveReadings')}
          </Button>
        </Paper>
        
        {/* HISTORY TABLE */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            {t('water.historyTitle', { year: historyData?.year || nowMexico.getFullYear() })}
          </Typography>
          
          {historyData && !loadingUnits ? (
            <div className="hoa-dues-table-container">
              <table className="hoa-dues-table">
                <thead>
                  <tr>
                    <th className="month-header">{t('water.month')}</th>
                    {units.map(unit => {
                      const unitId = unit.unitId || unit.id;
                      return <th key={unitId} className="unit-header">{unitId}</th>;
                    })}
                    <th className="unit-header">{t('water.commonArea')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fiscalMonthLabels.map((month, idx) => {
                    const monthData = historyData?.months?.[idx] || {};
                    const shortYear = String(historyData?.year || nowMexico.getFullYear()).slice(-2);
                    return (
                      <tr key={idx}>
                        <td className="month-label">{month}-{shortYear}</td>
                        {units.map(unit => {
                          const unitId = unit.unitId || unit.id;
                          const value = monthData[unitId] || monthData[String(unitId)] || '-';
                          return (
                            <td key={unitId} className="payment-cell">
                              {value}
                            </td>
                          );
                        })}
                        <td className="payment-cell">{monthData.commonArea || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Typography>{t('water.historyLoading')}</Typography>
          )}
        </Paper>
      </div>
    </div>
  );
}

export default WaterBillsSimple;