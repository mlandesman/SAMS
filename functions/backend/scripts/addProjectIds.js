// Script to add projectId column to transaction inventory CSV
// Run with: node backend/scripts/addProjectIds.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = '/Users/michael/Projects/SAMS-Docs/apm_session/Memory/Task_Completion_Logs/Projects_P-1_Transaction_Inventory.csv';

// The 7 projects with their date ranges and keywords
const PROJECTS = [
  {
    projectId: 'elevator-major-repair-2023',
    name: 'Elevator Major Repair',
    date: '2023-09-20',
    vendor: 'Irbin',
    dateRange: { start: '2023-09-01', end: '2023-11-30' },
    keywords: ['elevator', 'irbin', 'major repair', 'assessment 1', 'assessment 2']
  },
  {
    projectId: 'elevator-variator-2023',
    name: 'Elevator Variator',
    date: '2023-11-07',
    vendor: 'Irbin',
    dateRange: { start: '2023-10-01', end: '2023-12-31' },
    keywords: ['elevator', 'irbin', 'variator']
  },
  {
    projectId: 'elevator-modernization-2024',
    name: 'Elevator Modernization',
    date: '2024-03-29',
    vendor: 'Vertical City',
    dateRange: { start: '2024-02-01', end: '2024-05-31' },
    keywords: ['elevator', 'modernization', 'vertical city', 'vc', 'refurb', 'assessment #3']
  },
  {
    projectId: 'elevator-motor-variator-2024',
    name: 'Elevator Motor & Variator',
    date: '2024-04-23',
    vendor: 'Vertical City',
    dateRange: { start: '2024-03-01', end: '2024-06-30' },
    keywords: ['elevator', 'motor', 'variator', 'vertical city']
  },
  {
    projectId: 'roof-water-sealing-2024',
    name: 'Roof Water Sealing',
    date: '2024-08-07',
    vendor: 'Omar Peña',
    dateRange: { start: '2024-07-01', end: '2024-09-30' },
    keywords: ['roof', 'sealing', 'omar peña', 'omar pena']
  },
  {
    projectId: 'propane-pipes-2025',
    name: 'Propane Pipes',
    date: '2025-02-15',
    vendor: 'Jorge Juan Perez',
    dateRange: { start: '2025-01-01', end: '2025-03-31' },
    keywords: ['propane', 'pipes', 'propane lines', 'jorge juan']
  },
  {
    projectId: 'column-repairs-2025',
    name: 'Column Repairs',
    date: '2025-03-29',
    vendor: 'Jorge Juan Perez',
    dateRange: { start: '2025-02-01', end: '2025-05-31' },
    keywords: ['column', 'repairs', 'jorge juan']
  }
];

/**
 * Parse date from CSV format
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return null;
  return new Date(dateStr);
}

/**
 * Get projectId from categoryId for expenses
 */
function getProjectIdFromCategoryId(categoryId) {
  if (!categoryId || !categoryId.startsWith('projects-')) return null;
  
  // Map categoryId patterns to projectIds
  if (categoryId.includes('column')) return 'column-repairs-2025';
  if (categoryId.includes('propane')) return 'propane-pipes-2025';
  if (categoryId.includes('roof')) return 'roof-water-sealing-2024';
  if (categoryId.includes('elevator')) {
    // Need to distinguish between elevator projects
    if (categoryId.includes('2023')) {
      // Could be major repair or variator - need date/notes
      return null; // Will match by date/keywords
    }
    // 2024 elevator projects
    return null; // Will match by date/keywords
  }
  
  return null;
}

/**
 * Match collection to project based on notes and date
 */
function matchCollectionToProject(transaction, allTransactions) {
  const txDate = parseDate(transaction.date);
  if (!txDate) return null;
  
  const notes = (transaction.notes || '').toLowerCase();
  const vendor = (transaction.vendor || '').toLowerCase();
  
  // Find matching project by keywords and date
  let bestMatch = null;
  let bestScore = 0;
  
  for (const project of PROJECTS) {
    let score = 0;
    
    // Check date range
    const txDateStr = txDate.toISOString().split('T')[0];
    const inDateRange = txDateStr >= project.dateRange.start && txDateStr <= project.dateRange.end;
    if (!inDateRange) continue;
    score += 10; // Base score for date match
    
    // Check keywords in notes
    const keywordMatches = project.keywords.filter(kw => 
      notes.includes(kw.toLowerCase()) || vendor.includes(kw.toLowerCase())
    );
    score += keywordMatches.length * 5;
    
    // Check vendor match
    if (vendor.includes(project.vendor.toLowerCase())) {
      score += 10;
    }
    
    // Check for specific project mentions
    if (notes.includes('propane pipes') || notes.includes('propane lines')) {
      if (project.projectId === 'propane-pipes-2025') score += 20;
    }
    if (notes.includes('column repairs')) {
      if (project.projectId === 'column-repairs-2025') score += 20;
    }
    if (notes.includes('roof') && notes.includes('sealing')) {
      if (project.projectId === 'roof-water-sealing-2024') score += 20;
    }
    if (notes.includes('elevator motor') && notes.includes('variator')) {
      if (project.projectId === 'elevator-motor-variator-2024') score += 20;
    }
    if (notes.includes('elevator modernization') || notes.includes('elevator refurb')) {
      if (project.projectId === 'elevator-modernization-2024') score += 20;
    }
    if (notes.includes('assessment 1') || notes.includes('assessment 2')) {
      if (project.projectId === 'elevator-major-repair-2023') score += 20;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = project.projectId;
    }
  }
  
  // If no good match, try date proximity to expenses
  if (bestScore < 15) {
    // Find expenses (payments) near this date
    const nearbyExpenses = allTransactions.filter(tx => {
      if (tx.type !== 'expense') return false;
      const expDate = parseDate(tx.date);
      if (!expDate) return false;
      const daysDiff = Math.abs((txDate - expDate) / (1000 * 60 * 60 * 24));
      return daysDiff <= 60; // Within 60 days
    });
    
    // Check if nearby expenses have projectIds
    const nearbyProjectIds = nearbyExpenses
      .map(tx => tx.projectId)
      .filter(id => id)
      .filter((id, index, arr) => arr.indexOf(id) === index); // unique
    
    if (nearbyProjectIds.length === 1) {
      return nearbyProjectIds[0];
    }
  }
  
  return bestScore >= 15 ? bestMatch : null;
}

/**
 * Add projectId column to CSV
 */
function addProjectIds() {
  // Read CSV
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = csvContent.trim().split('\n');
  const header = lines[0];
  const dataLines = lines.slice(1);
  
  // Parse transactions
  const transactions = dataLines.map(line => {
    // Handle CSV parsing (quoted fields)
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current); // Last field
    
    return {
      transactionId: parts[0],
      date: parts[1],
      amount: parseInt(parts[2]) || 0,
      amountPesos: parts[3],
      categoryId: parts[4]?.replace(/"/g, '') || '',
      categoryName: parts[5]?.replace(/"/g, '') || '',
      vendor: parts[6]?.replace(/"/g, '') || '',
      unitId: parts[7] || 'N/A',
      notes: parts[8]?.replace(/"/g, '') || '',
      type: parts[9] || 'deposit',
      projectId: null // Will be set
    };
  });
  
  // First pass: Set projectId for expenses (from categoryId)
  transactions.forEach(tx => {
    if (tx.type === 'expense' && tx.categoryId.startsWith('projects-')) {
      tx.projectId = getProjectIdFromCategoryId(tx.categoryId);
      
      // Handle specific categoryId mappings
      if (tx.categoryId === 'projects-column-repairs') {
        tx.projectId = 'column-repairs-2025';
      } else if (tx.categoryId === 'projects-propane-lines') {
        tx.projectId = 'propane-pipes-2025';
      } else if (tx.categoryId === 'projects-roof-sealing') {
        tx.projectId = 'roof-water-sealing-2024';
      } else if (tx.categoryId === 'projects-elevator-refurb-2023') {
        // Need to determine which elevator project - check date
        const txDate = parseDate(tx.date);
        if (txDate) {
          const txDateStr = txDate.toISOString().split('T')[0];
          if (txDateStr >= '2024-03-01' && txDateStr <= '2024-05-31') {
            tx.projectId = 'elevator-modernization-2024';
          } else if (txDateStr >= '2023-09-01' && txDateStr <= '2023-11-30') {
            tx.projectId = 'elevator-major-repair-2023';
          }
        }
      }
    }
  });
  
  // Second pass: Match collections to projects
  transactions.forEach(tx => {
    if (tx.type === 'deposit' && !tx.projectId) {
      tx.projectId = matchCollectionToProject(tx, transactions);
    }
  });
  
  // Generate new CSV with projectId column
  const newHeader = header + ',projectId';
  const newLines = [newHeader];
  
  transactions.forEach(tx => {
    const projectId = tx.projectId || '';
    newLines.push([
      tx.transactionId,
      tx.date,
      tx.amount,
      tx.amountPesos,
      `"${tx.categoryId}"`,
      `"${tx.categoryName}"`,
      `"${tx.vendor}"`,
      tx.unitId,
      `"${tx.notes}"`,
      tx.type,
      projectId ? `"${projectId}"` : ''
    ].join(','));
  });
  
  // Write updated CSV
  fs.writeFileSync(CSV_PATH, newLines.join('\n') + '\n', 'utf8');
  
  // Print summary
  console.log('✅ ProjectId assignment complete!');
  console.log(`\nSummary:`);
  const assigned = transactions.filter(tx => tx.projectId).length;
  const unassigned = transactions.filter(tx => !tx.projectId).length;
  console.log(`  Assigned: ${assigned} transactions`);
  console.log(`  Unassigned: ${unassigned} transactions (need manual review)`);
  
  if (unassigned > 0) {
    console.log(`\nUnassigned transactions:`);
    transactions.filter(tx => !tx.projectId).forEach(tx => {
      console.log(`  ${tx.transactionId}: ${tx.date}, ${tx.type}, "${tx.notes}"`);
    });
  }
  
  // Show breakdown by project
  console.log(`\nBreakdown by project:`);
  const projectCounts = {};
  transactions.forEach(tx => {
    const pid = tx.projectId || 'UNASSIGNED';
    projectCounts[pid] = (projectCounts[pid] || 0) + 1;
  });
  Object.keys(projectCounts).sort().forEach(pid => {
    console.log(`  ${pid}: ${projectCounts[pid]} transactions`);
  });
}

addProjectIds();

