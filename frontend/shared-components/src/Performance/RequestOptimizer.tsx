/**
 * Request Optimization Service for Enterprise Backend Integration
 * FRONTEND-ALIGNMENT-001 - Phase 2.1
 * 
 * Optimizes API requests to leverage enterprise backend capabilities
 * including request deduplication, intelligent caching, and connection reuse
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ConnectionManager } from './ConnectionManager';
import { PerformanceMonitor } from '../ErrorHandling/PerformanceErrorMonitor';

/**
 * Request cache entry
 */
interface CacheEntry {
  data: any;
  timestamp: number;
  expiry: number;
  etag?: string;
  lastModified?: string;
  requestKey: string;
}

/**
 * Request optimization configuration
 */
export interface RequestOptimizerConfig {
  // Caching
  enableCaching: boolean;
  defaultCacheTTL: number;
  maxCacheSize: number;
  
  // Deduplication
  enableDeduplication: boolean;
  deduplicationWindow: number;
  
  // Request coalescing
  enableCoalescing: boolean;
  coalescingWindow: number;
  
  // Prefetching
  enablePrefetching: boolean;
  prefetchThreshold: number;
  
  // Compression
  enableCompression: boolean;
  compressionThreshold: number;
}

/**
 * Default optimization configuration
 */
const DEFAULT_OPTIMIZER_CONFIG: RequestOptimizerConfig = {
  enableCaching: true,
  defaultCacheTTL: 300000,        // 5 minutes
  maxCacheSize: 100,              // 100 entries
  
  enableDeduplication: true,
  deduplicationWindow: 1000,      // 1 second
  
  enableCoalescing: true,
  coalescingWindow: 50,           // 50ms
  
  enablePrefetching: true,
  prefetchThreshold: 0.8,         // 80% cache hit rate
  
  enableCompression: true,
  compressionThreshold: 1024      // 1KB
};

/**
 * Pending request tracking
 */
interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
  resolvers: Array<{
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>;
}

/**
 * Request optimization service
 */
export class RequestOptimizer {
  private static instance: RequestOptimizer;
  private config: RequestOptimizerConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestStats: Map<string, { hits: number; misses: number; lastAccess: number }> = new Map();
  private connectionManager: ConnectionManager;
  private performanceMonitor: PerformanceMonitor;

  constructor(config: Partial<RequestOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_OPTIMIZER_CONFIG, ...config };
    this.connectionManager = ConnectionManager.getInstance();
    this.performanceMonitor = PerformanceMonitor.getInstance();
    
    // Set up cache cleanup
    this.setupCacheCleanup();
  }

  static getInstance(config?: Partial<RequestOptimizerConfig>): RequestOptimizer {
    if (!RequestOptimizer.instance) {
      RequestOptimizer.instance = new RequestOptimizer(config);
    }
    return RequestOptimizer.instance;
  }

  /**
   * Optimized request with enterprise backend integration
   */
  async optimizedRequest<T = any>(
    url: string,
    options: RequestInit = {},
    optimizationOptions: {
      cacheTTL?: number;
      bypassCache?: boolean;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      enablePrefetch?: boolean;
      cacheKey?: string;
    } = {}
  ): Promise<T> {
    const {
      cacheTTL = this.config.defaultCacheTTL,
      bypassCache = false,
      priority = 'normal',
      enablePrefetch = this.config.enablePrefetching,
      cacheKey
    } = optimizationOptions;

    const requestKey = this.generateRequestKey(url, options, cacheKey);
    const startTime = performance.now();

    // Check cache first (if enabled and not bypassed)
    if (this.config.enableCaching && !bypassCache) {
      const cachedData = this.getCachedData(requestKey);
      if (cachedData) {
        this.recordCacheHit(requestKey);
        this.performanceMonitor.recordMetric(
          'cache_hit',
          performance.now() - startTime,
          'api',
          { url, fromCache: true }
        );
        return cachedData;
      }
    }

    // Check for duplicate requests (deduplication)
    if (this.config.enableDeduplication) {
      const pendingRequest = this.getPendingRequest(requestKey);
      if (pendingRequest) {
        return this.awaitPendingRequest<T>(pendingRequest);
      }
    }

    // Execute optimized request
    return this.executeOptimizedRequest<T>(
      requestKey,
      url,
      options,
      { cacheTTL, priority, enablePrefetch }
    );
  }

  /**
   * Execute optimized request with enterprise features
   */
  private async executeOptimizedRequest<T>(
    requestKey: string,
    url: string,
    options: RequestInit,
    optimizationOptions: {
      cacheTTL: number;
      priority: 'low' | 'normal' | 'high' | 'critical';
      enablePrefetch: boolean;
    }
  ): Promise<T> {
    const { cacheTTL, priority, enablePrefetch } = optimizationOptions;

    // Optimize request headers for enterprise backend
    const optimizedHeaders = this.optimizeHeaders(url, options.headers);
    const optimizedOptions: RequestInit = {
      ...options,
      headers: optimizedHeaders
    };

    // Create pending request entry for deduplication
    const requestPromise = this.performOptimizedFetch<T>(
      url,
      optimizedOptions,
      priority
    );

    if (this.config.enableDeduplication) {
      this.addPendingRequest(requestKey, requestPromise);
    }

    try {
      const result = await requestPromise;

      // Cache successful responses
      if (this.config.enableCaching && this.shouldCacheResponse(result)) {
        this.setCachedData(requestKey, result, cacheTTL);
      }

      // Record cache miss
      this.recordCacheMiss(requestKey);

      // Trigger prefetching if enabled
      if (enablePrefetch) {
        this.triggerPrefetching(url, options);
      }

      return result;
    } catch (error) {
      throw error;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Perform optimized fetch with connection manager
   */
  private async performOptimizedFetch<T>(
    url: string,
    options: RequestInit,
    priority: 'low' | 'normal' | 'high' | 'critical'
  ): Promise<T> {
    const response = await this.connectionManager.fetch(url, options, {
      priority,
      batchable: this.isBatchableRequest(options),
      bypassQueue: priority === 'critical'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Parse response based on content type
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType.includes('text/')) {
      return await response.text() as unknown as T;
    } else {
      return await response.blob() as unknown as T;
    }
  }

  /**
   * Optimize headers for enterprise backend
   */
  private optimizeHeaders(url: string, headers: HeadersInit = {}): HeadersInit {
    const optimizedHeaders: Record<string, string> = {
      ...this.normalizeHeaders(headers)
    };

    // Add compression headers if enabled
    if (this.config.enableCompression) {
      optimizedHeaders['Accept-Encoding'] = 'gzip, deflate, br';
    }

    // Add cache control headers
    if (this.config.enableCaching) {
      optimizedHeaders['Cache-Control'] = 'max-age=300, must-revalidate';
    }

    // Add enterprise backend optimization headers
    optimizedHeaders['X-Requested-With'] = 'XMLHttpRequest';
    optimizedHeaders['X-Client-Version'] = '1.0.0';
    optimizedHeaders['X-Performance-Mode'] = 'optimized';

    return optimizedHeaders;
  }

  /**
   * Normalize headers to plain object
   */
  private normalizeHeaders(headers: HeadersInit): Record<string, string> {
    if (headers instanceof Headers) {
      const normalized: Record<string, string> = {};
      headers.forEach((value, key) => {
        normalized[key] = value;
      });
      return normalized;
    } else if (Array.isArray(headers)) {
      const normalized: Record<string, string> = {};
      headers.forEach(([key, value]) => {
        normalized[key] = value;
      });
      return normalized;
    } else {
      return headers as Record<string, string> || {};
    }
  }

  /**
   * Generate unique request key for caching and deduplication
   */
  private generateRequestKey(url: string, options: RequestInit, customKey?: string): string {
    if (customKey) return customKey;

    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    const headers = JSON.stringify(this.normalizeHeaders(options.headers));
    
    // Create hash of request details
    const requestString = `${method}:${url}:${body}:${headers}`;
    return btoa(requestString).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  /**
   * Get cached data if available and not expired
   */
  private getCachedData(requestKey: string): any | null {
    const entry = this.cache.get(requestKey);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(requestKey);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached data with TTL
   */
  private setCachedData(requestKey: string, data: any, ttl: number) {
    // Implement LRU cache eviction if at capacity
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldestEntry();
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl,
      requestKey
    };

    this.cache.set(requestKey, entry);
  }

  /**
   * Evict oldest cache entry (LRU)
   */
  private evictOldestEntry() {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Check if request should be cached
   */
  private shouldCacheResponse(data: any): boolean {
    // Don't cache empty responses
    if (!data) return false;

    // Don't cache large responses
    const size = JSON.stringify(data).length;
    if (size > 100000) return false; // 100KB limit

    return true;
  }

  /**
   * Get pending request for deduplication
   */
  private getPendingRequest(requestKey: string): PendingRequest | null {
    const pending = this.pendingRequests.get(requestKey);
    if (!pending) return null;

    // Check if within deduplication window
    if (Date.now() - pending.timestamp > this.config.deduplicationWindow) {
      this.pendingRequests.delete(requestKey);
      return null;
    }

    return pending;
  }

  /**
   * Add pending request for deduplication
   */
  private addPendingRequest(requestKey: string, promise: Promise<any>) {
    const pending: PendingRequest = {
      promise,
      timestamp: Date.now(),
      resolvers: []
    };

    this.pendingRequests.set(requestKey, pending);
  }

  /**
   * Await pending request and add resolver
   */
  private async awaitPendingRequest<T>(pending: PendingRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      pending.resolvers.push({ resolve, reject });
      
      pending.promise
        .then(result => {
          pending.resolvers.forEach(r => r.resolve(result));
        })
        .catch(error => {
          pending.resolvers.forEach(r => r.reject(error));
        });
    });
  }

  /**
   * Check if request is batchable
   */
  private isBatchableRequest(options: RequestInit): boolean {
    const method = options.method || 'GET';
    
    // Only GET requests are typically batchable
    if (method !== 'GET') return false;
    
    // Don't batch large requests
    if (options.body && JSON.stringify(options.body).length > 1000) return false;
    
    return true;
  }

  /**
   * Record cache hit for statistics
   */
  private recordCacheHit(requestKey: string) {
    const stats = this.requestStats.get(requestKey) || { hits: 0, misses: 0, lastAccess: 0 };
    stats.hits++;
    stats.lastAccess = Date.now();
    this.requestStats.set(requestKey, stats);
  }

  /**
   * Record cache miss for statistics
   */
  private recordCacheMiss(requestKey: string) {
    const stats = this.requestStats.get(requestKey) || { hits: 0, misses: 0, lastAccess: 0 };
    stats.misses++;
    stats.lastAccess = Date.now();
    this.requestStats.set(requestKey, stats);
  }

  /**
   * Trigger prefetching based on usage patterns
   */
  private triggerPrefetching(url: string, options: RequestInit) {
    // Simple prefetching logic - could be enhanced with ML
    const baseUrl = url.split('?')[0];
    
    // Prefetch related resources (e.g., detail views, next page)
    if (baseUrl.includes('/transactions')) {
      // Prefetch transaction categories
      setTimeout(() => {
        this.optimizedRequest(`${baseUrl}/categories`, { ...options, method: 'GET' }, {
          priority: 'low',
          cacheTTL: 600000 // 10 minutes
        }).catch(() => {}); // Ignore prefetch failures
      }, 100);
    }
  }

  /**
   * Set up periodic cache cleanup
   */
  private setupCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiry) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    const totalRequests = Array.from(this.requestStats.values())
      .reduce((total, stats) => total + stats.hits + stats.misses, 0);
    
    const totalHits = Array.from(this.requestStats.values())
      .reduce((total, stats) => total + stats.hits, 0);

    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.config.maxCacheSize,
      cacheHitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      pendingRequests: this.pendingRequests.size,
      totalRequests,
      config: this.config
    };
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
    this.requestStats.clear();
    this.pendingRequests.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RequestOptimizerConfig>) {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * React hook for request optimization
 */
export const useRequestOptimizer = (config?: Partial<RequestOptimizerConfig>) => {
  const [optimizer] = useState(() => RequestOptimizer.getInstance(config));
  const [stats, setStats] = useState(optimizer.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(optimizer.getStats());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [optimizer]);

  const optimizedRequest = useCallback(
    <T = any>(
      url: string,
      options?: RequestInit,
      optimizationOptions?: Parameters<typeof optimizer.optimizedRequest>[2]
    ) => {
      return optimizer.optimizedRequest<T>(url, options, optimizationOptions);
    },
    [optimizer]
  );

  return {
    optimizedRequest,
    stats,
    clearCache: optimizer.clearCache.bind(optimizer),
    updateConfig: optimizer.updateConfig.bind(optimizer)
  };
};

export default RequestOptimizer;