import React, { useState } from 'react';
import {
  Box,
  Modal,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  LinearProgress
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Security as SecurityIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { updatePassword } from 'firebase/auth';
import { getAuthInstance } from '../firebaseClient';
import { userAPI } from '../api/user';

function PasswordChangeModal({ open, user, onPasswordChanged, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password strength validation
  const validatePassword = (pwd) => {
    const checks = {
      length: pwd.length >= 8,
      hasUpper: /[A-Z]/.test(pwd),
      hasLower: /[a-z]/.test(pwd),
      hasNumber: /\d/.test(pwd),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    return { checks, score, isValid: score >= 4 };
  };

  const passwordValidation = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!passwordValidation.isValid) {
      setError('New password does not meet security requirements');
      return;
    }
    
    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Update password in Firebase Auth
      const auth = getAuthInstance();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      await updatePassword(currentUser, newPassword);
      
      // Update user profile to clear mustChangePassword flag
      await userAPI.updateProfile({
        mustChangePassword: false,
        accountState: 'active'
      });

      onPasswordChanged();
      
    } catch (error) {
      console.error('Password change error:', error);
      
      switch (error.code) {
        case 'auth/weak-password':
          setError('Password is too weak. Please choose a stronger password.');
          break;
        case 'auth/requires-recent-login':
          setError('For security reasons, please log out and log in again before changing your password.');
          break;
        default:
          setError('Failed to change password. Please try again or contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  const PasswordStrengthIndicator = () => (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" sx={{ mr: 1 }}>
          Password Strength:
        </Typography>
        <LinearProgress
          variant="determinate"
          value={(passwordValidation.score / 5) * 100}
          sx={{
            flexGrow: 1,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#e0e0e0',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 
                passwordValidation.score < 3 ? '#f44336' :
                passwordValidation.score < 4 ? '#ff9800' : '#4caf50'
            }
          }}
        />
      </Box>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, fontSize: '0.75rem' }}>
        {[
          { key: 'length', label: '8+ characters' },
          { key: 'hasUpper', label: 'Uppercase letter' },
          { key: 'hasLower', label: 'Lowercase letter' },
          { key: 'hasNumber', label: 'Number' },
          { key: 'hasSpecial', label: 'Special character' }
        ].map(({ key, label }) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', color: passwordValidation.checks[key] ? '#4caf50' : '#9e9e9e' }}>
            {passwordValidation.checks[key] ? <CheckIcon sx={{ fontSize: 12, mr: 0.5 }} /> : <CancelIcon sx={{ fontSize: 12, mr: 0.5 }} />}
            <Typography variant="caption">{label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <Modal
      open={open}
      onClose={null} // Prevent closing - user must change password
      aria-labelledby="password-change-modal"
    >
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 500 },
          maxWidth: 500,
          outline: 'none'
        }}
      >
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Box textAlign="center" mb={3}>
              <SecurityIcon sx={{ fontSize: 48, color: '#ff9800', mb: 2 }} />
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#ff9800' }}>
                Password Change Required
              </Typography>
              <Typography color="text.secondary">
                Hi {user?.name || user?.email}! You must change your password before accessing the system.
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Current Password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                margin="normal"
                required
                disabled={loading}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        edge="end"
                      >
                        {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="New Password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                margin="normal"
                required
                disabled={loading}
                error={newPassword.length > 0 && !passwordValidation.isValid}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        edge="end"
                      >
                        {showNewPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              {newPassword.length > 0 && <PasswordStrengthIndicator />}

              <TextField
                fullWidth
                label="Confirm New Password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                margin="normal"
                required
                disabled={loading}
                error={confirmPassword.length > 0 && !passwordsMatch}
                helperText={confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : ''}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ 
                  mt: 3, 
                  py: 1.5,
                  backgroundColor: '#ff9800',
                  '&:hover': {
                    backgroundColor: '#f57c00'
                  }
                }}
                disabled={loading || !passwordValidation.isValid || !passwordsMatch || !currentPassword}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Change Password'
                )}
              </Button>
            </form>

            <Box sx={{ mt: 3, p: 2, backgroundColor: '#fff3e0', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                <strong>Security Notice:</strong><br />
                For your security, you must change the temporary password provided to you before accessing the system.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Modal>
  );
}

export default PasswordChangeModal;