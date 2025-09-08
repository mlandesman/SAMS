import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
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
import { confirmPasswordReset, signInWithEmailAndPassword } from 'firebase/auth';
import { getAuthInstance } from '../firebaseClient';

function PasswordSetupView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // URL parameters
  const oobCode = searchParams.get('oobCode');
  const mode = searchParams.get('mode');
  
  useEffect(() => {
    // Validate that we have the required parameters
    if (!oobCode || mode !== 'resetPassword') {
      setError('Invalid or expired setup link. Please request a new invitation.');
    }
  }, [oobCode, mode]);

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

  const passwordValidation = validatePassword(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!passwordValidation.isValid) {
      setError('Password does not meet security requirements');
      return;
    }
    
    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Use Firebase's confirmPasswordReset to set the new password
      const auth = getAuthInstance();
      await confirmPasswordReset(auth, oobCode, password);
      
      // Password was set successfully - update user profile to clear mustChangePassword
      try {
        // Call backend to update user profile after successful password setup
        const response = await fetch('/api/user/complete-password-setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ oobCode })
        });
        
        if (response.ok) {
          console.log('✅ User profile updated after password setup');
        } else {
          console.warn('Could not update user profile, but password was set');
        }
      } catch (profileError) {
        console.warn('Could not update user profile, but password was set:', profileError);
      }
      
      setSuccess(true);
      
      // Show success message and redirect after delay
      setTimeout(() => {
        // Redirect to main app with success message
        window.location.href = '/?passwordSetup=success';
      }, 4000);
      
    } catch (error) {
      console.error('Password setup error:', error);
      
      // Handle specific Firebase error codes
      switch (error.code) {
        case 'auth/expired-action-code':
          setError('This setup link has expired (links expire after 1 hour). Please contact your administrator for a new invitation.');
          break;
        case 'auth/invalid-action-code':
          setError('This setup link is invalid or has already been used. Password reset links can only be used once. Please contact your administrator if you need help.');
          break;
        case 'auth/weak-password':
          setError('Password is too weak. Please choose a stronger password with at least 8 characters.');
          break;
        case 'auth/user-disabled':
          setError('This user account has been disabled. Please contact your administrator.');
          break;
        default:
          setError(`Failed to set password: ${error.message}. Please try again or contact support.`);
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

  if (!oobCode || mode !== 'resetPassword') {
    return (
      <div style={{ padding: '2rem', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Card sx={{ maxWidth: 500, mx: 'auto', mt: 8 }}>
          <CardContent sx={{ p: 4 }}>
            <Box textAlign="center" mb={3}>
              <SecurityIcon sx={{ fontSize: 48, color: '#f44336', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Invalid Setup Link
              </Typography>
              <Typography color="text.secondary">
                This password setup link is invalid or has expired.
              </Typography>
            </Box>
            
            <Alert severity="error" sx={{ mb: 3 }}>
              <strong>Link Issue:</strong> This setup link is invalid, expired, or has already been used.
              <br/><br/>
              <strong>What to do:</strong> Password reset links expire after 1 hour and can only be used once. 
              Please contact your administrator to request a new invitation link.
            </Alert>
            
            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigate('/login')}
            >
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ padding: '2rem', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Card sx={{ maxWidth: 500, mx: 'auto', mt: 8 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <CheckIcon sx={{ fontSize: 64, color: '#4caf50', mb: 2 }} />
            <Typography variant="h5" gutterBottom color="success.main">
              🎉 Password Set Successfully!
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Your password has been set and your account is now active.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              You can now log into SAMS with your email and new password.<br/>
              Redirecting you to the login page...
            </Typography>
            <CircularProgress size={24} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Card sx={{ maxWidth: 500, mx: 'auto', mt: 8 }}>
        <CardContent sx={{ p: 4 }}>
          <Box textAlign="center" mb={4}>
            <SecurityIcon sx={{ fontSize: 48, color: '#0863bf', mb: 2 }} />
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: '#0863bf' }}>
              Set Your Password
            </Typography>
            <Typography color="text.secondary">
              Welcome to Sandyland Asset Management! Please create a secure password for your account.
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
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              error={password.length > 0 && !passwordValidation.isValid}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            
            {password.length > 0 && <PasswordStrengthIndicator />}

            <TextField
              fullWidth
              label="Confirm Password"
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
                mb: 2, 
                py: 1.5,
                backgroundColor: '#0863bf',
                '&:hover': {
                  backgroundColor: '#0652a0'
                }
              }}
              disabled={loading || !passwordValidation.isValid || !passwordsMatch}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Set Password & Activate Account'
              )}
            </Button>
          </form>

          <Box sx={{ mt: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Security Tips:</strong><br />
              • Use a unique password you don't use elsewhere<br />
              • Consider using a password manager<br />
              • Never share your password with anyone
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </div>
  );
}

export default PasswordSetupView;