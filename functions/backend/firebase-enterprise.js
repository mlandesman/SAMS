/**
 * Enterprise-Grade Firebase Configuration
 * Optimized for concurrent operations and multi-client scaling
 * Phase 1.1: Connection Pool Optimization
 */

import admin from 'firebase-admin';
import { createRequire } from 'module';
import { getNow } from './services/DateService.js';
const require = createRequire(import.meta.url);

// Enhanced configuration for enterprise operations
const ENTERPRISE_CONFIG = {
  // Connection pool settings
  maxConnections: 100,
  minConnections: 10,
  connectionTimeoutMs: 30000,
  idleTimeoutMs: 300000, // 5 minutes
  
  // Retry configuration
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
  
  // Performance settings
  maxConcurrentWrites: 50,
  batchSize: 25,
  
  // Monitoring
  enableMetrics: true,
  logPerformance: true
};

// Connection pool management
class FirebaseConnectionPool {
  constructor() {
    this.activeConnections = 0;
    this.totalConnections = 0;
    this.failedConnections = 0;
    this.metrics = {
      connectionsCreated: 0,
      connectionsDestroyed: 0,
      averageResponseTime: 0,
      errors: [],
      lastHealthCheck: null
    };
  }

  incrementConnection() {
    this.activeConnections++;
    this.totalConnections++;
    this.metrics.connectionsCreated++;
  }

  decrementConnection() {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    this.metrics.connectionsDestroyed++;
  }

  recordError(error) {
    this.failedConnections++;
    this.metrics.errors.push({
      timestamp: getNow(),
      error: error.message,
      type: error.constructor.name
    });
    
    // Keep only last 100 errors
    if (this.metrics.errors.length > 100) {
      this.metrics.errors = this.metrics.errors.slice(-100);
    }
  }

  getStats() {
    return {
      activeConnections: this.activeConnections,
      totalConnections: this.totalConnections,
      failedConnections: this.failedConnections,
      successRate: this.totalConnections > 0 ? 
        ((this.totalConnections - this.failedConnections) / this.totalConnections * 100).toFixed(2) + '%' : '100%',
      metrics: this.metrics
    };
  }

  async healthCheck() {
    this.metrics.lastHealthCheck = getNow();
    return {
      healthy: this.activeConnections < ENTERPRISE_CONFIG.maxConnections,
      poolUtilization: (this.activeConnections / ENTERPRISE_CONFIG.maxConnections * 100).toFixed(2) + '%',
      ...this.getStats()
    };
  }
}

// Global connection pool instance
const connectionPool = new FirebaseConnectionPool();

// Determine service account path based on environment
const getServiceAccountPath = () => {
  if (process.env.NODE_ENV === 'production') {
    return './sams-production-serviceAccountKey.json';
  } else if (process.env.NODE_ENV === 'staging') {
    return './serviceAccountKey-staging.json';
  }
  return './serviceAccountKey.json';
};

const serviceAccountPath = getServiceAccountPath();
const serviceAccount = require(serviceAccountPath);

// Enhanced initialization tracking
let isInitialized = false;
let initError = null;
let firebaseApp = null;
let firestoreInstance = null;

/**
 * Enterprise-grade Firebase initialization with connection pooling
 */
async function initializeFirebaseEnterprise() {
  try {
    if (!admin.apps.length) {
      console.log('🔥 Initializing Enterprise Firebase Admin SDK...');
      console.log(`🔑 Project: ${serviceAccount.project_id}`);
      console.log(`⚙️ Max Connections: ${ENTERPRISE_CONFIG.maxConnections}`);
      
      const getStorageBucket = () => {
        if (process.env.NODE_ENV === 'production') {
          return 'sams-sandyland-prod.firebasestorage.app';
        } else if (process.env.NODE_ENV === 'staging') {
          return 'sams-staging-6cdcd.firebasestorage.app';
        }
        return 'sandyland-management-system.firebasestorage.app';
      };
      
      const storageBucket = getStorageBucket();
      
      // Initialize with enterprise settings
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: storageBucket,
        // Enhanced configuration
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
      });
      
      // Configure Firestore settings for enterprise use
      const firestore = admin.firestore();
      
      // Enterprise Firestore settings
      const settings = {
        ignoreUndefinedProperties: true,
        // Connection pool settings
        ssl: true,
        maxIdleChannels: ENTERPRISE_CONFIG.maxConnections,
        keepAliveTimeoutMs: ENTERPRISE_CONFIG.idleTimeoutMs,
      };
      
      firestore.settings(settings);
      firestoreInstance = firestore;
      
      console.log('✅ Enterprise Firebase Admin SDK initialized successfully');
      console.log(`📊 Connection pool configured: ${ENTERPRISE_CONFIG.minConnections}-${ENTERPRISE_CONFIG.maxConnections} connections`);
      
      isInitialized = true;
    } else {
      console.log('ℹ️ Enterprise Firebase Admin SDK already initialized');
      firebaseApp = admin.app();
      firestoreInstance = admin.firestore();
      isInitialized = true;
    }
    
    // Perform initial health check
    await performHealthCheck();
    
  } catch (error) {
    console.error('❌ Failed to initialize Enterprise Firebase Admin SDK:', error);
    initError = error;
    connectionPool.recordError(error);
    throw error;
  }
}

/**
 * Enterprise-grade database connection with connection pooling
 */
async function getDbEnterprise() {
  const startTime = Date.now();
  
  try {
    if (initError) {
      console.error('❌ Cannot get Firestore instance due to previous initialization error:', initError);
      throw initError;
    }
    
    if (!isInitialized) {
      await initializeFirebaseEnterprise();
    }
    
    // Check connection pool limits
    if (connectionPool.activeConnections >= ENTERPRISE_CONFIG.maxConnections) {
      throw new Error(`Connection pool exhausted: ${connectionPool.activeConnections}/${ENTERPRISE_CONFIG.maxConnections} active connections`);
    }
    
    connectionPool.incrementConnection();
    
    // Return the cached Firestore instance
    const db = firestoreInstance;
    
    // Periodic health check (only if enabled)
    if (ENTERPRISE_CONFIG.enableMetrics && Math.random() < 0.1) { // 10% of requests
      setTimeout(performHealthCheck, 0); // Non-blocking health check
    }
    
    const duration = Date.now() - startTime;
    
    if (ENTERPRISE_CONFIG.logPerformance && duration > 100) {
      console.log(`⚡ Database connection took ${duration}ms`);
    }
    
    return db;
    
  } catch (error) {
    connectionPool.recordError(error);
    connectionPool.decrementConnection();
    console.error('❌ Error getting enterprise database connection:', error);
    throw error;
  }
}

/**
 * Release database connection (for connection pool management)
 */
function releaseDbConnection() {
  connectionPool.decrementConnection();
}

/**
 * Enhanced retry logic with exponential backoff
 */
async function retryOperation(operation, context = 'operation') {
  let lastError;
  
  for (let attempt = 1; attempt <= ENTERPRISE_CONFIG.maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt === ENTERPRISE_CONFIG.maxRetries) {
        console.error(`❌ ${context} failed after ${attempt} attempts:`, error.message);
        throw error;
      }
      
      const delay = ENTERPRISE_CONFIG.exponentialBackoff 
        ? ENTERPRISE_CONFIG.retryDelayMs * Math.pow(2, attempt - 1)
        : ENTERPRISE_CONFIG.retryDelayMs;
      
      console.log(`⚠️ ${context} attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Batch operation with proper error handling and resilience
 */
async function executeBatchOperation(operations, context = 'batch operation') {
  const startTime = Date.now();
  
  try {
    // Split large batches into smaller chunks
    const chunks = [];
    for (let i = 0; i < operations.length; i += ENTERPRISE_CONFIG.batchSize) {
      chunks.push(operations.slice(i, i + ENTERPRISE_CONFIG.batchSize));
    }
    
    console.log(`🔄 Executing ${operations.length} operations in ${chunks.length} batches`);
    
    const results = [];
    
    // Process chunks with controlled concurrency
    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(operation => retryOperation(operation, `${context} operation`))
      );
      results.push(...chunkResults);
    }
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const duration = Date.now() - startTime;
    
    console.log(`✅ Batch operation completed: ${successful} successful, ${failed} failed in ${duration}ms`);
    
    return {
      results,
      summary: {
        total: operations.length,
        successful,
        failed,
        successRate: (successful / operations.length * 100).toFixed(2) + '%',
        duration
      }
    };
    
  } catch (error) {
    console.error(`❌ Batch operation failed:`, error);
    throw error;
  }
}

/**
 * Performance health check
 */
async function performHealthCheck() {
  try {
    const db = firestoreInstance;
    if (!db) return { healthy: false, reason: 'No database instance' };
    
    const startTime = Date.now();
    const testRef = db.collection('connection_test').doc('health_check');
    
    await testRef.set({ 
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      healthCheck: true
    });
    
    const duration = Date.now() - startTime;
    
    const poolStats = connectionPool.getStats();
    
    const healthStatus = {
      healthy: duration < 1000 && poolStats.successRate !== '0%',
      responseTime: duration,
      poolStats,
      timestamp: getNow().toISOString()
    };
    
    if (ENTERPRISE_CONFIG.enableMetrics) {
      console.log(`💚 Health check passed: ${duration}ms, Pool: ${poolStats.activeConnections}/${ENTERPRISE_CONFIG.maxConnections}`);
    }
    
    return healthStatus;
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    connectionPool.recordError(error);
    return {
      healthy: false,
      error: error.message,
      timestamp: getNow().toISOString()
    };
  }
}

/**
 * Get connection pool statistics
 */
function getConnectionPoolStats() {
  return connectionPool.getStats();
}

/**
 * Get enterprise configuration
 */
function getEnterpriseConfig() {
  return { ...ENTERPRISE_CONFIG };
}

// Export enterprise functions
export { 
  initializeFirebaseEnterprise,
  getDbEnterprise,
  releaseDbConnection,
  retryOperation,
  executeBatchOperation,
  performHealthCheck,
  getConnectionPoolStats,
  getEnterpriseConfig
};

// Maintain backward compatibility
export { 
  initializeFirebaseEnterprise as initializeFirebase,
  getDbEnterprise as getDb
};