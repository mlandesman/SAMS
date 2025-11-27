/**
 * Generate UI Comparison Report
 * 
 * Creates a concise report comparing statement data with expected UI values
 * Focuses on key totals that can be easily verified in the UI
 */

import { createApiClient } from './apiClient.js';
import { getStatementData } from '../services/statementDataService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// All units to validate
const allUnits = [
  // AVII Units
  { clientId: 'AVII', unitId: '101' },
  { clientId: 'AVII', unitId: '102' },
  { clientId: 'AVII', unitId: '103' },
  { clientId: 'AVII', unitId: '104' },
  { clientId: 'AVII', unitId: '105' },
  { clientId: 'AVII', unitId: '106' },
  { clientId: 'AVII', unitId: '201' },
  { clientId: 'AVII', unitId: '202' },
  { clientId: 'AVII', unitId: '203' },
  { clientId: 'AVII', unitId: '204' },
  // MTC Units
  { clientId: 'MTC', unitId: '1A' },
  { clientId: 'MTC', unitId: '1B' },
  { clientId: 'MTC', unitId: '1C' },
  { clientId: 'MTC', unitId: '2A' },
  { clientId: 'MTC', unitId: '2B' },
  { clientId: 'MTC', unitId: '2C' },
  { clientId: 'MTC', unitId: 'PH1A' },
  { clientId: 'MTC', unitId: 'PH2B' },
  { clientId: 'MTC', unitId: 'PH3C' },
  { clientId: 'MTC', unitId: 'PH4D' }
];

async function getApiClient() {
  return await createApiClient();
}

function formatCurrency(amount) {
  if (!amount || isNaN(amount)) return '$0.00';
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

async function generateReport() {
  console.log('📊 Generating UI Comparison Report...\n');
  
  try {
    const api = await getApiClient();
    
    // Collect data for all units
    const unitData = [];
    const errors = [];
    
    for (const unit of allUnits) {
      try {
        const data = await getStatementData(api, unit.clientId, unit.unitId);
        unitData.push({
          clientId: unit.clientId,
          unitId: unit.unitId,
          data: data
        });
      } catch (error) {
        errors.push({
          unit: `${unit.clientId} ${unit.unitId}`,
          error: error.message
        });
      }
      
      // Small delay between units
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Group by client
    const aviiUnits = unitData.filter(u => u.clientId === 'AVII');
    const mtcUnits = unitData.filter(u => u.clientId === 'MTC');
    
    // Generate report content
    let report = '# UI COMPARISON REPORT\n';
    report += `Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/Cancun' })}\n\n`;
    
    // AVII Summary
    report += '## AVII CLIENT SUMMARY\n\n';
    report += generateClientSummary(aviiUnits);
    
    // AVII Unit Details
    report += '\n### AVII Units Detail\n\n';
    report += generateUnitTable(aviiUnits);
    
    // MTC Summary
    report += '\n## MTC CLIENT SUMMARY\n\n';
    report += generateClientSummary(mtcUnits);
    
    // MTC Unit Details
    report += '\n### MTC Units Detail\n\n';
    report += generateUnitTable(mtcUnits);
    
    // UI Verification Checklist
    report += '\n## UI VERIFICATION CHECKLIST\n\n';
    report += '### HOA Dues View\n';
    report += '- [ ] AVII Total Outstanding matches: ' + formatCurrency(calculateTotal(aviiUnits, 'totalOutstanding')) + '\n';
    report += '- [ ] MTC Total Outstanding matches: ' + formatCurrency(calculateTotal(mtcUnits, 'totalOutstanding')) + '\n';
    report += '- [ ] Individual unit balances match the table above\n\n';
    
    report += '### Water Bills View (AVII only)\n';
    const aviiWaterStats = calculateWaterStats(aviiUnits);
    report += '- [ ] Total Water Charges: ' + formatCurrency(aviiWaterStats.totalCharges) + '\n';
    report += '- [ ] Total Water Paid: ' + formatCurrency(aviiWaterStats.totalPaid) + '\n';
    report += '- [ ] Water Outstanding: ' + formatCurrency(aviiWaterStats.totalCharges - aviiWaterStats.totalPaid) + '\n\n';
    
    report += '### Credit Balances\n';
    const unitsWithCredit = unitData.filter(u => u.data.creditBalance?.creditBalance > 0);
    if (unitsWithCredit.length > 0) {
      unitsWithCredit.forEach(unit => {
        report += `- [ ] ${unit.clientId} ${unit.unitId}: ${formatCurrency(unit.data.creditBalance.creditBalance)}\n`;
      });
    } else {
      report += '- No units with credit balance\n';
    }
    
    // Errors section
    if (errors.length > 0) {
      report += '\n## ERRORS\n\n';
      errors.forEach(err => {
        report += `- ${err.unit}: ${err.error}\n`;
      });
    }
    
    // Key findings
    report += '\n## KEY FINDINGS\n\n';
    
    // Units with high outstanding
    const highOutstanding = unitData
      .filter(u => u.data.summary.totalOutstanding > 50000)
      .sort((a, b) => b.data.summary.totalOutstanding - a.data.summary.totalOutstanding);
    
    if (highOutstanding.length > 0) {
      report += '### Units with High Outstanding (>$50,000)\n';
      highOutstanding.forEach(unit => {
        report += `- ${unit.clientId} ${unit.unitId}: ${formatCurrency(unit.data.summary.totalOutstanding)}\n`;
      });
      report += '\n';
    }
    
    // Units with negative balance
    const negativeBalance = unitData.filter(u => u.data.summary.finalBalance < 0);
    if (negativeBalance.length > 0) {
      report += '### Units with Credit (Negative Balance)\n';
      negativeBalance.forEach(unit => {
        report += `- ${unit.clientId} ${unit.unitId}: ${formatCurrency(unit.data.summary.finalBalance)}\n`;
      });
    }
    
    // Save report
    const reportPath = path.join(path.dirname(__dirname), 'test-results', 
      'UI_Comparison_Report_' + new Date().toISOString().split('T')[0] + '.md');
    fs.writeFileSync(reportPath, report);
    
    console.log('✅ Report generated successfully!');
    console.log(`📄 Saved to: ${reportPath}\n`);
    
    // Also display summary in console
    console.log('QUICK SUMMARY FOR UI VERIFICATION:\n');
    console.log('AVII CLIENT:');
    console.log(`  Total Outstanding: ${formatCurrency(calculateTotal(aviiUnits, 'totalOutstanding'))}`);
    console.log(`  Total Paid: ${formatCurrency(calculateTotal(aviiUnits, 'totalPaid'))}`);
    console.log(`  Units with Balance Due: ${aviiUnits.filter(u => u.data.summary.totalOutstanding > 0).length}`);
    
    console.log('\nMTC CLIENT:');
    console.log(`  Total Outstanding: ${formatCurrency(calculateTotal(mtcUnits, 'totalOutstanding'))}`);
    console.log(`  Total Paid: ${formatCurrency(calculateTotal(mtcUnits, 'totalPaid'))}`);
    console.log(`  Units with Balance Due: ${mtcUnits.filter(u => u.data.summary.totalOutstanding > 0).length}`);
    
  } catch (error) {
    console.error('❌ Report generation failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

function generateClientSummary(units) {
  const totalDue = calculateTotal(units, 'totalDue');
  const totalPaid = calculateTotal(units, 'totalPaid');
  const totalOutstanding = calculateTotal(units, 'totalOutstanding');
  const totalCredit = units.reduce((sum, u) => sum + (u.data.creditBalance?.creditBalance || 0), 0);
  
  let summary = `- **Total Units**: ${units.length}\n`;
  summary += `- **Total Due (All Units)**: ${formatCurrency(totalDue)}\n`;
  summary += `- **Total Paid (All Units)**: ${formatCurrency(totalPaid)}\n`;
  summary += `- **Total Outstanding (All Units)**: ${formatCurrency(totalOutstanding)}\n`;
  summary += `- **Total Credit Balance**: ${formatCurrency(totalCredit)}\n`;
  summary += `- **Units Paid in Full**: ${units.filter(u => u.data.summary.totalOutstanding === 0).length}\n`;
  summary += `- **Units with Balance Due**: ${units.filter(u => u.data.summary.totalOutstanding > 0).length}\n`;
  
  return summary;
}

function generateUnitTable(units) {
  let table = '| Unit | Scheduled | Total Due | Total Paid | Outstanding | Final Balance | Credit |\n';
  table += '|------|-----------|-----------|------------|-------------|---------------|--------|\n';
  
  units.forEach(unit => {
    const s = unit.data.summary;
    const credit = unit.data.creditBalance?.creditBalance || 0;
    
    table += `| ${unit.unitId} | ${formatCurrency(s.scheduledAmount)} | ${formatCurrency(s.totalDue)} | ${formatCurrency(s.totalPaid)} | ${formatCurrency(s.totalOutstanding)} | ${formatCurrency(s.finalBalance)} | ${formatCurrency(credit)} |\n`;
  });
  
  return table;
}

function calculateTotal(units, field) {
  return units.reduce((sum, u) => sum + (u.data.summary[field] || 0), 0);
}

function calculateWaterStats(units) {
  let totalCharges = 0;
  let totalPaid = 0;
  
  units.forEach(unit => {
    if (unit.data.waterBillsRaw && unit.data.waterBillsRaw.length > 0) {
      unit.data.waterBillsRaw.forEach(bill => {
        totalCharges += (bill.totalAmount || 0);
        if (bill.status === 'Paid') {
          totalPaid += (bill.totalAmount || 0);
        }
      });
    }
  });
  
  return { totalCharges, totalPaid };
}

// Run report generation
generateReport();
