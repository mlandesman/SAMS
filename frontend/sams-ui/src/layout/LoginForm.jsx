import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { config } from '../config';
import './LoginForm.css';

/**
 * A simple login form component
 * @param {Object} props Component properties
 * @param {function} props.onLoginSuccess Callback function to execute when login is successful
 */
const LoginForm = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [hasLoginFailed, setHasLoginFailed] = useState(false);
  const { login, error, setError } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setIsLoading(true);

    try {
      const userCredential = await login(email, password);
      console.log('Login successful:', userCredential.user);
      
      // Reset form and login failure state on success
      setEmail('');
      setPassword('');
      setHasLoginFailed(false);
      
      // Call the success callback
      if (onLoginSuccess) {
        onLoginSuccess(userCredential.user);
      }
    } catch (error) {
      console.error('Login error:', error);
      // Set login failed state to show forgotten password option
      setHasLoginFailed(true);
      // Error is handled in the AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first, then click "Forgot Password"');
      return;
    }

    setIsResetting(true);
    setError('');
    setResetMessage('');

    try {
      // Use the backend API to reset password (same as User Management system)
      const API_BASE_URL = config.api.baseUrl;
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email: email.trim(),
          requestType: 'forgot-password' 
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reset password');
      }

      const result = await response.json();
      
      setResetMessage(`A temporary password has been sent to ${email}. Please check your inbox and use the temporary password to log in. You will be required to create a new password on your first login.`);
      console.log('Temporary password sent to:', email);
      
    } catch (error) {
      console.error('Password reset error:', error);
      
      // Handle specific error messages from backend
      let errorMessage = error.message;
      
      if (error.message.includes('User not found')) {
        errorMessage = 'No account found with this email address.';
      } else if (error.message.includes('Invalid email')) {
        errorMessage = 'Invalid email address.';
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'Too many password reset requests. Please try again later.';
      } else if (!errorMessage.includes('Failed to')) {
        errorMessage = 'Failed to send temporary password. ' + errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="login-form-container">
      <div className="login-form">
        <div className="login-logo-container">
          <img
            src="https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2Fsandyland-properties-high-resolution-logo-transparent.png?alt=media&token=a39645c7-aa81-41a0-9b20-35086de026d0"
            alt="Sandyland Properties"
            className="login-logo"
          />
        </div>
        <h2>Login to SAMS</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          {resetMessage && <div className="success-message">{resetMessage}</div>}
          
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Your password"
              autoComplete="current-password"
            />
          </div>
          
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        {/* Forgot Password Section - Only show after login failure */}
        {hasLoginFailed && (
          <div className="forgot-password-section">
            <p className="forgot-password-text">
              Forgot your password?
            </p>
            <button 
              type="button" 
              className="forgot-password-button"
              onClick={handleForgotPassword}
              disabled={isResetting}
            >
              {isResetting ? 'Sending reset email...' : 'Send Reset Email'}
            </button>
            <p className="forgot-password-help">
              Enter your email address above and click "Send Reset Email" to receive a temporary password. You'll be required to create a new password when you log in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginForm;
