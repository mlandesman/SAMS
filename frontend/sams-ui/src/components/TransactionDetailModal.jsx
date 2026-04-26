import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons';
import { DocumentList } from './documents';
import DocumentViewer from './documents/DocumentViewer';
import { getDocument } from '../api/documents';
import { useDesktopLanguage } from '../context/DesktopLanguageContext';
import './TransactionDetailModal.css';

const TransactionDetailModal = ({ transaction, isOpen, onClose, clientId }) => {
  const { isSpanish } = useDesktopLanguage();
  const [documentViewer, setDocumentViewer] = useState({
    isOpen: false,
    documents: [],
    currentDocument: null,
    loading: false
  });
  const [thumbnailDocuments, setThumbnailDocuments] = useState([]);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false);

  // Fetch documents for thumbnails using individual API calls (no complex query)
  React.useEffect(() => {
    const fetchThumbnailDocuments = async () => {
      const docCount = getDocumentCount(transaction?.documents);
      if (docCount === 0) {
        setThumbnailDocuments([]);
        return;
      }

      setThumbnailsLoading(true);
      try {
        const documentIds = getDocumentsArray(transaction.documents);
        const actualClientId = clientId || transaction.clientId;
        
        // Fetch documents individually to avoid complex query
        const documentPromises = documentIds.map(async (docId) => {
          try {
            return await getDocument(actualClientId, docId);
          } catch (error) {
            console.warn(`Failed to fetch thumbnail for document ${docId}:`, error);
            return {
              id: docId,
              filename: `Document ${docId}`,
              mimeType: 'application/pdf'
            };
          }
        });
        
        const documents = await Promise.all(documentPromises);
        setThumbnailDocuments(documents);
      } catch (error) {
        console.error('Error fetching thumbnail documents:', error);
        setThumbnailDocuments([]);
      } finally {
        setThumbnailsLoading(false);
      }
    };

    if (transaction && isOpen) {
      fetchThumbnailDocuments();
    }
  }, [transaction, isOpen, clientId]);

  if (!isOpen || !transaction) return null;

  const readText = (value) => {
    if (value == null) return '';
    return String(value).trim();
  };

  const pickDisplayText = (localizedValue, sourceValue) => {
    if (isSpanish) {
      const localized = readText(localizedValue);
      if (localized) return localized;
    }
    return readText(sourceValue);
  };

  // Helper function to check if documents exist and get count
  const getDocumentCount = (docs) => {
    if (!docs) return 0;
    if (Array.isArray(docs)) return docs.length;
    if (typeof docs === 'object') return Object.keys(docs).length;
    return 0;
  };

  // Helper function to convert documents object to array
  const getDocumentsArray = (docs) => {
    if (!docs) return [];
    if (Array.isArray(docs)) return docs;
    if (typeof docs === 'object') return Object.values(docs);
    return [];
  };

  const handleViewDocuments = async () => {
    const docCount = getDocumentCount(transaction.documents);
    if (docCount === 0) {
      return;
    }

    setDocumentViewer(prev => ({ ...prev, loading: true, isOpen: true }));
    
    try {
      // Get document IDs from transaction object
      const documentIds = getDocumentsArray(transaction.documents);
      const actualClientId = clientId || transaction.clientId;
      
      // Fetch actual document metadata using authenticated API function
      const documentPromises = documentIds.map(async (docId) => {
        try {
          const docData = await getDocument(actualClientId, docId);
          return {
            id: docId,
            filename: docData.filename || `Document ${docId}`,
            originalName: docData.originalName || docData.filename,
            // Use the actual downloadURL from Firebase Storage
            downloadURL: docData.downloadURL,
            mimeType: docData.mimeType
          };
        } catch (error) {
          console.error(`Error fetching document ${docId}:`, error);
          return {
            id: docId,
            filename: `Document ${docId}`,
            originalName: `Document ${docId}`,
            downloadURL: null,
            mimeType: null
          };
        }
      });
      
      const documents = await Promise.all(documentPromises);
      
      setDocumentViewer({
        isOpen: true,
        documents: documents,
        currentDocument: documents[0] || null,
        loading: false
      });
    } catch (error) {
      console.error('Error preparing documents for viewing:', error);
      setDocumentViewer(prev => ({ ...prev, loading: false, isOpen: false }));
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

  /**
   * Raw Firestore timestamps reach the browser as plain objects `{ seconds, nanoseconds }`
   * (e.g. reconciliation workbench pool). `new Date(thatObject)` is Invalid Date — normalize first.
   */
  const coerceToJsDate = (dateValue) => {
    if (dateValue == null || dateValue === '') return null;
    if (dateValue instanceof Date) {
      return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      const d = new Date(dateValue);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof dateValue.toDate === 'function') {
      try {
        const d = dateValue.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    const sec = dateValue.seconds ?? dateValue._seconds;
    if (sec != null && Number.isFinite(Number(sec))) {
      const d = new Date(Number(sec) * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (dateValue.timestamp != null) return coerceToJsDate(dateValue.timestamp);
    if (dateValue.timestampValue != null) return coerceToJsDate(dateValue.timestampValue);
    return null;
  };

  // Format date for display - enriched API shapes + raw Firestore JSON
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';

    if (dateValue?.display) {
      const [month, day, year] = String(dateValue.display).split('/');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mi = parseInt(month, 10);
      const di = parseInt(day, 10);
      if (monthNames[mi - 1] && year) {
        return `${monthNames[mi - 1]} ${di}, ${year}`;
      }
    }

    if (dateValue?.unambiguous_long_date) {
      return dateValue.unambiguous_long_date;
    }

    if (dateValue?.timestamp) {
      const inner = coerceToJsDate(dateValue.timestamp);
      if (inner) {
        return inner.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    }

    const dateObj = coerceToJsDate(dateValue);
    if (!dateObj) return 'N/A';

    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format amount for display (convert cents to dollars)
  const formatAmount = (amount) => {
    const amountInCents = Number(amount || 0);
    const amountInDollars = amountInCents / 100; // Convert cents to dollars
    return amountInDollars.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="transaction-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Transaction Details</h2>
        </div>
        
        <div className="modal-content">
          <div className="detail-section">
            <div className="detail-row">
              <label>Transaction ID:</label>
              <span className="transaction-id">{transaction.id || 'N/A'}</span>
            </div>
            
            <div className="detail-row">
              <label>Date:</label>
              <span>{formatDate(transaction.date)}</span>
            </div>
            
            <div className="detail-row">
              <label>Amount:</label>
              <span className={`amount ${Number(transaction.amount?.integerValue || transaction.amount) < 0 ? 'negative' : 'positive'}`}>
                {formatAmount(transaction.amount?.integerValue || transaction.amount)}
              </span>
            </div>
            
            <div className="detail-row">
              <label>Vendor:</label>
              <span>{pickDisplayText(transaction.vendorNameLocalized, transaction.vendorName?.stringValue || transaction.vendorName || transaction.vendor) || 'N/A'}</span>
            </div>
            
            <div className="detail-row">
              <label>Category:</label>
              <span>{pickDisplayText(transaction.categoryNameLocalized || transaction.categoryLocalized, transaction.categoryName?.stringValue || transaction.categoryName || transaction.category) || 'N/A'}</span>
            </div>
            
            <div className="detail-row">
              <label>Account:</label>
              <span>{pickDisplayText(transaction.accountNameLocalized, transaction.accountName || transaction.accountType || transaction.account) || 'N/A'}</span>
            </div>
            
            <div className="detail-row">
              <label>Unit:</label>
              <span>{transaction.unitId || transaction.unit || 'N/A'}</span>
            </div>
            
            <div className="detail-row">
              <label>Payment Method:</label>
              <span>{pickDisplayText(transaction.paymentMethodLocalized, transaction.paymentMethod) || 'N/A'}</span>
            </div>
            
            {(transaction.notes || transaction.notesLocalized) && (
              <div className="detail-row notes-row">
                <label>Notes:</label>
                <div className="notes-content">{pickDisplayText(transaction.notesLocalized, transaction.notes)}</div>
              </div>
            )}
            
            {transaction.created && (
              <div className="detail-row">
                <label>Created:</label>
                <span>{formatDate(transaction.created)}</span>
              </div>
            )}
            
            {transaction.updated && (
              <div className="detail-row">
                <label>Last Updated:</label>
                <span>{formatDate(transaction.updated)}</span>
              </div>
            )}
            
            {transaction.exchangeRate && (
              <div className="detail-row">
                <label>Exchange Rate:</label>
                <span>{transaction.exchangeRate}</span>
              </div>
            )}
            
            {transaction.reference && (
              <div className="detail-row">
                <label>Reference:</label>
                <span>{transaction.reference}</span>
              </div>
            )}

            {/* Documents Section */}
            {getDocumentCount(transaction.documents) > 0 && (
              <div className="detail-row documents-row">
                <label>Documents:</label>
                <div className="documents-content">
                  {thumbnailsLoading ? (
                    <div style={{fontSize: '12px', color: '#666'}}>Loading thumbnails...</div>
                  ) : (
                    <DocumentList
                      transactionId={null}
                      clientId={clientId || transaction.clientId}
                      documents={thumbnailDocuments}
                      mode="inline"
                      showControls={false}
                    />
                  )}
                  <button 
                    className="view-documents-button"
                    onClick={handleViewDocuments}
                    disabled={documentViewer.loading}
                  >
                    <FontAwesomeIcon icon={faEye} />
                    {documentViewer.loading ? ' Loading...' : ' View Documents'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
        
        <div className="modal-footer">
          <button className="close-modal-button" onClick={onClose}>
            Close
          </button>
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
    </div>
  );
};

export default TransactionDetailModal;
