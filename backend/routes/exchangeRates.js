import express from 'express';
import { 
  getAllExchangeRates,
  getExchangeRatesForDate,
  checkExchangeRates, 
  fetchExchangeRates, 
  fillMissingRates,
  dailyExchangeRatesUpdate,
  manualExchangeRatesUpdate
} from '../controllers/exchangeRatesController.js';

const router = express.Router();

// Get all exchange rate records (for List Management display)
router.get('/', getAllExchangeRates);

// Get exchange rates for a specific date (or most recent before that date)
router.get('/date/:date', getExchangeRatesForDate);

// Check if exchange rates exist for today
router.get('/check', checkExchangeRates);

// Fetch and store exchange rates
router.post('/fetch', fetchExchangeRates);

// Fill missing exchange rates (gap filling)
router.post('/fill-missing', fillMissingRates);

// Daily exchange rates update (called on login)
router.post('/daily-update', dailyExchangeRatesUpdate);

// Manual exchange rates update (for admin/testing)
router.post('/manual-update', manualExchangeRatesUpdate);

export default router;
