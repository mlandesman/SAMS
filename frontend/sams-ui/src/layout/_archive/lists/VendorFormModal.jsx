import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress
} from '@mui/material';

const VendorFormModal = ({ open, onClose, onSave, vendor = null }) => {
  const isEditMode = Boolean(vendor);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    status: 'active'
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Initialize form when vendor data changes
  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name || '',
        category: vendor.category || '',
        status: vendor.status || 'active'
      });
    } else {
      // Reset form for new vendor
      setFormData({
        name: '',
        category: '',
        status: 'active'
      });
    }
    setErrors({});
  }, [vendor]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error when field is edited
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  const handleStatusChange = (e) => {
    setFormData(prev => ({
      ...prev,
      status: e.target.checked ? 'active' : 'inactive'
    }));
  };
  
  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Vendor name is required';
    }
    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    try {
      // In real implementation, this would be an API call
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const vendorData = {
        ...formData,
        id: vendor?.id || Date.now().toString()
      };
      
      onSave(vendorData);
      onClose();
    } catch (error) {
      console.error('Error saving vendor:', error);
      // Show error in UI
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={saving ? null : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditMode ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
      <DialogContent>
        <TextField
          margin="normal"
          label="Vendor Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          fullWidth
          required
          error={!!errors.name}
          helperText={errors.name}
          disabled={saving}
        />
        <TextField
          margin="normal"
          label="Category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          fullWidth
          required
          error={!!errors.category}
          helperText={errors.category}
          disabled={saving}
        />
        <FormControlLabel
          control={
            <Switch
              checked={formData.status === 'active'}
              onChange={handleStatusChange}
              disabled={saving}
            />
          }
          label="Active"
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          color="primary" 
          variant="contained"
          disabled={saving}
        >
          {saving ? (
            <>
              <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
              Saving...
            </>
          ) : (
            isEditMode ? 'Update' : 'Save'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VendorFormModal;
