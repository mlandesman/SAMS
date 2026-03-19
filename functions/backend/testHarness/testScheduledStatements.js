/**
 * Test the scheduled monthly statement generation
 * 
 * Usage:
 *   node backend/testHarness/testScheduledStatements.js
 *   node backend/testHarness/testScheduledStatements.js --dry-run
 *   node backend/testHarness/testScheduledStatements.js --year=2026 --month=2
 * 
 * Requires: local backend running on localhost:5001
 * Run from: functions/ directory
 */

import { generateMonthlyStatements } from '../services/scheduledStatementService.js';

const options = {
  dryRun: false
};

process.argv.slice(2).forEach(arg => {
  if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg.startsWith('--year=')) {
    options.targetYear = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--month=')) {
    options.targetMonth = parseInt(arg.split('=')[1], 10);
  }
});

console.log('🧪 Testing scheduled statement generation');
console.log(`   Options: ${JSON.stringify(options)}`);
console.log('');

try {
  const result = await generateMonthlyStatements(options);
  console.log('\n📊 Result:', JSON.stringify(result, null, 2));
  process.exit(result.totalFailed > 0 ? 1 : 0);
} catch (error) {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
}
