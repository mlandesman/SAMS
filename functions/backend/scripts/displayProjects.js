/**
 * displayProjects.js
 * Display projects from Firestore as formatted text tables
 * Validates P-2 seeded data and serves as template for Statement of Account integration
 */

import { initializeFirebase, getDb } from '../firebase.js';

/**
 * Format centavos to pesos with M$ prefix and commas
 * @param {number} centavos - Amount in centavos
 * @returns {string} Formatted amount (e.g., "M$3,409.56")
 */
function formatAmount(centavos) {
  if (!centavos && centavos !== 0) return 'M$0.00';
  const pesos = centavos / 100;
  return `M$${pesos.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Sort items by date (ascending)
 * @param {Array} items - Array of items with date field
 * @returns {Array} Sorted array
 */
function sortByDate(items) {
  return items.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });
}

/**
 * Format project header section
 * @param {Object} project - Project document
 * @returns {string} Formatted header
 */
function formatProjectHeader(project) {
  const period = `${project.startDate} to ${project.completionDate}`;
  const vendor = project.vendor?.name || project.vendors?.join(', ') || 'N/A';
  
  return `================================================================================
PROJECT: ${project.name} (${project.projectId})
================================================================================
Status: ${project.status}
Period: ${period}
Vendor: ${vendor}
--------------------------------------------------------------------------------
`;
}

/**
 * Format collections table
 * @param {Array} collections - Collections array (sorted)
 * @returns {string} Formatted collections table
 */
function formatCollectionsTable(collections) {
  if (!collections || collections.length === 0) {
    return `COLLECTIONS (Unit Payments)
--------------------------------------------------------------------------------
No collections found
--------------------------------------------------------------------------------
`;
  }
  
  const sorted = sortByDate([...collections]);
  const total = collections.reduce((sum, c) => sum + (c.amount || 0), 0);
  
  let table = `COLLECTIONS (Unit Payments)
--------------------------------------------------------------------------------
Date        | Unit  | Amount      | Transaction ID
------------|-------|-------------|----------------------------------
`;
  
  for (const collection of sorted) {
    const date = collection.date || 'N/A';
    const unit = (collection.unitId || 'N/A').padEnd(5);
    const amount = formatAmount(collection.amount || 0).padStart(12);
    const transactionId = collection.transactionId || 'N/A';
    
    table += `${date}  | ${unit} | ${amount} | ${transactionId}\n`;
  }
  
  table += `--------------------------------------------------------------------------------
                      TOTAL: ${formatAmount(total)} (${collections.length} transaction${collections.length !== 1 ? 's' : ''})
`;
  
  return table;
}

/**
 * Format payments table
 * @param {Array} payments - Payments array (sorted)
 * @returns {string} Formatted payments table
 */
function formatPaymentsTable(payments) {
  if (!payments || payments.length === 0) {
    return `PAYMENTS (Vendor Expenses)
--------------------------------------------------------------------------------
No payments found
--------------------------------------------------------------------------------
`;
  }
  
  const sorted = sortByDate([...payments]);
  const total = payments.reduce((sum, p) => sum + Math.abs(p.amount || 0), 0);
  
  let table = `PAYMENTS (Vendor Expenses)
--------------------------------------------------------------------------------
Date        | Vendor            | Amount       | Notes
------------|-------------------|--------------|----------------------------------
`;
  
  for (const payment of sorted) {
    const date = payment.date || 'N/A';
    const vendor = (payment.vendor || 'N/A').padEnd(18);
    // Format negative amounts as -M$X,XXX.XX
    const amount = payment.amount < 0 
      ? `-${formatAmount(Math.abs(payment.amount || 0))}`.padStart(12)
      : formatAmount(payment.amount || 0).padStart(12);
    const notes = payment.notes || '';
    
    table += `${date}  | ${vendor} | ${amount} | ${notes}\n`;
  }
  
  table += `--------------------------------------------------------------------------------
                      TOTAL: -${formatAmount(total)} (${payments.length} transaction${payments.length !== 1 ? 's' : ''})
`;
  
  return table;
}

/**
 * Format summary section
 * @param {Object} project - Project document
 * @returns {string} Formatted summary
 */
function formatSummary(project) {
  const totalCollected = project.totalCollected || 0;
  const totalPaid = project.totalPaid || 0;
  const balance = project.balance || 0;
  const balanceStatus = balance >= 0 ? '✅' : '⚠️';
  
  return `SUMMARY
--------------------------------------------------------------------------------
Total Collected:  ${formatAmount(totalCollected)}
Total Paid:       ${formatAmount(totalPaid)}
Balance:          ${formatAmount(balance)} ${balanceStatus}
`;
}

/**
 * Format unit assessments table
 * @param {Object} unitAssessments - Unit assessments map
 * @returns {string} Formatted unit assessments table
 */
function formatUnitAssessments(unitAssessments) {
  if (!unitAssessments || Object.keys(unitAssessments).length === 0) {
    return `UNIT ASSESSMENTS
--------------------------------------------------------------------------------
No unit assessments found
--------------------------------------------------------------------------------
`;
  }
  
  // Sort units by unitId
  const units = Object.values(unitAssessments).sort((a, b) => {
    return (a.unitId || '').localeCompare(b.unitId || '');
  });
  
  let table = `UNIT ASSESSMENTS
--------------------------------------------------------------------------------
Unit  | Expected    | Paid        | Status
------|-------------|-------------|--------
`;
  
  for (const unit of units) {
    const unitId = (unit.unitId || 'N/A').padEnd(5);
    
    let expected, paid, status;
    
    if (unit.exempt) {
      expected = 'EXEMPT'.padStart(12);
      paid = 'EXEMPT'.padStart(12);
      status = `🚫 ${unit.notes || 'Exempt'}`;
    } else {
      expected = formatAmount(unit.expectedAmount || 0).padStart(12);
      paid = formatAmount(unit.actualPaid || 0).padStart(12);
      
      if (unit.expectedAmount === unit.actualPaid) {
        status = '✅ Paid';
      } else if ((unit.actualPaid || 0) > (unit.expectedAmount || 0)) {
        status = '✅ Overpaid';
      } else if ((unit.actualPaid || 0) < (unit.expectedAmount || 0)) {
        status = '⚠️ Underpaid';
      } else {
        status = '❓ Unknown';
      }
    }
    
    table += `${unitId} | ${expected} | ${paid} | ${status}\n`;
  }
  
  table += `--------------------------------------------------------------------------------
`;
  
  return table;
}

/**
 * Display a single project
 * @param {Object} project - Project document
 */
function displayProject(project) {
  const output = formatProjectHeader(project) +
    formatCollectionsTable(project.collections || []) + '\n' +
    formatPaymentsTable(project.payments || []) + '\n' +
    formatSummary(project) + '\n' +
    formatUnitAssessments(project.unitAssessments || {}) +
    '================================================================================\n';
  
  console.log(output);
}

/**
 * Main function to display projects
 * @param {string} projectId - Optional projectId to display single project
 */
async function displayProjects(projectId = null) {
  try {
    console.log('📊 Loading projects from Firestore...\n');
    
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    const projectsRef = db.collection('clients').doc('MTC').collection('projects');
    
    if (projectId) {
      // Display single project
      const projectDoc = await projectsRef.doc(projectId).get();
      
      if (!projectDoc.exists) {
        console.error(`❌ Project not found: ${projectId}`);
        process.exit(1);
      }
      
      const project = { id: projectDoc.id, ...projectDoc.data() };
      displayProject(project);
    } else {
      // Display all projects
      const projectsSnapshot = await projectsRef.get();
      
      if (projectsSnapshot.empty) {
        console.log('No projects found in Firestore.');
        process.exit(0);
      }
      
      const projects = [];
      projectsSnapshot.forEach(doc => {
        projects.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort projects by startDate
      projects.sort((a, b) => {
        const dateA = new Date(a.startDate || '');
        const dateB = new Date(b.startDate || '');
        return dateA - dateB;
      });
      
      console.log(`Found ${projects.length} project(s):\n`);
      
      for (const project of projects) {
        displayProject(project);
        console.log('\n'); // Extra spacing between projects
      }
    }
    
    console.log('✅ Display complete\n');
    
  } catch (error) {
    console.error('❌ Error displaying projects:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const projectId = process.argv[2] || null;
  displayProjects(projectId)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { displayProjects, formatAmount, sortByDate, displayProject };

