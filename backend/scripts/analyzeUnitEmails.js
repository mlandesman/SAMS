/**
 * Analyze Unit Emails Script
 * 
 * Purpose: Scan all units across all clients and extract email/owner information
 * to build a comprehensive user list for review.
 * 
 * Outputs:
 * 1. A table of all discovered emails with associated unit/client info
 * 2. Data quality issues (comma-separated emails, missing names, etc.)
 * 3. Suggested user records to create
 * 
 * Usage:
 *   DEV:  node backend/scripts/analyzeUnitEmails.js
 *   PROD: node backend/scripts/analyzeUnitEmails.js --prod
 */

import admin from 'firebase-admin';

// Determine environment
const ENV = process.argv.includes('--prod') ? 'prod' : 'dev';

// Initialize Firebase with ADC
function initFirebase() {
  if (ENV === 'prod') {
    admin.initializeApp({
      projectId: 'sams-sandyland-prod',
    });
    console.log('🔥 Connected to PRODUCTION');
  } else {
    admin.initializeApp({
      projectId: 'sandyland-management-system',
    });
    console.log('🔥 Connected to DEV');
  }
  return admin.firestore();
}

const db = initFirebase();

// Store all discovered email entries
const emailEntries = [];
const dataIssues = [];

/**
 * Parse email field - handles both single emails and semicolon/comma separated
 */
function parseEmails(emailField) {
  if (!emailField) return [];
  
  // Convert to string if needed
  const emailStr = String(emailField).trim();
  if (!emailStr) return [];
  
  // Split by semicolon or comma
  const emails = emailStr.split(/[;,]/).map(e => e.trim().toLowerCase()).filter(e => e);
  
  return emails;
}

/**
 * Parse owner field - can be string or array
 */
function parseOwners(ownerField) {
  if (!ownerField) return [];
  
  if (Array.isArray(ownerField)) {
    return ownerField.map(o => String(o).trim()).filter(o => o);
  }
  
  // Single string
  const ownerStr = String(ownerField).trim();
  if (!ownerStr) return [];
  
  // Check for semicolon/comma separation
  if (ownerStr.includes(';') || ownerStr.includes(',')) {
    return ownerStr.split(/[;,]/).map(o => o.trim()).filter(o => o);
  }
  
  return [ownerStr];
}

/**
 * Process a single unit document
 */
function processUnit(clientId, unitId, unitData) {
  const emails = [];
  const owners = [];
  
  // Handle emails field (can be array or string)
  if (unitData.emails) {
    if (Array.isArray(unitData.emails)) {
      unitData.emails.forEach((emailEntry, index) => {
        const parsed = parseEmails(emailEntry);
        if (parsed.length > 1) {
          // Data quality issue: multiple emails in one array slot
          dataIssues.push({
            type: 'MULTI_EMAIL_IN_SLOT',
            clientId,
            unitId,
            field: `emails[${index}]`,
            value: emailEntry,
            parsed: parsed
          });
        }
        emails.push(...parsed.map((e, i) => ({ email: e, index: index, subIndex: i > 0 ? i : null })));
      });
    } else {
      const parsed = parseEmails(unitData.emails);
      if (parsed.length > 1) {
        dataIssues.push({
          type: 'MULTI_EMAIL_STRING',
          clientId,
          unitId,
          field: 'emails',
          value: unitData.emails,
          parsed: parsed
        });
      }
      emails.push(...parsed.map((e, i) => ({ email: e, index: 0, subIndex: i > 0 ? i : null })));
    }
  }
  
  // Handle owners field (can be array or string) - note: plural "owners"
  const ownerField = unitData.owners || unitData.owner;
  if (ownerField) {
    if (Array.isArray(ownerField)) {
      ownerField.forEach((ownerEntry, index) => {
        const parsed = parseOwners(ownerEntry);
        if (parsed.length > 1) {
        dataIssues.push({
          type: 'MULTI_OWNER_IN_SLOT',
          clientId,
          unitId,
          field: `owners[${index}]`,
          value: ownerEntry,
          parsed: parsed
        });
        }
        owners.push(...parsed.map((o, i) => ({ name: o, index: index, subIndex: i > 0 ? i : null })));
      });
    } else {
      const parsed = parseOwners(ownerField);
      if (parsed.length > 1) {
        dataIssues.push({
          type: 'MULTI_OWNER_STRING',
          clientId,
          unitId,
          field: 'owners',
          value: ownerField,
          parsed: parsed
        });
      }
      owners.push(...parsed.map((o, i) => ({ name: o, index: 0, subIndex: i > 0 ? i : null })));
    }
  }
  
  // Match emails to owners by index
  emails.forEach(emailEntry => {
    const matchingOwner = owners.find(o => o.index === emailEntry.index && o.subIndex === emailEntry.subIndex);
    
    emailEntries.push({
      clientId,
      unitId,
      email: emailEntry.email,
      name: matchingOwner?.name || '❓ UNKNOWN',
      emailIndex: emailEntry.index,
      subIndex: emailEntry.subIndex,
      rawEmails: unitData.emails,
      rawOwner: unitData.owner
    });
  });
  
  // Check for owners without emails
  owners.forEach(ownerEntry => {
    const hasEmail = emails.some(e => e.index === ownerEntry.index && e.subIndex === ownerEntry.subIndex);
    if (!hasEmail) {
      dataIssues.push({
        type: 'OWNER_NO_EMAIL',
        clientId,
        unitId,
        name: ownerEntry.name,
        index: ownerEntry.index
      });
    }
  });
  
  // Check for no emails at all
  if (emails.length === 0 && owners.length > 0) {
    dataIssues.push({
      type: 'NO_EMAILS',
      clientId,
      unitId,
      owners: owners.map(o => o.name)
    });
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═'.repeat(80));
  console.log('  UNIT EMAIL ANALYSIS');
  console.log('═'.repeat(80));
  console.log(`Environment: ${ENV.toUpperCase()}`);
  console.log('');
  
  try {
    // Get all clients
    const clientsSnap = await db.collection('clients').get();
    console.log(`Found ${clientsSnap.size} clients`);
    
    for (const clientDoc of clientsSnap.docs) {
      const clientId = clientDoc.id;
      console.log(`\nProcessing client: ${clientId}`);
      
      // Get all units for this client
      const unitsSnap = await db.collection('clients').doc(clientId)
        .collection('units').get();
      
      console.log(`  Found ${unitsSnap.size} units`);
      
      for (const unitDoc of unitsSnap.docs) {
        const unitId = unitDoc.id;
        const unitData = unitDoc.data();
        processUnit(clientId, unitId, unitData);
      }
    }
    
    // Deduplicate emails and aggregate properties
    const emailMap = new Map();
    
    emailEntries.forEach(entry => {
      const key = entry.email;
      if (!emailMap.has(key)) {
        emailMap.set(key, {
          email: entry.email,
          names: new Set(),
          properties: []
        });
      }
      const record = emailMap.get(key);
      if (entry.name !== '❓ UNKNOWN') {
        record.names.add(entry.name);
      }
      record.properties.push({
        clientId: entry.clientId,
        unitId: entry.unitId,
        isPrimary: entry.emailIndex === 0 && entry.subIndex === null
      });
    });
    
    // Convert to array and sort
    const uniqueEmails = Array.from(emailMap.values()).map(record => ({
      email: record.email,
      names: Array.from(record.names),
      properties: record.properties,
      suggestedName: record.names.size > 0 ? Array.from(record.names)[0] : '❓ NEEDS NAME',
      suggestedRole: record.properties.some(p => p.isPrimary) ? 'owner' : 'manager'
    })).sort((a, b) => a.email.localeCompare(b.email));
    
    // Output results
    console.log('\n' + '═'.repeat(80));
    console.log('  DISCOVERED EMAILS');
    console.log('═'.repeat(80));
    console.log('');
    
    // Table header
    console.log('| # | Email | Name(s) | Properties | Suggested Role |');
    console.log('|---|-------|---------|------------|----------------|');
    
    uniqueEmails.forEach((entry, index) => {
      const properties = entry.properties.map(p => `${p.clientId}:${p.unitId}`).join(', ');
      const names = entry.names.length > 0 ? entry.names.join(' / ') : '❓ UNKNOWN';
      console.log(`| ${index + 1} | ${entry.email} | ${names} | ${properties} | ${entry.suggestedRole} |`);
    });
    
    // Data quality issues
    if (dataIssues.length > 0) {
      console.log('\n' + '═'.repeat(80));
      console.log('  DATA QUALITY ISSUES');
      console.log('═'.repeat(80));
      console.log('');
      
      const issuesByType = {};
      dataIssues.forEach(issue => {
        if (!issuesByType[issue.type]) {
          issuesByType[issue.type] = [];
        }
        issuesByType[issue.type].push(issue);
      });
      
      for (const [type, issues] of Object.entries(issuesByType)) {
        console.log(`\n### ${type} (${issues.length} issues)`);
        issues.forEach(issue => {
          if (type === 'MULTI_EMAIL_IN_SLOT' || type === 'MULTI_EMAIL_STRING') {
            console.log(`  - ${issue.clientId}:${issue.unitId} ${issue.field}: "${issue.value}"`);
            console.log(`    → Should be split into: ${issue.parsed.join(', ')}`);
          } else if (type === 'OWNER_NO_EMAIL') {
            console.log(`  - ${issue.clientId}:${issue.unitId} owner[${issue.index}]: "${issue.name}" has no email`);
          } else if (type === 'NO_EMAILS') {
            console.log(`  - ${issue.clientId}:${issue.unitId} has owners but no emails: ${issue.owners.join(', ')}`);
          } else {
            console.log(`  - ${issue.clientId}:${issue.unitId}: ${JSON.stringify(issue)}`);
          }
        });
      }
    }
    
    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('  SUMMARY');
    console.log('═'.repeat(80));
    console.log(`  Total unique emails: ${uniqueEmails.length}`);
    console.log(`  Emails needing names: ${uniqueEmails.filter(e => e.names.length === 0).length}`);
    console.log(`  Data quality issues: ${dataIssues.length}`);
    console.log('');
    
    // Export for review
    const exportData = {
      generatedAt: new Date().toISOString(),
      environment: ENV,
      emails: uniqueEmails,
      dataIssues: dataIssues
    };
    
    const outputPath = `./backend/scripts/output/unit-emails-${ENV}-${new Date().toISOString().split('T')[0]}.json`;
    const fs = await import('fs');
    const path = await import('path');
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`  Export saved to: ${outputPath}`);
    console.log('');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
