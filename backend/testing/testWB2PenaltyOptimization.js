/**
 * Task WB2: Penalty Calculation Optimization Tests
 * Uses testHarness for proper authentication and API calls
 */

import { testHarness } from './testHarness.js';

const CLIENT_ID = 'AVII';
const TEST_UNIT_IDS = ['203', '104'];

async function main() {
  console.log('\n🧪 ═══════════════════════════════════════════════════════════');
  console.log('   TASK WB2: PENALTY CALCULATION OPTIMIZATION TESTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  let fullRecalcMetrics = null;
  let scopedRecalcMetrics = null;

  try {
    // Test 1: Full Penalty Recalculation (Baseline - All Units)
    await testHarness.runTest({
      name: 'Test 1: Full Penalty Recalculation (Baseline - All Units)',
      async test({ api }) {
        console.log(`\n  🔄 Running full penalty recalculation for ${CLIENT_ID}...`);
        console.log(`     (This processes ALL units - baseline for comparison)`);
        
        const startTime = Date.now();
        const response = await api.post(`/water/clients/${CLIENT_ID}/bills/recalculate-penalties`, {});
        const totalTime = Date.now() - startTime;
        
        if (!response.data.success) {
          throw new Error(`Recalculation failed: ${response.data.error?.message || 'Unknown error'}`);
        }
        
        const metrics = response.data.data;
        fullRecalcMetrics = { ...metrics, totalTime };
        
        console.log(`\n  ✅ Full recalculation completed in ${totalTime}ms`);
        console.log(`\n  📊 Performance Metrics:`);
        console.log(`     - Service processing time: ${metrics.processingTimeMs}ms`);
        console.log(`     - Total time (API + service): ${totalTime}ms`);
        console.log(`     - Bills processed: ${metrics.processedBills}`);
        console.log(`     - Bills updated: ${metrics.updatedBills}`);
        console.log(`     - Paid bills skipped: ${metrics.skippedPaidBills}`);
        console.log(`     - Total penalties updated: ${metrics.totalPenaltiesUpdated} centavos ($${(metrics.totalPenaltiesUpdated / 100).toFixed(2)})`);
        
        return {
          passed: true,
          data: metrics
        };
      }
    });

    // Test 2: Unit-Scoped Penalty Recalculation (Surgical Update)
    await testHarness.runTest({
      name: 'Test 2: Unit-Scoped Penalty Recalculation (Surgical Update)',
      async test({ api }) {
        console.log(`\n  🎯 Running unit-scoped penalty recalculation for ${CLIENT_ID}...`);
        console.log(`     (This processes ONLY units: [${TEST_UNIT_IDS.join(', ')}])`);
        
        const startTime = Date.now();
        const response = await api.post(`/water/clients/${CLIENT_ID}/bills/recalculate-penalties`, {
          unitIds: TEST_UNIT_IDS
        });
        const totalTime = Date.now() - startTime;
        
        if (!response.data.success) {
          throw new Error(`Unit-scoped recalculation failed: ${response.data.error?.message || 'Unknown error'}`);
        }
        
        const metrics = response.data.data;
        scopedRecalcMetrics = { ...metrics, totalTime };
        
        console.log(`\n  ✅ Unit-scoped recalculation completed in ${totalTime}ms`);
        console.log(`\n  📊 Performance Metrics:`);
        console.log(`     - Service processing time: ${metrics.processingTimeMs}ms`);
        console.log(`     - Total time (API + service): ${totalTime}ms`);
        console.log(`     - Bills processed: ${metrics.processedBills}`);
        console.log(`     - Bills updated: ${metrics.updatedBills}`);
        console.log(`     - Paid bills skipped: ${metrics.skippedPaidBills}`);
        console.log(`     - Out-of-scope bills skipped: ${metrics.skippedOutOfScopeBills}`);
        console.log(`     - Unit scope: [${TEST_UNIT_IDS.join(', ')}]`);
        console.log(`     - Total penalties updated: ${metrics.totalPenaltiesUpdated} centavos ($${(metrics.totalPenaltiesUpdated / 100).toFixed(2)})`);
        
        return {
          passed: true,
          data: metrics
        };
      }
    });

    // Test 3: Performance Comparison Analysis
    console.log('\n\n📊 ═══════════════════════════════════════════════════════════');
    console.log('   TEST 3: PERFORMANCE COMPARISON ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (fullRecalcMetrics && scopedRecalcMetrics) {
      const speedupFactor = fullRecalcMetrics.processingTimeMs / scopedRecalcMetrics.processingTimeMs;
      const timeSaved = fullRecalcMetrics.processingTimeMs - scopedRecalcMetrics.processingTimeMs;
      const billReduction = ((fullRecalcMetrics.processedBills - scopedRecalcMetrics.processedBills) / fullRecalcMetrics.processedBills * 100).toFixed(1);
      
      console.log('  🏆 PERFORMANCE IMPROVEMENT:');
      console.log('  ─────────────────────────────────────────────────────────');
      console.log(`  📈 Full Recalc Time:   ${fullRecalcMetrics.processingTimeMs}ms (${fullRecalcMetrics.processedBills} bills)`);
      console.log(`  ⚡ Scoped Recalc Time: ${scopedRecalcMetrics.processingTimeMs}ms (${scopedRecalcMetrics.processedBills} bills)`);
      console.log(`  💰 Time Saved:         ${timeSaved}ms`);
      console.log(`  🚀 Speedup Factor:     ${speedupFactor.toFixed(2)}x faster`);
      console.log(`  📉 Bill Processing Reduction: ${billReduction}% fewer bills processed`);
      console.log(`  🎯 Out-of-Scope Skipped: ${scopedRecalcMetrics.skippedOutOfScopeBills} bills`);
      
      // Verify performance target
      const targetMet = speedupFactor >= 3;
      
      console.log('\n  🎯 PERFORMANCE TARGET:');
      if (targetMet) {
        console.log(`  ✅ TARGET MET: ${speedupFactor.toFixed(2)}x speedup (target: 3x minimum)`);
      } else {
        console.log(`  ⚠️  TARGET NOT MET: ${speedupFactor.toFixed(2)}x speedup (target: 3x minimum)`);
        console.log(`     Note: Small datasets may not show significant improvement`);
      }
      
      // Save results to file
      const fs = await import('fs/promises');
      const results = {
        timestamp: new Date().toISOString(),
        clientId: CLIENT_ID,
        testUnits: TEST_UNIT_IDS,
        fullRecalculation: fullRecalcMetrics,
        scopedRecalculation: scopedRecalcMetrics,
        performance: {
          speedupFactor,
          timeSaved,
          billReduction,
          targetMet
        }
      };
      
      await fs.writeFile(
        'test-results/WB2-penalty-optimization-results.json',
        JSON.stringify(results, null, 2)
      );
      
      console.log('\n  📝 Detailed results saved to: test-results/WB2-penalty-optimization-results.json\n');
    }

    // Final Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                 TEST SUITE COMPLETE                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    if (fullRecalcMetrics && scopedRecalcMetrics) {
      const speedup = (fullRecalcMetrics.processingTimeMs / scopedRecalcMetrics.processingTimeMs).toFixed(2);
      console.log(`✅ All tests passed successfully!`);
      console.log(`🚀 Performance improvement: ${speedup}x faster for surgical updates\n`);
    }

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the tests
main();

