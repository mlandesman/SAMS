import React, { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from './common';
import { fetchAllExchangeRates } from '../api/exchangeRates';
import './lists/ModernBaseList.css';

/**
 * ExchangeRatesDisplay - Read-only display of exchange rates for ListManagement
 * Features:
 * - Read-only table displaying exchange rates
 * - Sort by date (newest first)
 * - Group by date, show all currencies for each date
 * - Match styling with harmonized table design
 * - No CRUD functions (future enhancement)
 */
const ExchangeRatesDisplay = ({ 
  onItemCountChange,
  searchTerm = ''
}) => {
  const [exchangeRates, setExchangeRates] = useState([]);
  const [filteredRates, setFilteredRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all exchange rates from the backend API
  const fetchExchangeRates = useCallback(async () => {
    try {
      console.log('📊 Fetching all exchange rate records for display...');
      
      // Use the new API function that fetches all exchange rates
      // This will return ALL historical records, not just 3 days
      const data = await fetchAllExchangeRates();
      
      console.log(`✅ Loaded ${data.length} exchange rate records for display`);
      console.log('📋 Sample record:', data.length > 0 ? {
        id: data[0].id,
        dateFormatted: data[0].dateFormatted,
        hasRates: !!data[0].rates,
        rateKeys: data[0].rates ? Object.keys(data[0].rates) : [],
        sampleRate: data[0].rates?.MXN_USD?.rate
      } : 'No data');
      return data;
      
    } catch (error) {
      console.error('❌ Error fetching exchange rates:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  }, []);

  // Format exchange rate value for display ONLY
  // NOTE: This is purely for visual formatting - the actual rate data retains full precision
  const formatExchangeRate = (value, currency) => {
    if (typeof value !== 'number') return 'N/A';
    
    // Display formatting only - underlying data maintains full precision for accurate conversions
    if (currency === 'COP') {
      return value.toFixed(4); // COP rates are larger numbers, show 4 decimals for display
    }
    return value.toFixed(6); // USD, CAD, EUR typically need more precision for display
  };

  // Fetch exchange rates on component mount
  useEffect(() => {
    const loadExchangeRates = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchExchangeRates();
        // Data is already sorted by the backend (newest first) but ensure it's sorted
        const sortedData = data.sort((a, b) => b.date.localeCompare(a.date));
        setExchangeRates(sortedData);
        setFilteredRates(sortedData);
      } catch (err) {
        console.error('Error fetching exchange rates:', err);
        setError(err.message || 'Failed to load exchange rates');
      } finally {
        setLoading(false);
      }
    };
    
    loadExchangeRates();
  }, [fetchExchangeRates]);

  // Filter rates based on search term
  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      setFilteredRates(exchangeRates);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = exchangeRates.filter(rate => {
        // Search in date and currency names
        return (
          rate.dateFormatted.toLowerCase().includes(searchLower) ||
          rate.date.includes(searchLower) ||
          Object.keys(rate.rates || {}).some(currency => 
            currency.toLowerCase().includes(searchLower)
          )
        );
      });
      setFilteredRates(filtered);
    }
  }, [exchangeRates, searchTerm]);

  // Notify parent when filtered item count changes
  useEffect(() => {
    if (onItemCountChange) {
      onItemCountChange(filteredRates.length);
    }
  }, [filteredRates.length, onItemCountChange]);

  return (
    <div className="modern-list-container">
      <div className="modern-list-content">
        {loading ? (
          <LoadingSpinner variant="logo" message="Loading exchange rates..." size="medium" />
        ) : error ? (
          <div className="modern-list-error">
            <p style={{ color: '#dc2626', textAlign: 'center', padding: '2rem', marginBottom: '1rem' }}>
              {error}
            </p>
            <div style={{ 
              backgroundColor: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: '4px', 
              padding: '1rem', 
              fontSize: '0.875rem',
              color: '#7f1d1d'
            }}>
              <strong>Debug Information:</strong>
              <ul style={{ margin: '0.5rem 0 0 1rem', listStyle: 'disc' }}>
                <li>Check browser console for detailed error messages</li>
                <li>Verify backend server is running (expected URL from config)</li>
                <li>Check network tab for failed API requests</li>
                <li>This component fetches data from: /api/exchange-rates/</li>
              </ul>
            </div>
          </div>
        ) : filteredRates.length === 0 ? (
          <div className="modern-list-empty">
            <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              {searchTerm ? 'No exchange rates match your search.' : 'No exchange rates found.'}
            </p>
          </div>
        ) : (
          <div className="modern-list-table-container">
            <table className="modern-list-table">
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>Date</th>
                  <th style={{ width: '15%' }}>USD Rate</th>
                  <th style={{ width: '15%' }}>CAD Rate</th>
                  <th style={{ width: '15%' }}>EUR Rate</th>
                  <th style={{ width: '15%' }}>COP Rate</th>
                  <th style={{ width: '20%' }}>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredRates.map((rateData) => (
                  <tr key={rateData.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: '600' }}>{rateData.dateFormatted}</div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{rateData.date}</div>
                      </div>
                    </td>
                    <td>
                      {rateData.rates?.MXN_USD?.rate ? 
                        formatExchangeRate(rateData.rates.MXN_USD.rate, 'USD') : 
                        <span style={{color: '#dc2626'}}>N/A</span>
                      }
                      {!rateData.rates && <span style={{fontSize: '0.75rem', color: '#9ca3af'}}> (no rates)</span>}
                    </td>
                    <td>
                      {rateData.rates?.MXN_CAD?.rate ? 
                        formatExchangeRate(rateData.rates.MXN_CAD.rate, 'CAD') : 
                        <span style={{color: '#dc2626'}}>N/A</span>
                      }
                    </td>
                    <td>
                      {rateData.rates?.MXN_EUR?.rate ? 
                        formatExchangeRate(rateData.rates.MXN_EUR.rate, 'EUR') : 
                        <span style={{color: '#dc2626'}}>N/A</span>
                      }
                    </td>
                    <td>
                      {rateData.rates?.MXN_COP?.rate ? 
                        formatExchangeRate(rateData.rates.MXN_COP.rate, 'COP') : 
                        <span style={{color: '#dc2626'}}>N/A</span>
                      }
                    </td>
                    <td>
                      <div>
                        {rateData.lastUpdated ? (
                          <>
                            <div>
                              {rateData.lastUpdated._seconds ? 
                                new Date(rateData.lastUpdated._seconds * 1000).toLocaleDateString() :
                                new Date(rateData.lastUpdated).toLocaleDateString()
                              }
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              {rateData.lastUpdated._seconds ? 
                                new Date(rateData.lastUpdated._seconds * 1000).toLocaleTimeString() :
                                new Date(rateData.lastUpdated).toLocaleTimeString()
                              }
                            </div>
                          </>
                        ) : (
                          <span style={{color: '#dc2626'}}>N/A</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExchangeRatesDisplay;