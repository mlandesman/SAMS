import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useDesktopStrings } from '../hooks/useDesktopStrings';
import './TransactionConfirmationModal.css';

const TransactionConfirmationModal = ({
  isOpen,
  onClose,
  transactionData,
  uploadedDocuments
}) => {
  const { t } = useDesktopStrings();

  if (!isOpen) return null;

  const formatAmount = (amount) => {
    const num = Number(amount || 0);
    return num.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    });
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return t('tx.detail.na');

    if (dateValue?.display) {
      const [month, day, year] = dateValue.display.split('/');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
    }

    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleViewDocuments = () => {
    if (!uploadedDocuments || uploadedDocuments.length === 0) return;
    alert(`${t('txConfirm.documentViewingUnavailable')}\n\n${t('txConfirm.documentViewingSteps', {
      docs: uploadedDocuments.map((d) => d.name).join(', ')
    })}`);
  };

  const formatAllocationAmount = (amount) => {
    const numericAmount = Number(amount || 0);
    return numericAmount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    });
  };

  const detailFields = [
    { label: t('txConfirm.amount'), value: formatAmount(transactionData.amount), valueClass: 'clean-amount' },
    { label: t('txConfirm.date'), value: formatDate(transactionData.date) },
    { label: t('txConfirm.category'), value: transactionData.category || t('tx.detail.na') },
    { label: t('txConfirm.vendor'), value: transactionData.vendor || t('tx.detail.na') },
    { label: t('txConfirm.paymentMethod'), value: transactionData.paymentMethod || t('tx.detail.na') },
    { label: t('txConfirm.account'), value: transactionData.account || t('tx.detail.na') }
  ];

  return (
    <div className="modal-overlay">
      <div className="confirmation-modal clean-confirmation">
        <div className="clean-confirmation-header">
          <div>
            <h2>{t('txConfirm.expenseSubmitted')}</h2>
            <p className="clean-subtitle">{t('txConfirm.expenseRecorded')}</p>
          </div>
          <button className="clean-close-button" onClick={onClose} aria-label={t('txConfirm.close')}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="modal-content">
          <div className="clean-summary-card">
            <h3>{t('txConfirm.transactionDetails')}</h3>
            <div className="clean-summary-grid">
              {detailFields.map((field) => (
                <div className="clean-field-card" key={field.label}>
                  <span className="clean-field-label">{field.label}</span>
                  <strong className={`clean-field-value ${field.valueClass || ''}`}>{field.value}</strong>
                </div>
              ))}
              {transactionData.transactionId && (
                <div className="clean-field-card clean-summary-row-full">
                  <span className="clean-field-label">{t('txConfirm.transactionId')}</span>
                  <strong className="clean-field-value clean-transaction-id">{transactionData.transactionId}</strong>
                </div>
              )}
            </div>
          </div>

          {Array.isArray(transactionData.allocations) && transactionData.allocations.length > 0 && (
            <div className="clean-allocations-section">
              <h3>Split Allocations</h3>
              <div className="clean-allocations-table">
                <div className="clean-allocations-header">
                  <span>Category</span>
                  <span>Notes</span>
                  <span>Amount</span>
                </div>
                {transactionData.allocations.map((allocation) => (
                  <div key={allocation.id} className="clean-allocation-row">
                    <span>{allocation.categoryName || t('tx.detail.na')}</span>
                    <span>{allocation.notes || '-'}</span>
                    <span className="clean-allocation-amount">{formatAllocationAmount(allocation.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadedDocuments && uploadedDocuments.length > 0 && (
            <div className="clean-documents-section">
              <h3>{t('txConfirm.documents', { count: uploadedDocuments.length })}</h3>
              <div className="clean-documents-list">
                {uploadedDocuments.map((file, index) => (
                  <button
                    key={index}
                    type="button"
                    className="clean-document-item"
                    onClick={handleViewDocuments}
                  >
                    <span className="clean-document-name">{file.name}</span>
                    <span className="clean-document-size">
                      {file.size ? (file.size / 1024).toFixed(1) : '0'} KB
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer clean-confirmation-footer">
          <button className="clean-btn-primary" onClick={onClose}>
            {t('txConfirm.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionConfirmationModal;
