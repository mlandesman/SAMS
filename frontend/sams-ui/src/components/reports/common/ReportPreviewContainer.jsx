/**
 * ReportPreviewContainer Component
 * Reusable HTML preview container with iframe, zoom, loading, and error states
 * Extracted from StatementOfAccountTab and BudgetActualTab
 */
import React, { useEffect, useRef, useState } from 'react';
import LoadingSpinner from '../../common/LoadingSpinner';
import './ReportCommon.css';

function ReportPreviewContainer({
  htmlContent,
  zoom = 1.0,
  zoomMode = 'custom', // 'custom', 'page-width', 'single-page'
  loading = false,
  error = null,
  emptyMessage = 'Select options above to generate report',
  emptyDetails = [],
  onRetry,
  loadingMessage = 'Generating report...',
  overlayLoading = false,  // For PDF/CSV download overlays
  overlayMessage = '',
  children,  // For custom empty state content
  onZoomCalculated  // Callback when zoom is calculated dynamically
}) {
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const [calculatedZoom, setCalculatedZoom] = useState(zoom);

  // Calculate dynamic zoom for page-width and single-page modes
  useEffect(() => {
    if (zoomMode === 'custom' || !htmlContent || !iframeRef.current || !containerRef.current) {
      setCalculatedZoom(zoom);
      return;
    }

    const calculateZoom = () => {
      try {
        const iframe = iframeRef.current;
        const container = containerRef.current;
        
        if (!iframe || !container || !iframe.contentWindow) {
          return;
        }

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (!iframeDoc || !iframeDoc.body) {
          return;
        }

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Get content dimensions
        const contentWidth = iframeDoc.body.scrollWidth || iframeDoc.body.offsetWidth;
        const contentHeight = iframeDoc.body.scrollHeight || iframeDoc.body.offsetHeight;

        let newZoom = zoom;

        if (zoomMode === 'page-width') {
          // Calculate zoom to fit page width (assuming 8.5" = 816px standard)
          const pageWidth = Math.max(contentWidth, 816); // Use content width or standard page width
          newZoom = Math.min(containerWidth / pageWidth, 1.0); // Don't zoom in beyond 100%
        } else if (zoomMode === 'single-page') {
          // Calculate zoom to fit single page height (assuming 11" = 1056px standard)
          const pageHeight = Math.max(contentHeight, 1056); // Use content height or standard page height
          const pageWidth = Math.max(contentWidth, 816);
          const zoomForHeight = containerHeight / pageHeight;
          const zoomForWidth = containerWidth / pageWidth;
          newZoom = Math.min(zoomForHeight, zoomForWidth, 1.0); // Fit both dimensions, don't zoom in beyond 100%
        }

        if (newZoom !== calculatedZoom) {
          setCalculatedZoom(newZoom);
          if (onZoomCalculated) {
            onZoomCalculated(newZoom);
          }
        }
      } catch (e) {
        // Cross-origin or other errors - fall back to default zoom
        console.warn('Could not calculate dynamic zoom:', e);
        setCalculatedZoom(zoom);
      }
    };

    // Wait for iframe to load
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', calculateZoom);
      // Also try immediately in case content is already loaded
      setTimeout(calculateZoom, 100);
    }

    return () => {
      if (iframe) {
        iframe.removeEventListener('load', calculateZoom);
      }
    };
  }, [zoomMode, htmlContent, zoom, calculatedZoom, onZoomCalculated]);

  // Update calculated zoom when zoom prop changes (for custom mode)
  useEffect(() => {
    if (zoomMode === 'custom') {
      setCalculatedZoom(zoom);
    }
  }, [zoom, zoomMode]);
  // Render loading state
  if (loading && !overlayLoading) {
    return (
      <div className="report-preview report-preview-loading">
        <LoadingSpinner
          show={true}
          variant="logo"
          size="large"
          message={loadingMessage}
          fullScreen={false}
        />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="report-preview report-preview-error">
        <p>{error}</p>
        {onRetry && (
          <button type="button" className="secondary-button" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  // Render empty state
  if (!htmlContent) {
    return (
      <div className="report-preview report-preview-empty">
        <h3>{emptyMessage}</h3>
        {emptyDetails.length > 0 && (
          <>
            <p>The report will show:</p>
            <ul>
              {emptyDetails.map((detail, idx) => (
                <li key={idx}>{detail}</li>
              ))}
            </ul>
          </>
        )}
        {children}
      </div>
    );
  }

  // Use calculated zoom for dynamic modes, otherwise use provided zoom
  const effectiveZoom = zoomMode === 'custom' ? zoom : calculatedZoom;

  // Render preview with optional overlay
  return (
    <div className="report-preview" ref={containerRef}>
      {overlayLoading && (
        <div className="report-preview-overlay">
          <LoadingSpinner
            show={true}
            variant="logo"
            size="large"
            message={overlayMessage}
            fullScreen={false}
          />
        </div>
      )}
      <div className="report-preview-frame-container">
        <iframe
          ref={iframeRef}
          title="Report Preview"
          srcDoc={htmlContent}
          className="report-preview-frame"
          style={{
            transform: `scale(${effectiveZoom})`,
            transformOrigin: 'top left',
            width: `${100 / effectiveZoom}%`,
            height: `${100 / effectiveZoom}%`
          }}
        />
      </div>
    </div>
  );
}

export default ReportPreviewContainer;
