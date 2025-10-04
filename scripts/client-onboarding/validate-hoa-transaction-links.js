#!/usr/bin/env node

/**
 * HOA Transaction Link Validator
 * Verifies all HOA payments have valid transaction links
 * Checks transaction IDs exist and match expected format
 * Validates credit balance calculations
 * Reports any orphaned payments or data inconsistencies
 * 
 * Phase 4: Cross-Reference Validation
 * Date: 2025-09-29
 */

import { initializeApp } from '../../backend/firebase.js';
import { getDb } from '../../backend/firebase.js';
import { 
  createDateService, 
  ProgressLogger,
  loadJsonData
} from './utils/import-utils-modern.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  debug: process.env.DEBUG === 'true',
  checkTransactionExists: true, // Set to false for faster validation without existence checks
  checkAmountMatch: true, // Verify payment amounts match transaction amounts
  maxDiscrepancy: 100 // Maximum allowed discrepancy in cents
};

/**
 * Validate transaction ID format
 * Expected format: YYYY-MM-DD_HHMMSS_nnn
 */
function validateTransactionIdFormat(transactionId) {
  if (!transactionId) return { valid: false, error: 'Missing transaction ID' };
  
  const pattern = /^\d{4}-\d{2}-\d{2}_\d{6}_\d{3}$/;
  if (!pattern.test(transactionId)) {
    return { 
      valid: false, 
      error: `Invalid format: ${transactionId} (expected: YYYY-MM-DD_HHMMSS_nnn)` 
    };
  }
  
  // Validate date components
  const [datePart] = transactionId.split('_');
  const [year, month, day] = datePart.split('-').map(Number);
  
  if (year < 2020 || year > 2030) {
    return { valid: false, error: `Invalid year: ${year}` };
  }
  if (month < 1 || month > 12) {
    return { valid: false, error: `Invalid month: ${month}` };
  }
  if (day < 1 || day > 31) {
    return { valid: false, error: `Invalid day: ${day}` };
  }
  
  return { valid: true };
}

/**
 * Check if transaction exists in database
 */
async function checkTransactionExists(db, clientId, transactionId) {
  try {
    const txnDoc = await db
      .collection('clients')
      .doc(clientId)
      .collection('transactions')
      .doc(transactionId)
      .get();
    
    return {
      exists: txnDoc.exists,
      data: txnDoc.exists ? txnDoc.data() : null
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

/**
 * Calculate credit balance from payment history
 */
function calculateCreditBalance(unitData) {
  const scheduledAmount = unitData.scheduledAmount || 0;
  let totalPaid = 0;
  
  // Sum all payments
  if (unitData.payments && Array.isArray(unitData.payments)) {
    totalPaid = unitData.payments.reduce((sum, payment) => {
      return sum + (payment.paid || 0);
    }, 0);
  }
  
  // Credit balance = total paid - scheduled amount
  // Positive means overpayment (credit), negative means underpayment
  return totalPaid - scheduledAmount;
}

/**
 * Validate HOA dues data for a single unit
 */
async function validateUnitDues(db, clientId, unitId, year) {
  const issues = [];
  
  try {
    // Get dues document
    const duesDoc = await db
      .collection('clients')
      .doc(clientId)
      .collection('units')
      .doc(unitId)
      .collection('dues')
      .doc(year)
      .get();
    
    if (!duesDoc.exists) {
      issues.push({
        type: 'missing_dues',
        unitId,
        year,
        message: `No dues record found for ${year}`
      });
      return issues;
    }
    
    const duesData = duesDoc.data();
    
    // Validate payment array structure
    if (!duesData.payments || !Array.isArray(duesData.payments)) {
      issues.push({
        type: 'invalid_structure',
        unitId,
        year,
        message: 'Missing or invalid payments array'
      });
      return issues;
    }
    
    if (duesData.payments.length !== 12) {
      issues.push({
        type: 'invalid_structure',
        unitId,
        year,
        message: `Invalid payments array length: ${duesData.payments.length} (expected 12)`
      });
    }
    
    // Check each payment
    const transactionChecks = [];
    
    duesData.payments.forEach((payment, index) => {
      const month = index + 1;
      
      // Skip unpaid months
      if (!payment || payment.paid === 0) {
        return;
      }
      
      // Check for orphaned payments (paid but no transaction ID)
      if (payment.paid > 0 && !payment.transactionId) {
        issues.push({
          type: 'orphaned_payment',
          unitId,
          year,
          month,
          amount: payment.paid,
          message: `Payment of ${payment.paid} cents has no transaction ID`
        });
        return;
      }
      
      // Validate transaction ID format
      if (payment.transactionId) {
        const formatValidation = validateTransactionIdFormat(payment.transactionId);
        if (!formatValidation.valid) {
          issues.push({
            type: 'invalid_transaction_id',
            unitId,
            year,
            month,
            transactionId: payment.transactionId,
            message: formatValidation.error
          });
        }
        
        // Queue transaction existence check
        if (CONFIG.checkTransactionExists && formatValidation.valid) {
          transactionChecks.push({
            transactionId: payment.transactionId,
            month,
            amount: payment.paid
          });
        }
      }
      
      // Check for missing payment date
      if (payment.paid > 0 && !payment.date) {
        issues.push({
          type: 'missing_payment_date',
          unitId,
          year,
          month,
          message: 'Payment has no date recorded'
        });
      }
    });
    
    // Perform transaction existence checks
    if (CONFIG.checkTransactionExists) {
      for (const check of transactionChecks) {
        const result = await checkTransactionExists(db, clientId, check.transactionId);
        
        if (!result.exists) {
          issues.push({
            type: 'missing_transaction',
            unitId,
            year,
            month: check.month,
            transactionId: check.transactionId,
            message: `Transaction does not exist in database`
          });
        } else if (CONFIG.checkAmountMatch && result.data) {
          // Check if amounts match (allowing for small discrepancies)
          const transactionAmount = Math.abs(result.data.amount || 0);
          const discrepancy = Math.abs(transactionAmount - check.amount);
          
          if (discrepancy > CONFIG.maxDiscrepancy) {
            issues.push({
              type: 'amount_mismatch',
              unitId,
              year,
              month: check.month,
              transactionId: check.transactionId,
              paymentAmount: check.amount,
              transactionAmount: transactionAmount,
              discrepancy: discrepancy,
              message: `Payment amount (${check.amount}) does not match transaction amount (${transactionAmount})`
            });
          }
        }
      }
    }
    
    // Validate credit balance calculation
    const calculatedCredit = calculateCreditBalance(duesData);
    const storedCredit = duesData.creditBalance || 0;
    const creditDiscrepancy = Math.abs(calculatedCredit - storedCredit);
    
    if (creditDiscrepancy > CONFIG.maxDiscrepancy) {
      issues.push({
        type: 'credit_balance_mismatch',
        unitId,
        year,
        calculatedCredit,
        storedCredit,
        discrepancy: creditDiscrepancy,
        message: `Credit balance mismatch: stored=${storedCredit}, calculated=${calculatedCredit}`
      });
    }
    
    return issues;
    
  } catch (error) {
    issues.push({
      type: 'validation_error',
      unitId,
      year,
      error: error.message,
      message: `Failed to validate unit: ${error.message}`
    });
    return issues;
  }
}

/**
 * Main validation function
 */
async function validateHOATransactionLinks() {
  const startTime = Date.now();
  console.log('🔍 Starting HOA Transaction Link Validation...\n');

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const clientId = args[0];
    const year = args[1] || '2025';
    const environment = args[2] || 'dev';

    if (!clientId) {
      throw new Error('Usage: node validate-hoa-transaction-links.js <clientId> [year] [environment]');
    }

    console.log(`📋 Configuration:`);
    console.log(`   Client: ${clientId}`);
    console.log(`   Year: ${year}`);
    console.log(`   Environment: ${environment}`);
    console.log(`   Check Transaction Exists: ${CONFIG.checkTransactionExists}`);
    console.log(`   Check Amount Match: ${CONFIG.checkAmountMatch}`);
    console.log(`   Max Discrepancy: ${CONFIG.maxDiscrepancy} cents\n`);

    // Initialize Firebase
    process.env.SAMS_ENV = environment;
    await initializeApp();
    const db = await getDb();
    console.log('✅ Firebase initialized\n');

    // Get all units
    console.log('📄 Loading units...');
    const unitsSnapshot = await db
      .collection('clients')
      .doc(clientId)
      .collection('units')
      .get();
    
    const unitIds = unitsSnapshot.docs.map(doc => doc.id);
    console.log(`✅ Found ${unitIds.length} units\n`);

    // Initialize progress tracking
    const progress = new ProgressLogger('HOA Validation', unitIds.length);

    // Track all issues
    const allIssues = [];
    const issueStats = {
      orphaned_payment: 0,
      missing_transaction: 0,
      invalid_transaction_id: 0,
      amount_mismatch: 0,
      credit_balance_mismatch: 0,
      missing_payment_date: 0,
      missing_dues: 0,
      invalid_structure: 0,
      validation_error: 0
    };

    // Validate each unit
    for (const unitId of unitIds) {
      const issues = await validateUnitDues(db, clientId, unitId, year);
      
      if (issues.length === 0) {
        progress.logItem(unitId, 'success');
      } else {
        progress.logItem(unitId, 'error');
        allIssues.push(...issues);
        
        // Count issues by type
        issues.forEach(issue => {
          if (issueStats[issue.type] !== undefined) {
            issueStats[issue.type]++;
          }
        });
      }
    }

    // Display summary
    const summary = progress.logSummary();
    
    console.log('\n📊 Validation Summary:');
    console.log(`   Units validated: ${unitIds.length}`);
    console.log(`   Units with issues: ${summary.errors}`);
    console.log(`   Total issues found: ${allIssues.length}`);
    
    if (allIssues.length > 0) {
      console.log('\n📈 Issues by Type:');
      Object.entries(issueStats).forEach(([type, count]) => {
        if (count > 0) {
          const typeDisplay = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          console.log(`   ${typeDisplay}: ${count}`);
        }
      });
      
      // Save detailed report
      const reportPath = path.join(__dirname, `hoa-validation-report-${clientId}-${year}.json`);
      await fs.writeFile(reportPath, JSON.stringify({
        generated: new Date().toISOString(),
        clientId,
        year,
        environment,
        summary: {
          unitsValidated: unitIds.length,
          unitsWithIssues: summary.errors,
          totalIssues: allIssues.length
        },
        issueStats,
        issues: allIssues
      }, null, 2));
      
      console.log(`\n📝 Detailed report saved to: ${reportPath}`);
      
      // Display first few issues as examples
      console.log('\n⚠️ Example Issues:');
      allIssues.slice(0, 5).forEach(issue => {
        console.log(`   [${issue.type}] Unit ${issue.unitId}: ${issue.message}`);
      });
      
      if (allIssues.length > 5) {
        console.log(`   ... and ${allIssues.length - 5} more issues (see report file)`);
      }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n✅ Validation completed in ${duration}s`);
    
    // Exit with error code if issues found
    if (allIssues.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    if (CONFIG.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the validation
validateHOATransactionLinks().catch(console.error);