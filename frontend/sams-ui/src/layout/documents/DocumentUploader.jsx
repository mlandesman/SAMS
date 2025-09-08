/**
 * DocumentUploader component for main frontend
 * Adapted from PWA version with React optimizations
 */

import React, { useState, useRef } from 'react';
import { uploadDocument } from '../../api/documents';
import './DocumentUploader.css';

const DocumentUploader = ({ 
  clientId, 
  onUploadComplete = () => {}, 
  onUploadError = () => {},
  // New props for deferred mode (UnifiedExpenseEntry)
  onFilesSelected = null,
  selectedFiles = null,
  mode = 'immediate', // 'immediate' or 'deferred'
  multiple = true,
  disabled = false,
  className = ''
}) => {
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // File validation
  const validateFile = (file) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} not allowed. Please use PDF, JPG, or PNG files.`);
    }

    if (file.size > maxSize) {
      throw new Error(`File size too large. Maximum size is 10MB.`);
    }

    return true;
  };

  // Handle file selection/upload
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    // Validate files first
    try {
      Array.from(files).forEach(file => validateFile(file));
    } catch (error) {
      onUploadError(error);
      return;
    }

    // For deferred mode, just store the files without uploading
    if (mode === 'deferred' && onFilesSelected) {
      const newFiles = Array.from(files);
      console.log('📁 [DEFERRED] Files selected for later upload:', newFiles.map(f => f.name));
      
      // Append to existing selectedFiles instead of replacing them
      const existingFiles = selectedFiles || [];
      const combinedFiles = [...existingFiles, ...newFiles];
      console.log('📁 [DEFERRED] Total files now:', combinedFiles.map(f => f.name));
      
      onFilesSelected(combinedFiles);
      return;
    }

    // For immediate mode, upload right away
    if (!clientId) {
      const error = new Error('No client selected. Cannot upload documents.');
      console.error('❌ DocumentUploader: No clientId provided for immediate upload');
      onUploadError(error);
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        try {
          const metadata = {
            documentType: 'receipt',
            category: 'expense_receipt',
            uploadedFrom: 'main-frontend'
          };

          console.log(`📤 [IMMEDIATE] Uploading document: ${file.name} for client: ${clientId}`);
          const response = await uploadDocument(clientId, file, metadata);
          
          console.log(`✅ [IMMEDIATE] Document uploaded successfully:`, response);
          
          return {
            id: response.documentId,
            filename: file.name,
            size: file.size,
            uploadedAt: new Date(),
            downloadURL: response.downloadURL,
            file: file // Keep for preview
          };
        } catch (error) {
          console.error(`❌ [IMMEDIATE] Upload failed for ${file.name}:`, error);
          onUploadError(error);
          throw error;
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      const successful = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);

      if (successful.length > 0) {
        const newDocuments = [...uploadedDocuments, ...successful];
        setUploadedDocuments(newDocuments);
        onUploadComplete(newDocuments);
        console.log(`✅ [MAIN] Successfully uploaded ${successful.length} documents`);
      }

      const failed = results.filter(result => result.status === 'rejected').length;
      if (failed > 0) {
        console.warn(`⚠️ [MAIN] ${failed} documents failed to upload`);
      }

    } catch (error) {
      console.error('❌ [MAIN] Upload process failed:', error);
      onUploadError(error.message);
    } finally {
      setUploading(false);
    }
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
    if (!disabled && !uploading) {
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
    
    if (disabled || uploading) return;

    const files = event.dataTransfer.files;
    if (files) {
      handleFileUpload(files);
    }
  };

  // Remove uploaded document
  const removeDocument = (documentId) => {
    const updated = uploadedDocuments.filter(doc => doc.id !== documentId);
    setUploadedDocuments(updated);
    onUploadComplete(updated);
  };

  // Trigger file input
  const triggerFileInput = () => {
    if (!disabled && !uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`document-uploader ${className}`}>
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
            multiple={multiple}
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            disabled={disabled || uploading}
          />
          
          {uploading ? (
            <div className="upload-status">
              <div className="spinner"></div>
              <p>Uploading documents...</p>
            </div>
          ) : (
            <div className="upload-prompt">
              <div className="upload-icon">📄</div>
              <p>
                <strong>Click to upload</strong> or drag and drop
              </p>
              <p className="file-types">PDF, JPG, PNG (max 10MB each)</p>
            </div>
          )}
        </div>
      </div>

      {/* Display uploaded documents (immediate mode) */}
      {uploadedDocuments.length > 0 && mode === 'immediate' && (
        <div className="uploaded-documents">
          <h4>Uploaded Documents ({uploadedDocuments.length})</h4>
          <div className="document-list">
            {uploadedDocuments.map((doc) => (
              <div key={doc.id} className="document-item">
                <div className="document-info">
                  <span className="document-name">{doc.filename}</span>
                  <span className="document-size">
                    {(doc.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button 
                  className="remove-document"
                  onClick={() => removeDocument(doc.id)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Display selected files (deferred mode) */}
      {selectedFiles && selectedFiles.length > 0 && mode === 'deferred' && (
        <div className="selected-documents">
          <h4>Selected Documents ({selectedFiles.length})</h4>
          <div className="document-list">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="document-item">
                <div className="document-info">
                  <span className="document-name">{file.name}</span>
                  <span className="document-size">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button 
                  className="remove-document"
                  onClick={() => {
                    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
                    onFilesSelected(updatedFiles);
                  }}
                  type="button"
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

export default DocumentUploader;
