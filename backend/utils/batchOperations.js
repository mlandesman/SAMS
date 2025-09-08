/**
 * Enterprise Batch Operations System
 * Replaces Promise.all() with resilient batch processing
 * Phase 1.2: Batch Operation Resilience
 */

import { retryOperation, executeBatchOperation, getDbEnterprise, releaseDbConnection } from '../firebase-enterprise.js';

// Batch operation configuration
const BATCH_CONFIG = {
  maxConcurrentOperations: 10,
  maxBatchSize: 25,
  retryAttempts: 3,
  retryDelay: 1000,
  timeoutMs: 30000,

  // Performance monitoring
  logBatchPerformance: true,
  warnSlowBatches: true,
  slowBatchThreshold: 5000 // 5 seconds
};

/**
 * Enhanced batch processor that replaces Promise.all()
 */
class EnterpriseBatchProcessor {
  constructor(options = {}) {
    this.config = { ...BATCH_CONFIG, ...options };
    this.stats = {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageBatchTime: 0,
      errors: []
    };
  }

  /**
   * Process operations with resilient batch handling
   */
  async processBatch(operations, context = 'batch') {
    const batchId = this.generateBatchId();
    const startTime = Date.now();

    this.stats.totalBatches++;
    this.stats.totalOperations += operations.length;

    console.log(`🔄 Starting batch ${batchId}: ${operations.length} operations (${context})`);

    try {

      if (!Array.isArray(operations) || operations.length === 0) {
        throw new Error('Invalid operations array provided');
      }

      // Split into manageable chunks
      const chunks = this.createChunks(operations);
      console.log(`📦 Split into ${chunks.length} chunks of max ${this.config.maxBatchSize} operations`);

      const allResults = [];
      let chunkIndex = 0;

      // Process chunks with controlled concurrency
      for (const chunk of chunks) {
        chunkIndex++;
        const chunkStart = Date.now();

        try {

          const chunkPromises = chunk.map((operation, index) =>
            this.executeOperationWithRetry(operation, `${context}-chunk${chunkIndex}-op${index}`)
          );

          // Use Promise.allSettled for resilient execution
          const chunkResults = await Promise.allSettled(chunkPromises);
          allResults.push(...chunkResults);

          const chunkDuration = Date.now() - chunkStart;
          const chunkSuccessful = chunkResults.filter(r => r.status === 'fulfilled').length;
          const chunkFailed = chunkResults.filter(r => r.status === 'rejected').length;

          console.log(`  ✅ Chunk ${chunkIndex}/${chunks.length}: ${chunkSuccessful}/${chunk.length} successful in ${chunkDuration}ms`);

          if (chunkFailed > 0) {
            console.log(`  ⚠️ Chunk ${chunkIndex} had ${chunkFailed} failures`);
          }

          if (chunkIndex < chunks.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }

        } catch (error) {
          console.error(`❌ Chunk ${chunkIndex} processing failed:`, error);
          // Continue with other chunks even if one fails
          allResults.push({ status: 'rejected', reason: error });
        }
      }

      // Analyze results
      const analysis = this.analyzeResults(allResults, batchId, startTime);

      this.updateStats(analysis);

      // Log performance warning if needed
      if (this.config.warnSlowBatches && analysis.duration > this.config.slowBatchThreshold) {
        console.log(`⚠️ Slow batch detected: ${analysis.duration}ms for ${operations.length} operations`);
      }

      return analysis;

    } catch (error) {
      console.error(`❌ Batch ${batchId} failed:`, error);
      this.stats.failedBatches++;
      this.recordError(error, batchId);
      throw error;
    }
  }

  /**
   * Execute single operation with retry logic
   */
  async executeOperationWithRetry(operation, context) {
    return retryOperation(async () => {

      return Promise.race([
        operation(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Operation timeout: ${context}`)), this.config.timeoutMs)
        )
      ]);
    }, context);
  }

  /**
   * Create chunks from operations array
   */
  createChunks(operations) {
    const chunks = [];
    for (let i = 0; i < operations.length; i += this.config.maxBatchSize) {
      chunks.push(operations.slice(i, i + this.config.maxBatchSize));
    }
    return chunks;
  }

  /**
   * Analyze batch results
   */
  analyzeResults(results, batchId, startTime) {
    const duration = Date.now() - startTime;
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const successRate = (successful / results.length * 100).toFixed(2);

    const analysis = {
      batchId,
      duration,
      total: results.length,
      successful,
      failed,
      successRate: parseFloat(successRate),
      throughput: (results.length / (duration / 1000)).toFixed(2),
      results,
      timestamp: new Date().toISOString()
    };

    if (this.config.logBatchPerformance) {
      console.log(`📊 Batch ${batchId} completed: ${successful}/${results.length} successful (${successRate}%) in ${duration}ms`);
      console.log(`🚀 Throughput: ${analysis.throughput} ops/sec`);
    }

    return analysis;
  }

  /**
   * Update internal statistics
   */
  updateStats(analysis) {
    if (analysis.failed === 0) {
      this.stats.successfulBatches++;
    } else {
      this.stats.failedBatches++;
    }

    this.stats.successfulOperations += analysis.successful;
    this.stats.failedOperations += analysis.failed;

    const totalTime = this.stats.averageBatchTime * (this.stats.totalBatches - 1) + analysis.duration;
    this.stats.averageBatchTime = Math.round(totalTime / this.stats.totalBatches);
  }

  /**
   * Record error for debugging
   */
  recordError(error, batchId) {
    this.stats.errors.push({
      batchId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Keep only last 50 errors
    if (this.stats.errors.length > 50) {
      this.stats.errors = this.stats.errors.slice(-50);
    }
  }

  /**
   * Generate unique batch ID
   */
  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get processor statistics
   */
  getStats() {
    return {
      ...this.stats,
      batchSuccessRate: this.stats.totalBatches > 0 ?
        (this.stats.successfulBatches / this.stats.totalBatches * 100).toFixed(2) + '%' : '100%',
      operationSuccessRate: this.stats.totalOperations > 0 ?
        (this.stats.successfulOperations / this.stats.totalOperations * 100).toFixed(2) + '%' : '100%'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageBatchTime: 0,
      errors: []
    };
  }
}

/**
 * Global batch processor instance
 */
const globalBatchProcessor = new EnterpriseBatchProcessor();

/**
 * Convenient function for processing batches
 */
export async function processBatchOperations(operations, context = 'operation', options = {}) {
  const processor = options.useGlobal !== false ? globalBatchProcessor : new EnterpriseBatchProcessor(options);
  return processor.processBatch(operations, context);
}

/**
 * Enhanced balance operations using enterprise batch processing
 */
export // Performance: Monitor this operation for response time
  async function create$2(clientId, balanceDataArray) {
  const operations = balanceDataArray.map(({ monthId, data }) => async () => {
    const db = await getDbEnterprise();
    try {
      const balanceRef = db.doc(`clients/${clientId}/balances/${monthId}`);
      await balanceRef.set({
        ...data,
        createdAt: new Date(),
        batchCreated: true
      });
      return { success: true, monthId };
    } catch (error) {
      console.error(`❌ Failed to create balance ${monthId}:`, error);
      throw error;
    } finally {
      releaseDbConnection();
    }
  });

  const result = await processBatchOperations(operations, `create-balances-${clientId}`);

  // Transform result to match expected structure
  return {
    success: result.failed === 0,
    summary: {
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      successRate: result.successRate + '%'
    },
    results: result.results,
    errors: result.failed > 0 ? ['Some operations failed'] : [],

    successful: result.successful,
    failed: result.failed,
    total: result.total,
    successRate: result.successRate + '%'
  };
}

/**
 * Enhanced transaction operations using enterprise batch processing
 */
export async function processTransactionsBatch(clientId, transactionDataArray) {
  const operations = transactionDataArray.map(({ transactionId, data }) => async () => {
    const db = await getDbEnterprise();
    try {
      const transactionRef = db.doc(`clients/${clientId}/transactions/${transactionId}`);

      const existingDoc = await transactionRef.get();
      if (existingDoc.exists) {
        throw new Error(`Transaction ${transactionId} already exists`);
      }

      await transactionRef.set({
        ...data,
        createdAt: new Date(),
        processedAt: new Date(),
        batchProcessed: true,
        version: 1,
        enterprise: {
          created: true,
          source: 'batch-processor',
          timestamp: new Date().toISOString()
        }
      });
      return { success: true, transactionId };
    } catch (error) {
      console.error(`❌ Failed to process transaction ${transactionId}:`, error);
      throw error;
    } finally {
      releaseDbConnection();
    }
  });

  const result = await processBatchOperations(operations, `process-transactions-${clientId}`);

  // Transform result to match expected structure
  return {
    success: result.failed === 0,
    summary: {
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      successRate: result.successRate + '%'
    },
    results: result.results,
    errors: result.failed > 0 ? ['Some operations failed'] : [],

    successful: result.successful,
    failed: result.failed,
    total: result.total,
    successRate: result.successRate + '%'
  };
}

/**
 * Get global batch processor statistics
 */
export function getBatchProcessorStats() {
  return globalBatchProcessor.getStats();
}

/**
 * Reset global batch processor statistics
 */
export function resetBatchProcessorStats() {
  globalBatchProcessor.resetStats();
}

export { EnterpriseBatchProcessor, BATCH_CONFIG };