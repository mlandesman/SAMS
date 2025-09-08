import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Button,
  useTheme,
  Card,
} from '@mui/material';
import { 
  SwapHoriz as SwapIcon,
  Calculate as CalculateIcon
} from '@mui/icons-material';
import { useExchangeRates } from '../hooks/useExchangeRates.jsx';

/**
 * Exchange Rates page for PWA
 * Supports USD, CAD, COP, EUR, MXN conversions
 */
const ExchangeRatesView = () => {
  const theme = useTheme();
  const { rates, loading } = useExchangeRates();
  
  console.log('ExchangeRatesView debug:', {
    rates,
    loading,
    hasRates: !!rates,
    rateKeys: rates ? Object.keys(rates) : []
  });
  
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('MXN');

  // Available currencies with display info
  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'COP', symbol: '$', name: 'Colombian Peso' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'MXN', symbol: '$', name: 'Mexican Peso' }
  ];

  /**
   * Convert amount between any two currencies using MXN as base
   */
  const convertCurrency = useCallback((amount, fromCurrency, toCurrency, ratesData) => {
    if (!amount || !ratesData) return null;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return null;
    
    if (fromCurrency === toCurrency) {
      return numAmount;
    }
    
    // Rates are stored as MXN_[Currency] format
    // We need to convert through MXN as base
    let mxnAmount;
    
    // Convert from source currency to MXN
    if (fromCurrency === 'MXN') {
      mxnAmount = numAmount;
    } else {
      // Get the rate from [Currency] to MXN (inverse of MXN_[Currency])
      const mxnToFromRate = ratesData[`MXN_${fromCurrency}`];
      if (!mxnToFromRate || !mxnToFromRate.rate || mxnToFromRate.rate === 0) return null;
      // Invert the rate to get [Currency] to MXN
      mxnAmount = numAmount / mxnToFromRate.rate;
    }
    
    // Convert from MXN to target currency
    if (toCurrency === 'MXN') {
      return mxnAmount;
    } else {
      // Get the rate from MXN to [Currency]
      const mxnToToRate = ratesData[`MXN_${toCurrency}`];
      if (!mxnToToRate || !mxnToToRate.rate || mxnToToRate.rate === 0) return null;
      return mxnAmount * mxnToToRate.rate;
    }
  }, []);

  /**
   * Format currency according to locale and currency type
   */
  const formatCurrency = useCallback((amount, currency) => {
    if (!amount) return '';
    
    const formatters = {
      USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      CAD: new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }),
      EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
      COP: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }),
      MXN: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
    };
    
    return formatters[currency]?.format(amount) || `${amount.toFixed(2)} ${currency}`;
  }, []);

  /**
   * Calculate conversion result
   */
  const result = useMemo(() => {
    return convertCurrency(amount, fromCurrency, toCurrency, rates);
  }, [amount, fromCurrency, toCurrency, rates, convertCurrency]);

  /**
   * Handle amount input changes
   */
  const handleAmountChange = useCallback((event) => {
    const value = event.target.value;
    // Allow empty, numbers, and decimal points
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  }, []);

  /**
   * Flip source and target currencies
   */
  const handleFlipCurrencies = useCallback(() => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }, [fromCurrency, toCurrency]);

  /**
   * Handle currency selection changes
   */
  const handleFromCurrencyChange = useCallback((event) => {
    const newFromCurrency = event.target.value;
    setFromCurrency(newFromCurrency);
    // Prevent same currency selection
    if (newFromCurrency === toCurrency) {
      const otherCurrencies = currencies.filter(c => c.code !== newFromCurrency);
      setToCurrency(otherCurrencies[0].code);
    }
  }, [toCurrency, currencies]);

  const handleToCurrencyChange = useCallback((event) => {
    const newToCurrency = event.target.value;
    setToCurrency(newToCurrency);
    // Prevent same currency selection
    if (newToCurrency === fromCurrency) {
      const otherCurrencies = currencies.filter(c => c.code !== newToCurrency);
      setFromCurrency(otherCurrencies[0].code);
    }
  }, [fromCurrency, currencies]);

  /**
   * Handle quick conversion buttons
   */
  const handleQuickAmount = useCallback((value) => {
    setAmount(value.toString());
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', pb: 10 }}>
      {/* Currency Calculator Card */}
      <Card className="mobile-card" sx={{ margin: '16px', padding: '20px' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <CalculateIcon sx={{ color: '#667eea', mr: 1, fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Currency Calculator</Typography>
        </Box>

        {/* Quick Amount Buttons */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Quick Amounts
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[10, 50, 100, 500, 1000, 5000].map((value) => (
              <Button
                key={value}
                variant={amount === value.toString() ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleQuickAmount(value)}
                sx={{ 
                  minWidth: 60,
                  flex: '1 1 auto'
                }}
              >
                {value}
              </Button>
            ))}
          </Box>
        </Box>

        {/* Amount Input */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Amount
          </Typography>
          <TextField
            fullWidth
            type="text"
            value={amount}
            onChange={handleAmountChange}
            placeholder="Enter amount"
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '1.5rem',
                '& fieldset': {
                  borderColor: 'rgba(0, 0, 0, 0.23)',
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.primary.main,
                },
              }
            }}
            inputProps={{
              inputMode: 'decimal',
              pattern: '[0-9]*',
              style: { fontSize: '1.5rem', textAlign: 'center' }
            }}
          />
        </Box>
        
        {/* Currency Selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Convert
          </Typography>
          
          {/* From Currency */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              From
            </Typography>
            <Select 
              value={fromCurrency} 
              onChange={handleFromCurrencyChange} 
              fullWidth
              sx={{ mt: 0.5 }}
            >
              {currencies.map((currency) => (
                <MenuItem key={currency.code} value={currency.code}>
                  <Box>
                    <Typography variant="body2" fontWeight="600">
                      {currency.code}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {currency.name}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </Box>
          
          {/* Flip Button */}
          <Box sx={{ textAlign: 'center', my: 2 }}>
            <IconButton 
              onClick={handleFlipCurrencies} 
              size="large"
              sx={{ 
                color: theme.palette.primary.main,
                bgcolor: theme.palette.primary.light + '20',
                p: 2,
                '&:hover': {
                  bgcolor: theme.palette.primary.light + '40'
                }
              }}
              title="Flip currencies"
            >
              <SwapIcon fontSize="large" />
            </IconButton>
          </Box>
          
          {/* To Currency */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              To
            </Typography>
            <Select 
              value={toCurrency} 
              onChange={handleToCurrencyChange} 
              fullWidth
              sx={{ mt: 0.5 }}
            >
              {currencies.map((currency) => (
                <MenuItem key={currency.code} value={currency.code}>
                  <Box>
                    <Typography variant="body2" fontWeight="600">
                      {currency.code}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {currency.name}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </Box>
        </Box>
        
        {/* Result Display */}
        {result !== null && amount && (
          <Box 
            sx={{ 
              p: 3, 
              backgroundColor: theme.palette.primary.light + '10',
              borderRadius: 2,
              border: `2px solid ${theme.palette.primary.light}`,
              textAlign: 'center',
              mb: 2
            }}
          >
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Result
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 700, 
                color: theme.palette.primary.main,
                mb: 1
              }}
            >
              {formatCurrency(result, toCurrency)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {amount} {fromCurrency} = {formatCurrency(result, toCurrency)}
            </Typography>
          </Box>
        )}
        
        {/* Error State */}
        {amount && result === null && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography variant="body2" color="error">
              Unable to calculate - please check exchange rates and try again
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );
};

export default ExchangeRatesView;