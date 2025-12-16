// Script to extract Special Assessment and Projects transactions from MTC
// Run with: node backend/scripts/extractProjectTransactions.js

import { initializeFirebase, getDb } from '../firebase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output directory - use absolute path from task assignment
const OUTPUT_DIR = '/Users/michael/Projects/SAMS-Docs/apm_session/Memory/Task_Completion_Logs';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// The 7 projects to extract
const PROJECTS = [
  {
    name: 'Elevator Major Repair',
    date: '2023-09-20',
    vendor: 'Irbin',
    totalCost: 12833330, // in centavos
    perUnitAssessment: 1283300, // approximate
    dateRange: { start: '2023-09-01', end: '2023-11-30' },
    keywords: ['elevator', 'irbin', 'major repair']
  },
  {
    name: 'Elevator Variator',
    date: '2023-11-07',
    vendor: 'Irbin',
    totalCost: 5035900,
    perUnitAssessment: 559500,
    dateRange: { start: '2023-10-01', end: '2023-12-31' },
    keywords: ['elevator', 'irbin', 'variator']
  },
  {
    name: 'Elevator Modernization',
    date: '2024-03-29',
    vendor: 'Vertical City',
    totalCost: 11424100,
    perUnitAssessment: 858800,
    dateRange: { start: '2024-02-01', end: '2024-05-31' },
    keywords: ['elevator', 'vertical city', 'modernization']
  },
  {
    name: 'Elevator Motor & Variator',
    date: '2024-04-23',
    vendor: 'Vertical City',
    totalCost: 16140000,
    perUnitAssessment: 1614000,
    dateRange: { start: '2024-03-01', end: '2024-06-30' },
    keywords: ['elevator', 'vertical city', 'motor', 'variator']
  },
  {
    name: 'Roof Water Sealing',
    date: '2024-08-07',
    vendor: 'Omar Peña',
    totalCost: 13399500,
    perUnitAssessment: 1488800, // approximate, varies
    dateRange: { start: '2024-07-01', end: '2024-09-30' },
    keywords: ['roof', 'sealing', 'omar peña', 'water']
  },
  {
    name: 'Propane Pipes',
    date: '2025-02-15',
    vendor: 'Jorge Juan Perez',
    totalCost: 3350000,
    perUnitAssessment: 320000, // approximate, varies 3200-4200
    dateRange: { start: '2025-01-01', end: '2025-03-31' },
    keywords: ['propane', 'pipes', 'jorge juan', 'perez'],
    exemptUnits: ['2B'] // Unit 2B is exempt
  },
  {
    name: 'Column Repairs',
    date: '2025-03-29',
    vendor: 'Jorge Juan Perez',
    totalCost: 3300000,
    perUnitAssessment: 290000, // approximate, varies 2900-3800
    dateRange: { start: '2025-02-01', end: '2025-05-31' },
    keywords: ['column', 'repairs', 'jorge juan', 'perez'],
    exemptUnits: ['2B'] // Unit 2B is exempt
  }
];

/**
 * Convert centavos to pesos for display
 */
function centavosToPesos(centavos) {
  return (centavos / 100).toFixed(2);
}

/**
 * Format date from Firestore timestamp
 */
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString().split('T')[0];
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString().split('T')[0];
  }
  if (typeof timestamp === 'string') {
    return timestamp.split('T')[0];
  }
  return String(timestamp);
}

/**
 * Get date as Date object for comparison
 */
function getDateObject(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  return null;
}

/**
 * Extract vendor name from notes if not in vendor field
 */
function extractVendor(transaction) {
  const vendor = (transaction.vendor || '').trim();
  if (vendor) return vendor;
  
  const notes = (transaction.notes || '').toLowerCase();
  const vendors = ['jorge juan perez', 'irbin', 'vertical city', 'omar peña'];
  
  for (const v of vendors) {
    if (notes.includes(v.toLowerCase())) {
      return v;
    }
  }
  
  return '';
}

/**
 * Check if transaction matches project based on date range and keywords
 */
function matchesProject(transaction, project) {
  const txDateObj = getDateObject(transaction.date);
  if (!txDateObj) return false;
  
  const txDate = formatDate(transaction.date);
  const txNotes = (transaction.notes || '').toLowerCase();
  const txCategory = (transaction.category || '').toLowerCase();
  const txVendor = (transaction.vendor || '').toLowerCase();
  
  // Check date range
  const txDateStr = txDateObj.toISOString().split('T')[0];
  const inDateRange = txDateStr >= project.dateRange.start && txDateStr <= project.dateRange.end;
  
  if (!inDateRange) return false;
  
  // EASIEST: Check categoryId for vendor payments
  const categoryId = (transaction.categoryId || '').toLowerCase();
  if (categoryId) {
    // Map project names to categoryId patterns
    const projectCategoryMap = {
      'Elevator Major Repair': 'projects-elevator',
      'Elevator Variator': 'projects-elevator',
      'Elevator Modernization': 'projects-elevator',
      'Elevator Motor & Variator': 'projects-elevator',
      'Roof Water Sealing': 'projects-roof',
      'Propane Pipes': 'projects-propane',
      'Column Repairs': 'projects-column'
    };
    
    const expectedCategoryId = projectCategoryMap[project.name];
    if (expectedCategoryId && categoryId.includes(expectedCategoryId.replace('projects-', ''))) {
      return true;
    }
    
    // Direct match on categoryId
    if (project.name === 'Column Repairs' && categoryId === 'projects-column-repairs') return true;
    if (project.name === 'Propane Pipes' && (categoryId.includes('propane') || categoryId.includes('projects-propane'))) return true;
    if (project.name === 'Roof Water Sealing' && (categoryId.includes('roof') || categoryId.includes('sealing'))) return true;
    if (project.name.includes('Elevator') && categoryId.includes('elevator')) return true;
  }
  
  // For expenses (vendor payments), check for project-specific payment notes
  if (transaction.type === 'expense') {
    // Column Repairs vendor payments (generic "Project Started/Complete" notes)
    if (project.name === 'Column Repairs') {
      if (txNotes.includes('project started') || 
          txNotes.includes('project complete') || 
          txNotes.includes('final payment for initial project')) {
        return true;
      }
    }
    // Propane Pipes vendor payments
    if (project.name === 'Propane Pipes') {
      if (txNotes.includes('materials for pipe replacement') ||
          txNotes.includes('propane tank project') ||
          txNotes.includes('final payment propane')) {
        return true;
      }
    }
  }
  
  // Check keywords in notes (for unit deposits)
  const hasKeywords = project.keywords.some(keyword => 
    txNotes.includes(keyword.toLowerCase())
  );
  
  // Check vendor match
  const vendorMatch = txVendor.includes(project.vendor.toLowerCase());
  
  // Match if keywords found OR vendor matches
  return hasKeywords || vendorMatch;
}

/**
 * Extract all project-related transactions
 */
async function extractProjectTransactions() {
  try {
    console.log('🔥 Initializing Firebase...');
    await initializeFirebase();
    const db = await getDb();
    
    const clientId = 'MTC';
    console.log(`📊 Extracting transactions for client: ${clientId}`);
    
    // Get all transactions
    const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
    const transactionsSnapshot = await transactionsRef.get();
    
    console.log(`📋 Found ${transactionsSnapshot.size} total transactions`);
    
    // Filter for project-related transactions
    const projectTransactions = [];
    const specialAssessmentTx = [];
    const projectsCategoryTx = [];
    
    transactionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const notes = (data.notes || '').toLowerCase();
      
      // Check categoryId and categoryName fields (not just category)
      const categoryId = (data.categoryId || '').toLowerCase();
      const categoryName = (data.categoryName || '').toLowerCase();
      const category = (data.category || '').toLowerCase();
      
      const amount = data.amount || 0;
      const isExpense = amount < 0;
      
      // Capture ALL transactions with categoryId matching project criteria
      // 1. ALL transactions with categoryId === 'special-assessments'
      // 2. ALL transactions with categoryId.startsWith('projects-')
      const isSpecialAssessment = categoryId === 'special-assessments';
      const isProjectCategory = categoryId.startsWith('projects-');
      
      // EXCLUDE regular maintenance - these are NOT special projects
      // But allow if it has a project categoryId (don't exclude project maintenance)
      if (notes.includes('maintenance') && !notes.includes('project') && !isProjectCategory && !isSpecialAssessment) {
        return; // Skip regular maintenance payments
      }
      
      const isProjectRelated = isProjectCategory || isSpecialAssessment;
      
      if (!isProjectRelated) return;
      
      // Extract vendor from vendorName field or notes
      let vendor = data.vendorName || data.vendor || '';
      if (!vendor) {
        const notesLower = notes;
        if (notesLower.includes('irbin')) vendor = 'Irbin';
        else if (notesLower.includes('vertical city')) vendor = 'Vertical City';
        else if (notesLower.includes('jorge juan') || notesLower.includes('jorge juan perez')) vendor = 'Jorge Juan Perez';
        else if (notesLower.includes('omar peña') || notesLower.includes('omar pena')) vendor = 'Omar Peña';
        // For vendor payments (expenses with project category), try to infer vendor from project context
        else if (isExpense && isProjectCategory) {
          if (categoryId.includes('propane')) vendor = 'Jorge Juan Perez';
          else if (categoryId.includes('column')) vendor = 'Jorge Juan Perez';
          else if (categoryId.includes('roof')) vendor = 'Omar Peña';
          else if (categoryId.includes('elevator')) {
            // Could be Irbin or Vertical City - will need to check date ranges
            vendor = 'Unknown Elevator Vendor';
          }
        }
      }
      
      const transaction = {
        transactionId: doc.id,
        date: data.date,
        amount: data.amount || 0, // in centavos
        category: data.categoryName || data.category || '(no category)',
        categoryId: data.categoryId || '',
        vendor: vendor || data.vendorName || data.vendor || '',
        unitId: data.unitId || 'N/A',
        notes: data.notes || '',
        type: isExpense ? 'expense' : 'deposit',
        isSpecialAssessment: isSpecialAssessment,
        isProjectCategory: isProjectCategory
      };
      
      // Collect special-assessment deposits (from notes)
      if (isSpecialAssessment) {
        specialAssessmentTx.push(transaction);
      }
      
      // Collect Projects:* transactions (from categoryId or categoryName)
      if (isProjectCategory) {
        projectsCategoryTx.push(transaction);
      }
      
      // Always add if it's project-related
      if (!projectTransactions.find(tx => tx.transactionId === transaction.transactionId)) {
        projectTransactions.push(transaction);
      }
    });
    
    console.log(`✅ Found ${specialAssessmentTx.length} special-assessment transactions`);
    console.log(`✅ Found ${projectsCategoryTx.length} Projects:* transactions`);
    console.log(`📊 Total project-related transactions: ${projectTransactions.length}`);
    
    // Generate CSV output
    const csvLines = [
      'transactionId,date,amount,amountPesos,categoryId,categoryName,vendor,unitId,notes,type'
    ];
    
    projectTransactions.forEach(tx => {
      csvLines.push([
        tx.transactionId,
        formatDate(tx.date),
        tx.amount,
        centavosToPesos(tx.amount),
        `"${tx.categoryId || ''}"`,
        `"${tx.category || ''}"`,
        `"${tx.vendor || ''}"`,
        tx.unitId,
        `"${(tx.notes || '').replace(/"/g, '""')}"`,
        tx.type
      ].join(','));
    });
    
    const csvContent = csvLines.join('\n');
    const csvPath = path.join(OUTPUT_DIR, 'Projects_P-1_Transaction_Inventory.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log(`💾 CSV saved to: ${csvPath}`);
    
    // Match transactions to projects
    const projectMappings = {};
    
    PROJECTS.forEach(project => {
      projectMappings[project.name] = {
        project: project,
        collections: [], // deposits from units
        payments: []     // expenses to vendors
      };
    });
    
    // Match each transaction to a project
    projectTransactions.forEach(tx => {
      let matched = false;
      
      for (const project of PROJECTS) {
        if (matchesProject(tx, project)) {
          if (tx.type === 'deposit') {
            projectMappings[project.name].collections.push(tx);
          } else {
            projectMappings[project.name].payments.push(tx);
          }
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        // Store unmatched transactions for review
        if (!projectMappings['UNMATCHED']) {
          projectMappings['UNMATCHED'] = {
            project: { name: 'UNMATCHED', dateRange: { start: '1900-01-01', end: '2100-12-31' } },
            collections: [],
            payments: []
          };
        }
        if (tx.type === 'deposit') {
          projectMappings['UNMATCHED'].collections.push(tx);
        } else {
          projectMappings['UNMATCHED'].payments.push(tx);
        }
      }
    });
    
    // Generate project mapping report
    const mappingLines = [];
    mappingLines.push('# Project-Transaction Mapping\n');
    mappingLines.push(`Generated: ${new Date().toISOString()}\n`);
    
    Object.keys(projectMappings).forEach(projectName => {
      if (projectName === 'UNMATCHED') return; // Handle separately
      
      const mapping = projectMappings[projectName];
      const project = mapping.project;
      
      mappingLines.push(`## Project: ${project.name} (${project.date})`);
      mappingLines.push(`Total Cost: M$${centavosToPesos(project.totalCost)}`);
      mappingLines.push(`Vendor: ${project.vendor}`);
      mappingLines.push(`Per-Unit Assessment: M$${centavosToPesos(project.perUnitAssessment)}`);
      if (project.exemptUnits) {
        mappingLines.push(`Exempt Units: ${project.exemptUnits.join(', ')}`);
      }
      mappingLines.push('');
      
      // Collections (deposits from units)
      mappingLines.push('### Collections (Deposits from Units)');
      mappingLines.push('| Unit | Expected | TransactionId | Actual Paid | Date | Notes |');
      mappingLines.push('|------|----------|--------------|-------------|------|-------|');
      
      const totalCollected = mapping.collections.reduce((sum, tx) => sum + tx.amount, 0);
      
      mapping.collections.forEach(tx => {
        mappingLines.push([
          `| ${tx.unitId}`,
          `M$${centavosToPesos(project.perUnitAssessment)}`,
          tx.transactionId,
          `M$${centavosToPesos(tx.amount)}`,
          formatDate(tx.date),
          `"${(tx.notes || '').substring(0, 50)}${tx.notes && tx.notes.length > 50 ? '...' : ''}"`
        ].join(' | '));
      });
      
      if (mapping.collections.length === 0) {
        mappingLines.push('| *No collections found* | | | | | |');
      }
      
      mappingLines.push(`| **Total Collected** | | | **M$${centavosToPesos(totalCollected)}** | | |`);
      mappingLines.push('');
      
      // Payments (expenses to vendors)
      mappingLines.push('### Payments (Expenses to Vendor)');
      mappingLines.push('| TransactionId | Amount | Date | Vendor | Notes |');
      mappingLines.push('|--------------|--------|------|--------|-------|');
      
      const totalPaid = mapping.payments.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      mapping.payments.forEach(tx => {
        mappingLines.push([
          `| ${tx.transactionId}`,
          `M$${centavosToPesos(Math.abs(tx.amount))}`,
          formatDate(tx.date),
          tx.vendor,
          `"${(tx.notes || '').substring(0, 50)}${tx.notes && tx.notes.length > 50 ? '...' : ''}"`
        ].join(' | '));
      });
      
      if (mapping.payments.length === 0) {
        mappingLines.push('| *No payments found* | | | | |');
      }
      
      mappingLines.push(`| **Total Paid Out** | | | **M$${centavosToPesos(totalPaid)}** | |`);
      mappingLines.push('');
      
      // Balance check
      mappingLines.push('### Balance Check');
      mappingLines.push(`- Total Collected: M$${centavosToPesos(totalCollected)}`);
      mappingLines.push(`- Total Paid Out: M$${centavosToPesos(totalPaid)}`);
      const difference = totalCollected - totalPaid;
      mappingLines.push(`- Difference: M$${centavosToPesos(difference)} ${difference === 0 ? '✅' : '⚠️'}`);
      mappingLines.push('');
      mappingLines.push('---');
      mappingLines.push('');
    });
    
    // Add unmatched transactions section
    if (projectMappings['UNMATCHED']) {
      const unmatched = projectMappings['UNMATCHED'];
      mappingLines.push('## ⚠️ Unmatched Transactions (NEEDS MANUAL REVIEW)');
      mappingLines.push('');
      mappingLines.push(`**Collections:** ${unmatched.collections.length}`);
      mappingLines.push(`**Payments:** ${unmatched.payments.length}`);
      mappingLines.push('');
      
      if (unmatched.collections.length > 0) {
        mappingLines.push('### Unmatched Collections');
        unmatched.collections.forEach(tx => {
          mappingLines.push(`- ${tx.transactionId} | ${formatDate(tx.date)} | M$${centavosToPesos(tx.amount)} | ${tx.unitId} | "${tx.notes}"`);
        });
        mappingLines.push('');
      }
      
      if (unmatched.payments.length > 0) {
        mappingLines.push('### Unmatched Payments');
        unmatched.payments.forEach(tx => {
          mappingLines.push(`- ${tx.transactionId} | ${formatDate(tx.date)} | M$${centavosToPesos(Math.abs(tx.amount))} | ${tx.vendor} | "${tx.notes}"`);
        });
        mappingLines.push('');
      }
    }
    
    const mappingContent = mappingLines.join('\n');
    const mappingPath = path.join(OUTPUT_DIR, 'Projects_P-1_Project_Mapping.md');
    fs.writeFileSync(mappingPath, mappingContent, 'utf8');
    console.log(`💾 Project mapping saved to: ${mappingPath}`);
    
    // Summary statistics
    console.log('\n📊 Summary Statistics:');
    Object.keys(projectMappings).forEach(projectName => {
      if (projectName === 'UNMATCHED') return;
      const mapping = projectMappings[projectName];
      const totalCollected = mapping.collections.reduce((sum, tx) => sum + tx.amount, 0);
      const totalPaid = mapping.payments.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      console.log(`  ${projectName}:`);
      console.log(`    Collections: ${mapping.collections.length} transactions, M$${centavosToPesos(totalCollected)}`);
      console.log(`    Payments: ${mapping.payments.length} transactions, M$${centavosToPesos(totalPaid)}`);
    });
    
    if (projectMappings['UNMATCHED']) {
      const unmatched = projectMappings['UNMATCHED'];
      console.log(`  ⚠️  Unmatched: ${unmatched.collections.length + unmatched.payments.length} transactions`);
    }
    
    console.log('\n✅ Extraction complete!');
    
  } catch (error) {
    console.error('❌ Error extracting transactions:', error);
    process.exit(1);
  }
}

// Run extraction
extractProjectTransactions();

