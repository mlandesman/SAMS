#!/usr/bin/env node

import { testHarness } from './testHarness.js';
import { getDb } from '../firebase.js';
import { calculateSatisfiedFromLedger } from '../../shared/utils/billCalculations.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '103';
const FISCAL_YEAR = 2026;

const PAYMENT_DATE = '2026-01-13';
const PAYMENT_AMOUNT_CENTAVOS = 505558; // $5,055.58

const tests = [
  {
    name: `Water unpaid bills summary ${CLIENT_ID} ${UNIT_ID}`,
    async test({ api }) {
      const response = await api.get(`/water/clients/${CLIENT_ID}/bills/unpaid/${UNIT_ID}`);
      const payload = response.data || {};
      return {
        passed: payload.success !== false,
        data: payload
      };
    }
  },
  {
    name: `Detect invalid water bill IDs ${CLIENT_ID} ${UNIT_ID}`,
    async test() {
      const db = await getDb();
      const snapshot = await db.collection('clients').doc(CLIENT_ID)
        .collection('projects').doc('waterBills')
        .collection('bills')
        .get();

      const invalidIds = [];
      const outOfRangeMonths = [];

      snapshot.forEach(doc => {
        const billData = doc.data();
        const unitBill = billData.bills?.units?.[UNIT_ID];
        if (!unitBill || unitBill.status === 'paid') return;

        const parts = String(doc.id || '').split('-');
        const fiscalYear = parseInt(parts[0], 10);
        const fiscalMonth = parseInt(parts[1], 10);

        if (parts.length !== 2 || Number.isNaN(fiscalYear) || Number.isNaN(fiscalMonth)) {
          invalidIds.push({
            docId: doc.id,
            parts,
            status: unitBill.status
          });
          return;
        }

        if (fiscalMonth < 0 || fiscalMonth > 11) {
          outOfRangeMonths.push({
            docId: doc.id,
            fiscalMonth
          });
        }
      });

      return {
        passed: true,
        data: {
          invalidIds,
          outOfRangeMonths,
          totalInvalid: invalidIds.length,
          totalOutOfRange: outOfRangeMonths.length
        }
      };
    }
  },
  {
    name: `Calculate satisfied from ledger ${CLIENT_ID} ${UNIT_ID} FY${FISCAL_YEAR}`,
    async test({ api }) {
      const statementResponse = await api.get(`/clients/${CLIENT_ID}/reports/statement/raw`, {
        params: {
          unitId: UNIT_ID,
          fiscalYear: FISCAL_YEAR,
          excludeFutureBills: 'false'
        }
      });
      const raw = statementResponse.data?.data || {};
      const ledgerRows = raw.chronologicalTransactions || [];

      const previewResponse = await api.post('/payments/unified/preview', {
        clientId: CLIENT_ID,
        unitId: UNIT_ID,
        amount: PAYMENT_AMOUNT_CENTAVOS,
        paymentDate: PAYMENT_DATE
      });
      const preview = previewResponse.data?.preview || {};

      const bills = [];
      (preview.hoa?.monthsAffected || []).forEach(entry => {
        bills.push({
          billId: entry.billPeriod,
          module: 'hoadues',
          _metadata: { moduleType: 'hoa', monthIndex: entry.monthIndex },
          _hoaMetadata: { quarterIndex: entry.quarterIndex, isQuarterly: entry.isQuarterly }
        });
      });
      (preview.water?.billsAffected || []).forEach(entry => {
        bills.push({
          billId: entry.billPeriod,
          module: 'water',
          _metadata: { moduleType: 'water', monthIndex: entry.monthIndex }
        });
      });

      const satisfiedMap = calculateSatisfiedFromLedger(ledgerRows, bills);
      const satisfiedOutput = Object.fromEntries(satisfiedMap);

      return {
        passed: true,
        data: {
          satisfiedOutput,
          billCount: bills.length,
          ledgerRowCount: ledgerRows.length
        }
      };
    }
  }
];

async function run() {
  await testHarness.runTests(tests, { stopOnFailure: true, showSummary: true });
}

run().catch(error => {
  console.error('Debug test failed:', error);
  process.exit(1);
});
