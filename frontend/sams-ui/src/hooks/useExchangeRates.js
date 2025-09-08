import { useState, useEffect, useCallback } from 'react';
import { useExchangeRateContext } from '../context/ExchangeRateContext';
import { needsExchangeRateUpdate, fetchExchangeRates, fillMissingExchangeRates } from '../utils/exchangeRates';
import { getMexicoDateString, logMexicoTime } from '../utils/timezone';

/**
 * Hook for managing exchange rates - provides both data and update functions
 */
export const useExchangeRates = (date) => {
  const { getExchangeRates } = useExchangeRateContext();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalStatus, setModalStatus] = useState('updating'); // 'updating', 'success', 'error'
  const [exchangeRate, setExchangeRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use Mexico timezone for consistent date calculations
  const targetDate = date || getMexicoDateString();
  
  // Log Mexico time for debugging timezone issues
  if (!date) {
    logMexicoTime();
  }

  /**
   * Fetch current exchange rate data using the context cache
   */
  const fetchCurrentExchangeRate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const rates = await getExchangeRates(targetDate);
      setExchangeRate(rates);
    } catch (err) {
      console.error('❌ Error fetching exchange rate:', err);
      setError(err.message);
      setExchangeRate(null);
    } finally {
      setLoading(false);
    }
  }, [getExchangeRates, targetDate]);

  // Fetch exchange rate data on hook initialization
  useEffect(() => {
    let cancelled = false;
    
    const fetchRates = async () => {
      try {
        setLoading(true);
        const rates = await getExchangeRates(targetDate);
        
        if (!cancelled) {
          setExchangeRate(rates);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setExchangeRate(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchRates();

    return () => {
      cancelled = true;
    };
  }, [getExchangeRates, targetDate]);

  /**
   * Check if exchange rates need updating and fetch if necessary
   * Returns true if update was attempted, false if not needed
   */
  const checkAndUpdateRates = useCallback(async () => {
    try {
      const needsUpdate = await needsExchangeRateUpdate();
      
      if (!needsUpdate) {
        console.log('📊 Exchange rates are up to date');
        return false;
      }

      console.log('📊 Exchange rates need updating...');
      
      // Show modal in updating state
      setModalStatus('updating');
      setIsModalVisible(true);

      // Fetch rates
      await fetchExchangeRates();
      
      // Refresh the exchange rate data
      await fetchCurrentExchangeRate();
      
      // Show success state for a moment
      setModalStatus('success');
      
      // Auto-close after 2 seconds on success
      setTimeout(() => {
        setIsModalVisible(false);
      }, 2000);

      return true;
    } catch (error) {
      console.error('Failed to update exchange rates:', error);
      
      // Show error state
      setModalStatus('error');
      
      // Auto-close after 5 seconds on error
      setTimeout(() => {
        setIsModalVisible(false);
      }, 5000);

      return false;
    }
  }, []);

  /**
   * Fill missing exchange rates (for when app hasn't run for multiple days)
   */
  const fillMissingRates = useCallback(async () => {
    try {
      console.log('🔄 Checking for missing exchange rate gaps...');
      
      // Show modal in updating state
      setModalStatus('updating');
      setIsModalVisible(true);

      // Fill missing rates
      const result = await fillMissingExchangeRates();
      
      if (result.processed > 0) {
        // Show success state for gap filling
        setModalStatus('success');
        
        // Auto-close after 3 seconds for gap fills (longer message)
        setTimeout(() => {
          setIsModalVisible(false);
        }, 3000);
      } else {
        // No gaps found, just close modal
        setIsModalVisible(false);
      }

      return result;
    } catch (error) {
      console.error('Failed to fill missing exchange rates:', error);
      
      // Show error state
      setModalStatus('error');
      
      // Auto-close after 5 seconds on error
      setTimeout(() => {
        setIsModalVisible(false);
      }, 5000);

      return { success: false, error: error.message };
    }
  }, []);

  /**
   * Comprehensive check that handles both today's rates and missing gaps
   */
  const checkAndUpdateWithGapFill = useCallback(async () => {
    try {
      // First check if today's rates are needed
      const todayResult = await checkAndUpdateRates();
      
      // Then check for and fill any gaps (only if today's update succeeded or wasn't needed)
      if (todayResult !== false) {
        // Small delay before gap check
        setTimeout(async () => {
          await fillMissingRates();
        }, 1000);
      }

      return todayResult;
    } catch (error) {
      console.error('Comprehensive exchange rate check failed:', error);
      return false;
    }
  }, [checkAndUpdateRates, fillMissingRates]);

  /**
   * Manually close the modal
   */
  const closeModal = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  return {
    // Exchange rate data
    exchangeRate,
    loading,
    error,
    fetchCurrentExchangeRate,
    refetch: () => getExchangeRates(targetDate),
    
    // Update modal functions  
    isModalVisible,
    modalStatus,
    closeModal,
    checkAndUpdateRates,
    fillMissingRates,
    checkAndUpdateWithGapFill  // New comprehensive function
  };
};
