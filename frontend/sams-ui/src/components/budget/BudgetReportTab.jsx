/**
 * Budget Report Tab
 * Displays budget with year-over-year comparison
 * Uses shared report infrastructure
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';
import { ReportPreviewContainer, ReportControlBar } from '../reports/common';
import { getFiscalYear, getFiscalYearLabel } from '../../utils/fiscalYearUtils';
import { getMexicoDate } from '../../utils/timezone';
import reportService from '../../services/reportService';
import { printReport } from '../../utils/printUtils';
import './BudgetReportTab.css';

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

function buildFiscalYearOptions(availableYears, selectedClient) {
  if (!selectedClient || !availableYears || availableYears.length === 0) {
    return [];
  }

  let fiscalYearStartMonth = selectedClient.configuration?.fiscalYearStartMonth;
  if (typeof fiscalYearStartMonth !== 'number' || isNaN(fiscalYearStartMonth)) {
    fiscalYearStartMonth = 1;
  }

  // Use available budget years, sorted descending (highest first)
  return availableYears.map(year => ({
    value: year,
    label: getFiscalYearLabel(year, fiscalYearStartMonth)
  }));
}

function BudgetReportTab({ zoom = 1.0, zoomMode = 'custom' }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();

  const [fiscalYear, setFiscalYear] = useState(null);
  const [language, setLanguage] = useState('english');
  const [availableYears, setAvailableYears] = useState([]);
  const [loadingYears, setLoadingYears] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [htmlPreview, setHtmlPreview] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Load available budget years when client changes
  useEffect(() => {
    const loadAvailableYears = async () => {
      if (!selectedClient) {
        setAvailableYears([]);
        setFiscalYear(null);
        return;
      }

      setLoadingYears(true);
      try {
        const years = await reportService.getAvailableBudgetYears(selectedClient.id);
        setAvailableYears(years);
        
        // Set to highest available year (first in sorted descending array)
        if (years.length > 0) {
          setFiscalYear(years[0]);
        }
      } catch (err) {
        console.error('Failed to load available budget years:', err);
        setError('Failed to load available budget years. Please try again.');
        setAvailableYears([]);
      } finally {
        setLoadingYears(false);
      }
    };

    loadAvailableYears();
  }, [selectedClient]);

  // Initialize language when client or user changes
  useEffect(() => {
    if (!selectedClient) {
      return;
    }

    setLanguage(getDefaultLanguage({ selectedClient, samsUser }));
  }, [selectedClient, samsUser]);

  const fiscalYearOptions = useMemo(
    () => buildFiscalYearOptions(availableYears, selectedClient),
    [availableYears, selectedClient]
  );

  const handleGenerate = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      if (!selectedClient) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Pass fiscalYear (or null to use highest available)
        const html = await reportService.getBudgetReportHtml(
          selectedClient.id,
          fiscalYear,
          language
        );

        setHtmlPreview(html);
        setHasGenerated(true);
      } catch (err) {
        console.error('Budget report generation error:', err);
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
        await reportService.exportBudgetReportPdf(selectedClient.id, {
          fiscalYear,
          language,
          html: htmlPreview
        });
      } catch (err) {
        console.error('PDF download failed:', err);
        setError('Failed to download PDF. Please try again.');
      } finally {
        setDownloadingPdf(false);
      }
    },
    [selectedClient, language, fiscalYear, htmlPreview]
  );

  const handleRetry = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const handlePrint = useCallback(() => {
    printReport('.report-preview-frame');
  }, []);

  const isGenerateDisabled = !fiscalYear || loading || loadingYears || availableYears.length === 0;

  const hasReport = !!htmlPreview;
  const isPdfDisabled = !hasReport || loading || downloadingPdf;
  const isPrintDisabled = !hasReport || loading;

  // Automatically generate report whenever fiscal year or language changes
  useEffect(() => {
    if (!selectedClient || !fiscalYear || loadingYears) {
      return;
    }
    handleGenerate();
  }, [handleGenerate, selectedClient, fiscalYear, language, loadingYears]);

  if (!selectedClient) {
    return (
      <div className="reports-tab-content">
        <div className="reports-placeholder">
          <p>Please select a client to generate Budget reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-tab-content budget-report-tab">
      <div className="budget-report-header-row">
        <h2 className="budget-report-title">Budget Report</h2>
      </div>

      <ReportControlBar
        onGenerate={handleGenerate}
        generateLabel="Generate"
        generateDisabled={isGenerateDisabled}
        generating={loading}
        onPrint={handlePrint}
        printDisabled={isPrintDisabled}
        onDownloadPdf={handleDownloadPdf}
        pdfDisabled={isPdfDisabled}
        downloadingPdf={downloadingPdf}
      >
        <div className="control-group">
          <label htmlFor="budget-report-fiscal-year">Year:</label>
          <select
            id="budget-report-fiscal-year"
            className="budget-report-select"
            value={fiscalYear ?? ''}
            onChange={e => setFiscalYear(e.target.value ? Number(e.target.value) : null)}
            disabled={loadingYears || availableYears.length === 0}
          >
            {loadingYears ? (
              <option>Loading years...</option>
            ) : availableYears.length === 0 ? (
              <option>No budget years available</option>
            ) : (
              fiscalYearOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            )}
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
      </ReportControlBar>

      <ReportPreviewContainer
        htmlContent={htmlPreview}
        zoom={zoom}
        zoomMode={zoomMode}
        loading={loading}
        error={error}
        emptyMessage="Select a fiscal year above to generate report"
        emptyDetails={[
          'Prior year budget amounts',
          'Current year budget amounts',
          'Year-over-year changes ($ and %)',
          'Income and expense categories',
          'Reserve summary'
        ]}
        onRetry={handleRetry}
        loadingMessage={`Generating Budget Report for ${fiscalYear ? `FY ${fiscalYear}` : 'selected year'}...`}
        overlayLoading={downloadingPdf}
        overlayMessage="Preparing PDF..."
      />
    </div>
  );
}

export default BudgetReportTab;
