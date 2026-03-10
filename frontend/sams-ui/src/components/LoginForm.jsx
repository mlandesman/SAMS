import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { config } from '../config';
import { useVersionInfo } from '../utils/versionUtils';
import { passkeyService } from '../services/passkeyService';
import { getAuthInstance } from '../firebaseClient';
import '../styles/SandylandModalTheme.css';
import './LoginForm.css';

/**
 * Login form with passkey-first UI.
 * Primary: Sign in with Passkey. Secondary: Use password (bootstrap).
 * After password login: dismissible "Register a passkey" prompt.
 */
const LoginForm = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [hasLoginFailed, setHasLoginFailed] = useState(false);
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [passkeyPromptUser, setPasskeyPromptUser] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);
  const [passkeyRegError, setPasskeyRegError] = useState('');
  const { login, loginWithPasskey, error, setError } = useAuth();
  const versionInfo = useVersionInfo();
  const supportsPasskeys = passkeyService.supportsPasskeys();

  useEffect(() => {
    if (!supportsPasskeys) {
      setShowPasswordField(true);
    }
  }, [supportsPasskeys]);

  const handlePasskeyLogin = async (e) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setIsLoading(true);
    try {
      await loginWithPasskey(email.trim() || undefined);
      setEmail('');
      setHasLoginFailed(false);
      if (onLoginSuccess) {
        const auth = getAuthInstance();
        onLoginSuccess(auth.currentUser);
      }
    } catch (err) {
      let msg = err.message || 'Passkey sign-in failed.';
      if (err.name === 'NotAllowedError' || msg.toLowerCase().includes('cancel')) {
        msg = 'Authentication cancelled. Try again or use password.';
      } else if (msg.includes('User not found') || msg.includes('404') || msg.includes('No passkey') || msg.includes('Credential not found')) {
        msg = 'No passkey found for this email. Sign in with password to register one.';
      } else if (msg.includes('network') || msg.includes('fetch')) {
        msg = 'Network error. Please try again.';
      }
      setError(msg);
      setHasLoginFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setIsLoading(true);

    try {
      const userCredential = await login(email, password);
      if (import.meta.env.DEV) {
        console.log('Login successful:', userCredential.user);
      }
      setEmail('');
      setPassword('');
      setHasLoginFailed(false);

      if (supportsPasskeys) {
        setPasskeyPromptUser(userCredential.user);
        setDeviceName(getDefaultDeviceName());
        setShowPasskeyPrompt(true);
      } else {
        if (onLoginSuccess) onLoginSuccess(userCredential.user);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Login error:', err);
      }
      setHasLoginFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultDeviceName = () => {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      const ua = navigator.userAgent;
      if (ua.includes('iPhone') || ua.includes('iPad')) return 'iPhone';
      if (ua.includes('Android')) return 'Android';
      if (ua.includes('Mac')) return 'MacBook';
      if (ua.includes('Windows')) return 'Windows PC';
    }
    return 'This device';
  };

  const handlePasskeyPromptRegister = async () => {
    if (!passkeyPromptUser?.email) return;
    setPasskeyRegError('');
    setIsRegisteringPasskey(true);
    try {
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      await passkeyService.startPasskeyRegistration(
        passkeyPromptUser.email,
        token,
        deviceName.trim() || getDefaultDeviceName(),
        null
      );
      setShowPasskeyPrompt(false);
      setPasskeyPromptUser(null);
      if (onLoginSuccess) onLoginSuccess(passkeyPromptUser);
    } catch (err) {
      let msg = err.message || 'Registration failed.';
      if (err.name === 'NotAllowedError' || msg.toLowerCase().includes('cancel')) {
        msg = 'Registration cancelled. You can set up a passkey later.';
      }
      setPasskeyRegError(msg);
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  const handlePasskeyPromptDismiss = () => {
    const user = passkeyPromptUser;
    setShowPasskeyPrompt(false);
    setPasskeyPromptUser(null);
    setPasskeyRegError('');
    if (onLoginSuccess && user) onLoginSuccess(user);
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
      const API_BASE_URL = config.api.baseUrl;
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          requestType: 'forgot-password',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reset password');
      }

      const result = await response.json();
      setResetMessage(`A temporary password has been sent to ${email}. Please check your inbox and use the temporary password to log in. You will be required to create a new password on your first login.`);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Password reset error:', err);
      let errorMessage = err.message;
      if (err.message.includes('User not found')) errorMessage = 'No account found with this email address.';
      else if (err.message.includes('Invalid email')) errorMessage = 'Invalid email address.';
      else if (err.message.includes('Too many requests')) errorMessage = 'Too many password reset requests. Please try again later.';
      else if (!errorMessage.includes('Failed to')) errorMessage = 'Failed to send temporary password. ' + errorMessage;
      setError(errorMessage);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
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
          <form onSubmit={supportsPasskeys && !showPasswordField ? handlePasskeyLogin : handleSubmit}>
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

            {showPasswordField && (
              <div className="form-group">
                <label htmlFor="password">Password:</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={showPasswordField}
                  placeholder="Your password"
                  autoComplete="current-password"
                />
              </div>
            )}

            {supportsPasskeys && !showPasswordField ? (
              <>
                <button type="submit" className="login-form-submit-button" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign in with Passkey'}
                </button>
                <button
                  type="button"
                  className="login-form-link-button"
                  onClick={() => setShowPasswordField(true)}
                >
                  Use password instead
                </button>
              </>
            ) : (
              <>
                <button type="submit" className="login-form-submit-button" disabled={isLoading}>
                  {isLoading ? 'Logging in...' : 'Login'}
                </button>
                {supportsPasskeys && (
                  <button
                    type="button"
                    className="login-form-link-button"
                    onClick={() => setShowPasswordField(false)}
                  >
                    Use passkey instead
                  </button>
                )}
              </>
            )}
          </form>

          {hasLoginFailed && (
            <div className="forgot-password-section">
              <p className="forgot-password-text">Forgot your password?</p>
              <button
                type="button"
                className="forgot-password-button"
                onClick={handleForgotPassword}
                disabled={isResetting}
              >
                {isResetting ? 'Sending reset email...' : 'Send Reset Email'}
              </button>
              <p className="forgot-password-help">
                Enter your email address above and click &quot;Send Reset Email&quot; to receive a temporary password.
              </p>
            </div>
          )}

          <div className="login-version">
            <span className="version-text">
              {versionInfo.versionDisplay}
              <span className="version-build">({versionInfo.build?.buildNumber || 'dev'})</span>
            </span>
          </div>
        </div>
      </div>

      {/* Post-password-login passkey registration prompt */}
      {showPasskeyPrompt && (
        <div className="sandyland-modal-overlay" onClick={(e) => e.target === e.currentTarget && handlePasskeyPromptDismiss()}>
          <div className="sandyland-modal" onClick={(e) => e.stopPropagation()} style={{ width: '420px', maxWidth: '90vw' }}>
            <div className="sandyland-modal-header">
              <h2 className="sandyland-modal-title">Set up a passkey for faster login</h2>
            </div>
            <div className="sandyland-modal-content">
              <p style={{ margin: '0 0 1rem 0', color: '#4a5568' }}>
                Register a passkey to sign in quickly next time with your fingerprint or face.
              </p>
              <div className="form-group">
                <label htmlFor="device-name">Device name:</label>
                <input
                  type="text"
                  id="device-name"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. MacBook Pro"
                  className="login-form-input"
                />
              </div>
              {passkeyRegError && <div className="error-message">{passkeyRegError}</div>}
            </div>
            <div className="sandyland-modal-buttons">
              <button
                className="sandyland-btn sandyland-btn-secondary"
                onClick={handlePasskeyPromptDismiss}
                disabled={isRegisteringPasskey}
              >
                Maybe later
              </button>
              <button
                className="sandyland-btn sandyland-btn-primary"
                onClick={handlePasskeyPromptRegister}
                disabled={isRegisteringPasskey}
              >
                {isRegisteringPasskey ? 'Registering...' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LoginForm;
