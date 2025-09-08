import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <h2 style={{ color: '#c00' }}>Something went wrong</h2>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            <summary>Error details (tap to expand)</summary>
            <p style={{ marginTop: '10px' }}>
              <strong>Error:</strong> {this.state.error && this.state.error.toString()}
            </p>
            <p style={{ marginTop: '10px' }}>
              <strong>Stack:</strong>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </p>
          </details>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#c00',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;