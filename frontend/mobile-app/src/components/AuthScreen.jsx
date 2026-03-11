import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { LoadingSpinner } from './common';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { passkeyService } from '../services/passkeyService';

const AuthScreen = () => {
  const navigate = useNavigate();
  const { user, login, loginWithPasskey, loading, error, clearError } = useAuth();
  const supportsPasskeys = passkeyService.supportsPasskeys();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(!supportsPasskeys);
  const [formError, setFormError] = useState('');
  const [hasLoginFailed, setHasLoginFailed] = useState(false);

  // Redirect if already authenticated - STABLE VERSION
  useEffect(() => {
    console.log('🔍 AUTH SCREEN: Checking redirect conditions:', {
      user: user ? 'Present' : 'None',
      id: user?.id || 'Missing',
      uid: user?.uid || 'Missing',
      globalRole: user?.globalRole || 'Missing', 
      loading: loading
    });
    
    // Only redirect if we have a complete user profile and we're not loading
    // Check for either 'id' or 'uid' since backend returns 'id'
    if (user && (user.id || user.uid) && user.globalRole && !loading) {
      // Maintenance users should go to /tareas, others to /dashboard
      const redirectPath = user.globalRole === 'maintenance' ? '/tareas' : '/dashboard';
      console.log(`✅ STABLE AUTH: User fully authenticated, redirecting to ${redirectPath}:`, {
        globalRole: user.globalRole,
        redirectPath
      });
      navigate(redirectPath);
    } else if (user && !loading) {
      console.log('⚠️ STABLE AUTH: User exists but missing required properties for redirect:', user);
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Clear errors when component mounts
    clearError();
  }, [clearError]);

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
    
    // Clear errors when user starts typing
    if (error) clearError();
    if (formError) setFormError('');
  };

  const validateForm = (requirePassword = true) => {
    if (!formData.email) {
      setFormError('Email is required');
      return false;
    }
    if (!formData.email.includes('@')) {
      setFormError('Please enter a valid email address');
      return false;
    }
    if (requirePassword && !formData.password) {
      setFormError('Password is required');
      return false;
    }
    return true;
  };

  const handlePasskeyLogin = async (event) => {
    event.preventDefault();
    if (!formData.email || !formData.email.includes('@')) {
      setFormError('Please enter a valid email address');
      return;
    }
    clearError();
    setFormError('');
    try {
      await loginWithPasskey(formData.email.trim());
      setHasLoginFailed(false);
    } catch (err) {
      let msg = err.message || 'Passkey sign-in failed.';
      if (err.name === 'NotAllowedError' || msg.toLowerCase().includes('cancel')) {
        msg = 'Authentication cancelled. Try again or use password.';
      } else if (msg.includes('User not found') || msg.includes('404') || msg.includes('Credential not found')) {
        msg = 'No passkey found for this email. Sign in with password to register one.';
      }
      setFormError(msg);
      setHasLoginFailed(true);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm(showPasswordField)) return;
    try {
      await login(formData.email, formData.password);
      setHasLoginFailed(false);
    } catch (error) {
      setHasLoginFailed(true);
      console.error('Login failed:', error);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  if (user) {
    return null; // Will redirect via useEffect
  }

  return (
    <Box 
      className="auth-container"
      sx={{
        background: 'linear-gradient(180deg, rgba(8, 99, 191, 1) 0%, rgba(131, 196, 242, 1) 72%, rgba(247, 228, 194, 1) 100%)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start', // Changed from 'center' to 'flex-start'
        padding: 2,
        paddingTop: 0, // Remove top padding to start at very top
      }}
    >
      {/* App Logo/Icon - Moved to very top of window */}
      <Box
        className="auth-logo"
        sx={{
          width: 480,
          height: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          m: 0,
          p: 0,
          lineHeight: 0,
          mb: '20px', // Dramatically reduced space below logo
          mt: '20px', // Small top margin to not touch absolute edge
        }}
      >
        <img 
          src="/sandyland-logo.png" 
          alt="Sandyland Property Management" 
          style={{
            width: '450px',
            height: 'auto',
            objectFit: 'contain',
            margin: 0,
            padding: 0,
            display: 'block',
            lineHeight: 0
          }}
        />
      </Box>

      <Typography 
        variant="h5" 
        className="auth-title" 
        sx={{ 
          color: 'white', 
          fontWeight: 'bold', 
          textAlign: 'center', 
          m: 0, // No margin
          p: 0, // No padding
          lineHeight: 1.2 // Tight line height
        }}
      >
        Property Management System
      </Typography>
      
      <Typography 
        variant="body2" 
        className="auth-subtitle" 
        sx={{ 
          color: 'rgba(255, 255, 255, 0.9)', 
          textAlign: 'center', 
          mt: 0.5, // Tiny margin just to separate from title
          mb: 4, // Increased space before form to center it better
          p: 0 
        }}
      >
        Access Sandyland Asset Management on the go
      </Typography>

      {/* Add flexible space to push form towards center */}
      <Box sx={{ flexGrow: 0.3 }} />

      <Card 
        sx={{ 
          width: '100%', 
          maxWidth: 400, 
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <form onSubmit={supportsPasskeys && !showPasswordField ? handlePasskeyLogin : handleSubmit}>
            {(error || formError) && (
              <Alert 
                severity="error" 
                sx={{ mb: 2 }}
                onClose={() => {
                  clearError();
                  setFormError('');
                }}
              >
                {error || formError}
              </Alert>
            )}
            
            <TextField
              fullWidth
              type="email"
              label="Email"
              value={formData.email}
              onChange={handleInputChange('email')}
              disabled={loading}
              autoComplete="email"
              autoCapitalize="none"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
                className: 'mobile-input',
              }}
              sx={{ mb: 2 }}
            />

            {showPasswordField && (
              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                label="Password"
                value={formData.password}
                onChange={handleInputChange('password')}
                disabled={loading}
                autoComplete="current-password"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={togglePasswordVisibility}
                        disabled={loading}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                  className: 'mobile-input',
                }}
                sx={{ mb: 2 }}
              />
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading || !formData.email || (showPasswordField && !formData.password)}
              sx={{
                py: 1.5,
                fontSize: '16px',
                fontWeight: 600,
                borderRadius: 2,
                mb: 2,
              }}
            >
              {loading ? (
                <LoadingSpinner size="small" />
              ) : supportsPasskeys && !showPasswordField ? (
                'Sign in with Passkey'
              ) : (
                'Sign In'
              )}
            </Button>

            {supportsPasskeys && (
              <Button
                type="button"
                fullWidth
                variant="text"
                size="small"
                onClick={() => setShowPasswordField((prev) => !prev)}
                disabled={loading}
                sx={{ mt: 1, textTransform: 'none', fontSize: '14px' }}
              >
                {showPasswordField ? 'Use passkey instead' : 'Use password instead'}
              </Button>
            )}
            
            {/* Can't sign in - Only show after login failure */}
            {hasLoginFailed && (
              <Box sx={{ textAlign: 'center', pt: 1, borderTop: '1px solid #eee' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                  Can&apos;t sign in?
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  Contact your administrator to reset your access.
                </Typography>
              </Box>
            )}
          </form>
        </CardContent>
      </Card>

      <Typography 
        variant="body2" 
        sx={{ 
          mt: 3, 
          color: 'text.secondary', 
          textAlign: 'center',
          maxWidth: 300,
        }}
      >
        Use your existing account credentials to access the mobile asset management system.
      </Typography>
      
      {/* Add flexible space at bottom to balance layout */}
      <Box sx={{ flexGrow: 1 }} />
    </Box>
  );
};

export default AuthScreen;
