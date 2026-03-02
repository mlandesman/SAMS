/**
 * DocumentList component for displaying transaction documents
 */

import React, { useState, useEffect } from 'react';
import DocumentThumbnail from './DocumentThumbnail';
import DocumentViewer from './DocumentViewer';
import { getTransactionDocuments } from '../../api/documents';
import './DocumentList.css';

const DocumentList = ({ 
  clientId, 
  transactionId, 
  documents: propDocuments,
  mode = 'default', // 'default', 'preview', 'inline'
  showTitle = true,
  showControls = true,
  thumbnailSize = 'medium',
  onDocumentClick = () => {},
  onDocumentDownload = () => {}
}) => {
  const [documents, setDocuments] = useState(propDocuments || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Fetch documents if transactionId is provided but no documents prop
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!transactionId || propDocuments) return;

      setLoading(true);
      setError(null);

      try {
        console.log(`📋 [MAIN] Fetching documents for transaction: ${transactionId}`);
        const fetchedDocuments = await getTransactionDocuments(clientId, transactionId);
        setDocuments(fetchedDocuments);
        console.log(`✅ [MAIN] Loaded ${fetchedDocuments.length} documents`);
      } catch (err) {
        console.error('❌ [MAIN] Error fetching documents:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [clientId, transactionId, propDocuments]);

  // Update documents when prop changes
  useEffect(() => {
    if (propDocuments) {
      setDocuments(propDocuments);
    }
  }, [propDocuments]);

  // Handle document click based on mode
  const handleDocumentClick = (document) => {
    if (mode === 'preview') {
      // In preview mode, don't open viewer for local files
      console.log('📎 Preview mode: Document clicked', document.name);
      return;
    }
    
    setSelectedDocument(document);
    setViewerOpen(true);
    onDocumentClick(document);
  };

  // Handle document download based on mode
  const handleDocumentDownload = (document) => {
    if (mode === 'preview') {
      // In preview mode, can't download local files
      console.log('📎 Preview mode: Download not available for local files');
      return;
    }
    
    if (document.downloadURL) {
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = document.downloadURL;
      link.download = document.filename || document.originalName || 'document';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      onDocumentDownload(document);
    }
  };

  // Close viewer
  const closeViewer = () => {
    setViewerOpen(false);
    setSelectedDocument(null);
  };

  if (loading) {
    return (
      <div className="document-list-loading">
        <div className="spinner"></div>
        <p>Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-list-error">
        <p>Error loading documents: {error}</p>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="document-list-empty">
        <p>No documents attached</p>
      </div>
    );
  }

  return (
    <div className={`document-list ${mode}`}>
      {showTitle && (
        <h4 className="document-list-title">
          {mode === 'preview' ? 'Documents to Upload' : 'Attached Documents'} ({documents.length})
        </h4>
      )}
      
      <div className={`document-thumbnails-grid ${thumbnailSize} ${mode}`}>
        {documents.map((document, index) => (
          <DocumentThumbnail
            key={document.id || `preview-${index}`}
            document={document}
            size={thumbnailSize}
            mode={mode}
            showControls={showControls}
            onClick={handleDocumentClick}
            onDownload={handleDocumentDownload}
          />
        ))}
      </div>

      {/* Document Viewer - only show in default mode */}
      {mode === 'default' && (
        <DocumentViewer
          document={selectedDocument}
          documents={documents}
          isOpen={viewerOpen}
          onClose={closeViewer}
          onDownload={handleDocumentDownload}
        />
      )}
    </div>
  );
};

export default DocumentList;
