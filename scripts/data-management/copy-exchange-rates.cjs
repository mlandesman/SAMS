const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Script configuration
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  limit: process.argv.includes('--limit') ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) : null,
  all: process.argv.includes('--all'),
  dateRange: {
    days: process.argv.includes('--days') ? parseInt(process.argv[process.argv.indexOf('--days') + 1]) : 90,
    startDate: process.argv.includes('--start-date') ? process.argv[process.argv.indexOf('--start-date') + 1] : null,
    endDate: process.argv.includes('--end-date') ? process.argv[process.argv.indexOf('--end-date') + 1] : null
  }
};

// Initialize production app
const prodServiceAccount = require('../../serviceAccountKey-prod.json');
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(prodServiceAccount),
  projectId: 'sams-sandyland-prod'
}, 'prod');

// Log function with levels
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📊',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    debug: '🔍'
  }[level] || '📌';
  
  if (level === 'debug' && !CONFIG.verbose) return;
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

// Progress tracking
class ProgressTracker {
  constructor(total) {
    this.total = total;
    this.current = 0;
    this.errors = [];
    this.startTime = Date.now();
  }
  
  increment(error = null) {
    this.current++;
    if (error) this.errors.push(error);
    
    if (this.current % 50 === 0 || this.current === this.total) {
      const percentage = ((this.current / this.total) * 100).toFixed(1);
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      log(`Progress: ${this.current}/${this.total} (${percentage}%) - ${elapsed}s elapsed`, 'info');
    }
  }
  
  summary() {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    return {
      total: this.total,
      processed: this.current,
      errors: this.errors.length,
      elapsed: elapsed,
      rate: (this.current / elapsed).toFixed(1)
    };
  }
}

async function validateData(doc) {
  const data = doc.data();
  const errors = [];
  
  // Validate required fields
  if (!data.date) errors.push('Missing date field');
  if (!data.rates) errors.push('Missing rates object');
  
  // Validate rate structure
  if (data.rates) {
    const expectedCurrencies = ['MXN_USD', 'MXN_CAD', 'MXN_EUR', 'MXN_COP'];
    for (const currency of expectedCurrencies) {
      if (!data.rates[currency]) {
        errors.push(`Missing ${currency} rate`);
      } else if (typeof data.rates[currency].rate !== 'number') {
        errors.push(`Invalid ${currency} rate value`);
      }
    }
  }
  
  return errors;
}

async function findDevServiceAccount() {
  log('Searching for development service account...', 'info');
  
  const possiblePaths = [
    './backend/serviceAccountKey.json',
    './backend/serviceAccountKeyDev.json',
    './serviceAccountKey-dev.json',
    './backend/sandyland-management-system-firebase-adminsdk.json',
    './serviceAccountKey-sandyland-management-system.json',
    '../../backend/serviceAccountKey.json',
    '../../serviceAccountKey-dev.json'
  ];
  
  for (const testPath of possiblePaths) {
    const fullPath = path.resolve(__dirname, testPath);
    if (fs.existsSync(fullPath)) {
      log(`Found dev service account at: ${fullPath}`, 'success');
      return require(fullPath);
    }
  }
  
  throw new Error('Development service account not found');
}

async function copyExchangeRates() {
  log('=== Exchange Rate Copy Script ===', 'info');
  log(`Mode: ${CONFIG.dryRun ? 'DRY RUN' : 'LIVE COPY'}`, 'info');
  
  // Display configuration
  if (CONFIG.all) {
    log('Date range: ALL DATA', 'info');
  } else if (CONFIG.dateRange.startDate && CONFIG.dateRange.endDate) {
    log(`Date range: ${CONFIG.dateRange.startDate} to ${CONFIG.dateRange.endDate}`, 'info');
  } else if (CONFIG.dateRange.startDate) {
    log(`Date range: From ${CONFIG.dateRange.startDate} to today`, 'info');
  } else {
    log(`Date range: Last ${CONFIG.dateRange.days} days`, 'info');
  }
  
  if (CONFIG.limit) log(`Limit: ${CONFIG.limit} documents`, 'info');
  
  try {
    // Initialize development app
    const devServiceAccount = await findDevServiceAccount();
    const devApp = admin.initializeApp({
      credential: admin.credential.cert(devServiceAccount),
      projectId: 'sandyland-management-system'
    }, 'dev');
    
    const prodDb = prodApp.firestore();
    const devDb = devApp.firestore();
    
    // Build query based on configuration
    let query = prodDb.collection('exchangeRates');
    
    if (CONFIG.all) {
      // Get all data, ordered by date
      query = query.orderBy('date', 'desc');
      log('Fetching ALL exchange rates from production...', 'info');
    } else {
      // Calculate date range
      let startDateStr, endDateStr;
      
      if (CONFIG.dateRange.startDate) {
        startDateStr = CONFIG.dateRange.startDate;
      } else {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - CONFIG.dateRange.days);
        startDateStr = startDate.toISOString().split('T')[0];
      }
      
      if (CONFIG.dateRange.endDate) {
        endDateStr = CONFIG.dateRange.endDate;
      } else {
        endDateStr = new Date().toISOString().split('T')[0];
      }
      
      log(`Fetching rates from ${startDateStr} to ${endDateStr}`, 'info');
      
      query = query
        .where('date', '>=', startDateStr)
        .where('date', '<=', endDateStr)
        .orderBy('date', 'desc');
    }
    
    if (CONFIG.limit) {
      query = query.limit(CONFIG.limit);
    }
    
    // Read from production
    const prodSnapshot = await query.get();
    log(`Found ${prodSnapshot.size} exchange rates in production`, 'success');
    
    if (prodSnapshot.size === 0) {
      log('No exchange rates found in the specified date range', 'warning');
      return;
    }
    
    // Validate data integrity
    log('Validating data integrity...', 'info');
    const validationErrors = new Map();
    
    prodSnapshot.forEach(doc => {
      const errors = validateData(doc);
      if (errors.length > 0) {
        validationErrors.set(doc.id, errors);
      }
    });
    
    if (validationErrors.size > 0) {
      log(`Found validation errors in ${validationErrors.size} documents:`, 'warning');
      if (CONFIG.verbose) {
        validationErrors.forEach((errors, docId) => {
          log(`  ${docId}: ${errors.join(', ')}`, 'debug');
        });
      }
    }
    
    // Process copy
    const tracker = new ProgressTracker(prodSnapshot.size);
    
    if (!CONFIG.dryRun) {
      log('Starting copy to development...', 'info');
      const batch = devDb.batch();
      let batchCount = 0;
      let totalCopied = 0;
      
      for (const doc of prodSnapshot.docs) {
        try {
          const docRef = devDb.collection('exchangeRates').doc(doc.id);
          const data = {
            ...doc.data(),
            syncedFromProd: true,
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            syncMethod: 'copy-exchange-rates-script',
            syncedBy: 'DATA-SYNC-001'
          };
          
          batch.set(docRef, data, { merge: true });
          batchCount++;
          
          if (batchCount >= 400) {
            await batch.commit();
            totalCopied += batchCount;
            log(`Committed batch: ${totalCopied}/${prodSnapshot.size} documents`, 'info');
            batchCount = 0;
          }
          
          tracker.increment();
        } catch (error) {
          tracker.increment(error);
          log(`Error processing document ${doc.id}: ${error.message}`, 'error');
        }
      }
      
      // Commit remaining documents
      if (batchCount > 0) {
        await batch.commit();
        totalCopied += batchCount;
      }
      
      log(`Copy completed: ${totalCopied} documents`, 'success');
      
      // Verify copy
      log('Verifying copy...', 'info');
      const devCheck = await devDb.collection('exchangeRates')
        .orderBy('date', 'desc')
        .limit(5)
        .get();
      
      log('Recent rates in development:', 'info');
      devCheck.forEach(doc => {
        const data = doc.data();
        log(`  ${doc.id}: MXN→USD=${data.rates?.MXN_USD?.rate?.toFixed(6) || 'N/A'}`, 'debug');
      });
      
    } else {
      // Dry run - just simulate
      log('DRY RUN - Simulating copy process...', 'info');
      
      for (const doc of prodSnapshot.docs) {
        tracker.increment();
        if (CONFIG.verbose) {
          const data = doc.data();
          log(`Would copy: ${doc.id} (${data.date})`, 'debug');
        }
      }
    }
    
    // Summary
    const summary = tracker.summary();
    log('\n=== Copy Summary ===', 'info');
    log(`Total documents: ${summary.total}`, 'info');
    log(`Processed: ${summary.processed}`, 'info');
    log(`Errors: ${summary.errors}`, summary.errors > 0 ? 'warning' : 'info');
    log(`Time elapsed: ${summary.elapsed}s`, 'info');
    log(`Processing rate: ${summary.rate} docs/sec`, 'info');
    
    if (CONFIG.dryRun) {
      log('\nThis was a DRY RUN. No data was copied.', 'warning');
      log('To perform actual copy, run without --dry-run flag', 'info');
    }
    
    // Create audit log
    if (!CONFIG.dryRun) {
      const auditLog = {
        timestamp: new Date().toISOString(),
        operation: 'exchange-rate-copy',
        source: 'production',
        destination: 'development',
        documentsCount: summary.processed,
        dateRange: { start: startDateStr, end: endDateStr },
        errors: summary.errors,
        elapsed: summary.elapsed,
        config: CONFIG
      };
      
      const auditPath = path.join(__dirname, `copy-log-${Date.now()}.json`);
      fs.writeFileSync(auditPath, JSON.stringify(auditLog, null, 2));
      log(`Audit log saved to: ${auditPath}`, 'success');
    }
    
  } catch (error) {
    log(`Script failed: ${error.message}`, 'error');
    if (CONFIG.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
  
  process.exit(0);
}

// Show usage if --help
if (process.argv.includes('--help')) {
  console.log(`
Exchange Rate Copy Script

Usage: node copy-exchange-rates.cjs [options]

Options:
  --dry-run         Run in simulation mode without copying data
  --verbose         Show detailed debug information
  --all             Copy ALL exchange rates (ignores date range)
  --days N          Number of days to copy (default: 90)
  --start-date YYYY-MM-DD   Start date for copy range
  --end-date YYYY-MM-DD     End date for copy range
  --limit N         Limit number of documents to copy
  --help            Show this help message

Examples:
  # Copy ALL historical data
  node copy-exchange-rates.cjs --all
  
  # Copy ALL data in dry-run mode first (recommended)
  node copy-exchange-rates.cjs --all --dry-run
  
  # Copy specific date range
  node copy-exchange-rates.cjs --start-date 2023-06-26 --end-date 2025-07-09
  
  # Copy last 30 days with verbose output
  node copy-exchange-rates.cjs --days 30 --verbose
  
  # Test with limited documents
  node copy-exchange-rates.cjs --limit 10 --dry-run
`);
  process.exit(0);
}

// Run the script
copyExchangeRates();