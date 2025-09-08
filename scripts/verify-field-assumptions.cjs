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

// Results object to track findings
const findings = {
  transactions: {
    fieldUsage: {},
    duplications: [],
    dataTypes: {},
    sources: {}
  },
  vendors: {
    fieldUsage: {},
    duplications: [],
    dataTypes: {}
  },
  categories: {
    fieldUsage: {},
    duplications: [],
    dataTypes: {}
  },
  units: {
    fieldUsage: {},
    duplications: [],
    dataTypes: {}
  },
  clients: {
    fieldUsage: {},
    duplications: [],
    dataTypes: {}
  },
  users: {
    fieldUsage: {},
    duplications: [],
    dataTypes: {}
  },
  inconsistencies: [],
  recommendations: []
};

// Helper to analyze field patterns
async function analyzeFieldPatterns(collection, collectionName) {
  console.log(`\n=== Analyzing ${collectionName} ===`);
  
  const snapshot = await db.collection(collection).limit(1000).get();
  const docs = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    docs.push({ id: doc.id, ...data });
  });
  
  console.log(`Found ${docs.length} documents in ${collectionName}`);
  
  // Track field usage
  const fieldCounts = {};
  const duplicateFields = [];
  const dataTypeMap = {};
  
  docs.forEach(doc => {
    Object.keys(doc).forEach(field => {
      if (!fieldCounts[field]) {
        fieldCounts[field] = 0;
        dataTypeMap[field] = new Set();
      }
      fieldCounts[field]++;
      
      // Track data types
      const value = doc[field];
      const type = Array.isArray(value) ? 'array' : 
                   value instanceof Date ? 'timestamp' :
                   value && value._seconds ? 'timestamp' :
                   typeof value;
      dataTypeMap[field].add(type);
    });
    
    // Check for duplicate field patterns (e.g., both unit and unitId)
    const duplicatePatterns = [
      ['unit', 'unitId'],
      ['vendor', 'vendorId'],
      ['category', 'categoryId'],
      ['client', 'clientId'],
      ['owner', 'ownerId'],
      ['manager', 'managerId']
    ];
    
    duplicatePatterns.forEach(([field1, field2]) => {
      if (doc[field1] !== undefined && doc[field2] !== undefined) {
        duplicateFields.push({
          docId: doc.id,
          fields: [field1, field2],
          values: [doc[field1], doc[field2]],
          match: doc[field1] === doc[field2]
        });
      }
    });
  });
  
  // Store findings
  findings[collectionName].fieldUsage = fieldCounts;
  findings[collectionName].duplications = duplicateFields;
  findings[collectionName].dataTypes = Object.fromEntries(
    Object.entries(dataTypeMap).map(([field, types]) => [field, Array.from(types)])
  );
  
  return { fieldCounts, duplicateFields, dataTypeMap };
}

// Analyze transaction-specific patterns
async function analyzeTransactionPatterns() {
  console.log('\n=== Deep Transaction Analysis ===');
  
  // Check unit vs unitId usage by category
  const categoryPatterns = {};
  
  const categories = ['HOA Dues', 'Maintenance', 'Utilities', 'Other'];
  
  for (const category of categories) {
    const unitQuery = await db.collection('transactions')
      .where('category', '==', category)
      .where('unit', '!=', null)
      .limit(100)
      .get();
      
    const unitIdQuery = await db.collection('transactions')
      .where('category', '==', category)
      .where('unitId', '!=', null)
      .limit(100)
      .get();
      
    categoryPatterns[category] = {
      withUnit: unitQuery.size,
      withUnitId: unitIdQuery.size,
      samples: {
        unit: unitQuery.docs.slice(0, 3).map(d => ({ id: d.id, unit: d.data().unit, date: d.data().date })),
        unitId: unitIdQuery.docs.slice(0, 3).map(d => ({ id: d.id, unitId: d.data().unitId, date: d.data().date }))
      }
    };
  }
  
  // Check by date ranges to identify import vs organic data
  const datePatterns = {};
  const now = new Date();
  const ranges = [
    { name: 'last30days', start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    { name: 'last6months', start: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) },
    { name: 'lastYear', start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) },
    { name: 'older', start: new Date('2020-01-01') }
  ];
  
  for (const range of ranges) {
    const unitQuery = await db.collection('transactions')
      .where('date', '>=', range.start)
      .where('unit', '!=', null)
      .limit(100)
      .get();
      
    const unitIdQuery = await db.collection('transactions')
      .where('date', '>=', range.start)
      .where('unitId', '!=', null)
      .limit(100)
      .get();
      
    datePatterns[range.name] = {
      withUnit: unitQuery.size,
      withUnitId: unitIdQuery.size
    };
  }
  
  findings.transactions.sources = { categoryPatterns, datePatterns };
}

// Check cross-collection references
async function analyzeCrossReferences() {
  console.log('\n=== Cross-Reference Analysis ===');
  
  const crossRefs = [];
  
  // Check if transaction.vendorId matches vendor collection
  const txnWithVendorId = await db.collection('transactions')
    .where('vendorId', '!=', null)
    .limit(10)
    .get();
    
  for (const doc of txnWithVendorId.docs) {
    const vendorId = doc.data().vendorId;
    
    // Try to find vendor by ID
    const vendorById = await db.collection('vendors').doc(vendorId).get();
    const vendorByVendorId = await db.collection('vendors')
      .where('vendorId', '==', vendorId)
      .limit(1)
      .get();
      
    crossRefs.push({
      type: 'transaction-vendor',
      transactionId: doc.id,
      vendorId: vendorId,
      foundById: vendorById.exists,
      foundByVendorId: !vendorByVendorId.empty,
      issue: !vendorById.exists && vendorByVendorId.empty ? 'ORPHANED' : 'OK'
    });
  }
  
  findings.inconsistencies = crossRefs;
}

// Scan import scripts for patterns
async function analyzeImportScripts() {
  console.log('\n=== Import Script Analysis ===');
  
  const scriptPatterns = [];
  const scriptsDir = path.join(__dirname);
  
  try {
    const files = await fs.readdir(scriptsDir);
    const importScripts = files.filter(f => f.includes('import') || f.includes('migrate'));
    
    for (const script of importScripts) {
      const content = await fs.readFile(path.join(scriptsDir, script), 'utf8');
      
      // Look for field assignment patterns
      const patterns = {
        fileName: script,
        usesUnit: /\.unit\s*=|unit:/.test(content),
        usesUnitId: /\.unitId\s*=|unitId:/.test(content),
        usesVendor: /\.vendor\s*=|vendor:/.test(content),
        usesVendorId: /\.vendorId\s*=|vendorId:/.test(content),
        usesCategory: /\.category\s*=|category:/.test(content),
        usesCategoryId: /\.categoryId\s*=|categoryId:/.test(content),
        dateHandling: content.includes('new Date') ? 'Date object' : 
                      content.includes('Timestamp') ? 'Firestore Timestamp' :
                      content.includes('.toISOString') ? 'ISO String' : 'Unknown'
      };
      
      scriptPatterns.push(patterns);
    }
  } catch (error) {
    console.error('Error reading scripts:', error);
  }
  
  return scriptPatterns;
}

// Generate recommendations
function generateRecommendations() {
  const recs = [];
  
  // Check for duplicate fields
  Object.entries(findings).forEach(([collection, data]) => {
    if (data.duplications && data.duplications.length > 0) {
      recs.push({
        severity: 'HIGH',
        collection: collection,
        issue: 'Duplicate fields found',
        details: `Found ${data.duplications.length} documents with both field variants`,
        recommendation: 'Standardize to single field name and migrate data'
      });
    }
    
    // Check for inconsistent data types
    if (data.dataTypes) {
      Object.entries(data.dataTypes).forEach(([field, types]) => {
        if (types.length > 1) {
          recs.push({
            severity: 'MEDIUM',
            collection: collection,
            field: field,
            issue: 'Inconsistent data types',
            types: types,
            recommendation: 'Standardize data type across all documents'
          });
        }
      });
    }
  });
  
  findings.recommendations = recs;
}

// Main execution
async function main() {
  console.log('Starting Field Assumption Verification...');
  console.log('=' * 50);
  
  try {
    // Analyze each collection
    await analyzeFieldPatterns('transactions', 'transactions');
    await analyzeFieldPatterns('vendors', 'vendors');
    await analyzeFieldPatterns('categories', 'categories');
    await analyzeFieldPatterns('units', 'units');
    await analyzeFieldPatterns('clients', 'clients');
    await analyzeFieldPatterns('users', 'users');
    
    // Deep dive on transactions
    await analyzeTransactionPatterns();
    
    // Cross-reference analysis
    await analyzeCrossReferences();
    
    // Import script analysis
    const scriptPatterns = await analyzeImportScripts();
    findings.importScripts = scriptPatterns;
    
    // Generate recommendations
    generateRecommendations();
    
    // Write comprehensive report
    const report = generateReport(findings);
    await fs.writeFile(
      path.join(__dirname, '..', 'apm', 'memory', 'field_audit', 'Assumption_Verification_Report.md'),
      report
    );
    
    console.log('\n=== Verification Complete ===');
    console.log(`Report written to: /apm/memory/field_audit/Assumption_Verification_Report.md`);
    
    // Also save raw JSON data
    await fs.writeFile(
      path.join(__dirname, '..', 'apm', 'memory', 'field_audit', 'field_verification_data.json'),
      JSON.stringify(findings, null, 2)
    );
    
  } catch (error) {
    console.error('Error during verification:', error);
  }
}

// Generate markdown report
function generateReport(findings) {
  const now = new Date().toISOString();
  
  let report = `# Field Assumption Verification Report

**Generated**: ${now}  
**Purpose**: Verify actual database field usage vs assumptions  
**Critical Finding**: Field usage assumptions were reversed - must verify all patterns

## Executive Summary

This report presents the ACTUAL field usage patterns found in the production database, 
revealing critical inconsistencies and reversed assumptions that must be addressed before 
proceeding with any field standardization work.

## 1. Transaction Fields Reality Check

### Field Usage Statistics
| Field Name | Document Count | Percentage | Data Types Found |
|------------|----------------|------------|------------------|
`;

  // Add transaction field stats
  Object.entries(findings.transactions.fieldUsage)
    .sort((a, b) => b[1] - a[1])
    .forEach(([field, count]) => {
      const types = findings.transactions.dataTypes[field] || [];
      const total = Object.values(findings.transactions.fieldUsage).reduce((a, b) => Math.max(a, b), 1);
      const percentage = ((count / total) * 100).toFixed(1);
      report += `| ${field} | ${count} | ${percentage}% | ${types.join(', ')} |\n`;
    });

  // Add duplicate field analysis
  report += `\n### Duplicate Field Patterns Found\n`;
  if (findings.transactions.duplications.length > 0) {
    report += `\n**WARNING**: Found ${findings.transactions.duplications.length} documents with duplicate fields\n\n`;
    report += `| Document ID | Fields | Values | Match? |\n`;
    report += `|-------------|---------|---------|--------|\n`;
    findings.transactions.duplications.slice(0, 10).forEach(dup => {
      report += `| ${dup.docId} | ${dup.fields.join(', ')} | ${dup.values.join(', ')} | ${dup.match ? 'Yes' : 'No'} |\n`;
    });
  } else {
    report += `\nNo duplicate fields found in transactions.\n`;
  }

  // Add category-specific patterns
  report += `\n### Field Usage by Transaction Category\n\n`;
  const catPatterns = findings.transactions.sources.categoryPatterns;
  Object.entries(catPatterns).forEach(([category, data]) => {
    report += `#### ${category}\n`;
    report += `- Documents with 'unit': ${data.withUnit}\n`;
    report += `- Documents with 'unitId': ${data.withUnitId}\n`;
    if (data.samples.unit.length > 0) {
      report += `- Sample 'unit' usage: ${JSON.stringify(data.samples.unit[0])}\n`;
    }
    if (data.samples.unitId.length > 0) {
      report += `- Sample 'unitId' usage: ${JSON.stringify(data.samples.unitId[0])}\n`;
    }
    report += `\n`;
  });

  // Add other collections summary
  report += `\n## 2. Other Collection Patterns\n\n`;
  ['vendors', 'categories', 'units', 'clients', 'users'].forEach(collection => {
    const data = findings[collection];
    if (data.fieldUsage && Object.keys(data.fieldUsage).length > 0) {
      report += `### ${collection}\n`;
      const relevantFields = Object.entries(data.fieldUsage)
        .filter(([field]) => field.includes('Id') || ['vendor', 'category', 'unit', 'client'].includes(field))
        .sort((a, b) => b[1] - a[1]);
      
      if (relevantFields.length > 0) {
        report += `| Field | Count | Data Types |\n`;
        report += `|-------|-------|------------|\n`;
        relevantFields.forEach(([field, count]) => {
          const types = data.dataTypes[field] || [];
          report += `| ${field} | ${count} | ${types.join(', ')} |\n`;
        });
      }
      
      if (data.duplications.length > 0) {
        report += `\n**Duplicates Found**: ${data.duplications.length} documents\n`;
      }
      report += `\n`;
    }
  });

  // Add import script patterns
  if (findings.importScripts && findings.importScripts.length > 0) {
    report += `\n## 3. Import Script Analysis\n\n`;
    report += `| Script | Uses 'unit' | Uses 'unitId' | Date Handling |\n`;
    report += `|--------|-------------|---------------|---------------|\n`;
    findings.importScripts.forEach(script => {
      report += `| ${script.fileName} | ${script.usesUnit ? '✓' : '✗'} | ${script.usesUnitId ? '✓' : '✗'} | ${script.dateHandling} |\n`;
    });
  }

  // Add recommendations
  report += `\n## 4. Critical Findings & Recommendations\n\n`;
  if (findings.recommendations.length > 0) {
    findings.recommendations.forEach((rec, idx) => {
      report += `### ${idx + 1}. ${rec.issue}\n`;
      report += `- **Severity**: ${rec.severity}\n`;
      report += `- **Collection**: ${rec.collection}\n`;
      if (rec.field) report += `- **Field**: ${rec.field}\n`;
      if (rec.details) report += `- **Details**: ${rec.details}\n`;
      if (rec.types) report += `- **Types Found**: ${rec.types.join(', ')}\n`;
      report += `- **Recommendation**: ${rec.recommendation}\n\n`;
    });
  }

  // Add action items
  report += `\n## 5. Immediate Action Items\n\n`;
  report += `1. **STOP all field-related code changes** until we establish the correct patterns\n`;
  report += `2. **Choose standardized field names** based on actual usage, not assumptions\n`;
  report += `3. **Create migration scripts** to unify field names and data types\n`;
  report += `4. **Update all import scripts** to use consistent field names\n`;
  report += `5. **Remove all fallback field checking** (e.g., checking both 'unit' and 'unitId')\n`;
  report += `6. **Document the final data dictionary** with exact field names and types\n`;

  return report;
}

// Run the analysis
main().catch(console.error);