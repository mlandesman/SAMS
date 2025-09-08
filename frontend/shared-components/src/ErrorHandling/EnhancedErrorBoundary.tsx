/**
 * Enhanced Error Boundary for Enterprise Backend Alignment
 * FRONTEND-ALIGNMENT-001 - Phase 1.1
 * 
 * Advanced error boundary with performance monitoring and retry capabilities
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StandardizedError, ErrorMetrics, ErrorFactory } from './StandardizedError';
import { ErrorDisplay } from './ErrorDisplay';

interface Props {
  children: ReactNode;
  fallback?: (error: StandardizedError, retry: () => void) => ReactNode;
  onError?: (error: StandardizedError, errorInfo: ErrorInfo) => void;
  enableRetry?: boolean;
  maxRetries?: number;
  enableReporting?: boolean;
}

interface State {
  hasError: boolean;
  error: StandardizedError | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  errorId: string | null;
}

/**
 * Enhanced Error Boundary with enterprise features
 */
export class EnhancedErrorBoundary extends Component<Props, State> {
  private retryTimeouts: Set<NodeJS.Timeout> = new Set();

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Convert any error to StandardizedError
    const standardizedError = error instanceof StandardizedError
      ? error
      : ErrorFactory.system('COMPONENT_ERROR', error.message, {
          severity: 'high',
          retry: true,
          maxRetries: 3
        });

    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error: standardizedError,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const standardizedError = this.state.error || ErrorFactory.system(
      'COMPONENT_ERROR', 
      error.message
    );

    // Record error metrics
    ErrorMetrics.recordError(standardizedError);

    // Update state with error info
    this.setState({ errorInfo });

    // Log detailed error information
    console.group('🚨 Error Boundary Caught Error');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Standardized Error:', standardizedError.toResponse());
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(standardizedError, errorInfo);
    }

    // Report to monitoring service if enabled
    if (this.props.enableReporting !== false) {
      this.reportError(standardizedError, errorInfo);
    }
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  /**
   * Report error to monitoring service
   */
  private reportError = (error: StandardizedError, errorInfo: ErrorInfo) => {
    try {
      // Prepare error report
      const errorReport = {
        errorId: this.state.errorId,
        error: error.toResponse(),
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        retryCount: this.state.retryCount,
        userId: this.getUserId(),
        sessionId: this.getSessionId()
      };

      // Log to console for development
      if (process.env.NODE_ENV === 'development') {
        console.log('Error Report:', errorReport);
      }

      // Send to monitoring service (implement based on your monitoring stack)
      // Example: window.dataLayer?.push({ event: 'error', errorReport });
      // Example: fetch('/api/errors', { method: 'POST', body: JSON.stringify(errorReport) });
      
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  /**
   * Get user ID for error reporting
   */
  private getUserId = (): string | null => {
    try {
      // Try to get user ID from various sources
      const authContext = (window as any).__SAMS_AUTH_CONTEXT__;
      return authContext?.user?.uid || 
             localStorage.getItem('sams_user_id') || 
             sessionStorage.getItem('user_id') ||
             null;
    } catch {
      return null;
    }
  };

  /**
   * Get session ID for error reporting
   */
  private getSessionId = (): string | null => {
    try {
      return sessionStorage.getItem('session_id') || 
             localStorage.getItem('sams_session_id') ||
             null;
    } catch {
      return null;
    }
  };

  /**
   * Retry mechanism with exponential backoff
   */
  private handleRetry = () => {
    const { error } = this.state;
    const { maxRetries = 3 } = this.props;

    if (!error || this.state.retryCount >= maxRetries) {
      console.warn('Retry limit reached or no error to retry');
      return;
    }

    // Calculate backoff delay (exponential: 1s, 2s, 4s, etc.)
    const baseDelay = error.getRetryDelay();
    const backoffDelay = baseDelay * Math.pow(2, this.state.retryCount);
    const jitteredDelay = backoffDelay + (Math.random() * 1000); // Add jitter

    console.log(`Retrying in ${jitteredDelay}ms (attempt ${this.state.retryCount + 1}/${maxRetries})`);

    const timeout = setTimeout(() => {
      this.retryTimeouts.delete(timeout);
      
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }, jitteredDelay);

    this.retryTimeouts.add(timeout);
  };

  /**
   * Reset error boundary state
   */
  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: null
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default error UI
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <ErrorDisplay
            error={this.state.error}
            onRetry={this.props.enableRetry !== false && this.state.error.isRetryable() 
              ? this.handleRetry 
              : undefined}
            onDismiss={this.handleReset}
            showDetails={process.env.NODE_ENV === 'development'}
          />
          
          {/* Development-only debugging info */}
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{
              marginTop: '20px',
              padding: '16px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              <summary style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Development Debug Info
              </summary>
              <div>
                <strong>Error ID:</strong> {this.state.errorId}<br />
                <strong>Retry Count:</strong> {this.state.retryCount}<br />
                <strong>Max Retries:</strong> {this.props.maxRetries || 3}<br />
                <strong>Component Stack:</strong>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  marginTop: '8px',
                  backgroundColor: '#fff',
                  padding: '8px',
                  borderRadius: '4px'
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for using error boundary functionality
 */
export const useErrorHandler = () => {
  const [error, setError] = React.useState<StandardizedError | null>(null);

  const handleError = React.useCallback((error: Error | StandardizedError) => {
    const standardizedError = error instanceof StandardizedError
      ? error
      : ErrorFactory.system('HOOK_ERROR', error.message);
    
    ErrorMetrics.recordError(standardizedError);
    setError(standardizedError);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const retry = React.useCallback(() => {
    setError(null);
    // Trigger re-render or re-fetch logic here
  }, []);

  return { error, handleError, clearError, retry };
};

/**
 * Higher-order component for adding error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default EnhancedErrorBoundary;