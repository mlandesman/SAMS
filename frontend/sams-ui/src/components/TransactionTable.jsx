import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import DocumentViewer from './documents/DocumentViewer';
import { getDocument } from '../api/documents';
import { getAuthInstance } from '../firebaseClient';
import { databaseFieldMappings } from '../utils/databaseFieldMappings';
import './TransactionTable.css';

function TransactionTable({ transactions = [], selectedId = null, onSelectTransaction, onDoubleClickTransaction, clientId }) {
  
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
    return transaction.categoryName || transaction.category || '';
  };

  return (
    <div className="transaction-section">
      <div className="transaction-table-container">
        <table className="transaction-table">
          <thead>
            <tr>
              <th className="date-column">Date</th>
              <th className="vendor-column">Vendor</th>
              <th className="category-column">Category</th>
              <th className="unit-column">Unit</th>
              <th className="amount-column" style={{textAlign: 'right'}}>Amount</th>
              <th className="account-column">Account</th>
              <th className="notes-column">Notes</th>
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
                title="Double-click to view details"
              >
                <td className="date-column">{tx.date?.unambiguous_long_date || tx.created?.unambiguous_long_date || tx.date?.display || tx.created?.display || ''}</td>
                <td className="vendor-column">{tx.vendorName || tx.vendor || ''}</td>
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
                <td className="account-column">{tx.accountName || tx.accountType || tx.account || ''}</td>
                <td className="notes-column">
                  <div className="notes-content">
                    <span className="notes-text">{tx.notes}</span>
                    {getDocumentCount(tx.documents) > 0 && (
                      <span 
                        className="document-indicator"
                        onClick={(e) => handleDocumentClick(tx, e)}
                        title={`View ${getDocumentCount(tx.documents)} document${getDocumentCount(tx.documents) > 1 ? 's' : ''}`}
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