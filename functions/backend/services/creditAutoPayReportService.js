/**
 * Credit Auto-Pay Report Service
 * Generates HTML email report of units that would have bills auto-paid from credit
 * TASK-90 Phase 2
 */

import { unifiedPaymentWrapper } from './unifiedPaymentWrapper.js';
import { getDb } from '../firebase.js';
import { getNow } from '../services/DateService.js';
import { getCreditBalance } from '../../shared/services/CreditBalanceService.js';
import { DateTime } from 'luxon';

/**
 * Generate credit auto-pay report data for all clients
 * @param {string|null} filterClientId - Optional client ID to filter (e.g., 'MTC', 'AVII')
 * @returns {Promise<Object>} Report data structure
 */
export async function generateCreditAutoPayReportData(filterClientId = null) {
  const db = await getDb();
  const today = getNow().toISOString();
  const clientIds = filterClientId ? [filterClientId] : ['MTC', 'AVII'];
  
  console.log(`📊 Generating credit auto-pay report for: ${clientIds.join(', ')}`);
  
  const nowCancun = DateTime.now().setZone('America/Cancun');
  
  const report = {
    date: nowCancun.toFormat('dd-MMM-yy'),
    dateISO: today,
    clients: [],
    totals: {
      totalCredit: 0,
      totalWouldPay: 0,
      totalPenalties: 0,
      hoaBillCount: 0,
      waterBillCount: 0,
      unitCount: 0,
      fullPaymentCount: 0,
      partialPaymentCount: 0
    }
  };
  
  for (const clientId of clientIds) {
    console.log(`\n📋 Processing client: ${clientId}`);
    
    // Get client info
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      console.warn(`⚠️ Client ${clientId} not found, skipping`);
      continue;
    }
    
    const clientData = clientDoc.data();
    
    // Get grace period configuration from hoaDues and waterBills configs
    const hoaDuesConfigDoc = await db.collection('clients').doc(clientId)
      .collection('config').doc('hoaDues').get();
    const hoaGraceDays = hoaDuesConfigDoc.exists ? (hoaDuesConfigDoc.data().penaltyDays || 10) : 10;
    
    const waterConfigDoc = await db.collection('clients').doc(clientId)
      .collection('config').doc('waterBills').get();
    const waterGraceDays = waterConfigDoc.exists ? (waterConfigDoc.data().penaltyDays || 10) : 10;
    
    console.log(`   Grace periods: HOA ${hoaGraceDays} days, Water ${waterGraceDays} days`);
    
    const clientReport = {
      clientId,
      clientName: clientData.basicInfo?.displayName || clientId,
      hoaGraceDays,
      waterGraceDays,
      units: []
    };
    
    // Get all units for this client
    const unitsSnap = await db.collection('clients').doc(clientId)
      .collection('units').get();
    
    console.log(`   Found ${unitsSnap.size} units`);
    
    for (const unitDoc of unitsSnap.docs) {
      const unitId = unitDoc.id;
      
      // Skip system documents (creditBalances and yearly archives)
      if (unitId.startsWith('creditBalances')) continue;
      
      // Get credit balance using proper API
      const creditData = await getCreditBalance(clientId, unitId);
      const creditPesos = creditData.creditBalance || 0;
      
      if (creditPesos <= 0) continue;
      
      console.log(`   Unit ${unitId}: $${creditPesos.toFixed(2)} credit`);
      
      // Preview what would be paid
      const preview = await unifiedPaymentWrapper.previewUnifiedPayment(
        clientId,
        unitId,
        creditPesos,
        today
      );
      
      // Only include units that would actually pay something
      if (!preview.summary || preview.summary.totalAllocated <= 0) {
        console.log(`      No bills would be paid, skipping`);
        continue;
      }
      
      console.log(`      Would pay: $${preview.summary.totalAllocated.toFixed(2)}`);
      
      // Build unit report
      const unitReport = {
        unitId,
        creditBalance: creditPesos,
        wouldPay: preview.summary.totalAllocated,
        isPartial: creditPesos < preview.summary.totalAllocated,
        hoaBills: [],
        waterBills: [],
        hoaPenalties: 0,
        waterPenalties: 0
      };
      
      // Process HOA bills
      if (preview.hoa?.monthsAffected) {
        for (const month of preview.hoa.monthsAffected) {
          // Calculate auto-pay date: due date + grace period
          const dueDate = new Date(month.dueDate);
          const autoPayDate = new Date(dueDate);
          autoPayDate.setDate(autoPayDate.getDate() + clientReport.hoaGraceDays);
          
          const billData = {
            period: month.billPeriod || `Q${(month.quarterIndex || 0) + 1}`,
            dueDate: month.dueDate,
            autoPayDate: autoPayDate.toISOString(),  // When auto-pay will actually trigger
            graceDays: clientReport.hoaGraceDays,
            amountDue: (month.baseDue || 0) + (month.penaltyDue || 0),
            wouldPay: (month.basePaid || 0) + (month.penaltyPaid || 0),
            penaltyPaid: month.penaltyPaid || 0
          };
          
          unitReport.hoaBills.push(billData);
          unitReport.hoaPenalties += billData.penaltyPaid;
          report.totals.hoaBillCount++;
        }
      }
      
      // Process Water bills
      if (preview.water?.billsAffected) {
        for (const bill of preview.water.billsAffected) {
          // Calculate auto-pay date: due date + grace period
          const dueDate = new Date(bill.dueDate);
          const autoPayDate = new Date(dueDate);
          autoPayDate.setDate(autoPayDate.getDate() + clientReport.waterGraceDays);
          
          const billData = {
            period: bill.billPeriod || 'Unknown',
            dueDate: bill.dueDate,
            autoPayDate: autoPayDate.toISOString(),  // When auto-pay will actually trigger
            graceDays: clientReport.waterGraceDays,
            amountDue: bill.totalDue || 0,
            wouldPay: bill.totalPaid || 0,
            penaltyPaid: bill.penaltyPaid || 0
          };
          
          unitReport.waterBills.push(billData);
          unitReport.waterPenalties += billData.penaltyPaid;
          report.totals.waterBillCount++;
        }
      }
      
      // Add to client report
      clientReport.units.push(unitReport);
      
      // Update totals
      report.totals.unitCount++;
      report.totals.totalCredit += creditPesos;
      report.totals.totalWouldPay += preview.summary.totalAllocated;
      report.totals.totalPenalties += unitReport.hoaPenalties + unitReport.waterPenalties;
      
      if (unitReport.isPartial) {
        report.totals.partialPaymentCount++;
      } else {
        report.totals.fullPaymentCount++;
      }
    }
    
    // Only add client if it has units with payable bills
    if (clientReport.units.length > 0) {
      report.clients.push(clientReport);
      console.log(`   ✅ ${clientReport.units.length} units with payable bills`);
    } else {
      console.log(`   ℹ️ No units with payable bills`);
    }
  }
  
  console.log(`\n✅ Report generated: ${report.totals.unitCount} units, $${report.totals.totalWouldPay.toFixed(2)} would be paid`);
  
  return report;
}

/**
 * Generate HTML email from report data
 * @param {Object} report - Report data from generateCreditAutoPayReportData
 * @returns {string} HTML email content
 */
export function generateCreditAutoPayEmailHTML(report) {
  // Helper to format currency
  const fmt = (amount) => `$${amount.toFixed(2)}`;
  
  // Helper to format date as dd-MMM-yy (unambiguous for international clients)
  const fmtDate = (dateStr) => {
    if (!dateStr) return '-';
    const dt = DateTime.fromISO(dateStr, { zone: 'America/Cancun' });
    return dt.isValid ? dt.toFormat('dd-MMM-yy') : '-';
  };
  
  // Build client sections
  let clientSections = '';
  
  for (const client of report.clients) {
    let rows = '';
    
    for (const unit of client.units) {
      const totalPenalties = unit.hoaPenalties + unit.waterPenalties;
      const paymentType = unit.isPartial ? 
        '<span style="color: #ff6b6b; font-weight: bold;">⚠️ PARTIAL</span>' : 
        '<span style="color: #51cf66;">FULL</span>';
      
      // Combine all bills to show per-line with auto-pay dates
      const allBills = [
        ...unit.hoaBills.map(b => ({ ...b, type: 'HOA' })),
        ...unit.waterBills.map(b => ({ ...b, type: 'Water' }))
      ].sort((a, b) => new Date(a.autoPayDate) - new Date(b.autoPayDate)); // Sort by auto-pay date
      
      // Create one row per bill (not per unit)
      for (const bill of allBills) {
        const isFirstBill = allBills.indexOf(bill) === 0;
        const rowspan = allBills.length;
        
        rows += `
          <tr>
            ${isFirstBill ? `<td style="padding: 8px; border: 1px solid #ddd;" rowspan="${rowspan}">${unit.unitId}</td>` : ''}
            ${isFirstBill ? `<td style="padding: 8px; border: 1px solid #ddd; text-align: right;" rowspan="${rowspan}">${fmt(unit.creditBalance)}</td>` : ''}
            ${isFirstBill ? `<td style="padding: 8px; border: 1px solid #ddd; text-align: right;" rowspan="${rowspan}">${fmt(unit.wouldPay)}</td>` : ''}
            ${isFirstBill ? `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;" rowspan="${rowspan}">${paymentType}</td>` : ''}
            <td style="padding: 8px; border: 1px solid #ddd;">${bill.type}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${bill.period}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${fmt(bill.amountDue)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${fmt(bill.wouldPay)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; background-color: #fff3cd;"><strong>${fmtDate(bill.autoPayDate)}</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${bill.penaltyPaid > 0 ? fmt(bill.penaltyPaid) : '-'}</td>
          </tr>
        `;
      }
    }
    
    clientSections += `
      <h2 style="color: #2c3e50; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
        ${client.clientName}
      </h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <thead>
          <tr style="background-color: #3498db; color: white;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Unit</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Credit</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Total Pay</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Type</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Bill Type</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Period</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Amount Due</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Would Pay</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center; background-color: #ffc107;">Auto-Pay Date</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Penalty</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }
  
  // Build summary section
  const summaryHTML = `
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-top: 30px;">
      <h2 style="color: #2c3e50; margin-top: 0;">Summary</h2>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0;"><strong>Total Units:</strong></td>
          <td style="text-align: right;">${report.totals.unitCount}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;"><strong>Full Payments:</strong></td>
          <td style="text-align: right;">${report.totals.fullPaymentCount}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;"><strong>Partial Payments:</strong></td>
          <td style="text-align: right;">${report.totals.partialPaymentCount}</td>
        </tr>
        <tr style="border-top: 1px solid #dee2e6;">
          <td style="padding: 5px 0; padding-top: 10px;"><strong>Total Credit Available:</strong></td>
          <td style="text-align: right; padding-top: 10px;">${fmt(report.totals.totalCredit)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;"><strong>Total Would Be Paid:</strong></td>
          <td style="text-align: right;">${fmt(report.totals.totalWouldPay)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;"><strong>Total Penalties:</strong></td>
          <td style="text-align: right;">${fmt(report.totals.totalPenalties)}</td>
        </tr>
        <tr style="border-top: 1px solid #dee2e6;">
          <td style="padding: 5px 0; padding-top: 10px;"><strong>HOA Bills:</strong></td>
          <td style="text-align: right; padding-top: 10px;">${report.totals.hoaBillCount}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;"><strong>Water Bills:</strong></td>
          <td style="text-align: right;">${report.totals.waterBillCount}</td>
        </tr>
      </table>
    </div>
  `;
  
  // Complete HTML email
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credit Auto-Pay Report</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
  <div style="max-width: 800px; margin: 20px auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #3498db;">
      <h1 style="color: #2c3e50; margin: 0 0 10px 0;">Credit Auto-Pay Report</h1>
      <p style="color: #7f8c8d; margin: 0; font-size: 16px;">${report.date}</p>
    </div>
    
    <!-- Introduction -->
    <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 25px; border-left: 4px solid #2196f3;">
      <p style="margin: 0; font-size: 14px;">
        <strong>Report Summary:</strong> This report shows units with credit balances that could be used to auto-pay outstanding bills.
        ${report.totals.unitCount > 0 ? 
          `There ${report.totals.unitCount === 1 ? 'is' : 'are'} currently <strong>${report.totals.unitCount} unit${report.totals.unitCount === 1 ? '' : 's'}</strong> with credit that could pay <strong>${fmt(report.totals.totalWouldPay)}</strong> in bills.` :
          'There are currently no units with credit balances that could auto-pay bills.'
        }
      </p>
    </div>
    
    ${report.totals.unitCount > 0 ? `
    <!-- Client Sections -->
    ${clientSections}
    
    <!-- Summary -->
    ${summaryHTML}
    
    <!-- Notes -->
    <div style="margin-top: 30px; padding: 15px; background-color: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
      <p style="margin: 0 0 10px 0; font-size: 13px;"><strong>Important Notes:</strong></p>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
        <li><strong>Auto-Pay Date</strong> is when payment will be automatically taken from credit (Due Date + Grace Period)</li>
        <li><strong>PARTIAL</strong> payments indicate the credit balance is insufficient to fully pay all bills</li>
        <li>Bills are paid according to priority: Past due bills first, then current HOA, then current Water</li>
        <li>Penalties are included in the payment amounts when applicable</li>
        <li>This is a preview report - no payments have been recorded</li>
      </ul>
    </div>
    ` : `
    <div style="text-align: center; padding: 40px 20px; color: #7f8c8d;">
      <p style="font-size: 16px; margin: 0;">✓ No units currently have credit balances that could auto-pay bills.</p>
    </div>
    `}
    
    <!-- Footer -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #7f8c8d; font-size: 12px;">
      <p style="margin: 0;">Sandyland Asset Management System</p>
      <p style="margin: 5px 0 0 0;">This is an automated report. Generated on ${report.date}</p>
    </div>
    
  </div>
</body>
</html>`;
  
  return html;
}

/**
 * Get email recipients for credit auto-pay report
 * @param {string} clientId - Client ID
 * @returns {Promise<Array<string>>} Array of email addresses
 */
export async function getCreditAutoPayEmailRecipients(clientId) {
  const db = await getDb();
  
  // Get client document
  const clientDoc = await db.collection('clients').doc(clientId).get();
  
  if (!clientDoc.exists) {
    console.warn(`⚠️ Client ${clientId} not found`);
    return [];
  }
  
  const clientData = clientDoc.data();
  const recipients = [];
  
  // Get management company email
  const managementEmail = clientData.managementCompany?.email;
  
  if (managementEmail) {
    // DEVELOPMENT OVERRIDE: Comment out production email, use dev email
    // recipients.push(managementEmail);
    recipients.push('michael@landesman.com');
    console.log(`📧 Email recipient (dev override): michael@landesman.com`);
    console.log(`   (Production would use: ${managementEmail})`);
  } else {
    console.warn(`⚠️ No managementCompany.email found for ${clientId}, using fallback`);
    recipients.push('michael@landesman.com');
  }
  
  return recipients;
}
