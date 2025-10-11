/**
 * Migration Script: Convert MTC client to new client structure
 * This script migrates the existing MTC client data to match the new
 * ClientFormModal structure with proper metadata fields.
 * 
 * Run with: node backend/scripts/migrate-mtc-client.js
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';

async function migrateMTCClient() {
  try {
    console.log('🚀 Starting MTC client migration...');
    
    // Get current MTC client data
    const db = await getDb();
    const mtcRef = db.collection('clients').doc('MTC');
    const mtcDoc = await mtcRef.get();
    
    if (!mtcDoc.exists) {
      console.error('❌ MTC client not found');
      return;
    }
    
    const currentData = mtcDoc.data();
    console.log('📖 Current MTC structure keys:', Object.keys(currentData));
    console.log('📖 Current data preview:', {
      fullName: currentData.fullName,
      displayName: currentData.displayName,
      hasBasicInfo: !!currentData.basicInfo,
      hasMetadata: !!currentData.metadata
    });
    
    // Check if already migrated
    if (currentData.basicInfo && currentData.metadata?.migrated) {
      console.log('✅ MTC client is already migrated!');
      return;
    }
    
    // Create new structure matching ClientFormModal
    const migratedData = {
      basicInfo: {
        id: 'MTC',
        fullName: currentData.fullName || currentData.name || 'Marina Turquesa Condominiums',
        displayName: currentData.displayName || currentData.shortName || 'MTC',
        clientType: currentData.clientType || currentData.type || 'HOA_Management',
        status: currentData.status || 'active',
        description: currentData.description || 'Marina Turquesa Condominiums - HOA Management'
      },
      branding: {
        logoUrl: currentData.logoUrl || currentData.logo || null,
        iconUrl: currentData.iconUrl || currentData.icon || null,
        brandColors: {
          primary: '#2563eb',
          secondary: '#64748b', 
          accent: '#10b981'
        }
      },
      configuration: {
        timezone: 'America/Mexico_City',
        currency: 'MXN',
        language: 'es-MX',
        dateFormat: 'DD/MM/YYYY'
      },
      contactInfo: {
        primaryEmail: currentData.primaryEmail || currentData.email || '',
        phone: currentData.phone || '',
        address: {
          street: currentData.address?.street || '',
          city: currentData.address?.city || 'Puerto Vallarta',
          state: currentData.address?.state || 'Jalisco',
          zipCode: currentData.address?.zipCode || '',
          country: currentData.address?.country || 'Mexico'
        }
      },
      metadata: {
        createdAt: currentData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'migration-script',
        lastModified: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: 'migration-script',
        version: 1,
        migrated: true,
        migrationDate: admin.firestore.FieldValue.serverTimestamp(),
        originalFields: Object.keys(currentData) // For reference
      }
    };
    
    console.log('🔄 New structure preview:');
    console.log('  - basicInfo:', Object.keys(migratedData.basicInfo));
    console.log('  - branding:', Object.keys(migratedData.branding));
    console.log('  - configuration:', Object.keys(migratedData.configuration));
    console.log('  - contactInfo:', Object.keys(migratedData.contactInfo));
    console.log('  - metadata:', Object.keys(migratedData.metadata));
    
    // Backup current data first
    console.log('💾 Creating backup...');
    const backupId = 'MTC_backup_' + Date.now();
    await db.collection('clients').doc(backupId).set({
      ...currentData,
      backupCreated: admin.firestore.FieldValue.serverTimestamp(),
      backupReason: 'Pre-migration backup'
    });
    console.log(`💾 Backup created as: ${backupId}`);
    
    // Update MTC with new structure
    console.log('📝 Updating MTC client structure...');
    await mtcRef.set(migratedData);
    
    console.log('✅ MTC client migration completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Full Name: ${migratedData.basicInfo.fullName}`);
    console.log(`   - Display Name: ${migratedData.basicInfo.displayName}`);
    console.log(`   - Client Type: ${migratedData.basicInfo.clientType}`);
    console.log(`   - Status: ${migratedData.basicInfo.status}`);
    console.log(`   - Has Logo: ${migratedData.branding.logoUrl ? 'Yes' : 'No'}`);
    console.log(`   - Primary Email: ${migratedData.contactInfo.primaryEmail || 'Not set'}`);
    console.log(`   - Backup ID: ${backupId}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateMTCClient()
  .then(() => {
    console.log('🎉 Migration script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });