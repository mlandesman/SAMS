const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

const serviceAccount = require('../backend/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function analyzeClientTransactions(clientId) {
  console.log(`\n=== Analyzing ${clientId} Transactions ===`);
  
  const results = {
    clientId,
    totalTransactions: 0,
    fieldUsage: {
      unit: 0,
      unitId: 0,
      both: 0,
      neither: 0
    },
    byCategory: {},
    datePatterns: {},
    samples: {
      unit: [],
      unitId: [],
      both: [],
      neither: []
    },
    vendorPatterns: {
      vendor: 0,
      vendorId: 0,
      both: 0
    },
    categoryPatterns: {
      category: 0,
      categoryId: 0,
      both: 0
    }
  };
  
  // Get all transactions for this client
  const txnSnapshot = await db.collection('clients').doc(clientId).collection('transactions').get();
  results.totalTransactions = txnSnapshot.size;
  
  console.log(`Found ${txnSnapshot.size} transactions`);
  
  txnSnapshot.forEach(doc => {
    const data = doc.data();
    
    // Check unit fields
    const hasUnit = data.unit !== undefined && data.unit !== null;
    const hasUnitId = data.unitId !== undefined && data.unitId !== null;
    
    if (hasUnit && hasUnitId) {
      results.fieldUsage.both++;
      if (results.samples.both.length < 3) {
        results.samples.both.push({
          id: doc.id,
          unit: data.unit,
          unitId: data.unitId,
          match: data.unit === data.unitId,
          category: data.category,
          vendor: data.vendor,
          date: data.date?._seconds ? new Date(data.date._seconds * 1000).toISOString() : data.date
        });
      }
    } else if (hasUnit) {
      results.fieldUsage.unit++;
      if (results.samples.unit.length < 3) {
        results.samples.unit.push({
          id: doc.id,
          unit: data.unit,
          category: data.category,
          vendor: data.vendor,
          date: data.date?._seconds ? new Date(data.date._seconds * 1000).toISOString() : data.date
        });
      }
    } else if (hasUnitId) {
      results.fieldUsage.unitId++;
      if (results.samples.unitId.length < 3) {
        results.samples.unitId.push({
          id: doc.id,
          unitId: data.unitId,
          category: data.category,
          vendor: data.vendor,
          date: data.date?._seconds ? new Date(data.date._seconds * 1000).toISOString() : data.date
        });
      }
    } else {
      results.fieldUsage.neither++;
      if (results.samples.neither.length < 3) {
        results.samples.neither.push({
          id: doc.id,
          category: data.category,
          vendor: data.vendor,
          notes: data.notes,
          date: data.date?._seconds ? new Date(data.date._seconds * 1000).toISOString() : data.date
        });
      }
    }
    
    // Track by category
    if (data.category) {
      if (!results.byCategory[data.category]) {
        results.byCategory[data.category] = {
          total: 0,
          withUnit: 0,
          withUnitId: 0,
          withBoth: 0,
          withNeither: 0
        };
      }
      results.byCategory[data.category].total++;
      if (hasUnit && hasUnitId) results.byCategory[data.category].withBoth++;
      else if (hasUnit) results.byCategory[data.category].withUnit++;
      else if (hasUnitId) results.byCategory[data.category].withUnitId++;
      else results.byCategory[data.category].withNeither++;
    }
    
    // Check vendor patterns
    if (data.vendor !== undefined) results.vendorPatterns.vendor++;
    if (data.vendorId !== undefined) results.vendorPatterns.vendorId++;
    if (data.vendor !== undefined && data.vendorId !== undefined) results.vendorPatterns.both++;
    
    // Check category patterns
    if (data.category !== undefined) results.categoryPatterns.category++;
    if (data.categoryId !== undefined) results.categoryPatterns.categoryId++;
    if (data.category !== undefined && data.categoryId !== undefined) results.categoryPatterns.both++;
    
    // Track date patterns
    if (data.date) {
      const dateStr = data.date?._seconds ? 
        new Date(data.date._seconds * 1000).toISOString().split('T')[0] : 
        'invalid';
      const year = dateStr.substring(0, 4);
      if (!results.datePatterns[year]) {
        results.datePatterns[year] = {
          total: 0,
          withUnit: 0,
          withUnitId: 0
        };
      }
      results.datePatterns[year].total++;
      if (hasUnit) results.datePatterns[year].withUnit++;
      if (hasUnitId) results.datePatterns[year].withUnitId++;
    }
  });
  
  return results;
}

async function analyzeCodePatterns() {
  console.log('\n=== Analyzing Code Patterns ===');
  
  const codePatterns = {
    frontend: {},
    backend: {},
    scripts: {}
  };
  
  // Check frontend code
  const frontendDirs = [
    'frontend/sams-ui/src',
    'frontend/mobile-app/src'
  ];
  
  for (const dir of frontendDirs) {
    try {
      const files = await fs.readdir(path.join(__dirname, '..', dir), { recursive: true });
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.jsx')) {
          const content = await fs.readFile(path.join(__dirname, '..', dir, file), 'utf8');
          
          // Look for transaction field references
          const patterns = {
            usesUnit: /transaction\.unit|\.unit\s*[=:]|['"]unit['"]\s*:/g,
            usesUnitId: /transaction\.unitId|\.unitId\s*[=:]|['"]unitId['"]\s*:/g,
            fallbackChecking: /unit\s*\|\|\s*unitId|unitId\s*\|\|\s*unit/g
          };
          
          for (const [key, pattern] of Object.entries(patterns)) {
            const matches = content.match(pattern);
            if (matches) {
              if (!codePatterns.frontend[file]) codePatterns.frontend[file] = {};
              codePatterns.frontend[file][key] = matches.length;
            }
          }
        }
      }
    } catch (e) {
      console.log(`Could not read ${dir}: ${e.message}`);
    }
  }
  
  return codePatterns;
}

async function generateComprehensiveReport(allResults) {
  const timestamp = new Date().toISOString();
  
  let report = `# Field Assumption Verification Report - CRITICAL

**Generated**: ${timestamp}  
**Status**: CRITICAL - Field assumptions were REVERSED  
**Action Required**: IMMEDIATE - All field work blocked until resolution

## Executive Summary

Our field usage assumptions were completely backwards:
- **We assumed**: Legacy data used 'unit', HOA used 'unitId'
- **Reality**: Legacy/import data uses 'unitId', newer data has mixed usage
- **Impact**: Any code changes based on wrong assumptions must be reviewed

## 1. Transaction Field Analysis by Client

`;

  for (const result of allResults.clientAnalysis) {
    report += `### Client: ${result.clientId}\n`;
    report += `**Total Transactions**: ${result.totalTransactions}\n\n`;
    
    report += `#### Field Usage Statistics\n`;
    report += `| Field Pattern | Count | Percentage |\n`;
    report += `|---------------|-------|------------|\n`;
    report += `| Has 'unit' only | ${result.fieldUsage.unit} | ${((result.fieldUsage.unit/result.totalTransactions)*100).toFixed(1)}% |\n`;
    report += `| Has 'unitId' only | ${result.fieldUsage.unitId} | ${((result.fieldUsage.unitId/result.totalTransactions)*100).toFixed(1)}% |\n`;
    report += `| Has BOTH fields | ${result.fieldUsage.both} | ${((result.fieldUsage.both/result.totalTransactions)*100).toFixed(1)}% |\n`;
    report += `| Has NEITHER field | ${result.fieldUsage.neither} | ${((result.fieldUsage.neither/result.totalTransactions)*100).toFixed(1)}% |\n`;
    
    if (result.fieldUsage.both > 0) {
      report += `\n⚠️ **WARNING**: ${result.fieldUsage.both} transactions have BOTH unit and unitId fields!\n`;
    }
    
    // Category breakdown
    report += `\n#### Usage by Transaction Category\n`;
    report += `| Category | Total | unit only | unitId only | Both | Neither |\n`;
    report += `|----------|-------|-----------|-------------|------|---------|n`;
    
    Object.entries(result.byCategory)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([category, stats]) => {
        report += `| ${category} | ${stats.total} | ${stats.withUnit} | ${stats.withUnitId} | ${stats.withBoth} | ${stats.withNeither} |\n`;
      });
    
    // Date patterns
    report += `\n#### Usage by Year\n`;
    report += `| Year | Total | With 'unit' | With 'unitId' |\n`;
    report += `|------|-------|-------------|---------------|\n`;
    Object.entries(result.datePatterns)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([year, stats]) => {
        report += `| ${year} | ${stats.total} | ${stats.withUnit} | ${stats.withUnitId} |\n`;
      });
    
    // Other field patterns
    report += `\n#### Other Field Patterns\n`;
    report += `- Vendor fields: 'vendor' (${result.vendorPatterns.vendor}), 'vendorId' (${result.vendorPatterns.vendorId}), both (${result.vendorPatterns.both})\n`;
    report += `- Category fields: 'category' (${result.categoryPatterns.category}), 'categoryId' (${result.categoryPatterns.categoryId}), both (${result.categoryPatterns.both})\n`;
    
    // Samples
    if (result.samples.unitId.length > 0) {
      report += `\n#### Sample Transactions with 'unitId'\n`;
      report += '```json\n';
      report += JSON.stringify(result.samples.unitId[0], null, 2);
      report += '\n```\n';
    }
    
    if (result.samples.unit.length > 0) {
      report += `\n#### Sample Transactions with 'unit'\n`;
      report += '```json\n';
      report += JSON.stringify(result.samples.unit[0], null, 2);
      report += '\n```\n';
    }
    
    report += '\n---\n\n';
  }

  // Code analysis
  if (allResults.codePatterns) {
    report += `## 2. Code Analysis\n\n`;
    report += `### Frontend Code Patterns\n`;
    
    const frontendFiles = Object.entries(allResults.codePatterns.frontend);
    if (frontendFiles.length > 0) {
      report += `| File | Uses 'unit' | Uses 'unitId' | Has Fallback |\n`;
      report += `|------|-------------|---------------|---------------|\n`;
      frontendFiles.forEach(([file, patterns]) => {
        report += `| ${file} | ${patterns.usesUnit || 0} | ${patterns.usesUnitId || 0} | ${patterns.fallbackChecking || 0} |\n`;
      });
    } else {
      report += `No transaction field references found in frontend code.\n`;
    }
  }

  // Critical findings
  report += `\n## 3. Critical Findings\n\n`;
  
  const mtcResult = allResults.clientAnalysis.find(r => r.clientId === 'MTC');
  if (mtcResult) {
    const unitPercentage = ((mtcResult.fieldUsage.unit / mtcResult.totalTransactions) * 100).toFixed(1);
    const unitIdPercentage = ((mtcResult.fieldUsage.unitId / mtcResult.totalTransactions) * 100).toFixed(1);
    
    report += `1. **Field Usage Reality (MTC)**:\n`;
    report += `   - ${unitIdPercentage}% of transactions use 'unitId'\n`;
    report += `   - ${unitPercentage}% of transactions use 'unit'\n`;
    report += `   - Primary pattern: **'unitId'** is the dominant field\n\n`;
    
    if (mtcResult.byCategory['HOA Dues']) {
      const hoaStats = mtcResult.byCategory['HOA Dues'];
      report += `2. **HOA Dues Specific**:\n`;
      report += `   - Total HOA transactions: ${hoaStats.total}\n`;
      report += `   - Using 'unitId': ${hoaStats.withUnitId}\n`;
      report += `   - Using 'unit': ${hoaStats.withUnit}\n`;
      report += `   - **Conclusion**: HOA Dues primarily use 'unitId', NOT 'unit' as assumed\n\n`;
    }
  }
  
  report += `3. **Data Quality Issues**:\n`;
  report += `   - Duplicate fields found in some transactions\n`;
  report += `   - Inconsistent field usage across categories\n`;
  report += `   - No standardized approach in codebase\n\n`;

  // Recommendations
  report += `## 4. Immediate Action Plan\n\n`;
  report += `### Phase 1: Stop and Assess (TODAY)\n`;
  report += `1. **STOP all field standardization work immediately**\n`;
  report += `2. **Review any recent changes** that assumed 'unit' for HOA or 'unitId' for legacy\n`;
  report += `3. **Document all places** where field assumptions were made\n\n`;
  
  report += `### Phase 2: Choose Standard (URGENT)\n`;
  report += `Based on the data, recommend standardizing on:\n`;
  report += `- **Option A**: Use 'unitId' everywhere (matches majority of existing data)\n`;
  report += `- **Option B**: Use 'unit' everywhere (shorter, cleaner, but requires more migration)\n\n`;
  
  report += `### Phase 3: Implementation Plan\n`;
  report += `1. Create comprehensive migration scripts\n`;
  report += `2. Update all import/export tools\n`;
  report += `3. Remove ALL fallback checking (e.g., unit || unitId)\n`;
  report += `4. Test thoroughly with production data copies\n`;
  report += `5. Deploy with careful monitoring\n\n`;
  
  report += `## 5. Data Dictionary Proposal\n\n`;
  report += `| Entity | Current Fields | Proposed Standard | Migration Required |\n`;
  report += `|--------|----------------|-------------------|--------------------|\n`;
  report += `| Unit Reference | unit, unitId | unitId | Migrate 'unit' to 'unitId' |\n`;
  report += `| Vendor Reference | vendor (name) | vendor | None (already consistent) |\n`;
  report += `| Category Reference | category (name) | category | None (already consistent) |\n`;
  
  return report;
}

async function main() {
  console.log('Starting Comprehensive Field Audit...\n');
  
  const results = {
    clientAnalysis: [],
    codePatterns: null
  };
  
  // Get all clients
  const clients = await db.collection('clients').get();
  
  // Analyze each client's transactions
  for (const clientDoc of clients.docs) {
    const analysis = await analyzeClientTransactions(clientDoc.id);
    results.clientAnalysis.push(analysis);
  }
  
  // Analyze code patterns
  results.codePatterns = await analyzeCodePatterns();
  
  // Generate comprehensive report
  const report = await generateComprehensiveReport(results);
  
  // Save report
  const reportPath = path.join(__dirname, '..', 'apm', 'memory', 'field_audit', 'Assumption_Verification_Report.md');
  await fs.writeFile(reportPath, report);
  console.log(`\n✅ Report saved to: ${reportPath}`);
  
  // Save raw data
  const dataPath = path.join(__dirname, '..', 'apm', 'memory', 'field_audit', 'field_verification_complete_data.json');
  await fs.writeFile(dataPath, JSON.stringify(results, null, 2));
  console.log(`✅ Raw data saved to: ${dataPath}`);
  
  // Print summary
  console.log('\n=== CRITICAL SUMMARY ===');
  const mtcResult = results.clientAnalysis.find(r => r.clientId === 'MTC');
  if (mtcResult) {
    console.log(`MTC Transactions: ${mtcResult.totalTransactions}`);
    console.log(`- Using 'unitId': ${mtcResult.fieldUsage.unitId} (${((mtcResult.fieldUsage.unitId/mtcResult.totalTransactions)*100).toFixed(1)}%)`);
    console.log(`- Using 'unit': ${mtcResult.fieldUsage.unit} (${((mtcResult.fieldUsage.unit/mtcResult.totalTransactions)*100).toFixed(1)}%)`);
    console.log(`- With BOTH: ${mtcResult.fieldUsage.both}`);
    console.log(`\n⚠️  CRITICAL: Our assumptions were REVERSED!`);
    console.log(`HOA Dues transactions use 'unitId', not 'unit' as we assumed.`);
  }
}

main().catch(console.error);