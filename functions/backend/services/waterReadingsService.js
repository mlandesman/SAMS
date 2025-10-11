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
  async saveReadings(clientId, year, month, payload) {
    await this._initializeDb();
    
    console.log('🔍 Service received payload:', JSON.stringify(payload, null, 2));
    
    // CRITICAL FIX: Ensure waterBills document has properties to prevent ghost status
    const waterBillsRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills');
    
    // Check if waterBills document exists, if not create it with a property
    const waterBillsDoc = await waterBillsRef.get();
    if (!waterBillsDoc.exists) {
      console.log('🔧 Creating waterBills document to prevent ghost status...');
      await waterBillsRef.set({
        _purgeMarker: 'DO_NOT_DELETE',
        _createdBy: 'waterReadingsService',
        _createdAt: admin.firestore.FieldValue.serverTimestamp(),
        _structure: 'waterBills'
      });
      console.log('✅ waterBills document created with properties');
    }
    
    const docId = `${year}-${String(month).padStart(2, '0')}`;
    const docRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('readings').doc(docId);
    
    // Ensure readings field exists and is not undefined
    const readings = payload.readings || {};
    
    // Build proper document structure with buildingMeter/commonArea at root level
    const data = {
      year,
      month,
      readings, // Only unit readings (101, 102, etc.)
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Add buildingMeter and commonArea at root level if provided
    if (payload.buildingMeter !== undefined && payload.buildingMeter !== null) {
      data.buildingMeter = payload.buildingMeter;
    }
    if (payload.commonArea !== undefined && payload.commonArea !== null) {
      data.commonArea = payload.commonArea;
    }
    
    console.log('💾 Final data to save:', JSON.stringify(data, null, 2));
    
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
    let priorMonthData = priorYearDoc.exists ? priorYearDoc.data() : {};
    let priorMonthReadings = priorMonthData.readings || {};
    let priorBuildingMeter = priorMonthData.buildingMeter || 0;
    let priorCommonArea = priorMonthData.commonArea || 0;
    
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
      
      // For each unit meter, calculate consumption
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
      
      // Handle buildingMeter at root level if present
      if (data.buildingMeter !== undefined) {
        monthData.buildingMeter = {
          reading: data.buildingMeter,
          consumption: data.buildingMeter - priorBuildingMeter,
          prior: priorBuildingMeter
        };
        priorBuildingMeter = data.buildingMeter;
      }
      
      // Handle commonArea at root level if present
      if (data.commonArea !== undefined) {
        monthData.commonArea = {
          reading: data.commonArea,
          consumption: data.commonArea - priorCommonArea,
          prior: priorCommonArea
        };
        priorCommonArea = data.commonArea;
      }
      
      readings[data.month] = monthData;
      
      // Current month becomes prior for next month
      priorMonthReadings = currentReadings;
    });
    
    return readings;
  }
}

export default new WaterReadingsService();