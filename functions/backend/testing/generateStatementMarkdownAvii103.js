#!/usr/bin/env node

import { testHarness } from './testHarness.js';
import { generateStatementData } from '../services/generateStatementData.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '103';
const FISCAL_YEAR = 2026;

const buildInputRows = (transactions = []) => {
  const hoaDuesCharges = [];
  const waterBillCharges = [];
  const postedPenalties = [];
  const cashPayments = [];
  const adminCreditAdjustments = [];

  transactions.forEach((txn) => {
    if (!txn || typeof txn !== 'object') return;

    const row = {
      date: txn.date,
      description: txn.description || '',
      amount: txn.amount
    };

    if (txn.type === 'payment' || txn.payment > 0) {
      cashPayments.push(row);
      return;
    }

    if (txn.type === 'credit_adjustment') {
      adminCreditAdjustments.push(row);
      return;
    }

    if (txn.type === 'penalty') {
      postedPenalties.push(row);
      return;
    }

    if (txn.category === 'water') {
      waterBillCharges.push(row);
      return;
    }

    hoaDuesCharges.push(row);
  });

  return {
    hoaDuesCharges,
    waterBillCharges,
    postedPenalties,
    cashPayments,
    adminCreditAdjustments
  };
};

const tests = [
  {
    name: `Statement raw rows ${CLIENT_ID} ${UNIT_ID} FY${FISCAL_YEAR}`,
    async test({ api }) {
      const response = await api.get(`/clients/${CLIENT_ID}/reports/statement/raw`, {
        params: {
          unitId: UNIT_ID,
          fiscalYear: FISCAL_YEAR,
          excludeFutureBills: 'false'
        }
      });

      const rawData = response.data?.data;
      if (!rawData || !Array.isArray(rawData.chronologicalTransactions)) {
        return {
          passed: false,
          reason: 'Statement raw data did not include chronologicalTransactions.'
        };
      }

      const openingBalance = rawData.summary?.openingBalance ?? 0;
      const {
        hoaDuesCharges,
        waterBillCharges,
        postedPenalties,
        cashPayments,
        adminCreditAdjustments
      } = buildInputRows(rawData.chronologicalTransactions);

      const result = generateStatementData({
        openingBalance,
        hoaDuesCharges,
        waterBillCharges,
        postedPenalties,
        cashPayments,
        adminCreditAdjustments
      });

      const rows = (result.rows || []).map((row) => ({
        date: row.date,
        description: row.description,
        amountCentavos: row.amountCentavos,
        balanceCentavos: Math.round((row.balance || 0) * 100)
      }));

      console.log(JSON.stringify(rows, null, 2));

      return {
        passed: true,
        data: {
          rowCount: rows.length
        }
      };
    }
  }
];

async function run() {
  await testHarness.runTests(tests, { stopOnFailure: true, showSummary: true });
}

run().catch((error) => {
  console.error('Statement markdown generation failed:', error);
  process.exit(1);
});
