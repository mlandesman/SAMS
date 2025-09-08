import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Grid,
  Divider,
  Alert,
  Button,
  InputAdornment,
} from '@mui/material';
import {
  CurrencyExchange as CurrencyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const ExchangeRateTools = () => {
  const [currentRate, setCurrentRate] = useState(41.25);
  const [usdAmount, setUsdAmount] = useState('');
  const [uyuAmount, setUyuAmount] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Mock function to simulate fetching exchange rates
  const fetchExchangeRate = async () => {
    // In real implementation, this would call the SAMS API
    const mockRate = 41.25 + (Math.random() - 0.5) * 0.5;
    setCurrentRate(Number(mockRate.toFixed(2)));
    setLastUpdated(new Date());
  };

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const handleUsdChange = (event) => {
    const usd = event.target.value;
    setUsdAmount(usd);
    if (usd && !isNaN(usd)) {
      setUyuAmount((parseFloat(usd) * currentRate).toFixed(2));
    } else {
      setUyuAmount('');
    }
  };

  const handleUyuChange = (event) => {
    const uyu = event.target.value;
    setUyuAmount(uyu);
    if (uyu && !isNaN(uyu)) {
      setUsdAmount((parseFloat(uyu) / currentRate).toFixed(2));
    } else {
      setUsdAmount('');
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Box p={2} pb={10}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h5" gutterBottom>
          Exchange Rate Tools
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Current USD to UYU exchange rate and currency calculator
        </Typography>
      </Box>

      {/* Current Rate Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center">
              <CurrencyIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Current Rate</Typography>
            </Box>
            <Button
              size="small"
              onClick={fetchExchangeRate}
              startIcon={<RefreshIcon />}
            >
              Refresh
            </Button>
          </Box>
          
          <Typography variant="h3" color="primary" gutterBottom>
            {currentRate}
          </Typography>
          
          <Typography variant="body1" gutterBottom>
            1 USD = {currentRate} UYU
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            Last updated: {formatTime(lastUpdated)}
          </Typography>
        </CardContent>
      </Card>

      {/* Currency Calculator */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Currency Calculator
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="US Dollars"
                type="number"
                value={usdAmount}
                onChange={handleUsdChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                placeholder="Enter USD amount"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Uruguayan Pesos"
                type="number"
                value={uyuAmount}
                onChange={handleUyuChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$U</InputAdornment>,
                }}
                placeholder="Enter UYU amount"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Example Conversions */}
          <Typography variant="h6" gutterBottom>
            Quick Reference
          </Typography>
          
          <Grid container spacing={2}>
            {[100, 500, 1000, 5000].map((amount) => (
              <Grid item xs={6} sm={3} key={amount}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      ${amount} USD
                    </Typography>
                    <Typography variant="h6" color="primary">
                      $U{(amount * currentRate).toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              Exchange rates are updated periodically throughout the day. 
              For official transactions, always verify the rate at the time of conversion.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ExchangeRateTools;
