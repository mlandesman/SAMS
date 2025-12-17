/**
 * ReportControlBar Component
 * Reusable control bar with action buttons (Generate, CSV, PDF, Email)
 * Extracted from StatementOfAccountTab and BudgetActualTab
 */
import React from 'react';
import './ReportCommon.css';

function ReportControlBar({
  // Generate button
  onGenerate,
  generateLabel = 'Generate',
  generateDisabled = false,
  generating = false,
  
  // Export buttons
  onDownloadCsv,
  onDownloadPdf,
  onEmail,
  csvDisabled = true,
  pdfDisabled = true,
  emailDisabled = true,
  downloadingCsv = false,
  downloadingPdf = false,
  
  // Children are custom controls (selectors, toggles, etc.)
  children
}) {
  return (
    <div className="report-controls">
      {children}
      
      <button
        type="button"
        className="report-generate-button"
        onClick={onGenerate}
        disabled={generateDisabled || generating}
      >
        {generating ? 'Generating...' : generateLabel}
      </button>

      <div className="action-buttons">
        {onDownloadCsv && (
          <button
            type="button"
            className="secondary-button"
            onClick={onDownloadCsv}
            disabled={csvDisabled || downloadingCsv}
          >
            {downloadingCsv ? 'CSV…' : 'CSV'}
          </button>
        )}
        {onDownloadPdf && (
          <button
            type="button"
            className="secondary-button"
            onClick={onDownloadPdf}
            disabled={pdfDisabled || downloadingPdf}
          >
            {downloadingPdf ? 'PDF…' : 'PDF'}
          </button>
        )}
        {onEmail && (
          <button
            type="button"
            className="secondary-button"
            onClick={onEmail}
            disabled={emailDisabled}
            title={emailDisabled ? 'Coming soon' : 'Email report'}
          >
            Email
          </button>
        )}
      </div>
    </div>
  );
}

export default ReportControlBar;
