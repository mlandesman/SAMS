import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip } from '@fortawesome/free-solid-svg-icons';
import DocumentViewer from './documents/DocumentViewer';
import { getDocument } from '../api/documents';
import { getAuthInstance } from '../firebaseClient';
import './TransactionTable.css';

function TransactionTable({ transactions = [], selectedId = null, onSelectTransaction, onDoubleClickTransaction, clientId }) {
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
                <td className="date-column">{tx.date?.toDate?.() ? 
                  new Date(tx.date.toDate().getTime()).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',  // Use 2-digit format for consistent width (01, 02, etc.)
                    day: '2-digit',    // Use 2-digit format for consistent width (01, 02, etc.)
                    timeZone: 'UTC'    // Force UTC to avoid timezone issues
                  }) : 'N/A'}</td>
                <td className="vendor-column">{tx.vendor}</td>
                <td className="category-column">{tx.category}</td>
                <td className="unit-column">{tx.unitId || tx.unit || ''}</td>
                <td className="amount-column amount-cell">
                  {tx.amount < 0
                    ? `-$${Math.round(Math.abs(tx.amount)).toLocaleString('en-US')}`
                    : `$${Math.round(tx.amount).toLocaleString('en-US')}`}
                </td>
                <td className="account-column">{tx.accountType || tx.account || ''}</td>
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