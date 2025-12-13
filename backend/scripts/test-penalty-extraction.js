#!/usr/bin/env node
/**
 * Test script for penalty extraction and matching logic
 * Tests the penalty import logic without running full import
 * 
 * Usage: node backend/scripts/test-penalty-extraction.js [clientId] [fiscalYear] [quarter]
 * Example: node backend/scripts/test-penalty-extraction.js AVII 2026 1
 */

import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { pesosToCentavos, centavosToPesos } from '../utils/currencyUtils.js';
import { validateCentavos } from '../utils/centavosValidation.js';

// Extract the helper functions from ImportService logic
function normalizeUnitId(unitLabel) {
  if (!unitLabel) return null;
  const match = String(unitLabel).match(/^([A-Za-z0-9]+)/);
  return match ? match[1] : unitLabel;
}

function getFiscalYear(date, fiscalYearStartMonth) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // Convert to 1-based
  
  // Special case: Calendar year (starts in January)
  if (fiscalYearStartMonth === 1) {
    return year;
  }
  
  // For fiscal years named by their ending year:
  // If we're in or after the fiscal year start month, we're in the NEXT fiscal year
  if (month >= fiscalYearStartMonth) {
    return year + 1;
  }
  
  // Otherwise we're still in the current fiscal year
  return year;
}

function getFiscalQuarter(date, fiscalYearStartMonth = 7) {
  const dateObj = date instanceof Date ? date : new Date(date + 'T12:00:00');
  const month = dateObj.getMonth(); // 0-11
  
  // Calculate fiscal year (not calendar year)
  const fiscalYear = getFiscalYear(dateObj, fiscalYearStartMonth);
  
  if (month >= 6 && month <= 8) {
    // Jul, Aug, Sep = Q1
    return { quarter: 1, year: fiscalYear };
  } else if (month >= 9 && month <= 11) {
    // Oct, Nov, Dec = Q2
    return { quarter: 2, year: fiscalYear };
  } else if (month >= 0 && month <= 2) {
    // Jan, Feb, Mar = Q3
    return { quarter: 3, year: fiscalYear };
  } else {
    // Apr, May, Jun = Q4
    return { quarter: 4, year: fiscalYear };
  }
}

function extractPenalties(unitAccounting, fiscalYearStartMonth = 7) {
  const penalties = {};
  
  if (!Array.isArray(unitAccounting)) {
    console.warn('⚠️  unitAccounting is not an array, skipping penalty extraction');
    return penalties;
  }
  
  console.log(`\n📊 Processing ${unitAccounting.length} unitAccounting entries...`);
  
  for (const entry of unitAccounting) {
    const category = entry['Categoría'] || entry.Category || '';
    if (category !== 'Cargo por pago atrasado') continue;
    
    const unitId = normalizeUnitId(entry.Depto || entry.Unit);
    if (!unitId) {
      console.warn(`⚠️  Skipping penalty entry with no unit:`, entry);
      continue;
    }
    
    const date = new Date(entry.Fecha || entry.Date);
    if (isNaN(date.getTime())) {
      console.warn(`⚠️  Invalid date for penalty entry:`, entry);
      continue;
    }
    
    const amount = parseFloat(entry.Cantidad || entry.Amount || 0);
    if (isNaN(amount) || amount === 0) continue;
    
    const isPaid = entry['✓'] === true || entry.Paid === true;
    
    // Calculate fiscal quarter (using fiscal year, not calendar year)
    const fiscalQ = getFiscalQuarter(date, fiscalYearStartMonth);
    const key = `${unitId}_${fiscalQ.year}_Q${fiscalQ.quarter}`;
    
    if (!penalties[key]) {
      penalties[key] = { 
        unitId, 
        fiscalYear: fiscalQ.year,
        fiscalQuarter: fiscalQ.quarter, 
        totalPenalty: 0, 
        entries: [] 
      };
    }
    penalties[key].totalPenalty += amount;
    penalties[key].entries.push({ date, amount, isPaid });
    
    console.log(`  ✓ Found penalty: Unit ${unitId}, Date: ${date.toISOString().split('T')[0]}, Amount: $${amount.toFixed(2)}, Quarter: ${fiscalQ.year}-Q${fiscalQ.quarter}`);
  }
  
  // Convert totals to centavos
  for (const key in penalties) {
    penalties[key].totalPenaltyCentavos = validateCentavos(
      pesosToCentavos(penalties[key].totalPenalty),
      `penalty[${key}].totalPenalty`
    );
  }
  
  return penalties;
}

function extractLavadoCharges(unitAccounting) {
  const lavado = [];
  
  if (!Array.isArray(unitAccounting)) {
    console.warn('⚠️  unitAccounting is not an array, skipping lavado extraction');
    return lavado;
  }
  
  for (const entry of unitAccounting) {
    const category = entry['Categoría'] || entry.Category || '';
    if (!category.startsWith('Lavado')) continue;
    
    const unitId = normalizeUnitId(entry.Depto || entry.Unit);
    if (!unitId) continue;
    
    const date = new Date(entry.Fecha || entry.Date);
    if (isNaN(date.getTime())) {
      console.warn(`⚠️  Invalid date for lavado entry:`, entry);
      continue;
    }
    
    const amount = parseFloat(entry.Cantidad || entry.Amount || 0);
    if (isNaN(amount) || amount === 0) continue;
    
    lavado.push({
      unitId: unitId,
      originalUnitId: entry.Depto || entry.Unit,
      date: date,
      category: category,
      amount: validateCentavos(pesosToCentavos(amount), `lavado[${lavado.length}].amount`),
      isPaid: entry['✓'] === true || entry.Paid === true,
      paidBy: entry.Pagado || null
    });
  }
  
  return lavado;
}

async function testPenaltyExtraction(clientId, testFiscalYear = null, testQuarter = null) {
  console.log(`\n🧪 Testing Penalty Extraction for ${clientId}`);
  console.log(`   Test Quarter: ${testFiscalYear ? `${testFiscalYear}-Q${testQuarter}` : 'All quarters'}`);
  console.log('=' .repeat(60));
  
  try {
    // Initialize Firebase Admin
    if (admin.apps.length === 0) {
      const serviceAccountPath = new URL('../serviceAccountKey.json', import.meta.url);
      const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
      
      // Determine storage bucket based on environment
      const getStorageBucket = () => {
        if (process.env.NODE_ENV === 'production') {
          return 'sams-sandyland-prod.firebasestorage.app';
        } else if (process.env.NODE_ENV === 'staging') {
          return 'sams-staging-6cdcd.firebasestorage.app';
        }
        return 'sandyland-management-system.firebasestorage.app';
      };
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: getStorageBucket()
      });
    }
    
    // Load unitAccounting.json from Firebase Storage
    console.log('\n📖 Loading unitAccounting.json from Firebase Storage...');
    const bucket = admin.storage().bucket();
    const directoryPath = `imports/${clientId}`;
    
    // Try to find the file (case-insensitive)
    const [files] = await bucket.getFiles({ prefix: directoryPath });
    const unitAccountingFile = files.find(f => 
      f.name.toLowerCase().endsWith('unitaccounting.json')
    );
    
    if (!unitAccountingFile) {
      throw new Error(`unitAccounting.json not found in ${directoryPath}`);
    }
    
    console.log(`   Found file: ${unitAccountingFile.name}`);
    const [buffer] = await unitAccountingFile.download();
    const text = buffer.toString('utf-8');
    const unitAccountingData = JSON.parse(text);
    
    console.log(`✅ Loaded ${unitAccountingData.length} entries from unitAccounting.json\n`);
    
    // Extract penalties (AVII fiscal year starts in July = month 7)
    console.log('🔍 Extracting penalties...');
    const fiscalYearStartMonth = 7; // AVII fiscal year starts in July
    const penalties = extractPenalties(unitAccountingData, fiscalYearStartMonth);
    
    console.log(`\n📊 Summary: Found ${Object.keys(penalties).length} penalty groups\n`);
    
    if (Object.keys(penalties).length > 0) {
      console.log('📋 Penalty Groups by Unit-Quarter:');
      console.log('-'.repeat(60));
      for (const [key, penaltyData] of Object.entries(penalties)) {
        console.log(`\n  Key: ${key}`);
        console.log(`    Unit: ${penaltyData.unitId}`);
        console.log(`    Fiscal Year: ${penaltyData.fiscalYear}`);
        console.log(`    Fiscal Quarter: Q${penaltyData.fiscalQuarter}`);
        console.log(`    Total Penalty: $${penaltyData.totalPenalty.toFixed(2)} (${penaltyData.totalPenaltyCentavos} centavos)`);
        console.log(`    Entries: ${penaltyData.entries.length}`);
        penaltyData.entries.forEach((entry, idx) => {
          console.log(`      ${idx + 1}. Date: ${entry.date.toISOString().split('T')[0]}, Amount: $${entry.amount.toFixed(2)}, Paid: ${entry.isPaid ? 'Yes' : 'No'}`);
        });
      }
    }
    
    // Extract lavado charges
    console.log('\n\n🔍 Extracting lavado charges...');
    const lavadoCharges = extractLavadoCharges(unitAccountingData);
    
    console.log(`\n📊 Summary: Found ${lavadoCharges.length} lavado charges\n`);
    
    if (lavadoCharges.length > 0) {
      console.log('📋 Lavado Charges:');
      console.log('-'.repeat(60));
      lavadoCharges.forEach((lavado, idx) => {
        console.log(`\n  ${idx + 1}. Unit: ${lavado.unitId} (original: ${lavado.originalUnitId})`);
        console.log(`     Category: ${lavado.category}`);
        console.log(`     Date: ${lavado.date.toISOString().split('T')[0]}`);
        console.log(`     Amount: $${centavosToPesos(lavado.amount).toFixed(2)} (${lavado.amount} centavos)`);
        console.log(`     Paid: ${lavado.isPaid ? 'Yes' : 'No'}`);
      });
    }
    
    // Test matching for specific quarter if provided
    if (testFiscalYear && testQuarter) {
      console.log(`\n\n🎯 Testing Penalty Matching for ${testFiscalYear}-Q${testQuarter}`);
      console.log('='.repeat(60));
      
      const quarterKey = `${testFiscalYear}_Q${testQuarter}`;
      console.log(`\nLooking for penalties with quarter key: ${quarterKey}`);
      
      const matchingPenalties = {};
      for (const [key, penaltyData] of Object.entries(penalties)) {
        if (key.endsWith(`_${quarterKey}`)) {
          const unitId = penaltyData.unitId;
          matchingPenalties[unitId] = penaltyData;
        }
      }
      
      if (Object.keys(matchingPenalties).length > 0) {
        console.log(`\n✅ Found ${Object.keys(matchingPenalties).length} matching penalty groups:\n`);
        for (const [unitId, penaltyData] of Object.entries(matchingPenalties)) {
          console.log(`  Unit ${unitId}:`);
          console.log(`    Penalty Key: ${unitId}_${quarterKey}`);
          console.log(`    Total Penalty: $${penaltyData.totalPenalty.toFixed(2)} (${penaltyData.totalPenaltyCentavos} centavos)`);
          console.log(`    Would be applied to bill: ${testFiscalYear}-Q${testQuarter}`);
        }
      } else {
        console.log(`\n❌ No penalties found for ${testFiscalYear}-Q${testQuarter}`);
        console.log(`   Available penalty keys: ${Object.keys(penalties).join(', ')}`);
      }
      
      // Test lavado matching for the quarter
      console.log(`\n\n🎯 Testing Lavado Matching for ${testFiscalYear}-Q${testQuarter}`);
      console.log('='.repeat(60));
      
      // Calculate quarter date range (Q1 = Jul-Sep, Q2 = Oct-Dec, Q3 = Jan-Mar, Q4 = Apr-Jun)
      let quarterStartMonth, quarterEndMonth;
      if (testQuarter === 1) {
        quarterStartMonth = 6; // July (0-indexed: 6)
        quarterEndMonth = 8;    // September
      } else if (testQuarter === 2) {
        quarterStartMonth = 9;  // October
        quarterEndMonth = 11;   // December
      } else if (testQuarter === 3) {
        quarterStartMonth = 0;  // January
        quarterEndMonth = 2;    // March
      } else {
        quarterStartMonth = 3;  // April
        quarterEndMonth = 5;    // June
      }
      
      const quarterStartDate = new Date(testFiscalYear - 1, quarterStartMonth, 1);
      const quarterEndDate = new Date(testFiscalYear - 1, quarterEndMonth + 1, 0);
      quarterEndDate.setHours(23, 59, 59, 999);
      
      console.log(`\nQuarter date range: ${quarterStartDate.toISOString().split('T')[0]} to ${quarterEndDate.toISOString().split('T')[0]}`);
      
      const matchingLavado = lavadoCharges.filter(lavado => {
        const lavadoDate = lavado.date instanceof Date ? lavado.date : new Date(lavado.date);
        return lavadoDate >= quarterStartDate && lavadoDate <= quarterEndDate;
      });
      
      if (matchingLavado.length > 0) {
        console.log(`\n✅ Found ${matchingLavado.length} matching lavado charges:\n`);
        const byUnit = {};
        matchingLavado.forEach(lavado => {
          if (!byUnit[lavado.unitId]) {
            byUnit[lavado.unitId] = [];
          }
          byUnit[lavado.unitId].push(lavado);
        });
        
        for (const [unitId, charges] of Object.entries(byUnit)) {
          const total = charges.reduce((sum, c) => sum + c.amount, 0);
          console.log(`  Unit ${unitId}:`);
          console.log(`    Total Lavado: $${centavosToPesos(total).toFixed(2)} (${total} centavos)`);
          console.log(`    Charges: ${charges.length}`);
          charges.forEach((charge, idx) => {
            console.log(`      ${idx + 1}. ${charge.category}: $${centavosToPesos(charge.amount).toFixed(2)} on ${charge.date.toISOString().split('T')[0]}`);
          });
        }
      } else {
        console.log(`\n❌ No lavado charges found for ${testFiscalYear}-Q${testQuarter}`);
      }
    }
    
    console.log('\n\n✅ Test completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const clientId = args[0] || 'AVII';
const testFiscalYear = args[1] ? parseInt(args[1]) : null;
const testQuarter = args[2] ? parseInt(args[2]) : null;

if (!clientId) {
  console.error('Usage: node backend/scripts/test-penalty-extraction.js [clientId] [fiscalYear] [quarter]');
  console.error('Example: node backend/scripts/test-penalty-extraction.js AVII 2026 1');
  process.exit(1);
}

testPenaltyExtraction(clientId, testFiscalYear, testQuarter).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
