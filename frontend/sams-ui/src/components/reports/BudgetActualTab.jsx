import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';
import { getFiscalYear, getFiscalYearLabel } from '../../utils/fiscalYearUtils';
import { getMexicoDate } from '../../utils/timezone';
import LoadingSpinner from '../common/LoadingSpinner';
import reportService from '../../services/reportService';
import './BudgetActualTab.css';

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

function BudgetActualTab({ zoom = 1.0 }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();

  const [fiscalYear, setFiscalYear] = useState(null);
  const [language, setLanguage] = useState('english');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [htmlPreview, setHtmlPreview] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  // Initialize language and fiscal year when client or user changes
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

  const fiscalYearOptions = useMemo(
    () => buildFiscalYearOptions(selectedClient),
    [selectedClient]
  );

  const handleGenerate = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      if (!selectedClient || !fiscalYear) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const html = await reportService.getBudgetActualHtml(
          selectedClient.id,
          fiscalYear,
          language
        );

        // Also fetch data for potential CSV export
        const data = await reportService.getBudgetActualData(
          selectedClient.id,
          fiscalYear,
          language
        );

        setReportData(data);
        setHtmlPreview(html);
        setHasGenerated(true);
      } catch (err) {
        console.error('Budget vs Actual generation error:', err);
        setError('Failed to generate report. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [selectedClient, language, fiscalYear]
  );

  const handleDownloadPdf = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      if (!selectedClient || !htmlPreview) {
        return;
      }

      setDownloadingPdf(true);
      try {
        await reportService.exportBudgetActualPdfFromHtml(selectedClient.id, {
          fiscalYear,
          language,
          html: htmlPreview,
          meta: reportData?.meta || {}
        });
      } catch (err) {
        console.error('PDF download failed:', err);
        setError('Failed to download PDF. Please try again.');
      } finally {
        setDownloadingPdf(false);
      }
    },
    [selectedClient, language, fiscalYear, htmlPreview, reportData]
  );

  const handleDownloadCsv = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      if (!selectedClient) {
        return;
      }

      setDownloadingCsv(true);
      try {
        await reportService.exportBudgetActualCsv(selectedClient.id, {
          fiscalYear,
          language
        });
      } catch (err) {
        console.error('CSV download failed:', err);
        setError('Failed to download CSV. Please try again.');
      } finally {
        setDownloadingCsv(false);
      }
    },
    [selectedClient, language, fiscalYear]
  );

  const handleRetry = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const isGenerateDisabled = !fiscalYear || loading;

  const hasReport = !!reportData && !!htmlPreview;
  const isPdfDisabled = !hasReport || loading || downloadingPdf;
  const isCsvDisabled = !hasReport || loading || downloadingCsv;

  // Automatically generate report whenever fiscal year or language changes
  useEffect(() => {
    if (!selectedClient || !fiscalYear) {
      return;
    }
    handleGenerate();
  }, [handleGenerate, selectedClient, fiscalYear, language]);

  if (!selectedClient) {
    return (
      <div className="reports-tab-content">
        <div className="reports-placeholder">
          <p>Please select a client to generate Budget vs Actual reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-tab-content budget-actual-tab">
      <div className="budget-actual-header-row">
        <h2 className="budget-actual-title">Budget vs Actual</h2>
      </div>

      <div className="budget-actual-controls">
        <div className="control-group">
          <label htmlFor="budget-actual-fiscal-year">Year:</label>
          <select
            id="budget-actual-fiscal-year"
            className="budget-actual-select"
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
          className="budget-actual-generate-button"
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

      <div className="budget-actual-preview">
        {(downloadingPdf || downloadingCsv) && (
          <div className="budget-actual-preview-overlay">
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
          <div className="budget-actual-preview-loading">
            <LoadingSpinner
              show={true}
              variant="logo"
              size="large"
              message={`Generating Budget vs Actual report for ${fiscalYear ? `FY ${fiscalYear}` : 'selected year'}...`}
              fullScreen={false}
            />
          </div>
        )}

        {!loading && error && (
          <div className="budget-actual-preview-error">
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
          <div className="budget-actual-preview-empty">
            <h3>📊 Select a fiscal year above to generate report</h3>
            <p>
              The Budget vs Actual report will show:
            </p>
            <ul>
              <li>Income categories with budget vs actual comparison</li>
              <li>Expense categories with budget vs actual comparison</li>
              <li>Special Assessments fund accounting</li>
              <li>Variance analysis with color coding</li>
            </ul>
          </div>
        )}

        {!loading && !error && hasGenerated && htmlPreview && (
          <div className="budget-actual-preview-frame-container">
            <iframe
              title="Budget vs Actual Preview"
              srcDoc={htmlPreview}
              className="budget-actual-preview-frame"
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

export default BudgetActualTab;

