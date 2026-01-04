/**
 * Credit Auto-Pay Report Script
 * Shows units with credit that could auto-pay bills
 * 
 * Usage: node creditAutoPayReport.js [clientId]
 */

import { unifiedPaymentWrapper } from '../services/unifiedPaymentWrapper.js';
import { getDb } from '../firebase.js';
import { getNow } from '../services/DateService.js';
import { getCreditBalance } from '../../shared/services/CreditBalanceService.js';

async function generateReport(filterClientId = null) {
  const db = await getDb();
  const today = getNow().toISOString();
  const reportDate = getNow().toLocaleString('en-US', { 
    timeZone: 'America/Cancun',
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  });
  
  // Collect report data
  const reportData = [];
  
  // Get clients
  const clientIds = filterClientId ? [filterClientId] : ['MTC', 'AVII'];
  
  for (const clientId of clientIds) {
    // Get all units
    const unitsSnap = await db.collection('clients').doc(clientId)
      .collection('units').get();
    
    for (const unitDoc of unitsSnap.docs) {
      const unitId = unitDoc.id;
      
      // Skip system documents
      if (unitId === 'creditBalances') continue;
      
      try {
        // Get credit balance using proper getter function
        const creditData = await getCreditBalance(clientId, unitId);
        const creditPesos = creditData.creditBalance || 0;  // Already in pesos
        
        if (creditPesos > 0) {
          // Call UPS preview with credit balance
          const preview = await unifiedPaymentWrapper.previewUnifiedPayment(
            clientId,
            unitId,
            creditPesos,
            today
          );
          
          // If bills would be paid, collect data
          if (preview.summary?.totalAllocated > 0) {
            // Determine if this is a partial payment
            const isPartialPayment = creditPesos < preview.summary.totalAllocated;
            const shortfall = isPartialPayment ? preview.summary.totalAllocated - creditPesos : 0;
            const remaining = isPartialPayment ? 0 : creditPesos - preview.summary.totalAllocated;
            
            // Calculate bill details
            const hoaBills = preview.hoa?.billsPaid?.length || 0;
            const hoaTotal = preview.hoa?.billsPaid?.reduce((sum, b) => sum + (b.amountPaid || 0), 0) || 0;
            const hoaPenalties = preview.hoa?.billsPaid?.reduce((sum, b) => sum + (b.penaltyPaid || 0), 0) || 0;
            
            const waterBills = preview.water?.billsPaid?.length || 0;
            const waterTotal = preview.water?.billsPaid?.reduce((sum, b) => sum + (b.amountPaid || 0), 0) || 0;
            const waterPenalties = preview.water?.billsPaid?.reduce((sum, b) => sum + (b.penaltyPaid || 0), 0) || 0;
            
            reportData.push({
              clientId,
              unitId,
              creditBalance: creditPesos,
              wouldPay: preview.summary.totalAllocated,
              isPartial: isPartialPayment,
              shortfall,
              remaining,
              hoaBills,
              hoaTotal,
              hoaPenalties,
              waterBills,
              waterTotal,
              waterPenalties
            });
          }
        }
      } catch (error) {
        console.error(`  ❌ Error processing ${clientId}/${unitId}:`, error.message);
      }
    }
  }
  
  // Display report
  displayReport(reportData, reportDate);
}

function displayReport(data, reportDate) {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     CREDIT AUTO-PAY OPPORTUNITY REPORT                         ║');
  console.log(`║                            ${reportDate.padEnd(44)}║`);
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
  
  if (data.length === 0) {
    console.log('No units with credit balances that can pay bills.\n');
    return;
  }
  
  // Group by client
  const mtcData = data.filter(d => d.clientId === 'MTC');
  const aviiData = data.filter(d => d.clientId === 'AVII');
  
  if (mtcData.length > 0) {
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('  MTC - MARINA TURQUESA CONDOMINIUMS');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    displayClientTable(mtcData);
  }
  
  if (aviiData.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('  AVII - AVENTURAS VILLAS II');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    displayClientTable(aviiData);
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  const totalUnits = data.length;
  const fullPayments = data.filter(d => !d.isPartial).length;
  const partialPayments = data.filter(d => d.isPartial).length;
  const totalCredit = data.reduce((sum, d) => sum + d.creditBalance, 0);
  const totalWouldPay = data.reduce((sum, d) => sum + d.wouldPay, 0);
  const totalPenalties = data.reduce((sum, d) => sum + d.hoaPenalties + d.waterPenalties, 0);
  
  console.log(`  Total Units:           ${totalUnits}`);
  console.log(`  Full Payments:         ${fullPayments}`);
  console.log(`  Partial Payments:      ${partialPayments}`);
  console.log(`  Total Credit:          $${totalCredit.toFixed(2)}`);
  console.log(`  Total Would Pay:       $${totalWouldPay.toFixed(2)}`);
  console.log(`  Total Penalties:       $${totalPenalties.toFixed(2)}`);
  console.log('');
}

function displayClientTable(data) {
  // Table header
  console.log('┌──────────┬────────────┬────────────┬─────────┬──────────────┬──────────────┬──────────┐');
  console.log('│   Unit   │   Credit   │  Would Pay │  Type   │  HOA Bills   │ Water Bills  │ Penalties│');
  console.log('├──────────┼────────────┼────────────┼─────────┼──────────────┼──────────────┼──────────┤');
  
  // Table rows
  for (const row of data) {
    const unit = row.unitId.padEnd(8);
    const credit = `$${row.creditBalance.toFixed(2)}`.padStart(10);
    const wouldPay = `$${row.wouldPay.toFixed(2)}`.padStart(10);
    const type = (row.isPartial ? 'PARTIAL' : 'FULL').padEnd(7);
    
    const hoaInfo = row.hoaBills > 0 
      ? `${row.hoaBills}x $${row.hoaTotal.toFixed(2)}`.padStart(12)
      : '-'.padStart(12);
    
    const waterInfo = row.waterBills > 0
      ? `${row.waterBills}x $${row.waterTotal.toFixed(2)}`.padStart(12)
      : '-'.padStart(12);
    
    const penalties = row.hoaPenalties + row.waterPenalties;
    const penaltyStr = penalties > 0 
      ? `$${penalties.toFixed(2)}`.padStart(8)
      : '-'.padStart(8);
    
    console.log(`│ ${unit} │ ${credit} │ ${wouldPay} │ ${type} │ ${hoaInfo} │ ${waterInfo} │ ${penaltyStr} │`);
  }
  
  console.log('└──────────┴────────────┴────────────┴─────────┴──────────────┴──────────────┴──────────┘');
}

// Run
const clientArg = process.argv[2];
generateReport(clientArg)
  .then(() => {
    console.log('\n✅ Report complete');
    process.exit(0);
  })
  .catch(err => { 
    console.error('❌ Report failed:', err); 
    process.exit(1); 
  });
