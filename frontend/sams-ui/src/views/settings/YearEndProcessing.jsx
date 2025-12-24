import React, { useState, useEffect } from 'react';
import { useClient } from '../../context/ClientContext';
import { getCurrentUser, getAuthInstance } from '../../firebaseClient';
import { config } from '../../config';
import { centavosToPesos } from '../../utils/currencyUtils';

const API_BASE_URL = config.api.baseUrl;

/**
 * Get authentication headers with Firebase ID token
 */
async function getAuthHeaders() {
  const auth = getAuthInstance();
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  try {
    const token = await currentUser.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw new Error('Authentication failed');
  }
}

/**
 * Format centavos to currency display
 */
function formatCurrency(centavos) {
  const pesos = centavosToPesos(centavos);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(pesos);
}

/**
 * Format pesos to currency display (for credit balances which are already in pesos)
 */
function formatCurrencyPesos(pesos) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(pesos);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function YearEndProcessing() {
  const { selectedClient } = useClient();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [closingYear, setClosingYear] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [snapshotAccounts, setSnapshotAccounts] = useState(true);
  const [unitEdits, setUnitEdits] = useState({});

  // Initialize closing year to current year
  useEffect(() => {
    if (selectedClient && !closingYear) {
      const currentYear = new Date().getFullYear();
      setClosingYear(currentYear);
    }
  }, [selectedClient, closingYear]);

  // Load preview data when client or year changes
  useEffect(() => {
    if (selectedClient && closingYear) {
      loadPreview();
    }
  }, [selectedClient?.id, closingYear]);

  /**
   * Load preview data
   */
  const loadPreview = async () => {
    if (!selectedClient || !closingYear) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/clients/${selectedClient.id}/year-end/preview/${closingYear}`,
        { headers }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setPreviewData(data);
      
      // Initialize unit edits with default values
      const edits = {};
      data.units.forEach(unit => {
        edits[unit.unitId] = {
          nextYearScheduledAmount: unit.nextYearScheduledAmount // In centavos
        };
      });
      setUnitEdits(edits);
    } catch (err) {
      console.error('Error loading preview:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle unit rate change
   */
  const handleRateChange = (unitId, newAmount) => {
    setUnitEdits(prev => ({
      ...prev,
      [unitId]: {
        ...prev[unitId],
        nextYearScheduledAmount: newAmount
      }
    }));
  };


  /**
   * Generate Board Report PDF
   */
  const handleGenerateReport = async (language = 'english') => {
    if (!selectedClient || !closingYear) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/clients/${selectedClient.id}/year-end/report/${closingYear}?language=${language}`,
        { headers }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      // Download PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `year-end-report-${selectedClient.id}-${closingYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess('Board report generated successfully');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Execute year-end processing
   */
  const handleExecute = async () => {
    if (!selectedClient || !closingYear || !previewData) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Build units array from edits (all units included, no exclude option)
      const units = previewData.units.map(unit => ({
        unitId: unit.unitId,
        nextYearScheduledAmount: unitEdits[unit.unitId]?.nextYearScheduledAmount || unit.nextYearScheduledAmount
      }));
      
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/clients/${selectedClient.id}/year-end/execute`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            closingYear,
            units,
            snapshotAccounts
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        setError(`Execution completed with ${result.errors.length} error(s). Check console for details.`);
        console.error('Execution errors:', result.errors);
      } else {
        setSuccess(`Year-end processing completed successfully! ${result.unitsProcessed} units processed.`);
        setTimeout(() => setSuccess(null), 10000);
        setShowExecuteModal(false);
        
        // Reload preview to show updated data
        await loadPreview();
      }
    } catch (err) {
      console.error('Error executing year-end:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedClient) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Please select a client to access Year-End Processing.</p>
      </div>
    );
  }

  const openingYear = closingYear ? closingYear + 1 : null;
  const unitsWithBalanceDue = previewData?.summary.unitsWithBalanceDue || 0;
  const unitsWithCredit = previewData?.summary.unitsWithCredit || 0;
  const unitsWithRateChange = previewData?.units.filter(u => {
    const edit = unitEdits[u.unitId];
    if (!edit) return false;
    return edit.nextYearScheduledAmount !== u.currentYearScheduledAmount;
  }).length || 0;

  return (
    <div style={{ padding: '20px', maxWidth: '1400px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px' }}>Year-End Processing</h1>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Client: <strong>{selectedClient.name || selectedClient.id}</strong>
        </div>
      </div>

      {/* Year Selection */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Close Fiscal Year:</label>
            <select
              value={closingYear || ''}
              onChange={(e) => setClosingYear(parseInt(e.target.value))}
              style={{ padding: '5px 10px', fontSize: '14px' }}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
          </div>
          <div>
            <strong>Open Fiscal Year:</strong> {openingYear}
          </div>
          {previewData && (
            <div>
              <strong>Snapshot Date:</strong> {formatDate(previewData.snapshotDate)}
            </div>
          )}
          <button
            onClick={loadPreview}
            disabled={loading}
            style={{
              padding: '5px 15px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{
          padding: '10px',
          marginBottom: '15px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px'
        }}>
          ❌ {error}
        </div>
      )}
      {success && (
        <div style={{
          padding: '10px',
          marginBottom: '15px',
          backgroundColor: '#d4edda',
          color: '#155724',
          border: '1px solid #c3e6cb',
          borderRadius: '4px'
        }}>
          ✅ {success}
        </div>
      )}

      {loading && !previewData && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading preview data...</p>
        </div>
      )}

      {previewData && (
        <>
          {/* Account Balances */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ marginBottom: '10px', fontSize: '20px' }}>Account Balances</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd', fontSize: '18px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd', fontSize: '18px' }}>Account</th>
                  <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '18px' }}>Current</th>
                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd', fontSize: '18px' }}>YE Snapshot</th>
                </tr>
              </thead>
              <tbody>
                {previewData.accounts.map(acc => (
                  <tr key={acc.id}>
                    <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '18px' }}>{acc.name}</td>
                    <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '18px' }}>
                      {formatCurrency(acc.currentBalance)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd', fontSize: '18px' }}>
                      {acc.yeSnapshotExists ? '✅ Captured' : '⬜ Not Captured'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Unit Dues Configuration */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ marginBottom: '10px', fontSize: '20px' }}>Unit Dues Configuration</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd', fontSize: '18px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0' }}>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd', fontSize: '18px' }}>Unit</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd', fontSize: '18px' }}>Owner Name(s)</th>
                    <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '18px' }}>{closingYear} Rate</th>
                    <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '18px' }}>{openingYear} Rate</th>
                    <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '18px' }}>Balance Due</th>
                    <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '18px' }}>Credit Bal</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.units.map(unit => {
                    const edit = unitEdits[unit.unitId] || { nextYearScheduledAmount: unit.nextYearScheduledAmount };
                    const rateChange = edit.nextYearScheduledAmount - unit.currentYearScheduledAmount;
                    const hasRateChange = Math.abs(rateChange) > 0.01;
                    
                    return (
                      <tr key={unit.unitId} style={hasRateChange ? { backgroundColor: '#fff3cd' } : {}}>
                        <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '18px' }}>{unit.unitId}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '18px' }}>{unit.ownerNames || ''}</td>
                        <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '18px' }}>
                          {formatCurrency(unit.currentYearScheduledAmount)}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '18px' }}>
                          <input
                            type="number"
                            value={centavosToPesos(edit.nextYearScheduledAmount)}
                            onChange={(e) => handleRateChange(unit.unitId, Math.round(parseFloat(e.target.value) * 100) || 0)}
                            style={{ width: '120px', padding: '4px', textAlign: 'right', fontSize: '18px' }}
                            step="0.01"
                          />
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '18px' }}>
                          {formatCurrency(unit.balanceDue)}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '18px' }}>
                          {formatCurrencyPesos(unit.creditBalance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <h3 style={{ marginTop: 0, fontSize: '20px' }}>Summary</h3>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li><strong>Total Units:</strong> {previewData.summary.totalUnits}</li>
              {unitsWithBalanceDue > 0 && (
                <li style={{ color: '#856404' }}>
                  ⚠️ <strong>Units with Balance Due:</strong> {unitsWithBalanceDue} ({formatCurrency(previewData.summary.totalBalanceDue)}) - will carry forward
                </li>
              )}
              {unitsWithCredit > 0 && (
                <li style={{ color: '#155724' }}>
                  ✅ <strong>Units with Credit Balance:</strong> {unitsWithCredit} ({formatCurrencyPesos(previewData.summary.totalCreditBalance)})
                </li>
              )}
              {unitsWithRateChange > 0 && (
                <li style={{ color: '#004085' }}>
                  📊 <strong>Rate Changes:</strong> {unitsWithRateChange} unit{unitsWithRateChange !== 1 ? 's' : ''}
                </li>
              )}
            </ul>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleGenerateReport('english')}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              📄 Generate Board Report (EN)
            </button>
            <button
              onClick={() => handleGenerateReport('spanish')}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              📄 Generar Informe (ES)
            </button>
            <button
              onClick={() => setShowPreviewModal(true)}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              👁 Preview
            </button>
            <button
              onClick={() => setShowExecuteModal(true)}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              ✅ Execute Year-End
            </button>
          </div>

          {/* Preview Modal */}
          {showPreviewModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                maxWidth: '600px',
                maxHeight: '80vh',
                overflow: 'auto'
              }}>
                <h2>Preview - What Will Happen</h2>
                <ul>
                  <li>{previewData.units.length} units will have new year dues documents created</li>
                  {snapshotAccounts && <li>Year-end balance snapshot will be created for {closingYear}</li>}
                  <li>All new dues documents will have priorYearClosed flag set to true</li>
                </ul>
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowPreviewModal(false)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Execute Confirmation Modal */}
          {showExecuteModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                maxWidth: '500px'
              }}>
                <h2>Confirm Year-End Execution</h2>
                <p>This will:</p>
                <ul>
                  <li>Create new year dues documents for {previewData.units.length} units</li>
                  {snapshotAccounts && <li>Create year-end balance snapshot for {closingYear}</li>}
                  <li>Set priorYearClosed flags on all new documents</li>
                </ul>
                <p><strong>This action cannot be undone. Are you sure?</strong></p>
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleExecute}
                    disabled={loading}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? 'Processing...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setShowExecuteModal(false)}
                    disabled={loading}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default YearEndProcessing;

