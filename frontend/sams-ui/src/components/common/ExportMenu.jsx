import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport, faFileCsv, faEnvelope, faFilePdf } from '@fortawesome/free-solid-svg-icons';
import './ExportMenu.css';

/**
 * Reusable Export Menu Component
 * 
 * @param {Object} props
 * @param {function} props.onExportCSV - Handler for CSV export (required)
 * @param {function} [props.onExportEmail] - Handler for Email export (optional)
 * @param {function} [props.onExportPDF] - Handler for PDF export (optional)
 * @param {boolean} [props.disabled] - Disable all export options
 * @param {boolean} [props.loading] - Show loading state
 * @param {string} [props.loadingText] - Text to show while loading
 */
function ExportMenu({ 
  onExportCSV, 
  onExportEmail, 
  onExportPDF, 
  disabled = false,
  loading = false,
  loadingText = 'Exporting...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (handler) => {
    setIsOpen(false);
    handler?.();
  };

  if (loading) {
    return (
      <button className="export-menu-button loading" disabled>
        <span className="export-spinner" />
        {loadingText}
      </button>
    );
  }

  return (
    <div className="export-menu-container" ref={menuRef}>
      <button 
        className="export-menu-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <FontAwesomeIcon icon={faFileExport} />
        <span>Export</span>
      </button>
      
      {isOpen && (
        <div className="export-menu-dropdown">
          <button 
            className="export-menu-item"
            onClick={() => handleExport(onExportCSV)}
          >
            <FontAwesomeIcon icon={faFileCsv} />
            <span>CSV</span>
          </button>
          
          {onExportEmail && (
            <button 
              className="export-menu-item"
              onClick={() => handleExport(onExportEmail)}
            >
              <FontAwesomeIcon icon={faEnvelope} />
              <span>Email</span>
            </button>
          )}
          
          {onExportPDF && (
            <button 
              className="export-menu-item"
              onClick={() => handleExport(onExportPDF)}
            >
              <FontAwesomeIcon icon={faFilePdf} />
              <span>PDF</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
