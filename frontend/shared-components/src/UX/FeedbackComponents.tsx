/**
 * Real-time Feedback UI Components for Enterprise Backend Integration
 * FRONTEND-ALIGNMENT-001 - Phase 3.2
 * 
 * Provides intelligent feedback UI components that respond to enterprise
 * backend operations with real-time user feedback
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useFeedback, FeedbackItem, FeedbackType, ProgressFeedbackController } from './FeedbackSystem';

/**
 * Toast notification component with enterprise features
 */
export const FeedbackToast: React.FC<{
  feedback: FeedbackItem;
  onDismiss?: (id: string) => void;
  onAction?: (feedbackId: string, action: string) => void;
  className?: string;
}> = ({ feedback, onDismiss, onAction, className = '' }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (feedback.duration && feedback.duration > 0) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressPercent = (elapsed / feedback.duration!) * 100;
        setProgress(Math.min(progressPercent, 100));

        if (elapsed >= feedback.duration!) {
          clearInterval(interval);
          setIsVisible(false);
          setTimeout(() => onDismiss?.(feedback.id), 300);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [feedback.duration, feedback.id, onDismiss]);

  const getTypeStyles = (type: FeedbackType) => {
    const styles = {
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800',
      progress: 'bg-blue-50 border-blue-200 text-blue-800',
      optimistic: 'bg-purple-50 border-purple-200 text-purple-800',
      rollback: 'bg-orange-50 border-orange-200 text-orange-800'
    };
    return styles[type] || styles.info;
  };

  const getTypeIcon = (type: FeedbackType) => {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      progress: '🔄',
      optimistic: '⚡',
      rollback: '↩️'
    };
    return icons[type] || icons.info;
  };

  const getProgressFromMetadata = () => {
    return feedback.metadata?.progress || 0;
  };

  return (
    <div 
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden
        ${className}
      `}
    >
      {/* Progress bar for timed feedback */}
      {feedback.duration && feedback.duration > 0 && (
        <div className="absolute top-0 left-0 h-1 bg-gray-200 w-full">
          <div 
            className="h-full bg-blue-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className={`p-4 border-l-4 ${getTypeStyles(feedback.type)}`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-lg">{getTypeIcon(feedback.type)}</span>
          </div>
          
          <div className="ml-3 w-0 flex-1">
            {feedback.title && (
              <p className="text-sm font-medium">
                {feedback.title}
              </p>
            )}
            <p className={`text-sm ${feedback.title ? 'mt-1' : ''}`}>
              {feedback.message}
            </p>
            
            {/* Progress indicator for progress type */}
            {feedback.type === 'progress' && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>Progress</span>
                  <span>{Math.round(getProgressFromMetadata())}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressFromMetadata()}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            {feedback.actions && feedback.actions.length > 0 && (
              <div className="mt-3 flex space-x-2">
                {feedback.actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      action.handler?.();
                      onAction?.(feedback.id, action.action);
                    }}
                    className={`
                      px-3 py-1 rounded text-xs font-medium transition-colors
                      ${action.style === 'primary' 
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : action.style === 'danger'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      }
                    `}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Enterprise context info */}
            {feedback.context && (
              <div className="mt-2 text-xs text-gray-500">
                {feedback.context.operationType && (
                  <span className="inline-block bg-gray-100 px-2 py-1 rounded mr-2">
                    {feedback.context.operationType}
                  </span>
                )}
                {feedback.context.entityType && (
                  <span className="inline-block bg-gray-100 px-2 py-1 rounded">
                    {feedback.context.entityType}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => {
                setIsVisible(false);
                setTimeout(() => onDismiss?.(feedback.id), 300);
              }}
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Feedback container with positioning
 */
export const FeedbackContainer: React.FC<{
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
  maxItems?: number;
  enableAnimations?: boolean;
  className?: string;
}> = ({ 
  position = 'top-right',
  maxItems = 5,
  enableAnimations = true,
  className = ''
}) => {
  const { activeFeedback, dismissFeedback } = useFeedback();
  
  const positionClasses = {
    'top-right': 'fixed top-4 right-4 z-50',
    'top-left': 'fixed top-4 left-4 z-50',
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50',
    'center': 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50'
  };

  const visibleFeedback = activeFeedback.slice(0, maxItems);

  if (visibleFeedback.length === 0) {
    return null;
  }

  return (
    <div className={`${positionClasses[position]} space-y-2 ${className}`}>
      {visibleFeedback.map((feedback, index) => (
        <FeedbackToast
          key={feedback.id}
          feedback={feedback}
          onDismiss={dismissFeedback}
          className={enableAnimations ? `animation-delay-${index * 100}` : ''}
        />
      ))}
    </div>
  );
};

/**
 * Inline feedback component for form validation
 */
export const InlineFeedback: React.FC<{
  type: FeedbackType;
  message: string;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  className?: string;
}> = ({ 
  type, 
  message, 
  size = 'medium',
  showIcon = true,
  className = '' 
}) => {
  const getTypeStyles = (type: FeedbackType) => {
    const styles = {
      success: 'text-green-600 bg-green-50 border-green-200',
      error: 'text-red-600 bg-red-50 border-red-200',
      warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      info: 'text-blue-600 bg-blue-50 border-blue-200',
      progress: 'text-blue-600 bg-blue-50 border-blue-200',
      optimistic: 'text-purple-600 bg-purple-50 border-purple-200',
      rollback: 'text-orange-600 bg-orange-50 border-orange-200'
    };
    return styles[type] || styles.info;
  };

  const sizeClasses = {
    small: 'text-xs px-2 py-1',
    medium: 'text-sm px-3 py-2',
    large: 'text-base px-4 py-3'
  };

  const getIcon = (type: FeedbackType) => {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '!',
      info: 'i',
      progress: '…',
      optimistic: '⚡',
      rollback: '↩'
    };
    return icons[type] || icons.info;
  };

  return (
    <div className={`
      inline-flex items-center rounded border
      ${getTypeStyles(type)}
      ${sizeClasses[size]}
      ${className}
    `}>
      {showIcon && (
        <span className="mr-2 font-bold">
          {getIcon(type)}
        </span>
      )}
      <span>{message}</span>
    </div>
  );
};

/**
 * Floating action feedback for buttons
 */
export const ActionFeedback: React.FC<{
  isLoading?: boolean;
  success?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ 
  isLoading = false, 
  success = false, 
  error, 
  children, 
  className = '' 
}) => {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <div className={`relative inline-block ${className}`}>
      {children}
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
        </div>
      )}
      
      {/* Success overlay */}
      {showSuccess && (
        <div className="absolute inset-0 bg-green-500 bg-opacity-90 flex items-center justify-center rounded transition-all duration-500">
          <span className="text-white font-bold">✓</span>
        </div>
      )}
      
      {/* Error tooltip */}
      {error && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-red-600 text-white text-sm rounded shadow-lg whitespace-nowrap">
          {error}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-red-600" />
        </div>
      )}
    </div>
  );
};

/**
 * Progress feedback overlay
 */
export const ProgressOverlay: React.FC<{
  isVisible: boolean;
  progress: number;
  message: string;
  onCancel?: () => void;
  className?: string;
}> = ({ 
  isVisible, 
  progress, 
  message, 
  onCancel,
  className = '' 
}) => {
  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {message}
        </h3>
        
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
        
        {onCancel && (
          <div className="flex justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Status indicator with real-time feedback
 */
export const StatusIndicator: React.FC<{
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  size?: 'small' | 'medium' | 'large';
  showMessage?: boolean;
  className?: string;
}> = ({ 
  status, 
  message, 
  size = 'medium',
  showMessage = true,
  className = '' 
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  const getStatusElement = () => {
    switch (status) {
      case 'loading':
        return (
          <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`} />
        );
      case 'success':
        return (
          <div className={`bg-green-500 rounded-full flex items-center justify-center ${sizeClasses[size]}`}>
            <span className="text-white text-xs">✓</span>
          </div>
        );
      case 'error':
        return (
          <div className={`bg-red-500 rounded-full flex items-center justify-center ${sizeClasses[size]}`}>
            <span className="text-white text-xs">✕</span>
          </div>
        );
      default:
        return (
          <div className={`bg-gray-300 rounded-full ${sizeClasses[size]}`} />
        );
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {getStatusElement()}
      {showMessage && message && (
        <span className="text-sm text-gray-600">{message}</span>
      )}
    </div>
  );
};

/**
 * Enterprise feedback summary for monitoring
 */
export const FeedbackSummary: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  const { stats, activeFeedback } = useFeedback();
  
  if (activeFeedback.length === 0) {
    return null;
  }

  const criticalFeedback = activeFeedback.filter(f => f.urgency === 'critical').length;
  const errorFeedback = activeFeedback.filter(f => f.type === 'error').length;

  return (
    <div className={`bg-gray-50 border rounded-lg p-3 ${className}`}>
      <h4 className="text-sm font-medium text-gray-900 mb-2">System Feedback</h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span>Active:</span>
          <span className="font-medium">{stats.activeFeedback}</span>
        </div>
        <div className="flex justify-between">
          <span>Queued:</span>
          <span className="font-medium">{stats.queuedFeedback}</span>
        </div>
        {criticalFeedback > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Critical:</span>
            <span className="font-medium">{criticalFeedback}</span>
          </div>
        )}
        {errorFeedback > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Errors:</span>
            <span className="font-medium">{errorFeedback}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default {
  FeedbackToast,
  FeedbackContainer,
  InlineFeedback,
  ActionFeedback,
  ProgressOverlay,
  StatusIndicator,
  FeedbackSummary
};