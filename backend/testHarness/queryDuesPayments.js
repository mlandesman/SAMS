/**
 * Query HOA Dues Payments Test Harness
 * 
 * This script queries HOA Dues payments for a specific unit and displays payment data
 * in a simple table format using the HOA Dues API endpoints.
 * 
 * Usage: node backend/testHarness/queryDuesPayments.js <clientId> <unitId>
 * Example: node backend/testHarness/queryDuesPayments.js AVII 101
 */

import { testHarness } from '../testing/testHarness.js';
import { getFiscalYear, getFiscalYearBounds, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';
import { getNow } from '../../shared/services/DateService.js';

/**
 * Format pesos amount with commas
 * @param {number} amount - Amount in pesos
 * @returns {string} Formatted amount
 */
function formatPesos(amount) {
  if (!amount || isNaN(amount)) return '0.00';
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Query HOA Dues payments for a unit using API endpoints
 * @param {Object} api - API client from test harness
 * @param {string} clientId - Client ID (e.g., 'AVII', 'MTC')
 * @param {string} unitId - Unit ID (e.g., '101', '1A')
 */
async function queryDuesPayments(api, clientId, unitId) {
  try {
    // Step 1: Get client configuration
    console.log(`\n🔍 Fetching client configuration for ${clientId}...`);
    const clientResponse = await api.get(`/clients/${clientId}`);
    
    if (!clientResponse.data) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    const clientData = clientResponse.data;
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    const duesFrequency = clientData.feeStructure?.duesFrequency || 
                         clientData.configuration?.feeStructure?.duesFrequency ||
                         clientData.configuration?.duesFrequency ||
                         'monthly';
    
    console.log(`📅 Fiscal Year Start Month: ${fiscalYearStartMonth}`);
    console.log(`📅 Payment Frequency: ${duesFrequency}`);
    
    // Step 2: Determine current fiscal year using fiscal year utilities
    const now = getNow();
    const currentFiscalYear = getFiscalYear(now, fiscalYearStartMonth);
    const fiscalYearBounds = getFiscalYearBounds(currentFiscalYear, fiscalYearStartMonth);
    
    console.log(`📅 Current Fiscal Year: ${currentFiscalYear}`);
    console.log(`📅 Fiscal Year Period: ${fiscalYearBounds.startDate.toISOString().split('T')[0]} to ${fiscalYearBounds.endDate.toISOString().split('T')[0]}`);
    
    // Step 3: Query HOA dues for the year
    console.log(`\n🔍 Fetching HOA dues for fiscal year ${currentFiscalYear}...`);
    const duesResponse = await api.get(`/hoadues/${clientId}/year/${currentFiscalYear}`);
    
    if (!duesResponse.data || !duesResponse.data[unitId]) {
      console.log(`\n⚠️ No dues data found for unit ${unitId} in fiscal year ${currentFiscalYear}`);
      return;
    }
    
    const duesData = duesResponse.data[unitId];
    console.log(`\n✅ Found dues data for unit ${unitId}`);
    
    // Step 4: Display payments in table format
    const payments = duesData.payments || [];
    // Use Cancun timezone for today's date comparison
    const today = now;
    const todayStr = now.toISOString().split('T')[0];
    const todayTime = today.getTime();
    
    console.log(`\nQuerying HOA Dues for ${clientId} unit ${unitId}, Fiscal Year ${currentFiscalYear}`);
    console.log(`Filter: Due Date <= ${todayStr} (America/Cancun)`);
    console.log(`Total payments found: ${payments.length}`);
    console.log(`\nMonth | Paid  | Date       | Due Date  | Amount    | Transaction ID`);
    console.log(`------|-------|------------|-----------|-----------|----------------`);
    
    // Process each payment - filter by dueDate <= today
    // Create a map to ensure we show all months 1-12
    const paymentMap = new Map();
    payments.forEach(payment => {
      if (payment.month) {
        paymentMap.set(payment.month, payment);
      }
    });
    
    // Show all months 1-12, but filter by dueDate <= today
    // For quarterly billing: if quarter's due date has passed, show ALL months in that quarter
    let hasPayments = false;
    
    // Helper function to parse dueDate
    const parseDueDate = (dueDateValue) => {
      if (!dueDateValue) return null;
      if (typeof dueDateValue === 'string') {
        return new Date(dueDateValue);
      } else if (dueDateValue.toDate && typeof dueDateValue.toDate === 'function') {
        return dueDateValue.toDate();
      } else {
        return new Date(dueDateValue);
      }
    };
    
    // For quarterly billing, group months by quarter and check quarter due date
    if (duesFrequency === 'quarterly') {
      // Quarters: Q1 (months 1-3), Q2 (months 4-6), Q3 (months 7-9), Q4 (months 10-12)
      const quarters = [
        { months: [1, 2, 3], name: 'Q1' },
        { months: [4, 5, 6], name: 'Q2' },
        { months: [7, 8, 9], name: 'Q3' },
        { months: [10, 11, 12], name: 'Q4' }
      ];
      
      for (const quarter of quarters) {
        // Get the due date from any month in the quarter (they all share the same due date)
        // Check all months in case some don't have dueDate set
        let quarterDueDate = null;
        for (const monthNum of quarter.months) {
          const monthPayment = paymentMap.get(monthNum);
          if (monthPayment?.dueDate) {
            quarterDueDate = parseDueDate(monthPayment.dueDate);
            break; // Found it, use this one
          }
        }
        
        // If no dueDate found in payment data, calculate it from fiscal year
        // This handles unpaid quarters that don't have dueDate set yet
        if (!quarterDueDate) {
          // Calculate quarter due date using fiscal year utilities
          // Q1 = months 1-3 (fiscal months 0-2), Q2 = months 4-6 (fiscal months 3-5), etc.
          const fiscalMonthIndex = (quarter.months[0] - 1); // Convert to 0-based fiscal month
          const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
          const calendarYear = currentFiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
          
          // Create date for 1st of the calendar month
          quarterDueDate = new Date(calendarYear, calendarMonth, 1);
        }
        
        // Check if quarter's due date has passed
        const quarterIsDue = quarterDueDate && !isNaN(quarterDueDate.getTime()) && quarterDueDate.getTime() <= todayTime;
        
        // Show all months in this quarter if the quarter is due
        if (quarterIsDue) {
          for (const month of quarter.months) {
            const payment = paymentMap.get(month);
            hasPayments = true;
            
            const monthStr = String(month).padEnd(5);
            const paid = payment?.paid ? 'true ' : 'false';
            
            // Handle payment date
            let dateStr = '-         ';
            if (payment?.date) {
              if (typeof payment.date === 'object' && payment.date.iso) {
                dateStr = payment.date.iso.split('T')[0];
              } else if (typeof payment.date === 'string') {
                dateStr = payment.date.split('T')[0];
              } else {
                const dateObj = payment.date.toDate ? payment.date.toDate() : new Date(payment.date);
                dateStr = dateObj.toISOString().split('T')[0];
              }
            }
            
            // Handle dueDate - show the raw value
            let dueDateStr = '-         ';
            if (payment?.dueDate) {
              const dueDate = parseDueDate(payment.dueDate);
              if (dueDate && !isNaN(dueDate.getTime())) {
                dueDateStr = dueDate.toISOString().split('T')[0];
              }
            } else if (quarterDueDate) {
              // If this month doesn't have dueDate but quarter does, use quarter's due date
              dueDateStr = quarterDueDate.toISOString().split('T')[0];
            }
            
            const amount = formatPesos(payment?.amount || 0).padStart(9);
            const transactionId = (payment?.transactionId || payment?.reference || '-').substring(0, 15);
            
            console.log(`${monthStr} | ${paid} | ${dateStr} | ${dueDateStr} | ${amount} | ${transactionId}`);
          }
        }
      }
    } else {
      // Monthly billing: check each month's due date individually
      for (let month = 1; month <= 12; month++) {
        const payment = paymentMap.get(month);
        
        // Filter: Show payments where dueDate <= today
        let shouldShow = true;
        if (payment?.dueDate) {
          const dueDate = parseDueDate(payment.dueDate);
          
          // Only show if dueDate is valid and <= today
          if (!dueDate || isNaN(dueDate.getTime()) || dueDate.getTime() > todayTime) {
            shouldShow = false;
          }
        } else if (!payment?.paid) {
          // Unpaid payments without dueDate are filtered out
          shouldShow = false;
        }
        // Paid payments without dueDate still show (they've been paid)
        
        if (!shouldShow) continue;
        
        hasPayments = true;
        
        const monthStr = String(month).padEnd(5);
        const paid = payment?.paid ? 'true ' : 'false';
        
        // Handle payment date
        let dateStr = '-         ';
        if (payment?.date) {
          if (typeof payment.date === 'object' && payment.date.iso) {
            dateStr = payment.date.iso.split('T')[0];
          } else if (typeof payment.date === 'string') {
            dateStr = payment.date.split('T')[0];
          } else {
            const dateObj = payment.date.toDate ? payment.date.toDate() : new Date(payment.date);
            dateStr = dateObj.toISOString().split('T')[0];
          }
        }
        
        // Handle dueDate - show the raw value
        let dueDateStr = '-         ';
        if (payment?.dueDate) {
          const dueDate = parseDueDate(payment.dueDate);
          if (dueDate && !isNaN(dueDate.getTime())) {
            dueDateStr = dueDate.toISOString().split('T')[0];
          }
        }
        
        const amount = formatPesos(payment?.amount || 0).padStart(9);
        const transactionId = (payment?.transactionId || payment?.reference || '-').substring(0, 15);
        
        console.log(`${monthStr} | ${paid} | ${dateStr} | ${dueDateStr} | ${amount} | ${transactionId}`);
      }
    }
    
    if (!hasPayments) {
      console.log(`No payments found with due date <= today`);
    }
    
    // Summary
    const totalDue = duesData.totalDue || 0;
    const totalPaid = duesData.totalPaid || 0;
    const totalOutstanding = duesData.totalOutstanding || 0;
    
    console.log(`\n📊 Summary:`);
    console.log(`Total Due: $${formatPesos(totalDue)} MXN`);
    console.log(`Total Paid: $${formatPesos(totalPaid)} MXN`);
    console.log(`Outstanding: $${formatPesos(totalOutstanding)} MXN`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('Usage: node backend/testHarness/queryDuesPayments.js <clientId> <unitId>');
    console.log('Example: node backend/testHarness/queryDuesPayments.js AVII 101');
    process.exit(1);
  }
  
  const [clientId, unitId] = args;
  
  // Run the test using the test harness
  await testHarness.runTest({
    name: `Query HOA Dues Payments for ${clientId} unit ${unitId}`,
    async test({ api }) {
      console.log(`🏢 Client: ${clientId}`);
      console.log(`🏠 Unit: ${unitId}`);
      
      await queryDuesPayments(api, clientId, unitId);
      
      return { 
        passed: true,
        message: 'Query completed successfully'
      };
    }
  });
  
  // Show summary
  testHarness.showSummary();
  
  // Clean exit
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});