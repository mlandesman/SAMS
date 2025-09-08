import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Divider
} from '@mui/material';
import { SwapHoriz } from '@mui/icons-material';
import { useExchangeRates } from '../hooks/useExchangeRates';
import './ExchangeRatesView.css';

const ExchangeRatesView = () => {
  const { exchangeRate, loading } = useExchangeRates();
  const [amount, setAmount] = useState('1000');
  const [currency, setCurrency] = useState('USD');
  const [convertedAmount, setConvertedAmount] = useState(null);
  
  const currentRate = exchangeRate?.usdToMxn || 0;
  const effectiveDate = exchangeRate?.date || new Date().toISOString();
  
  useEffect(() => {
    if (currentRate && amount) {
      const numAmount = parseFloat(amount) || 0;
      if (currency === 'USD') {
        setConvertedAmount((numAmount * currentRate).toFixed(2));
      } else {
        setConvertedAmount((numAmount / currentRate).toFixed(2));
      }
    }
  }, [amount, currency, currentRate]);
  
  const handleCurrencyChange = (event, newCurrency) => {
    if (newCurrency !== null) {
      setCurrency(newCurrency);
    }
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  return (
    <Box className="exchange-rates-container">
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        Exchange Rate Calculator
      </Typography>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Current Exchange Rate
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#1976d2' }}>
                1 USD = {currentRate.toFixed(2)} MXN
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Effective: {formatDate(effectiveDate)}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Convert Currency
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <ToggleButtonGroup
              value={currency}
              exclusive
              onChange={handleCurrencyChange}
              fullWidth
              sx={{ mb: 2 }}
            >
              <ToggleButton value="USD" sx={{ py: 1.5 }}>
                USD → MXN
              </ToggleButton>
              <ToggleButton value="MXN" sx={{ py: 1.5 }}>
                MXN → USD
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={`Amount in ${currency}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                inputProps={{ 
                  min: 0,
                  style: { fontSize: '1.2rem' }
                }}
                sx={{ mb: 2 }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2, 
                  backgroundColor: '#f5f5f5',
                  textAlign: 'center'
                }}
              >
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Converted Amount
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {currency === 'USD' ? 'MXN' : 'USD'} {convertedAmount || '0.00'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <SwapHoriz sx={{ fontSize: 40, color: '#1976d2' }} />
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Exchange rates are updated daily
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ExchangeRatesView;