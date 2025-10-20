/**
 * Create multiple test bills for comprehensive payment testing
 */

import { getDb } from '../backend/firebase.js';
import { getNow } from '../backend/services/DateService.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '101';

const bills = [
  {
    period: '2026-00', // July 2025
    baseCharge: 95000,  // $950
    dueDate: '2025-08-07'
  },
  {
    period: '2026-01', // August 2025
    baseCharge: 90000,  // $900
    dueDate: '2025-09-07'
  }
];

async function createTestBills() {
  console.log('\n🧪 Creating multiple test bills...\n');
  
  try {
    const db = await getDb();
    
    for (const bill of bills) {
      const billRef = db.collection('clients').doc(CLIENT_ID)
        .collection('projects').doc('waterBills')
        .collection('bills').doc(bill.period);
      
      const billData = {
        bills: {
          units: {
            [UNIT_ID]: {
              currentCharge: bill.baseCharge,
              penaltyAmount: 0,
              totalAmount: bill.baseCharge,
              paidAmount: 0,
              basePaid: 0,
              penaltyPaid: 0,
              status: 'unpaid',
              dueDate: bill.dueDate,
              billDate: bill.period.replace('2026-0', '2025-0') + '-01',
              consumption: 18,
              carWashCount: 1,
              boatWashCount: 0,
              waterCharge: bill.baseCharge - 5000,
              carWashCharge: 5000,
              boatWashCharge: 0,
              previousBalance: 0,
              payments: [],
              created: getNow().toISOString(),
              updated: getNow().toISOString()
            }
          }
        },
        fiscalPeriod: bill.period,
        created: getNow().toISOString(),
        updated: getNow().toISOString()
      };
      
      await billRef.set(billData, { merge: true });
      console.log(`✅ Created bill ${bill.period}: $${bill.baseCharge / 100}, due ${bill.dueDate}`);
    }
    
    console.log(`\n📋 ${bills.length} test bills ready!`);
    console.log(`\n💡 Now run: node tests/water-payment-live-test.js`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

createTestBills();
