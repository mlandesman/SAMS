/**
 * Enterprise Exchange Rates Routes
 * Enhanced routing with enterprise features and validation
 * Phase 4: Exchange Rate Cleanup Implementation
 */

import express from 'express';
import {
  getExchangeRatesEnterprise,
  fetchExchangeRatesEnterprise,
  fillMissingRatesEnterprise
} from '../controllers/exchangeRatesController-enterprise.js';
import { EnterpriseSecurityMiddleware } from '../middleware/security-enterprise.js';
import { PerformanceUtils } from '../utils/performance-monitor.js';
import { getNow } from '../services/DateService.js';

const router = express.Router();

// Apply enterprise security middleware
router.use(EnterpriseSecurityMiddleware.validateRequest);
router.use(EnterpriseSecurityMiddleware.rateLimitMiddleware);

// Apply performance tracking middleware
router.use(PerformanceUtils.createTrackingMiddleware());

/**
 * GET /api/exchange-rates-enterprise/current
 * Get current exchange rates with enterprise caching
 */
router.get('/current', getExchangeRatesEnterprise);

/**
 * POST /api/exchange-rates-enterprise/fetch
 * Fetch new exchange rates from external APIs
 * Requires validation and rate limiting
 */
router.post('/fetch', fetchExchangeRatesEnterprise);

/**
 * POST /api/exchange-rates-enterprise/fill-gaps
 * Fill missing exchange rate gaps with enterprise validation
 * Supports dry run mode for testing
 */
router.post('/fill-gaps', fillMissingRatesEnterprise);

/**
 * GET /api/exchange-rates-enterprise/health
 * Health check for exchange rate services
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      service: 'exchange-rates-enterprise',
      status: 'healthy',
      timestamp: getNow().toISOString(),
      features: {
        currentRates: 'available',
        apiFetching: 'available',
        gapFilling: 'available',
        enterpriseSecurity: 'enabled',
        performanceTracking: 'enabled'
      }
    };

    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({
      service: 'exchange-rates-enterprise',
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;