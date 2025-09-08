import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMexicoDateString } from '../utils/timezone';
import { config } from '../config';

const ExchangeRateContext = createContext();

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export function ExchangeRateProvider({ children }) {
  const [cache, setCache] = useState(new Map());
  const [pendingRequests, setPendingRequests] = useState(new Map());

  const fetchExchangeRatesAPI = async (date) => {
    // Remove console logging to reduce noise
    // console.log(`🔍 Getting exchange rates for ${date}`);
    
    // Use domain base URL for clean domain routing (/system endpoints)
    const response = await fetch(`${config.api.domainBaseUrl}/system/exchange-rates/check`);
    const result = await response.json();
    
    if (result.exists && result.data) {
      // Remove console logging to reduce noise
      // console.log(`📊 Exchange rate loaded from ${result.date}${result.fallback ? ' (fallback)' : ''}`);
      
      // Extract all currency rates from the data structure
      const rates = result.data.rates || {};
      
      // Extract rates for all supported currencies
      const usdToMxnRate = rates.MXN_USD?.originalRate || 
                         rates.MXN_USD?.rate ? (1 / rates.MXN_USD.rate) : 
                         result.data.USD_to_MXN || 0;
      
      const cadToMxnRate = rates.MXN_CAD?.originalRate || 
                         rates.MXN_CAD?.rate ? (1 / rates.MXN_CAD.rate) : 0;
      
      const eurToMxnRate = rates.MXN_EUR?.originalRate || 
                         rates.MXN_EUR?.rate ? (1 / rates.MXN_EUR.rate) : 0;
      
      const mxnToCopRate = rates.MXN_COP?.rate || 0;
      
      return {
        // Multi-currency rates (all to MXN)
        rates: {
          USD: usdToMxnRate,
          CAD: cadToMxnRate,
          EUR: eurToMxnRate,
          COP: mxnToCopRate > 0 ? (1 / mxnToCopRate) : 0, // Convert MXN_COP to COP_MXN
          MXN: 1 // Base currency
        },
        // Legacy compatibility
        USD_to_MXN: usdToMxnRate,
        usdToMxn: usdToMxnRate,
        mxnToUsd: usdToMxnRate > 0 ? (1 / usdToMxnRate) : 0,
        // Metadata
        date: result.date,
        lastUpdated: result.date || 'Never',
        source: rates.MXN_USD?.source || 'Banxico',
        fallback: result.fallback || false,
        current: result.current !== false
      };
    } else {
      // Remove console logging to reduce noise
      // console.log('📊 No exchange rate data available');
      return null;
    }
  };

  const getExchangeRates = async (date) => {
    // Use Mexico timezone for consistent date calculations
    const targetDate = date || getMexicoDateString();
    
    // Check cache first
    const cached = cache.get(targetDate);
    if (cached && cached.expiresAt > Date.now()) {
      // Remove console logging to reduce noise
      // console.log(`✅ Using cached exchange rates for ${targetDate}`);
      return cached.rates;
    }

    // Check if request is already in progress
    const pending = pendingRequests.get(targetDate);
    if (pending) {
      // Remove console logging to reduce noise
      // console.log(`⏳ Waiting for pending exchange rate request for ${targetDate}`);
      return pending;
    }

    // Make new request
    const request = fetchExchangeRatesAPI(targetDate)
      .then(rates => {
        // Cache the result
        const cacheEntry = {
          date: targetDate,
          rates,
          timestamp: Date.now(),
          expiresAt: Date.now() + CACHE_DURATION
        };
        
        setCache(prev => new Map(prev).set(targetDate, cacheEntry));
        setPendingRequests(prev => {
          const next = new Map(prev);
          next.delete(targetDate);
          return next;
        });
        
        return rates;
      })
      .catch(error => {
        // Remove failed request from pending
        setPendingRequests(prev => {
          const next = new Map(prev);
          next.delete(targetDate);
          return next;
        });
        throw error;
      });

    // Store pending request
    setPendingRequests(prev => new Map(prev).set(targetDate, request));
    return request;
  };

  const clearCache = () => {
    setCache(new Map());
  };

  // Clear cache when date changes (midnight)
  // REMOVED: This interval was checking every minute and causing unnecessary processing
  // Exchange rates are now cached for 1 hour and will be refreshed when needed
  // Old cache entries will naturally expire based on their timestamp

  return (
    <ExchangeRateContext.Provider value={{ getExchangeRates, clearCache }}>
      {children}
    </ExchangeRateContext.Provider>
  );
}

export const useExchangeRateContext = () => {
  const context = useContext(ExchangeRateContext);
  if (!context) {
    throw new Error('useExchangeRateContext must be used within ExchangeRateProvider');
  }
  return context;
};