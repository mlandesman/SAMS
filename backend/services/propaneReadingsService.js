// Propane Readings Service - Data collection only (no billing)
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

class PropaneReadingsService {
  constructor() {
    this.db = null;
  }

  async _initializeDb() {
    if (!this.db) {
      this.db = await getDb();
    }
  }

  // Save readings for a month
  async saveReadings(clientId, year, month, payload) {
    await this._initializeDb();
    
    console.log('🔍 Propane service received payload:', JSON.stringify(payload, null, 2));
    
    // CRITICAL: Ensure propaneTanks document has properties to prevent ghost status
    const propaneTanksRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('propaneTanks');
    
    // Check if propaneTanks document exists, if not create it with a property
    const propaneTanksDoc = await propaneTanksRef.get();
    if (!propaneTanksDoc.exists) {
      console.log('🔧 Creating propaneTanks document to prevent ghost status...');
      await propaneTanksRef.set({
        _purgeMarker: 'DO_NOT_DELETE',
        _createdBy: 'propaneReadingsService',
        _createdAt: admin.firestore.FieldValue.serverTimestamp(),
        _structure: 'propaneTanks'
      });
      console.log('✅ propaneTanks document created with properties');
    }
    
    const docId = `${year}-${String(month).padStart(2, '0')}`;
    const docRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('propaneTanks')
      .collection('readings').doc(docId);
    
    // Ensure readings field exists and is not undefined
    const readings = payload.readings || {};
    
    // Build proper document structure
    const data = {
      year,
      month,
      readings, // Unit readings with level percentage (0-100)
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('💾 Final data to save:', JSON.stringify(data, null, 2));
    
    await docRef.set(data);
    
    return data;
  }

  // Get readings for a month
  async getMonthReadings(clientId, year, month) {
    await this._initializeDb();
    
    const docId = `${year}-${String(month).padStart(2, '0')}`;
    const doc = await this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('propaneTanks')
      .collection('readings').doc(docId)
      .get();
    
    return doc.exists ? doc.data() : null;
  }

  /**
   * Batch check which months have readings (lightweight - existence check only)
   * Returns a map of month -> boolean indicating if readings exist
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   * @returns {Promise<Object>} Map of month (0-11) -> boolean
   */
  async getReadingsExistenceForYear(clientId, year) {
    await this._initializeDb();
    
    // Build document references for all 12 months
    const docRefs = [];
    const monthKeys = [];
    
    for (let month = 0; month < 12; month++) {
      const docId = `${year}-${String(month).padStart(2, '0')}`;
      docRefs.push(
        this.db
          .collection('clients').doc(clientId)
          .collection('projects').doc('propaneTanks')
          .collection('readings').doc(docId)
      );
      monthKeys.push(month);
    }
    
    // Batch fetch all documents (existence check only)
    const snapshots = await this.db.getAll(...docRefs);
    
    // Build results map
    const results = {};
    snapshots.forEach((snapshot, index) => {
      const month = monthKeys[index];
      // Check if document exists AND has readings data
      const hasReadings = snapshot.exists && 
        snapshot.data()?.readings && 
        Object.keys(snapshot.data().readings).length > 0;
      results[month] = hasReadings;
    });
    
    return results;
  }

  /**
   * Get aggregated data for a year (all months with prior levels)
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   * @returns {Promise<Object>} Year data with months array
   */
  async getAggregatedData(clientId, year) {
    await this._initializeDb();
    
    const readingsRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('propaneTanks')
      .collection('readings');
    
    // Get prior year's last month (month 11) for baseline
    const priorYearDoc = await readingsRef.doc(`${year-1}-11`).get();
    let priorMonthReadings = priorYearDoc.exists ? (priorYearDoc.data().readings || {}) : {};
    
    // Get all documents for the fiscal year
    const snapshot = await readingsRef
      .where('year', '==', year)
      .get();
    
    const months = [];
    
    // Sort documents by month in memory
    const sortedDocs = snapshot.docs.sort((a, b) => {
      return a.data().month - b.data().month;
    });
    
    // Process each month
    sortedDocs.forEach(doc => {
      const data = doc.data();
      const currentReadings = data.readings || {};
      const monthData = {};
      
      // For each unit, store level and prior level
      for (const unitId in currentReadings) {
        const current = currentReadings[unitId];
        const prior = priorMonthReadings[unitId] || null;
        
        monthData[unitId] = {
          level: typeof current === 'object' ? current.level : current,
          priorLevel: prior ? (typeof prior === 'object' ? prior.level : prior) : null
        };
      }
      
      months.push({
        month: data.month,
        year: data.year,
        fiscalYear: year,
        readings: monthData
      });
      
      // Current month becomes prior for next month
      priorMonthReadings = currentReadings;
    });
    
    // Build summary
    const summary = {
      totalUnits: 0,
      lowLevelUnits: 0, // 10-30%
      criticalUnits: 0  // 0-10%
    };
    
    // Calculate summary from last month's data
    if (months.length > 0) {
      const lastMonth = months[months.length - 1];
      const units = Object.keys(lastMonth.readings);
      summary.totalUnits = units.length;
      
      units.forEach(unitId => {
        const level = lastMonth.readings[unitId].level;
        if (level <= 10) {
          summary.criticalUnits++;
        } else if (level <= 30) {
          summary.lowLevelUnits++;
        }
      });
    }
    
    return {
      data: {
        months
      },
      summary
    };
  }
}

export default new PropaneReadingsService();
