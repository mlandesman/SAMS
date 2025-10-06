import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useClient } from '../../context/ClientContext';
import { config as appConfig } from '../../config';
import { getCurrentUser, getAuthInstance } from '../../firebaseClient';
import LoadingSpinner from '../common/LoadingSpinner';
import { InfoTooltip } from './InfoTooltip';
import './ImportManagement.css';

export function ImportManagement({ clientId }) {
  const [config, setConfig] = useState(null);
  const [progress, setProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [customDataPath, setCustomDataPath] = useState('');
  const [dryRun, setDryRun] = useState(true); // Default to dry run for safety
  const [clientPreview, setClientPreview] = useState(null);
  const [onboardingPath, setOnboardingPath] = useState('');
  
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
    
    // Check for onboarding mode
    const onboardingData = localStorage.getItem('onboardingClient');
    if (onboardingData) {
      try {
        const onboarding = JSON.parse(onboardingData);
        setCustomDataPath(onboarding.dataPath);
        setClientPreview(onboarding.preview);
        setOnboardingPath(onboarding.dataPath);
        console.log('📋 Onboarding mode detected for client:', onboarding.clientId);
        
        // Clear it so it doesn't persist
        localStorage.removeItem('onboardingClient');
      } catch (e) {
        console.error('Error parsing onboarding data:', e);
      }
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

  const handlePreviewClient = async () => {
    if (!onboardingPath) {
      setError('Please enter a data path');
      return;
    }
    
    try {
      setError(null);
      const response = await fetch(`${appConfig.api.baseUrl}/admin/import/preview?dataPath=${encodeURIComponent(onboardingPath)}`, {
        headers: await getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to preview client data');
      }
      
      const preview = await response.json();
      setClientPreview(preview);
      console.log('Client preview loaded:', preview);
    } catch (err) {
      console.error('Failed to preview client:', err);
      setError(err.message);
      setClientPreview(null);
    }
  };

  const handleOnboardClient = async (dryRun = false) => {
    if (!clientPreview) {
      setError('Please preview the client data first');
      return;
    }
    
    const confirmMessage = dryRun
      ? `DRY RUN - Onboard NEW client:\n\n• Client ID: ${clientPreview.clientId}\n• Name: ${clientPreview.displayName}\n• Type: ${clientPreview.clientType}\n• Units: ${clientPreview.totalUnits}\n\nThis will simulate onboarding without writing to the database.\n\nContinue?`
      : `Onboard NEW client:\n\n• Client ID: ${clientPreview.clientId}\n• Name: ${clientPreview.displayName}\n• Type: ${clientPreview.clientType}\n• Units: ${clientPreview.totalUnits}\n\nData to import:\n• Config: ${clientPreview.dataCounts.config} items\n• Payment Methods: ${clientPreview.dataCounts.paymentMethods} items\n• Categories: ${clientPreview.dataCounts.categories} items\n• Vendors: ${clientPreview.dataCounts.vendors} items\n• Units: ${clientPreview.dataCounts.units} items\n• Transactions: ${clientPreview.dataCounts.transactions} items\n• HOA Dues: ${clientPreview.dataCounts.hoadues} items\n\nThis will CREATE a new client in the database.\n\nContinue?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    setIsProcessing(true);
    setProgress({ status: 'starting', sequence: [], components: {} });
    
    try {
      const response = await fetch(`${appConfig.api.baseUrl}/admin/import/onboard`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          dataPath: onboardingPath,
          clientId: clientPreview?.clientId, // Pass the clientId from the preview
          dryRun,
          maxErrors: 3
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to onboard client');
      }
      
      const result = await response.json();
      console.log('Onboarding started:', result);
      setProgress(result);
      
      // Start polling for progress (using the new client ID from preview)
      pollIntervalRef.current = setInterval(() => pollProgress(clientPreview.clientId), 1000);
    } catch (err) {
      console.error('Failed to onboard client:', err);
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const handlePurge = async () => {
    const confirmMessage = `This will permanently DELETE ALL DATA for ${clientId}:\n\n• Client Document (Recursively deletes ALL subcollections)\n  - HOA Dues\n  - Transactions\n  - Year End Balances\n  - Units\n  - Vendors\n  - Categories\n  - Payment Methods\n  - Config Collection\n  - All other subcollections\n• Import Metadata\n\nThis action cannot be undone. Continue?`;
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
    // If we have a client preview, we're onboarding a new client - use onboard endpoint
    const isOnboarding = !!clientPreview;
    const targetClientId = isOnboarding ? clientPreview.clientId : clientId;
    // For onboarding, always use Firebase Storage; for regular imports, use configured dataPath
    const dataPath = isOnboarding ? 'firebase_storage' : (customDataPath || config?.dataPath);
    
    const confirmMessage = dryRun 
      ? `DRY RUN - ${isOnboarding ? 'ONBOARD NEW CLIENT' : 'Import ALL DATA for'} ${targetClientId}:\n\n• Client Document\n• Config Collection\n• Payment Methods\n• Categories\n• Vendors\n• Units\n• Year End Balances\n• Transactions\n• HOA Dues\n\nFrom: ${dataPath}\n\nThis will simulate the import without writing to the database.\n\nContinue?`
      : `${isOnboarding ? 'ONBOARD NEW CLIENT' : 'Import ALL DATA for'} ${targetClientId}:\n\n• Client Document\n• Config Collection\n• Payment Methods\n• Categories\n• Vendors\n• Units\n• Year End Balances\n• Transactions\n• HOA Dues\n\nFrom: ${dataPath}\n\n${isOnboarding ? 'This will CREATE a new client and import all data.' : 'This will import data in the correct dependency order.'}\n\nContinue?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setProgress({ status: 'starting', sequence: [], components: {} });
    
    try {
      // Use onboard endpoint if onboarding, otherwise use regular import
      const endpoint = isOnboarding 
        ? `${appConfig.api.baseUrl}/admin/import/onboard`
        : `${appConfig.api.baseUrl}/admin/import/${clientId}/import`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataPath: dataPath,
          clientId: isOnboarding ? clientPreview?.clientId : clientId, // Pass clientId for onboarding or regular import
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
      
      // Start polling for progress using the correct clientId
      pollIntervalRef.current = setInterval(() => pollProgress(targetClientId), 1000);
      
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
      {/* Progress Display - Sticky at top when active */}
      {(progress || isProcessing) && (
        <div className="progress-section-sticky">
          <div className="card progress-card">
            <div className="card-header">
              <h3>📊 Operation Progress</h3>
            </div>
            <div className="card-content">
              {isProcessing && progress?.status !== 'completed' && (
                <div className="progress-loading">
                  <LoadingSpinner 
                    size="large" 
                    variant="logo" 
                    message={progress?.currentStep 
                      ? `Processing ${progress.currentStep}... This may take several minutes for large datasets.`
                      : "Processing operation... This may take several minutes for large datasets."
                    }
                  />
                </div>
              )}
              
              <div className="overall-status">
                <strong>Status:</strong> 
                <span className={`status-badge ${getProgressStatusClass(progress?.status || 'pending')}`}>
                  {progress?.status || 'PENDING'}
                </span>
              </div>
              
              {progress?.components && Object.keys(progress.components).length > 0 && (
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
                      
                      <div className="progress-detail">
                        {component.total > 0 && (
                          <span>
                            {component.processed || 0} / {component.total}
                            {component.deleted !== undefined && ` (${component.deleted} deleted)`}
                          </span>
                        )}
                      </div>
                      
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
              
              {progress?.totalDocuments > 0 && (
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
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="import-section">
        {/* Onboarding Banner */}
        {clientPreview && (
          <div className="alert alert-info" style={{ background: '#e0f2fe', border: '2px solid #0ea5e9', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>🆕 Onboarding New Client</h3>
            <p style={{ margin: '5px 0' }}>
              <strong>Client ID:</strong> {clientPreview.clientId} | 
              <strong> Name:</strong> {clientPreview.displayName} | 
              <strong> Type:</strong> {clientPreview.clientType}
            </p>
            <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>
              ℹ️ Data path has been pre-filled below. Click <strong>"Import All Data"</strong> to create this client and import all data.
            </p>
          </div>
        )}

        {/* Client Onboarding - NEW CLIENT */}
        <div className="card onboarding-card" style={{ display: 'none' }}>
          <div className="card-header">
            <h3>
              🆕 Onboard New Client
              <InfoTooltip 
                title="Client Onboarding"
                content={
                  <div>
                    <p>Import a NEW client that doesn't exist in the system yet.</p>
                    <p><strong>Process:</strong></p>
                    <ul>
                      <li>Enter path to client data folder</li>
                      <li>Preview client info from Client.json</li>
                      <li>Confirm and import all data</li>
                    </ul>
                    <p>The Client ID is read from Client.json automatically.</p>
                  </div>
                }
              />
            </h3>
          </div>
          <div className="card-content">
            <div className="data-path-section">
              <label className="field-label">Data Path for New Client:</label>
              <input
                type="text"
                value={onboardingPath}
                onChange={(e) => setOnboardingPath(e.target.value)}
                placeholder="/path/to/clientdata (e.g., /path/to/MTCdata)"
                className="data-path-input"
                disabled={isProcessing}
              />
              <button
                className="btn btn-secondary"
                onClick={handlePreviewClient}
                disabled={isProcessing || !onboardingPath}
                style={{ marginTop: '10px' }}
              >
                👁️ Preview Client Data
              </button>
            </div>
            
            {clientPreview && (
              <div className="client-preview">
                <h4>📋 Client Information Preview:</h4>
                <div className="preview-grid">
                  <div className="preview-item">
                    <strong>Client ID:</strong> {clientPreview.clientId}
                  </div>
                  <div className="preview-item">
                    <strong>Name:</strong> {clientPreview.displayName}
                  </div>
                  <div className="preview-item">
                    <strong>Type:</strong> {clientPreview.clientType}
                  </div>
                  <div className="preview-item">
                    <strong>Units:</strong> {clientPreview.totalUnits}
                  </div>
                  <div className="preview-item">
                    <strong>Currency:</strong> {clientPreview.preview?.currency}
                  </div>
                  <div className="preview-item">
                    <strong>Accounts:</strong> {clientPreview.preview?.accounts}
                  </div>
                </div>
                
                <h4>📦 Data Files to Import:</h4>
                <div className="data-counts">
                  {clientPreview.dataCounts ? Object.entries(clientPreview.dataCounts).map(([key, count]) => (
                    <div key={key} className="data-count-item">
                      <span className="data-label">{key}:</span>
                      <span className="data-value">{count}</span>
                    </div>
                  )) : (
                    <div className="data-count-item">
                      <span className="data-label">Loading data counts...</span>
                    </div>
                  )}
                </div>
                
                <div className="button-group" style={{ marginTop: '20px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleOnboardClient(true)}
                    disabled={isProcessing}
                  >
                    🔍 Dry Run Onboard
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleOnboardClient(false)}
                    disabled={isProcessing}
                  >
                    🆕 Onboard Client
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Purge and Import Sections - Side by Side */}
        <div className="operations-grid" style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          gap: '30px', 
          marginBottom: '20px',
          width: '100%',
          alignItems: 'stretch'
        }}>
          {/* Purge Section */}
          <div className="card" style={{ flex: 1, minWidth: '300px', width: '100%' }}>
          <div className="card-header">
            <h3>
              🗑️ Purge All Data
              <InfoTooltip 
                title="Purge Process Details"
                content={
                  <div>
                    <p><strong>Two-step recursive deletion:</strong></p>
                    <ul>
                      <li><strong>Client Document</strong> - Recursively deletes ALL subcollections: HOA Dues, Transactions, Year End Balances, Units, Vendors, Categories, Payment Methods, Config, and all nested data</li>
                      <li><strong>Import Metadata</strong> - Removes tracking data</li>
                    </ul>
                    <p>Real-time progress tracking ensures complete cleanup with no ghost documents.</p>
                  </div>
                }
              />
            </h3>
          </div>
          <div className="card-content">
            <div className="alert alert-warning">
              <strong>⚠️ Warning:</strong> This will permanently delete ALL data for {clientId}. 
              Always backup before purging production data.
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
          <div className="card" style={{ flex: 1, minWidth: '300px', width: '100%' }}>
          <div className="card-header">
            <h3>
              📥 Import All Data
              <InfoTooltip 
                title="Import Order (Dependency-Aware)"
                content={
                  <div>
                    <ul>
                      <li>Client Document</li>
                      <li>Config Collection</li>
                      <li>Payment Methods</li>
                      <li>Categories</li>
                      <li>Vendors</li>
                      <li>Units</li>
                      <li>Year End Balances</li>
                      <li>Transactions (builds CrossRef)</li>
                      <li>HOA Dues (requires CrossRef + Units)</li>
                    </ul>
                  </div>
                }
              />
            </h3>
          </div>
          <div className="card-content">
            
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
        </div>

      </div>
    </div>
  );
}

export default ImportManagement;