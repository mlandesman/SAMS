import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Divider,
} from '@mui/material';
import {
  CheckCircle,
  Add,
  Home,
  Share,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { databaseFieldMappings } from '../../utils/databaseFieldMappings';

const Confirmation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { transaction, clientId } = location.state || {};

  // Redirect if no transaction data
  if (!transaction) {
    navigate('/clients');
    return null;
  }

  const handleAddAnother = () => {
    navigate(`/expense/${clientId}`);
  };

  const handleDone = () => {
    navigate('/clients');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Expense Added Successfully',
          text: `Expense created successfully!\n\nTransaction ID: ${transaction.id}\nAmount: ${formatCurrency(transaction.amount)}\nCategory: ${transaction.category}\nVendor: ${transaction.vendor}`,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      const text = `Expense created successfully!\n\nTransaction ID: ${transaction.id}\nAmount: $${transaction.amount}\nCategory: ${transaction.category}\nVendor: ${transaction.vendor}`;
      
      try {
        await navigator.clipboard.writeText(text);
        alert('Transaction details copied to clipboard!');
      } catch (error) {
        console.log('Could not copy to clipboard:', error);
      }
    }
  };

  const formatCurrency = (amount) => {
    // Use utility for consistent formatting
    return databaseFieldMappings.formatCurrency(
      databaseFieldMappings.dollarsToCents(amount),
      'USD'
    );
  };

  const formatDate = (dateString) => {
    // Use utility for consistent date formatting
    return databaseFieldMappings.formatTimestampWithTime(dateString);
  };

  return (
    <Box className="confirmation-container">
      {/* Success Icon */}
      <CheckCircle 
        className="confirmation-icon"
        sx={{ 
          fontSize: 80, 
          color: '#4caf50',
          mb: 2,
        }} 
      />

      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
        Expense Created Successfully!
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 300 }}>
        Your expense has been added to the system and is now available in the asset management portal.
      </Typography>

      {/* Transaction ID */}
      <Card sx={{ mb: 3, width: '100%', maxWidth: 400 }}>
        <CardContent sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Transaction ID
          </Typography>
          <Typography 
            variant="h6" 
            className="transaction-id"
            sx={{ 
              fontFamily: 'monospace',
              backgroundColor: '#e3f2fd',
              padding: '8px 12px',
              borderRadius: 1,
              color: '#1976d2',
              fontWeight: 'bold',
            }}
          >
            {transaction.id}
          </Typography>
        </CardContent>
      </Card>

      {/* Transaction Summary */}
      <Card sx={{ mb: 4, width: '100%', maxWidth: 400 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Expense Details
          </Typography>

          <Box className="transaction-summary">
            <Box className="summary-row">
              <Typography className="summary-label">Date:</Typography>
              <Typography className="summary-value">
                {formatDate(transaction.date)}
              </Typography>
            </Box>

            <Box className="summary-row">
              <Typography className="summary-label">Amount:</Typography>
              <Typography className="summary-value" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                {formatCurrency(transaction.amount)}
              </Typography>
            </Box>

            <Box className="summary-row">
              <Typography className="summary-label">Category:</Typography>
              <Typography className="summary-value">
                {transaction.category}
              </Typography>
            </Box>

            <Box className="summary-row">
              <Typography className="summary-label">Vendor:</Typography>
              <Typography className="summary-value">
                {transaction.vendor}
              </Typography>
            </Box>

            <Box className="summary-row">
              <Typography className="summary-label">Account:</Typography>
              <Typography className="summary-value">
                {transaction.account}
              </Typography>
            </Box>

            <Box className="summary-row">
              <Typography className="summary-label">Payment:</Typography>
              <Typography className="summary-value">
                {transaction.paymentMethod}
              </Typography>
            </Box>

            {transaction.notes && (
              <>
                <Divider sx={{ my: 1 }} />
                <Box>
                  <Typography className="summary-label" gutterBottom>
                    Notes:
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    {transaction.notes}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Status Chip */}
      <Chip 
        label="Successfully Added" 
        color="success" 
        sx={{ mb: 4, fontSize: '14px', fontWeight: 500 }}
      />

      {/* Action Buttons */}
      <Box className="action-buttons" sx={{ width: '100%', maxWidth: 400 }}>
        <Button
          variant="contained"
          onClick={handleAddAnother}
          startIcon={<Add />}
          sx={{ flex: 1 }}
        >
          Add Another
        </Button>
        
        <Button
          variant="outlined"
          onClick={handleDone}
          startIcon={<Home />}
          sx={{ flex: 1 }}
        >
          Done
        </Button>
      </Box>

      {/* Share Button */}
      <Button
        variant="text"
        onClick={handleShare}
        startIcon={<Share />}
        sx={{ mt: 2, color: 'text.secondary' }}
      >
        Share Details
      </Button>

      {/* Help Text */}
      <Typography 
        variant="caption" 
        color="text.secondary" 
        sx={{ 
          mt: 3, 
          textAlign: 'center',
          maxWidth: 350,
          lineHeight: 1.4,
        }}
      >
        This expense is now available in the main asset management application and will be included in all reports and balance calculations.
      </Typography>
    </Box>
  );
};

export default Confirmation;
