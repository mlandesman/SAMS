#!/usr/bin/env node

/**
 * Interactive Client Setup Tool
 * 
 * Purpose: Collect client information interactively to create a new SAMS client
 * Future: Will evolve into a dynamic mapping tool for various data formats
 */

import readline from 'readline';
import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';
import fs from 'fs/promises';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

// Color helper functions
const blue = (text) => `${colors.blue}${text}${colors.reset}`;
const green = (text) => `${colors.green}${text}${colors.reset}`;
const yellow = (text) => `${colors.yellow}${text}${colors.reset}`;
const red = (text) => `${colors.red}${text}${colors.reset}`;
const gray = (text) => `${colors.gray}${text}${colors.reset}`;
const bold = (text) => `${colors.bright}${text}${colors.reset}`;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
const question = (prompt, defaultValue = '') => {
  const displayPrompt = defaultValue ? `${prompt} [${gray(defaultValue)}]: ` : `${prompt}: `;
  return new Promise((resolve) => {
    rl.question(displayPrompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
};

// Helper function for yes/no questions
const confirm = async (prompt, defaultValue = true) => {
  const defaultText = defaultValue ? 'Y/n' : 'y/N';
  const answer = await question(`${prompt} (${defaultText})`, defaultValue ? 'y' : 'n');
  return answer.toLowerCase() === 'y';
};

// Helper function for multi-choice questions
const select = async (prompt, options, defaultIndex = 0) => {
  console.log(`\n${prompt}`);
  options.forEach((option, index) => {
    const marker = index === defaultIndex ? green('►') : ' ';
    console.log(`${marker} ${index + 1}. ${option}`);
  });
  
  const answer = await question('\nSelect option', (defaultIndex + 1).toString());
  const index = parseInt(answer) - 1;
  
  if (index >= 0 && index < options.length) {
    return options[index];
  }
  return options[defaultIndex];
};

// Helper to collect array data
const collectArray = async (itemName, promptForItem) => {
  const items = [];
  let addMore = true;
  
  while (addMore) {
    const add = await confirm(`Add ${itemName}?`, items.length === 0);
    if (!add) break;
    
    const item = await promptForItem();
    if (item) items.push(item);
    
    addMore = items.length < 10; // Reasonable limit
  }
  
  return items;
};

// Main setup function
async function setupClient() {
  console.clear();
  console.log(blue('═══════════════════════════════════════════════════'));
  console.log(blue(bold('        SAMS Interactive Client Setup Tool         ')));
  console.log(blue('═══════════════════════════════════════════════════'));
  console.log(gray('\nThis tool will help you create a new client in SAMS'));
  console.log(gray('Press Ctrl+C at any time to cancel\n'));

  try {
    // Initialize Firebase
    const environment = await select('Select environment', ['dev', 'staging', 'prod'], 0);
    const { db } = await initializeFirebase(environment);
    printEnvironmentInfo(environment);

    // Collect client data
    const clientData = {
      basicInfo: {},
      contactInfo: {},
      propertyInfo: null,
      branding: {},
      configuration: {},
      governance: null,
      feeStructure: null,
      documents: {},
      emergencyContacts: [],
      metadata: {},
      status: 'active',
      updated: getCurrentTimestamp()
    };

    console.log(yellow('\n📋 Basic Information\n'));
    
    // Client ID
    const clientId = await question('Client ID (uppercase, no spaces)', 'MTC');
    const clientIdUpper = clientId.toUpperCase().replace(/\s+/g, '');
    
    // Basic Info
    clientData.basicInfo.fullName = await question('Full legal name', 'Marina Turquesa Condominiums A.C.');
    clientData.basicInfo.displayName = await question('Display name', clientIdUpper);
    
    const clientTypes = ['HOA', 'Condo', 'SingleFamily', 'Commercial'];
    clientData.basicInfo.clientType = await select('Client type', clientTypes, 0);
    
    // Legal type based on client type
    const legalTypes = clientData.basicInfo.clientType === 'HOA' || clientData.basicInfo.clientType === 'Condo' 
      ? ['AC', 'SC', 'Trust'] 
      : ['Individual', 'LLC', 'Corporation', 'Trust'];
    clientData.basicInfo.legalType = await select('Legal entity type', legalTypes, 0);
    
    clientData.basicInfo.taxId = await question('Tax ID (RFC)', '');
    clientData.basicInfo.description = await question('Brief description', 'Property management client');
    
    const establishedDate = await question('Established date (YYYY-MM-DD)', '2005-01-01');
    clientData.basicInfo.established = getCurrentTimestamp(new Date(establishedDate));

    console.log(yellow('\n📞 Contact Information\n'));
    
    // Contact Info
    clientData.contactInfo.primaryEmail = await question('Primary email', 'admin@example.com');
    clientData.contactInfo.secondaryEmail = await question('Secondary email (optional)', '');
    clientData.contactInfo.phone = await question('Primary phone', '+52 984-000-0000');
    clientData.contactInfo.alternatePhone = await question('Alternate phone (optional)', '') || null;
    
    console.log(gray('\nPhysical Address:'));
    clientData.contactInfo.address = {
      street: await question('Street address', ''),
      city: await question('City', 'Playa del Carmen'),
      state: await question('State/Province', 'QR'),
      postalCode: await question('Postal code', '77710'),
      country: await question('Country code', 'MX')
    };
    
    const hasDifferentMailing = await confirm('Different mailing address?', false);
    if (hasDifferentMailing) {
      console.log(gray('\nMailing Address:'));
      clientData.contactInfo.mailingAddress = {
        street: await question('Street address', ''),
        city: await question('City', clientData.contactInfo.address.city),
        state: await question('State/Province', clientData.contactInfo.address.state),
        postalCode: await question('Postal code', ''),
        country: await question('Country code', clientData.contactInfo.address.country)
      };
    } else {
      clientData.contactInfo.mailingAddress = null;
    }
    
    clientData.contactInfo.website = await question('Website (optional)', '') || null;

    // Property Info (for HOAs/Condos)
    if (clientData.basicInfo.clientType === 'HOA' || clientData.basicInfo.clientType === 'Condo') {
      console.log(yellow('\n🏢 Property Information\n'));
      
      clientData.propertyInfo = {
        totalUnits: parseInt(await question('Total number of units', '24')) || 24,
        buildings: parseInt(await question('Number of buildings', '1')) || 1,
        yearBuilt: parseInt(await question('Year built', '2005')) || 2005,
        propertyType: await select('Property type', ['Highrise', 'Townhomes', 'SingleFamily', 'Mixed'], 0),
        amenities: [],
        commonAreas: [],
        parkingSpaces: {}
      };
      
      // Amenities
      const commonAmenities = ['Pool', 'Gym', 'Beach Access', 'Security', 'Parking', 'Garden', 'Clubhouse'];
      console.log(gray('\nSelect amenities (y/n for each):'));
      for (const amenity of commonAmenities) {
        if (await confirm(`  ${amenity}?`, false)) {
          clientData.propertyInfo.amenities.push(amenity);
        }
      }
      
      // Common areas
      clientData.propertyInfo.commonAreas = await collectArray('common area', async () => {
        const name = await question('Area name', '');
        if (!name) return null;
        return {
          name,
          description: await question('Description', ''),
          maintenanceSchedule: await question('Maintenance schedule', 'Weekly')
        };
      });
      
      // Parking
      const totalParking = parseInt(await question('Total parking spaces', '48')) || 0;
      if (totalParking > 0) {
        clientData.propertyInfo.parkingSpaces = {
          total: totalParking,
          guest: parseInt(await question('Guest parking spaces', '6')) || 0,
          assigned: parseInt(await question('Assigned parking spaces', (totalParking - 6).toString())) || totalParking - 6
        };
      }
    }

    console.log(yellow('\n🎨 Branding\n'));
    
    // Branding
    clientData.branding = {
      logoUrl: await question('Logo URL (optional)', '') || null,
      iconUrl: await question('Icon URL (optional)', '') || null,
      brandColors: {
        primary: await question('Primary color (hex)', '#2563eb'),
        secondary: await question('Secondary color (hex)', '#64748b'),
        accent: await question('Accent color (hex)', '#10b981'),
        danger: await question('Danger color (hex)', '#ef4444'),
        success: await question('Success color (hex)', '#22c55e')
      },
      customCSS: null
    };

    console.log(yellow('\n⚙️ Configuration\n'));
    
    // Configuration
    clientData.configuration = {
      timezone: await select('Timezone', ['America/Cancun', 'America/Mexico_City', 'America/New_York', 'America/Los_Angeles'], 0),
      currency: await select('Currency', ['MXN', 'USD', 'CAD', 'EUR'], 0),
      language: await select('Language', ['en', 'es', 'fr'], 0),
      locale: await select('Locale', ['en-US', 'es-MX', 'fr-CA'], 0),
      dateFormat: await select('Date format', ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'], 1),
      fiscalYearStart: await select('Fiscal year starts', ['january', 'april', 'july', 'october'], 0),
      accountingMethod: await select('Accounting method', ['cash', 'accrual'], 0)
    };

    // Emergency Contacts
    console.log(yellow('\n🚨 Emergency Contacts\n'));
    
    clientData.emergencyContacts = await collectArray('emergency contact', async () => {
      const type = await question('Contact type (Security/Medical/Fire/Maintenance)', 'Security');
      const name = await question('Contact name', '');
      if (!name) return null;
      
      return {
        type,
        name,
        phone: await question('Phone', ''),
        alternatePhone: await question('Alternate phone (optional)', '') || null,
        email: await question('Email (optional)', '') || null,
        available: await select('Availability', ['24/7', 'Business Hours', 'On Call'], 0),
        notes: await question('Notes (optional)', '') || null
      };
    });

    // Metadata
    clientData.metadata = {
      version: 1,
      createdBy: 'interactive-setup',
      createdAt: getCurrentTimestamp(),
      lastModifiedBy: 'interactive-setup',
      lastModified: getCurrentTimestamp(),
      dataSource: 'interactive',
      importBatch: null
    };

    // HOA-specific governance and fees
    if (clientData.basicInfo.clientType === 'HOA' || clientData.basicInfo.clientType === 'Condo') {
      const addGovernance = await confirm('\nAdd governance information (board members, committees)?', false);
      if (addGovernance) {
        console.log(yellow('\n👥 Governance\n'));
        
        clientData.governance = {
          boardMembers: [],
          committees: [],
          meetingSchedule: {},
          managementCompany: null
        };
        
        // Add board members
        clientData.governance.boardMembers = await collectArray('board member', async () => {
          const name = await question('Member name', '');
          if (!name) return null;
          
          return {
            name,
            position: await select('Position', ['President', 'Vice President', 'Treasurer', 'Secretary', 'Director'], 0),
            email: await question('Email', ''),
            phone: await question('Phone', ''),
            termStart: getCurrentTimestamp(new Date(await question('Term start (YYYY-MM-DD)', '2024-01-01'))),
            termEnd: getCurrentTimestamp(new Date(await question('Term end (YYYY-MM-DD)', '2025-12-31'))),
            isPrimary: await confirm('Primary contact?', false)
          };
        });
        
        // Meeting schedule
        clientData.governance.meetingSchedule = {
          annualMeeting: await select('Annual meeting month', 
            ['January', 'February', 'March', 'April', 'May', 'June', 
             'July', 'August', 'September', 'October', 'November', 'December'], 2),
          boardMeetings: await select('Board meeting frequency', ['Monthly', 'Quarterly', 'Semi-Annual'], 0),
          dayOfMonth: parseInt(await question('Meeting day of month', '15')) || 15
        };
      }
      
      const addFeeStructure = await confirm('\nAdd fee structure information?', false);
      if (addFeeStructure) {
        console.log(yellow('\n💰 Fee Structure\n'));
        
        clientData.feeStructure = {
          duesFrequency: await select('Dues frequency', ['monthly', 'quarterly', 'annual'], 0),
          lateFeePolicy: {
            gracePeriodDays: parseInt(await question('Grace period (days)', '10')) || 10,
            lateFeeAmount: parseInt(await question('Late fee amount (in cents)', '50000')) || 0,
            lateFeePercent: parseFloat(await question('Late fee percent (0 for none)', '0')) || 0,
            interestRate: parseFloat(await question('Annual interest rate on overdue (0 for none)', '0')) || 0
          },
          specialAssessments: [],
          paymentMethods: [],
          bankDetails: null
        };
        
        // Payment methods
        const methods = ['cash', 'check', 'transfer', 'card', 'paypal'];
        console.log(gray('\nAccepted payment methods:'));
        for (const method of methods) {
          if (await confirm(`  ${method}?`, method === 'transfer' || method === 'cash')) {
            clientData.feeStructure.paymentMethods.push(method);
          }
        }
      }
    }

    // Review and confirm
    console.log(yellow('\n📋 Review Client Information\n'));
    console.log(colors.white + 'Client ID: ' + colors.reset + green(clientIdUpper));
    console.log(colors.white + 'Name: ' + colors.reset + green(clientData.basicInfo.fullName));
    console.log(colors.white + 'Type: ' + colors.reset + green(clientData.basicInfo.clientType));
    console.log(colors.white + 'Email: ' + colors.reset + green(clientData.contactInfo.primaryEmail));
    console.log(colors.white + 'Phone: ' + colors.reset + green(clientData.contactInfo.phone));
    if (clientData.propertyInfo) {
      console.log(colors.white + 'Units: ' + colors.reset + green(clientData.propertyInfo.totalUnits));
    }
    console.log(colors.white + 'Status: ' + colors.reset + green(clientData.status));

    const saveToFile = await confirm('\nSave configuration to file?', true);
    if (saveToFile) {
      const filename = `${clientIdUpper}_client_config_${new Date().toISOString().split('T')[0]}.json`;
      await fs.writeFile(filename, JSON.stringify(clientData, null, 2));
      console.log(green(`\n✅ Configuration saved to: ${filename}`));
    }

    const createInFirebase = await confirm('\nCreate client in Firebase?', true);
    if (createInFirebase) {
      console.log(yellow('\n🔄 Creating client in Firebase...\n'));
      
      const clientRef = db.collection('clients').doc(clientIdUpper);
      const existing = await clientRef.get();
      
      if (existing.exists) {
        const overwrite = await confirm('Client already exists. Update?', false);
        if (!overwrite) {
          console.log(red('\n❌ Client creation cancelled'));
          return;
        }
        await clientRef.update(clientData);
        console.log(green('\n✅ Client updated successfully!'));
      } else {
        await clientRef.set(clientData);
        console.log(green('\n✅ Client created successfully!'));
      }
      
      console.log(blue(`\nClient ID: ${clientIdUpper}`));
      console.log(gray('You can now import data for this client.\n'));
    }

  } catch (error) {
    console.error(red('\n❌ Error:'), error.message);
  } finally {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(yellow('\n\n👋 Setup cancelled by user'));
  process.exit(0);
});

// Run the setup
setupClient().catch(console.error);