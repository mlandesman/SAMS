/**
 * Generate Requested PDFs for Review
 * MTC: 1B, PH2B, PH4D, 2A (English)
 * AVII: 106, 203, 201 (Spanish)
 */

import { testHarness } from './testHarness.js';
import { generateStatementHtml } from '../services/statementHtmlService.js';
import { generatePdf } from '../services/pdfService.js';
import fs from 'fs';

const units = [
  // MTC Units (English)
  { clientId: 'MTC', unitId: '1B', language: 'english' },
  { clientId: 'MTC', unitId: 'PH2B', language: 'english' },
  { clientId: 'MTC', unitId: 'PH4D', language: 'english' },
  { clientId: 'MTC', unitId: '2A', language: 'english' },
  
  // AVII Units (Spanish)
  { clientId: 'AVII', unitId: '106', language: 'spanish' },
  { clientId: 'AVII', unitId: '203', language: 'spanish' },
  { clientId: 'AVII', unitId: '201', language: 'spanish' },
];

await testHarness.runTest({
  name: 'Generate All Requested Unit Statements',
  async test({ api }) {
    console.log('\n' + '═'.repeat(80));
    console.log('GENERATING STATEMENTS FOR REVIEW');
    console.log('═'.repeat(80));
    
    let successCount = 0;
    let failCount = 0;
    
    for (const unit of units) {
      console.log(`\n📄 ${unit.clientId} Unit ${unit.unitId} (${unit.language})...`);
      
      try {
        const html = await generateStatementHtml(api, unit.clientId, unit.unitId, { 
          language: unit.language 
        });
        
        const htmlPath = `/Users/michael/Projects/SAMS/test-results/statement_${unit.clientId}_${unit.unitId}_${unit.language}.html`;
        fs.writeFileSync(htmlPath, html);
        
        const pdf = await generatePdf(html);
        const pdfPath = `/Users/michael/Projects/SAMS/test-results/statement_${unit.clientId}_${unit.unitId}_${unit.language}.pdf`;
        fs.writeFileSync(pdfPath, pdf);
        
        console.log(`   ✅ HTML: ${(html.length / 1024).toFixed(1)} KB`);
        console.log(`   ✅ PDF:  ${(pdf.length / 1024).toFixed(1)} KB`);
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        failCount++;
      }
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('SUMMARY');
    console.log('═'.repeat(80));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`\n📁 All files saved to: /Users/michael/Projects/SAMS/test-results/`);
    
    return { passed: true, summary: `${successCount}/${units.length} generated` };
  }
});

