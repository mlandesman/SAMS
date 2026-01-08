import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Select, MenuItem, FormControl, InputLabel, Alert, CircularProgress } from '@mui/material';
import { config } from '../../config';
import { useClient } from '../../context/ClientContext';
import { getAuthInstance } from '../../firebaseClient';

/**
 * Water Consumption Analysis Component
 * Displays consumption analysis table for leak detection
 */
export default function WaterConsumptionAnalysis({ fiscalYear: initialFiscalYear }) {
  const { selectedClient } = useClient();
  const [fiscalYear, setFiscalYear] = useState(initialFiscalYear || 2026);
  const [analysisData, setAnalysisData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get auth token
  const getToken = async () => {
    const auth = getAuthInstance();
    return await auth.currentUser?.getIdToken();
  };

  // Fetch consumption analysis data
  const fetchAnalysisData = async () => {
    if (!selectedClient) return;

    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(
        `${config.api.baseUrl}/water/clients/${selectedClient.id}/consumption-analysis/${fiscalYear}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const result = await response.json();
      
      if (result.success) {
        setAnalysisData(result.data || []);
      } else {
        setError(result.error || 'Failed to load consumption analysis');
      }
    } catch (err) {
      console.error('Error fetching consumption analysis:', err);
      setError(err.message || 'Failed to load consumption analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) {
      fetchAnalysisData();
    }
  }, [selectedClient, fiscalYear]);

  // Format number with commas
  const formatNumber = (num) => {
    if (num === null || num === undefined) return 'N/A';
    return num.toLocaleString('en-US');
  };

  // Format percentage
  const formatPercent = (percent) => {
    if (percent === null || percent === undefined) return 'N/A';
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
  };

  // Get color for delta percentage
  const getDeltaColor = (percent) => {
    if (percent === null || percent === undefined) return 'inherit';
    const absPercent = Math.abs(percent);
    if (absPercent <= 5) return '#4caf50'; // Green
    if (absPercent <= 10) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  if (!selectedClient) {
    return (
      <Alert severity="info">Please select a client</Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Consumption Analysis</Typography>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Fiscal Year</InputLabel>
          <Select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            label="Fiscal Year"
          >
            {[2024, 2025, 2026, 2027].map(year => (
              <MenuItem key={year} value={year}>FY {year}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : analysisData.length === 0 ? (
        <Alert severity="info">No consumption data available for this fiscal year</Alert>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Month</strong></TableCell>
                  <TableCell align="right"><strong>Units Total</strong></TableCell>
                  <TableCell align="right"><strong>Common</strong></TableCell>
                  <TableCell align="right"><strong>Building</strong></TableCell>
                  <TableCell align="right"><strong>Delta</strong></TableCell>
                  <TableCell align="right"><strong>%</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analysisData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.monthName}</TableCell>
                    <TableCell align="right">{formatNumber(row.unitsTotal)}</TableCell>
                    <TableCell align="right">{formatNumber(row.commonArea)}</TableCell>
                    <TableCell align="right">{formatNumber(row.building)}</TableCell>
                    <TableCell align="right">{formatNumber(row.delta)}</TableCell>
                    <TableCell 
                      align="right"
                      sx={{ 
                        color: getDeltaColor(row.percentage),
                        fontWeight: Math.abs(row.percentage || 0) > 10 ? 'bold' : 'normal'
                      }}
                    >
                      {formatPercent(row.percentage)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Legend:</Typography>
            <Typography variant="body2" component="div">
              <strong>Units Total:</strong> Sum of all unit consumption<br />
              <strong>Common:</strong> Common area meter consumption<br />
              <strong>Building:</strong> Building meter consumption (utility billed)<br />
              <strong>Delta:</strong> (Units Total + Common) - Building<br />
              <strong>%:</strong> Delta / Building * 100
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <span style={{ color: '#4caf50' }}>Green:</span> Delta within ±5% |{' '}
              <span style={{ color: '#ff9800' }}>Orange:</span> Delta {'>'} 5% |{' '}
              <span style={{ color: '#f44336' }}>Red:</span> Delta {'>'} 10%
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
}
