import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import DocumentViewer from './documents/DocumentViewer';
import { getDocument } from '../api/documents';
import { databaseFieldMappings } from '../utils/databaseFieldMappings';
import { pickLocalizedDisplayText, readDisplayText } from '../utils/localizedDisplayText';
import { useDesktopLanguage } from '../context/DesktopLanguageContext';
import { useDesktopStrings } from '../hooks/useDesktopStrings';
import './TransactionTable.css';

function formatClearedDateLabel(c) {
  if (c == null || c === '') return '';
  if (typeof c === 'string') return c.slice(0, 10);
  if (typeof c.toDate === 'function') {
    try {
      return c.toDate().toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }
  return String(c);
}

/** clearedDate set when a session is accepted (ISO period end). */
function clearedTooltip(transaction, t) {
  const c = transaction?.clearedDate;
  if (c == null || c === '') {
    return t('tx.table.clearedTooltip.notCleared');
  }
  const label = formatClearedDateLabel(c);
  return label
    ? t('tx.table.clearedTooltip.clearedOn', { date: label })
    : t('tx.table.clearedTooltip.clearedNoDate');
}

function TransactionTable({ transactions = [], selectedId = null, onSelectTransaction, onDoubleClickTransaction, clientId }) {
  const { isSpanish } = useDesktopLanguage();
  const { t, language } = useDesktopStrings();

  const dateLocale = language === 'ES' ? 'es-MX' : 'en-US';

  const coerceDate = (dateValue) => {
    if (!dateValue) return null;
    const raw = dateValue.ISO_8601 || dateValue.iso || dateValue.timestampValue || dateValue.raw || dateValue;
    if (typeof raw?.toDate === 'function') {
      try {
        return raw.toDate();
      } catch {
        return null;
      }
    }
    if (raw?.seconds || raw?._seconds) {
      const seconds = Number(raw.seconds ?? raw._seconds);
      return Number.isFinite(seconds) ? new Date(seconds * 1000) : null;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatRowDate = (tx) => {
    const localized = readDisplayText(tx.dateDisplayLocalized || tx.date?.displayLocalized || tx.created?.displayLocalized);
    if (localized) return localized;
    const dateObj = coerceDate(tx.date) || coerceDate(tx.created);
    if (dateObj) {
      return dateObj.toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return readDisplayText(tx.date?.unambiguous_long_date || tx.created?.unambiguous_long_date || tx.date?.display || tx.created?.display);
  };
  
  // Helper function to determine display based on amount sign
  const getAmountDisplay = (transaction) => {
    const amount = transaction.amount || 0;
    const isPositive = amount >= 0;
    
    return {
      isPositive,
      color: isPositive ? '#198754' : '#dc3545', // Green for positive, red for negative
      prefix: isPositive ? '' : '-', // No + for positive, show - for negative
      fontWeight: isPositive ? 'bold' : 'normal'
    };
  };
  
  // Helper function to check if documents exist and get count
  const getDocumentCount = (docs) => {
    if (!docs) return 0;
    if (Array.isArray(docs)) return docs.length;
    if (typeof docs === 'object') return Object.keys(docs).length;
    return 0;
  };

  // Debug: Log transactions with documents
  React.useEffect(() => {
    const transactionsWithDocs = transactions.filter(tx => getDocumentCount(tx.documents) > 0);
    if (transactionsWithDocs.length > 0) {
      console.log('TransactionTable - Transactions with documents:', transactionsWithDocs.length);
    }
  }, [transactions]);
  const [documentViewer, setDocumentViewer] = useState({
    isOpen: false,
    documents: [],
    currentDocument: null,
    loading: false
  });

  // State for managing expanded split transactions
  const [expandedSplits, setExpandedSplits] = useState(new Set());

  // Helper function to convert documents object to array
  const getDocumentsArray = (docs) => {
    if (!docs) return [];
    if (Array.isArray(docs)) return docs;
    if (typeof docs === 'object') return Object.values(docs);
    return [];
  };

  const handleDocumentClick = async (transaction, event) => {
    event.stopPropagation(); // Prevent row selection
    
    if (getDocumentCount(transaction.documents) === 0) {
      return;
    }

    setDocumentViewer(prev => ({ ...prev, loading: true, isOpen: true }));
    
    try {
      // Get document IDs from transaction object
      const documentIds = getDocumentsArray(transaction.documents);
      
      // Fetch actual document metadata using authenticated API function
      const documentPromises = documentIds.map(async (docId) => {
        try {
          const docData = await getDocument(clientId, docId);
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

  // Helper functions for split transactions
  const isSplitTransaction = (transaction) => {
    return transaction.categoryName === "-Split-" && 
           transaction.allocations && 
           Array.isArray(transaction.allocations) && 
           transaction.allocations.length > 0;
  };

  const toggleSplitExpansion = (transactionId, e) => {
    e.stopPropagation(); // Prevent row selection when clicking expand icon
    setExpandedSplits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const renderCategoryCell = (transaction) => {
    if (isSplitTransaction(transaction)) {
      const isExpanded = expandedSplits.has(transaction.id);
      return (
        <div className="split-category-container">
          <div className="split-category-header" onClick={(e) => toggleSplitExpansion(transaction.id, e)}>
            <FontAwesomeIcon 
              icon={isExpanded ? faChevronDown : faChevronRight} 
              className="split-chevron"
            />
            <span className="split-category-text">-Split-</span>
          </div>
          {isExpanded && (
            <div className="split-allocations">
              {transaction.allocations.map((allocation, index) => (
                <div key={index} className="split-allocation-item">
                  <span className="allocation-category">{allocation.categoryName}</span>
                  <span className="allocation-amount">
                    {databaseFieldMappings.formatCurrency(allocation.amount, transaction.currency || 'USD', true)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    // Regular single-category transaction
    return pickLocalizedDisplayText(
      transaction.categoryNameLocalized || transaction.categoryLocalized,
      transaction.categoryName || transaction.category,
      isSpanish
    );
  };

  return (
    <div className="transaction-section">
      <div className="transaction-table-container">
        <table className="transaction-table">
          <thead>
            <tr>
              <th
                className="txn-cleared-column"
                scope="col"
                title={t('tx.table.clearedTitle')}
              >
                {t('tx.table.clearedShort')}
              </th>
              <th className="date-column">{t('tx.table.date')}</th>
              <th className="vendor-column">{t('tx.table.vendor')}</th>
              <th className="category-column">{t('tx.table.category')}</th>
              <th className="unit-column">{t('tx.table.unit')}</th>
              <th className="amount-column" style={{textAlign: 'right'}}>{t('tx.table.amount')}</th>
              <th className="account-column">{t('tx.table.account')}</th>
              <th className="notes-column">{t('tx.table.notes')}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => (
              <tr 
                key={tx.id || index}
                id={`txn-row-${tx.id}`} // Add ID for direct DOM selection
                className={`${index % 2 === 0 ? 'even' : 'odd'} ${tx.id === selectedId ? 'selected-row' : ''}`}
                onClick={() => {
                  // Clear highlight class from all rows when selecting a transaction
                  document.querySelectorAll('.highlight-row').forEach(el => {
                    el.classList.remove('highlight-row');
                  });
                  
                  // If we're clicking on the already selected transaction, don't do anything
                  // This prevents deselection when clicking on a highlighted row
                  if (tx.id !== selectedId) {
                    onSelectTransaction(tx);
                  }
                }}
                onDoubleClick={() => {
                  if (onDoubleClickTransaction) {
                    onDoubleClickTransaction(tx);
                  }
                }}
                style={{ cursor: 'pointer' }}
                title={t('tx.table.doubleClickDetails')}
              >
                <td
                  className="txn-cleared-column"
                  title={clearedTooltip(tx, t)}
                  aria-label={tx.clearedDate ? t('tx.table.cleared') : t('tx.table.notCleared')}
                >
                  {tx.clearedDate ? (
                    <span className="txn-cleared-mark" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <span className="txn-cleared-empty" aria-hidden="true">
                      ◦
                    </span>
                  )}
                </td>
                <td className="date-column">{formatRowDate(tx)}</td>
                <td className="vendor-column">{pickLocalizedDisplayText(tx.vendorNameLocalized, tx.vendorName || tx.vendor, isSpanish)}</td>
                <td className="category-column">{renderCategoryCell(tx)}</td>
                <td className="unit-column">{tx.unitId || tx.unit || ''}</td>
                <td className="amount-column amount-cell" style={{ 
                  color: getAmountDisplay(tx).color,
                  fontWeight: getAmountDisplay(tx).fontWeight
                }}>
                  {getAmountDisplay(tx).prefix}{databaseFieldMappings.formatCurrency(
                    Math.abs(tx.amount || 0), // Always show positive amount
                    tx.currency || 'USD',
                    true // Show cents (centavos)
                  )}
                </td>
                <td className="account-column">{pickLocalizedDisplayText(tx.accountNameLocalized, tx.accountName || tx.accountType || tx.account, isSpanish)}</td>
                <td className="notes-column">
                  <div className="notes-content">
                    <span className="notes-text">{pickLocalizedDisplayText(tx.notesLocalized, tx.notes, isSpanish)}</span>
                    {getDocumentCount(tx.documents) > 0 && (
                      <span 
                        className="document-indicator"
                        onClick={(e) => handleDocumentClick(tx, e)}
                        title={t('tx.table.viewDocuments', { count: getDocumentCount(tx.documents) })}
                      >
                        <FontAwesomeIcon icon={faPaperclip} />
                        {getDocumentCount(tx.documents) > 1 && (
                          <span className="document-count">{getDocumentCount(tx.documents)}</span>
                        )}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
}

export default TransactionTable;