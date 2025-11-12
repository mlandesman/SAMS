#!/usr/bin/env node

/**
 * Delete existing Q1 bill and regenerate
 * Quick utility for testing
 */

import { getDb } from '../firebase.js';
import waterBillsService from '../services/waterBillsService.js';
import { centavosToPesos } from '../../shared/utils/currencyUtils.js';

const CLIENT_ID = 'AVII';
const FISCAL_YEAR = 2026;
const DUE_DATE = '2025-10-01';

async function deleteAndRegenerate() {
  try {
    const db = await getDb();
    
    console.log('🗑️  Deleting existing 2026-Q1 bill...');
    await db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-Q1')
      .delete();
    console.log('✅ Deleted\n');
    
    console.log('💰 Generating new Q1 bill...');
    const result = await waterBillsService.generateQuarterlyBill(CLIENT_ID, FISCAL_YEAR, DUE_DATE);
    
    console.log('\n✅ Bill generated successfully!');
    console.log(`\nBill ID: ${result._billId}`);
    console.log(`Fiscal Quarter: Q${result.fiscalQuarter}`);
    console.log(`Readings: ${result.readingsIncluded.length} months`);
    result.readingsIncluded.forEach(r => {
      console.log(`  - ${r.label} (month ${r.month})`);
    });
    console.log(`\nTotal: $${centavosToPesos(result.summary.totalBilled)}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

deleteAndRegenerate();

