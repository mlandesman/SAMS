import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons';
import { DocumentList } from './documents';
import DocumentViewer from './documents/DocumentViewer';
import { getDocument } from '../api/documents';
import { pickLocalizedDisplayText } from '../utils/localizedDisplayText';
import { useDesktopLanguage } from '../context/DesktopLanguageContext';
import { useDesktopStrings } from '../hooks/useDesktopStrings';
import './TransactionDetailModal.css';

const TransactionDetailModal = ({ transaction, isOpen, onClose, clientId }) => {
  const { isSpanish, language } = useDesktopLanguage();
  const { t } = useDesktopStrings();
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

  const readDateText = (value) => {
    if (value == null) return '';
    return String(value).trim();
  };

  const coerceCalendarIsoToDate = (isoLike) => {
    const m = String(isoLike || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const [, year, month, day] = m;
    const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const parseDisplayDate = (displayValue) => {
    const m = String(displayValue || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const [, month, day, year] = m;
    const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const coerceToDateFromPayload = (dateValue) => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    if (typeof dateValue === 'number') {
      const d = new Date(dateValue);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof dateValue === 'string') {
      const s = dateValue.trim();
      if (!s) return null;
      const calendar = coerceCalendarIsoToDate(s.slice(0, 10));
      if (calendar) return calendar;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof dateValue.toDate === 'function') {
      const d = dateValue.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
    const sec = dateValue.seconds ?? dateValue._seconds ?? dateValue.timestamp?._seconds ?? null;
    if (sec != null) {
      const d = new Date(Number(sec) * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const nestedDisplay = readDateText(dateValue.display);
    if (nestedDisplay) {
      const parsed = parseDisplayDate(nestedDisplay);
      if (parsed) return parsed;
    }
    const nestedIso = readDateText(dateValue.ISO_8601) || readDateText(dateValue.iso);
    if (nestedIso) {
      const parsed = coerceCalendarIsoToDate(nestedIso.slice(0, 10));
      if (parsed) return parsed;
    }
    if (dateValue.timestamp) return coerceToDateFromPayload(dateValue.timestamp);
    if (dateValue.timestampValue) return coerceToDateFromPayload(dateValue.timestampValue);
    return null;
  };

  const formatLocalizedSpanishDate = (dateValue) => {
    const localized = readDateText(dateValue?.displayLocalized);
    if (localized) return localized;
    const parsed = coerceToDateFromPayload(dateValue);
    if (!parsed) return '';
    return parsed.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Cancun'
    });
  };

  const formatLocalizedDate = (dateValue) => {
    const parsed = coerceToDateFromPayload(dateValue);
    if (!parsed) return '';
    return parsed.toLocaleDateString(language === 'ES' ? 'es-MX' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Cancun'
    });
  };

  const getDateFromTransactionId = (transactionId) => {
    const rawId = String(transactionId || '').trim();
    const match = rawId.match(/^(\d{4})-(\d{2})-(\d{2})_/);
    if (!match) return null;
    const [, year, month, day] = match;
    return `${year}-${month}-${day}`;
  };

  const formatIsoCalendarDate = (isoDate) => {
    const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const [, year, month, day] = m;
    const safeDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
    if (Number.isNaN(safeDate.getTime())) return '';
    return safeDate.toLocaleDateString(language === 'ES' ? 'es-MX' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Cancun'
    });
  };

  // Format date for display using backend DateService payload (no client-side reparsing).
  const formatDate = (dateValue) => {
    if (!dateValue) return t('tx.detail.na');

    if (typeof dateValue === 'string') {
      const calendar = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
      if (isSpanish) {
        const localized = formatLocalizedSpanishDate(calendar);
        if (localized) return localized;
      }
      const localized = formatLocalizedDate(calendar);
      if (localized) return localized;
      return calendar;
    }

    if (isSpanish) {
      const localized = formatLocalizedSpanishDate(dateValue);
      if (localized) return localized;
    }

    const canonicalDisplay = readDateText(dateValue?.unambiguous_long_date)
      || readDateText(dateValue?.display);

    if (canonicalDisplay) return canonicalDisplay;

    const localized = formatLocalizedDate(dateValue);
    if (localized) return localized;

    if (dateValue?.timestamp) return formatDate(dateValue.timestamp);
    if (dateValue?.timestampValue) return formatDate(dateValue.timestampValue);
    return t('tx.detail.na');
  };

  const getTransactionDateDisplay = () => {
    const transactionDateDisplay = formatDate(transaction?.date);
    if (transactionDateDisplay && transactionDateDisplay !== t('tx.detail.na')) return transactionDateDisplay;

    const idDate = getDateFromTransactionId(transaction?.id);
    const idDateDisplay = formatIsoCalendarDate(idDate);
    if (idDateDisplay) return idDateDisplay;
    return t('tx.detail.na');
  };

  // Format amount for display (convert cents to dollars)
  const formatAmount = (amount) => {
    const amountInCents = Number(amount || 0);
    const amountInDollars = amountInCents / 100; // Convert cents to dollars
    return amountInDollars.toLocaleString(language === 'ES' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    });
  };

  const getAllocationAmountCents = (amountValue) => {
    const rawAmount = amountValue?.integerValue ?? amountValue;
    const parsed = Number(rawAmount || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatAllocationAmount = (amountValue) => {
    const amountInDollars = getAllocationAmountCents(amountValue) / 100;
    return amountInDollars.toLocaleString(language === 'ES' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="transaction-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('tx.detail.title')}</h2>
        </div>
        
        <div className="modal-content">
          <div className="detail-section">
            <div className="detail-row">
              <label>{t('tx.detail.transactionId')}:</label>
              <span className="transaction-id">{transaction.id || t('tx.detail.na')}</span>
            </div>
            
            <div className="detail-row">
              <label>{t('tx.detail.date')}:</label>
              <span>{getTransactionDateDisplay()}</span>
            </div>
            
            <div className="detail-row">
              <label>{t('tx.detail.amount')}:</label>
              <span className={`amount ${Number(transaction.amount?.integerValue || transaction.amount) < 0 ? 'negative' : 'positive'}`}>
                {formatAmount(transaction.amount?.integerValue || transaction.amount)}
              </span>
            </div>
            
            <div className="detail-row">
              <label>{t('tx.detail.vendor')}:</label>
              <span>{pickLocalizedDisplayText(transaction.vendorNameLocalized, transaction.vendorName?.stringValue || transaction.vendorName || transaction.vendor, isSpanish) || t('tx.detail.na')}</span>
            </div>
            
            <div className="detail-row">
              <label>{t('tx.detail.category')}:</label>
              <span>{pickLocalizedDisplayText(transaction.categoryNameLocalized || transaction.categoryLocalized, transaction.categoryName?.stringValue || transaction.categoryName || transaction.category, isSpanish) || t('tx.detail.na')}</span>
            </div>
            
            <div className="detail-row">
              <label>{t('tx.detail.account')}:</label>
              <span>{pickLocalizedDisplayText(transaction.accountNameLocalized, transaction.accountName || transaction.accountType || transaction.account, isSpanish) || t('tx.detail.na')}</span>
            </div>
            
            <div className="detail-row">
              <label>{t('tx.detail.unit')}:</label>
              <span>{transaction.unitId || transaction.unit || t('tx.detail.na')}</span>
            </div>
            
            <div className="detail-row">
              <label>{t('tx.detail.paymentMethod')}:</label>
              <span>{pickLocalizedDisplayText(transaction.paymentMethodLocalized, transaction.paymentMethod, isSpanish) || t('tx.detail.na')}</span>
            </div>
            
            {(transaction.notes || transaction.notesLocalized) && (
              <div className="detail-row notes-row">
                <label>{t('tx.detail.notes')}:</label>
                <div className="notes-content">{pickLocalizedDisplayText(transaction.notesLocalized, transaction.notes, isSpanish)}</div>
              </div>
            )}

            {Array.isArray(transaction.allocations) && transaction.allocations.length > 0 && (
              <div className="detail-row split-allocations-row">
                <div className="split-allocations-content">
                  <div className="split-allocations-title">{t('tx.detail.splitAllocations')}</div>
                  <div className="split-allocations-table">
                    <div className="split-allocations-header">
                      <span>{t('tx.detail.allocationCategory')}</span>
                      <span>{t('tx.detail.allocationNotes')}</span>
                      <span>{t('tx.detail.allocationAmount')}</span>
                    </div>
                    {transaction.allocations.map((allocation, index) => (
                      <div key={allocation.id || `${allocation.categoryId || 'allocation'}-${index}`} className="split-allocation-row">
                        <span>{allocation.categoryName || allocation.category || t('tx.detail.na')}</span>
                        <span>{allocation.notes || '-'}</span>
                        <span className={`split-allocation-amount ${getAllocationAmountCents(allocation.amount) < 0 ? 'negative' : 'positive'}`}>
                          {formatAllocationAmount(allocation.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {transaction.created && (
              <div className="detail-row">
                <label>{t('tx.detail.created')}:</label>
                <span>{formatDate(transaction.created)}</span>
              </div>
            )}
            
            {transaction.updated && (
              <div className="detail-row">
                <label>{t('tx.detail.updated')}:</label>
                <span>{formatDate(transaction.updated)}</span>
              </div>
            )}
            
            {transaction.exchangeRate && (
              <div className="detail-row">
                <label>{t('tx.detail.exchangeRate')}:</label>
                <span>{transaction.exchangeRate}</span>
              </div>
            )}
            
            {transaction.reference && (
              <div className="detail-row">
                <label>{t('tx.detail.reference')}:</label>
                <span>{transaction.reference}</span>
              </div>
            )}

            {/* Documents Section */}
            {getDocumentCount(transaction.documents) > 0 && (
              <div className="detail-row documents-row">
                <label>{t('tx.detail.documents')}:</label>
                <div className="documents-content">
                  {thumbnailsLoading ? (
                    <div style={{fontSize: '12px', color: '#666'}}>{t('tx.detail.loadingThumbnails')}</div>
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
                    {documentViewer.loading ? ` ${t('tx.detail.loading')}` : ` ${t('tx.detail.viewDocuments')}`}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
        
        <div className="modal-footer">
          <button className="close-modal-button" onClick={onClose}>
            {t('tx.detail.close')}
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
