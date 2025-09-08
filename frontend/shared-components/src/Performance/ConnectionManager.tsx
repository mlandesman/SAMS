/**
 * Enterprise Connection Manager for Frontend-Backend Optimization
 * FRONTEND-ALIGNMENT-001 - Phase 2.1
 * 
 * Optimizes frontend connections to leverage enterprise backend
 * connection pooling and concurrent operation capabilities
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PerformanceMonitor } from '../ErrorHandling/PerformanceErrorMonitor';
import { ErrorFactory } from '../ErrorHandling/StandardizedError';
import { ERROR_CODES } from '../ErrorHandling';

/**
 * Connection configuration for enterprise backend optimization
 */
export interface ConnectionConfig {
  // Connection pool settings
  maxConcurrentRequests: number;
  connectionTimeout: number;
  keepAliveTimeout: number;
  retryDelay: number;
  maxRetries: number;
  
  // Request batching
  enableRequestBatching: boolean;
  batchWindow: number;
  maxBatchSize: number;
  
  // Connection optimization
  enableConnectionReuse: boolean;
  enableHTTP2: boolean;
  enablePipelining: boolean;
  
  // Performance monitoring
  enableMetrics: boolean;
  slowRequestThreshold: number;
}

/**
 * Default configuration optimized for enterprise backend
 */
export const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  maxConcurrentRequests: 6,      // Optimize for HTTP/2 multiplexing
  connectionTimeout: 30000,      // 30 seconds
  keepAliveTimeout: 60000,       // 1 minute
  retryDelay: 1000,             // 1 second base delay
  maxRetries: 3,                // 3 retry attempts
  
  enableRequestBatching: true,   // Batch compatible requests
  batchWindow: 50,              // 50ms batching window
  maxBatchSize: 10,             // Max 10 requests per batch
  
  enableConnectionReuse: true,   // Reuse connections
  enableHTTP2: true,            // Prefer HTTP/2
  enablePipelining: false,      // Disable pipelining (HTTP/2 handles this)
  
  enableMetrics: true,          // Enable performance tracking
  slowRequestThreshold: 2000    // 2 second threshold for slow requests
};

/**
 * Request queue item for connection management
 */
interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  resolve: (value: Response) => void;
  reject: (reason: any) => void;
  timestamp: number;
  retryCount: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  batchable: boolean;
}

/**
 * Connection statistics for monitoring
 */
interface ConnectionStats {
  activeConnections: number;
  queuedRequests: number;
  completedRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  connectionErrors: number;
  retryCount: number;
}

/**
 * Enterprise-optimized connection manager
 */
export class ConnectionManager {
  private static instance: ConnectionManager;
  private config: ConnectionConfig;
  private requestQueue: QueuedRequest[] = [];
  private activeRequests: Map<string, QueuedRequest> = new Map();
  private connectionPool: Map<string, number> = new Map(); // Track connections per origin
  private batchTimer: NodeJS.Timeout | null = null;
  private stats: ConnectionStats = {
    activeConnections: 0,
    queuedRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    connectionErrors: 0,
    retryCount: 0
  };
  private performanceMonitor: PerformanceMonitor;

  constructor(config: Partial<ConnectionConfig> = {}) {
    this.config = { ...DEFAULT_CONNECTION_CONFIG, ...config };
    this.performanceMonitor = PerformanceMonitor.getInstance();
  }

  static getInstance(config?: Partial<ConnectionConfig>): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager(config);
    }
    return ConnectionManager.instance;
  }

  /**
   * Optimized fetch with enterprise connection management
   */
  async fetch(url: string, options: RequestInit = {}, requestOptions: {
    priority?: QueuedRequest['priority'];
    batchable?: boolean;
    bypassQueue?: boolean;
  } = {}): Promise<Response> {
    const {
      priority = 'normal',
      batchable = false,
      bypassQueue = false
    } = requestOptions;

    const requestId = this.generateRequestId();
    const startTime = performance.now();

    // Check if we should bypass the queue for critical requests
    if (bypassQueue || priority === 'critical') {
      return this.executeRequest(requestId, url, options, startTime);
    }

    // Add to queue for managed execution
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: requestId,
        url,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
        priority,
        batchable
      };

      this.addToQueue(queuedRequest);
      this.processQueue();
    });
  }

  /**
   * Add request to queue with priority ordering
   */
  private addToQueue(request: QueuedRequest) {
    // Insert based on priority
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const insertIndex = this.requestQueue.findIndex(
      req => priorityOrder[req.priority] > priorityOrder[request.priority]
    );

    if (insertIndex === -1) {
      this.requestQueue.push(request);
    } else {
      this.requestQueue.splice(insertIndex, 0, request);
    }

    this.stats.queuedRequests = this.requestQueue.length;
  }

  /**
   * Process the request queue with connection limits and batching
   */
  private async processQueue() {
    // Check if we can process more requests
    if (this.stats.activeConnections >= this.config.maxConcurrentRequests) {
      return;
    }

    // Process batchable requests
    if (this.config.enableRequestBatching) {
      this.processBatchableRequests();
    }

    // Process individual requests
    while (
      this.requestQueue.length > 0 && 
      this.stats.activeConnections < this.config.maxConcurrentRequests
    ) {
      const request = this.requestQueue.shift()!;
      this.stats.queuedRequests = this.requestQueue.length;

      // Execute request
      this.executeQueuedRequest(request);
    }
  }

  /**
   * Process batchable requests together
   */
  private processBatchableRequests() {
    const batchableRequests = this.requestQueue.filter(req => req.batchable).slice(0, this.config.maxBatchSize);
    
    if (batchableRequests.length === 0) return;

    // Clear batch timer if exists
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Set up new batch timer
    this.batchTimer = setTimeout(() => {
      if (batchableRequests.length > 1) {
        this.executeBatchedRequests(batchableRequests);
      }
      this.batchTimer = null;
    }, this.config.batchWindow);
  }

  /**
   * Execute a batch of requests together
   */
  private async executeBatchedRequests(requests: QueuedRequest[]) {
    console.log(`🔄 Executing batch of ${requests.length} requests`);

    // Remove batched requests from queue
    requests.forEach(request => {
      const index = this.requestQueue.indexOf(request);
      if (index > -1) {
        this.requestQueue.splice(index, 1);
      }
    });
    this.stats.queuedRequests = this.requestQueue.length;

    // Execute all requests concurrently
    const batchPromises = requests.map(request => 
      this.executeQueuedRequest(request)
    );

    try {
      await Promise.allSettled(batchPromises);
    } catch (error) {
      console.error('Batch execution error:', error);
    }
  }

  /**
   * Execute a queued request
   */
  private async executeQueuedRequest(request: QueuedRequest) {
    try {
      this.activeRequests.set(request.id, request);
      this.stats.activeConnections++;

      const response = await this.executeRequest(
        request.id,
        request.url,
        request.options,
        performance.now()
      );

      request.resolve(response);
      this.stats.completedRequests++;
    } catch (error) {
      // Handle retry logic
      if (request.retryCount < this.config.maxRetries) {
        request.retryCount++;
        this.stats.retryCount++;
        
        // Add back to queue with delay
        setTimeout(() => {
          this.addToQueue(request);
          this.processQueue();
        }, this.config.retryDelay * Math.pow(2, request.retryCount));
      } else {
        request.reject(error);
        this.stats.failedRequests++;
      }
    } finally {
      this.activeRequests.delete(request.id);
      this.stats.activeConnections--;
      
      // Continue processing queue
      this.processQueue();
    }
  }

  /**
   * Execute individual request with enterprise optimizations
   */
  private async executeRequest(
    requestId: string,
    url: string,
    options: RequestInit,
    startTime: number
  ): Promise<Response> {
    const origin = new URL(url).origin;

    try {
      // Track connection usage per origin
      const originConnections = this.connectionPool.get(origin) || 0;
      this.connectionPool.set(origin, originConnections + 1);

      // Optimize request options for enterprise backend
      const optimizedOptions: RequestInit = {
        ...options,
        // Enterprise backend optimizations
        headers: {
          'Connection': this.config.enableConnectionReuse ? 'keep-alive' : 'close',
          'Keep-Alive': `timeout=${this.config.keepAliveTimeout / 1000}`,
          ...options.headers
        },
        // Use HTTP/2 when available
        ...(this.config.enableHTTP2 && { mode: 'cors' })
      };

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.config.connectionTimeout);

      optimizedOptions.signal = controller.signal;

      // Execute request
      const response = await fetch(url, optimizedOptions);
      clearTimeout(timeoutId);

      // Record performance metrics
      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime);
      
      if (this.config.enableMetrics) {
        this.performanceMonitor.recordMetric(
          `connection_${origin.replace(/[^a-zA-Z0-9]/g, '_')}`,
          responseTime,
          'api',
          {
            url,
            method: options.method || 'GET',
            status: response.status,
            requestId,
            connectionReused: this.config.enableConnectionReuse
          }
        );
      }

      // Check for slow requests
      if (responseTime > this.config.slowRequestThreshold) {
        console.warn(`🐌 Slow request detected: ${url} took ${responseTime.toFixed(2)}ms`);
      }

      return response;
    } catch (error) {
      this.stats.connectionErrors++;
      
      if (error.name === 'AbortError') {
        throw ErrorFactory.network(
          ERROR_CODES.TIMEOUT,
          `Request timeout after ${this.config.connectionTimeout}ms`,
          { requestId, url, timeout: this.config.connectionTimeout }
        );
      }
      
      throw ErrorFactory.network(
        ERROR_CODES.NETWORK_ERROR,
        `Connection failed: ${error.message}`,
        { requestId, url, originalError: error }
      );
    } finally {
      // Clean up connection tracking
      const originConnections = this.connectionPool.get(origin) || 1;
      if (originConnections <= 1) {
        this.connectionPool.delete(origin);
      } else {
        this.connectionPool.set(origin, originConnections - 1);
      }
    }
  }

  /**
   * Record response time for average calculation
   */
  private recordResponseTime(responseTime: number) {
    const totalRequests = this.stats.completedRequests + 1;
    this.stats.averageResponseTime = (
      (this.stats.averageResponseTime * this.stats.completedRequests) + responseTime
    ) / totalRequests;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current connection statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Get current configuration
   */
  getConfig(): ConnectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConnectionConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clear all queued requests (emergency stop)
   */
  clearQueue() {
    this.requestQueue.forEach(request => {
      request.reject(new Error('Request queue cleared'));
    });
    this.requestQueue = [];
    this.stats.queuedRequests = 0;
  }

  /**
   * Get connection health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: Record<string, number>;
    recommendations: string[];
  } {
    const errorRate = this.stats.failedRequests / (this.stats.completedRequests + this.stats.failedRequests) || 0;
    const queueBacklog = this.stats.queuedRequests;
    const avgResponseTime = this.stats.averageResponseTime;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const recommendations: string[] = [];

    // Determine health status
    if (errorRate > 0.1 || avgResponseTime > 5000 || queueBacklog > 20) {
      status = 'unhealthy';
      recommendations.push('Consider reducing request load');
      recommendations.push('Check network connectivity');
    } else if (errorRate > 0.05 || avgResponseTime > 2000 || queueBacklog > 10) {
      status = 'degraded';
      recommendations.push('Monitor performance closely');
    }

    if (queueBacklog > 5) {
      recommendations.push('Consider increasing maxConcurrentRequests');
    }

    if (avgResponseTime > this.config.slowRequestThreshold) {
      recommendations.push('Optimize backend response times');
    }

    return {
      status,
      metrics: {
        errorRate: errorRate * 100,
        queueBacklog,
        avgResponseTime,
        activeConnections: this.stats.activeConnections
      },
      recommendations
    };
  }
}

/**
 * React hook for connection management
 */
export const useConnectionManager = (config?: Partial<ConnectionConfig>) => {
  const [manager] = useState(() => ConnectionManager.getInstance(config));
  const [stats, setStats] = useState<ConnectionStats>(manager.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(manager.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, [manager]);

  const optimizedFetch = useCallback(
    (url: string, options?: RequestInit, requestOptions?: Parameters<typeof manager.fetch>[2]) => {
      return manager.fetch(url, options, requestOptions);
    },
    [manager]
  );

  return {
    optimizedFetch,
    stats,
    healthStatus: manager.getHealthStatus(),
    updateConfig: manager.updateConfig.bind(manager),
    clearQueue: manager.clearQueue.bind(manager)
  };
};

export default ConnectionManager;