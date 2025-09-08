import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Button,
  useTheme,
} from '@mui/material';
import { 
  SwapHoriz as SwapIcon,
  Close as CloseIcon,
  Calculate as CalculateIcon
} from '@mui/icons-material';

/**
 * Currency conversion calculator modal component for PWA
 * Supports USD, CAD, COP, EUR, MXN conversions
 */
const CurrencyCalculatorModal = ({ open, onClose, rates, loading = false }) => {
  const theme = useTheme();
  
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

  /**
   * Handle quick conversion buttons
   */
  const handleQuickAmount = useCallback((value) => {
    setAmount(value.toString());
  }, []);

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Loading calculator...
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (!rates?.rates) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Calculator unavailable - no exchange rates
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      fullScreen
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1,
        bgcolor: theme.palette.primary.main,
        color: 'white'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalculateIcon />
          <Typography variant="h6">Currency Calculator</Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pb: 1, px: 2 }}>
        {/* Quick Amount Buttons */}
        <Box sx={{ mb: 3, mt: 2 }}>
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

        {/* Exchange Rate Info */}
        {rates && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Exchange rates last updated: {rates.lastUpdated || 'Never'}
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button 
          onClick={onClose} 
          variant="contained" 
          fullWidth
          size="large"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CurrencyCalculatorModal;