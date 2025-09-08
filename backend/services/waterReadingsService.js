// MINIMAL Water Readings Service - Phase 1 ONLY
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import { waterDataService } from './waterDataService.js';

class WaterReadingsService {
  constructor() {
    this.db = null;
  }

  async _initializeDb() {
    if (!this.db) {
      this.db = await getDb();
    }
  }

  // Save readings for a month
  async saveReadings(clientId, year, month, readings) {
    await this._initializeDb();
    
    const docId = `${year}-${String(month).padStart(2, '0')}`;
    const docRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('readings').doc(docId);
    
    const data = {
      year,
      month,
      readings,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await docRef.set(data);
    
    // Invalidate cache for this year
    waterDataService.invalidate(clientId, year);
    
    // Also invalidate next year if this is month 11 (affects month 0 prior reading)
    if (month === 11) {
      waterDataService.invalidate(clientId, year + 1);
    }
    
    return data;
  }

  // Get readings for a month
  async getMonthReadings(clientId, year, month) {
    await this._initializeDb();
    
    const docId = `${year}-${String(month).padStart(2, '0')}`;
    const doc = await this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('readings').doc(docId)
      .get();
    
    return doc.exists ? doc.data() : null;
  }

  // Get all readings for a year with consumption calculations
  async getYearReadings(clientId, year) {
    await this._initializeDb();
    
    const readingsRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('readings');
    
    // Get prior year's last month (June/month 11) for baseline
    const priorYearDoc = await readingsRef.doc(`${year-1}-11`).get();
    let priorMonthReadings = priorYearDoc.exists ? priorYearDoc.data().readings : {};
    
    // Get all documents for the fiscal year
    // Note: Can't use orderBy with where without an index, so we'll sort in memory
    const snapshot = await readingsRef
      .where('year', '==', year)
      .get();
    
    const readings = {};
    
    // Sort documents by month in memory
    const sortedDocs = snapshot.docs.sort((a, b) => {
      return a.data().month - b.data().month;
    });
    
    // Process each month to calculate consumption
    sortedDocs.forEach(doc => {
      const data = doc.data();
      const currentReadings = data.readings;
      const monthData = {};
      
      // For each meter, calculate consumption
      for (const unitId in currentReadings) {
        const current = currentReadings[unitId];
        const prior = priorMonthReadings[unitId] || 0;
        
        // Store both reading and consumption
        monthData[unitId] = {
          reading: current,
          consumption: current - prior,
          prior: prior
        };
      }
      
      readings[data.month] = monthData;
      
      // Current month becomes prior for next month
      priorMonthReadings = currentReadings;
    });
    
    return readings;
  }
}

export default new WaterReadingsService();