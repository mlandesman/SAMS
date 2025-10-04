#!/usr/bin/env node

console.log('Script started');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);
console.log('Expected:', `file://${process.argv[1]}`);
console.log('Match:', import.meta.url === `file://${process.argv[1]}`);

// Import the units script
import('./import-units-enhanced.js').then(() => {
  console.log('Import completed');
}).catch(err => {
  console.error('Import error:', err);
});