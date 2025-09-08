/**
 * API Error Handling Hook for Enterprise Backend Alignment
 * FRONTEND-ALIGNMENT-001 - Phase 1.1
 * 
 * Provides consistent API error handling with retry logic and user feedback
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { StandardizedError, ErrorFactory, parseBackendError, ErrorMetrics } from './StandardizedError';

export interface ApiErrorHandlerConfig {
  maxRetries?: number;
  retryDelay?: number;
  enableAutoRetry?: boolean;
  enableUserFeedback?: boolean;
  logErrors?: boolean;
  onError?: (error: StandardizedError) => void;
  onRetry?: (attempt: number) => void;
  onSuccess?: () => void;
}

export interface ApiCallOptions {
  retryable?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  silent?: boolean;
  userId?: string;
  clientId?: string;
  requestId?: string;
}

export interface ApiErrorState {
  error: StandardizedError | null;
  isLoading: boolean;
  retryCount: number;
  lastAttempt: Date | null;
  canRetry: boolean;
}

/**
 * Hook for handling API errors with enterprise features
 */
export const useApiErrorHandler = (config: ApiErrorHandlerConfig = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    enableAutoRetry = false,
    enableUserFeedback = true,
    logErrors = true,
    onError,
    onRetry,
    onSuccess
  } = config;

  const [state, setState] = useState<ApiErrorState>({
    error: null,
    isLoading: false,
    retryCount: 0,
    lastAttempt: null,
    canRetry: false
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Clear any pending retry timeout
   */
  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  /**
   * Abort any ongoing request
   */
  const abortRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Clean up resources
   */
  const cleanup = useCallback(() => {
    clearRetryTimeout();
    abortRequest();
  }, [clearRetryTimeout, abortRequest]);

  /**
   * Handle API error with standardization and metrics
   */
  const handleError = useCallback((
    error: any, 
    options: ApiCallOptions = {}
  ): StandardizedError => {
    const { userId, clientId, requestId, retryable = true } = options;

    // Parse and standardize the error
    let standardizedError = parseBackendError(error);

    // Enhance with additional context
    standardizedError = new StandardizedError(
      standardizedError.message,
      standardizedError.code,
      {
        ...standardizedError.details,
        userId,
        clientId,
        requestId,
        retry: retryable && standardizedError.retry,
        maxRetries: options.maxRetries || maxRetries,
        retryDelay: options.retryDelay || retryDelay
      }
    );

    // Record metrics
    ErrorMetrics.recordError(standardizedError);

    // Log error if enabled
    if (logErrors) {
      console.group('🔥 API Error Handler');
      console.error('Original Error:', error);
      console.error('Standardized Error:', standardizedError.toResponse());
      console.error('Options:', options);
      console.groupEnd();
    }

    // Update state
    setState(prevState => ({
      error: standardizedError,
      isLoading: false,
      retryCount: prevState.retryCount,
      lastAttempt: new Date(),
      canRetry: standardizedError.isRetryable() && 
                prevState.retryCount < (options.maxRetries || maxRetries)
    }));

    // Call error callback
    if (onError) {
      onError(standardizedError);
    }

    return standardizedError;
  }, [maxRetries, retryDelay, logErrors, onError]);

  /**
   * Execute API call with error handling and retry logic
   */
  const executeApiCall = useCallback(async <T>(
    apiCall: (signal?: AbortSignal) => Promise<T>,
    options: ApiCallOptions = {}
  ): Promise<T> => {
    const { 
      retryable = true, 
      maxRetries: callMaxRetries = maxRetries,
      retryDelay: callRetryDelay = retryDelay,
      silent = false
    } = options;

    // Clean up any previous operation
    cleanup();

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    const executeCall = async (attempt: number = 0): Promise<T> => {
      try {
        // Update loading state
        if (!silent) {
          setState(prevState => ({
            ...prevState,
            isLoading: true,
            error: null,
            retryCount: attempt
          }));
        }

        // Call onRetry if this is a retry attempt
        if (attempt > 0 && onRetry) {
          onRetry(attempt);
        }

        // Execute the API call
        const result = await apiCall(abortControllerRef.current?.signal);

        // Success - clear state and call success callback
        setState({
          error: null,
          isLoading: false,
          retryCount: 0,
          lastAttempt: new Date(),
          canRetry: false
        });

        if (onSuccess) {
          onSuccess();
        }

        return result;

      } catch (error: any) {
        // Check if request was aborted
        if (error.name === 'AbortError') {
          throw error;
        }

        // Handle and standardize the error
        const standardizedError = handleError(error, options);

        // Check if we should retry
        if (retryable && 
            standardizedError.isRetryable() && 
            attempt < callMaxRetries &&
            !abortControllerRef.current?.signal.aborted) {

          // Calculate retry delay with exponential backoff
          const delay = callRetryDelay * Math.pow(2, attempt);
          const jitteredDelay = delay + (Math.random() * 1000);

          console.log(`Retrying API call in ${jitteredDelay}ms (attempt ${attempt + 1}/${callMaxRetries})`);

          // Wait before retrying
          await new Promise<void>((resolve, reject) => {
            retryTimeoutRef.current = setTimeout(() => {
              if (abortControllerRef.current?.signal.aborted) {
                reject(new Error('Request aborted'));
              } else {
                resolve();
              }
            }, jitteredDelay);
          });

          // Retry the call
          return executeCall(attempt + 1);
        }

        // No retry - throw the standardized error
        throw standardizedError;
      }
    };

    return executeCall();
  }, [
    maxRetries,
    retryDelay,
    cleanup,
    handleError,
    onRetry,
    onSuccess
  ]);

  /**
   * Manual retry function
   */
  const retry = useCallback(async <T>(
    apiCall: (signal?: AbortSignal) => Promise<T>,
    options: ApiCallOptions = {}
  ): Promise<T> => {
    // Reset retry count and execute
    setState(prevState => ({
      ...prevState,
      retryCount: 0,
      error: null
    }));

    return executeApiCall(apiCall, options);
  }, [executeApiCall]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    cleanup();
    setState({
      error: null,
      isLoading: false,
      retryCount: 0,
      lastAttempt: null,
      canRetry: false
    });
  }, [cleanup]);

  /**
   * Check if specific error code exists
   */
  const hasErrorCode = useCallback((code: string): boolean => {
    return state.error?.code === code;
  }, [state.error]);

  /**
   * Check if error is of specific category
   */
  const hasErrorCategory = useCallback((category: string): boolean => {
    return state.error?.category === category;
  }, [state.error]);

  /**
   * Get user-friendly error message
   */
  const getErrorMessage = useCallback((): string | null => {
    return state.error?.userMessage || null;
  }, [state.error]);

  /**
   * Get error action items
   */
  const getActionItems = useCallback((): string[] => {
    return state.error?.actionItems || [];
  }, [state.error]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // State
    ...state,
    
    // Actions
    executeApiCall,
    retry,
    clearError,
    cleanup,
    
    // Utilities
    hasErrorCode,
    hasErrorCategory,
    getErrorMessage,
    getActionItems,
    
    // Auto retry for compatible operations
    enableAutoRetry: enableAutoRetry && state.canRetry
  };
};

/**
 * Simplified hook for basic API error handling
 */
export const useSimpleApiError = () => {
  const [error, setError] = useState<StandardizedError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>
  ): Promise<T> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await apiCall();
      return result;
    } catch (err: any) {
      const standardizedError = parseBackendError(err);
      setError(standardizedError);
      throw standardizedError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    isLoading,
    handleApiCall,
    clearError
  };
};

export default useApiErrorHandler;