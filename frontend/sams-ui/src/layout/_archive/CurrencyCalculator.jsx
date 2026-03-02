import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { SwapHoriz as SwapIcon } from '@mui/icons-material';

/**
 * Currency conversion calculator component
 * Supports USD, CAD, COP, EUR, MXN conversions
 */
const CurrencyCalculator = ({ rates, loading = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [amount, setAmount] = useState('');
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
  const convertCurrency = useCallback((amount, fromCurrency, toCurrency, rates) => {
    if (!amount || !rates?.rates) return null;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return null;
    
    if (fromCurrency === toCurrency) {
      return numAmount;
    }
    
    // All rates are stored as [Currency] to MXN
    // For any conversion, convert through MXN as base
    let mxnAmount;
    
    // Convert from source currency to MXN
    if (fromCurrency === 'MXN') {
      mxnAmount = numAmount;
    } else {
      const fromRate = rates.rates[fromCurrency];
      if (!fromRate || fromRate === 0) return null;
      mxnAmount = numAmount * fromRate;
    }
    
    // Convert from MXN to target currency
    if (toCurrency === 'MXN') {
      return mxnAmount;
    } else {
      const toRate = rates.rates[toCurrency];
      if (!toRate || toRate === 0) return null;
      return mxnAmount / toRate;
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

  if (loading) {
    return (
      <Box sx={{ mt: 2, p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Loading calculator...
        </Typography>
      </Box>
    );
  }

  if (!rates?.rates) {
    return (
      <Box sx={{ mt: 2, p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Calculator unavailable - no exchange rates
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Divider sx={{ mb: 2 }} />
      
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
        Currency Calculator
      </Typography>
      
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: 1, 
          mb: 2 
        }}
      >
        {/* Amount Input */}
        <TextField
          size="small"
          type="text"
          value={amount}
          onChange={handleAmountChange}
          placeholder="Enter amount"
          sx={{ 
            flex: isMobile ? 1 : 2,
            '& .MuiOutlinedInput-root': {
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
            pattern: '[0-9]*'
          }}
        />
        
        {/* From Currency */}
        <Select 
          value={fromCurrency} 
          onChange={handleFromCurrencyChange} 
          size="small"
          sx={{ 
            minWidth: isMobile ? '100%' : 80,
            flex: isMobile ? 1 : 0
          }}
        >
          {currencies.map((currency) => (
            <MenuItem key={currency.code} value={currency.code}>
              {currency.code}
            </MenuItem>
          ))}
        </Select>
        
        {/* Flip Button */}
        <IconButton 
          onClick={handleFlipCurrencies} 
          size="small"
          sx={{ 
            color: theme.palette.primary.main,
            '&:hover': {
              backgroundColor: theme.palette.primary.light + '20'
            }
          }}
          title="Flip currencies"
        >
          <SwapIcon />
        </IconButton>
        
        {/* To Currency */}
        <Select 
          value={toCurrency} 
          onChange={handleToCurrencyChange} 
          size="small"
          sx={{ 
            minWidth: isMobile ? '100%' : 80,
            flex: isMobile ? 1 : 0
          }}
        >
          {currencies.map((currency) => (
            <MenuItem key={currency.code} value={currency.code}>
              {currency.code}
            </MenuItem>
          ))}
        </Select>
      </Box>
      
      {/* Result Display */}
      {result !== null && amount && (
        <Box 
          sx={{ 
            p: 2, 
            backgroundColor: theme.palette.primary.light + '10',
            borderRadius: 1,
            border: `1px solid ${theme.palette.primary.light}30`
          }}
        >
          <Typography 
            variant="body1" 
            sx={{ 
              fontWeight: 600, 
              color: theme.palette.primary.main,
              textAlign: 'center'
            }}
          >
            = {formatCurrency(result, toCurrency)}
          </Typography>
        </Box>
      )}
      
      {/* Error State */}
      {amount && result === null && (
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Unable to calculate - check exchange rates
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default CurrencyCalculator;