#!/usr/bin/env node
/**
 * Test Water Bill Report Service
 * Usage: node scripts/testWaterBillReport.js [unitId] [clientId]
 * Example: node scripts/testWaterBillReport.js 103 AVII
 */

import { generateWaterConsumptionReportData } from '../functions/backend/services/waterBillReportService.js';

const unitId = process.argv[2] || '103';
const clientId = process.argv[3] || 'AVII';

async function test() {
  console.log(`\nGenerating Water Consumption Report for ${clientId}/${unitId}...\n`);
  
  try {
    const report = await generateWaterConsumptionReportData(clientId, unitId);
    
    if (report.error) {
      console.error('❌ Error:', report.error);
      process.exit(1);
    }
    
    console.log('✅ Report Generated Successfully\n');
    console.log('Report ID:', report.reportId);
    console.log('Generated At:', report.generatedAt);
    console.log('Unit:', report.unit.id, '-', report.unit.owners.join(', '));
    console.log('Client:', report.client.name);
    console.log('Rate per m³:', `$${report.client.ratePerM3.toFixed(2)}`);
    console.log('\n--- Summary Metrics ---');
    console.log('YTD Consumption:', report.summary.ytdConsumption, 'm³');
    console.log('YTD Charges:', `$${report.summary.ytdCharges.toFixed(2)}`);
    console.log('YTD Payments:', `$${report.summary.ytdPayments.toFixed(2)}`);
    console.log('Current Balance:', `$${report.summary.currentBalance.toFixed(2)}`);
    console.log('Monthly Average:', report.summary.monthlyAverage, 'm³/month');
    console.log('Daily Average:', report.summary.dailyAverage, 'm³/day');
    console.log('Months with Data:', report.summary.monthsWithData);
    console.log('Days with Data:', report.summary.daysWithData);
    
    if (report.comparison) {
      console.log('\n--- Comparison ---');
      console.log('Percentile:', report.comparison.percentile);
      console.log('Unit Rank:', report.comparison.unitRank, 'of', report.comparison.totalUnits);
      console.log('Building Average:', report.comparison.buildingAverage, 'm³');
      console.log('Lowest Consumption:', report.comparison.lowestConsumption, 'm³', `(Unit ${report.comparison.lowestUnitId})`);
      console.log('Highest Consumption:', report.comparison.highestConsumption, 'm³', `(Unit ${report.comparison.highestUnitId})`);
    } else {
      console.log('\n--- Comparison ---');
      console.log('Not enough data for comparison');
    }
    
    console.log('\n--- Chart Data ---');
    console.log('Months:', report.chartData.monthCount);
    console.log('Average:', report.chartData.average, 'm³');
    console.log('Max Value:', report.chartData.maxValue, 'm³');
    console.log('Sample months:', report.chartData.months.slice(0, 3).map(m => `${m.shortLabel}: ${m.consumption}m³`).join(', '));
    
    console.log('\n--- Fiscal Years ---');
    console.log('Total Fiscal Years:', report.fiscalYears.length);
    
    for (const fy of report.fiscalYears) {
      console.log(`\n${fy.yearLabel}:`);
      for (const q of fy.quarters) {
        console.log(`  ${q.quarterLabel}: ${q.totals.consumption} m³, $${q.totals.totalCharge.toFixed(2)}, Status: ${q.status}`);
        console.log(`    Period: ${q.periodLabel}`);
        console.log(`    Months: ${q.months.length}`);
      }
      console.log(`  Year Totals: ${fy.yearTotals.consumption} m³, $${fy.yearTotals.totalCharge.toFixed(2)}, Paid: $${fy.yearTotals.totalPaid.toFixed(2)}, Balance: $${fy.yearTotals.balance.toFixed(2)}`);
    }
    
    console.log('\n--- Grand Totals ---');
    console.log('Total Consumption:', report.grandTotals.consumption, 'm³');
    console.log('Total Charged:', `$${report.grandTotals.totalCharge.toFixed(2)}`);
    console.log('Total Paid:', `$${report.grandTotals.totalPaid.toFixed(2)}`);
    console.log('Balance:', `$${report.grandTotals.balance.toFixed(2)}`);
    
    console.log('\n✅ Test completed successfully!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

test().catch(console.error);
