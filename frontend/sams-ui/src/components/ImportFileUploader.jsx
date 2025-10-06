/**
 * ImportFileUploader component for client onboarding
 * Based on DocumentUploader but specifically for JSON import files
 */

import React, { useState, useRef } from 'react';
import './ImportFileUploader.css';

const ImportFileUploader = ({ 
  onFilesSelected, 
  selectedFiles, 
  onClientDataParsed,
  mode = 'deferred',
  disabled = false,
  className = ''
}) => {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // File validation for JSON files only
  const validateFile = (file) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (!file.name.endsWith('.json')) {
      throw new Error('Only JSON files are allowed for import');
    }
    if (file.size > maxSize) {
      throw new Error(`File size too large. Maximum size is 50MB.`);
    }
    return true;
  };

  // Parse client.json when selected
  const handleFilesSelected = async (files) => {
    try {
      console.log('📁 ImportFileUploader: Processing files:', files);
      
      // Filter to only JSON files
      const jsonFiles = files.filter(file => {
        const isJson = file.name.endsWith('.json');
        console.log(`📁 File ${file.name}: isJson=${isJson}, size=${file.size}`);
        return isJson;
      });
      
      console.log('📁 Filtered JSON files:', jsonFiles.map(f => f.name));
      
      // Validate all files
      try {
        jsonFiles.forEach(file => validateFile(file));
      } catch (error) {
        console.error('❌ File validation failed:', error);
        alert(error.message);
        return;
      }
      
      console.log('📁 All files validated successfully');
      
      // Call the callback to update parent state
      onFilesSelected(jsonFiles);
      
      // Find and parse client.json (required for clientId)
      const clientJsonFile = jsonFiles.find(f => f.name === 'Client.json');
      if (clientJsonFile) {
        try {
          console.log('📁 Parsing Client.json...');
          const text = await clientJsonFile.text();
          console.log('📁 Client.json text length:', text.length);
          
          const clientData = JSON.parse(text);
          console.log('📁 Parsed Client.json:', clientData);
          
          onClientDataParsed(clientData);
          console.log('📁 Client data parsed and passed to parent');
        } catch (error) {
          console.error('❌ Failed to parse Client.json:', error);
          alert(`Failed to parse Client.json: ${error.message}`);
        }
      } else {
        console.warn('⚠️ No Client.json found in uploaded files');
        // Don't clear clientPreview here - let user upload Client.json
      }
      
    } catch (error) {
      console.error('❌ Error in handleFilesSelected:', error);
      alert(`Error processing files: ${error.message}`);
    }
  };

  // Handle file selection/upload
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    await handleFilesSelected(Array.from(files));
  };

  // File input change handler
  const handleFileInputChange = (event) => {
    const files = event.target.files;
    if (files) {
      handleFileUpload(files);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (event) => {
    event.preventDefault();
    if (!disabled) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    
    if (disabled) return;

    const files = event.dataTransfer.files;
    if (files) {
      handleFileUpload(files);
    }
  };

  // Trigger file input
  const triggerFileInput = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Remove file from selection
  const removeFile = (index) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    onFilesSelected(updatedFiles);
    
    // If we removed Client.json, clear the parsed data
    const removedFile = selectedFiles[index];
    if (removedFile.name === 'Client.json') {
      onClientDataParsed(null);
    }
  };

  return (
    <div className={`import-file-uploader ${className}`}>
      <div className="upload-section">
        <div 
          className={`drop-zone ${dragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple={true}
            accept=".json"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            disabled={disabled}
          />
          
          <div className="upload-prompt">
            <div className="upload-icon">📁</div>
            <p>
              <strong>Click to upload</strong> or drag and drop
            </p>
            <p className="file-types">JSON files only (max 50MB each)</p>
            <p className="file-note">Required: Client.json</p>
          </div>
        </div>
      </div>

      {/* Display selected files */}
      {selectedFiles && selectedFiles.length > 0 && (
        <div className="selected-files">
          <h4>Selected Import Files ({selectedFiles.length})</h4>
          <div className="file-list">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="file-item">
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                  {file.name === 'Client.json' && (
                    <span className="required-indicator">Required</span>
                  )}
                </div>
                <button 
                  className="remove-file"
                  onClick={() => removeFile(index)}
                  type="button"
                  disabled={disabled}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportFileUploader;
