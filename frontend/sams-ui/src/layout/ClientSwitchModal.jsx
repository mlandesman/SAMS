import React, { useState, useEffect } from 'react';
import { fetchClients } from '../utils/fetchClients.js';
import { useClient } from '../context/ClientContext.jsx';
import PropTypes from 'prop-types';
import '../styles/InputModal.css'; // Generic modal styles
import './ClientSwitchModal.css'; // Specific styles for this modal
import { getClient } from '../api/client'; // Import getClient
import { useNavigate } from 'react-router-dom';

function ClientSwitchModal({ onClose }) {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [preview, setPreview] = useState(null);
  const { setClient } = useClient(); // Access setClient from context
  const navigate = useNavigate(); // Get the navigate function

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
    const match = clients.find((c) => c.id === selectedId);
    setPreview(match || null);
  }, [selectedId, clients]);

  // Auto-proceed for single-client users
  useEffect(() => {
    if (clients.length === 1 && preview) {
      // Automatically proceed with the single client
      handleConfirm();
    }
  }, [clients.length, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (preview) {
      try {
        const clientData = await getClient(preview.id);
        setClient(clientData); // Update client context with fetched client data
        
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

  return (
    <div className="modal-overlay">
      <div className="modal client-switch-modal">
        <h2 className="modal-title">Select a Client</h2>
        <div className="modal-content">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">-- Select Client --</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.id} {/* Display doc.id (short name) */}
              </option>
            ))}
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
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleConfirm} disabled={!preview} className="primary">
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