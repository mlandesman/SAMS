/**
 * useLoadingSpinner Hook
 * Provides consistent loading state management for database operations
 * Includes automatic error handling and timeout protection
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const useLoadingSpinner = (options = {}) => {
  const {
    timeout = 30000, // 30 second default timeout
    onTimeout = null,
    onError = null
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);
  const isLoadingRef = useRef(false);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setError(null);
    isLoadingRef.current = true;

    // Set timeout to prevent infinite loading
    if (timeout > 0) {
      timeoutRef.current = setTimeout(() => {
        if (isLoadingRef.current) {
          setIsLoading(false);
          isLoadingRef.current = false;
          const timeoutError = new Error(`Operation timed out after ${timeout}ms`);
          setError(timeoutError);
          
          if (onTimeout) {
            onTimeout(timeoutError);
          }
        }
      }, timeout);
    }
  }, [timeout, onTimeout]);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    isLoadingRef.current = false;
    setError(null);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const setLoadingError = useCallback((error) => {
    setIsLoading(false);
    isLoadingRef.current = false;
    setError(error);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (onError) {
      onError(error);
    }
  }, [onError]);

  const withLoading = useCallback(async (asyncFunction) => {
    try {
      startLoading();
      const result = await asyncFunction();
      stopLoading();
      return result;
    } catch (error) {
      setLoadingError(error);
      throw error;
    }
  }, [startLoading, stopLoading, setLoadingError]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    isLoadingRef.current = false;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    isLoading,
    error,
    startLoading,
    stopLoading,
    setLoadingError,
    withLoading,
    reset
  };
};

export default useLoadingSpinner;