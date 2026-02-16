/**
 * React Error Boundary — catches render errors and reports to System Error Monitor
 * EM-3: Frontend Error Capture Integration
 */

import React from 'react';
import { logFrontendError } from '../api/systemErrors.js';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logFrontendError({
      module: 'react',
      message: `React render error: ${error.message}`,
      details: `Component stack: ${errorInfo.componentStack}\n\nStack: ${error.stack || 'No stack'}`
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>The application encountered an unexpected error. Please refresh the page.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
