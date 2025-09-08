/**
 * Performance Error Display Components
 * FRONTEND-ALIGNMENT-001 - Phase 1.3
 * 
 * React components for displaying performance-related errors with metrics
 */

import React, { useState, useEffect } from 'react';
import { PerformanceError, PERFORMANCE_THRESHOLDS } from './PerformanceErrorMonitor';
import { ErrorDisplay } from './ErrorDisplay';

interface PerformanceErrorDisplayProps {
  error: PerformanceError;
  onRetry?: () => void;
  onOptimize?: () => void;
  onDismiss?: () => void;
  showMetrics?: boolean;
  showOptimizationTips?: boolean;
}

/**
 * Enhanced error display for performance issues
 */
export const PerformanceErrorDisplay: React.FC<PerformanceErrorDisplayProps> = ({
  error,
  onRetry,
  onOptimize,
  onDismiss,
  showMetrics = true,
  showOptimizationTips = true
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Get severity level based on how much the threshold was exceeded
  const getSeverityLevel = (): 'warning' | 'error' | 'critical' => {
    const ratio = error.metric.value / error.threshold;
    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'error';
    return 'warning';
  };

  // Get performance level description
  const getPerformanceLevel = (): string => {
    const { value, category } = error.metric;
    const thresholds = PERFORMANCE_THRESHOLDS[category.toUpperCase() as keyof typeof PERFORMANCE_THRESHOLDS];
    
    if (!thresholds) return 'Unknown';
    
    if (value <= (thresholds as any).FAST) return 'Excellent';
    if (value <= (thresholds as any).NORMAL) return 'Good';
    if (value <= (thresholds as any).SLOW) return 'Slow';
    return 'Critical';
  };

  // Format metric value for display
  const formatMetricValue = (value: number, category: string): string => {
    switch (category) {
      case 'memory':
        return `${value.toFixed(1)} MB`;
      case 'api':
      case 'render':
      case 'resource':
        return `${value.toFixed(0)} ms`;
      default:
        return value.toString();
    }
  };

  // Get optimization tips based on error category
  const getOptimizationTips = (): string[] => {
    const tipMap: Record<string, string[]> = {
      api: [
        'Check your internet connection',
        'Try again when server load is lower',
        'Use cached data when available',
        'Implement request debouncing'
      ],
      render: [
        'Close unnecessary browser tabs',
        'Disable browser extensions temporarily',
        'Use a more powerful device',
        'Reduce the complexity of the current view'
      ],
      resource: [
        'Check your internet connection',
        'Clear browser cache',
        'Use a different network if available',
        'Disable ad blockers temporarily'
      ],
      memory: [
        'Close other browser tabs',
        'Restart your browser',
        'Clear browser cache and data',
        'Use a device with more RAM'
      ]
    };

    return tipMap[error.performanceCategory] || [
      'Try refreshing the page',
      'Contact support if the issue persists'
    ];
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* Standard error display */}
      <ErrorDisplay
        error={error}
        onRetry={onRetry}
        onDismiss={onDismiss}
        showDetails={false}
      />

      {/* Performance-specific information */}
      <div style={{
        backgroundColor: '#f8fafc',
        border: '2px solid #e2e8f0',
        borderRadius: '8px',
        padding: '20px',
        marginTop: '16px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '24px', marginRight: '12px' }}>
            ⚡
          </span>
          <div>
            <h3 style={{
              margin: 0,
              color: '#374151',
              fontSize: '18px',
              fontWeight: 600
            }}>
              Performance Issue Detected
            </h3>
            <p style={{
              margin: '4px 0 0 0',
              color: '#6b7280',
              fontSize: '14px'
            }}>
              Level: {getPerformanceLevel()} • Category: {error.performanceCategory}
            </p>
          </div>
        </div>

        {/* Performance metrics */}
        {showMetrics && (
          <div style={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <h4 style={{
              margin: '0 0 12px 0',
              color: '#374151',
              fontSize: '16px',
              fontWeight: 600
            }}>
              Performance Metrics
            </h4>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              fontSize: '14px'
            }}>
              <div>
                <strong>Metric:</strong> {error.metric.name}
              </div>
              <div>
                <strong>Value:</strong> 
                <span style={{ 
                  color: getSeverityLevel() === 'critical' ? '#dc2626' : 
                        getSeverityLevel() === 'error' ? '#ea580c' : '#d97706',
                  fontWeight: 600,
                  marginLeft: '4px'
                }}>
                  {formatMetricValue(error.metric.value, error.performanceCategory)}
                </span>
              </div>
              <div>
                <strong>Threshold:</strong> {formatMetricValue(error.threshold, error.performanceCategory)}
              </div>
              <div>
                <strong>Severity:</strong> {getSeverityLevel()}
              </div>
            </div>

            {/* Performance bar visualization */}
            <div style={{ marginTop: '12px' }}>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                Performance vs Threshold
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e5e7eb',
                borderRadius: '4px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.min((error.metric.value / error.threshold) * 100, 100)}%`,
                  height: '100%',
                  backgroundColor: getSeverityLevel() === 'critical' ? '#dc2626' : 
                                  getSeverityLevel() === 'error' ? '#ea580c' : '#d97706',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Optimization suggestions */}
        {showOptimizationTips && (
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <h4 style={{
              margin: '0 0 12px 0',
              color: '#0c4a6e',
              fontSize: '16px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '8px' }}>💡</span>
              Optimization Tips
            </h4>
            <ul style={{
              margin: 0,
              paddingLeft: '20px',
              color: '#0c4a6e',
              fontSize: '14px'
            }}>
              {getOptimizationTips().map((tip, index) => (
                <li key={index} style={{ marginBottom: '4px' }}>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '12px'
        }}>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '10px 20px',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          )}
          {onOptimize && (
            <button
              onClick={onOptimize}
              style={{
                padding: '10px 20px',
                backgroundColor: '#0ea5e9',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Optimize Performance
            </button>
          )}
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {/* Technical details */}
        {showDetails && (
          <details
            open
            style={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
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
            <div style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#6b7280'
            }}>
              <div><strong>Timestamp:</strong> {new Date(error.metric.timestamp).toISOString()}</div>
              <div><strong>Category:</strong> {error.performanceCategory}</div>
              <div><strong>Metric Name:</strong> {error.metric.name}</div>
              <div><strong>Raw Value:</strong> {error.metric.value}</div>
              <div><strong>Threshold:</strong> {error.threshold}</div>
              <div><strong>Suggestion:</strong> {error.suggestion}</div>
              {error.metric.metadata && (
                <div style={{ marginTop: '8px' }}>
                  <strong>Metadata:</strong>
                  <pre style={{
                    backgroundColor: '#fff',
                    padding: '8px',
                    borderRadius: '4px',
                    marginTop: '4px',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {JSON.stringify(error.metric.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

/**
 * Compact performance error notification
 */
interface PerformanceToastProps {
  error: PerformanceError;
  onDismiss: () => void;
  autoHide?: boolean;
  duration?: number;
}

export const PerformanceToast: React.FC<PerformanceToastProps> = ({
  error,
  onDismiss,
  autoHide = true,
  duration = 5000
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration, onDismiss]);

  if (!visible) return null;

  const getSeverityColor = () => {
    const ratio = error.metric.value / error.threshold;
    if (ratio > 3) return '#dc2626';
    if (ratio > 2) return '#ea580c';
    return '#d97706';
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: '#fff',
        border: `2px solid ${getSeverityColor()}`,
        borderRadius: '8px',
        padding: '16px',
        maxWidth: '400px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-in-out',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '20px', marginRight: '8px' }}>⚡</span>
            <span style={{
              fontWeight: 600,
              color: getSeverityColor(),
              fontSize: '14px'
            }}>
              Performance Issue
            </span>
          </div>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#374151',
            lineHeight: '1.4'
          }}>
            {error.userMessage}
          </p>
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            {error.suggestion}
          </p>
        </div>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 300);
          }}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '18px',
            color: '#6b7280',
            cursor: 'pointer',
            padding: '0',
            marginLeft: '12px'
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default PerformanceErrorDisplay;