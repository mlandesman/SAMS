/**
 * Create a test bill for water payment testing
 * Generates a clean unpaid bill to test payment flow
 */

import { getDb } from '../backend/firebase.js';
import { getNow } from '../backend/services/DateService.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '101';
const FISCAL_PERIOD = '2026-00'; // July 2025
const BASE_CHARGE = 95000; // $950 in centavos
const DUE_DATE = '2025-08-07'; // Due in August (30 days after July)

async function createTestBill() {
  console.log('\n🧪 Creating test bill for payment testing...\n');
  
  try {
    const db = await getDb();
    
    const billRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(FISCAL_PERIOD);
    
    // Check if bill already exists
    const existingBill = await billRef.get();
    
    if (existingBill.exists) {
      const unitData = existingBill.data()?.bills?.units?.[UNIT_ID];
      if (unitData) {
        console.log(`⚠️  Bill ${FISCAL_PERIOD} already exists for Unit ${UNIT_ID}:`);
        console.log(`   Status: ${unitData.status}`);
        console.log(`   Current Charge: $${unitData.currentCharge / 100}`);
        console.log(`   Paid Amount: $${(unitData.paidAmount || 0) / 100}`);
        console.log(`\n❓ Do you want to overwrite it? (Y/n): `);
        
        // For now, just overwrite
        console.log(`   → Overwriting existing bill...`);
      }
    }
    
    // Create fresh unpaid bill
    const billData = {
      bills: {
        units: {
          [UNIT_ID]: {
            currentCharge: BASE_CHARGE,      // in centavos
            penaltyAmount: 0,                 // no initial penalty
            totalAmount: BASE_CHARGE,        // in centavos
            paidAmount: 0,
            basePaid: 0,
            penaltyPaid: 0,
            status: 'unpaid',
            dueDate: DUE_DATE,
            billDate: '2025-07-01',
            consumption: 18,
            carWashCount: 1,
            boatWashCount: 0,
            waterCharge: 90000,  // 18 m³ * 5000 centavos
            carWashCharge: 5000,
            boatWashCharge: 0,
            previousBalance: 0,
            payments: [],
            created: getNow().toISOString(),
            updated: getNow().toISOString()
          }
        }
      },
      fiscalPeriod: FISCAL_PERIOD,
      created: getNow().toISOString(),
      updated: getNow().toISOString()
    };
    
    await billRef.set(billData, { merge: true });
    
    console.log(`✅ Test bill created successfully!\n`);
    console.log(`   Client: ${CLIENT_ID}`);
    console.log(`   Unit: ${UNIT_ID}`);
    console.log(`   Period: ${FISCAL_PERIOD} (July 2025)`);
    console.log(`   Base Charge: $${BASE_CHARGE / 100}`);
    console.log(`   Due Date: ${DUE_DATE}`);
    console.log(`   Status: unpaid`);
    console.log(`\n📋 Bill is ready for payment testing!`);
    console.log(`\n💡 Now run: node tests/water-payment-live-test.js`);
    
  } catch (error) {
    console.error('\n❌ Error creating test bill:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createTestBill();

