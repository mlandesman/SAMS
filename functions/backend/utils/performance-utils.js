/**
 * Performance Utilities
 * Helper functions for monitoring and optimizing backend performance
 */

// Simple request timing middleware
export function createTimingMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) { // Log slow requests (>1s)
        console.warn(`⚠️ Slow request: ${req.method} ${req.path} - ${duration}ms`);
      }
    });
    
    next();
  };
}

// Memory usage monitoring
export function logMemoryUsage(label = 'Memory') {
  const used = process.memoryUsage();
  const usage = {};
  for (let key in used) {
    usage[key] = Math.round(used[key] / 1024 / 1024 * 100) / 100 + ' MB';
  }
  console.log(`📊 ${label}:`, usage);
}

// Database query timing wrapper
export async function timeQuery(queryName, queryFn) {
  const start = Date.now();
  try {
    const result = await queryFn();
    const duration = Date.now() - start;
    
    if (duration > 500) { // Log slow queries (>500ms)
      console.warn(`🐌 Slow query [${queryName}]: ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ Failed query [${queryName}]: ${duration}ms`, error);
    throw error;
  }
}

// Simple in-memory cache with TTL
export class SimpleCache {
  constructor(ttlMs = 5 * 60 * 1000) {
    this.cache = new Map();
    this.ttl = ttlMs;
  }
  
  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  clear() {
    this.cache.clear();
  }
  
  size() {
    return this.cache.size;
  }
}

// Batch operation helper
export class BatchProcessor {
  constructor(batchSize = 10, delayMs = 100) {
    this.batchSize = batchSize;
    this.delay = delayMs;
    this.queue = [];
    this.processing = false;
  }
  
  async add(operation) {
    this.queue.push(operation);
    
    if (!this.processing && this.queue.length >= this.batchSize) {
      await this.processBatch();
    }
  }
  
  async processBatch() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);
    
    try {
      await Promise.all(batch.map(op => op()));
    } catch (error) {
      console.error('❌ Batch processing error:', error);
    }
    
    this.processing = false;
    
    // Process next batch if queue has items
    if (this.queue.length > 0) {
      setTimeout(() => this.processBatch(), this.delay);
    }
  }
  
  async flush() {
    while (this.queue.length > 0) {
      await this.processBatch();
    }
  }
}
