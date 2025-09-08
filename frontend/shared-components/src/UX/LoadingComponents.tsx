/**
 * Intelligent Loading UI Components for Enterprise Backend Integration
 * FRONTEND-ALIGNMENT-001 - Phase 3.1
 * 
 * Provides adaptive loading UI components that respond to enterprise
 * backend performance characteristics and user context
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLoadingState, LoadingStateInfo } from './LoadingStateManager';

/**
 * Loading spinner with enterprise backend awareness
 */
export const EnterpriseLoadingSpinner: React.FC<{
  loadingId?: string;
  size?: 'small' | 'medium' | 'large';
  message?: string;
  showProgress?: boolean;
  className?: string;
}> = ({ 
  loadingId, 
  size = 'medium', 
  message, 
  showProgress = false,
  className = '' 
}) => {
  const { getLoadingState } = useLoadingState();
  const loadingState = loadingId ? getLoadingState(loadingId) : null;
  
  const isLoading = loadingState?.state === 'loading' || loadingState?.state === 'slow';
  const progress = loadingState?.progress || 0;
  const currentMessage = loadingState?.message || message || 'Loading...';

  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  if (!isLoading && !loadingState) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`} />
      <div className="flex-1">
        <div className="text-sm text-gray-600">{currentMessage}</div>
        {showProgress && loadingState?.showProgress && (
          <div className="mt-1">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            {progress > 0 && (
              <div className="text-xs text-gray-500 mt-1">{Math.round(progress)}% complete</div>
            )}
          </div>
        )}
      </div>
      {loadingState?.canCancel && (
        <button
          onClick={() => {/* Cancel implementation */}}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

/**
 * Skeleton loader with adaptive patterns
 */
export const AdaptiveSkeletonLoader: React.FC<{
  loadingId?: string;
  variant?: 'text' | 'card' | 'table' | 'form' | 'custom';
  lines?: number;
  height?: string;
  className?: string;
  children?: React.ReactNode;
}> = ({ 
  loadingId, 
  variant = 'text', 
  lines = 3, 
  height = 'auto',
  className = '',
  children 
}) => {
  const { getLoadingState } = useLoadingState();
  const loadingState = loadingId ? getLoadingState(loadingId) : null;
  
  const shouldShow = loadingState?.showSkeleton || (!loadingId && variant);

  if (!shouldShow) {
    return <>{children}</>;
  }

  const SkeletonLine: React.FC<{ width?: string; height?: string }> = ({ 
    width = '100%', 
    height: lineHeight = '1rem' 
  }) => (
    <div 
      className="animate-pulse bg-gray-200 rounded"
      style={{ width, height: lineHeight }}
    />
  );

  const renderVariant = () => {
    switch (variant) {
      case 'text':
        return (
          <div className="space-y-2">
            {Array.from({ length: lines }, (_, i) => (
              <SkeletonLine 
                key={i} 
                width={i === lines - 1 ? '75%' : '100%'} 
              />
            ))}
          </div>
        );
      
      case 'card':
        return (
          <div className="border rounded-lg p-4 space-y-3">
            <SkeletonLine width="60%" height="1.5rem" />
            <div className="space-y-2">
              <SkeletonLine width="100%" />
              <SkeletonLine width="85%" />
              <SkeletonLine width="70%" />
            </div>
            <div className="flex space-x-2">
              <SkeletonLine width="80px" height="2rem" />
              <SkeletonLine width="80px" height="2rem" />
            </div>
          </div>
        );
      
      case 'table':
        return (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-3 border-b">
              <div className="flex space-x-4">
                <SkeletonLine width="120px" />
                <SkeletonLine width="100px" />
                <SkeletonLine width="80px" />
                <SkeletonLine width="90px" />
              </div>
            </div>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="p-3 border-b last:border-b-0">
                <div className="flex space-x-4">
                  <SkeletonLine width="120px" />
                  <SkeletonLine width="100px" />
                  <SkeletonLine width="80px" />
                  <SkeletonLine width="90px" />
                </div>
              </div>
            ))}
          </div>
        );
      
      case 'form':
        return (
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <SkeletonLine width="120px" height="1rem" />
                <SkeletonLine width="100%" height="2.5rem" />
              </div>
            ))}
            <div className="flex space-x-2 pt-2">
              <SkeletonLine width="100px" height="2.5rem" />
              <SkeletonLine width="80px" height="2.5rem" />
            </div>
          </div>
        );
      
      default:
        return (
          <div style={{ height }} className="animate-pulse bg-gray-200 rounded" />
        );
    }
  };

  return (
    <div className={`${className}`}>
      {renderVariant()}
    </div>
  );
};

/**
 * Progress indicator with enterprise backend feedback
 */
export const EnterpriseProgressIndicator: React.FC<{
  loadingId: string;
  variant?: 'linear' | 'circular' | 'steps';
  showEstimate?: boolean;
  showThroughput?: boolean;
  className?: string;
}> = ({ 
  loadingId, 
  variant = 'linear',
  showEstimate = true,
  showThroughput = false,
  className = '' 
}) => {
  const { getLoadingState } = useLoadingState();
  const loadingState = getLoadingState(loadingId);
  
  if (!loadingState || !loadingState.showProgress) {
    return null;
  }

  const progress = loadingState.progress || 0;
  const estimatedDuration = loadingState.estimatedDuration;
  const actualDuration = Date.now() - loadingState.startTime;
  const remainingTime = estimatedDuration ? estimatedDuration - actualDuration : null;

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const renderLinearProgress = () => (
    <div className="w-full">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>{loadingState.message || 'Processing...'}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      {showEstimate && remainingTime && remainingTime > 0 && (
        <div className="text-xs text-gray-500 mt-1">
          Estimated {formatTime(remainingTime)} remaining
        </div>
      )}
    </div>
  );

  const renderCircularProgress = () => {
    const circumference = 2 * Math.PI * 20;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="flex items-center space-x-3">
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 48 48">
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              className="text-gray-200"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="text-blue-600 transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium">{Math.round(progress)}%</span>
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">{loadingState.message || 'Processing...'}</div>
          {showEstimate && remainingTime && remainingTime > 0 && (
            <div className="text-xs text-gray-500">
              {formatTime(remainingTime)} remaining
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStepsProgress = () => {
    const steps = ['Initializing', 'Processing', 'Finalizing'];
    const currentStep = Math.floor((progress / 100) * steps.length);

    return (
      <div className="space-y-2">
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index < currentStep 
                  ? 'bg-green-500 text-white' 
                  : index === currentStep 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {index < currentStep ? '✓' : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${
                  index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-sm text-gray-600 text-center">
          {steps[Math.min(currentStep, steps.length - 1)]}
        </div>
      </div>
    );
  };

  return (
    <div className={`${className}`}>
      {variant === 'linear' && renderLinearProgress()}
      {variant === 'circular' && renderCircularProgress()}
      {variant === 'steps' && renderStepsProgress()}
    </div>
  );
};

/**
 * Loading overlay with enterprise features
 */
export const EnterpriseLoadingOverlay: React.FC<{
  loadingId: string;
  backdrop?: boolean;
  cancellable?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = ({ 
  loadingId, 
  backdrop = true,
  cancellable = false,
  className = '',
  children 
}) => {
  const { getLoadingState } = useLoadingState();
  const loadingState = getLoadingState(loadingId);
  
  if (!loadingState || loadingState.state === 'idle' || loadingState.state === 'success') {
    return <>{children}</>;
  }

  const isSlowLoading = loadingState.state === 'slow';

  return (
    <div className="relative">
      {children}
      {backdrop && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <div className="space-y-4">
              <EnterpriseProgressIndicator 
                loadingId={loadingId}
                variant="linear"
                showEstimate={isSlowLoading}
              />
              
              {isSlowLoading && (
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
                  ⏱️ This operation is taking longer than usual. This may be due to high server load or large data processing.
                </div>
              )}
              
              {(cancellable || loadingState.canCancel) && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {/* Cancel implementation */}}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Smart loading button with enterprise backend awareness
 */
export const SmartLoadingButton: React.FC<{
  loadingId?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ 
  loadingId,
  onClick, 
  variant = 'primary',
  size = 'medium',
  disabled = false,
  className = '',
  children 
}) => {
  const { getLoadingState } = useLoadingState();
  const loadingState = loadingId ? getLoadingState(loadingId) : null;
  
  const isLoading = loadingState?.state === 'loading' || loadingState?.state === 'slow';
  const isOptimistic = loadingState?.state === 'optimistic';
  const progress = loadingState?.progress || 0;

  const baseClasses = 'relative inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 disabled:bg-gray-400',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 disabled:border-blue-400 disabled:text-blue-400'
  };

  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg'
  };

  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={buttonClasses}
    >
      <span className={`flex items-center space-x-2 ${isLoading ? 'opacity-75' : ''}`}>
        {isLoading && (
          <div className="w-4 h-4 animate-spin rounded-full border-2 border-transparent border-t-current" />
        )}
        {isOptimistic && (
          <div className="w-4 h-4 text-green-500">✓</div>
        )}
        <span>{children}</span>
      </span>
      
      {isLoading && loadingState?.showProgress && (
        <div className="absolute bottom-0 left-0 h-1 bg-white bg-opacity-30 rounded-b-lg transition-all duration-300"
             style={{ width: `${Math.min(progress, 100)}%` }} />
      )}
    </button>
  );
};

/**
 * Loading state summary for debugging/monitoring
 */
export const LoadingStateSummary: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  const { activeLoadings, predictionStats } = useLoadingState();
  
  if (activeLoadings.length === 0) {
    return null;
  }

  return (
    <div className={`bg-gray-50 border rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-medium text-gray-900 mb-2">Active Operations</h3>
      <div className="space-y-2">
        {activeLoadings.map((loading, index) => (
          <div key={index} className="text-xs text-gray-600 flex justify-between">
            <span>{loading.context?.operationType || 'Unknown'}</span>
            <span className={`font-medium ${
              loading.state === 'slow' ? 'text-amber-600' : 
              loading.state === 'loading' ? 'text-blue-600' : 'text-gray-600'
            }`}>
              {loading.state}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t text-xs text-gray-500">
        Predictions: {predictionStats.totalPredictions} | 
        Confidence: {Math.round(predictionStats.averageConfidence * 100)}%
      </div>
    </div>
  );
};

export default {
  EnterpriseLoadingSpinner,
  AdaptiveSkeletonLoader,
  EnterpriseProgressIndicator,
  EnterpriseLoadingOverlay,
  SmartLoadingButton,
  LoadingStateSummary
};