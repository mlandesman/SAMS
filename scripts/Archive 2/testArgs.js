// Simple test script to debug the issue
console.log('Script starting...');

try {
  console.log('Arguments:', process.argv);
  
  const args = process.argv.slice(2);
  console.log('Parsed args:', args);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Help requested - showing help');
    console.log(`
📈 SAMS Exchange Rates Bulk Import Tool

Usage: node bulkImportExchangeRates.js [options]

Options:
  --help, -h                      Show this help message
    `);
    process.exit(0);
  }
  
  console.log('No help requested, would proceed with import...');
  
} catch (error) {
  console.error('Error in script:', error);
  process.exit(1);
}
