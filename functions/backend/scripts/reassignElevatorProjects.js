// Reassign all elevator transactions to single project
import fs from 'fs';

const csvPath = '/Users/michael/Projects/SAMS-Docs/apm_session/Memory/Task_Completion_Logs/Projects_P-1_Transaction_Inventory.csv';
const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.trim().split('\n');
const header = lines[0];
const dataLines = lines.slice(1);

// Parse and update transactions
const updatedLines = [header];
dataLines.forEach(line => {
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
  parts.push(current);
  
  const categoryId = parts[4]?.replace(/""/g, '"').replace(/^"/, '').replace(/"$/, '') || '';
  const notes = parts[8]?.replace(/""/g, '"').replace(/^"/, '').replace(/"$/, '') || '';
  const type = parts[9] || 'deposit';
  
  let projectId = parts[10]?.replace(/""/g, '"').replace(/^"/, '').replace(/"$/, '') || '';
  
  // Reassign all elevator transactions to single project
  if (categoryId === 'projects-elevator-refurb-2023' || 
      (categoryId === 'special-assessments' && notes.toLowerCase().includes('elevator'))) {
    projectId = 'elevator-refurb-2023-2024';
  }
  
  // Rebuild the line with updated projectId
  parts[10] = projectId ? `"${projectId}"` : '';
  updatedLines.push(parts.join(','));
});

// Write updated CSV
fs.writeFileSync(csvPath, updatedLines.join('\n') + '\n', 'utf8');

console.log('✅ Reassigned all elevator transactions to elevator-refurb-2023-2024');

