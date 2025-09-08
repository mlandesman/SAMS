#!/usr/bin/env node

/**
 * Create MTC Client Document
 * This script creates the MTC client document needed before running other imports
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';

const CLIENT_ID = 'MTC';

async function createMTCClient() {
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase('dev');
    printEnvironmentInfo('dev');
    
    console.log('\n📝 Creating MTC client document...\n');
    
    // MTC Client data structure based on new field specifications
    const mtcClient = {
      // Basic Info
      basicInfo: {
        fullName: "Marina Turquesa Condominiums A.C.",
        displayName: "MTC",
        clientType: "HOA",
        legalType: "AC",
        taxId: "MTC123456789",
        description: "Luxury beachfront condominiums in Puerto Aventuras",
        established: getCurrentTimestamp(new Date('2005-03-15'))
      },
      
      // Contact Info
      contactInfo: {
        primaryEmail: "pm@sandyland.com.mx",
        secondaryEmail: "admin@mtc.com.mx",
        phone: "+52 984-178-0331",
        alternatePhone: null,
        address: {
          street: "Mza 20 Lote 12-13 Privada Xel-ha",
          city: "Puerto Aventuras",
          state: "QR",
          postalCode: "77733",
          country: "MX"
        },
        mailingAddress: null,
        website: "https://mtc.sandyland.com.mx"
      },
      
      // Property Info (for HOAs)
      propertyInfo: {
        totalUnits: 24,
        buildings: 2,
        yearBuilt: 2005,
        propertyType: "Highrise",
        amenities: ["Pool", "Beach Access", "Gym", "Security", "Parking"],
        commonAreas: [{
          name: "Pool Area",
          description: "Infinity pool with ocean view",
          maintenanceSchedule: "Weekly"
        }, {
          name: "Beach Access",
          description: "Private beach area with palapas",
          maintenanceSchedule: "Daily"
        }, {
          name: "Gym",
          description: "Fully equipped fitness center",
          maintenanceSchedule: "Daily"
        }],
        parkingSpaces: {
          total: 48,
          guest: 6,
          assigned: 42
        }
      },
      
      // Branding
      branding: {
        logoUrl: "https://storage.googleapis.com/sandyland-management-system.firebasestorage.app/logos/MTC/logo.png",
        iconUrl: "https://storage.googleapis.com/sandyland-management-system.firebasestorage.app/icons/MTC/icon.png",
        brandColors: {
          primary: "#2563eb",
          secondary: "#64748b",
          accent: "#10b981",
          danger: "#ef4444",
          success: "#22c55e"
        },
        customCSS: null
      },
      
      // Configuration
      configuration: {
        timezone: "America/Cancun",
        currency: "MXN",
        language: "en",
        locale: "en-US",
        dateFormat: "DD/MM/YYYY",
        fiscalYearStart: "january",
        accountingMethod: "cash"
      },
      
      // Governance (for HOAs)
      governance: {
        boardMembers: [{
          name: "John Smith",
          position: "President",
          email: "president@mtc.com.mx",
          phone: "+521234567890",
          termStart: getCurrentTimestamp(new Date('2024-01-01')),
          termEnd: getCurrentTimestamp(new Date('2025-12-31')),
          isPrimary: true
        }, {
          name: "Jane Doe",
          position: "Treasurer",
          email: "treasurer@mtc.com.mx",
          phone: "+521234567891",
          termStart: getCurrentTimestamp(new Date('2024-01-01')),
          termEnd: getCurrentTimestamp(new Date('2025-12-31')),
          isPrimary: false
        }],
        committees: [{
          name: "Finance",
          chair: "Jane Doe",
          members: ["John Smith", "Bob Wilson"]
        }, {
          name: "Maintenance",
          chair: "Bob Wilson",
          members: ["Jane Doe", "Alice Brown"]
        }],
        meetingSchedule: {
          annualMeeting: "March",
          boardMeetings: "Monthly",
          dayOfMonth: 15
        },
        managementCompany: {
          name: "Sandyland Properties",
          contact: "Michael Landesman",
          email: "pm@sandyland.com.mx",
          phone: "+52 984-178-0331",
          contractEnd: getCurrentTimestamp(new Date('2025-12-31'))
        }
      },
      
      // Fee Structure (for HOAs)
      feeStructure: {
        duesFrequency: "monthly",
        lateFeePolicy: {
          gracePeriodDays: 10,
          lateFeeAmount: 50000, // 500.00 MXN in cents
          lateFeePercent: 0,
          interestRate: 0
        },
        specialAssessments: [],
        paymentMethods: ["transfer", "cash", "check"],
        bankDetails: {
          bankName: "CiBanco",
          accountName: "Marina Turquesa Condominiums A.C.",
          clabe: "123456789012345678",
          swiftCode: "CIBAMXMM",
          reference: "Unit number"
        }
      },
      
      // Documents
      documents: {
        bylaws: null,
        ccrs: null,
        insurancePolicies: [],
        contracts: [],
        financialReports: [],
        meetingMinutes: []
      },
      
      // Emergency Contacts
      emergencyContacts: [{
        type: "Security",
        name: "Puerto Aventuras Security",
        phone: "+52 984-873-5000",
        alternatePhone: null,
        email: "security@puertoaventuras.com",
        available: "24/7",
        notes: "Main gate security"
      }, {
        type: "Maintenance",
        name: "MTC Maintenance",
        phone: "+52 984-123-4567",
        alternatePhone: null,
        email: "maintenance@mtc.com.mx",
        available: "Business Hours",
        notes: "Building maintenance team"
      }],
      
      // Metadata
      metadata: {
        version: 1,
        createdBy: "import-script",
        createdAt: getCurrentTimestamp(),
        lastModifiedBy: "import-script",
        lastModified: getCurrentTimestamp(),
        dataSource: "manual",
        importBatch: null
      },
      
      // Status
      status: "active",
      updated: getCurrentTimestamp()
    };
    
    // Create the client document
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    
    // Check if already exists
    const existing = await clientRef.get();
    if (existing.exists) {
      console.log('⚠️  MTC client already exists. Updating...');
      await clientRef.update({
        ...mtcClient,
        updated: getCurrentTimestamp()
      });
      console.log('✅ MTC client updated successfully!');
    } else {
      await clientRef.set(mtcClient);
      console.log('✅ MTC client created successfully!');
    }
    
    console.log('\n📊 Client Details:');
    console.log(`   ID: ${CLIENT_ID}`);
    console.log(`   Name: ${mtcClient.basicInfo.fullName}`);
    console.log(`   Type: ${mtcClient.basicInfo.clientType}`);
    console.log(`   Units: ${mtcClient.propertyInfo.totalUnits}`);
    console.log(`   Status: ${mtcClient.status}`);
    
    console.log('\n✨ MTC client is ready for data imports!');
    
  } catch (error) {
    console.error('❌ Error creating MTC client:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the script
createMTCClient();