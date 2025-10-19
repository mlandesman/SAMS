/**
 * Credit Balance Migration Script
 * 
 * Migrates credit balances from deep HOA Dues structure to simplified units-level location
 * 
 * FROM: /clients/{clientId}/units/{unitId}/dues/{year}/creditBalance
 * TO:   /clients/{clientId}/units/creditBalances
 * 
 * New Structure:
 * {
 *   "101": {
 *     "creditBalance": 100000,  // in centavos
 *     "lastChange": {
 *       "year": "2026",
 *       "historyIndex": 15,
 *       "timestamp": "2025-10-19T10:00:00.000Z"
 *     }
 *   },
 *   "102": { ... }
 * }
 */

import { getDb } from '../firebase.js';
import { getNow } from '../services/DateService.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CreditBalanceMigration {
  constructor() {
    this.db = null;
    this.backupDir = path.join(__dirname, '../../backups/credit-migration');
    this.stats = {
      clientsProcessed: 0,
      unitsProcessed: 0,
      creditBalancesMigrated: 0,
      historyEntriesMigrated: 0,
      errors: []
    };
  }

  async initialize() {
    this.db = await getDb();
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Main migration entry point
   */
  async migrate(options = {}) {
    const { clients = ['MTC', 'AVII'], dryRun = false, backup = true } = options;
    
    console.log('\n🚀 Starting Credit Balance Migration');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Backup: ${backup ? 'YES' : 'NO'}`);
    console.log(`Clients: ${clients.join(', ')}\n`);

    await this.initialize();

    for (const clientId of clients) {
      try {
        console.log(`\n📊 Processing client: ${clientId}`);
        
        // Backup existing data if requested
        if (backup) {
          await this.backupClient(clientId);
        }

        // Collect credit balances from all units/years
        const creditData = await this.collectCreditBalances(clientId);
        
        // Write new structure
        if (!dryRun && Object.keys(creditData).length > 0) {
          await this.writeCreditBalances(clientId, creditData);
        }

        this.stats.clientsProcessed++;
        console.log(`✅ Client ${clientId} processed successfully`);
        
      } catch (error) {
        console.error(`❌ Error processing client ${clientId}:`, error);
        this.stats.errors.push({ clientId, error: error.message });
      }
    }

    this.printStats();
    return this.stats;
  }

  /**
   * Backup existing credit balance data for a client
   */
  async backupClient(clientId) {
    console.log(`💾 Backing up credit data for ${clientId}...`);
    
    try {
      const unitsSnapshot = await this.db
        .collection('clients').doc(clientId)
        .collection('units')
        .get();

      const backup = {
        clientId,
        timestamp: getNow().toISOString(),
        units: {}
      };

      for (const unitDoc of unitsSnapshot.docs) {
        const unitId = unitDoc.id;
        const duesSnapshot = await this.db
          .collection('clients').doc(clientId)
          .collection('units').doc(unitId)
          .collection('dues')
          .get();

        backup.units[unitId] = {};

        for (const duesDoc of duesSnapshot.docs) {
          const year = duesDoc.id;
          const data = duesDoc.data();
          
          if (data.creditBalance || data.creditBalanceHistory) {
            backup.units[unitId][year] = {
              creditBalance: data.creditBalance,
              creditBalanceHistory: data.creditBalanceHistory,
              updated: data.updated
            };
          }
        }
      }

      // Write backup file
      const backupFile = path.join(
        this.backupDir, 
        `${clientId}_credit_backup_${Date.now()}.json`
      );
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
      console.log(`✅ Backup saved: ${backupFile}`);

    } catch (error) {
      console.error(`❌ Backup failed for ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Collect credit balances from all units and years
   */
  async collectCreditBalances(clientId) {
    const creditData = {};
    
    const unitsSnapshot = await this.db
      .collection('clients').doc(clientId)
      .collection('units')
      .get();

    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      
      // Get all dues documents for this unit
      const duesSnapshot = await this.db
        .collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues')
        .get();

      let latestBalance = 0;
      let latestYear = null;
      let latestHistoryIndex = 0;
      let latestTimestamp = null;
      let totalHistory = 0;
      let allHistoryEntries = [];

      // Find the most recent year with credit balance data
      for (const duesDoc of duesSnapshot.docs) {
        const year = duesDoc.id;
        const data = duesDoc.data();
        
        if (data.creditBalance !== undefined) {
          const yearNum = parseInt(year);
          if (!latestYear || yearNum > parseInt(latestYear)) {
            latestYear = year;
            latestBalance = data.creditBalance || 0;
            latestHistoryIndex = data.creditBalanceHistory?.length || 0;
            latestTimestamp = data.updated?.toDate?.() || getNow();
          }
        }

        // Collect all history entries across all years
        if (data.creditBalanceHistory) {
          totalHistory += data.creditBalanceHistory.length;
          // Add year context to each history entry and fix timestamp format
          data.creditBalanceHistory.forEach(entry => {
            allHistoryEntries.push({
              ...entry,
              year: year, // Add year context for reference
              timestamp: entry.timestamp?.toDate?.()?.toISOString() || entry.timestamp // FIX: Convert Firestore Timestamp to ISO string
            });
          });
        }
      }

      // Only add to migration if there's actual credit data
      if (latestYear !== null) {
        // Sort history entries by timestamp (oldest first)
        allHistoryEntries.sort((a, b) => {
          const aTime = new Date(a.timestamp).getTime();
          const bTime = new Date(b.timestamp).getTime();
          return aTime - bTime;
        });

        creditData[unitId] = {
          creditBalance: latestBalance,
          lastChange: {
            year: latestYear,
            historyIndex: latestHistoryIndex,
            timestamp: latestTimestamp.toISOString ? latestTimestamp.toISOString() : latestTimestamp
          },
          history: allHistoryEntries // FIX: Actually migrate the history array
        };

        this.stats.unitsProcessed++;
        this.stats.creditBalancesMigrated += (latestBalance > 0 ? 1 : 0);
        this.stats.historyEntriesMigrated += totalHistory;

        console.log(`  📝 Unit ${unitId}: ${latestBalance} centavos (${latestBalance / 100} pesos)`);
      }
    }

    console.log(`  ✅ Collected ${Object.keys(creditData).length} units with credit data`);
    return creditData;
  }

  /**
   * Write new credit balance structure
   */
  async writeCreditBalances(clientId, creditData) {
    console.log(`💾 Writing new credit balance structure for ${clientId}...`);
    
    try {
      const creditBalancesRef = this.db
        .collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');

      await creditBalancesRef.set(creditData);

      console.log(`✅ New structure written successfully`);
    } catch (error) {
      console.error(`❌ Failed to write new structure:`, error);
      throw error;
    }
  }

  /**
   * Verify migration integrity
   */
  async verify(clientId) {
    console.log(`\n🔍 Verifying migration for ${clientId}...`);
    
    try {
      // Read new structure
      const newDataDoc = await this.db
        .collection('clients').doc(clientId)
        .collection('units').doc('creditBalances')
        .get();

      if (!newDataDoc.exists) {
        console.log(`❌ New structure not found!`);
        return false;
      }

      const newData = newDataDoc.data();
      const newUnits = Object.keys(newData);
      console.log(`  📊 New structure contains ${newUnits.length} units`);

      // Compare with old structure
      let totalOldBalance = 0;
      let totalNewBalance = 0;

      for (const unitId of newUnits) {
        const newBalance = newData[unitId].creditBalance || 0;
        totalNewBalance += newBalance;

        // Check old structure
        const oldYear = newData[unitId].lastChange.year;
        const oldDoc = await this.db
          .collection('clients').doc(clientId)
          .collection('units').doc(unitId)
          .collection('dues').doc(oldYear)
          .get();

        if (oldDoc.exists) {
          const oldBalance = oldDoc.data().creditBalance || 0;
          totalOldBalance += oldBalance;

          if (oldBalance !== newBalance) {
            console.log(`  ⚠️ Mismatch for unit ${unitId}: old=${oldBalance}, new=${newBalance}`);
          }
        }
      }

      console.log(`  📊 Total old balance: ${totalOldBalance} centavos (${totalOldBalance / 100} pesos)`);
      console.log(`  📊 Total new balance: ${totalNewBalance} centavos (${totalNewBalance / 100} pesos)`);
      console.log(`  ${totalOldBalance === totalNewBalance ? '✅' : '❌'} Balances match!`);

      return totalOldBalance === totalNewBalance;
      
    } catch (error) {
      console.error(`❌ Verification failed:`, error);
      return false;
    }
  }

  /**
   * Rollback migration (restore from backup)
   */
  async rollback(backupFile) {
    console.log(`\n🔄 Rolling back from backup: ${backupFile}`);
    
    try {
      const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      const clientId = backupData.clientId;

      // Delete new structure
      await this.db
        .collection('clients').doc(clientId)
        .collection('units').doc('creditBalances')
        .delete();

      // Restore old structure
      for (const [unitId, yearData] of Object.entries(backupData.units)) {
        for (const [year, data] of Object.entries(yearData)) {
          const duesRef = this.db
            .collection('clients').doc(clientId)
            .collection('units').doc(unitId)
            .collection('dues').doc(year);

          await duesRef.set({
            creditBalance: data.creditBalance,
            creditBalanceHistory: data.creditBalanceHistory,
            updated: data.updated
          }, { merge: true });
        }
      }

      console.log(`✅ Rollback completed successfully`);
      
    } catch (error) {
      console.error(`❌ Rollback failed:`, error);
      throw error;
    }
  }

  /**
   * Print migration statistics
   */
  printStats() {
    console.log('\n📊 Migration Statistics:');
    console.log(`  Clients processed: ${this.stats.clientsProcessed}`);
    console.log(`  Units processed: ${this.stats.unitsProcessed}`);
    console.log(`  Credit balances migrated: ${this.stats.creditBalancesMigrated}`);
    console.log(`  History entries migrated: ${this.stats.historyEntriesMigrated}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (${this.stats.errors.length}):`);
      this.stats.errors.forEach(err => {
        console.log(`  - ${err.clientId}: ${err.error}`);
      });
    } else {
      console.log(`\n✅ No errors!`);
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new CreditBalanceMigration();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noBackup = args.includes('--no-backup');
  const verify = args.includes('--verify');
  const rollback = args.find(arg => arg.startsWith('--rollback='))?.split('=')[1];

  if (rollback) {
    migration.rollback(rollback)
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Rollback failed:', err);
        process.exit(1);
      });
  } else if (verify) {
    migration.initialize()
      .then(() => migration.verify('MTC'))
      .then(() => migration.verify('AVII'))
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Verification failed:', err);
        process.exit(1);
      });
  } else {
    migration.migrate({ dryRun, backup: !noBackup })
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
      });
  }
}

export default CreditBalanceMigration;

