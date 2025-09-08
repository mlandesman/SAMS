import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faDollarSign, 
  faCalendarAlt, 
  faTag, 
  faBuilding, 
  faCreditCard, 
  faUniversity,
  faEye,
  faFileAlt,
  faIdCard
} from '@fortawesome/free-solid-svg-icons';
import DocumentViewer from './documents/DocumentViewer';
import { getDocument } from '../api/documents';
import './TransactionConfirmationModal.css';

const TransactionConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  transactionData, 
  uploadedDocuments
}) => {
  const [documentViewer, setDocumentViewer] = useState({
    isOpen: false,
    documents: [],
    currentDocument: null,
    loading: false
  });

  if (!isOpen) return null;

  // Format amount for display
  const formatAmount = (amount) => {
    const num = Number(amount || 0);
    return num.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    });
  };

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle document viewing
  const handleViewDocuments = async () => {
    if (!uploadedDocuments || uploadedDocuments.length === 0) return;
    
    setDocumentViewer(prev => ({ ...prev, loading: true }));
    
    try {
      // For now, create mock document objects since we don't have actual document IDs yet
      // In a real implementation, you'd fetch these from the API
      const documents = uploadedDocuments.map((doc, index) => ({
        id: `doc-${index}`,
        filename: doc.name,
        originalName: doc.name,
        downloadURL: doc.url || '#', // Would be actual URL in real implementation
        mimeType: doc.type
      }));
      
      setDocumentViewer({
        isOpen: true,
        documents: documents,
        currentDocument: documents[0] || null,
        loading: false
      });
    } catch (error) {
      console.error('Error preparing documents for viewing:', error);
      setDocumentViewer(prev => ({ ...prev, loading: false }));
    }
  };

  const closeDocumentViewer = () => {
    setDocumentViewer({
      isOpen: false,
      documents: [],
      currentDocument: null,
      loading: false
    });
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="confirmation-modal professional">
          {/* Success Header */}
          <div className="success-header">
            <div className="success-icon">
              <div className="checkmark-circle">
                ✓
              </div>
            </div>
            <h2>Expense Submitted!</h2>
            <p className="success-message">Your expense has been successfully recorded.</p>
            <button className="close-button" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          {/* Transaction Details Card */}
          <div className="modal-content">
            <div className="transaction-details-card">
              <h3>Transaction Details</h3>
              
              <div className="details-grid">
                <div className="detail-item">
                  <div className="detail-icon">
                    <FontAwesomeIcon icon={faDollarSign} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">Amount</span>
                    <span className="detail-value amount negative">
                      {formatAmount(transactionData.amount)}
                    </span>
                  </div>
                </div>
                
                <div className="detail-item">
                  <div className="detail-icon">
                    <FontAwesomeIcon icon={faCalendarAlt} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">Date</span>
                    <span className="detail-value">{formatDate(transactionData.date)}</span>
                  </div>
                </div>
                
                <div className="detail-item">
                  <div className="detail-icon">
                    <FontAwesomeIcon icon={faTag} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">Category</span>
                    <span className="detail-value category-badge">{transactionData.category}</span>
                  </div>
                </div>
                
                <div className="detail-item">
                  <div className="detail-icon">
                    <FontAwesomeIcon icon={faBuilding} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">Vendor</span>
                    <span className="detail-value">{transactionData.vendor}</span>
                  </div>
                </div>
                
                <div className="detail-item">
                  <div className="detail-icon">
                    <FontAwesomeIcon icon={faCreditCard} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">Payment Method</span>
                    <span className="detail-value">{transactionData.paymentMethod}</span>
                  </div>
                </div>
                
                <div className="detail-item">
                  <div className="detail-icon">
                    <FontAwesomeIcon icon={faUniversity} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">Account</span>
                    <span className="detail-value">{transactionData.accountType}</span>
                  </div>
                </div>
                
                {/* Transaction ID - The crucial piece! */}
                {transactionData.transactionId && (
                  <div className="detail-item transaction-id-item">
                    <div className="detail-icon">
                      <FontAwesomeIcon icon={faIdCard} />
                    </div>
                    <div className="detail-content">
                      <span className="detail-label">Transaction ID</span>
                      <span className="detail-value transaction-id">{transactionData.transactionId}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Documents Section */}
            {uploadedDocuments && uploadedDocuments.length > 0 && (
              <div className="documents-section">
                <div className="documents-header">
                  <h3>
                    <FontAwesomeIcon icon={faFileAlt} />
                    Documents ({uploadedDocuments.length})
                  </h3>
                  <button 
                    className="view-all-documents-btn"
                    onClick={handleViewDocuments}
                    disabled={documentViewer.loading}
                  >
                    <FontAwesomeIcon icon={faEye} />
                    {documentViewer.loading ? ' Loading...' : ' View All'}
                  </button>
                </div>
                
                <div className="documents-list">
                  {uploadedDocuments.map((file, index) => (
                    <div 
                      key={index} 
                      className="document-item clickable"
                      onClick={() => handleViewDocuments()}
                    >
                      <div className="document-icon">
                        <FontAwesomeIcon 
                          icon={file.type.includes('image/') ? faFileAlt : faFileAlt} 
                          className={file.type.includes('image/') ? 'image-file' : 'document-file'}
                        />
                      </div>
                      <div className="document-info">
                        <div className="document-name">{file.name}</div>
                        <div className="document-size">
                          {(file.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <div className="document-action">
                        <FontAwesomeIcon icon={faEye} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
            <button className="btn-primary" onClick={onConfirm}>
              Continue
            </button>
          </div>
        </div>
      </div>
      
      {/* Document Viewer Modal */}
      {documentViewer.isOpen && (
        <DocumentViewer
          document={documentViewer.currentDocument}
          documents={documentViewer.documents}
          isOpen={documentViewer.isOpen}
          onClose={closeDocumentViewer}
        />
      )}
    </>
  );
};

export default TransactionConfirmationModal;
