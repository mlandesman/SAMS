import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';
import { getUnits } from '../../api/units';
import { getOwnerInfo, sortUnitsByUnitId } from '../../utils/unitUtils';
import { getFiscalYear, getFiscalYearLabel } from '../../utils/fiscalYearUtils';
import { getMexicoDate } from '../../utils/timezone';
import LoadingSpinner from '../common/LoadingSpinner';
import reportService from '../../services/reportService';
import './StatementOfAccountTab.css';

function normalizeLanguage(lang) {
  if (!lang) return null;
  const lower = String(lang).toLowerCase();
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

function buildFiscalYearOptions(selectedClient) {
  if (!selectedClient) {
    return [];
  }

  const fiscalYearStartMonth =
    selectedClient.configuration?.fiscalYearStartMonth || 1;
  const todayMexico = getMexicoDate();
  const currentFiscalYear = getFiscalYear(todayMexico, fiscalYearStartMonth);

  const years = [currentFiscalYear, currentFiscalYear - 1, currentFiscalYear - 2];

  return years.map(year => ({
    value: year,
    label: getFiscalYearLabel(year, fiscalYearStartMonth)
  }));
}

function StatementOfAccountTab({ zoom = 1.0 }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();

  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState(null);

  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [unitFilter, setUnitFilter] = useState('');

  const [fiscalYear, setFiscalYear] = useState(null);
  const [language, setLanguage] = useState('english');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [htmlPreview, setHtmlPreview] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  // Initialise language and fiscal year when client or user changes
  useEffect(() => {
    if (!selectedClient) {
      return;
    }

    setLanguage(getDefaultLanguage({ selectedClient, samsUser }));

    const options = buildFiscalYearOptions(selectedClient);
    if (options.length > 0) {
      setFiscalYear(options[0].value);
    }
  }, [selectedClient, samsUser]);

  // Load units for the selected client
  useEffect(() => {
    const loadUnits = async () => {
      if (!selectedClient) {
        setUnits([]);
        return;
      }

      setUnitsLoading(true);
      setUnitsError(null);

      try {
        const result = await getUnits(selectedClient.id);
        const unitsList = Array.isArray(result.data) ? result.data : [];
        setUnits(sortUnitsByUnitId(unitsList));
      } catch (err) {
        console.error('Failed to load units for Statement of Account:', err);
        setUnitsError('Failed to load units. Please try again.');
      } finally {
        setUnitsLoading(false);
      }
    };

    loadUnits();
  }, [selectedClient]);

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

  const fiscalYearOptions = useMemo(
    () => buildFiscalYearOptions(selectedClient),
    [selectedClient]
  );

  const handleGenerate = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      if (!selectedClient || !selectedUnitId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await reportService.getStatementData(
          selectedClient.id,
          selectedUnitId,
          fiscalYear,
          { language }
        );

        // Debug: inspect the raw HTML returned from the backend
        try {
          const snippet = data.html.slice(0, 800);
          console.log(
            '🧾 [StatementOfAccountTab] HTML response length:',
            data.html.length
          );
          console.log('🧾 [StatementOfAccountTab] HTML snippet:\n', snippet);
        } catch (logError) {
          console.warn(
            '⚠️ [StatementOfAccountTab] Failed to log HTML snippet:',
            logError
          );
        }

        setStatementData(data);
        setHtmlPreview(data.html);
        setHasGenerated(true);
      } catch (err) {
        console.error('Statement generation error:', err);
        setError('Failed to generate statement. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [selectedClient, selectedUnitId, language, fiscalYear]
  );

  const handleDownloadPdf = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      if (!selectedClient || !selectedUnitId || !htmlPreview) {
        return;
      }

      setDownloadingPdf(true);
      try {
        await reportService.exportStatementPdfFromHtml(selectedClient.id, {
          unitId: selectedUnitId,
          fiscalYear,
          language,
          html: htmlPreview,
          // We don't yet have structured meta on the frontend; allow backend to
          // accept minimal/default footer metadata for interactive exports.
          meta: {}
        });
      } catch (err) {
        console.error('PDF download failed:', err);
        setError('Failed to download PDF. Please try again.');
      } finally {
        setDownloadingPdf(false);
      }
    },
    [selectedClient, selectedUnitId, language, fiscalYear, htmlPreview]
  );

  const handleRetry = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const isGenerateDisabled =
    !selectedUnitId || loading || unitsLoading || !!unitsError;

  const hasStatement = !!statementData && !!statementData.html;
  const isPdfDisabled = !hasStatement || loading || downloadingPdf;
  const isCsvDisabled =
    !hasStatement ||
    !statementData.lineItems ||
    statementData.lineItems.length === 0 ||
    loading ||
    downloadingCsv;

  const handleDownloadCsv = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      if (!selectedClient || !selectedUnitId || !statementData) {
        return;
      }

      setDownloadingCsv(true);
      try {
        const openingBalance =
          typeof statementData.summary?.openingBalance === 'number'
            ? statementData.summary.openingBalance
            : 0;

        const header = [
          'Date',
          'Description',
          'Charge',
          'Payment',
          'Balance Due',
          'Type'
        ];

        const rows = [];

        // Opening balance row
        rows.push([
          '',
          'Opening Balance',
          '',
          '',
          openingBalance.toFixed(2),
          'opening'
        ]);

        // Transaction rows (lineItems already exclude future items)
        for (const item of statementData.lineItems || []) {
          rows.push([
            item.date || '',
            item.description || '',
            typeof item.charge === 'number' ? item.charge.toFixed(2) : '',
            typeof item.payment === 'number' ? item.payment.toFixed(2) : '',
            typeof item.balance === 'number' ? item.balance.toFixed(2) : '',
            item.type || ''
          ]);
        }

        const escapeCell = value => {
          const str = value == null ? '' : String(value);
          const escaped = str.replace(/"/g, '""');
          return `"${escaped}"`;
        };

        const csvLines = [header, ...rows].map(row =>
          row.map(escapeCell).join(',')
        );
        const csvContent = csvLines.join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const yearPart = fiscalYear || 'current';
        a.download = `statement-${selectedClient.id}-${selectedUnitId}-${yearPart}-transactions.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('CSV download failed:', err);
        setError('Failed to download CSV. Please try again.');
      } finally {
        setDownloadingCsv(false);
      }
    },
    [selectedClient, selectedUnitId, fiscalYear, statementData]
  );
  // Automatically generate statement whenever unit, year, or language changes
  useEffect(() => {
    if (!selectedClient || !selectedUnitId || !fiscalYear) {
      return;
    }
    handleGenerate();
  }, [handleGenerate, selectedClient, selectedUnitId, fiscalYear, language]);

  const showUnitFilter = units.length > 20;

  if (!selectedClient) {
    return (
      <div className="reports-tab-content">
        <div className="reports-placeholder">
          <p>Please select a client to generate Statement of Account reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-tab-content statement-of-account-tab">
      <div className="statement-header-row">
        <h2 className="statement-title">Statement of Account</h2>
      </div>

      <div className="statement-controls">
        <div className="control-group unit-group">
          <label htmlFor="statement-unit-select">Unit:</label>
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
              id="statement-unit-select"
              className="statement-select"
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
          <label htmlFor="statement-fiscal-year">Year:</label>
          <select
            id="statement-fiscal-year"
            className="statement-select"
            value={fiscalYear ?? ''}
            onChange={e => setFiscalYear(e.target.value ? Number(e.target.value) : null)}
          >
            {fiscalYearOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
          className="statement-generate-button"
          onClick={handleGenerate}
          disabled={isGenerateDisabled}
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>

        <div className="action-buttons">
          <button
            type="button"
            className="secondary-button"
            onClick={handleDownloadCsv}
            disabled={isCsvDisabled}
          >
            {downloadingCsv ? 'CSV…' : 'CSV'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleDownloadPdf}
            disabled={isPdfDisabled}
          >
            PDF
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled
            title="Coming soon"
          >
            Email
          </button>
        </div>
      </div>

      <div className="statement-preview">
        {(downloadingPdf || downloadingCsv) && (
          <div className="statement-preview-overlay">
            <LoadingSpinner
              show={true}
              variant="logo"
              size="large"
              message={downloadingPdf ? 'Preparing PDF...' : 'Preparing CSV...'}
              fullScreen={false}
            />
          </div>
        )}
        {loading && (
          <div className="statement-preview-loading">
            <LoadingSpinner
              show={true}
              variant="logo"
              size="large"
              message={
                selectedUnitId
                  ? `Generating statement for Unit ${selectedUnitId}...`
                  : 'Generating statement...'
              }
              fullScreen={false}
            />
          </div>
        )}

        {!loading && error && (
          <div className="statement-preview-error">
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
          <div className="statement-preview-empty">
            <h3>📋 Select a unit above to generate statement</h3>
            <p>
              The statement will show:
            </p>
            <ul>
              <li>HOA dues and payments</li>
              <li>Water bills and payments</li>
              <li>Penalties applied</li>
              <li>Current balance</li>
            </ul>
          </div>
        )}

        {!loading && !error && hasGenerated && htmlPreview && (
          <div className="statement-preview-frame-container">
            <iframe
              title="Statement of Account Preview"
              srcDoc={htmlPreview}
              className="statement-preview-frame"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                width: `${100 / zoom}%`,
                height: `${100 / zoom}%`
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default StatementOfAccountTab;


