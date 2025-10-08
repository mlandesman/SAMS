import React, { useState, useEffect } from 'react';
import { fetchClients } from '../utils/fetchClients.js';
import { useClient } from '../context/ClientContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import PropTypes from 'prop-types';
import '../styles/InputModal.css'; // Generic modal styles
import './ClientSwitchModal.css'; // Specific styles for this modal
import { getClient } from '../api/client'; // Import getClient
import { useNavigate } from 'react-router-dom';
import { config as appConfig } from '../config';
import { getAuthInstance } from '../firebaseClient';
import ImportFileUploader, { validateRequiredImportFiles } from './ImportFileUploader';
import { uploadImportFilesWithProgress, deleteImportFiles } from '../api/importStorage';

function ClientSwitchModal({ onClose }) {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [preview, setPreview] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [clientPreview, setClientPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const { selectedClient, setClient } = useClient(); // Access current client and setClient from context
  const { samsUser } = useAuth();
  const navigate = useNavigate(); // Get the navigate function
  
  const isSuperAdmin = samsUser?.globalRole === 'superAdmin' || samsUser?.email === 'michael@landesman.com';

  useEffect(() => {
    async function loadClients() {
      const result = await fetchClients();
      setClients(result);
      
      // Auto-select single client (PWA logic)
      if (result.length === 1) {
        setSelectedId(result[0].id);
      }
    }
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedId === '__CREATE_NEW__') {
      setPreview(null);
      setShowOnboarding(true);
    } else {
      const match = clients.find((c) => c.id === selectedId);
      setPreview(match || null);
      setShowOnboarding(false);
    }
  }, [selectedId, clients]);

  // Auto-proceed for single-client users (but not for SuperAdmins - they might want to create)
  useEffect(() => {
    if (clients.length === 1 && preview && !isSuperAdmin) {
      // Automatically proceed with the single client
      handleConfirm();
    }
  }, [clients.length, preview, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const getAuthHeaders = async () => {
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const handlePreviewClient = async () => {
    if (!selectedFiles?.length) {
      alert('Please upload client data files first');
      return;
    }
    
    if (!clientPreview) {
      alert('Could not parse Client.json from uploaded files');
      return;
    }
    
    setIsLoading(true);
    try {
      // Use the SAME logic as previewClientData function but with uploaded files
      const dataCounts = {};
      const dataFiles = [
        { key: 'config', file: 'config.json' },
        { key: 'paymentMethods', file: 'paymentMethods.json' },
        { key: 'categories', file: 'Categories.json' },
        { key: 'vendors', file: 'Vendors.json' },
        { key: 'units', file: 'Units.json' },
        { key: 'transactions', file: 'Transactions.json' },
        { key: 'hoadues', file: 'HOADues.json' },
        { key: 'yearEndBalances', file: 'yearEndBalances.json' },
        { key: 'autoCategorize', file: 'AutoCategorize.json' },
        { key: 'unitSizes', file: 'UnitSizes.json' },
        { key: 'users', file: 'Users.json' },
        { key: 'hoaTransactionCrossRef', file: 'HOA_Transaction_CrossRef.json' }
      ];
      
      for (const { key, file } of dataFiles) {
        const fileData = selectedFiles.find(f => f.name === file);
        if (fileData) {
          try {
            const text = await fileData.text();
            const data = JSON.parse(text);
            dataCounts[key] = Array.isArray(data) ? data.length : Object.keys(data).length;
          } catch (e) {
            dataCounts[key] = 'Error reading file';
          }
        } else {
          dataCounts[key] = 0;
        }
      }
      
      // Update clientPreview with dataCounts
      const updatedPreview = {
        ...clientPreview,
        dataCounts,
        dataPath: 'firebase_storage' // Updated to indicate Firebase Storage
      };
      
      setClientPreview(updatedPreview);
      console.log('Client preview loaded from uploaded files:', updatedPreview);
    } catch (err) {
      console.error('Failed to preview client:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardClient = async () => {
    if (!clientPreview || !selectedFiles?.length) {
      alert('Please preview the client data first');
      return;
    }
    
    // Validate that all required files are present
    try {
      validateRequiredImportFiles(selectedFiles);
    } catch (error) {
      alert(`Cannot start import: ${error.message}\n\nPlease upload all required files before onboarding.`);
      setIsLoading(false);
      return;
    }
    
    // Ensure dataCounts are populated before proceeding
    if (!clientPreview.dataCounts) {
      console.log('📊 DataCounts not found, generating preview first...');
      await handlePreviewClient();
    }
    
    try {
      setIsLoading(true);
      
      // 2. Clean up any existing files before uploading new ones
      try {
        await deleteImportFiles(clientPreview.clientId);
        console.log('✅ Cleaned up existing import files');
      } catch (error) {
        console.warn('⚠️ Could not clean up existing files (this is OK for first upload):', error.message);
      }
      
      // 3. Upload files to /imports/{clientId}/ with progress
      await uploadImportFilesWithProgress(clientPreview.clientId, selectedFiles);
      
      // 4. Start import process (SAME as current)
      await startImportProcess(clientPreview.clientId);
      
      // 5. Store onboarding info with progress polling flag
      localStorage.setItem('onboardingClient', JSON.stringify({
        clientId: clientPreview.clientId,
        displayName: clientPreview.displayName,
        dataPath: 'firebase_storage', // Updated to indicate Firebase Storage
        preview: clientPreview,
        startProgressPolling: true  // NEW: Signal to start polling immediately
      }));
      
      // 6. Create temp client and navigate (SAME as current)
      const tempClient = {
        id: clientPreview.clientId,
        basicInfo: {
          fullName: clientPreview.displayName,
          clientId: clientPreview.clientId,
          displayName: clientPreview.displayName,
          clientType: clientPreview.clientType,
          status: 'onboarding'
        },
        branding: {
          logoUrl: null,
          iconUrl: null
        },
        configuration: {
          timezone: 'America/Cancun',
          currency: clientPreview.preview?.currency || 'MXN',
          language: 'es-MX',
          dateFormat: 'DD/MM/YYYY'
        },
        contactInfo: {
          primaryEmail: '',
          phone: '',
          address: {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: 'MX'
          }
        },
        _isOnboarding: true
      };
      
      setClient(tempClient);
      onClose();
      navigate('/settings');
      
    } catch (error) {
      console.error('Onboarding failed:', error);
      alert(`Onboarding failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startImportProcess = async (clientId) => {
    try {
      console.log(`🚀 Starting import process for client: ${clientId}`);
      
      const response = await fetch(
        `${appConfig.api.baseUrl}/admin/import/onboard`,
        {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            dataPath: 'firebase_storage', // Indicate we're using Firebase Storage
            clientId: clientPreview.clientId, // Pass the clientId from the parsed Client.json
            dryRun: false,
            maxErrors: 3
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start import process');
      }
      
      const result = await response.json();
      console.log('Import process started:', result);
      
      return result;
    } catch (error) {
      console.error('Failed to start import process:', error);
      throw error;
    }
  };

  const handleConfirm = async () => {
    if (preview) {
      try {
        // Clear all sessionStorage (including HOA cache) when switching clients
        console.log('🧹 Clearing cache for client switch...');
        sessionStorage.clear();
        console.log('✅ Session storage cleared');
        
        const clientData = await getClient(preview.id);
        
        console.log('🔍 Mocked client data for domain testing:', clientData);
        console.log('🔍 Mocked client configuration:', clientData.configuration);
        setClient(clientData); // Update client context with mocked client data
        
        // Reset the transaction filter to yearToDate when changing clients
        localStorage.setItem('transactionFilter', 'yearToDate');
        
        onClose(); // Close the modal
        
        // Always navigate to dashboard after selecting a client
        navigate('/dashboard');
        
      } catch (error) {
        console.error('Failed to fetch client data:', error);
        // Handle error appropriately (e.g., display an error message)
      }
    }
  };

  // Onboarding UI - CHECK THIS FIRST before loading screen
  if (showOnboarding) {
    return (
      <div className="modal-overlay">
        <div className="modal client-switch-modal onboarding-modal">
          <h2 className="modal-title">🆕 Onboard New Client</h2>
          <div className="modal-content">
            <div className="onboarding-section">
              <label className="field-label">Upload Client Data Files:</label>
              <ImportFileUploader
                onFilesSelected={(files) => {
                  try {
                    console.log('📁 ClientSwitchModal: Files selected:', files);
                    setSelectedFiles(files);
                    setUploadError(null);
                  } catch (error) {
                    console.error('❌ ClientSwitchModal: Error handling file selection:', error);
                    setUploadError(error.message);
                  }
                }}
                selectedFiles={selectedFiles}
                onClientDataParsed={(clientData) => {
                  try {
                    console.log('📁 ClientSwitchModal: Client data parsed:', clientData);
                    
                    // Extract client information using the same logic as backend previewClientData
                    const extractedClientId = clientData.clientId || clientData._id || clientData.basicInfo?.clientId;
                    const displayName = clientData.basicInfo?.displayName || clientData.displayName || extractedClientId;
                    const fullName = clientData.basicInfo?.fullName || clientData.fullName;
                    const clientType = clientData.basicInfo?.clientType || clientData.type;
                    const totalUnits = clientData.propertyInfo?.totalUnits || 0;
                    
                    // Create structured clientPreview object
                    const structuredPreview = {
                      clientId: extractedClientId,
                      displayName,
                      fullName,
                      clientType,
                      totalUnits,
                      preview: {
                        accounts: clientData.accounts?.length || 0,
                        currency: clientData.configuration?.currency || 'MXN',
                        timezone: clientData.configuration?.timezone || 'America/Cancun'
                      },
                      // Keep original data for reference
                      originalData: clientData
                    };
                    
                    console.log('📁 ClientSwitchModal: Structured preview:', structuredPreview);
                    setClientPreview(structuredPreview);
                    setUploadError(null);
                  } catch (error) {
                    console.error('❌ ClientSwitchModal: Error handling client data:', error);
                    setUploadError(error.message);
                  }
                }}
                mode="deferred"
                disabled={isLoading}
              />
              <button
                onClick={handlePreviewClient}
                disabled={isLoading || !selectedFiles?.length}
                className="primary"
                style={{ marginBottom: '15px' }}
              >
                {isLoading ? '⏳ Loading...' : '👁️ Preview Client'}
              </button>
            </div>

            {clientPreview && (
              <div className="client-preview onboarding-preview">
                <h4>📋 Client Information:</h4>
                <div style={{ marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
                  <p><strong>Client ID:</strong> {clientPreview.clientId}</p>
                  <p><strong>Name:</strong> {clientPreview.displayName}</p>
                  <p><strong>Type:</strong> {clientPreview.clientType}</p>
                  <p><strong>Units:</strong> {clientPreview.totalUnits}</p>
                  <p><strong>Currency:</strong> {clientPreview.preview?.currency}</p>
                </div>
                
                <h4>📦 Data to Import:</h4>
                <div style={{ fontSize: '14px', marginBottom: '15px' }}>
                  {clientPreview.dataCounts && Object.entries(clientPreview.dataCounts).map(([key, count]) => (
                    <div key={key} style={{ padding: '4px 0' }}>
                      <strong>{key}:</strong> {count} items
                    </div>
                  ))}
                  {!clientPreview.dataCounts && (
                    <div style={{ padding: '4px 0', color: '#666' }}>
                      Click "Preview Client" to see data counts
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="modal-buttons">
            <button onClick={() => { 
              setShowOnboarding(false); 
              setClientPreview(null);
              setSelectedFiles([]); // Clear uploaded files
              setSelectedId(''); // Reset dropdown selection
            }}>
              ← Back to Clients
            </button>
            <button 
              onClick={handleOnboardClient} 
              disabled={!clientPreview || isLoading}
              className="primary"
            >
              {isLoading ? '⏳ Creating...' : '🆕 Onboard Client'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading message for single-client auto-selection (but not when creating new client)
  if (clients.length === 1 && !preview && selectedId !== '__CREATE_NEW__') {
    return (
      <div className="modal-overlay">
        <div className="modal client-switch-modal">
          <h2 className="modal-title">Loading Client...</h2>
          <div className="modal-content">
            <p>Redirecting to your client...</p>
          </div>
        </div>
      </div>
    );
  }

  // Normal client selection UI
  return (
    <div className="modal-overlay">
      <div className="modal client-switch-modal">
        <h2 className="modal-title">Select a Client</h2>
        <div className="modal-content">
          {!selectedClient && (
            <div className="info-message" style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
              <strong>Note:</strong> You must select a client to continue using the application.
            </div>
          )}
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">-- Select Client --</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.id} {/* Display doc.id (short name) */}
              </option>
            ))}
            {isSuperAdmin && (
              <option value="__CREATE_NEW__" style={{ fontWeight: 'bold', color: '#10b981' }}>
                🆕 - New Client -
              </option>
            )}
          </select>

          {preview && (
            <div className="client-preview">
              <img 
                src={preview.summary?.logoUrl || preview.branding?.logoUrl || preview.logoUrl} 
                alt={preview.summary?.fullName || preview.fullName} 
                className="modal-logo" 
              />
              <h4>{preview.summary?.fullName || preview.fullName}</h4>
              {(preview.description || preview.summary?.description || preview.basicInfo?.description) && (
                <p className="client-description">{preview.description || preview.summary?.description || preview.basicInfo?.description}</p>
              )}
            </div>
          )}
        </div>

        <div className="modal-buttons">
          <button 
            onClick={onClose} 
            disabled={!selectedClient}
            title={!selectedClient ? "You must select a client to continue" : ""}
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm} 
            disabled={!preview || selectedId === '__CREATE_NEW__'} 
            className="primary"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

ClientSwitchModal.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default ClientSwitchModal;