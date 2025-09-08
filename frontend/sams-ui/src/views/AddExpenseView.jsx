import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  MenuItem,
  Grid,
  IconButton,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  PhotoCamera,
  AttachFile,
  Delete,
  CheckCircle
} from '@mui/icons-material';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { createTransaction } from '../api/transaction';
import './AddExpenseView.css';

const AddExpenseView = () => {
  const { selectedClient } = useClient();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    receipt: null,
    notes: ''
  });
  
  const categories = [
    'Maintenance',
    'Utilities',
    'Supplies',
    'Services',
    'Insurance',
    'Legal',
    'Other'
  ];
  
  const handleChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value
    });
    setError('');
    setSuccess(false);
  };
  
  const handleFileCapture = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFormData({
        ...formData,
        receipt: file
      });
    }
  };
  
  const handleRemoveReceipt = () => {
    setFormData({
      ...formData,
      receipt: null
    });
  };
  
  const handleSubmit = async () => {
    if (!formData.description || !formData.amount || !formData.category) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Create transaction data
      const transactionData = {
        clientId: selectedClient.id,
        description: formData.description,
        amount: -Math.abs(parseFloat(formData.amount)), // Expenses are negative
        date: formData.date,
        category: formData.category,
        type: 'expense',
        notes: formData.notes,
        createdBy: currentUser.email
      };
      
      // Submit transaction
      await createTransaction(selectedClient.id, transactionData);
      
      // TODO: Upload receipt if provided
      
      setSuccess(true);
      setFormData({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: '',
        receipt: null,
        notes: ''
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to add expense. Please try again.');
      console.error('Error adding expense:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Box className="add-expense-container">
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        Add Expense
      </Typography>
      
      {success && (
        <Alert 
          severity="success" 
          icon={<CheckCircle />}
          sx={{ mb: 2 }}
        >
          Expense added successfully!
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={handleChange('description')}
                required
                placeholder="e.g., Pool maintenance"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount (MXN)"
                value={formData.amount}
                onChange={handleChange('amount')}
                type="number"
                required
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date"
                value={formData.date}
                onChange={handleChange('date')}
                type="date"
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Category"
                value={formData.category}
                onChange={handleChange('category')}
                required
              >
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (optional)"
                value={formData.notes}
                onChange={handleChange('notes')}
                multiline
                rows={2}
                placeholder="Additional details..."
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="body2" gutterBottom sx={{ mb: 1 }}>
                Receipt / Invoice
              </Typography>
              
              {!formData.receipt ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<PhotoCamera />}
                    fullWidth
                  >
                    Capture Photo
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileCapture}
                    />
                  </Button>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<AttachFile />}
                    fullWidth
                  >
                    Choose File
                    <input
                      type="file"
                      hidden
                      accept="image/*,application/pdf"
                      onChange={handleFileCapture}
                    />
                  </Button>
                </Box>
              ) : (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                    {formData.receipt.name}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={handleRemoveReceipt}
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </Paper>
              )}
            </Grid>
            
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleSubmit}
                disabled={loading}
                sx={{ py: 1.5 }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Add Expense'
                )}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      <Typography 
        variant="body2" 
        color="text.secondary" 
        sx={{ mt: 2, textAlign: 'center' }}
      >
        All expenses will be recorded for {selectedClient?.name || 'the selected client'}
      </Typography>
    </Box>
  );
};

export default AddExpenseView;