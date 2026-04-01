import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVersionInfo } from '../utils/versionUtils';
import { passkeyService } from '../services/passkeyService';
import { getAuthInstance } from '../firebaseClient';
import { config } from '../config/index.js';
import '../styles/SandylandModalTheme.css';
import './LoginForm.css';

/**
 * Login form with passkey-first UI.
 * Primary: Sign in with Passkey. Secondary: Use password (bootstrap).
 * After password login: dismissible "Register a passkey" prompt.
 */
const LoginForm = ({ onLoginSuccess, onShowPasskeyPrompt }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoginFailed, setHasLoginFailed] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const { login, loginWithPasskey, error, setError } = useAuth();
  const versionInfo = useVersionInfo();
  const supportsPasskeys = passkeyService.supportsPasskeys();

  useEffect(() => {
    if (!supportsPasskeys) {
      setShowPasswordField(true);
    }
  }, [supportsPasskeys]);

  const handleForgotPassword = async () => {
    const targetEmail = resetEmail.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setResetStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    setIsResetting(true);
    setResetStatus(null);
    try {
      const res = await fetch(`${config.api.baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetStatus({ type: 'success', message: data.message || 'A temporary password has been sent to your email.' });
      } else {
        setResetStatus({ type: 'error', message: data.error || 'Password reset failed. Please try again.' });
      }
    } catch {
      setResetStatus({ type: 'error', message: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsResetting(false);
    }
  };

  const handlePasskeyLogin = async (e) => {
    e.preventDefault();
    setError('');
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
    setIsLoading(true);

    try {
      const userCredential = await login(email, password);
      if (import.meta.env.DEV) {
        console.log('Login successful:', userCredential.user);
      }
      setEmail('');
      setPassword('');
      setHasLoginFailed(false);

      if (supportsPasskeys && onShowPasskeyPrompt) {
        onShowPasskeyPrompt(userCredential.user);
      } else if (onLoginSuccess) {
        onLoginSuccess(userCredential.user);
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
              <p className="forgot-password-text">Can&apos;t sign in?</p>
              {!showResetForm ? (
                <button
                  type="button"
                  className="forgot-password-button"
                  onClick={() => { setShowResetForm(true); setResetEmail(email); setResetStatus(null); }}
                >
                  Forgot Password?
                </button>
              ) : (
                <>
                  <input
                    type="email"
                    className="login-form-input"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                  <button
                    type="button"
                    className="forgot-password-button"
                    onClick={handleForgotPassword}
                    disabled={isResetting}
                    style={{ marginTop: '0.5rem' }}
                  >
                    {isResetting ? 'Sending...' : 'Send Reset Email'}
                  </button>
                  {resetStatus && (
                    <div className={resetStatus.type === 'success' ? 'success-message' : 'error-message'} style={{ marginTop: '0.5rem' }}>
                      {resetStatus.message}
                    </div>
                  )}
                  <p className="forgot-password-help">
                    A temporary password will be emailed to you. You&apos;ll be asked to change it on your next login.
                  </p>
                </>
              )}
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
    </>
  );
};

export default LoginForm;
