/**
 * seedProjectsCollection.js
 * One-time seeding script to populate Projects collection in Firestore
 * with 4 historical MTC projects using transaction data from P-1 analysis
 */

import { initializeFirebase, getDb } from '../firebase.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project metadata from task assignment
const PROJECTS_METADATA = {
  'elevator-refurb-2023-2024': {
    name: 'Elevator Refurbishment 2023-2024',
    type: 'special-assessment',
    status: 'completed',
    startDate: '2023-09-20',
    completionDate: '2024-07-02',
    description: 'Combined elevator projects (Major Repair, Variator, Modernization, Motor & Variator)'
  },
  'roof-water-sealing-2024': {
    name: 'Roof Water Sealing',
    type: 'special-assessment',
    status: 'completed',
    startDate: '2024-08-07',
    completionDate: '2024-10-13',
    description: 'Seal all roof areas to prevent water leaks'
  },
  'propane-pipes-2025': {
    name: 'Propane Tank Fill Lines',
    type: 'special-assessment',
    status: 'completed',
    startDate: '2025-02-15',
    completionDate: '2025-03-11',
    description: 'Replace all hard lines from fill stations on North and South walls'
  },
  'column-repairs-2025': {
    name: 'Column Repairs',
    type: 'special-assessment',
    status: 'completed',
    startDate: '2025-03-29',
    completionDate: '2025-04-29',
    description: 'Chip out columns on marina side of south towers to expose, grind, epoxy, re-concrete and paint'
  }
};

/**
 * Parse CSV file and return array of transaction objects
 */
function parseTransactionsCSV() {
  const csvPath = '/Users/michael/Projects/SAMS-Docs/apm_session/Memory/Task_Completion_Logs/Projects_P-1_Transaction_Inventory.csv';
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.trim().split('\n');
  
  // Skip header row
  const headers = lines[0].split(',');
  const transactions = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV line (handling quoted fields)
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Last value
    
    // Map to object
    const tx = {};
    headers.forEach((header, index) => {
      tx[header] = values[index] || '';
    });
    
    // Convert amount to integer (centavos)
    tx.amount = parseInt(tx.amount, 10);
    
    transactions.push(tx);
  }
  
  return transactions;
}

/**
 * Extract unit ID from unitId field (e.g., "PH1A (Gluchowski)" -> "PH1A")
 */
function extractUnitId(unitIdField) {
  if (!unitIdField || unitIdField === 'N/A') return null;
  
  // Extract unit ID before parentheses
  const match = unitIdField.match(/^([A-Z0-9]+)/);
  return match ? match[1] : unitIdField.trim();
}

/**
 * Group transactions by projectId and separate collections/payments
 */
function groupTransactionsByProject(transactions) {
  const projects = {};
  
  for (const tx of transactions) {
    const projectId = tx.projectId?.replace(/"/g, '').trim();
    if (!projectId) continue;
    
    if (!projects[projectId]) {
      projects[projectId] = {
        collections: [],
        payments: []
      };
    }
    
    if (tx.type === 'deposit') {
      projects[projectId].collections.push(tx);
    } else if (tx.type === 'expense') {
      projects[projectId].payments.push(tx);
    }
  }
  
  return projects;
}

/**
 * Calculate unit assessments from collections
 */
function calculateUnitAssessments(collections) {
  const unitAssessments = {};
  
  for (const collection of collections) {
    const unitId = extractUnitId(collection.unitId);
    if (!unitId) continue;
    
    if (!unitAssessments[unitId]) {
      unitAssessments[unitId] = {
        unitId: unitId,
        expectedAmount: 0,
        actualPaid: 0,
        exempt: false
      };
    }
    
    unitAssessments[unitId].actualPaid += collection.amount;
    unitAssessments[unitId].expectedAmount = unitAssessments[unitId].actualPaid; // For legacy: expected = actual
  }
  
  // Handle exemptions (Unit 2B for propane-pipes-2025)
  // This will be set per project below
  
  return unitAssessments;
}

/**
 * Extract unique vendors from payments
 */
function extractVendors(payments) {
  const vendorSet = new Set();
  
  for (const payment of payments) {
    const vendor = payment.vendor?.trim();
    if (vendor && vendor !== 'N/A' && vendor !== 'OTHER') {
      vendorSet.add(vendor);
    }
  }
  
  return Array.from(vendorSet);
}

/**
 * Build project document from transactions
 */
function buildProjectDocument(projectId, metadata, transactions) {
  const { collections, payments } = transactions;
  
  // Calculate totals
  const totalCollected = collections.reduce((sum, tx) => sum + tx.amount, 0);
  const totalPaid = payments.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const balance = totalCollected - totalPaid;
  
  // Calculate unit assessments
  let unitAssessments = calculateUnitAssessments(collections);
  
  // Handle exemptions
  if (projectId === 'propane-pipes-2025') {
    if (unitAssessments['2B']) {
      unitAssessments['2B'].exempt = true;
      unitAssessments['2B'].notes = 'No propane tank';
    } else {
      // Add exempt unit even if no collections
      unitAssessments['2B'] = {
        unitId: '2B',
        expectedAmount: 0,
        actualPaid: 0,
        exempt: true,
        notes: 'No propane tank'
      };
    }
  }
  
  // Extract vendors
  const vendors = extractVendors(payments);
  
  // Build collections array
  const collectionsArray = collections.map(tx => ({
    transactionId: tx.transactionId,
    unitId: extractUnitId(tx.unitId),
    amount: tx.amount,
    date: tx.date
  })).filter(c => c.unitId); // Filter out null unitIds
  
  // Build payments array
  const paymentsArray = payments.map(tx => ({
    transactionId: tx.transactionId,
    amount: tx.amount, // Already negative
    date: tx.date,
    vendor: tx.vendor && tx.vendor !== 'N/A' ? tx.vendor : null,
    notes: tx.notes || null
  }));
  
  // Determine primary vendor (first vendor or from metadata)
  let primaryVendor = vendors[0] || '';
  
  // Special handling for projects with known vendors
  if (projectId === 'elevator-refurb-2023-2024') {
    primaryVendor = 'Vertical City / Irbin';
  } else if (projectId === 'roof-water-sealing-2024') {
    primaryVendor = 'Omar Peña / Humberto Torres';
  }
  
  // Build document
  const document = {
    projectId: projectId,
    name: metadata.name,
    type: metadata.type,
    status: metadata.status,
    startDate: metadata.startDate,
    completionDate: metadata.completionDate,
    description: metadata.description || '',
    
    // Vendor information
    vendor: {
      name: primaryVendor,
      contact: '',
      notes: ''
    },
    vendors: vendors, // Array of all vendors
    
    // Financial (all in centavos)
    totalCost: totalCollected, // For legacy projects, cost = collected
    totalCollected: totalCollected,
    totalPaid: totalPaid,
    balance: balance,
    
    // Unit assessments
    unitAssessments: unitAssessments,
    
    // Transaction links
    collections: collectionsArray,
    payments: paymentsArray,
    
    // Metadata
    metadata: {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'seeding-script',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'seeding-script',
      notes: 'Seeded from P-1 analysis'
    }
  };
  
  return document;
}

/**
 * Main seeding function
 */
async function seedProjects() {
  try {
    console.log('🌱 Starting Projects collection seeding...\n');
    
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    // Parse CSV
    console.log('📄 Parsing transaction CSV...');
    const transactions = parseTransactionsCSV();
    console.log(`   Found ${transactions.length} transactions\n`);
    
    // Group by project
    console.log('📊 Grouping transactions by project...');
    const projectsData = groupTransactionsByProject(transactions);
    console.log(`   Found ${Object.keys(projectsData).length} projects\n`);
    
    // Seed each project
    const clientId = 'MTC';
    const projectsRef = db.collection('clients').doc(clientId).collection('projects');
    
    let seededCount = 0;
    let errorCount = 0;
    
    for (const [projectId, transactions] of Object.entries(projectsData)) {
      const metadata = PROJECTS_METADATA[projectId];
      
      if (!metadata) {
        console.log(`⚠️  Skipping ${projectId} - no metadata found`);
        continue;
      }
      
      try {
        console.log(`📝 Seeding project: ${projectId}`);
        console.log(`   Collections: ${transactions.collections.length}`);
        console.log(`   Payments: ${transactions.payments.length}`);
        
        // Build document
        const document = buildProjectDocument(projectId, metadata, transactions);
        
        // Write to Firestore
        await projectsRef.doc(projectId).set(document);
        
        console.log(`   ✅ Seeded successfully`);
        console.log(`   Total Collected: M$${(document.totalCollected / 100).toFixed(2)}`);
        console.log(`   Total Paid: M$${(document.totalPaid / 100).toFixed(2)}`);
        console.log(`   Balance: M$${(document.balance / 100).toFixed(2)}`);
        console.log(`   Units: ${Object.keys(document.unitAssessments).length}`);
        console.log(`   Vendors: ${document.vendors.join(', ')}\n`);
        
        seededCount++;
      } catch (error) {
        console.error(`   ❌ Error seeding ${projectId}:`, error.message);
        errorCount++;
      }
    }
    
    // Verification
    console.log('\n🔍 Verifying seeded projects...');
    const allProjects = await projectsRef.get();
    console.log(`   Found ${allProjects.size} projects in Firestore\n`);
    
    // Summary
    console.log('📊 Seeding Summary:');
    console.log(`   ✅ Successfully seeded: ${seededCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📁 Total projects in Firestore: ${allProjects.size}\n`);
    
    if (errorCount === 0) {
      console.log('✅ Seeding completed successfully!');
    } else {
      console.log('⚠️  Seeding completed with errors. Please review.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error during seeding:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  seedProjects()
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { seedProjects, parseTransactionsCSV, buildProjectDocument };

