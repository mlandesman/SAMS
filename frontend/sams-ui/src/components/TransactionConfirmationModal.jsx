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
import { useDesktopStrings } from '../hooks/useDesktopStrings';
import './TransactionConfirmationModal.css';

const TransactionConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  transactionData, 
  uploadedDocuments
}) => {
  const { t } = useDesktopStrings();
  // Monitor expense submission success
  if (isOpen && transactionData) {
    console.log('✅ Expense transaction submitted successfully:', transactionData.amount, transactionData.category);
  }
  
  const [documentViewer, setDocumentViewer] = useState({
    isOpen: false,
    documents: [],
    currentDocument: null,
    loading: false
  });
  
  const [modalHidden, setModalHidden] = useState(false);

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

  // Format date for display - handle pre-formatted dates from API
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    
    // If already formatted from API (has display property), use it
    if (dateValue?.display) {
      // Convert MM/DD/YYYY to MMM DD, YYYY format
      const [month, day, year] = dateValue.display.split('/');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
    }
    
    // Fallback for unformatted dates (shouldn't happen with new API)
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle document viewing with real document URLs
  const handleViewDocuments = async () => {
    if (!uploadedDocuments || uploadedDocuments.length === 0) return;
    
    // For now, always show the helpful alert since DocumentViewer integration needs work
    alert(`${t('txConfirm.documentViewingUnavailable')}\n\n${t('txConfirm.documentViewingSteps', {
      docs: uploadedDocuments.map(d => d.name).join(', ')
    })}`);
    return;
  };

  const closeDocumentViewer = () => {
    setDocumentViewer({
      isOpen: false,
      documents: [],
      currentDocument: null,
      loading: false
    });
    
    // Show the confirmation modal again when DocumentViewer closes
    console.log('📄 DocumentViewer closed, showing confirmation modal again');
    setModalHidden(false);
  };

  return (
    <>
      {/* Only show confirmation modal when not hidden */}
      {!modalHidden && (
        <div className="modal-overlay">
          <div className="confirmation-modal professional">
          {/* Success Header */}
          <div className="success-header">
            <div className="success-icon">
              <div className="checkmark-circle">
                ✓
              </div>
            </div>
            <h2>{t('txConfirm.expenseSubmitted')}</h2>
            <p className="success-message">{t('txConfirm.expenseRecorded')}</p>
            <button className="close-button" onClick={onConfirm || onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          {/* Transaction Details Card */}
          <div className="modal-content">
            <div className="transaction-details-card">
              <h3>{t('txConfirm.transactionDetails')}</h3>
              
              <div className="details-grid">
                <div className="detail-item">
                  <div className="detail-icon">
                    <FontAwesomeIcon icon={faDollarSign} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">{t('txConfirm.amount')}</span>
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
                    <span className="detail-label">{t('txConfirm.date')}</span>
                    <span className="detail-value">{formatDate(transactionData.date)}</span>
                  </div>
                </div>
                
                <div className="detail-item">
                  <div className="detail-icon">
                    <FontAwesomeIcon icon={faTag} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">{t('txConfirm.category')}</span>
                    <span className="detail-value category-badge">{transactionData.category}</span>
                  </div>
                </div>
                
                <div className="detail-item">
                  <div className="detail-icon">
                    <FontAwesomeIcon icon={faBuilding} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">{t('txConfirm.vendor')}</span>
                    <span className="detail-value">{transactionData.vendor}</span>
                  </div>
                </div>
                
                <div className="detail-item">
                  <div className="detail-icon">
                    <FontAwesomeIcon icon={faCreditCard} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">{t('txConfirm.paymentMethod')}</span>
                    <span className="detail-value">{transactionData.paymentMethod}</span>
                  </div>
                </div>
                
                <div className="detail-item">
                  <div className="detail-icon">
                    <FontAwesomeIcon icon={faUniversity} />
                  </div>
                  <div className="detail-content">
                    <span className="detail-label">{t('txConfirm.account')}</span>
                    <span className="detail-value">{transactionData.account}</span>
                  </div>
                </div>
                
                {/* Transaction ID - The crucial piece! */}
                {transactionData.transactionId && (
                  <div className="detail-item transaction-id-item">
                    <div className="detail-icon">
                      <FontAwesomeIcon icon={faIdCard} />
                    </div>
                    <div className="detail-content">
                      <span className="detail-label">{t('txConfirm.transactionId')}</span>
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
                    {t('txConfirm.documents', { count: uploadedDocuments.length })}
                  </h3>
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
                          icon={faFileAlt} 
                          className={(file.type || '').includes('image/') ? 'image-file' : 'document-file'}
                        />
                      </div>
                      <div className="document-info">
                        <div className="document-name">{file.name}</div>
                        <div className="document-size">
                          {file.size ? (file.size / 1024).toFixed(1) : '0'} KB
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
            <button className="btn-primary" onClick={onConfirm || onClose}>
              {t('txConfirm.close')}
            </button>
          </div>
        </div>
      </div>
      )}
      
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
