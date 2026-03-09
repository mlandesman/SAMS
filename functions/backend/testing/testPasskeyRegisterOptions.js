/**
 * Test passkey register/options endpoint using test harness
 * Uses Michael's test account (fjXv8gX1CYWBvOZ1CS27j96oRCT2 / michael@landesman.com)
 *
 * Usage: node functions/backend/testing/testPasskeyRegisterOptions.js
 * Requires: backend running on localhost:5001
 */

import { testHarness } from './testHarness.js';

const MICHAEL_UID = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';
const MICHAEL_EMAIL = 'michael@landesman.com';

await testHarness.runTest({
  name: 'Passkey Register Options',
  testUser: MICHAEL_UID,
  async test({ api }) {
    const response = await api.request({
      method: 'POST',
      url: '/auth/passkey/register/options',
      data: { email: MICHAEL_EMAIL },
    });

    const passed = response.status === 200;
    return {
      passed,
      data: response.data,
      actualStatus: response.status,
      reason: passed
        ? null
        : `Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`,
    };
  },
});

testHarness.showSummary();
