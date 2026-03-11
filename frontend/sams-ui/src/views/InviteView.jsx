/**
 * Invite-based passkey registration for new users.
 * Route: /invite/:token
 * User enters email (must match invite), device name, then registers passkey.
 * On success: show confirmation with device-aware link to sign in (no auto-login).
 */

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { passkeyService, getDefaultDeviceName } from '../services/passkeyService';
import '../styles/SandylandModalTheme.css';
import '../components/LoginForm.css';

function getAppUrl() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (window.location.hostname === 'localhost') {
    return isMobile ? 'http://localhost:5174' : '/';
  }
  return isMobile
    ? 'https://mobile.sams.sandyland.com.mx'
    : 'https://sams.sandyland.com.mx';
}

function InviteView() {
  const { token } = useParams();
  const [email, setEmail] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const supportsPasskeys = passkeyService.supportsPasskeys();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await passkeyService.startPasskeyRegistration(
        email.trim(),
        null,
        deviceName.trim() || getDefaultDeviceName(),
        token
      );
      setRegistrationComplete(true);
    } catch (err) {
      let msg = err.message || 'Registration failed.';
      if (err.name === 'NotAllowedError' || msg.toLowerCase().includes('cancel')) {
        msg = 'Registration cancelled. Please try again.';
      } else if (msg.includes('Invalid') || msg.includes('expired') || msg.includes('401')) {
        msg = 'Invalid or expired invite. Contact your administrator.';
      } else if (msg.includes('403') || msg.includes('match')) {
        msg = 'Email does not match this invite. Please enter the email you were invited with.';
      } else if (msg.includes('network') || msg.includes('fetch')) {
        msg = 'Network error. Please try again.';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
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
          <div className="error-message">Invalid invite link. No token provided.</div>
        </div>
      </div>
    );
  }

  if (!supportsPasskeys) {
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
          <h2>Welcome to Sandyland Management System</h2>
          <div className="error-message">
            Your browser does not support passkeys. Please use a modern browser (Chrome, Safari, Edge) to complete registration.
          </div>
        </div>
      </div>
    );
  }

  if (registrationComplete) {
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
          <p className="success-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.5rem' }}>✓</span>
            Your passkey has been registered!
          </p>
          <p style={{ color: '#666', marginBottom: '1.5rem', textAlign: 'center' }}>
            You can now sign in with your fingerprint or face on any device.
          </p>
          <a href={getAppUrl()} className="login-form-submit-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', lineHeight: '2.5' }}>
            Sign In to SAMS →
          </a>
        </div>
      </div>
    );
  }

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
        <h2>Welcome to Sandyland Management System</h2>
        <p style={{ color: '#666', marginBottom: '1.5rem', textAlign: 'center' }}>
          You&apos;ve been invited to set up your account. Register a passkey to sign in with your fingerprint or face.
        </p>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label htmlFor="invite-email">Email:</label>
            <input
              type="email"
              id="invite-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="invite-device">Device name:</label>
            <input
              type="text"
              id="invite-device"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder={getDefaultDeviceName()}
              className="login-form-input"
            />
          </div>
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Registering...' : 'Register Passkey'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default InviteView;
