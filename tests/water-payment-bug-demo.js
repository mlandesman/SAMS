/**
 * WATER BILLS BUG DEMONSTRATION
 * 
 * This script demonstrates the exact bug causing preview vs payment discrepancies
 * 
 * THE BUG:
 * - Frontend calls preview API with selectedMonth → filters to July only
 * - Frontend calls record API without selectedMonth → processes ALL bills
 * - Backend recordPayment() doesn't pass selectedMonth → processes ALL bills
 * 
 * RESULT:
 * - User sees: "This will pay July bill: $950"
 * - System does: Pays July + August bills: $1900 (with insufficient funds)
 * - UI shows: Paid/Unpaid status out of sync
 */

import { config } from 'dotenv';
import { waterPaymentsService } from '../backend/services/waterPaymentsService.js';
import { getDb } from '../backend/firebase.js';
import { centavosToPesos } from '../backend/utils/currencyUtils.js';

config();

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function demonstrateBug() {
  console.log(`\n${BOLD}${RED}🐛 WATER BILLS BUG DEMONSTRATION${RESET}`);
  console.log('='.repeat(80));
  
  const clientId = 'AVII';
  const unitId = '101';
  const paymentAmount = 950.00;  // Enough for ONE bill
  const currentCredit = 0;
  const paymentDate = '2025-10-19';
  
  try {
    // Create test scenario: TWO unpaid bills
    console.log(`\n${CYAN}📋 SCENARIO SETUP:${RESET}`);
    console.log(`  Unit ${unitId} has TWO unpaid bills:`);
    console.log(`    - July (2026-00): $950 + penalties`);
    console.log(`    - August (2026-01): $950 + penalties`);
    console.log(`  User wants to pay ${BOLD}JULY ONLY${RESET}`);
    console.log(`  Payment amount: $${paymentAmount}`);
    
    // Get actual bill data
    const db = await getDb();
    const billsSnapshot = await db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills')
      .where('__name__', '>=', '2026-00')
      .where('__name__', '<=', '2026-01')
      .get();
    
    const bills = [];
    billsSnapshot.forEach(doc => {
      const data = doc.data();
      const unitBill = data?.bills?.units?.[unitId];
      if (unitBill && unitBill.status !== 'paid') {
        bills.push({
          period: doc.id,
          totalAmount: centavosToPesos(unitBill.totalAmount || 0),
          status: unitBill.status
        });
      }
    });
    
    console.log(`\n  ${YELLOW}Actual unpaid bills found: ${bills.length}${RESET}`);
    bills.forEach(b => {
      console.log(`    - ${b.period}: $${b.totalAmount} (${b.status})`);
    });
    
    // STEP 1: User opens payment modal - frontend calls preview with selectedMonth
    console.log(`\n\n${BOLD}${GREEN}STEP 1: USER OPENS PAYMENT MODAL${RESET}`);
    console.log('-'.repeat(80));
    console.log(`${CYAN}Frontend calls:${RESET} waterAPI.previewPayment(clientId, {`);
    console.log(`  unitId: '${unitId}',`);
    console.log(`  amount: ${paymentAmount},`);
    console.log(`  payOnDate: '${paymentDate}',`);
    console.log(`  ${BOLD}selectedMonth: 0${RESET}  ${GREEN}← FILTERS TO JULY ONLY${RESET}`);
    console.log(`})`);
    
    const previewResult = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      paymentAmount,
      currentCredit,
      paymentDate,
      0  // selectedMonth = 0 (July only)
    );
    
    console.log(`\n${BLUE}Preview Result:${RESET}`);
    console.log(`  Bills to process: ${BOLD}${previewResult.billPayments.length}${RESET}`);
    console.log(`  Total due: $${previewResult.totalBillsDue}`);
    previewResult.billPayments.forEach(bill => {
      console.log(`    - ${bill.billPeriod}: $${bill.amountPaid} (will be ${bill.newStatus})`);
    });
    
    console.log(`\n${GREEN}✓ User sees: "This will pay July bill completely"${RESET}`);
    
    // STEP 2: User clicks "Record Payment" - frontend sends without selectedMonth
    console.log(`\n\n${BOLD}${YELLOW}STEP 2: USER CLICKS "RECORD PAYMENT"${RESET}`);
    console.log('-'.repeat(80));
    console.log(`${CYAN}Frontend calls:${RESET} waterAPI.recordPayment(clientId, {`);
    console.log(`  unitId: '${unitId}',`);
    console.log(`  amount: ${paymentAmount},`);
    console.log(`  paymentDate: '${paymentDate}',`);
    console.log(`  ${RED}// selectedMonth NOT SENT!${RESET}`);
    console.log(`})`);
    
    console.log(`\n${CYAN}Backend recordPayment() calls:${RESET}`);
    console.log(`  calculatePaymentDistribution(clientId, unitId, amount, credit, paymentDate)`);
    console.log(`  ${RED}// selectedMonth parameter MISSING!${RESET}`);
    
    // Simulate what recordPayment does (without selectedMonth)
    const actualResult = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      paymentAmount,
      currentCredit,
      paymentDate,
      undefined  // selectedMonth NOT PASSED - this is the bug!
    );
    
    console.log(`\n${BLUE}Actual Payment Calculation:${RESET}`);
    console.log(`  Bills to process: ${BOLD}${actualResult.billPayments.length}${RESET}`);
    console.log(`  Total due: $${actualResult.totalBillsDue}`);
    actualResult.billPayments.forEach(bill => {
      console.log(`    - ${bill.billPeriod}: $${bill.amountPaid} (status: ${bill.newStatus})`);
    });
    
    console.log(`\n${RED}✗ System does: Tries to pay ${actualResult.billPayments.length} bills with insufficient funds${RESET}`);
    
    // STEP 3: Show the discrepancy
    console.log(`\n\n${BOLD}${RED}STEP 3: THE DISCREPANCY${RESET}`);
    console.log('='.repeat(80));
    
    const previewBills = previewResult.billPayments.length;
    const actualBills = actualResult.billPayments.length;
    const billsMismatch = previewBills !== actualBills;
    
    console.log(`\n${BOLD}PREVIEW vs ACTUAL:${RESET}`);
    console.log(`  Bills processed: ${previewBills} vs ${actualBills} ${billsMismatch ? RED + '✗ MISMATCH' + RESET : GREEN + '✓ MATCH' + RESET}`);
    console.log(`  Total base charges: $${previewResult.totalBaseCharges} vs $${actualResult.totalBaseCharges} ${previewResult.totalBaseCharges !== actualResult.totalBaseCharges ? RED + '✗ MISMATCH' + RESET : GREEN + '✓ MATCH' + RESET}`);
    console.log(`  Total penalties: $${previewResult.totalPenalties} vs $${actualResult.totalPenalties} ${previewResult.totalPenalties !== actualResult.totalPenalties ? RED + '✗ MISMATCH' + RESET : GREEN + '✓ MATCH' + RESET}`);
    
    if (billsMismatch) {
      console.log(`\n${RED}${BOLD}🚨 THIS IS THE BUG!${RESET}`);
      console.log(`\n${YELLOW}WHAT USER EXPECTED:${RESET}`);
      console.log(`  - Pay July bill: $${paymentAmount}`);
      console.log(`  - Bill status: PAID`);
      console.log(`  - Table shows: PAID (green)`);
      
      console.log(`\n${RED}WHAT ACTUALLY HAPPENED:${RESET}`);
      console.log(`  - System tried to pay ${actualBills} bills with $${paymentAmount}`);
      console.log(`  - Bills partially paid or unpaid`);
      console.log(`  - Table shows wrong status`);
      console.log(`  - User confused: "I paid it but it shows unpaid!"`);
    }
    
    // STEP 4: Show the fix
    console.log(`\n\n${BOLD}${GREEN}STEP 4: THE FIX${RESET}`);
    console.log('='.repeat(80));
    
    console.log(`\n${CYAN}1. Frontend (WaterPaymentModal.jsx line ~315):${RESET}`);
    console.log(`   ${RED}// CURRENT:${RESET}`);
    console.log(`   await waterAPI.recordPayment(selectedClient.id, {`);
    console.log(`     unitId, amount, paymentDate, ...`);
    console.log(`   });`);
    console.log(`\n   ${GREEN}// FIXED:${RESET}`);
    console.log(`   await waterAPI.recordPayment(selectedClient.id, {`);
    console.log(`     unitId, amount, paymentDate,`);
    console.log(`     ${BOLD}selectedMonth: selectedMonth,${RESET}  ${GREEN}← ADD THIS${RESET}`);
    console.log(`     ...`);
    console.log(`   });`);
    
    console.log(`\n${CYAN}2. Backend Route (waterRoutes.js line ~403):${RESET}`);
    console.log(`   Extract selectedMonth from req.body and pass to controller`);
    
    console.log(`\n${CYAN}3. Backend Service (waterPaymentsService.js line ~536):${RESET}`);
    console.log(`   ${RED}// CURRENT:${RESET}`);
    console.log(`   const distribution = await this.calculatePaymentDistribution(`);
    console.log(`     clientId, unitId, amount, currentCreditBalance, paymentDate`);
    console.log(`   );`);
    console.log(`\n   ${GREEN}// FIXED:${RESET}`);
    console.log(`   const distribution = await this.calculatePaymentDistribution(`);
    console.log(`     clientId, unitId, amount, currentCreditBalance, paymentDate,`);
    console.log(`     ${BOLD}selectedMonth${RESET}  ${GREEN}← ADD THIS${RESET}`);
    console.log(`   );`);
    
    console.log(`\n${GREEN}${BOLD}✓ With this fix, preview and payment will be identical!${RESET}\n`);
    
  } catch (error) {
    console.error(`\n${RED}Error running demonstration:${RESET}`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

demonstrateBug();

