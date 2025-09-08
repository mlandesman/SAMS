/**
 * Error Display Components for Enterprise Backend Alignment
 * FRONTEND-ALIGNMENT-001 - Phase 1.1
 * 
 * Provides consistent error UI across Desktop and Mobile applications
 */

import React, { useState, useCallback } from 'react';
import { StandardizedError, ErrorMetrics } from './StandardizedError';

export interface ErrorDisplayProps {
  error: StandardizedError | Error | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Primary error display component with enterprise styling
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  compact = false,
  className = ''
}) => {
  const [detailsVisible, setDetailsVisible] = useState(showDetails);

  const standardizedError = error instanceof StandardizedError 
    ? error 
    : new StandardizedError(
        error?.message || 'Unknown error',
        'UNKNOWN_ERROR',
        { category: 'system' }
      );

  // Record error for metrics
  React.useEffect(() => {
    if (standardizedError) {
      ErrorMetrics.recordError(standardizedError);
    }
  }, [standardizedError]);

  const getSeverityColor = (severity: string): string => {
    const colors = {
      low: '#10b981',      // Green
      medium: '#f59e0b',   // Amber
      high: '#ef4444',     // Red
      critical: '#dc2626'  // Dark red
    };
    return colors[severity as keyof typeof colors] || colors.medium;
  };

  const getSeverityIcon = (severity: string): string => {
    const icons = {
      low: '⚠️',
      medium: '⚠️',
      high: '❌',
      critical: '🚨'
    };
    return icons[severity as keyof typeof icons] || icons.medium;
  };

  if (!error) return null;

  if (compact) {
    return (
      <div 
        className={`error-display compact ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: '#fef2f2',
          border: `1px solid ${getSeverityColor(standardizedError.severity)}`,
          borderRadius: '6px',
          fontSize: '14px',
          marginBottom: '8px'
        }}
      >
        <span style={{ marginRight: '8px' }}>
          {getSeverityIcon(standardizedError.severity)}
        </span>
        <span style={{ flex: 1, color: '#374151' }}>
          {standardizedError.userMessage}
        </span>
        {standardizedError.isRetryable() && onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginLeft: '8px',
              padding: '4px 8px',
              backgroundColor: getSeverityColor(standardizedError.severity),
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              marginLeft: '8px',
              padding: '4px 8px',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`error-display full ${className}`}
      style={{
        backgroundColor: '#fef2f2',
        border: `2px solid ${getSeverityColor(standardizedError.severity)}`,
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '16px',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '24px', marginRight: '12px' }}>
          {getSeverityIcon(standardizedError.severity)}
        </span>
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            margin: 0, 
            color: getSeverityColor(standardizedError.severity),
            fontSize: '18px',
            fontWeight: 600
          }}>
            {standardizedError.category.charAt(0).toUpperCase() + standardizedError.category.slice(1)} Error
          </h3>
          <p style={{ 
            margin: '4px 0 0 0', 
            color: '#374151',
            fontSize: '14px'
          }}>
            Code: {standardizedError.code}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '20px',
              color: '#6b7280',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* User Message */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ 
          margin: 0,
          color: '#374151',
          fontSize: '16px',
          lineHeight: '1.5'
        }}>
          {standardizedError.userMessage}
        </p>
      </div>

      {/* Action Items */}
      {standardizedError.actionItems.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ 
            margin: '0 0 8px 0',
            color: '#374151',
            fontSize: '14px',
            fontWeight: 600
          }}>
            What you can do:
          </h4>
          <ul style={{ 
            margin: 0,
            paddingLeft: '20px',
            color: '#6b7280',
            fontSize: '14px'
          }}>
            {standardizedError.actionItems.map((item, index) => (
              <li key={index} style={{ marginBottom: '4px' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        {standardizedError.isRetryable() && onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '10px 20px',
              backgroundColor: getSeverityColor(standardizedError.severity),
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        )}
        <button
          onClick={() => setDetailsVisible(!detailsVisible)}
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            color: getSeverityColor(standardizedError.severity),
            border: `1px solid ${getSeverityColor(standardizedError.severity)}`,
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          {detailsVisible ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Technical Details */}
      {detailsVisible && (
        <details 
          open 
          style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            padding: '12px'
          }}
        >
          <summary style={{ 
            fontWeight: 600,
            color: '#374151',
            cursor: 'pointer',
            marginBottom: '8px'
          }}>
            Technical Details
          </summary>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#6b7280' }}>
            <div><strong>Error Code:</strong> {standardizedError.code}</div>
            <div><strong>Category:</strong> {standardizedError.category}</div>
            <div><strong>Severity:</strong> {standardizedError.severity}</div>
            <div><strong>Timestamp:</strong> {standardizedError.timestamp}</div>
            {standardizedError.details.requestId && (
              <div><strong>Request ID:</strong> {standardizedError.details.requestId}</div>
            )}
            {standardizedError.details.userId && (
              <div><strong>User ID:</strong> {standardizedError.details.userId}</div>
            )}
            {standardizedError.details.clientId && (
              <div><strong>Client ID:</strong> {standardizedError.details.clientId}</div>
            )}
            <div style={{ marginTop: '8px' }}>
              <strong>Original Message:</strong><br />
              {standardizedError.message}
            </div>
          </div>
        </details>
      )}
    </div>
  );
};

/**
 * Toast notification for errors
 */
export interface ErrorToastProps {
  error: StandardizedError | Error | null;
  onDismiss: () => void;
  duration?: number;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  error,
  onDismiss,
  duration = 5000
}) => {
  const [visible, setVisible] = useState(!!error);

  const standardizedError = error instanceof StandardizedError 
    ? error 
    : new StandardizedError(
        error?.message || 'Unknown error',
        'UNKNOWN_ERROR'
      );

  React.useEffect(() => {
    if (error) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300); // Allow fade out
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [error, duration, onDismiss]);

  if (!error || !visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: '#fef2f2',
        border: `2px solid ${getSeverityColor(standardizedError.severity)}`,
        borderRadius: '8px',
        padding: '16px',
        maxWidth: '400px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-in-out',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <ErrorDisplay 
        error={error} 
        onDismiss={onDismiss}
        compact={true}
      />
    </div>
  );
};

function getSeverityColor(severity: string): string {
  const colors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#dc2626'
  };
  return colors[severity as keyof typeof colors] || colors.medium;
}

export default ErrorDisplay;