#!/usr/bin/env node

/**
 * Delete existing Q1 bill and regenerate with penalties from unitAccounting.json
 * This script extracts penalties from Sheets data (unitAccounting.json) and applies
 * them to match what was already billed in Sheets, rather than calculating penalties.
 */

import { getDb } from '../firebase.js';
import waterBillsService from '../services/waterBillsService.js';
import { ImportService } from '../services/importService.js';
import { centavosToPesos, pesosToCentavos } from '../../shared/utils/currencyUtils.js';
import { validateCentavos } from '../../shared/utils/centavosValidation.js';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';
import { getNow } from '../services/DateService.js';

const CLIENT_ID = 'AVII';
const FISCAL_YEAR = 2026;
const DUE_DATE = '2025-10-01';
const FISCAL_QUARTER = 1; // Q1

/**
 * Extract water consumption charges from unitAccounting.json
 * Returns charges grouped by unit and quarter
 */
function extractWaterCharges(unitAccounting, fiscalYear, fiscalQuarter, fiscalYearStartMonth, importService) {
  const charges = {};
  
  if (!Array.isArray(unitAccounting)) {
    return charges;
  }
  
  // Helper to normalize unit ID
  const normalizeUnitId = (unitId) => {
    if (!unitId) return '';
    const match = String(unitId).match(/^(\d+)/);
    return match ? match[1] : String(unitId).trim();
  };
  
  for (const entry of unitAccounting) {
    const category = entry['Categoría'] || entry.Category || '';
    
    // Only process Water Consumption charges (NOT payments - those are handled separately)
    // Skip payments (entries with ✓ = true are payments, charges are entries without checkmark OR negative amounts indicate credit usage)
    // Actually, for charges, we want entries where category is Water Consumption
    // The checkmark indicates if it was paid, but it's still a charge entry
    if (category !== 'Water Consumption') continue;
    
    const unitId = normalizeUnitId(entry.Depto || entry.Unit);
    if (!unitId) continue;
    
    const date = new Date(entry.Fecha || entry.Date);
    if (isNaN(date.getTime())) continue;
    
    const amount = parseFloat(entry.Cantidad || entry.Amount || 0);
    if (isNaN(amount) || amount === 0) continue;
    
    // Skip negative amounts (those are credit usage, not charges)
    if (amount < 0) continue;
    
    // Check if this charge belongs to the target quarter using ImportService method
    const fiscalQ = importService.getFiscalQuarter(date, fiscalYearStartMonth);
    
    // Only include if charge belongs to target fiscal year and quarter
    if (fiscalQ.year !== fiscalYear || fiscalQ.quarter !== fiscalQuarter) continue;
    
    const key = `${unitId}_${fiscalYear}_Q${fiscalQuarter}`;
    if (!charges[key]) {
      charges[key] = {
        fiscalYear,
        fiscalQuarter,
        unitId,
        totalCharge: 0
      };
    }
    
    const amountCentavos = validateCentavos(pesosToCentavos(amount), `charge[${key}].amount`);
    charges[key].totalCharge = validateCentavos(
      charges[key].totalCharge + amountCentavos,
      `charge[${key}].totalCharge`
    );
  }
  
  return charges;
}

/**
 * Extract water bill payments from unitAccounting.json
 * Returns payments grouped by unit and quarter, matching UPS format
 */
function extractWaterBillPayments(unitAccounting, fiscalYear, fiscalQuarter, fiscalYearStartMonth, importService) {
  const payments = {};
  
  if (!Array.isArray(unitAccounting)) {
    return payments;
  }
  
  // Helper to normalize unit ID
  const normalizeUnitId = (unitId) => {
    if (!unitId) return '';
    const match = String(unitId).match(/^(\d+)/);
    return match ? match[1] : String(unitId).trim();
  };
  
  for (const entry of unitAccounting) {
    const category = entry['Categoría'] || entry.Category || '';
    
    // Only process Water Consumption and Water Penalties payments
    // Skip charges (we only want payments - entries with ✓ = true)
    const isPaid = entry['✓'] === true || entry.Paid === true;
    if (!isPaid) continue;
    
    if (category !== 'Water Consumption' && category !== 'Water Penalties') continue;
    
    const unitId = normalizeUnitId(entry.Depto || entry.Unit);
    if (!unitId) continue;
    
    const date = new Date(entry.Fecha || entry.Date);
    if (isNaN(date.getTime())) continue;
    
    const amount = parseFloat(entry.Cantidad || entry.Amount || 0);
    if (isNaN(amount) || amount === 0) continue;
    
    // Check if this payment belongs to the target quarter using ImportService method
    const fiscalQ = importService.getFiscalQuarter(date, fiscalYearStartMonth);
    
    // Only include if payment belongs to target fiscal year and quarter
    if (fiscalQ.year !== fiscalYear || fiscalQ.quarter !== fiscalQuarter) continue;
    
    const key = `${unitId}_${fiscalYear}_Q${fiscalQuarter}`;
    if (!payments[key]) {
      payments[key] = {
        fiscalYear,
        fiscalQuarter,
        unitId,
        amountApplied: 0,
        basePaid: 0,
        penaltyPaid: 0,
        paymentDate: date.toISOString(),
        transactionId: null, // Transactions aren't in unitAccounting.json
        paymentSeq: entry['Notas'] || entry.Notes || null
      };
    }
    
    const amountCentavos = validateCentavos(pesosToCentavos(amount), `payment[${key}].amount`);
    payments[key].amountApplied = validateCentavos(
      payments[key].amountApplied + amountCentavos,
      `payment[${key}].amountApplied`
    );
    
    if (category === 'Water Consumption') {
      payments[key].basePaid = validateCentavos(
        payments[key].basePaid + amountCentavos,
        `payment[${key}].basePaid`
      );
    } else if (category === 'Water Penalties') {
      payments[key].penaltyPaid = validateCentavos(
        payments[key].penaltyPaid + amountCentavos,
        `payment[${key}].penaltyPaid`
      );
    }
    
    // Keep the most recent payment date
    if (date > new Date(payments[key].paymentDate)) {
      payments[key].paymentDate = date.toISOString();
    }
  }
  
  return payments;
}

/**
 * Apply payment to quarterly bill using UPS logic
 */
async function applyPaymentToBill(db, billUpdate) {
  const billId = `${billUpdate.fiscalYear}-Q${billUpdate.fiscalQuarter}`;
  const billRef = db
    .collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills').doc(billId);
  
  const billDoc = await billRef.get();
  if (!billDoc.exists) {
    console.warn(`⚠️  Quarterly bill document ${billId} not found for unit ${billUpdate.unitId}`);
    return;
  }
  
  const billData = billDoc.data();
  const unitBill = billData.bills?.units?.[billUpdate.unitId];
  
  if (!unitBill) {
    console.warn(`⚠️  No bill for unit ${billUpdate.unitId} in quarterly bill ${billId}`);
    return;
  }
  
  // Update bill with payment info (using UPS logic)
  const newPaidAmount = validateCentavos(
    (unitBill.paidAmount || 0) + billUpdate.amountApplied,
    'newPaidAmount'
  );
  const newBasePaid = validateCentavos(
    (unitBill.basePaid || 0) + billUpdate.basePaid,
    'newBasePaid'
  );
  const newPenaltyPaid = validateCentavos(
    (unitBill.penaltyPaid || 0) + billUpdate.penaltyPaid,
    'newPenaltyPaid'
  );
  
  // Determine new status
  let newStatus = 'unpaid';
  if (newPaidAmount >= unitBill.totalAmount) {
    newStatus = 'paid';
  } else if (newPaidAmount > 0) {
    newStatus = 'partial';
  }
  
  // Get existing payments array
  const existingPayments = unitBill.payments || [];
  
  // Create payment entry (following UPS pattern)
  const paymentEntry = {
    amount: billUpdate.amountApplied,
    baseChargePaid: billUpdate.basePaid,
    penaltyPaid: billUpdate.penaltyPaid,
    date: billUpdate.paymentDate || getNow().toISOString(),
    transactionId: billUpdate.transactionId || null,
    reference: billUpdate.paymentSeq || null,
    method: 'bank_transfer', // Default for imports
    recordedAt: getNow().toISOString()
  };
  
  // Append to payments array
  const updatedPayments = [...existingPayments, paymentEntry];
  
  await billRef.update({
    [`bills.units.${billUpdate.unitId}.paidAmount`]: newPaidAmount,
    [`bills.units.${billUpdate.unitId}.basePaid`]: newBasePaid,
    [`bills.units.${billUpdate.unitId}.penaltyPaid`]: newPenaltyPaid,
    [`bills.units.${billUpdate.unitId}.status`]: newStatus,
    [`bills.units.${billUpdate.unitId}.payments`]: updatedPayments
  });
  
  const amountPesos = centavosToPesos(billUpdate.amountApplied);
  console.log(`    ✓ Applied payment to unit ${billUpdate.unitId}: $${amountPesos.toFixed(2)} (base: $${centavosToPesos(billUpdate.basePaid).toFixed(2)}, penalty: $${centavosToPesos(billUpdate.penaltyPaid).toFixed(2)}) → ${newStatus}`);
}

async function deleteAndRegenerate() {
  try {
    const db = await getDb();
    
    console.log('🗑️  Deleting existing 2026-Q1 bill...');
    await db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-Q1')
      .delete();
    console.log('✅ Deleted\n');
    
    // Step 1: Load and extract water data from unitAccounting.json (source of truth)
    console.log('📋 Loading water data from unitAccounting.json (source of truth)...');
    let waterPenalties = {};
    let waterCharges = {};
    let fiscalYearStartMonth = 7; // Default July
    
    try {
      // Get fiscal year start from client config
      const clientConfig = await db.collection('clients').doc(CLIENT_ID).collection('config').doc('fiscalYear').get();
      if (clientConfig.exists) {
        const configData = clientConfig.data();
        fiscalYearStartMonth = configData.startMonth || 7;
      }
      
      // Use ImportService to load from Firebase Storage
      // Pass 'firebase_storage' as dataPath to use Firebase Storage instead of filesystem
      const importService = new ImportService(CLIENT_ID, 'firebase_storage', null);
      const unitAccountingData = await importService.loadJsonFile('unitAccounting.json');
      
      // Extract penalties, charges, and payments from unitAccounting.json (historical source of truth)
      waterPenalties = importService.extractWaterPenalties(unitAccountingData, fiscalYearStartMonth);
      waterCharges = extractWaterCharges(unitAccountingData, FISCAL_YEAR, FISCAL_QUARTER, fiscalYearStartMonth, importService);
      
      console.log(`✅ Loaded ${Object.keys(waterPenalties).length} water penalty entries from unitAccounting.json`);
      if (Object.keys(waterPenalties).length > 0) {
        console.log(`   Penalty keys: ${Object.keys(waterPenalties).slice(0, 5).join(', ')}${Object.keys(waterPenalties).length > 5 ? '...' : ''}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not load penalties from unitAccounting.json: ${error.message}`);
      console.warn(`   Will generate bill without imported penalties`);
    }
    
    // Step 2: Generate the bill normally (this will calculate penalties, but we'll override them)
    console.log('\n💰 Generating new Q1 bill...');
    const result = await waterBillsService.generateQuarterlyBill(CLIENT_ID, FISCAL_YEAR, DUE_DATE);
    console.log('✅ Bill generated\n');
    
    // Step 3: Apply imported charges and penalties from unitAccounting.json to match Sheets
    // CRITICAL: unitAccounting.json is the source of truth for historical data
    console.log('📝 Applying imported charges and penalties from unitAccounting.json (source of truth)...');
    
    // First, apply water consumption charges from Sheets (override calculated amounts)
    if (Object.keys(waterCharges).length > 0) {
      console.log(`  Applying water charges for ${Object.keys(waterCharges).length} units...`);
      let chargesUpdated = 0;
      
      for (const [key, chargeData] of Object.entries(waterCharges)) {
        const unitId = chargeData.unitId;
        const unitBill = bills[unitId];
        
        if (unitBill) {
          const importedCharge = validateCentavos(chargeData.totalCharge, 'importedCharge');
          const currentPenalty = validateCentavos(unitBill.penaltyAmount || 0, 'currentPenalty');
          const newTotalAmount = validateCentavos(importedCharge + currentPenalty, 'newTotalAmount');
          
          // Update the unit bill with imported charge (override calculated amount)
          bills[unitId] = {
            ...unitBill,
            waterCharge: importedCharge,
            currentCharge: importedCharge,
            totalAmount: newTotalAmount
          };
          
          chargesUpdated++;
          console.log(`    ✅ Unit ${unitId}: Applied charge ${centavosToPesos(importedCharge).toFixed(2)} pesos (from Sheets)`);
        }
      }
      
      console.log(`  ✅ Applied water charges to ${chargesUpdated} units`);
    }
    
    // Then, apply penalties from Sheets (or clear if none exist)
    if (Object.keys(waterPenalties).length > 0 || Object.keys(bills).length > 0) {
      console.log(`  Applying penalties for ${Object.keys(waterPenalties).length} units with penalties...`);
      const billRef = db.collection('clients').doc(CLIENT_ID)
        .collection('projects').doc('waterBills')
        .collection('bills').doc('2026-Q1');
      
      const billDoc = await billRef.get();
      if (!billDoc.exists) {
        throw new Error('Bill document not found after generation');
      }
      
      const billData = billDoc.data();
      const bills = billData.bills?.units || {};
      const quarterKey = `${FISCAL_YEAR}_Q${FISCAL_QUARTER}`;
      
      let updatedCount = 0;
      let totalPenaltyApplied = 0;
      
      // Helper to normalize unit ID
      const normalizeUnitId = (unitId) => {
        if (!unitId) return '';
        const match = String(unitId).match(/^(\d+)/);
        return match ? match[1] : String(unitId).trim();
      };
      
      // Update each unit's penalty based on imported data
      // CRITICAL: If unitAccounting.json has no penalty entry for a unit, clear any calculated penalties
      // This ensures we match Sheets exactly - if Sheets shows no penalty, bill should show no penalty
      for (const [unitId, unitBill] of Object.entries(bills)) {
        const normalizedUnitId = normalizeUnitId(unitId);
        const penaltyKey = `${normalizedUnitId}_${quarterKey}`;
        const penaltyData = waterPenalties[penaltyKey];
        
        const currentBaseCharge = validateCentavos(unitBill.currentCharge || 0, 'currentCharge');
        
        if (penaltyData) {
          // Sheets has penalty data - apply it
          const importedPenalty = validateCentavos(penaltyData.totalPenaltyCentavos || 0, 'importedPenalty');
          const newTotalAmount = validateCentavos(currentBaseCharge + importedPenalty, 'newTotalAmount');
          
          // Update the unit bill with imported penalty
          bills[unitId] = {
            ...unitBill,
            penaltyAmount: importedPenalty,
            totalAmount: newTotalAmount,
            penalty: {
              amount: importedPenalty,
              source: 'imported', // Mark as imported from Sheets
              entries: penaltyData.entries || []
            }
          };
          
          totalPenaltyApplied = validateCentavos(totalPenaltyApplied + importedPenalty, 'totalPenaltyApplied');
          updatedCount++;
          console.log(`  ✅ Unit ${normalizedUnitId}: Applied penalty ${centavosToPesos(importedPenalty).toFixed(2)} pesos`);
        } else {
          // Sheets has NO penalty entry - clear any calculated penalties to match Sheets
          // Check if there was a calculated penalty that needs to be cleared
          const currentPenalty = unitBill.penaltyAmount || 0;
          if (currentPenalty > 0) {
            const newTotalAmount = validateCentavos(currentBaseCharge, 'newTotalAmount');
            bills[unitId] = {
              ...unitBill,
              penaltyAmount: 0,
              totalAmount: newTotalAmount,
              penalty: undefined // Remove penalty object entirely
            };
            console.log(`  ✅ Unit ${normalizedUnitId}: Cleared calculated penalty ${centavosToPesos(currentPenalty).toFixed(2)} pesos (Sheets shows none)`);
            updatedCount++;
          }
        }
      }
      
      if (updatedCount > 0) {
        // Update summary totals
        const summary = billData.summary || {};
        const newTotalBilled = validateCentavos(
          (summary.totalBilled || 0) - (summary.totalPenalties || 0) + totalPenaltyApplied,
          'newTotalBilled'
        );
        
        // Update the bill document
        await billRef.update({
          'bills.units': bills,
          'summary.totalPenalties': totalPenaltyApplied,
          'summary.totalBilled': newTotalBilled
        });
        
        console.log(`  ✅ Applied penalties to ${updatedCount} units`);
        console.log(`     Total penalties applied: ${centavosToPesos(totalPenaltyApplied).toFixed(2)} pesos`);
      } else {
        console.log('  ℹ️  No penalties found in unitAccounting.json for Q1 (checked all units)');
      }
    }
    
    // Step 4: Extract and apply payments from unitAccounting.json to update bill status
    console.log('\n💳 Extracting water bill payments from unitAccounting.json...');
    let waterPayments = {};
    
    try {
      const importService = new ImportService(CLIENT_ID, 'firebase_storage', null);
      const unitAccountingData = await importService.loadJsonFile('unitAccounting.json');
      waterPayments = extractWaterBillPayments(unitAccountingData, FISCAL_YEAR, FISCAL_QUARTER, fiscalYearStartMonth, importService);
      
      console.log(`✅ Found ${Object.keys(waterPayments).length} units with payments for Q1`);
      
      if (Object.keys(waterPayments).length > 0) {
        console.log('📝 Applying payments to bills...');
        const billRef = db.collection('clients').doc(CLIENT_ID)
          .collection('projects').doc('waterBills')
          .collection('bills').doc('2026-Q1');
        
        for (const [key, paymentData] of Object.entries(waterPayments)) {
          await applyPaymentToBill(db, paymentData);
        }
        
        console.log(`✅ Applied payments for ${Object.keys(waterPayments).length} units`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not extract/apply payments from unitAccounting.json: ${error.message}`);
      console.warn(`   Bill payment status may need to be updated manually`);
    }
    
    // Get final bill data
    const finalBillDoc = await db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-Q1')
      .get();
    const finalBill = finalBillDoc.data();
    
    console.log('\n✅ Q1 bill regeneration complete!');
    console.log(`\nBill ID: ${finalBillDoc.id}`);
    console.log(`Fiscal Quarter: Q${finalBill.fiscalQuarter}`);
    console.log(`Readings: ${finalBill.readingsIncluded?.length || 0} months`);
    finalBill.readingsIncluded?.forEach(r => {
      console.log(`  - ${r.label} (month ${r.month})`);
    });
    console.log(`\nTotal Billed: $${centavosToPesos(finalBill.summary?.totalBilled || 0).toFixed(2)}`);
    console.log(`Total Penalties: $${centavosToPesos(finalBill.summary?.totalPenalties || 0).toFixed(2)}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

deleteAndRegenerate();

