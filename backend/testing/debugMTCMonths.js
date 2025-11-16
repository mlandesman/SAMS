/**
 * Debug why MTC PH3C only shows months 10-12
 */

import { getDb } from '../firebase.js';
import { getNow } from '../../shared/services/DateService.js';
import { getFiscalYear, getFiscalYearBounds } from '../utils/fiscalYearUtils.js';
import { fiscalToCalendarMonth } from '../utils/fiscalYearUtils.js';
import { createCancunDate } from '../../shared/services/DateService.js';
import { DateTime } from 'luxon';

async function debugMTCMonths() {
  const db = await getDb();
  const clientId = 'MTC';
  const unitId = 'PH3C';
  const fiscalYearStartMonth = 1;
  
  console.log(`\n🔍 Debugging MTC ${unitId} months...\n`);
  
  try {
    // Get current fiscal year
    const now = getNow();
    const currentFiscalYear = getFiscalYear(now, fiscalYearStartMonth);
    const { startDate, endDate } = getFiscalYearBounds(currentFiscalYear, fiscalYearStartMonth);
    
    console.log(`Fiscal Year: ${currentFiscalYear}`);
    console.log(`Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`Statement End Date: ${endDate.toISOString()}\n`);
    
    // Get dues document
    const duesRef = db.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(currentFiscalYear.toString());
    
    const duesDoc = await duesRef.get();
    
    if (!duesDoc.exists) {
      console.log('❌ No dues document found');
      process.exit(1);
    }
    
    const unitData = duesDoc.data();
    const scheduledAmount = unitData.scheduledAmount || 0;
    const payments = unitData.payments || [];
    
    console.log(`Scheduled Amount: ${scheduledAmount} centavos`);
    console.log(`Payments array length: ${payments.length}\n`);
    
    // Check each fiscal month
    for (let fiscalMonth = 1; fiscalMonth <= 12; fiscalMonth++) {
      const paymentIndex = fiscalMonth - 1;
      const payment = payments[paymentIndex];
      
      // Check payment status
      let isUnpaid = false;
      if (!payment || payment.paid === undefined) {
        isUnpaid = true;
      } else if (!payment.paid || payment.amount === 0) {
        isUnpaid = true;
      } else if (payment.amount < scheduledAmount) {
        isUnpaid = true;
      }
      
      // Calculate due date
      const calendarMonth = fiscalToCalendarMonth(fiscalMonth, fiscalYearStartMonth);
      const calendarYear = startDate.getFullYear();
      const dueDate = createCancunDate(calendarYear, calendarMonth, 1);
      const gracePeriodDays = 10;
      const dt = DateTime.fromJSDate(dueDate).setZone('America/Cancun');
      const dueDateWithGrace = dt.plus({ days: gracePeriodDays }).toJSDate();
      
      // Check if it would be included
      const wouldInclude = isUnpaid && dueDateWithGrace && dueDateWithGrace <= endDate;
      
      console.log(`Month ${fiscalMonth} (Calendar: ${calendarMonth}/${calendarYear}):`);
      console.log(`  Payment: ${payment ? JSON.stringify(payment) : 'undefined'}`);
      console.log(`  Is Unpaid: ${isUnpaid}`);
      console.log(`  Due Date: ${dueDateWithGrace.toISOString()}`);
      console.log(`  Due Date <= End Date: ${dueDateWithGrace <= endDate}`);
      console.log(`  Would Include: ${wouldInclude}`);
      console.log('');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

debugMTCMonths();

