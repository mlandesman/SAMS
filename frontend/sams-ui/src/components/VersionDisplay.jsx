import React, { useState, useEffect } from 'react';
import { checkVersionCompatibility } from '../utils/versionChecker';
import { FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';

/**
 * Component to display version information and check for mismatches
 * Can be placed in the app header, footer, or settings page
 */
const VersionDisplay = ({ showDetails = false, position = 'footer' }) => {
  const [versionInfo, setVersionInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkVersions = async () => {
      try {
        const compatibility = await checkVersionCompatibility();
        setVersionInfo(compatibility);
      } catch (error) {
        console.error('Error checking versions:', error);
      } finally {
        setLoading(false);
      }
    };

    checkVersions();
    
    // Re-check every 5 minutes
    const interval = setInterval(checkVersions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !versionInfo) {
    return null;
  }

  const isMismatch = versionInfo.compatible === false;
  const isUnknown = versionInfo.compatible === 'unknown';

  // Minimal display for footer/header
  if (!showDetails) {
    return (
      <div className={`version-display version-display--${position}`}>
        <span className="version-text">
          v{versionInfo.frontend?.version || '0.0.1'}
          {versionInfo.frontend?.gitCommit && versionInfo.frontend.gitCommit !== 'unknown' && (
            <span className="version-commit"> ({versionInfo.frontend.gitCommit.substring(0, 7)})</span>
          )}
        </span>
        {isMismatch && (
          <FiAlertTriangle 
            className="version-warning-icon" 
            title="Version mismatch detected"
          />
        )}
      </div>
    );
  }

  // Detailed display for settings/about page
  return (
    <div className="version-details-container">
      <h3 className="version-title">
        <FiInfo className="icon" />
        System Version Information
      </h3>
      
      <div className="version-status">
        {isMismatch ? (
          <div className="status-alert status-alert--warning">
            <FiAlertTriangle className="status-icon" />
            <div>
              <strong>Version Mismatch Detected</strong>
              <p>{versionInfo.message}</p>
            </div>
          </div>
        ) : isUnknown ? (
          <div className="status-alert status-alert--info">
            <FiInfo className="status-icon" />
            <div>
              <strong>Unable to verify backend version</strong>
              <p>Backend version check is unavailable</p>
            </div>
          </div>
        ) : (
          <div className="status-alert status-alert--success">
            <FiCheckCircle className="status-icon" />
            <div>
              <strong>All systems are in sync</strong>
              <p>{versionInfo.message}</p>
            </div>
          </div>
        )}
      </div>

      <div className="version-grid">
        <div className="version-card">
          <h4>Frontend (Desktop)</h4>
          <dl>
            <dt>Version:</dt>
            <dd>{versionInfo.frontend?.version || 'unknown'}</dd>
            
            <dt>Git Commit:</dt>
            <dd>{versionInfo.frontend?.gitCommit || 'unknown'}</dd>
            
            <dt>Build Date:</dt>
            <dd>{versionInfo.frontend?.buildDate ? new Date(versionInfo.frontend.buildDate).toLocaleString() : 'unknown'}</dd>
            
            <dt>Environment:</dt>
            <dd>{versionInfo.frontend?.environment || 'unknown'}</dd>
          </dl>
        </div>

        <div className="version-card">
          <h4>Backend API</h4>
          {versionInfo.backend?.error ? (
            <p className="error-text">Error: {versionInfo.backend.error}</p>
          ) : (
            <dl>
              <dt>Version:</dt>
              <dd>{versionInfo.backend?.version || 'unknown'}</dd>
              
              <dt>Git Commit:</dt>
              <dd>{versionInfo.backend?.git?.hash || versionInfo.backend?.gitCommit || 'unknown'}</dd>
              
              <dt>Build Date:</dt>
              <dd>{versionInfo.backend?.buildDate ? new Date(versionInfo.backend.buildDate).toLocaleString() : 'unknown'}</dd>
              
              <dt>Environment:</dt>
              <dd>{versionInfo.backend?.environment || 'unknown'}</dd>
            </dl>
          )}
        </div>
      </div>

      {isMismatch && (
        <div className="version-help">
          <h4>What does this mean?</h4>
          <p>
            A version mismatch means the frontend and backend are running different versions of the code. 
            This can cause unexpected behavior or errors. Please contact your system administrator to resolve this issue.
          </p>
        </div>
      )}
    </div>
  );
};

// Add default styles
const styles = `
  .version-display {
    font-size: 12px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .version-display--footer {
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(255, 255, 255, 0.9);
    padding: 4px 12px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .version-commit {
    opacity: 0.7;
  }
  
  .version-warning-icon {
    color: #ff9800;
    font-size: 16px;
  }
  
  .version-details-container {
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
  }
  
  .version-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }
  
  .status-alert {
    display: flex;
    align-items: start;
    gap: 12px;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 24px;
  }
  
  .status-alert--success {
    background: #e8f5e9;
    color: #2e7d32;
  }
  
  .status-alert--warning {
    background: #fff3e0;
    color: #f57c00;
  }
  
  .status-alert--info {
    background: #e3f2fd;
    color: #1976d2;
  }
  
  .status-icon {
    font-size: 24px;
    flex-shrink: 0;
  }
  
  .version-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
  }
  
  .version-card {
    background: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
  }
  
  .version-card h4 {
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
  }
  
  .version-card dl {
    margin: 0;
  }
  
  .version-card dt {
    font-weight: bold;
    color: #666;
    margin-top: 8px;
  }
  
  .version-card dd {
    margin: 4px 0 12px 0;
    font-family: monospace;
  }
  
  .version-help {
    background: #fafafa;
    padding: 16px;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  }
  
  .version-help h4 {
    margin-top: 0;
  }
  
  .error-text {
    color: #d32f2f;
  }
`;

// Inject styles (in a real app, use CSS modules or styled-components)
if (typeof document !== 'undefined' && !document.getElementById('version-display-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'version-display-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default VersionDisplay;