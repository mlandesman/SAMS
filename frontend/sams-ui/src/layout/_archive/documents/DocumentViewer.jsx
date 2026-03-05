/**
 * DocumentViewer component for full-size document viewing
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faDownload, 
  faChevronLeft, 
  faChevronRight,
  faSearchPlus,
  faSearchMinus,
  faExpand
} from '@fortawesome/free-solid-svg-icons';
import './DocumentViewer.css';

const DocumentViewer = ({ 
  document, 
  documents = [], 
  isOpen, 
  onClose, 
  onDownload = () => {} 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);

  // Handle navigation - defined before early return
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < documents.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, documents.length]);

  // Update current index when document changes
  useEffect(() => {
    if (document && documents.length > 0) {
      const index = documents.findIndex(doc => doc.id === document.id);
      setCurrentIndex(index >= 0 ? index : 0);
    }
  }, [document, documents]);

  // Reset zoom when document changes
  useEffect(() => {
    setZoom(1);
    setLoading(true);
  }, [currentIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return;
      
      const hasMultiple = documents.length > 1;
      
      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasMultiple) goToPrevious();
          break;
        case 'ArrowRight':
          if (hasMultiple) goToNext();
          break;
        case '+':
        case '=':
          setZoom(prev => Math.min(prev + 0.25, 3));
          break;
        case '-':
          setZoom(prev => Math.max(prev - 0.25, 0.25));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, documents.length, goToPrevious, goToNext, onClose]);

  if (!isOpen || !document) return null;

  const currentDocument = documents.length > 0 ? documents[currentIndex] : document;
  const hasMultiple = documents.length > 1;

  // Handle download
  const handleDownload = () => {
    onDownload(currentDocument);
  };

  // Zoom controls
  const zoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
  const resetZoom = () => setZoom(1);

  // Check if document is an image
  const isImage = currentDocument.mimeType && currentDocument.mimeType.startsWith('image/');
  const isPDF = currentDocument.mimeType && currentDocument.mimeType.includes('pdf');

  return (
    <div className="document-viewer-overlay" onClick={onClose}>
      <div className="document-viewer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="viewer-header">
          <div className="document-info">
            <h3>{currentDocument.filename || currentDocument.originalName}</h3>
            {hasMultiple && (
              <span className="document-counter">
                {currentIndex + 1} of {documents.length}
              </span>
            )}
          </div>
          
          <div className="viewer-controls">
            {/* Zoom controls for images */}
            {isImage && (
              <>
                <button 
                  className="control-button" 
                  onClick={zoomOut}
                  disabled={zoom <= 0.25}
                  title="Zoom Out"
                >
                  <FontAwesomeIcon icon={faSearchMinus} />
                </button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button 
                  className="control-button" 
                  onClick={zoomIn}
                  disabled={zoom >= 3}
                  title="Zoom In"
                >
                  <FontAwesomeIcon icon={faSearchPlus} />
                </button>
                <button 
                  className="control-button" 
                  onClick={resetZoom}
                  title="Reset Zoom"
                >
                  <FontAwesomeIcon icon={faExpand} />
                </button>
              </>
            )}
            
            {/* Download button - only for images since PDFs have built-in download */}
            {isImage && currentDocument.downloadURL && (
              <button 
                className="control-button" 
                onClick={handleDownload}
                title="Download Image"
              >
                <FontAwesomeIcon icon={faDownload} />
              </button>
            )}
            
            {/* Close button */}
            <button 
              className="control-button close-button" 
              onClick={onClose}
              title="Close"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>

        {/* Navigation for multiple documents */}
        {hasMultiple && (
          <>
            <button 
              className="nav-button nav-previous"
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              title="Previous Document"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            
            <button 
              className="nav-button nav-next"
              onClick={goToNext}
              disabled={currentIndex === documents.length - 1}
              title="Next Document"
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </>
        )}

        {/* Document content */}
        <div className="viewer-content">
          {loading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Loading document...</p>
            </div>
          )}
          
          {isImage ? (
            <img
              src={currentDocument.downloadURL}
              alt={currentDocument.filename}
              className="document-image"
              style={{ transform: `scale(${zoom})` }}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          ) : isPDF ? (
            <iframe
              src={currentDocument.downloadURL}
              className="document-pdf"
              title={currentDocument.filename}
              onLoad={() => setLoading(false)}
            />
          ) : (
            <div className="unsupported-document">
              <p>Document preview not available</p>
              <button className="download-button" onClick={handleDownload}>
                <FontAwesomeIcon icon={faDownload} />
                Download to view
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
