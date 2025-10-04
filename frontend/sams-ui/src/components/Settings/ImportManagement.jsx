import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useClient } from '../../context/ClientContext';
import { config as appConfig } from '../../config';
import { getCurrentUser, getAuthInstance } from '../../firebaseClient';
import LoadingSpinner from '../common/LoadingSpinner';
import './ImportManagement.css';

export function ImportManagement({ clientId }) {
  const [config, setConfig] = useState(null);
  const [progress, setProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [customDataPath, setCustomDataPath] = useState('');
  const [dryRun, setDryRun] = useState(true); // Default to dry run for safety
  
  const { currentUser } = useAuth();
  const { selectedClient } = useClient();
  const pollIntervalRef = useRef(null);
  
  // Get authentication headers
  const getAuthHeaders = async () => {
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    if (clientId) {
      loadConfig();
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [clientId]);

  const loadConfig = async () => {
    try {
      const response = await fetch(`${appConfig.api.baseUrl}/admin/import/${clientId}/config`, {
        headers: await getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to load configuration');
      }
      
      const data = await response.json();
      setConfig(data);
      setCustomDataPath(data.dataPath || '');
    } catch (error) {
      console.error('Failed to load config:', error);
      setError('Failed to load import configuration');
    }
  };

  const handlePurge = async () => {
    const confirmMessage = `This will permanently DELETE ALL DATA for ${clientId}:\n\n• HOA Dues\n• Transactions\n• Year End Balances\n• Units\n• Vendors\n• Categories\n• Import Metadata\n\nThis action cannot be undone. Continue?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setProgress({ status: 'starting', sequence: [], components: {} });
    
    try {
      const response = await fetch(`${appConfig.api.baseUrl}/admin/import/${clientId}/purge`, {
        method: 'POST',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dryRun: dryRun
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Purge operation failed');
      }
      
      const result = await response.json();
      setProgress(result);
      
      // Check if operation is already completed
      if (result.status === 'completed') {
        setIsProcessing(false);
        // Show success message if dry run
        if (dryRun && result.components) {
          const summary = Object.entries(result.components)
            .map(([comp, info]) => `${info.step || comp}: ${info.message || info.count || 0}`)
            .join('\n');
          window.alert(`Dry run completed successfully!\n\n${summary}`);
        }
      } else {
        // Only start polling if operation is still running
        pollProgress();
      }
    } catch (error) {
      console.error('Purge failed:', error);
      setError(error.message);
      setIsProcessing(false);
    }
  };

  const handleImport = async (dryRun = false) => {
    const confirmMessage = dryRun 
      ? `DRY RUN - Import ALL DATA for ${clientId}:\n\n• Categories\n• Vendors\n• Units\n• Year End Balances\n• Transactions\n• HOA Dues\n\nFrom: ${customDataPath || config?.dataPath}\n\nThis will simulate the import without writing to the database.\n\nContinue?`
      : `Import ALL DATA for ${clientId}:\n\n• Categories\n• Vendors\n• Units\n• Year End Balances\n• Transactions\n• HOA Dues\n\nFrom: ${customDataPath || config?.dataPath}\n\nThis will import data in the correct dependency order.\n\nContinue?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setProgress({ status: 'starting', sequence: [], components: {} });
    
    try {
      const response = await fetch(`${appConfig.api.baseUrl}/admin/import/${clientId}/import`, {
        method: 'POST',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataPath: customDataPath || config?.dataPath,
          dryRun: dryRun,
          maxErrors: 3
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import operation failed');
      }
      
      const result = await response.json();
      setProgress(result);
      
        // Check if operation is already completed
        if (result.status === 'completed') {
          setIsProcessing(false);
          // Show completion summary
          if (result.components) {
            const summary = Object.entries(result.components)
              .map(([comp, info]) => {
                if (info.status === 'completed') {
                  return `${info.step}: Imported ${info.success || 0} items`;
                } else if (info.status === 'error') {
                  return `${info.step}: Error - ${info.error}`;
                }
                return `${info.step}: ${info.status}`;
              })
              .join('\n');
            window.alert(`Import completed!\n\n${summary}`);
          }
        } else {
          // Only start polling if operation is still running
          pollProgress();
        }
    } catch (error) {
      console.error('Import failed:', error);
      setError(error.message);
      setIsProcessing(false);
    }
  };

  const pollProgress = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${appConfig.api.baseUrl}/admin/import/${clientId}/progress`, {
          headers: await getAuthHeaders()
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }
        
        const data = await response.json();
        setProgress(data);
        
        if (data.status === 'completed' || data.status === 'error') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsProcessing(false);
          
          // No need to clear selections since we don't use them anymore
        }
      } catch (error) {
        console.error('Progress fetch failed:', error);
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setIsProcessing(false);
      }
    }, 1000);
  };

  // Component selection functions removed - using single import/purge operations

  const getProgressStatusClass = (status) => {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'error': return 'status-error';
      case 'running': return 'status-running';
      case 'purging': return 'status-purging';
      case 'importing': return 'status-importing';
      default: return 'status-pending';
    }
  };

  if (!config) {
    return (
      <div className="import-management">
        <div className="loading">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="import-management">
      <div className="import-section">
        {/* Data Path Configuration */}
        <div className="card">
          <div className="card-header">
            <h3>⚙️ Data Source Configuration</h3>
          </div>
          <div className="card-content">
            <div className="data-path-section">
              <label className="field-label">Data Path:</label>
              <input
                type="text"
                value={customDataPath}
                onChange={(e) => setCustomDataPath(e.target.value)}
                placeholder={config.dataPath}
                className="data-path-input"
                disabled={isProcessing}
              />
              <small className="help-text">
                Leave blank to use default: {config.dataPath}
              </small>
            </div>
          </div>
        </div>

        {/* Purge Section */}
        <div className="card">
          <div className="card-header">
            <h3>🗑️ Purge All Data</h3>
          </div>
          <div className="card-content">
            <div className="alert alert-warning">
              <strong>⚠️ Warning:</strong> This will permanently delete ALL data for {clientId}. 
              Always backup before purging production data.
            </div>
            
            <div className="operation-description">
              <p><strong>Purge order (reverse of import):</strong></p>
              <ul>
                <li>HOA Dues (first - has dependencies)</li>
                <li>Transactions (second - referenced by HOA Dues)</li>
                <li>Year End Balances (independent)</li>
                <li>Units (independent)</li>
                <li>Vendors (independent)</li>
                <li>Categories (independent)</li>
                <li>Import Metadata</li>
              </ul>
            </div>
            
            <div className="dry-run-section" style={{ margin: '15px 0' }}>
              <label className="component-item">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  disabled={isProcessing}
                />
                <span className="component-label">
                  <strong>Dry Run Mode</strong> - Show what would be deleted without actually deleting
                </span>
              </label>
            </div>
            
            <button
              className="btn btn-danger"
              onClick={handlePurge}
              disabled={isProcessing}
            >
              {isProcessing ? '🔄 Processing...' : dryRun ? '🔍 Preview Purge All Data' : '🗑️ Purge All Data'}
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="card">
          <div className="card-header">
            <h3>📥 Import All Data</h3>
          </div>
          <div className="card-content">
            <div className="operation-description">
              <p><strong>Import order (dependency-aware):</strong></p>
              <ul>
                <li>Categories (independent)</li>
                <li>Vendors (independent)</li>
                <li>Units (independent)</li>
                <li>Year End Balances (independent)</li>
                <li>Transactions (builds CrossRef for HOA transactions)</li>
                <li>HOA Dues (uses CrossRef + requires Units)</li>
              </ul>
            </div>
            
            <div className="button-group">
              <button
                className="btn btn-secondary"
                onClick={() => handleImport(true)}
                disabled={isProcessing}
              >
                {isProcessing ? '🔄 Processing...' : '🔍 Dry Run Import'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleImport(false)}
                disabled={isProcessing}
              >
                {isProcessing ? '🔄 Processing...' : '📥 Import All Data'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="alert alert-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Progress Display */}
        {progress && (
          <div className="card">
            <div className="card-header">
              <h3>📊 Operation Progress</h3>
            </div>
            <div className="card-content">
              {isProcessing && progress.status !== 'completed' && (
                <div className="progress-loading">
                  <LoadingSpinner 
                    size="large" 
                    variant="logo" 
                    message={progress.currentStep 
                      ? `Processing ${progress.currentStep}... This may take several minutes for large datasets.`
                      : "Processing operation... This may take several minutes for large datasets."
                    }
                  />
                </div>
              )}
              
              <div className="overall-status">
                <strong>Status:</strong> 
                <span className={`status-badge ${getProgressStatusClass(progress.status)}`}>
                  {progress.status}
                </span>
              </div>
              
              {progress.components && Object.keys(progress.components).length > 0 && (
                <div className="component-progress-list">
                  <h4>Component Progress:</h4>
                  {Object.entries(progress.components).map(([componentId, component]) => (
                    <div key={componentId} className="component-progress">
                      <div className="progress-header">
                        <span className="component-name">{component.step || componentId}</span>
                        <span className={`status-badge ${getProgressStatusClass(component.status)}`}>
                          {component.status}
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      {component.total > 0 && (
                        <div className="progress-bar-container">
                          <div className="progress-bar">
                            <div 
                              className="progress-bar-fill" 
                              style={{ width: `${component.percent || 0}%` }}
                            />
                          </div>
                          <span className="progress-percent">
                            {component.percent || 0}%
                          </span>
                        </div>
                      )}
                      
                      {/* Progress Details */}
                      <div className="progress-detail">
                        {component.total > 0 && (
                          <span>
                            {component.processed || 0} / {component.total}
                            {component.deleted !== undefined && ` (${component.deleted} deleted)`}
                            {component.success !== undefined && ` (${component.success} success, ${component.failed || 0} failed)`}
                          </span>
                        )}
                        {component.fileSizeKB && (
                          <span> • {component.fileSizeKB} KB</span>
                        )}
                      </div>
                      
                      {/* Messages */}
                      {component.message && (
                        <div className="progress-message">{component.message}</div>
                      )}
                      {component.error && (
                        <div className="progress-error">Error: {component.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Overall Progress Summary */}
              {progress.totalDocuments > 0 && (
                <div className="progress-summary">
                  <h4>Overall Progress:</h4>
                  <div className="progress-bar-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: `${Math.round((Object.values(progress.components || {}).reduce((sum, comp) => sum + (comp.processed || 0), 0) / progress.totalDocuments) * 100)}%` }}
                      />
                    </div>
                    <span className="progress-percent">
                      {Math.round((Object.values(progress.components || {}).reduce((sum, comp) => sum + (comp.processed || 0), 0) / progress.totalDocuments) * 100)}%
                    </span>
                  </div>
                  <div className="progress-detail">
                    {Object.values(progress.components || {}).reduce((sum, comp) => sum + (comp.processed || 0), 0)} / {progress.totalDocuments} documents
                    {progress.totalSizeKB && (
                      <span> • {progress.totalSizeKB} KB total</span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Timing Information */}
              {progress.startTime && (
                <div className="timing-info">
                  <h4>Operation Details:</h4>
                  <p><strong>Started:</strong> {new Date(progress.startTime).toLocaleString()}</p>
                  {progress.endTime && (
                    <p><strong>Completed:</strong> {new Date(progress.endTime).toLocaleString()}</p>
                  )}
                  {progress.dryRun && (
                    <p><strong>Mode:</strong> Dry Run (Preview Only)</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportManagement;