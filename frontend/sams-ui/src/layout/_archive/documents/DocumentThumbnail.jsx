/**
 * DocumentThumbnail component for displaying document previews
 */

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilePdf, faImage, faEye, faDownload } from '@fortawesome/free-solid-svg-icons';
import './DocumentThumbnail.css';

const DocumentThumbnail = ({ 
  document, 
  onClick = () => {}, 
  onDownload = () => {},
  showActions = true,
  showControls = true,
  mode = 'default',
  size = 'medium' 
}) => {
  const [imageError, setImageError] = useState(false);

  if (!document) return null;

  // Get file type icon
  const getFileIcon = () => {
    const mimeType = document.type || document.mimeType || '';
    if (mimeType.includes('pdf')) {
      return faFilePdf;
    } else if (mimeType.includes('image')) {
      return faImage;
    }
    return faFilePdf; // Default
  };

  // Check if document is an image that can be previewed
  const isImage = document.type ? document.type.startsWith('image/') : 
                 (document.mimeType && document.mimeType.startsWith('image/'));
  
  // For local files in preview mode, create object URL for preview
  const getPreviewUrl = () => {
    if (mode === 'preview' && document instanceof File) {
      return URL.createObjectURL(document);
    }
    return document.downloadURL;
  };
  
  const previewUrl = getPreviewUrl();
  const showImagePreview = isImage && !imageError && previewUrl;

  // Handle image load error
  const handleImageError = () => {
    setImageError(true);
  };

  // Handle thumbnail click
  const handleClick = () => {
    if (mode === 'preview') {
      // In preview mode, just log - don't open viewer
      console.log('📎 Preview mode: Clicked on', document.name || document.filename);
      return;
    }
    onClick(document);
  };

  // Handle download
  const handleDownload = (e) => {
    e.stopPropagation();
    if (mode === 'preview') {
      // Can't download local files
      console.log('📎 Preview mode: Download not available for local files');
      return;
    }
    onDownload(document);
  };

  // Get the display filename
  const getDisplayName = () => {
    if (document instanceof File) {
      return document.name;
    }
    return document.filename || document.originalName || 'Unknown File';
  };

  // Get file size for display
  const getFileSize = () => {
    if (document instanceof File) {
      return document.size;
    }
    return document.fileSize;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className={`document-thumbnail ${size} ${mode}`} onClick={handleClick}>
      <div className="thumbnail-content">
        {showImagePreview ? (
          <img
            src={previewUrl}
            alt={getDisplayName()}
            className="thumbnail-image"
            onError={handleImageError}
          />
        ) : (
          <div className="thumbnail-icon">
            <FontAwesomeIcon icon={getFileIcon()} />
          </div>
        )}
        
        {showActions && showControls && mode !== 'preview' && (
          <div className="thumbnail-overlay">
            <button 
              className="thumbnail-action view-action"
              title="View Document"
              onClick={handleClick}
            >
              <FontAwesomeIcon icon={faEye} />
            </button>
            {document.downloadURL && (
              <button 
                className="thumbnail-action download-action"
                title="Download Document"
                onClick={handleDownload}
              >
                <FontAwesomeIcon icon={faDownload} />
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="thumbnail-info">
        <div className="document-filename" title={getDisplayName()}>
          {getDisplayName()}
        </div>
        {getFileSize() && (
          <div className="document-size">
            {formatFileSize(getFileSize())}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentThumbnail;
