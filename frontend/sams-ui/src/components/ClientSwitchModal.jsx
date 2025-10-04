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

function ClientSwitchModal({ onClose }) {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [preview, setPreview] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingPath, setOnboardingPath] = useState('');
  const [clientPreview, setClientPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
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
    if (!onboardingPath) {
      alert('Please enter a data path');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `${appConfig.api.baseUrl}/admin/import/preview?dataPath=${encodeURIComponent(onboardingPath)}`,
        { headers: await getAuthHeaders() }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to preview client data');
      }
      
      const preview = await response.json();
      setClientPreview(preview);
      console.log('Client preview loaded:', preview);
    } catch (err) {
      console.error('Failed to preview client:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardClient = async () => {
    if (!clientPreview) {
      alert('Please preview the client data first');
      return;
    }
    
    const confirmMessage = `Onboard NEW client:\n\n` +
      `• Client ID: ${clientPreview.clientId}\n` +
      `• Name: ${clientPreview.displayName}\n` +
      `• Type: ${clientPreview.clientType}\n` +
      `• Units: ${clientPreview.totalUnits}\n\n` +
      `This will CREATE a new client in the database.\n\nContinue?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${appConfig.api.baseUrl}/admin/import/onboard`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          dataPath: onboardingPath,
          dryRun: false,
          maxErrors: 3
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to onboard client');
      }
      
      const result = await response.json();
      console.log('Onboarding started:', result);
      
      // Wait a moment for the client to be created
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fetch the new client and select it
      const clientData = await getClient(clientPreview.clientId);
      setClient(clientData);
      
      // Close modal and navigate to dashboard
      onClose();
      navigate('/dashboard');
      
      alert(`Client ${clientPreview.clientId} is being imported. Check Data Management for progress.`);
      
    } catch (err) {
      console.error('Failed to onboard client:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
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

  // Show loading message for single-client auto-selection
  if (clients.length === 1 && !preview) {
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

  // Onboarding UI
  if (showOnboarding) {
    return (
      <div className="modal-overlay">
        <div className="modal client-switch-modal onboarding-modal">
          <h2 className="modal-title">🆕 Onboard New Client</h2>
          <div className="modal-content">
            <div className="onboarding-section">
              <label className="field-label">Data Path:</label>
              <input
                type="text"
                value={onboardingPath}
                onChange={(e) => setOnboardingPath(e.target.value)}
                placeholder="/path/to/clientdata (e.g., /path/to/MTCdata)"
                className="data-path-input"
                style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
              />
              <button
                onClick={handlePreviewClient}
                disabled={isLoading || !onboardingPath}
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
                  {Object.entries(clientPreview.dataCounts).map(([key, count]) => (
                    <div key={key} style={{ padding: '4px 0' }}>
                      <strong>{key}:</strong> {count} items
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-buttons">
            <button onClick={() => { 
              setShowOnboarding(false); 
              setClientPreview(null);
              setSelectedId(''); // Reset dropdown selection
              setOnboardingPath(''); // Clear path
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