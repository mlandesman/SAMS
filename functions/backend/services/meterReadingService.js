// src/services/meterReadingService.js
import { getDb } from '../firebase.js';
import { DateService } from './DateService.js';
import admin from 'firebase-admin';
import { randomUUID } from 'crypto';

/**
 * Generic Meter Reading Service
 * Handles meter readings for any meter type (water, propane, electricity)
 * Follows unit-centric data architecture for automatic security inheritance
 */
class MeterReadingService {
  constructor(meterType = 'meter') {
    this.meterType = meterType;
    this.dateService = new DateService({ timezone: 'America/Cancun' });
    this.dbInstance = null;
  }

  /**
   * Initialize database connection if not already done
   * @private
   */
  async _initializeDb() {
    if (!this.dbInstance) {
      this.dbInstance = await getDb();
    }
  }

  /**
   * Get the Firestore collection path for meter readings
   * Follows unit-centric pattern: /clients/{clientId}/units/{unitId}/{meterType}/{year}/readings
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier (unitId field, not id)
   * @param {number} year - Year for readings
   * @returns {string} Firestore collection path
   */
  getCollectionPath(clientId, unitId, year) {
    return `clients/${clientId}/units/${unitId}/${this.meterType}/${year}`;
  }

  /**
   * Get the readings subcollection reference
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {number} year - Year for readings
   * @returns {FirestoreCollectionReference} Readings subcollection reference
   */
  async getReadingsCollection(clientId, unitId, year) {
    await this._initializeDb();
    const basePath = this.getCollectionPath(clientId, unitId, year);
    return this.dbInstance.collection(`${basePath}/readings`);
  }

  /**
   * Record a meter reading
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier (unitId field, not id)
   * @param {number} year - Year for the reading
   * @param {Object} readingData - Reading data
   * @param {number} readingData.reading - Meter reading value
   * @param {string|Date|FirestoreTimestamp} readingData.date - Reading date
   * @param {string} [readingData.notes] - Optional notes
   * @param {string} [readingData.readBy] - Who took the reading
   * @returns {Object} Created reading document with metadata
   */
  async recordReading(clientId, unitId, year, readingData) {
    try {
      await this._initializeDb();

      // Validate required fields
      if (!readingData.reading || typeof readingData.reading !== 'number') {
        throw new Error('Reading value is required and must be a number');
      }

      if (!readingData.date) {
        throw new Error('Reading date is required');
      }

      // Convert date to Firestore timestamp
      let timestamp;
      if (readingData.date && typeof readingData.date.toDate === 'function') {
        // Already a Firestore timestamp
        timestamp = readingData.date;
      } else if (readingData.date instanceof Date) {
        timestamp = admin.firestore.Timestamp.fromDate(readingData.date);
      } else if (typeof readingData.date === 'string') {
        // Parse string date in Mexico timezone
        timestamp = this.dateService.parseFromFrontend(readingData.date, 'yyyy-MM-dd');
      } else {
        throw new Error('Invalid date format provided');
      }

      // Create reading document (no need to store unitId - it's in the path)
      const readingDoc = {
        meterType: this.meterType,
        reading: readingData.reading,
        date: timestamp,
        notes: readingData.notes || '',
        readBy: readingData.readBy || '',
        created: admin.firestore.Timestamp.now(),
        updated: admin.firestore.Timestamp.now()
      };

      // Generate unique document ID (no prefix needed - we're already in readings collection)
      const readingId = `${Date.now()}-${randomUUID().substring(0, 8)}`;
      
      // Get readings collection and save document
      const readingsCollection = await this.getReadingsCollection(clientId, unitId, year);
      await readingsCollection.doc(readingId).set(readingDoc);

      console.log(`Recorded ${this.meterType} reading for unit ${unitId}, year ${year}:`, readingDoc);

      // Return document with formatted date for frontend
      return {
        id: readingId,
        unitId,  // Include unitId for frontend convenience
        ...readingDoc,
        dateFormatted: this.dateService.formatForFrontend(timestamp),
        firestorePath: `${this.getCollectionPath(clientId, unitId, year)}/readings/${readingId}`
      };

    } catch (error) {
      console.error(`Error recording ${this.meterType} reading:`, error);
      throw error;
    }
  }

  /**
   * Get reading history for a unit
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier (unitId field, not id)
   * @param {number} year - Year for readings
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Maximum number of readings to return
   * @param {string} [options.orderBy] - Field to order by (default: 'date')
   * @param {string} [options.orderDirection] - Order direction ('asc' or 'desc', default: 'desc')
   * @returns {Array} Array of reading documents with formatted dates
   */
  async getUnitHistory(clientId, unitId, year, options = {}) {
    try {
      await this._initializeDb();

      const readingsCollection = await this.getReadingsCollection(clientId, unitId, year);
      
      // Build query
      let query = readingsCollection.orderBy(
        options.orderBy || 'date', 
        options.orderDirection || 'desc'
      );

      // Apply limit if specified
      if (options.limit) {
        query = query.limit(options.limit);
      }

      // Execute query
      const snapshot = await query.get();
      
      // Format results for frontend
      const readings = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        readings.push({
          id: doc.id,
          unitId,  // Add unitId from parameter since it's not stored in document
          ...data,
          dateFormatted: this.dateService.formatForFrontend(data.date),
          createdFormatted: this.dateService.formatForFrontend(data.created),
          updatedFormatted: this.dateService.formatForFrontend(data.updated)
        });
      });

      console.log(`Retrieved ${readings.length} ${this.meterType} readings for unit ${unitId}, year ${year}`);
      return readings;

    } catch (error) {
      console.error(`Error getting ${this.meterType} history:`, error);
      throw error;
    }
  }

  /**
   * Archive a unit's readings for a year
   * Moves all readings to an archive subcollection
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier (unitId field, not id)
   * @param {number} year - Year to archive
   * @returns {Object} Archive operation result
   */
  async archiveUnitYear(clientId, unitId, year) {
    try {
      await this._initializeDb();

      const readingsCollection = await this.getReadingsCollection(clientId, unitId, year);
      const archiveCollection = this.dbInstance.collection(
        `${this.getCollectionPath(clientId, unitId, year)}/archive`
      );

      // Get all readings for the year
      const snapshot = await readingsCollection.get();
      
      if (snapshot.empty) {
        return {
          success: true,
          message: `No ${this.meterType} readings found to archive for unit ${unitId}, year ${year}`,
          archivedCount: 0
        };
      }

      // Process in batches (Firestore batch limit is 500)
      const batchSize = 500;
      const docs = snapshot.docs;
      let archivedCount = 0;

      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = this.dbInstance.batch();
        const batchDocs = docs.slice(i, i + batchSize);

        batchDocs.forEach(doc => {
          const data = doc.data();
          
          // Add archive metadata
          const archiveDoc = {
            ...data,
            archivedAt: admin.firestore.Timestamp.now(),
            originalPath: `${this.getCollectionPath(clientId, unitId, year)}/readings/${doc.id}`
          };

          // Add to archive collection
          batch.set(archiveCollection.doc(doc.id), archiveDoc);
          
          // Delete from active collection
          batch.delete(doc.ref);
        });

        await batch.commit();
        archivedCount += batchDocs.length;
        
        console.log(`Archived batch of ${batchDocs.length} ${this.meterType} readings (${archivedCount}/${docs.length} total)`);
      }

      console.log(`Successfully archived ${archivedCount} ${this.meterType} readings for unit ${unitId}, year ${year}`);

      return {
        success: true,
        message: `Archived ${archivedCount} ${this.meterType} readings for unit ${unitId}, year ${year}`,
        archivedCount,
        archivePath: `${this.getCollectionPath(clientId, unitId, year)}/archive`
      };

    } catch (error) {
      console.error(`Error archiving ${this.meterType} readings:`, error);
      throw error;
    }
  }

  /**
   * Get the latest reading for a unit
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier (unitId field, not id)
   * @param {number} year - Year for readings
   * @returns {Object|null} Latest reading document or null if no readings found
   */
  async getLatestReading(clientId, unitId, year) {
    try {
      const readings = await this.getUnitHistory(clientId, unitId, year, {
        limit: 1,
        orderBy: 'date',
        orderDirection: 'desc'
      });

      return readings.length > 0 ? readings[0] : null;

    } catch (error) {
      console.error(`Error getting latest ${this.meterType} reading:`, error);
      throw error;
    }
  }

  /**
   * Calculate consumption between two readings
   * @param {Object} currentReading - Current reading document
   * @param {Object} previousReading - Previous reading document
   * @returns {Object} Consumption calculation result
   */
  calculateConsumption(currentReading, previousReading) {
    if (!currentReading || !previousReading) {
      return {
        consumption: 0,
        period: 0,
        error: 'Missing reading data for calculation'
      };
    }

    if (currentReading.reading < previousReading.reading) {
      return {
        consumption: 0,
        period: 0,
        error: 'Current reading is less than previous reading - possible meter rollover'
      };
    }

    // Calculate consumption
    const consumption = currentReading.reading - previousReading.reading;
    
    // Calculate period in days
    const currentDate = currentReading.date.toDate ? currentReading.date.toDate() : new Date(currentReading.date);
    const previousDate = previousReading.date.toDate ? previousReading.date.toDate() : new Date(previousReading.date);
    const periodMs = currentDate.getTime() - previousDate.getTime();
    const periodDays = Math.round(periodMs / (1000 * 60 * 60 * 24));

    return {
      consumption,
      period: periodDays,
      currentReading: currentReading.reading,
      previousReading: previousReading.reading,
      currentDate: this.dateService.formatForFrontend(currentDate),
      previousDate: this.dateService.formatForFrontend(previousDate)
    };
  }
}

export { MeterReadingService };