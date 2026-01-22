import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';
import { getUnits } from '../../api/units';
import { getOwnerInfo, sortUnitsByUnitId } from '../../utils/unitUtils';
import { getAuthInstance } from '../../firebaseClient';
import { config } from '../../config';
import LoadingSpinner from '../common/LoadingSpinner';
import { printReport } from '../../utils/printUtils';
import { sendWaterReportEmail } from '../../api/email';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import EmailIcon from '@mui/icons-material/Email';
import './WaterConsumptionReportTab.css';

// Get authentication headers with Firebase ID token
const getAuthHeaders = async () => {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('No authenticated user');
  }
  
  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

function normalizeLanguage(lang) {
  if (!lang) return null;
  if (typeof lang !== 'string') {
    lang = String(lang);
  }
  const lower = lang.toLowerCase().trim();
  if (lower === 'english' || lower === 'en') return 'english';
  if (lower === 'spanish' || lower === 'es') return 'spanish';
  return null;
}

function getDefaultLanguage({ selectedClient, samsUser }) {
  // 1) User preference takes precedence if available
  const userPref = normalizeLanguage(samsUser?.preferredLanguage);
  if (userPref) {
    return userPref;
  }

  // 2) Client configuration
  if (selectedClient) {
    const configLang = normalizeLanguage(selectedClient.configuration?.language);
    if (configLang) {
      return configLang;
    }
  }

  // 3) Explicit client defaults
  if (selectedClient?.id === 'AVII') {
    return 'spanish';
  }
  if (selectedClient?.id === 'MTC') {
    return 'english';
  }

  // 4) System default
  return 'english';
}

function WaterConsumptionReportTab({ clientId }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();

  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState(null);

  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [language, setLanguage] = useState('english');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [htmlPreview, setHtmlPreview] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  // Initialize language when client or user changes
  useEffect(() => {
    if (!selectedClient) {
      return;
    }

    setLanguage(getDefaultLanguage({ selectedClient, samsUser }));
  }, [selectedClient, samsUser]);

  // Load units for the selected client
  useEffect(() => {
    const loadUnits = async () => {
      const effectiveClientId = clientId || selectedClient?.id;
      if (!effectiveClientId) {
        setUnits([]);
        return;
      }

      setUnitsLoading(true);
      setUnitsError(null);

      try {
        const result = await getUnits(effectiveClientId);
        const unitsList = Array.isArray(result.data) ? result.data : [];
        setUnits(sortUnitsByUnitId(unitsList));
      } catch (err) {
        console.error('Failed to load units for Water Consumption Report:', err);
        setUnitsError('Failed to load units. Please try again.');
      } finally {
        setUnitsLoading(false);
      }
    };

    loadUnits();
  }, [clientId, selectedClient]);

  const filteredUnits = useMemo(() => {
    if (!unitFilter) {
      return units;
    }

    const filterLower = unitFilter.toLowerCase();
    return units.filter(unit => {
      const ownerInfo = getOwnerInfo(unit || {});
      const parts = [
        unit.unitId || '',
        ownerInfo.firstName || '',
        ownerInfo.lastName || ''
      ]
        .join(' ')
        .toLowerCase();

      return parts.includes(filterLower);
    });
  }, [units, unitFilter]);

  const unitOptions = useMemo(
    () =>
      filteredUnits.map(unit => {
        const ownerInfo = getOwnerInfo(unit || {});
        const lastName = ownerInfo.lastName || '';
        const unitId = unit.unitId || '';
        const label = lastName ? `${unitId} - ${lastName}` : unitId;
        return {
          value: unitId,
          label
        };
      }),
    [filteredUnits]
  );

  const handleGenerate = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      const effectiveClientId = clientId || selectedClient?.id;
      if (!effectiveClientId || !selectedUnitId) {
        setError('Please select a unit to generate the report.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${config.api.baseUrl}/clients/${effectiveClientId}/reports/water/${selectedUnitId}?language=${language}&format=json`,
          { headers }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to generate report');
        }

        const data = await response.json();
        
        if (data.html) {
          setHtmlPreview(data.html);
          setHasGenerated(true);
        } else {
          throw new Error('Report generated but no HTML content received');
        }
      } catch (err) {
        console.error('Water consumption report generation error:', err);
        setError(err.message || 'Failed to generate report. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [clientId, selectedClient, selectedUnitId, language]
  );

  const handleDownloadPdf = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      const effectiveClientId = clientId || selectedClient?.id;
      if (!effectiveClientId || !selectedUnitId) {
        return;
      }

      setDownloadingPdf(true);
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${config.api.baseUrl}/clients/${effectiveClientId}/reports/water/${selectedUnitId}/pdf?language=${language}`,
          { headers }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to generate PDF');
        }

        const blob = await response.blob();
        
        // Trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `water-consumption-${selectedUnitId}-${language}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('PDF download failed:', err);
        setError(err.message || 'Failed to download PDF. Please try again.');
      } finally {
        setDownloadingPdf(false);
      }
    },
    [clientId, selectedClient, selectedUnitId, language]
  );

  const handlePrint = useCallback(() => {
    printReport('.water-report-preview-frame');
  }, []);

  const handleSendEmail = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      const effectiveClientId = clientId || selectedClient?.id;
      if (!effectiveClientId || !selectedUnitId) {
        setEmailResult({ success: false, message: 'Please select a unit to send email.' });
        return;
      }

      setEmailSending(true);
      setEmailResult(null);

      try {
        const result = await sendWaterReportEmail(
          effectiveClientId,
          selectedUnitId,
          language
        );
        
        setEmailResult({
          success: true,
          message: result.message || `Email sent successfully (${language})`
        });
      } catch (err) {
        console.error('Email send failed:', err);
        setEmailResult({
          success: false,
          message: err.message || 'Failed to send email. Please try again.'
        });
      } finally {
        setEmailSending(false);
      }
    },
    [clientId, selectedClient, selectedUnitId, language]
  );

  const handleRetry = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const isGenerateDisabled = loading || unitsLoading || !!unitsError || downloadingPdf;
  const hasReport = !!htmlPreview;
  const isPdfDisabled = !hasReport || loading || downloadingPdf;
  const isPrintDisabled = !hasReport || loading;
  const isEmailDisabled = !selectedUnitId || loading || emailSending;

  const showUnitFilter = units.length > 20;
  const effectiveClientId = clientId || selectedClient?.id;

  if (!effectiveClientId) {
    return (
      <div className="water-report-tab-content">
        <div className="water-report-placeholder">
          <p>Please select a client to generate Water Consumption reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="water-report-tab-content water-consumption-report-tab">
      <div className="water-report-header-row">
        <h2 className="water-report-title">Water Consumption Report</h2>
      </div>

      <div className="water-report-controls">
        <div className="control-group unit-group">
          <label htmlFor="water-report-unit-select">Unit:</label>
          <div className="unit-select-container">
            {showUnitFilter && (
              <input
                type="text"
                className="unit-filter-input"
                placeholder="Search units..."
                value={unitFilter}
                onChange={e => setUnitFilter(e.target.value)}
              />
            )}
            <select
              id="water-report-unit-select"
              className="water-report-select"
              value={selectedUnitId}
              onChange={e => setSelectedUnitId(e.target.value)}
              disabled={unitsLoading || !!unitsError}
            >
              <option value="">Select a unit...</option>
              {unitOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {unitsLoading && (
              <span className="inline-status">Loading units...</span>
            )}
            {unitsError && (
              <span className="inline-status error-text">{unitsError}</span>
            )}
            {!unitsLoading && !unitsError && units.length === 0 && (
              <span className="inline-status">No units available</span>
            )}
          </div>
        </div>

        <div className="control-group">
          <div className="language-toggle" aria-label="Language selection">
            <button
              type="button"
              className={language === 'english' ? 'active' : ''}
              onClick={() => setLanguage('english')}
            >
              EN
            </button>
            <button
              type="button"
              className={language === 'spanish' ? 'active' : ''}
              onClick={() => setLanguage('spanish')}
            >
              ES
            </button>
          </div>
        </div>

        <button
          type="button"
          className="water-report-generate-button"
          onClick={handleGenerate}
          disabled={isGenerateDisabled}
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>

        <div className="action-buttons">
          <button
            type="button"
            className="secondary-button"
            onClick={handlePrint}
            disabled={isPrintDisabled}
            title="Print report"
          >
            <LocalPrintshopIcon style={{ fontSize: 16, marginRight: 4 }} />
            Print
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleDownloadPdf}
            disabled={isPdfDisabled}
            title="Download PDF"
          >
            <PictureAsPdfIcon style={{ fontSize: 16, marginRight: 4 }} />
            {downloadingPdf ? 'PDF…' : 'PDF'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleSendEmail}
            disabled={isEmailDisabled}
            title="Send email to unit owner"
          >
            <EmailIcon style={{ fontSize: 16, marginRight: 4 }} />
            {emailSending ? 'Sending...' : 'Email'}
          </button>
        </div>
        
        {emailResult && (
          <div className={`email-result ${emailResult.success ? 'success' : 'error'}`} style={{ marginTop: '10px', padding: '10px', borderRadius: '4px', backgroundColor: emailResult.success ? '#d4edda' : '#f8d7da', color: emailResult.success ? '#155724' : '#721c24' }}>
            {emailResult.message}
            <button onClick={() => setEmailResult(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'inherit' }}>×</button>
          </div>
        )}
      </div>

      <div className="water-report-preview">
        {(downloadingPdf) && (
          <div className="water-report-preview-overlay">
            <LoadingSpinner
              show={true}
              variant="logo"
              size="large"
              message="Preparing PDF..."
              fullScreen={false}
            />
          </div>
        )}

        {loading && (
          <div className="water-report-preview-loading">
            <LoadingSpinner
              show={true}
              variant="logo"
              size="large"
              message={
                selectedUnitId
                  ? `Generating report for Unit ${selectedUnitId}...`
                  : 'Generating report...'
              }
              fullScreen={false}
            />
          </div>
        )}

        {!loading && error && (
          <div className="water-report-preview-error">
            <p>{error}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && !hasGenerated && (
          <div className="water-report-preview-empty">
            <h3>📋 {selectedUnitId ? 'Generating report...' : 'Select a unit above to generate report'}</h3>
            {!selectedUnitId && (
              <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                Select a unit and click "Generate Report" to view the water consumption report.
              </p>
            )}
            <p>
              The report will show:
            </p>
            <ul>
              <li>Water meter readings history</li>
              <li>Consumption calculations</li>
              <li>Billing information</li>
              <li>Usage trends</li>
            </ul>
          </div>
        )}

        {!loading && !error && hasGenerated && htmlPreview && (
          <div className="water-report-preview-frame-container">
            <iframe
              title="Water Consumption Report Preview"
              srcDoc={htmlPreview}
              className="water-report-preview-frame"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default WaterConsumptionReportTab;
