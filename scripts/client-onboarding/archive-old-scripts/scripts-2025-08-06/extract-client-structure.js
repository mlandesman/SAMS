import { initializeFirebase } from './utils/environment-config.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
const { db } = await initializeFirebase();

async function extractClientStructure(clientId) {
  try {
    console.log(`📋 Extracting complete structure for client: ${clientId}`);
    
    // Get main client document
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    console.log('✅ Found client document');
    
    // Extract main document data
    const clientData = {
      _documentId: clientId,
      ...clientDoc.data()
    };
    
    // Get config subcollection documents
    console.log('📂 Extracting config subcollection...');
    const configRef = clientRef.collection('config');
    const configDocs = await configRef.get();
    
    clientData._config = {};
    for (const doc of configDocs.docs) {
      console.log(`  - Found config/${doc.id}`);
      clientData._config[doc.id] = doc.data();
    }
    
    // Remove sensitive or environment-specific data
    const sanitizedData = sanitizeForTemplate(clientData);
    
    // Save to file
    const outputPath = path.join(__dirname, `${clientId.toLowerCase()}-structure.json`);
    await fs.writeFile(
      outputPath, 
      JSON.stringify(sanitizedData, null, 2)
    );
    
    console.log(`\n✅ Structure saved to: ${outputPath}`);
    
    // Also create a template version
    const templateData = createGenericTemplate(sanitizedData);
    const templatePath = path.join(__dirname, `client-structure-template.json`);
    await fs.writeFile(
      templatePath,
      JSON.stringify(templateData, null, 2)
    );
    
    console.log(`✅ Generic template saved to: ${templatePath}`);
    
  } catch (error) {
    console.error('❌ Error extracting client structure:', error);
    process.exit(1);
  }
}

function sanitizeForTemplate(data) {
  // Create a deep copy
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // Remove timestamps and system fields
  delete sanitized.created;
  delete sanitized.updated;
  delete sanitized.lastModified;
  
  // Keep structure but clear sensitive values
  if (sanitized.basicInfo) {
    // Keep all field names but clear some values
    if (sanitized.basicInfo.email) {
      sanitized.basicInfo.email = "client@example.com";
    }
    if (sanitized.basicInfo.phone) {
      sanitized.basicInfo.phone = "+52 999 999 9999";
    }
  }
  
  return sanitized;
}

function createGenericTemplate(data) {
  // Create a deep copy
  const template = JSON.parse(JSON.stringify(data));
  
  // Replace MTC-specific values with placeholders
  const replacements = {
    'MTC': 'CLIENT_ID',
    'MTC Property Management': 'CLIENT_FULL_NAME',
    'Marina Turquesa Condominium': 'CLIENT_FULL_NAME',
    'pm@sandyland.com.mx': 'contact@YOUR_DOMAIN.com',
    'marissa@mtcpropertiesmanagement.com': 'admin@YOUR_DOMAIN.com',
    'Puerto Aventuras, Quintana Roo, México': 'YOUR_ADDRESS',
    'Sandyland Properties': 'YOUR_COMPANY_NAME',
    'Sandra Landesman': 'YOUR_NAME',
    '+52 994 238 8224': 'YOUR_PHONE'
  };
  
  // Recursively replace values
  function replaceValues(obj) {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        for (let [search, replace] of Object.entries(replacements)) {
          if (obj[key].includes(search)) {
            obj[key] = obj[key].replace(new RegExp(search, 'g'), replace);
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        replaceValues(obj[key]);
      }
    }
  }
  
  replaceValues(template);
  
  // Update document ID
  template._documentId = 'CLIENT_ID';
  
  // Add instructions
  template._instructions = {
    "README": "Replace all placeholder values with actual client data",
    "CLIENT_ID": "Use the client's short identifier (e.g., MTC, AVII)",
    "CLIENT_FULL_NAME": "Use the client's full legal name",
    "YOUR_DOMAIN.com": "Replace with actual domain",
    "YOUR_ADDRESS": "Replace with actual address",
    "YOUR_COMPANY_NAME": "Replace with management company name",
    "YOUR_NAME": "Replace with contact person name",
    "YOUR_PHONE": "Replace with contact phone"
  };
  
  return template;
}

// Run if called directly
const clientId = process.argv[2] || 'MTC';

extractClientStructure(clientId)
  .then(() => {
    console.log('\n🎉 Extraction complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });

export { extractClientStructure };