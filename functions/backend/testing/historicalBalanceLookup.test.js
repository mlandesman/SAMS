import { testHarness } from './testHarness.js';

const cases = [
  { clientId: 'AVII', asOfDate: '2025-11-15', label: 'regular activity' },
  { clientId: 'AVII', asOfDate: '2025-01-31', label: 'month boundary' },
  { clientId: 'AVII', asOfDate: '2010-01-01', label: 'no transactions window' },
  { clientId: 'MTC', asOfDate: '2025-11-15', label: 'regular activity' },
  { clientId: 'MTC', asOfDate: '2025-01-31', label: 'month boundary' },
  { clientId: 'MTC', asOfDate: '2010-01-01', label: 'no transactions window' }
];

const tests = cases.map(({ clientId, asOfDate, label }) => ({
  name: `Historical balances ${clientId} ${asOfDate} (${label})`,
  async test({ api }) {
    const response = await api.get(`/api/clients/${clientId}/balances/current`, {
      params: { asOfDate }
    });
    const payload = response.data;
    const hasData = payload?.success && payload?.data && Array.isArray(payload.data.accounts);
    const hasMeta = !!payload?.data?.historicalLookup;

    return {
      passed: hasData && hasMeta,
      data: {
        clientId,
        asOfDate,
        cashBalance: payload?.data?.cashBalance,
        bankBalance: payload?.data?.bankBalance,
        accountCount: payload?.data?.accounts?.length || 0,
        latestKnownTransactionDate: payload?.data?.historicalLookup?.latestKnownTransactionDate?.ISO_8601 || null,
        rolledBackTransactionCount: payload?.data?.historicalLookup?.rolledBackTransactionCount ?? null
      }
    };
  }
}));

await testHarness.runTests(tests, { stopOnFailure: false, showSummary: true });
