/**
 * Reusable Loading Spinner Component
 * Shared component for SAMS Desktop and Mobile applications
 * Provides consistent loading feedback across all database operations
 */

import React from 'react';
import './LoadingSpinner.css';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'white';
  variant?: 'default' | 'logo';
  message?: string;
  fullScreen?: boolean;
  className?: string;
  show?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'primary',
  variant = 'default',
  message = '',
  fullScreen = false,
  className = '',
  show = true
}) => {
  if (!show) return null;

  const sizeClasses = {
    small: 'loading-spinner--small',
    medium: 'loading-spinner--medium', 
    large: 'loading-spinner--large'
  };

  const colorClasses = {
    primary: 'loading-spinner--primary',
    secondary: 'loading-spinner--secondary',
    white: 'loading-spinner--white'
  };

  const variantClasses = {
    default: '',
    logo: 'loading-spinner--logo'
  };

  const spinnerClass = `loading-spinner ${sizeClasses[size]} ${variantClasses[variant]} ${variant === 'logo' ? '' : colorClasses[color]} ${className}`;
  
  if (fullScreen) {
    return (
      <div className="loading-spinner-overlay" role="dialog" aria-live="polite">
        <div className="loading-spinner-container">
          <div className={spinnerClass} aria-hidden="true"></div>
          {message && (
            <p className="loading-spinner-message" aria-live="polite">
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="loading-spinner-inline" role="status" aria-live="polite">
      <div className={spinnerClass} aria-hidden="true"></div>
      {message && (
        <span className="loading-spinner-message" aria-live="polite">
          {message}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;