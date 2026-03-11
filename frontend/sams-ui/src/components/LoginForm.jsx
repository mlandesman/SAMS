import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
const LoginForm = ({ onLoginSuccess, onShowPasskeyPrompt }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoginFailed, setHasLoginFailed] = useState(false);
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
              <p className="forgot-password-help">Contact your administrator to reset your access.</p>
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
