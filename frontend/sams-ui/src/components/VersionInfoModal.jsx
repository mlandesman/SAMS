import React, { useState, useEffect } from 'react';
import { getFrontendVersion, getBackendVersion } from '../utils/versionChecker';
import './VersionInfoModal.css';

export function VersionInfoModal({ isVisible, onClose }) {
  const [frontendVersion, setFrontendVersion] = useState(null);
  const [backendVersion, setBackendVersion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isVisible) {
      loadVersionInfo();
    }
  }, [isVisible]);

  const loadVersionInfo = async () => {
    try {
      setLoading(true);
      
      // Get frontend version (synchronous)
      const frontend = getFrontendVersion();
      setFrontendVersion(frontend);
      
      // Get backend version (asynchronous)
      const backend = await getBackendVersion();
      setBackendVersion(backend);
      
    } catch (error) {
      console.error('Error loading version info:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'unknown') return 'Unknown';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getVersionStatus = () => {
    if (!frontendVersion || !backendVersion) return 'unknown';
    
    // Check git commits if available
    if (frontendVersion.gitCommit !== 'unknown' && backendVersion.git?.hash) {
      return frontendVersion.gitCommit === backendVersion.git.hash ? 'match' : 'mismatch';
    }
    
    // Fallback to version number comparison
    return frontendVersion.version === backendVersion.version ? 'match' : 'mismatch';
  };

  const status = getVersionStatus();
  const statusColor = status === 'match' ? '#22c55e' : status === 'mismatch' ? '#ef4444' : '#6b7280';

  if (!isVisible) return null;

  return (
    <div className="version-modal-overlay">
      <div className="version-modal">
        <div className="version-modal-header">
          <h2>🚀 SAMS Deployment Information</h2>
          <button className="version-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="version-modal-content">
          {loading ? (
            <div className="version-loading">
              <div className="spinner"></div>
              <p>Loading version information...</p>
            </div>
          ) : (
            <>
              {/* Status Indicator */}
              <div className="version-status" style={{ borderColor: statusColor }}>
                <div className="status-indicator" style={{ backgroundColor: statusColor }}></div>
                <span className="status-text">
                  {status === 'match' && '✅ Frontend & Backend Versions Match'}
                  {status === 'mismatch' && '⚠️ Version Mismatch Detected'}
                  {status === 'unknown' && '❓ Version Status Unknown'}
                </span>
              </div>

              {/* Frontend Information */}
              <div className="version-section">
                <h3>🖥️ Frontend (Client)</h3>
                <div className="version-details">
                  <div className="version-row">
                    <span className="label">Version:</span>
                    <span className="value">{frontendVersion?.version || 'Unknown'}</span>
                  </div>
                  <div className="version-row">
                    <span className="label">Build Date:</span>
                    <span className="value">{formatDate(frontendVersion?.buildDate)}</span>
                  </div>
                  <div className="version-row">
                    <span className="label">Git Commit:</span>
                    <span className="value code">{frontendVersion?.gitCommit || 'Unknown'}</span>
                  </div>
                  <div className="version-row">
                    <span className="label">Environment:</span>
                    <span className="value">{frontendVersion?.environment || 'Unknown'}</span>
                  </div>
                </div>
              </div>

              {/* Backend Information */}
              <div className="version-section">
                <h3>⚙️ Backend (Server)</h3>
                <div className="version-details">
                  <div className="version-row">
                    <span className="label">Version:</span>
                    <span className="value">{backendVersion?.version || 'Unknown'}</span>
                  </div>
                  <div className="version-row">
                    <span className="label">Build Date:</span>
                    <span className="value">{formatDate(backendVersion?.buildDate)}</span>
                  </div>
                  <div className="version-row">
                    <span className="label">Git Commit:</span>
                    <span className="value code">{backendVersion?.git?.hash || 'Unknown'}</span>
                  </div>
                  {backendVersion?.error && (
                    <div className="version-row error">
                      <span className="label">Error:</span>
                      <span className="value">{backendVersion.error}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Deployment URLs */}
              <div className="version-section">
                <h3>🌐 Deployment Information</h3>
                <div className="version-details">
                  <div className="version-row">
                    <span className="label">Frontend URL:</span>
                    <span className="value code">{window.location.origin}</span>
                  </div>
                  <div className="version-row">
                    <span className="label">Backend URL:</span>
                    <span className="value code">{import.meta.env.VITE_API_BASE_URL || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        
        <div className="version-modal-footer">
          <button className="version-modal-button" onClick={onClose}>
            Continue to SAMS
          </button>
        </div>
      </div>
    </div>
  );
}
