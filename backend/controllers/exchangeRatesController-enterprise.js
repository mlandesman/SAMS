/**
 * Enterprise Exchange Rates Controller
 * Enhanced exchange rate management with enterprise features
 * Phase 4: Exchange Rate Cleanup Implementation
 */

import { getDbEnterprise, releaseDbConnection } from '../firebase-enterprise.js';
import { EnterpriseDataValidator } from '../utils/dataValidation-enterprise.js';
import { PerformanceUtils } from '../utils/performance-monitor.js';
import { getMexicoDateString, getMexicoDate } from '../utils/timezone.js';
import { getNow } from '../services/DateService.js';

// Enterprise configuration
const ENTERPRISE_CONFIG = {
  apiTokens: {
    banxico: 'b35811246f926df8e12186dbd0c274c800d715a4b2ec970ab053a395f0958edd'
  },
  rateLimits: {
    banxicoDelayMs: 500,
    maxRetriesPerApi: 3,
    timeoutMs: 10000
  },
  caching: {
    enabled: true,
    ttlMinutes: 60
  }
};

/**
 * Get current exchange rates with enterprise caching and validation
 */
export const getExchangeRatesEnterprise = async (req, res) => {
  return await PerformanceUtils.trackFunction('getExchangeRatesEnterprise', async () => {
    try {
      const dateStr = getMexicoDateString();
      const db = await getDbEnterprise();

      try {

        const todayDoc = await db.collection('exchangeRates').doc(dateStr).get();

        if (todayDoc.exists) {
          const data = todayDoc.data();
          return res.json({
            success: true,
            date: dateStr,
            data: data,
            current: true,
            source: 'database_current'
          });
        }

        const recentSnapshot = await db.collection('exchangeRates')
          .orderBy('__name__', 'desc')
          .limit(1)
          .get();

        if (!recentSnapshot.empty) {
          const recentDoc = recentSnapshot.docs[0];
          const recentData = recentDoc.data();
          const recentDate = recentDoc.id;

          return res.json({
            success: true,
            date: recentDate,
            data: recentData,
            current: false,
            fallback: true,
            requestedDate: dateStr,
            source: 'database_fallback'
          });
        }

        return res.status(404).json({
          success: false,
          error: 'No exchange rate data available',
          date: dateStr
        });

      } finally {
        releaseDbConnection();
      }
    } catch (error) {
      console.error('❌ Error in getExchangeRatesEnterprise:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve exchange rates',
        details: error.message
      });
    }
  }, { category: 'exchange_rates' });
};

/**
 * Fetch and store exchange rates with enterprise error handling
 */
export const fetchExchangeRatesEnterprise = async (req, res) => {
  return await PerformanceUtils.trackFunction('fetchExchangeRatesEnterprise', async () => {
    try {
      const dateStr = getMexicoDateString();
      const today = getNow();

      const validation = await EnterpriseDataValidator.validateGenericRequest({
        action: 'fetch_exchange_rates',
        date: dateStr
      }, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          issues: validation.issues,
          securityIssues: validation.securityIssues
        });
      }

      const dayOfWeek = today.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return res.json({
          success: true,
          skipped: true,
          reason: 'Weekend - no exchange rates available',
          date: dateStr
        });
      }

      console.log(`🔄 Fetching enterprise exchange rates for ${dateStr}...`);

      // Fetch from multiple sources with retry logic
      const [banxicoResult, colombianResult] = await Promise.allSettled([
        fetchBanxicoRatesWithRetry(),
        fetchColombianRatesWithRetry()
      ]);

      if (banxicoResult.status === 'rejected') {
        console.error('❌ Banxico API failed:', banxicoResult.reason);
        return res.status(502).json({
          success: false,
          error: 'External API failure - Banxico',
          details: banxicoResult.reason.message
        });
      }

      if (colombianResult.status === 'rejected') {
        console.error('❌ Colombian API failed:', colombianResult.reason);
        return res.status(502).json({
          success: false,
          error: 'External API failure - Colombian Government',
          details: colombianResult.reason.message
        });
      }

      const banxicoData = banxicoResult.value;
      const colombianData = colombianResult.value;

      // Calculate exchange rates
      const exchangeRates = calculateExchangeRates(banxicoData, colombianData, dateStr);

      // Store in database with enterprise connection handling
      const db = await getDbEnterprise();

      try {
        await db.collection('exchangeRates').doc(dateStr).set(exchangeRates);

        // Removed excessive success logging for performance
        logExchangeRates(exchangeRates.rates);

        return res.json({
          success: true,
          date: dateStr,
          rates: exchangeRates.rates,
          source: 'external_apis'
        });

      } finally {
        releaseDbConnection();
      }

    } catch (error) {
      console.error('❌ Error in fetchExchangeRatesEnterprise:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch exchange rates',
        details: error.message
      });
    }
  }, { category: 'exchange_rates' });
};

/**
 * Fill missing exchange rate gaps with enterprise validation
 */
export const fillMissingRatesEnterprise = async (req, res) => {
  return await PerformanceUtils.trackFunction('fillMissingRatesEnterprise', async () => {
    try {
      console.log('🔍 Checking for missing exchange rate gaps (enterprise)...');

      const { startDate, endDate, dryRun = false } = req.body || {};

      const validation = await EnterpriseDataValidator.validateGenericRequest({
        action: 'fill_missing_rates',
        startDate,
        endDate,
        dryRun
      }, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          issues: validation.issues
        });
      }

      const db = await getDbEnterprise();
      let missingDates = [];

      try {
        // Find missing dates logic
        const today = getNow();
        const collection = db.collection('exchangeRates');

        let searchStartDate;
        if (startDate) {
          searchStartDate = new Date(startDate);
        } else {
          // Find most recent exchange rate
          const recentSnapshot = await collection.orderBy('date', 'desc').limit(1).get();
          if (recentSnapshot.empty) {
            searchStartDate = getNow();
            searchStartDate.setDate(searchStartDate.getDate() - 30);
          } else {
            const mostRecentDate = recentSnapshot.docs[0].data().date;
            searchStartDate = new Date(mostRecentDate);
            searchStartDate.setDate(searchStartDate.getDate() + 1);
          }
        }

        const searchEndDate = endDate ? new Date(endDate) : today;

        const current = new Date(searchStartDate);
        while (current < searchEndDate) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
            const dateStr = current.toISOString().split('T')[0];
            const doc = await db.collection('exchangeRates').doc(dateStr).get();
            if (!doc.exists) {
              missingDates.push(new Date(current));
            }
          }
          current.setDate(current.getDate() + 1);
        }

        if (missingDates.length === 0) {
          return res.json({
            success: true,
            message: 'No missing rates found',
            missingCount: 0,
            dryRun
          });
        }

        if (dryRun) {
          return res.json({
            success: true,
            message: 'Dry run completed',
            missingCount: missingDates.length,
            missingDates: missingDates.map(d => d.toISOString().split('T')[0]),
            dryRun: true
          });
        }

        // Process missing dates
        let processed = 0;
        let failed = 0;

        for (const date of missingDates) {
          try {
            const success = await fetchAndStoreHistoricalRate(date, db);
            if (success) {
              processed++;
            } else {
              failed++;
            }

            // Respect API limits
            await new Promise(resolve => setTimeout(resolve, ENTERPRISE_CONFIG.rateLimits.banxicoDelayMs));
          } catch (error) {
            console.error(`❌ Error processing ${date.toISOString().split('T')[0]}:`, error);
            failed++;
          }
        }

        return res.json({
          success: true,
          message: 'Gap filling completed',
          processed,
          failed,
          totalMissing: missingDates.length,
          dryRun
        });

      } finally {
        releaseDbConnection();
      }

    } catch (error) {
      console.error('❌ Error in fillMissingRatesEnterprise:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fill missing rates',
        details: error.message
      });
    }
  }, { category: 'exchange_rates' });
};

/**
 * Fetch Banxico rates with enterprise retry logic
 */
async function fetchBanxicoRatesWithRetry() {
  const TOKEN = ENTERPRISE_CONFIG.apiTokens.banxico;
  const series = ['SF43718', 'SF60632', 'SF46410']; // USD, CAD, EUR
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${series.join(',')}/datos/oportuno?mediaType=json&token=${TOKEN}`;

  for (let attempt = 1; attempt <= ENTERPRISE_CONFIG.rateLimits.maxRetriesPerApi; attempt++) {
    try {
      console.log(`🌐 Calling Banxico API (attempt ${attempt})...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ENTERPRISE_CONFIG.rateLimits.timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SAMS-Enterprise-Exchange-Service/2.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Banxico API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const output = {};

      data.bmx.series.forEach(s => {
        output[s.idSerie] = {
          title: s.titulo,
          rate: parseFloat(s.datos[0].dato),
          date: s.datos[0].fecha
        };
      });

      console.log('✅ Banxico rates fetched successfully');
      return output;

    } catch (error) {
      console.warn(`⚠️ Banxico API attempt ${attempt} failed:`, error.message);
      if (attempt === ENTERPRISE_CONFIG.rateLimits.maxRetriesPerApi) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

/**
 * Fetch Colombian rates with enterprise retry logic
 */
async function fetchColombianRatesWithRetry() {
  const url = 'https://www.datos.gov.co/resource/ceyp-9c7c.json?$order=vigenciadesde DESC&$limit=1';

  for (let attempt = 1; attempt <= ENTERPRISE_CONFIG.rateLimits.maxRetriesPerApi; attempt++) {
    try {
      console.log(`🌐 Calling Colombian API (attempt ${attempt})...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ENTERPRISE_CONFIG.rateLimits.timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SAMS-Enterprise-Exchange-Service/2.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Colombian API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const rate = parseFloat(data[0].valor);

      console.log('✅ Colombian COP rate fetched successfully');
      return {
        rate,
        date: data[0].vigenciadesde
      };

    } catch (error) {
      console.warn(`⚠️ Colombian API attempt ${attempt} failed:`, error.message);
      if (attempt === ENTERPRISE_CONFIG.rateLimits.maxRetriesPerApi) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

/**
 * Calculate exchange rates from API data
 */
function calculateExchangeRates(banxicoData, colombianData, dateStr) {
  const mxnToUsd = 1 / banxicoData.SF43718.rate;
  const usdToCop = colombianData.rate;
  const mxnToCop = mxnToUsd * usdToCop;

  return {
    date: dateStr,
    lastUpdated: getNow(),
    source: 'enterprise_apis',
    rates: {
      MXN_USD: {
        rate: mxnToUsd,
        source: 'Banxico',
        seriesId: 'SF43718',
        originalRate: banxicoData.SF43718.rate,
        title: banxicoData.SF43718.title
      },
      MXN_CAD: {
        rate: 1 / banxicoData.SF60632.rate,
        source: 'Banxico',
        seriesId: 'SF60632',
        originalRate: banxicoData.SF60632.rate,
        title: banxicoData.SF60632.title
      },
      MXN_EUR: {
        rate: 1 / banxicoData.SF46410.rate,
        source: 'Banxico',
        seriesId: 'SF46410',
        originalRate: banxicoData.SF46410.rate,
        title: banxicoData.SF46410.title
      },
      MXN_COP: {
        rate: mxnToCop,
        source: 'Colombian Government',
        calculatedFrom: 'USD/COP rate via MXN/USD',
        usdToCopRate: usdToCop
      }
    }
  };
}

/**
 * Fetch and store historical rate for a specific date
 */
async function fetchAndStoreHistoricalRate(date, db) {
  const dateStr = date.toISOString().split('T')[0];

  try {
    console.log(`🔄 Fetching historical rates for ${dateStr}...`);

    // This would need implementation for historical Banxico API calls
    // For now, we'll skip historical fetching as it's complex
    console.log(`⚠️ Historical fetching not implemented for ${dateStr}`);
    return false;

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return false;
  }
}

/**
 * Log exchange rates in a clean format
 */
function logExchangeRates(rates) {
  console.log('📊 Exchange Rates:');
  for (const [currency, data] of Object.entries(rates)) {
    console.log(`   ${currency}: ${data.rate.toFixed(6)}`);
  }
}