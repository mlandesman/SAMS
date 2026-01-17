#!/usr/bin/env node

import { testHarness } from './testHarness.js';

const PAYMENT_DATE = '2026-01-13';
const PAYMENT_AMOUNT_CENTAVOS = 505558; // $5,055.58

const tests = [
  {
    name: 'UPC preview AVII 103 on 2026-01-13',
    async test({ api }) {
      const payload = {
        clientId: 'AVII',
        unitId: '103',
        amount: PAYMENT_AMOUNT_CENTAVOS,
        paymentDate: PAYMENT_DATE
      };

      const response = await api.post('/payments/unified/preview', payload);
      const preview = response.data?.preview;

      const summary = {
        totalAllocated: preview?.summary?.totalAllocated ?? null,
        hoaTotalPaid: preview?.hoa?.totalPaid ?? null,
        waterTotalPaid: preview?.water?.totalPaid ?? null,
        creditAdded: preview?.credit?.added ?? null,
        creditUsed: preview?.credit?.used ?? null,
        finalCredit: preview?.credit?.final ?? null
      };

      console.log('UPC preview summary:', summary);

      return {
        passed: !!preview,
        data: {
          previewSummary: summary
        }
      };
    }
  },
  {
    name: 'Statement raw AVII 103 FY2026',
    async test({ api }) {
      const response = await api.get('/clients/AVII/reports/statement/raw', {
        params: {
          unitId: '103',
          fiscalYear: 2026,
          excludeFutureBills: 'false'
        }
      });

      const summary = response.data?.data?.summary || {};
      console.log('Statement raw summary:', summary);

      return {
        passed: !!response.data?.success,
        data: {
          statementSummary: summary
        }
      };
    }
  },
  {
    name: 'HOA dues doc AVII 103 FY2026',
    async test({ api }) {
      const response = await api.get('/hoadues/AVII/unit/103/2026');
      const duesData = response.data || {};
      const scheduledAmount = duesData.scheduledAmount ?? null;
      const payments = Array.isArray(duesData.payments) ? duesData.payments : [];
      console.log('HOA dues scheduledAmount:', scheduledAmount);
      console.log('HOA dues payments (months 6-8):', payments.slice(6, 9));

      return {
        passed: !!duesData.scheduledAmount,
        data: {
          scheduledAmount,
          paymentsSample: payments.slice(0, 12)
        }
      };
    }
  },
  {
    name: 'Credit balance AVII 103',
    async test({ api }) {
      const response = await api.get('/credit/AVII/103');
      const creditData = response.data || {};
      console.log('Credit balance response:', creditData);

      return {
        passed: creditData.success !== false,
        data: creditData
      };
    }
  },
  {
    name: 'Water unpaid bills AVII 103',
    async test({ api }) {
      const response = await api.get('/water/clients/AVII/bills/unpaid/103');
      const unpaid = response.data || {};
      console.log('Water unpaid summary:', unpaid?.summary || unpaid);

      return {
        passed: unpaid.success !== false,
        data: unpaid
      };
    }
  }
];

async function run() {
  await testHarness.runTests(tests, { stopOnFailure: true, showSummary: true });
}

run().catch(error => {
  console.error('UPC preview test failed:', error);
  process.exit(1);
});
