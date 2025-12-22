import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheckDouble } from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../context/ClientContext';
import { config } from '../config';
import { getCurrentUser, getAuthInstance } from '../firebaseClient';
import { clearAccountsCache } from '../utils/clientAccounts';
import ConfirmationDialog from './ConfirmationDialog';
import NotificationModal from './NotificationModal';
import './AccountReconciliation.css';

const AccountReconciliation = ({ isOpen, onClose, onSuccess }) => {
  const { selectedClient } = useClient();
  const [accounts, setAccounts] = useState([]);
  const [actualBalances, setActualBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingAdjustments, setPendingAdjustments] = useState([]);
  // Use ref to preserve results across modal close/reopen
  const resultsRef = useRef(null);

  useEffect(() => {
    if (isOpen && selectedClient?.id) {
      fetchAccounts();
    }
  }, [isOpen, selectedClient]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      const response = await fetch(`${config.api.baseUrl}/clients/${selectedClient.id}/accounts/reconciliation`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch accounts');
      }

      setAccounts(data.accounts || []);
      
      // Initialize actual balances with SAMS balances
      const initial = {};
      (data.accounts || []).forEach(acc => {
        initial[acc.id] = acc.samsBalance || 0;
      });
      setActualBalances(initial);
      setResults(null); // Clear previous results
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      setError(err.message || 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceChange = (accountId, value) => {
    setActualBalances(prev => ({
      ...prev,
      [accountId]: parseFloat(value) || 0
    }));
  };

  const calculateDifference = (accountId, samsBalance) => {
    const actual = actualBalances[accountId] || 0;
    return actual - samsBalance;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const handleSubmit = async () => {
    const adjustments = accounts.map(acc => ({
      accountId: acc.id,
      accountName: acc.name,
      samsBalance: acc.samsBalance || 0,
      actualBalance: actualBalances[acc.id] || 0,
      difference: calculateDifference(acc.id, acc.samsBalance)
    })).filter(adj => Math.abs(adj.difference) >= 0.01); // Filter out near-zero differences

    if (adjustments.length === 0) {
      // Ensure results is cleared for "no adjustments" message
      setResults(null);
      // Close reconciliation modal first, then show info modal
      onClose();
      setTimeout(() => {
        setShowSuccessModal(true);
      }, 100);
      return;
    }

    // Store adjustments and show confirmation dialog
    setPendingAdjustments(adjustments);
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = async () => {
    const adjustments = pendingAdjustments;
    setShowConfirmDialog(false);

    try {
      setSubmitting(true);
      setError(null);
      
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      const response = await fetch(`${config.api.baseUrl}/clients/${selectedClient.id}/accounts/reconciliation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ adjustments })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to submit adjustments');
      }

      const createdResults = data.results || [];
      
      // Store results in ref to preserve across modal close
      resultsRef.current = createdResults;
      
      // Clear accounts cache to force refresh
      clearAccountsCache(selectedClient.id);
      
      // Call onSuccess callback to trigger transaction refresh
      // (This will refresh transactions - we don't need to fetchAccounts again)
      if (onSuccess) {
        onSuccess();
      }
      
      // Set results state
      setResults(createdResults);
      
      // Close the reconciliation modal first, then show success modal
      onClose();
      
      // Show success modal after a brief delay to ensure reconciliation modal closes first
      setTimeout(() => {
        // Ensure results are set from ref in case state was cleared
        if (!results || results.length === 0) {
          setResults(resultsRef.current || []);
        }
        setShowSuccessModal(true);
      }, 100);
    } catch (err) {
      console.error('Failed to submit adjustments:', err);
      setError(err.message || 'Failed to submit adjustments');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Success Modal - rendered outside reconciliation modal so it can show after modal closes */}
      {showSuccessModal && (
        <NotificationModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setResults(null); // Clear results when closing
            resultsRef.current = null; // Clear ref
          }}
          type={(results && results.length > 0) || (resultsRef.current && resultsRef.current.length > 0) ? "success" : "info"}
          title={(results && results.length > 0) || (resultsRef.current && resultsRef.current.length > 0) ? "Adjustments Created Successfully" : "No Adjustments Needed"}
          message={
            (results && results.length > 0) || (resultsRef.current && resultsRef.current.length > 0)
              ? `Successfully created ${(results && results.length) || (resultsRef.current && resultsRef.current.length) || 0} adjustment transaction(s).`
              : "All balances match - no adjustments needed."
          }
          details={
            (results && results.length > 0) || (resultsRef.current && resultsRef.current.length > 0)
              ? (results || resultsRef.current || []).map((result, idx) => ({
                  label: result.accountName,
                  value: formatCurrency(result.amount)
                }))
              : []
          }
          autoClose={true}
          autoCloseDelay={3000}
        />
      )}

      {/* Confirmation Dialog - rendered outside so it can show over the reconciliation modal */}
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmSubmit}
        title="Confirm Reconciliation Adjustments"
        message={
          <div>
            <p>You are about to create {pendingAdjustments.length} adjustment transaction(s):</p>
            <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
              {pendingAdjustments.map((adj, idx) => (
                <li key={idx} style={{ marginBottom: '5px' }}>
                  <strong>{adj.accountName}:</strong> {formatCurrency(adj.difference)}
                </li>
              ))}
            </ul>
            <p style={{ marginTop: '15px' }}>Continue?</p>
          </div>
        }
        confirmLabel="Create Adjustments"
        cancelLabel="Cancel"
        confirmButtonClass="primary"
      />

      {/* Reconciliation Modal */}
      {isOpen && (
        <div className="account-reconciliation-overlay" onClick={onClose}>
          <div className="account-reconciliation-modal" onClick={e => e.stopPropagation()}>
            <div className="account-reconciliation-header">
              <h2 className="account-reconciliation-title">
                <FontAwesomeIcon icon={faCheckDouble} style={{ marginRight: '10px' }} />
                Account Reconciliation
              </h2>
              <button
                className="account-reconciliation-close"
                onClick={onClose}
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="account-reconciliation-content">
              {error && (
                <div className="account-reconciliation-error">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="account-reconciliation-loading">
                  Loading accounts...
                </div>
              ) : (
                <>
                  <p className="account-reconciliation-instructions">
                    Enter the actual balances from your bank statement and cash count.
                    Any differences will create adjustment transactions with the "Bank Adjustments" category.
                  </p>

                  {accounts.length === 0 ? (
                    <div className="account-reconciliation-empty">
                      No bank or cash accounts found for reconciliation.
                    </div>
                  ) : (
                    <table className="account-reconciliation-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>SAMS Balance</th>
                          <th>Actual Balance</th>
                          <th>Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map(account => {
                          const diff = calculateDifference(account.id, account.samsBalance);
                          return (
                            <tr key={account.id}>
                              <td>{account.name}</td>
                              <td className="balance-cell">{formatCurrency(account.samsBalance || 0)}</td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={actualBalances[account.id] !== undefined ? actualBalances[account.id] : ''}
                                  onChange={(e) => handleBalanceChange(account.id, e.target.value)}
                                  className="balance-input"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className={`difference-cell ${diff > 0.01 ? 'positive' : diff < -0.01 ? 'negative' : ''}`}>
                                {formatCurrency(diff)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {results && results.length > 0 && (
                    <div className="account-reconciliation-results">
                      <h3>Adjustments Created</h3>
                      <ul>
                        {results.map((r, idx) => (
                          <li key={idx}>
                            {formatCurrency(r.amount)} adjustment for {r.accountName || r.accountId}
                            {r.transactionId && ` (Transaction ID: ${r.transactionId})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="account-reconciliation-actions">
                    <button
                      onClick={onClose}
                      className="account-reconciliation-cancel"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || accounts.length === 0}
                      className="account-reconciliation-submit"
                    >
                      {submitting ? 'Submitting...' : 'Submit Adjustments'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AccountReconciliation;

