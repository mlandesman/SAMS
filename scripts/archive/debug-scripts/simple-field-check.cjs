const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../backend/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkCollection(collectionName) {
  console.log(`\n=== Checking ${collectionName} ===`);
  
  try {
    // Get a sample of documents
    const snapshot = await db.collection(collectionName).limit(100).get();
    
    if (snapshot.empty) {
      console.log(`No documents found in ${collectionName}`);
      return null;
    }
    
    console.log(`Found ${snapshot.size} documents`);
    
    // Track field patterns
    const fieldStats = {};
    const sampleDocs = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      sampleDocs.push({ id: doc.id, data });
      
      // Count each field
      Object.keys(data).forEach(field => {
        if (!fieldStats[field]) {
          fieldStats[field] = {
            count: 0,
            types: new Set(),
            samples: []
          };
        }
        
        fieldStats[field].count++;
        
        // Track data type
        const value = data[field];
        let type = typeof value;
        if (Array.isArray(value)) type = 'array';
        else if (value && value._seconds) type = 'timestamp';
        else if (value instanceof Date) type = 'Date';
        
        fieldStats[field].types.add(type);
        
        // Keep a few samples
        if (fieldStats[field].samples.length < 3) {
          fieldStats[field].samples.push(value);
        }
      });
    });
    
    // Look for duplicate patterns
    const duplicatePatterns = [];
    const fieldPairs = [
      ['unit', 'unitId'],
      ['vendor', 'vendorId'],
      ['category', 'categoryId'],
      ['client', 'clientId'],
      ['owner', 'ownerId'],
      ['manager', 'managerId']
    ];
    
    fieldPairs.forEach(([field1, field2]) => {
      if (fieldStats[field1] && fieldStats[field2]) {
        duplicatePatterns.push({
          fields: [field1, field2],
          counts: [fieldStats[field1].count, fieldStats[field2].count]
        });
      }
    });
    
    return {
      collectionName,
      documentCount: snapshot.size,
      fieldStats,
      duplicatePatterns,
      sampleDocs: sampleDocs.slice(0, 3)
    };
    
  } catch (error) {
    console.error(`Error checking ${collectionName}:`, error.message);
    return null;
  }
}

async function checkTransactionPatterns() {
  console.log('\n=== Special Transaction Analysis ===');
  
  try {
    // Simple queries that don't require compound indexes
    const allTxns = await db.collection('transactions').limit(500).get();
    
    const patterns = {
      total: allTxns.size,
      withUnit: 0,
      withUnitId: 0,
      withBoth: 0,
      byCategory: {},
      byDateRange: {},
      samples: {
        unit: [],
        unitId: [],
        both: []
      }
    };
    
    allTxns.forEach(doc => {
      const data = doc.data();
      
      // Count unit fields
      const hasUnit = data.unit !== undefined && data.unit !== null;
      const hasUnitId = data.unitId !== undefined && data.unitId !== null;
      
      if (hasUnit) patterns.withUnit++;
      if (hasUnitId) patterns.withUnitId++;
      if (hasUnit && hasUnitId) {
        patterns.withBoth++;
        if (patterns.samples.both.length < 3) {
          patterns.samples.both.push({
            id: doc.id,
            unit: data.unit,
            unitId: data.unitId,
            match: data.unit === data.unitId,
            category: data.category,
            date: data.date
          });
        }
      } else if (hasUnit && patterns.samples.unit.length < 3) {
        patterns.samples.unit.push({
          id: doc.id,
          unit: data.unit,
          category: data.category,
          date: data.date
        });
      } else if (hasUnitId && patterns.samples.unitId.length < 3) {
        patterns.samples.unitId.push({
          id: doc.id,
          unitId: data.unitId,
          category: data.category,
          date: data.date
        });
      }
      
      // Track by category
      if (data.category) {
        if (!patterns.byCategory[data.category]) {
          patterns.byCategory[data.category] = {
            total: 0,
            withUnit: 0,
            withUnitId: 0
          };
        }
        patterns.byCategory[data.category].total++;
        if (hasUnit) patterns.byCategory[data.category].withUnit++;
        if (hasUnitId) patterns.byCategory[data.category].withUnitId++;
      }
    });
    
    return patterns;
    
  } catch (error) {
    console.error('Error in transaction analysis:', error.message);
    return null;
  }
}

async function checkImportScripts() {
  console.log('\n=== Import Script Analysis ===');
  
  const scriptPatterns = [];
  const dirs = [
    path.join(__dirname),
    path.join(__dirname, '..', 'backend', 'scripts')
  ];
  
  for (const dir of dirs) {
    try {
      const files = await fs.readdir(dir);
      const relevantFiles = files.filter(f => 
        (f.includes('import') || f.includes('migrate') || f.includes('test')) && 
        (f.endsWith('.js') || f.endsWith('.cjs'))
      );
      
      for (const file of relevantFiles) {
        try {
          const content = await fs.readFile(path.join(dir, file), 'utf8');
          
          const patterns = {
            fileName: file,
            directory: dir.split('/').pop(),
            fieldUsage: {
              unit: /\.unit\s*[=:]|['"]unit['"]\s*:/.test(content),
              unitId: /\.unitId\s*[=:]|['"]unitId['"]\s*:/.test(content),
              vendor: /\.vendor\s*[=:]|['"]vendor['"]\s*:/.test(content),
              vendorId: /\.vendorId\s*[=:]|['"]vendorId['"]\s*:/.test(content),
              category: /\.category\s*[=:]|['"]category['"]\s*:/.test(content),
              categoryId: /\.categoryId\s*[=:]|['"]categoryId['"]\s*:/.test(content)
            },
            dateHandling: content.includes('new Date') ? 'new Date()' :
                         content.includes('Timestamp') ? 'Firestore Timestamp' :
                         content.includes('toISOString') ? 'ISO String' : 
                         'Not detected'
          };
          
          // Only include if it uses relevant fields
          if (Object.values(patterns.fieldUsage).some(v => v)) {
            scriptPatterns.push(patterns);
          }
        } catch (e) {
          // Skip files we can't read
        }
      }
    } catch (e) {
      console.log(`Could not read directory ${dir}`);
    }
  }
  
  return scriptPatterns;
}

async function generateReport(results) {
  const timestamp = new Date().toISOString();
  
  let report = `# Field Assumption Verification Report

**Generated**: ${timestamp}
**Status**: CRITICAL - Field usage assumptions need verification

## Executive Summary

Our assumptions about field usage were reversed. This report shows the ACTUAL field patterns in the database.

## 1. Database Analysis Results

`;

  // Add collection results
  for (const result of results.collections) {
    if (!result) continue;
    
    report += `### ${result.collectionName}\n`;
    report += `- **Documents Found**: ${result.documentCount}\n`;
    
    if (result.duplicatePatterns.length > 0) {
      report += `- **⚠️ DUPLICATE PATTERNS FOUND**:\n`;
      result.duplicatePatterns.forEach(dup => {
        report += `  - Both '${dup.fields[0]}' (${dup.counts[0]} docs) and '${dup.fields[1]}' (${dup.counts[1]} docs) exist\n`;
      });
    }
    
    report += `\n**Field Usage**:\n`;
    report += `| Field | Count | Types | Sample Values |\n`;
    report += `|-------|--------|--------|---------------|\n`;
    
    // Show relevant fields
    const relevantFields = Object.entries(result.fieldStats)
      .filter(([field]) => 
        field.includes('Id') || 
        ['unit', 'vendor', 'category', 'client', 'owner', 'manager'].includes(field)
      )
      .sort((a, b) => b[1].count - a[1].count);
    
    relevantFields.forEach(([field, stats]) => {
      const types = Array.from(stats.types).join(', ');
      const samples = stats.samples.slice(0, 2).map(s => 
        typeof s === 'string' ? `"${s}"` : JSON.stringify(s)
      ).join(', ');
      report += `| ${field} | ${stats.count} | ${types} | ${samples} |\n`;
    });
    
    report += `\n`;
  }
  
  // Add transaction patterns
  if (results.transactionPatterns) {
    const tp = results.transactionPatterns;
    report += `## 2. Transaction-Specific Analysis\n\n`;
    report += `### Overall Statistics\n`;
    report += `- **Total Transactions**: ${tp.total}\n`;
    report += `- **With 'unit' field**: ${tp.withUnit} (${((tp.withUnit/tp.total)*100).toFixed(1)}%)\n`;
    report += `- **With 'unitId' field**: ${tp.withUnitId} (${((tp.withUnitId/tp.total)*100).toFixed(1)}%)\n`;
    report += `- **With BOTH fields**: ${tp.withBoth} ${tp.withBoth > 0 ? '⚠️ DUPLICATION!' : '✓'}\n\n`;
    
    if (tp.samples.both.length > 0) {
      report += `### ⚠️ Documents with Both Fields\n`;
      report += `| Doc ID | unit | unitId | Match? | Category |\n`;
      report += `|--------|------|--------|--------|----------|\n`;
      tp.samples.both.forEach(s => {
        report += `| ${s.id} | ${s.unit} | ${s.unitId} | ${s.match ? 'Yes' : 'NO'} | ${s.category} |\n`;
      });
      report += `\n`;
    }
    
    report += `### Usage by Category\n`;
    report += `| Category | Total | With 'unit' | With 'unitId' |\n`;
    report += `|----------|-------|-------------|---------------|\n`;
    Object.entries(tp.byCategory).forEach(([cat, data]) => {
      report += `| ${cat} | ${data.total} | ${data.withUnit} | ${data.withUnitId} |\n`;
    });
    report += `\n`;
  }
  
  // Add import script analysis
  if (results.importScripts && results.importScripts.length > 0) {
    report += `## 3. Code Analysis - Import Scripts\n\n`;
    report += `| Script | Dir | unit | unitId | vendor | vendorId | Date Handling |\n`;
    report += `|--------|-----|------|--------|--------|----------|---------------|\n`;
    results.importScripts.forEach(s => {
      const u = s.fieldUsage;
      report += `| ${s.fileName} | ${s.directory} | ${u.unit ? '✓' : ''} | ${u.unitId ? '✓' : ''} | ${u.vendor ? '✓' : ''} | ${u.vendorId ? '✓' : ''} | ${s.dateHandling} |\n`;
    });
    report += `\n`;
  }
  
  // Add recommendations
  report += `## 4. Critical Findings\n\n`;
  report += `Based on the data analysis:\n\n`;
  
  // Analyze findings and make recommendations
  const txnPatterns = results.transactionPatterns;
  if (txnPatterns) {
    if (txnPatterns.withUnit > txnPatterns.withUnitId) {
      report += `1. **Transactions primarily use 'unit'** (${txnPatterns.withUnit} vs ${txnPatterns.withUnitId})\n`;
    } else if (txnPatterns.withUnitId > txnPatterns.withUnit) {
      report += `1. **Transactions primarily use 'unitId'** (${txnPatterns.withUnitId} vs ${txnPatterns.withUnit})\n`;
    } else {
      report += `1. **Transactions have mixed usage** of unit/unitId fields\n`;
    }
    
    if (txnPatterns.withBoth > 0) {
      report += `2. **⚠️ CRITICAL: ${txnPatterns.withBoth} transactions have BOTH fields** - data duplication detected!\n`;
    }
  }
  
  report += `\n## 5. Recommendations\n\n`;
  report += `### Immediate Actions Required:\n\n`;
  report += `1. **STOP all field standardization work** until we determine the correct approach\n`;
  report += `2. **Choose ONE field name pattern** based on actual usage:\n`;
  report += `   - Option A: Use 'unit', 'vendor', 'category' (matches some existing data)\n`;
  report += `   - Option B: Use 'unitId', 'vendorId', 'categoryId' (more explicit)\n`;
  report += `3. **Create data migration plan** to unify all existing data\n`;
  report += `4. **Update ALL import scripts** to use consistent field names\n`;
  report += `5. **Remove fallback field checking** from application code\n`;
  report += `6. **Test migrations thoroughly** before applying to production\n`;
  
  return report;
}

async function main() {
  console.log('Starting Simple Field Verification...\n');
  
  const results = {
    collections: [],
    transactionPatterns: null,
    importScripts: []
  };
  
  // Check main collections
  const collections = ['transactions', 'vendors', 'categories', 'units', 'clients', 'users'];
  
  for (const coll of collections) {
    const result = await checkCollection(coll);
    results.collections.push(result);
  }
  
  // Special transaction analysis
  results.transactionPatterns = await checkTransactionPatterns();
  
  // Import script analysis
  results.importScripts = await checkImportScripts();
  
  // Generate report
  const report = await generateReport(results);
  
  // Save report
  const reportPath = path.join(__dirname, '..', 'apm', 'memory', 'field_audit', 'Assumption_Verification_Report.md');
  await fs.writeFile(reportPath, report);
  
  console.log(`\n✅ Report saved to: ${reportPath}`);
  
  // Also save raw data
  const dataPath = path.join(__dirname, '..', 'apm', 'memory', 'field_audit', 'field_verification_raw_data.json');
  await fs.writeFile(dataPath, JSON.stringify(results, null, 2));
  
  console.log(`✅ Raw data saved to: ${dataPath}`);
}

main().catch(console.error);