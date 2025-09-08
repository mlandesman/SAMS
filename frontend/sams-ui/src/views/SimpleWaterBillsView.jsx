import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, Paper, Alert, CircularProgress } from '@mui/material';
import axios from 'axios';

function SimpleWaterBillsView() {
  const [readings, setReadings] = useState({});
  const [currentData, setCurrentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Units we're tracking
  const units = ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112'];
  
  // Get API base URL from config
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  
  // Get auth token from localStorage
  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Fetch current month data
  const fetchCurrentData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/clients/AVII/projects/waterBills/2026/0`,
        { headers: getAuthHeaders() }
      );
      
      if (response.data?.data) {
        setCurrentData(response.data.data);
        // Pre-fill readings with current values
        const currentReadings = {};
        units.forEach(unit => {
          if (response.data.data.units?.[unit]) {
            currentReadings[unit] = response.data.data.units[unit].currentReading || '';
          }
        });
        setReadings(currentReadings);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load water bills data');
    } finally {
      setLoading(false);
    }
  };

  // Submit new readings
  const submitReadings = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    
    // Filter out empty readings
    const validReadings = {};
    Object.entries(readings).forEach(([unit, value]) => {
      if (value && !isNaN(value)) {
        validReadings[unit] = parseInt(value);
      }
    });
    
    if (Object.keys(validReadings).length === 0) {
      setError('Please enter at least one reading');
      setLoading(false);
      return;
    }
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/clients/AVII/projects/waterBills/2026/0/readings`,
        { readings: validReadings },
        { headers: getAuthHeaders() }
      );
      
      if (response.data.success) {
        setMessage(`Successfully updated ${response.data.updated} units`);
        // Refresh data to show new consumption
        await fetchCurrentData();
      }
    } catch (err) {
      console.error('Error submitting readings:', err);
      setError(err.response?.data?.error || 'Failed to submit readings');
    } finally {
      setLoading(false);
    }
  };

  // Process payment for a unit
  const processPayment = async (unitId) => {
    const unitData = currentData?.units?.[unitId];
    if (!unitData || unitData.paid) return;
    
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/clients/AVII/projects/waterBills/2026/0/payments`,
        {
          unitId: unitId,
          amount: unitData.amount / 100, // Convert cents to pesos
          paymentDate: new Date().toISOString()
        },
        { headers: getAuthHeaders() }
      );
      
      if (response.data.success) {
        setMessage(`Payment processed for unit ${unitId}`);
        await fetchCurrentData();
      }
    } catch (err) {
      console.error('Error processing payment:', err);
      setError(`Failed to process payment for unit ${unitId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentData();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Water Bills - Simple Interface
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Enter Meter Readings for July 2025
        </Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {units.map(unit => {
            const unitData = currentData?.units?.[unit];
            return (
              <Box key={unit}>
                <TextField
                  label={`Unit ${unit}`}
                  type="number"
                  value={readings[unit] || ''}
                  onChange={(e) => setReadings({...readings, [unit]: e.target.value})}
                  fullWidth
                  size="small"
                  helperText={unitData ? `Prior: ${unitData.priorReading}` : ''}
                  disabled={loading}
                />
              </Box>
            );
          })}
        </Box>
        
        <Button 
          variant="contained" 
          onClick={submitReadings}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Submit Readings'}
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={fetchCurrentData}
          disabled={loading}
          sx={{ ml: 2 }}
        >
          Refresh Data
        </Button>
      </Paper>
      
      {currentData && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Current Bills - {currentData.period} (Billing: {currentData.billingMonth})
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {units.map(unit => {
              const unitData = currentData.units?.[unit];
              if (!unitData) return null;
              
              return (
                <Paper key={unit} elevation={2} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Unit {unit}
                  </Typography>
                  <Typography variant="body2">
                    Reading: {unitData.priorReading} → {unitData.currentReading}
                  </Typography>
                  <Typography variant="body2">
                    Consumption: {unitData.consumption} m³
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    Amount: ₱{(unitData.amount / 100).toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color={unitData.paid ? 'success.main' : 'error.main'}>
                    Status: {unitData.paid ? 'PAID' : 'UNPAID'}
                  </Typography>
                  {!unitData.paid && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => processPayment(unit)}
                      disabled={loading}
                      sx={{ mt: 1 }}
                    >
                      Process Payment
                    </Button>
                  )}
                </Paper>
              );
            })}
          </Box>
        </Paper>
      )}
    </Box>
  );
}

export default SimpleWaterBillsView;