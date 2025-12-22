#!/usr/bin/env node
/**
 * Delete Budget Year Script
 * 
 * Deletes all budget documents for a specific fiscal year for a client.
 * Used for testing the "Copy from Prior Year" feature.
 * 
 * Usage:
 *   node scripts/delete-budget-year.js <clientId> <year> [--dry-run]
 * 
 * Examples:
 *   node scripts/delete-budget-year.js MTC 2026 --dry-run   # Preview what would be deleted
 *   node scripts/delete-budget-year.js MTC 2026             # Actually delete
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filteredArgs = args.filter(arg => arg !== '--dry-run');

if (filteredArgs.length < 2) {
  console.log('Usage: node scripts/delete-budget-year.js <clientId> <year> [--dry-run]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/delete-budget-year.js MTC 2026 --dry-run');
  console.log('  node scripts/delete-budget-year.js MTC 2026');
  process.exit(1);
}

const clientId = filteredArgs[0];
const year = parseInt(filteredArgs[1]);

if (isNaN(year) || year < 2020 || year > 2100) {
  console.error(`Invalid year: ${filteredArgs[1]}. Must be between 2020 and 2100.`);
  process.exit(1);
}

// Determine environment
const useEmulator = process.env.FIRESTORE_EMULATOR_HOST || process.env.USE_EMULATOR === 'true';

async function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  if (useEmulator) {
    console.log('🔧 Using Firestore Emulator');
    admin.initializeApp({ projectId: 'sams-sandbox' });
  } else {
    // Use service account for production
    const serviceAccountPath = resolve(__dirname, '../functions/serviceAccountKey.json');
    try {
      const { default: serviceAccount } = await import(serviceAccountPath, { assert: { type: 'json' } });
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('🔥 Connected to Production Firestore');
    } catch (error) {
      console.error('Failed to load service account key:', error.message);
      console.log('Attempting to use default credentials...');
      admin.initializeApp();
    }
  }

  return admin.firestore();
}

async function deleteBudgetYear(db, clientId, year, dryRun) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  DELETE BUDGET YEAR: ${clientId} FY ${year}`);
  console.log(`  Mode: ${dryRun ? 'DRY RUN (no changes)' : '⚠️  LIVE DELETE'}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Get all categories for the client
  const categoriesSnapshot = await db.collection('clients').doc(clientId)
    .collection('categories').get();

  if (categoriesSnapshot.empty) {
    console.log(`No categories found for client ${clientId}`);
    return;
  }

  console.log(`Found ${categoriesSnapshot.size} categories`);
  console.log('');

  const budgetsToDelete = [];

  // Check each category for the budget year
  for (const categoryDoc of categoriesSnapshot.docs) {
    const categoryId = categoryDoc.id;
    const categoryData = categoryDoc.data();
    const categoryName = categoryData.name || categoryId;

    const budgetDoc = await categoryDoc.ref.collection('budget').doc(String(year)).get();
    
    if (budgetDoc.exists) {
      const budgetData = budgetDoc.data();
      budgetsToDelete.push({
        categoryId,
        categoryName,
        docRef: budgetDoc.ref,
        amount: budgetData.amount || 0,
        notes: budgetData.notes || ''
      });
    }
  }

  if (budgetsToDelete.length === 0) {
    console.log(`✅ No budget documents found for FY ${year}`);
    return;
  }

  console.log(`Found ${budgetsToDelete.length} budget documents to delete:`);
  console.log('');

  // Display what will be deleted
  for (const budget of budgetsToDelete) {
    const amountPesos = (budget.amount / 100).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
    console.log(`  • ${budget.categoryName}`);
    console.log(`    Amount: $${amountPesos}`);
    if (budget.notes) {
      console.log(`    Notes: ${budget.notes.substring(0, 50)}${budget.notes.length > 50 ? '...' : ''}`);
    }
    console.log('');
  }

  if (dryRun) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  DRY RUN COMPLETE - No documents were deleted');
    console.log('  Run without --dry-run to actually delete');
    console.log('═══════════════════════════════════════════════════════════');
    return;
  }

  // Confirm before deleting (in non-dry-run mode)
  console.log('⚠️  DELETING documents...');
  console.log('');

  // Delete in batches
  const batch = db.batch();
  for (const budget of budgetsToDelete) {
    batch.delete(budget.docRef);
  }

  await batch.commit();

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ✅ DELETED ${budgetsToDelete.length} budget documents for FY ${year}`);
  console.log('═══════════════════════════════════════════════════════════');
}

async function main() {
  try {
    const db = await initializeFirebase();
    await deleteBudgetYear(db, clientId, year, dryRun);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

