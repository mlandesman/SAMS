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

// Critical collections that have had multiple migrations
const CRITICAL_COLLECTIONS = {
  clients: {
    description: 'Client configurations - multiple structure changes',
    expectedFields: ['basicInfo', 'branding', 'configuration', 'contactInfo', 'metadata'],
    nestedCollections: ['transactions', 'hoa_dues', 'balance_snapshots', 'documents']
  },
  users: {
    description: 'User accounts - migrated from email to UID, back to email, back to UID',
    expectedFields: ['email', 'name', 'role', 'clientId', 'unitId', 'clientAccess'],
    migrationMarkers: ['_reverted', 'migrationData', 'creationMethod']
  },
  dues: {
    description: 'HOA dues data - nested under clients/{clientId}/hoa_dues/{year}',
    isNested: true,
    expectedStructure: 'units as document IDs with payment data'
  }
};

async function auditCollection(collectionName, config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`AUDITING: ${collectionName}`);
  console.log(`Description: ${config.description}`);
  console.log(`${'='.repeat(60)}\n`);

  const results = {
    collection: collectionName,
    documentCount: 0,
    fieldAnalysis: {},
    inconsistencies: [],
    migrationEvidence: [],
    dataTypeConflicts: [],
    samples: []
  };

  try {
    const snapshot = await db.collection(collectionName).get();
    results.documentCount = snapshot.size;
    
    console.log(`Found ${snapshot.size} documents`);

    // Analyze each document
    const fieldStats = {};
    const fieldTypes = {};
    const fieldValueSamples = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      results.samples.push({ id: doc.id, data: data });

      // Deep field analysis
      analyzeFields(data, '', fieldStats, fieldTypes, fieldValueSamples);

      // Check for migration markers
      if (config.migrationMarkers) {
        config.migrationMarkers.forEach(marker => {
          if (data[marker]) {
            results.migrationEvidence.push({
              docId: doc.id,
              marker: marker,
              value: data[marker]
            });
          }
        });
      }
    });

    // Compile field analysis
    Object.keys(fieldStats).forEach(field => {
      const types = Array.from(fieldTypes[field] || new Set());
      const samples = fieldValueSamples[field] || [];
      
      results.fieldAnalysis[field] = {
        count: fieldStats[field],
        percentage: ((fieldStats[field] / results.documentCount) * 100).toFixed(1),
        dataTypes: types,
        samples: samples.slice(0, 3)
      };

      // Flag inconsistencies
      if (types.length > 1) {
        results.dataTypeConflicts.push({
          field: field,
          types: types,
          message: `Field has multiple data types: ${types.join(', ')}`
        });
      }
    });

    // Check for duplicate/redundant fields
    checkDuplicatePatterns(results);

    return results;

  } catch (error) {
    console.error(`Error auditing ${collectionName}:`, error);
    return results;
  }
}

async function auditNestedDues() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`AUDITING: HOA Dues (Nested Collections)`);
  console.log(`${'='.repeat(60)}\n`);

  const results = {
    collection: 'hoa_dues',
    clients: {},
    fieldPatterns: {},
    inconsistencies: []
  };

  // Get all clients
  const clients = await db.collection('clients').get();
  
  for (const clientDoc of clients.docs) {
    const clientId = clientDoc.id;
    console.log(`\nChecking client: ${clientId}`);
    
    results.clients[clientId] = {
      years: {},
      totalUnits: 0
    };

    // Get all years
    const years = await db.collection('clients').doc(clientId).collection('hoa_dues').get();
    
    for (const yearDoc of years.docs) {
      const year = yearDoc.id;
      const yearData = yearDoc.data();
      
      console.log(`  Year ${year}: Checking unit documents...`);
      
      // Count units and analyze structure
      const unitCount = Object.keys(yearData).length;
      const fieldNames = new Set();
      const unitSamples = [];

      Object.entries(yearData).forEach(([unitId, unitData]) => {
        if (typeof unitData === 'object' && unitData !== null) {
          Object.keys(unitData).forEach(field => fieldNames.add(field));
          if (unitSamples.length < 3) {
            unitSamples.push({ unitId, data: unitData });
          }
        }
      });

      results.clients[clientId].years[year] = {
        unitCount: unitCount,
        fields: Array.from(fieldNames),
        samples: unitSamples
      };

      results.clients[clientId].totalUnits += unitCount;

      // Track global field patterns
      fieldNames.forEach(field => {
        if (!results.fieldPatterns[field]) {
          results.fieldPatterns[field] = { count: 0, years: [] };
        }
        results.fieldPatterns[field].count++;
        if (!results.fieldPatterns[field].years.includes(year)) {
          results.fieldPatterns[field].years.push(year);
        }
      });
    }
  }

  return results;
}

async function auditUserCollection() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SPECIAL AUDIT: Users Collection (High Migration Risk)`);
  console.log(`${'='.repeat(60)}\n`);

  const results = {
    collection: 'users',
    totalUsers: 0,
    documentIdPatterns: {
      uid: 0,
      email: 0,
      base64Email: 0,
      other: 0
    },
    fieldInconsistencies: [],
    clientAccessPatterns: {},
    migrationEvidence: []
  };

  const snapshot = await db.collection('users').get();
  results.totalUsers = snapshot.size;

  snapshot.forEach(doc => {
    const docId = doc.id;
    const data = doc.data();

    // Analyze document ID pattern
    if (docId.includes('@')) {
      results.documentIdPatterns.email++;
    } else if (docId.match(/^[A-Za-z0-9+/]+=*$/)) {
      results.documentIdPatterns.base64Email++;
    } else if (docId.match(/^[a-zA-Z0-9]{20,}$/)) {
      results.documentIdPatterns.uid++;
    } else {
      results.documentIdPatterns.other++;
    }

    // Check for ID mismatches
    if (data.uid && data.uid !== docId) {
      results.fieldInconsistencies.push({
        docId: docId,
        issue: 'Document ID does not match uid field',
        uid: data.uid,
        email: data.email
      });
    }

    // Analyze clientAccess structure
    if (data.clientAccess) {
      const accessType = Array.isArray(data.clientAccess) ? 'array' : 'object';
      if (!results.clientAccessPatterns[accessType]) {
        results.clientAccessPatterns[accessType] = 0;
      }
      results.clientAccessPatterns[accessType]++;

      // Check for nested unitAssignments
      if (typeof data.clientAccess === 'object') {
        Object.entries(data.clientAccess).forEach(([clientId, access]) => {
          if (access.unitAssignments && access.unitId) {
            results.fieldInconsistencies.push({
              docId: docId,
              issue: 'Both unitId and unitAssignments present',
              clientId: clientId
            });
          }
        });
      }
    }

    // Check for migration markers
    ['_reverted', 'migrationData', '_originalDocId', '_migratedFrom'].forEach(marker => {
      if (data[marker]) {
        results.migrationEvidence.push({
          docId: docId,
          marker: marker,
          value: data[marker]
        });
      }
    });
  });

  return results;
}

function analyzeFields(obj, prefix, fieldStats, fieldTypes, fieldValueSamples, depth = 0) {
  if (depth > 5) return; // Prevent infinite recursion

  Object.entries(obj).forEach(([key, value]) => {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    // Track field occurrence
    if (!fieldStats[fieldPath]) {
      fieldStats[fieldPath] = 0;
      fieldTypes[fieldPath] = new Set();
      fieldValueSamples[fieldPath] = [];
    }
    fieldStats[fieldPath]++;

    // Determine type
    let type = typeof value;
    if (value === null) type = 'null';
    else if (Array.isArray(value)) type = 'array';
    else if (value && value._seconds) type = 'timestamp';
    else if (value instanceof Date) type = 'Date';
    
    fieldTypes[fieldPath].add(type);

    // Store samples
    if (fieldValueSamples[fieldPath].length < 3 && type !== 'object') {
      fieldValueSamples[fieldPath].push(value);
    }

    // Recurse for objects (but not timestamps)
    if (type === 'object' && !value._seconds) {
      analyzeFields(value, fieldPath, fieldStats, fieldTypes, fieldValueSamples, depth + 1);
    }
  });
}

function checkDuplicatePatterns(results) {
  const duplicatePatterns = [
    ['unit', 'unitId'],
    ['vendor', 'vendorId'],
    ['category', 'categoryId'],
    ['client', 'clientId'],
    ['owner', 'ownerId'],
    ['manager', 'managerId'],
    ['created', 'createdAt', 'creationDate'],
    ['modified', 'modifiedAt', 'lastModified', 'updatedAt'],
    ['active', 'isActive', 'status']
  ];

  duplicatePatterns.forEach(pattern => {
    const foundFields = pattern.filter(field => 
      results.fieldAnalysis[field] && results.fieldAnalysis[field].count > 0
    );

    if (foundFields.length > 1) {
      results.inconsistencies.push({
        type: 'duplicate_fields',
        fields: foundFields,
        message: `Multiple similar fields found: ${foundFields.join(', ')}`
      });
    }
  });
}

async function generateComprehensiveReport(allResults) {
  const timestamp = new Date().toISOString();
  
  let report = `# Critical Collections Audit Report

**Generated**: ${timestamp}  
**Purpose**: Audit collections with multiple migrations and changes  
**Focus**: clients, users, hoa_dues

## Executive Summary

This audit examines the collections that have undergone the most migrations and changes,
identifying field inconsistencies, data type conflicts, and migration artifacts.

`;

  // Users Collection Special Section
  if (allResults.users) {
    report += `## 1. Users Collection (HIGHEST RISK)

### Document ID Analysis
| Pattern | Count | Description |
|---------|-------|-------------|
| UID | ${allResults.users.documentIdPatterns.uid} | Firebase Auth UIDs |
| Email | ${allResults.users.documentIdPatterns.email} | Plain email addresses |
| Base64 Email | ${allResults.users.documentIdPatterns.base64Email} | Encoded emails |
| Other | ${allResults.users.documentIdPatterns.other} | Unknown patterns |

### Migration Evidence
Found ${allResults.users.migrationEvidence.length} documents with migration markers:
`;
    
    allResults.users.migrationEvidence.slice(0, 5).forEach(evidence => {
      report += `- Doc ${evidence.docId}: ${evidence.marker} present\n`;
    });

    report += `\n### Field Inconsistencies\n`;
    if (allResults.users.fieldInconsistencies.length > 0) {
      report += `⚠️ Found ${allResults.users.fieldInconsistencies.length} inconsistencies:\n`;
      allResults.users.fieldInconsistencies.slice(0, 5).forEach(issue => {
        report += `- ${issue.issue} (Doc: ${issue.docId})\n`;
      });
    }
  }

  // Standard collection results
  ['clients', 'users'].forEach(collName => {
    const results = allResults[collName + '_detailed'];
    if (!results) return;

    report += `\n## ${collName.toUpperCase()} Collection\n\n`;
    report += `**Total Documents**: ${results.documentCount}\n\n`;

    // Field analysis
    report += `### Field Analysis\n`;
    report += `| Field | Count | % | Data Types | Sample Values |\n`;
    report += `|-------|-------|---|------------|---------------|\n`;

    Object.entries(results.fieldAnalysis)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .forEach(([field, stats]) => {
        const samples = stats.samples.map(s => 
          typeof s === 'string' ? `"${s.substring(0, 20)}..."` : String(s)
        ).join(', ');
        report += `| ${field} | ${stats.count} | ${stats.percentage}% | ${stats.dataTypes.join(', ')} | ${samples} |\n`;
      });

    // Data type conflicts
    if (results.dataTypeConflicts.length > 0) {
      report += `\n### ⚠️ Data Type Conflicts\n`;
      results.dataTypeConflicts.forEach(conflict => {
        report += `- **${conflict.field}**: ${conflict.message}\n`;
      });
    }

    // Inconsistencies
    if (results.inconsistencies.length > 0) {
      report += `\n### ⚠️ Field Inconsistencies\n`;
      results.inconsistencies.forEach(issue => {
        report += `- ${issue.message}\n`;
      });
    }
  });

  // HOA Dues Analysis
  if (allResults.dues) {
    report += `\n## HOA Dues (Nested Collections)\n\n`;
    
    Object.entries(allResults.dues.clients).forEach(([clientId, clientData]) => {
      report += `### Client: ${clientId}\n`;
      report += `Total Units Tracked: ${clientData.totalUnits}\n\n`;
      
      Object.entries(clientData.years).forEach(([year, yearData]) => {
        report += `#### Year ${year}\n`;
        report += `- Units: ${yearData.unitCount}\n`;
        report += `- Fields: ${yearData.fields.join(', ')}\n`;
      });
    });

    report += `\n### Global Field Patterns in Dues\n`;
    report += `| Field | Occurrences | Years Present |\n`;
    report += `|-------|-------------|---------------|\n`;
    Object.entries(allResults.dues.fieldPatterns).forEach(([field, data]) => {
      report += `| ${field} | ${data.count} | ${data.years.join(', ')} |\n`;
    });
  }

  // Critical recommendations
  report += `\n## Critical Recommendations\n\n`;
  report += `1. **Users Collection**: Standardize on UID-based document IDs\n`;
  report += `2. **Remove Migration Artifacts**: Clean up _reverted, _originalDocId fields\n`;
  report += `3. **Standardize clientAccess**: Convert all to consistent object structure\n`;
  report += `4. **Fix Data Type Conflicts**: Especially timestamp fields\n`;
  report += `5. **Remove Duplicate Fields**: Use single consistent field names\n`;

  return report;
}

async function main() {
  console.log('Starting Critical Collections Audit...\n');
  
  const results = {};

  // Special audit for users
  results.users = await auditUserCollection();

  // Standard audits
  for (const [collName, config] of Object.entries(CRITICAL_COLLECTIONS)) {
    if (collName === 'dues') {
      results.dues = await auditNestedDues();
    } else {
      results[collName + '_detailed'] = await auditCollection(collName, config);
    }
  }

  // Generate report
  const report = await generateComprehensiveReport(results);
  
  // Save report
  const reportPath = path.join(__dirname, '..', 'apm', 'memory', 'field_audit', 'Critical_Collections_Audit.md');
  await fs.writeFile(reportPath, report);
  console.log(`\n✅ Report saved to: ${reportPath}`);
  
  // Save raw data
  const dataPath = path.join(__dirname, '..', 'apm', 'memory', 'field_audit', 'critical_collections_raw_data.json');
  await fs.writeFile(dataPath, JSON.stringify(results, null, 2));
  console.log(`✅ Raw data saved to: ${dataPath}`);

  // Print critical findings summary
  console.log('\n=== CRITICAL FINDINGS SUMMARY ===');
  console.log(`Users with migration markers: ${results.users.migrationEvidence.length}`);
  console.log(`User field inconsistencies: ${results.users.fieldInconsistencies.length}`);
  console.log(`User document ID patterns: UID(${results.users.documentIdPatterns.uid}), Email(${results.users.documentIdPatterns.email}), Base64(${results.users.documentIdPatterns.base64Email})`);
}

main().catch(console.error);