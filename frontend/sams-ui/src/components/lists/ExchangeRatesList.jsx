import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  Card, 
  CardContent, 
  CardActions,
  Grid,
  Chip,
  CircularProgress,
  Divider
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  Assessment as AssessmentIcon,
  Build as BuildIcon,
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { triggerManualExchangeRatesUpdate, checkTodaysExchangeRates } from '../../api/exchangeRates';

function ExchangeRatesList({ onEdit }) {
  const [updateStatus, setUpdateStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [exchangeRateInfo, setExchangeRateInfo] = useState(null);
  const [checkingRates, setCheckingRates] = useState(false);

  // Check today's exchange rates
  const handleCheckRates = async () => {
    setCheckingRates(true);
    setUpdateStatus('');
    try {
      const result = await checkTodaysExchangeRates();
      setExchangeRateInfo(result);
      setUpdateStatus(`✅ Exchange rates check completed. Rates exist: ${result.exists}`);
    } catch (error) {
      setUpdateStatus(`❌ Failed to check exchange rates: ${error.message}`);
    } finally {
      setCheckingRates(false);
    }
  };

  // Manual exchange rate update handlers
  const handleQuickUpdate = async () => {
    setIsUpdating(true);
    setUpdateStatus('🔄 Running quick update (fill gaps only)...');
    
    try {
      const result = await triggerManualExchangeRatesUpdate({ 
        mode: 'quick' 
      });
      
      if (result.success) {
        setUpdateStatus('✅ Quick update completed successfully!');
        // Refresh the check
        setTimeout(() => handleCheckRates(), 1000);
      } else {
        setUpdateStatus(`⚠️ Quick update completed with issues: ${result.error}`);
      }
    } catch (error) {
      setUpdateStatus(`❌ Quick update failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFillGaps = async () => {
    setIsUpdating(true);
    setUpdateStatus('🔄 Running gap filling for recent dates...');
    
    try {
      const result = await triggerManualExchangeRatesUpdate({ 
        mode: 'fill-gaps',
        startDate: '2025-05-01', // Last month
        endDate: new Date().toISOString().split('T')[0] // Today
      });
      
      if (result.success) {
        setUpdateStatus('✅ Gap filling completed successfully!');
        setTimeout(() => handleCheckRates(), 1000);
      } else {
        setUpdateStatus(`⚠️ Gap filling completed with issues: ${result.error}`);
      }
    } catch (error) {
      setUpdateStatus(`❌ Gap filling failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkReplace = async () => {
    if (!window.confirm('⚠️ This will delete ALL existing exchange rates and rebuild from 2020+. This may take several minutes. Continue?')) {
      return;
    }
    
    setIsUpdating(true);
    setUpdateStatus('🔄 Running full bulk replacement (this may take several minutes)...');
    
    try {
      const result = await triggerManualExchangeRatesUpdate({ 
        mode: 'bulk' 
      });
      
      if (result.success) {
        setUpdateStatus('✅ Bulk replacement completed successfully!');
        setTimeout(() => handleCheckRates(), 1000);
      } else {
        setUpdateStatus(`⚠️ Bulk replacement completed with issues: ${result.error}`);
      }
    } catch (error) {
      setUpdateStatus(`❌ Bulk replacement failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDryRun = async () => {
    setIsUpdating(true);
    setUpdateStatus('🧪 Running dry-run test...');
    
    try {
      const result = await triggerManualExchangeRatesUpdate({ 
        mode: 'fill-gaps',
        dryRun: true 
      });
      
      if (result.success) {
        setUpdateStatus('✅ Dry-run completed - no changes made');
      } else {
        setUpdateStatus(`⚠️ Dry-run completed with issues: ${result.error}`);
      }
    } catch (error) {
      setUpdateStatus(`❌ Dry-run failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          📈 Exchange Rates Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Exchange rates are automatically updated daily when users log in. 
          Use the tools below for manual management or testing.
        </Typography>
      </Box>

      {/* Status Display */}
      {updateStatus && (
        <Alert 
          severity={
            updateStatus.startsWith('✅') ? 'success' : 
            updateStatus.startsWith('⚠️') ? 'warning' : 
            updateStatus.startsWith('❌') ? 'error' : 'info'
          }
          sx={{ mb: 2 }}
        >
          {updateStatus}
        </Alert>
      )}

      {/* Current Exchange Rate Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <InfoIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Current Status</Typography>
            <Box sx={{ ml: 'auto' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={checkingRates ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={handleCheckRates}
                disabled={checkingRates}
              >
                {checkingRates ? 'Checking...' : 'Check Now'}
              </Button>
            </Box>
          </Box>

          {exchangeRateInfo ? (
            <>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    <strong>Date:</strong> {exchangeRateInfo.date}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Status:</strong>{' '}
                    <Chip 
                      label={exchangeRateInfo.exists ? 'Available' : 'Missing'} 
                      color={exchangeRateInfo.exists ? 'success' : 'error'}
                      size="small"
                    />
                  </Typography>
                </Grid>
                {exchangeRateInfo.data && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Last Updated:</strong>{' '}
                      {new Date(exchangeRateInfo.data.lastUpdated).toLocaleString()}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Source:</strong> {exchangeRateInfo.data.source || 'N/A'}
                    </Typography>
                  </Grid>
                )}
              </Grid>

              {exchangeRateInfo.data && exchangeRateInfo.data.rates && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Available Currencies:</strong>
                  </Typography>
                  <Grid container spacing={1}>
                    {Object.entries(exchangeRateInfo.data.rates).map(([currency, data]) => (
                      <Grid item key={currency}>
                        <Chip
                          label={`${currency}: ${data.rate?.toFixed(6) || 'N/A'}`}
                          variant="outlined"
                          size="small"
                        />
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Click "Check Now" to view current exchange rate status
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Action Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PlayArrowIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Quick Update</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Fill gaps from last known date to today. Safe and fast.
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleQuickUpdate}
                disabled={isUpdating}
                startIcon={isUpdating ? <CircularProgress size={16} /> : <PlayArrowIcon />}
              >
                {isUpdating ? 'Updating...' : 'Quick Update'}
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AssessmentIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">Fill Recent Gaps</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Fill any missing dates in the last month. Good for recent issues.
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                variant="contained"
                color="warning"
                fullWidth
                onClick={handleFillGaps}
                disabled={isUpdating}
                startIcon={isUpdating ? <CircularProgress size={16} /> : <AssessmentIcon />}
              >
                {isUpdating ? 'Filling...' : 'Fill Gaps'}
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <BuildIcon color="secondary" sx={{ mr: 1 }} />
                <Typography variant="h6">Dry Run Test</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Test what would be updated without making any changes.
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                onClick={handleDryRun}
                disabled={isUpdating}
                startIcon={isUpdating ? <CircularProgress size={16} /> : <BuildIcon />}
              >
                {isUpdating ? 'Testing...' : 'Dry Run'}
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DeleteIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="h6">Full Bulk Replace</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                ⚠️ Delete all data and rebuild from 2020+. Takes several minutes.
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                variant="contained"
                color="error"
                fullWidth
                onClick={handleBulkReplace}
                disabled={isUpdating}
                startIcon={isUpdating ? <CircularProgress size={16} /> : <DeleteIcon />}
              >
                {isUpdating ? 'Replacing...' : 'Bulk Replace'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      {/* Help Section */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            💡 Tool Guide
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>Quick Update:</strong> Recommended for daily use. Finds and fills missing dates automatically.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Fill Recent Gaps:</strong> Good for fixing recent issues or after system downtime.
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>Dry Run Test:</strong> Safe way to see what would be updated before making changes.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Bulk Replace:</strong> Nuclear option - only use for complete rebuild or corruption recovery.
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ExchangeRatesList;
