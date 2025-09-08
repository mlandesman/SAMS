/**
 * Progressive Enhancement UI Components for Enterprise Backend Integration
 * FRONTEND-ALIGNMENT-001 - Phase 3.3
 * 
 * Provides UI components that automatically adapt based on device capabilities
 * and enterprise backend availability with graceful degradation
 */

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { useProgressiveEnhancement, EnhancementLevel } from './ProgressiveEnhancement';

/**
 * Feature gate component - only renders children if feature is available
 */
export const FeatureGate: React.FC<{
  feature: string;
  fallback?: ReactNode;
  children: ReactNode;
  className?: string;
}> = ({ feature, fallback = null, children, className = '' }) => {
  const { isFeatureAvailable, enhancementResult } = useProgressiveEnhancement();

  if (!enhancementResult) {
    // Show loading state while detecting capabilities
    return (
      <div className={`progressive-loading ${className}`}>
        <div className="animate-pulse bg-gray-200 rounded h-8 w-32" />
      </div>
    );
  }

  const available = isFeatureAvailable(feature);

  return (
    <div className={className}>
      {available ? children : fallback}
    </div>
  );
};

/**
 * Adaptive component that renders different content based on enhancement level
 */
export const AdaptiveComponent: React.FC<{
  baseline?: ReactNode;
  enhanced?: ReactNode;
  premium?: ReactNode;
  className?: string;
}> = ({ baseline, enhanced, premium, className = '' }) => {
  const { enhancementResult } = useProgressiveEnhancement();

  if (!enhancementResult) {
    return (
      <div className={`progressive-loading ${className}`}>
        <div className="animate-pulse bg-gray-200 rounded h-8 w-full" />
      </div>
    );
  }

  const getContentForLevel = (level: EnhancementLevel): ReactNode => {
    switch (level) {
      case 'premium':
        return premium || enhanced || baseline;
      case 'enhanced':
        return enhanced || baseline;
      case 'baseline':
      default:
        return baseline;
    }
  };

  return (
    <div className={className}>
      {getContentForLevel(enhancementResult.level)}
    </div>
  );
};

/**
 * Progressive image component with adaptive loading
 */
export const ProgressiveImage: React.FC<{
  src: string;
  lowQualitySrc?: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}> = ({ src, lowQualitySrc, alt, className = '', onLoad, onError }) => {
  const { enhancementResult } = useProgressiveEnhancement();
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!enhancementResult) return;

    // Determine image source based on capabilities
    const shouldUseLowQuality = 
      enhancementResult.capabilities.connectionType === 'slow-2g' ||
      enhancementResult.capabilities.connectionType === '2g' ||
      enhancementResult.capabilities.prefersDataSaver;

    const targetSrc = shouldUseLowQuality && lowQualitySrc ? lowQualitySrc : src;

    // Preload image
    const img = new Image();
    img.onload = () => {
      setImageSrc(targetSrc);
      setIsLoading(false);
      onLoad?.();
    };
    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
      onError?.();
    };
    img.src = targetSrc;
  }, [src, lowQualitySrc, enhancementResult, onLoad, onError]);

  if (hasError) {
    return (
      <div className={`progressive-image-error bg-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-sm">Image unavailable</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`progressive-image-loading bg-gray-200 animate-pulse ${className}`} />
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={`progressive-image ${className}`}
    />
  );
};

/**
 * Progressive form component with adaptive validation
 */
export const ProgressiveForm: React.FC<{
  onSubmit: (data: any) => Promise<void>;
  enableRealTimeValidation?: boolean;
  enableAutosave?: boolean;
  children: ReactNode;
  className?: string;
}> = ({ 
  onSubmit, 
  enableRealTimeValidation = true, 
  enableAutosave = true, 
  children, 
  className = '' 
}) => {
  const { enhancementResult, isFeatureAvailable } = useProgressiveEnhancement();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const realTimeValidationAvailable = isFeatureAvailable('real-time-validation');
  const autosaveAvailable = isFeatureAvailable('autosave');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const data = Object.fromEntries(formData.entries());
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className={`progressive-form ${className}`}
      data-enhancement-level={enhancementResult?.level}
      data-real-time-validation={realTimeValidationAvailable && enableRealTimeValidation}
      data-autosave={autosaveAvailable && enableAutosave}
    >
      {children}
      
      {/* Progressive submit button */}
      <div className="mt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`
            px-4 py-2 rounded transition-colors
            ${isSubmitting 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }
          `}
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Submitting...
            </span>
          ) : (
            'Submit'
          )}
        </button>
      </div>
    </form>
  );
};

/**
 * Progressive table component with adaptive loading and pagination
 */
export const ProgressiveTable: React.FC<{
  data: any[];
  columns: Array<{ key: string; label: string; sortable?: boolean }>;
  enableVirtualization?: boolean;
  enableInfiniteScroll?: boolean;
  pageSize?: number;
  className?: string;
}> = ({ 
  data, 
  columns, 
  enableVirtualization = true, 
  enableInfiniteScroll = true,
  pageSize = 50,
  className = '' 
}) => {
  const { enhancementResult, isFeatureAvailable } = useProgressiveEnhancement();
  const [currentPage, setCurrentPage] = useState(0);

  const virtualizationAvailable = isFeatureAvailable('virtualization');
  const infiniteScrollAvailable = isFeatureAvailable('infinite-scroll');

  // Determine display strategy based on capabilities
  const useVirtualization = virtualizationAvailable && enableVirtualization && data.length > 100;
  const useInfiniteScroll = infiniteScrollAvailable && enableInfiniteScroll && !useVirtualization;
  
  // Paginate data for lower-end devices
  const effectivePageSize = enhancementResult?.level === 'baseline' ? 20 : pageSize;
  const paginatedData = useInfiniteScroll 
    ? data.slice(0, (currentPage + 1) * effectivePageSize)
    : data.slice(currentPage * effectivePageSize, (currentPage + 1) * effectivePageSize);

  return (
    <div className={`progressive-table ${className}`}>
      {/* Capability indicator */}
      <div className="text-xs text-gray-500 mb-2">
        Enhancement Level: {enhancementResult?.level} 
        {useVirtualization && ' • Virtualization Active'}
        {useInfiniteScroll && ' • Infinite Scroll Active'}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr>
              {columns.map((column) => (
                <th 
                  key={column.key}
                  className="border border-gray-300 px-4 py-2 bg-gray-50 text-left"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td 
                    key={column.key}
                    className="border border-gray-300 px-4 py-2"
                  >
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {!useInfiniteScroll && (
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage + 1} of {Math.ceil(data.length / effectivePageSize)}
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={(currentPage + 1) * effectivePageSize >= data.length}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Infinite scroll trigger */}
      {useInfiniteScroll && paginatedData.length < data.length && (
        <div className="text-center mt-4">
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Load More ({data.length - paginatedData.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Connection status indicator with progressive enhancement
 */
export const ConnectionStatus: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  const { enhancementResult } = useProgressiveEnhancement();

  if (!enhancementResult) return null;

  const { capabilities, level } = enhancementResult;

  const getStatusColor = () => {
    if (!capabilities.isOnline) return 'text-red-600';
    if (level === 'premium') return 'text-green-600';
    if (level === 'enhanced') return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getStatusIcon = () => {
    if (!capabilities.isOnline) return '📵';
    if (level === 'premium') return '🚀';
    if (level === 'enhanced') return '⚡';
    return '🐌';
  };

  const getStatusMessage = () => {
    if (!capabilities.isOnline) return 'Offline';
    if (level === 'premium') return 'Premium features available';
    if (level === 'enhanced') return 'Enhanced features available';
    return 'Basic features only';
  };

  return (
    <div className={`connection-status flex items-center space-x-2 ${className}`}>
      <span className="text-lg">{getStatusIcon()}</span>
      <span className={`text-sm font-medium ${getStatusColor()}`}>
        {getStatusMessage()}
      </span>
      <span className="text-xs text-gray-500">
        ({capabilities.connectionType})
      </span>
    </div>
  );
};

/**
 * Capability summary component for debugging
 */
export const CapabilitySummary: React.FC<{
  showDetails?: boolean;
  className?: string;
}> = ({ showDetails = false, className = '' }) => {
  const { enhancementResult } = useProgressiveEnhancement();
  const [expanded, setExpanded] = useState(showDetails);

  if (!enhancementResult) return null;

  const { capabilities, level, availableFeatures, recommendations } = enhancementResult;

  return (
    <div className={`capability-summary bg-gray-50 border rounded-lg p-4 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium text-gray-900">
          Device Capabilities ({level})
        </h4>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          {expanded ? 'Hide' : 'Show'} Details
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-600">Connection:</span>
          <span className="ml-1 font-medium">
            {capabilities.connectionType} {capabilities.isOnline ? '🟢' : '🔴'}
          </span>
        </div>
        <div>
          <span className="text-gray-600">Memory:</span>
          <span className="ml-1 font-medium">
            {capabilities.memory ? `${capabilities.memory}MB` : 'Unknown'}
          </span>
        </div>
        <div>
          <span className="text-gray-600">Features:</span>
          <span className="ml-1 font-medium">{availableFeatures.length}</span>
        </div>
        <div>
          <span className="text-gray-600">Battery:</span>
          <span className="ml-1 font-medium">
            {capabilities.batteryLevel ? `${Math.round(capabilities.batteryLevel * 100)}%` : 'Unknown'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2">
          <div>
            <h5 className="text-xs font-medium text-gray-700 mb-1">Available Features:</h5>
            <div className="flex flex-wrap gap-1">
              {availableFeatures.map(feature => (
                <span key={feature} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {recommendations.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-700 mb-1">Recommendations:</h5>
              <ul className="text-xs text-gray-600 space-y-1">
                {recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-1">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default {
  FeatureGate,
  AdaptiveComponent,
  ProgressiveImage,
  ProgressiveForm,
  ProgressiveTable,
  ConnectionStatus,
  CapabilitySummary
};