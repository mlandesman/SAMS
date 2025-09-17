import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Notifications as NotificationsIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { getVersionInfo } from '../utils/versionUtils';

const UserProfileManager = ({ open, onClose }) => {
  const { samsUser, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const versionInfo = getVersionInfo();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: samsUser?.basicInfo?.fullName || samsUser?.fullName || samsUser?.name || '',
    phone: samsUser?.basicInfo?.phone || samsUser?.phone || '',
    notifications: {
      email: samsUser?.notifications?.email || true,
      sms: samsUser?.notifications?.sms || false,
      duesReminders: samsUser?.notifications?.duesReminders || true,
    }
  });

  // Email form state
  const [emailForm, setEmailForm] = useState({
    newEmail: firebaseUser?.email || samsUser?.email || '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // Update forms when user data changes or dialog opens
  useEffect(() => {
    if (open && samsUser) {
      setProfileForm({
        name: samsUser?.basicInfo?.fullName || samsUser?.fullName || samsUser?.name || '',
        phone: samsUser?.basicInfo?.phone || samsUser?.phone || '',
        notifications: {
          email: samsUser?.notifications?.email ?? true,
          sms: samsUser?.notifications?.sms ?? false,
          duesReminders: samsUser?.notifications?.duesReminders ?? true,
        }
      });
      setEmailForm({
        newEmail: firebaseUser?.email || samsUser?.email || '',
      });
    }
  }, [open, samsUser, firebaseUser]);

  const updateProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          basicInfo: {
            fullName: profileForm.name,
            phone: profileForm.phone
          },
          notifications: profileForm.notifications
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAbout = () => {
    onClose(); // Close the profile modal
    navigate('/about'); // Navigate to About screen
  };

  const updateEmail = async () => {
    try {
      setLoading(true);
      setError('');
      
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/user/email`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(emailForm)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update email');
      }

      setSuccess('Email updated successfully! Please verify your new email.');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    try {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (passwordForm.newPassword.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      setLoading(true);
      setError('');
      
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/user/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: passwordForm.newPassword })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update password');
      }

      setSuccess('Password updated successfully!');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <PersonIcon sx={{ mr: 1 }} />
          Manage Profile
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Personal Information */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Personal Information
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Full Name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </Grid>
            </Grid>
            
            <Button
              variant="contained"
              onClick={updateProfile}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              Update Profile
            </Button>
          </CardContent>
        </Card>

        {/* Email Address */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <EmailIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Email Address</Typography>
            </Box>
            
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={emailForm.newEmail}
              onChange={(e) => setEmailForm(prev => ({ ...prev, newEmail: e.target.value }))}
              sx={{ mb: 2 }}
            />
            
            <Button
              variant="contained"
              onClick={updateEmail}
              disabled={loading}
            >
              Update Email
            </Button>
          </CardContent>
        </Card>

        {/* Password */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <LockIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Password</Typography>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="New Password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Confirm Password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </Grid>
            </Grid>
            
            <Button
              variant="contained"
              onClick={updatePassword}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              Update Password
            </Button>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <NotificationsIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Notification Preferences</Typography>
            </Box>
            
            <FormControlLabel
              control={
                <Switch
                  checked={profileForm.notifications.email}
                  onChange={(e) => setProfileForm(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, email: e.target.checked }
                  }))}
                />
              }
              label="Email Notifications"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={profileForm.notifications.sms}
                  onChange={(e) => setProfileForm(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, sms: e.target.checked }
                  }))}
                />
              }
              label="SMS Notifications"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={profileForm.notifications.duesReminders}
                  onChange={(e) => setProfileForm(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, duesReminders: e.target.checked }
                  }))}
                />
              }
              label="HOA Dues Reminders"
            />
            
            <Button
              variant="contained"
              onClick={updateProfile}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              Update Preferences
            </Button>
          </CardContent>
        </Card>

        {/* About Application */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <InfoIcon sx={{ mr: 1 }} />
              <Typography variant="h6">About Application</Typography>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {versionInfo.appName}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Version: {versionInfo.versionDisplay} ({versionInfo.displayEnvironment})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Build: {versionInfo.buildDateFormatted}
              </Typography>
            </Box>
            
            <Button
              variant="outlined"
              onClick={handleAbout}
              startIcon={<InfoIcon />}
              fullWidth
            >
              View App Information
            </Button>
          </CardContent>
        </Card>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserProfileManager;
