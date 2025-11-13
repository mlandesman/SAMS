/**
 * ReportEngine - Base class for all reporting services
 * Provides common functionality for user profiles, client info, and template loading
 */

import { getDb } from '../firebase.js';

export class ReportEngine {
  constructor(clientId, reportType) {
    this.clientId = clientId;
    this.reportType = reportType;
    this.db = null;
  }

  /**
   * Initialize Firestore database connection
   * @private
   */
  async _initializeDb() {
    if (!this.db) {
      this.db = await getDb();
    }
  }

  /**
   * Get user profile including language preference
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile with preferredLanguage
   */
  async getUserProfile(userId) {
    await this._initializeDb();
    
    const userDoc = await this.db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new Error(`User not found: ${userId}`);
    }
    
    const userData = userDoc.data();
    
    return {
      userId: userDoc.id,
      email: userData.email || '',
      name: userData.name || '',
      preferredLanguage: userData.profile?.preferredLanguage || 'english',
      ...userData
    };
  }

  /**
   * Get client information including name, logo, branding
   * @returns {Promise<Object>} Client info
   */
  async getClientInfo() {
    await this._initializeDb();
    
    const clientDoc = await this.db.collection('clients').doc(this.clientId).get();
    
    if (!clientDoc.exists) {
      throw new Error(`Client not found: ${this.clientId}`);
    }
    
    const clientData = clientDoc.data();
    
    return {
      clientId: this.clientId,
      name: clientData.name || '',
      logoUrl: clientData.logoUrl || null,
      address: clientData.address || null,
      contactInfo: clientData.contactInfo || null,
      ...clientData
    };
  }

  /**
   * Load template (placeholder for Phase 3 - PDF generation)
   * @param {string} templateName - Template name
   * @returns {Promise<Object>} Template data (placeholder)
   */
  async loadTemplate(templateName) {
    // Placeholder for Phase 3 - PDF generation
    return {
      templateName,
      status: 'placeholder',
      message: 'Template loading will be implemented in Phase 3'
    };
  }
}

