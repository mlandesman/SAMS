/**
 * ReportControlBar Component
 * Reusable control bar with action buttons (Generate, CSV, PDF, Email, Print)
 * Extracted from StatementOfAccountTab and BudgetActualTab
 */
import React from 'react';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GetAppIcon from '@mui/icons-material/GetApp';
import EmailIcon from '@mui/icons-material/Email';
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
  onPrint,
  csvDisabled = true,
  pdfDisabled = true,
  emailDisabled = true,
  printDisabled = true,
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
        {onPrint && (
          <button
            type="button"
            className="secondary-button"
            onClick={onPrint}
            disabled={printDisabled}
            title="Print report"
          >
            <LocalPrintshopIcon style={{ fontSize: 16, marginRight: 4 }} />
            Print
          </button>
        )}
        {onDownloadCsv && (
          <button
            type="button"
            className="secondary-button"
            onClick={onDownloadCsv}
            disabled={csvDisabled || downloadingCsv}
          >
            <GetAppIcon style={{ fontSize: 16, marginRight: 4 }} />
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
            <PictureAsPdfIcon style={{ fontSize: 16, marginRight: 4 }} />
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
            <EmailIcon style={{ fontSize: 16, marginRight: 4 }} />
            Email
          </button>
        )}
      </div>
    </div>
  );
}

export default ReportControlBar;
