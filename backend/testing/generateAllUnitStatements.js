/**
 * Generate unformatted statements for all units in AVII and MTC clients
 * Outputs to markdown file for review
 */

import { testHarness } from './testHarness.js';
import { testConfig } from './config.js';
import { getDb } from '../firebase.js';
import { getNow } from '../services/DateService.js';
import { getFiscalYear, getFiscalYearBounds } from '../utils/fiscalYearUtils.js';

async function getAllUnits(clientId) {
  const db = await getDb();
  const unitsSnapshot = await db.collection('clients').doc(clientId)
    .collection('units').get();
  
  const units = [];
  unitsSnapshot.forEach(doc => {
    const data = doc.data();
    units.push({
      unitId: doc.id,
      unitNumber: data.unitNumber || doc.id,
      ownerName: data.owners?.[0] || 'N/A'
    });
  });
  
  return units.sort((a, b) => {
    // Sort by unit number (handle numeric and alphanumeric)
    return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true, sensitivity: 'base' });
  });
}

async function getClientFiscalYearConfig(clientId) {
  const db = await getDb();
  const clientDoc = await db.collection('clients').doc(clientId).get();
  if (!clientDoc.exists) {
    return { fiscalYearStartMonth: 1 };
  }
  const clientData = clientDoc.data();
  return {
    fiscalYearStartMonth: clientData.configuration?.fiscalYearStartMonth || 1
  };
}

async function generateStatementForUnit(clientId, unitId, unitNumber, ownerName, userId) {
  try {
    // Get fiscal year config
    const fiscalConfig = await getClientFiscalYearConfig(clientId);
    const fiscalYearStartMonth = fiscalConfig.fiscalYearStartMonth;
    
    // Get current fiscal year bounds (only current fiscal year, not previous)
    const currentDate = getNow();
    const currentFiscalYear = getFiscalYear(currentDate, fiscalYearStartMonth);
    const { startDate, endDate } = getFiscalYearBounds(currentFiscalYear, fiscalYearStartMonth);
    
    // Use date range for current fiscal year only
    const dateRange = {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    };
    
    // Use testHarness to make API call
    let apiResponse;
    await testHarness.runTest({
      name: `Statement for ${clientId}/${unitId}`,
      async test({ api }) {
        apiResponse = await api.post(
          `/clients/${clientId}/reports/statement/generate`,
          {
            unitId: unitId,
            userId: userId,
            dateRange: dateRange
          }
        );
        return { passed: apiResponse.status === 200, data: apiResponse };
      }
    });
    
    if (!apiResponse || apiResponse.status !== 200 || !apiResponse.data.success) {
      throw new Error(`API call failed: ${apiResponse?.status || 'no response'}`);
    }
    
    return {
      success: true,
      data: apiResponse.data.data,
      unitNumber,
      ownerName
    };
  } catch (error) {
    console.error(`Error generating statement for ${clientId}/${unitId}:`, error.message);
    return {
      success: false,
      error: error.message,
      unitNumber,
      ownerName
    };
  }
}

function formatTransactionRow(tx, index) {
  const dateStr = tx.date instanceof Date 
    ? tx.date.toISOString().split('T')[0] 
    : new Date(tx.date).toISOString().split('T')[0];
  
  return `| ${index} | ${dateStr} | ${tx.category || 'N/A'} | ${tx.description || ''} | ${tx.invoiceReceipt || 'N/A'} | ${tx.transactionId || ''} | ${tx.method || ''} | ${tx.amount.toFixed(2)} | ${tx.penalty.toFixed(2)} | ${tx.payments.toFixed(2)} | ${tx.balance.toFixed(2)} | ${tx.notes || ''} | ${tx.consumption !== null && tx.consumption !== undefined ? tx.consumption : 'N/A'} |`;
}

function formatStatementMarkdown(clientId, unitStatements) {
  let markdown = `# Statement of Account - All Units\n\n`;
  markdown += `**Client**: ${clientId}\n`;
  markdown += `**Generated**: ${getNow().toISOString()}\n\n`;
  markdown += `---\n\n`;
  
  for (const statement of unitStatements) {
    if (!statement.success) {
      markdown += `\n\n----[ ${clientId} ${statement.unitNumber} ]--------\n\n`;
      markdown += `## Unit ${statement.unitNumber} - ${statement.ownerName}\n\n`;
      markdown += `**ERROR**: ${statement.error}\n\n`;
      markdown += `---\n\n`;
      continue;
    }
    
    const { data, unitNumber, ownerName } = statement;
    
    markdown += `\n\n----[ ${clientId} ${unitNumber} ]--------\n\n`;
    markdown += `## Unit ${unitNumber} - ${ownerName}\n\n`;
    markdown += `**Statement Period**: ${new Date(data.statementPeriod.start).toISOString().split('T')[0]} to ${new Date(data.statementPeriod.end).toISOString().split('T')[0]}\n\n`;
    
    // Combine all transactions
    const allTransactions = [
      ...(data.hoaDues.transactions || []),
      ...(data.waterBills.transactions || [])
    ];
    
    if (allTransactions.length === 0) {
      markdown += `*No transactions found for this unit.*\n\n`;
      markdown += `---\n\n`;
      continue;
    }
    
    // Table header
    markdown += `| # | Date | Category | Description | Invoice/Receipt | Transaction ID | Method | Amount | Penalty | Payments | Balance | Notes | Consumption |\n`;
    markdown += `|---|------|----------|-------------|----------------|----------------|--------|--------|---------|----------|---------|-------|-------------|\n`;
    
    // Transaction rows
    allTransactions.forEach((tx, index) => {
      markdown += formatTransactionRow(tx, index + 1) + '\n';
    });
    
    // Summary
    markdown += `\n**Summary:**\n`;
    markdown += `- HOA Dues Subtotal: $${data.hoaDues.subtotal.toFixed(2)}\n`;
    markdown += `- HOA Dues Penalty Subtotal: $${data.hoaDues.penaltySubtotal.toFixed(2)}\n`;
    markdown += `- HOA Dues Running Balance: $${data.hoaDues.runningBalance.toFixed(2)}\n`;
    markdown += `- Water Bills Subtotal: $${data.waterBills.subtotal.toFixed(2)}\n`;
    markdown += `- Water Bills Penalty Subtotal: $${data.waterBills.penaltySubtotal.toFixed(2)}\n`;
    markdown += `- Water Bills Running Balance: $${data.waterBills.runningBalance.toFixed(2)}\n`;
    markdown += `- Total Balance: $${data.summary.totalBalance.toFixed(2)}\n`;
    markdown += `- Credit Balance: $${data.summary.creditBalance.toFixed(2)}\n`;
    markdown += `- Past Due Items: ${data.summary.pastDueItems.count} items, $${data.summary.pastDueItems.total.toFixed(2)}\n`;
    markdown += `- Coming Due Items: ${data.summary.comingDueItems.count} items, $${data.summary.comingDueItems.total.toFixed(2)}\n`;
    
    markdown += `\n---\n\n`;
  }
  
  return markdown;
}

async function main() {
  console.log('🚀 Generating statements for all units in AVII and MTC...\n');
  
  const userId = testConfig.DEFAULT_TEST_UID;
  
  // Filter out creditBalances document
  const filterCreditBalances = (units) => {
    return units.filter(unit => unit.unitId !== 'creditBalances');
  };
  
  const clients = ['AVII', 'MTC'];
  const allResults = {};
  
  for (const clientId of clients) {
    console.log(`\n📋 Processing ${clientId}...`);
    
    try {
      const allUnits = await getAllUnits(clientId);
      const units = filterCreditBalances(allUnits);
      console.log(`   Found ${units.length} units (filtered from ${allUnits.length})`);
      
      const unitStatements = [];
      
      for (const unit of units) {
        console.log(`   Generating statement for ${unit.unitId} (${unit.unitNumber})...`);
        const result = await generateStatementForUnit(
          clientId,
          unit.unitId,
          unit.unitNumber,
          unit.ownerName,
          userId
        );
        unitStatements.push(result);
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      allResults[clientId] = unitStatements;
      console.log(`   ✅ Completed ${clientId}: ${unitStatements.length} units processed`);
    } catch (error) {
      console.error(`   ❌ Error processing ${clientId}:`, error);
      allResults[clientId] = [];
    }
  }
  
  // Generate markdown output
  console.log('\n📝 Generating markdown output...');
  
  let fullMarkdown = `# Statement of Account - All Units Report\n\n`;
  fullMarkdown += `**Generated**: ${getNow().toISOString()}\n\n`;
  fullMarkdown += `This report contains unformatted statement data for all units in AVII and MTC clients.\n\n`;
  fullMarkdown += `Each unit shows:\n`;
  fullMarkdown += `- Unit number and owner name\n`;
  fullMarkdown += `- Statement period (fiscal years)\n`;
  fullMarkdown += `- All transactions (HOA Dues and Water Bills) in chronological order\n`;
  fullMarkdown += `- Summary totals\n\n`;
  fullMarkdown += `---\n\n`;
  
  // AVII section
  if (allResults.AVII && allResults.AVII.length > 0) {
    fullMarkdown += formatStatementMarkdown('AVII', allResults.AVII);
  }
  
  // MTC section
  if (allResults.MTC && allResults.MTC.length > 0) {
    fullMarkdown += formatStatementMarkdown('MTC', allResults.MTC);
  }
  
  // Write to file
  const fs = await import('fs');
  const path = await import('path');
  const outputPath = path.join(process.cwd(), 'test-results', `all-units-statements-${Date.now()}.md`);
  
  // Ensure directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, fullMarkdown, 'utf8');
  
  console.log(`\n✅ Report generated: ${outputPath}`);
  console.log(`\n📊 Summary:`);
  console.log(`   AVII: ${allResults.AVII?.length || 0} units`);
  console.log(`   MTC: ${allResults.MTC?.length || 0} units`);
  
  // Count successful vs errors
  const aviiSuccess = allResults.AVII?.filter(s => s.success).length || 0;
  const aviiErrors = allResults.AVII?.filter(s => !s.success).length || 0;
  const mtcSuccess = allResults.MTC?.filter(s => s.success).length || 0;
  const mtcErrors = allResults.MTC?.filter(s => !s.success).length || 0;
  
  console.log(`\n   AVII: ${aviiSuccess} successful, ${aviiErrors} errors`);
  console.log(`   MTC: ${mtcSuccess} successful, ${mtcErrors} errors`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

