#!/usr/bin/env node
/**
 * Water Consumption Analysis Script
 * 
 * Calculates and displays consumption analysis for leak detection:
 * - Total unit consumption (sum of all units)
 * - Common area consumption
 * - Building meter consumption
 * - Delta = (Units + Common) - Building
 * - Percentage delta
 * 
 * Usage:
 *   node scripts/water-consumption-analysis.js AVII 2026
 *   node scripts/water-consumption-analysis.js AVII 2026 --prod
 */

// Import paths relative to scripts directory
import { waterDataService } from '../functions/backend/services/waterDataService.js';

// Parse command line arguments
const args = process.argv.slice(2);
const clientId = args[0] || 'AVII';
const fiscalYear = parseInt(args[1]) || 2026;
const useProduction = args.includes('--prod');

// Fiscal year configuration (AVII starts in July)
const FISCAL_YEAR_START_MONTH = 7;

// Calendar month names for display
const calendarMonthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Extract reading value from reading object or number
 */
function extractReading(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && value.reading !== undefined) {
    return value.reading;
  }
  if (typeof value === 'number') {
    return value;
  }
  return null;
}

/**
 * Calculate consumption for a month
 */
function calculateConsumption(currentReading, priorReading) {
  if (currentReading === null || priorReading === null) return null;
  // Allow priorReading === 0 (meter reset or new installation)
  // Only skip if we truly don't have a prior reading
  return currentReading - priorReading;
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString('en-US');
}

/**
 * Format percentage
 */
function formatPercent(delta, building) {
  if (delta === null || building === null || building === 0) return 'N/A';
  const percent = (delta / building) * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

/**
 * Get calendar month name for fiscal month
 * Fiscal year 2026 = July 2025 through June 2026
 * Months 0-5 (July-Dec) are in calendar year (fiscalYear - 1)
 * Months 6-11 (Jan-Jun) are in calendar year fiscalYear
 */
function getCalendarMonthName(fiscalMonth, fiscalYear) {
  // Fiscal month 0 = July = calendar month index 6 (0-indexed)
  // Fiscal month 1 = August = calendar month index 7
  // FISCAL_YEAR_START_MONTH = 7 (July, 1-indexed)
  // So we need: calendarMonth = fiscalMonth + (FISCAL_YEAR_START_MONTH - 1)
  let calendarMonth = fiscalMonth + (FISCAL_YEAR_START_MONTH - 1);
  // Months 0-5 (July-Dec) are in previous calendar year
  // Months 6-11 (Jan-Jun) are in current fiscal year calendar year
  let calendarYear = fiscalMonth < 6 ? fiscalYear - 1 : fiscalYear;
  
  if (calendarMonth >= 12) {
    calendarMonth -= 12;
    // This shouldn't happen with correct calculation, but handle it
    calendarYear += 1;
  }
  
  return `${calendarMonthNames[calendarMonth]} ${calendarYear}`;
}

/**
 * Main analysis function
 */
async function analyzeConsumption(clientId, fiscalYear) {
  console.log(`\n🔍 Water Consumption Analysis`);
  console.log(`   Client: ${clientId}`);
  console.log(`   Fiscal Year: ${fiscalYear}`);
  console.log(`   Environment: ${useProduction ? 'PRODUCTION' : 'DEVELOPMENT'}\n`);

  try {
    // Fetch all readings for the fiscal year
    // This includes prior year month 11 (needed for July calculation)
    console.log('📚 Fetching readings data...');
    const allReadings = await waterDataService.fetchAllReadingsForYear(clientId, fiscalYear);
    
    if (!allReadings || Object.keys(allReadings).length === 0) {
      console.log('❌ No readings data found for this fiscal year');
      return;
    }
    
    // Debug: Show what months we have data for
    console.log(`📊 Found data for months: ${Object.keys(allReadings).join(', ')}`);
    console.log(`   Month 0 (July) exists: ${!!allReadings[0]}`);
    console.log(`   Prior-11 (June ${fiscalYear - 1}) exists: ${!!allReadings['prior-11']}`);

    // Build analysis data for each month
    const analysisData = [];
    
    // Process each fiscal month (0-11)
    for (let month = 0; month < 12; month++) {
      const currentKey = month;
      const priorKey = month === 0 ? 'prior-11' : (month - 1);
      
      const currentMonthData = allReadings[currentKey];
      const priorMonthData = allReadings[priorKey];
      
      // Skip if no current month data
      if (!currentMonthData || !currentMonthData.readings || Object.keys(currentMonthData.readings).length === 0) {
        if (month === 0) {
          console.log(`⚠️  Skipping July (month 0) - no current month data found`);
          console.log(`   Checked key: ${currentKey}, data: ${JSON.stringify(currentMonthData)}`);
        }
        continue;
      }
      
      // Debug: Log what we found for July
      if (month === 0) {
        console.log(`🔍 Debug July (month 0):`);
        console.log(`   Current data exists: ${!!currentMonthData}`);
        console.log(`   Prior data exists: ${!!priorMonthData}`);
        console.log(`   Current readings keys: ${Object.keys(currentMonthData.readings || {}).length}`);
        if (priorMonthData) {
          console.log(`   Prior readings keys: ${Object.keys(priorMonthData.readings || {}).length}`);
          console.log(`   Prior buildingMeter: ${priorMonthData.readings?.buildingMeter}`);
          console.log(`   Prior commonArea: ${priorMonthData.readings?.commonArea}`);
        } else {
          console.log(`   ⚠️  No prior month data (2025-11) found - this is needed for July calculation`);
        }
      }
      
      // Extract readings
      const currentReadings = currentMonthData.readings || {};
      const priorReadings = priorMonthData?.readings || {};
      
      // Calculate unit consumption
      let totalUnitConsumption = 0;
      let unitCount = 0;
      
      for (const [unitId, reading] of Object.entries(currentReadings)) {
        // Skip commonArea and buildingMeter (they're at root level)
        if (unitId === 'commonArea' || unitId === 'buildingMeter') continue;
        
        const currentReading = extractReading(reading);
        const priorReading = extractReading(priorReadings[unitId]);
        
        if (currentReading !== null && priorReading !== null) {
          const consumption = currentReading - priorReading;
          // Allow negative consumption (meter reset) but log it
          if (consumption < 0) {
            console.log(`⚠️  Negative consumption for unit ${unitId} in month ${month}: ${consumption} (current: ${currentReading}, prior: ${priorReading})`);
          }
          // Count all consumption (including negative for now - user can decide if this is valid)
          totalUnitConsumption += consumption;
          unitCount++;
        }
      }
      
      // Calculate common area consumption
      // Note: fetchAllReadingsForYear merges commonArea and buildingMeter into readings object
      const currentCommonArea = extractReading(currentMonthData.readings.commonArea);
      const priorCommonArea = extractReading(priorMonthData?.readings?.commonArea);
      const commonAreaConsumption = calculateConsumption(currentCommonArea, priorCommonArea);
      
      // Calculate building meter consumption
      const currentBuildingMeter = extractReading(currentMonthData.readings.buildingMeter);
      const priorBuildingMeter = extractReading(priorMonthData?.readings?.buildingMeter);
      const buildingConsumption = calculateConsumption(currentBuildingMeter, priorBuildingMeter);
      
      // Calculate delta
      let delta = null;
      if (commonAreaConsumption !== null && buildingConsumption !== null) {
        delta = (totalUnitConsumption + commonAreaConsumption) - buildingConsumption;
      }
      
      // Get calendar month name
      const monthName = getCalendarMonthName(month, fiscalYear);
      
      // Always include month if we have current data, even if consumption can't be calculated
      // This ensures July shows up even if prior month data is missing
      // Set unitsTotal to null if we couldn't calculate any consumption, otherwise use the calculated value
      let unitsTotalValue = null;
      if (unitCount > 0) {
        // We have at least some unit consumption calculated
        unitsTotalValue = totalUnitConsumption;
      } else if (Object.keys(currentReadings).filter(k => k !== 'commonArea' && k !== 'buildingMeter').length > 0) {
        // We have unit readings but couldn't calculate consumption (missing prior readings)
        unitsTotalValue = null; // Will show as N/A
      }
      
      analysisData.push({
        month,
        monthName,
        unitsTotal: unitsTotalValue,
        commonArea: commonAreaConsumption,
        building: buildingConsumption,
        delta,
        unitCount
      });
      
      // Debug for July
      if (month === 0) {
        console.log(`✅ July data added to analysis:`);
        console.log(`   Units Total: ${unitsTotalValue}`);
        console.log(`   Common Area: ${commonAreaConsumption}`);
        console.log(`   Building: ${buildingConsumption}`);
        console.log(`   Delta: ${delta}`);
        console.log(`   Unit Count: ${unitCount}`);
      }
    }
    
    if (analysisData.length === 0) {
      console.log('❌ No complete month data found (need both current and prior readings)');
      return;
    }
    
    // Debug: Show what months are in analysisData
    console.log(`\n📋 Analysis data contains ${analysisData.length} months:`);
    analysisData.forEach(d => {
      console.log(`   Month ${d.month} (${d.monthName}): unitsTotal=${d.unitsTotal}, commonArea=${d.commonArea}, building=${d.building}`);
    });
    console.log('');
    
    // Display table
    console.log('═'.repeat(90));
    console.log('Water Consumption Analysis Table');
    console.log('═'.repeat(90));
    console.log(
      'Month'.padEnd(20) +
      'Units Total'.padStart(12) +
      'Common'.padStart(12) +
      'Building'.padStart(12) +
      'Delta'.padStart(12) +
      '%'.padStart(10)
    );
    console.log('─'.repeat(90));
    
    for (const data of analysisData) {
      const unitsStr = formatNumber(data.unitsTotal);
      const commonStr = formatNumber(data.commonArea);
      const buildingStr = formatNumber(data.building);
      const deltaStr = formatNumber(data.delta);
      const percentStr = formatPercent(data.delta, data.building);
      
      console.log(
        data.monthName.padEnd(20) +
        unitsStr.padStart(12) +
        commonStr.padStart(12) +
        buildingStr.padStart(12) +
        deltaStr.padStart(12) +
        percentStr.padStart(10)
      );
    }
    
    console.log('─'.repeat(90));
    
    // Summary statistics
    const validMonths = analysisData.filter(d => d.delta !== null);
    if (validMonths.length > 0) {
      const avgDelta = validMonths.reduce((sum, d) => sum + d.delta, 0) / validMonths.length;
      const maxDelta = Math.max(...validMonths.map(d => d.delta));
      const minDelta = Math.min(...validMonths.map(d => d.delta));
      
      console.log('\nSummary Statistics:');
      console.log(`  Months with complete data: ${validMonths.length}`);
      console.log(`  Average Delta: ${formatNumber(Math.round(avgDelta))}`);
      console.log(`  Max Delta: ${formatNumber(maxDelta)}`);
      console.log(`  Min Delta: ${formatNumber(minDelta)}`);
      
      // Alert on significant deltas
      const alertThreshold = 0.10; // 10%
      const alerts = validMonths.filter(d => {
        if (d.building === null || d.building === 0) return false;
        const percent = Math.abs(d.delta / d.building);
        return percent > alertThreshold;
      });
      
      if (alerts.length > 0) {
        console.log('\n⚠️  Alert: Significant deltas detected (>10%):');
        alerts.forEach(d => {
          const percent = (d.delta / d.building) * 100;
          console.log(`  ${d.monthName}: ${formatPercent(d.delta, d.building)} (${formatNumber(d.delta)} m³)`);
        });
      }
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error analyzing consumption:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Initialize Firebase and run analysis
(async () => {
  try {
    // Initialize Firebase connection
    if (useProduction) {
      console.log('🌍 Using PRODUCTION environment');
      console.log('   Make sure you have run: gcloud auth application-default login');
    } else {
      console.log('🔧 Using DEVELOPMENT environment');
    }
    
    await analyzeConsumption(clientId, fiscalYear);
    
    // Close Firebase connection
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  }
})();
