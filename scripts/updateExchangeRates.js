#!/usr/bin/env node

/**
 * Daily Exchange Rates Update Script with Gap Detection
 * 
 * This script is designed to be run daily (e.g., via login script or cron job) to keep
 * exchange rates up to date. It automatically detects gaps and fills them.
 * 
 * Features:
 * - Checks for gaps from the last known date to today
 * - Automatically fills missing weekdays
 * - Logs progress and results
 * - Handles API failures gracefully
 * 
 * Usage:
 *   node updateExchangeRates.js
 * 
 * Or make it executable and run directly:
 *   chmod +x updateExchangeRates.js
 *   ./updateExchangeRates.js
 */

import { quickUpdateRates, bulkImportHistoricalRates } from './bulkImportExchangeRates.js';

async function main() {
  try {
    console.log('🔄 Starting daily exchange rates update...');
    console.log(`📅 ${new Date().toISOString()}`);
    
    // First try quick update (fills gaps from last date to today)
    console.log('⚡ Attempting quick update...');
    await quickUpdateRates();
    
    // If that completes successfully, we're done
    console.log('✅ Daily update completed successfully');
    
  } catch (error) {
    console.error('❌ Quick update failed:', error.message);
    
    // If quick update fails, try a more targeted approach
    console.log('🔄 Attempting gap-filling approach for last 30 days...');
    
    try {
      // Calculate date range for last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      console.log(`📅 Checking for gaps from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      await bulkImportHistoricalRates({
        fillGaps: true,
        startDate,
        endDate
      });
      
      console.log('✅ Gap-filling update completed successfully');
      
    } catch (fallbackError) {
      console.error('❌ Gap-filling update also failed:', fallbackError.message);
      console.log('ℹ️ This may be due to API issues or network connectivity');
      console.log('ℹ️ The system will retry on the next scheduled run');
      process.exit(1);
    }
  }
}

main();
