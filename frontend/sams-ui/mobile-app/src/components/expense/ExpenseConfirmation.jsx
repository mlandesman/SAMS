import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Divider,
  Chip,
  Grid,
} from '@mui/material';
import {
  CheckCircle,
  Add,
  Home,
  AttachMoney,
  CalendarToday,
  Category,
  Store,
  Notes,
} from '@mui/icons-material';

const ExpenseConfirmation = ({ result, clientId, onAddAnother, onDone }) => {
  console.log('🎉 ExpenseConfirmation received result:', result);
  console.log('🎉 ExpenseConfirmation received clientId:', clientId);
  
  const { transaction } = result || {};
  
  // Helper functions
  const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(numAmount);
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatPaymentMethod = (method) => {
    if (!method) return 'Not specified';
    return method.charAt(0).toUpperCase() + method.slice(1);
  };

  // Safety check - if no transaction data, show generic success
  if (!transaction) {
    console.warn('⚠️ No transaction data in result, showing generic success');
    return (
      <Box className="expense-confirmation" p={3}>
        <Box textAlign="center" mb={4}>
          <CheckCircle 
            sx={{ 
              fontSize: 64, 
              color: 'success.main',
              mb: 2,
            }} 
          />
          <Typography variant="h5" component="h1" gutterBottom>
            Expense Submitted!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your expense has been successfully recorded.
          </Typography>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<Add />}
              onClick={onAddAnother}
              sx={{
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                },
                mb: 2,
              }}
            >
              Add Another Expense
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="outlined"
              fullWidth
              size="large"
              startIcon={<Home />}
              onClick={onDone}
              color="success"
            >
              Done
            </Button>
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box className="expense-confirmation" p={3}>
      {/* Success Header */}
      <Box textAlign="center" mb={4}>
        <CheckCircle 
          sx={{ 
            fontSize: 64, 
            color: 'success.main',
            mb: 2,
          }} 
        />
        <Typography variant="h5" component="h1" gutterBottom>
          Expense Submitted!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Your expense has been successfully recorded.
        </Typography>
      </Box>

      {/* Transaction Details */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Transaction Details
          </Typography>
          
          <Grid container spacing={2}>
            {/* Amount */}
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" mb={2}>
                <AttachMoney color="primary" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {parseFloat(transaction.amount || 0).toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Date */}
            <Grid item xs={6}>
              <Box display="flex" alignItems="center">
                <CalendarToday color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Date
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(transaction.date || new Date())}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Category */}
            <Grid item xs={6}>
              <Box display="flex" alignItems="center">
                <Category color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Category
                  </Typography>
                  <Chip 
                    label={transaction.category || 'General'} 
                    size="small" 
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              </Box>
            </Grid>

            {/* Vendor */}
            <Grid item xs={6}>
              <Box display="flex" alignItems="center">
                <Store color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Vendor
                  </Typography>
                  <Typography variant="body1">
                    {transaction.vendor || 'Not specified'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Payment Method */}
            <Grid item xs={6}>
              <Box display="flex" alignItems="center">
                <AttachMoney color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Payment Method
                  </Typography>
                  <Typography variant="body1">
                    {formatPaymentMethod(transaction.paymentMethod)}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Account */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Account
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {transaction.account || 'Not specified'}
                </Typography>
              </Box>
            </Grid>

            {/* Description */}
            {transaction.description && (
              <Grid item xs={12}>
                <Box display="flex" alignItems="flex-start">
                  <Notes color="action" sx={{ mr: 1, mt: 0.5 }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body1">
                      {transaction.description}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            {/* Transaction ID for debugging */}
            {transaction.id && (
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Transaction ID
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {transaction.id}
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<Add />}
            onClick={onAddAnother}
            sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
              },
              mb: 2,
            }}
          >
            Add Another Expense
          </Button>
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="outlined"
            fullWidth
            size="large"
            startIcon={<Home />}
            onClick={onDone}
            color="success"
          >
            Done
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ExpenseConfirmation;
