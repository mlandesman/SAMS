/**
 * Performance Optimization Components and Services
 * FRONTEND-ALIGNMENT-001 - Phase 2.1
 * 
 * Enterprise-grade performance optimization for frontend applications
 */

// Connection Management
export {
  ConnectionManager,
  useConnectionManager,
  DEFAULT_CONNECTION_CONFIG,
  type ConnectionConfig
} from './ConnectionManager';

// Request Optimization
export {
  RequestOptimizer,
  useRequestOptimizer,
  type RequestOptimizerConfig
} from './RequestOptimizer';

// Response Time Optimization
export {
  ResponseTimeOptimizer,
  useResponseTimeOptimizer,
  type ResponseTimeOptimizerConfig
} from './ResponseTimeOptimizer';

// Concurrent Operation Management
export {
  ConcurrentOperationManager,
  useConcurrentOperations,
  type ConcurrentOperationConfig
} from './ConcurrentOperationManager';

// Re-export for convenience (removed duplicates)

/**
 * Performance optimization utilities
 */
export const PerformanceUtils = {
  /**
   * Initialize enterprise performance optimizations
   */
  initializeOptimizations: (config?: {
    connection?: Partial<import('./ConnectionManager').ConnectionConfig>;
    request?: Partial<import('./RequestOptimizer').RequestOptimizerConfig>;
    responseTime?: Partial<import('./ResponseTimeOptimizer').ResponseTimeOptimizerConfig>;
    concurrent?: Partial<import('./ConcurrentOperationManager').ConcurrentOperationConfig>;
  }) => {
    const connectionManager = ConnectionManager.getInstance(config?.connection);
    const requestOptimizer = RequestOptimizer.getInstance(config?.request);
    const responseTimeOptimizer = ResponseTimeOptimizer.getInstance(config?.responseTime);
    const concurrentOperationManager = ConcurrentOperationManager.getInstance(config?.concurrent);
    
    console.log('🚀 Enterprise performance optimizations initialized');
    
    return {
      connectionManager,
      requestOptimizer,
      responseTimeOptimizer,
      concurrentOperationManager,
      getStats: () => ({
        connection: connectionManager.getStats(),
        request: requestOptimizer.getStats(),
        responseTime: responseTimeOptimizer.getStats(),
        concurrent: concurrentOperationManager.getStats()
      })
    };
  },

  /**
   * Get performance recommendations
   */
  getRecommendations: () => {
    const connectionManager = ConnectionManager.getInstance();
    const requestOptimizer = RequestOptimizer.getInstance();
    const responseTimeOptimizer = ResponseTimeOptimizer.getInstance();
    
    const connectionHealth = connectionManager.getHealthStatus();
    const requestStats = requestOptimizer.getStats();
    const responseTimeRecommendations = responseTimeOptimizer.getRecommendations();
    
    const recommendations: string[] = [];
    
    // Connection recommendations
    recommendations.push(...connectionHealth.recommendations);
    
    // Cache recommendations
    if (requestStats.cacheHitRate < 50) {
      recommendations.push('Consider increasing cache TTL for frequently accessed data');
    }
    
    if (requestStats.cacheSize >= requestStats.maxCacheSize * 0.9) {
      recommendations.push('Consider increasing maximum cache size');
    }
    
    // Response time recommendations
    recommendations.push(...responseTimeRecommendations);
    
    return recommendations;
  },

  /**
   * Performance monitoring summary
   */
  getPerformanceSummary: () => {
    const connectionManager = ConnectionManager.getInstance();
    const requestOptimizer = RequestOptimizer.getInstance();
    const responseTimeOptimizer = ResponseTimeOptimizer.getInstance();
    const concurrentOperationManager = ConcurrentOperationManager.getInstance();
    
    return {
      connection: {
        status: connectionManager.getHealthStatus().status,
        activeConnections: connectionManager.getStats().activeConnections,
        averageResponseTime: connectionManager.getStats().averageResponseTime
      },
      request: {
        cacheHitRate: requestOptimizer.getStats().cacheHitRate,
        totalRequests: requestOptimizer.getStats().totalRequests,
        cacheSize: requestOptimizer.getStats().cacheSize
      },
      responseTime: {
        averageResponseTime: responseTimeOptimizer.getStats().averageResponseTime,
        slowResponses: responseTimeOptimizer.getStats().slowResponses,
        totalRequests: responseTimeOptimizer.getStats().totalRequests
      },
      concurrent: {
        activeOperations: concurrentOperationManager.getStats().activeOperations,
        completedOperations: concurrentOperationManager.getStats().completedOperations,
        concurrencyUtilization: concurrentOperationManager.getStats().concurrencyUtilization
      },
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Version information
 */
export const PERFORMANCE_VERSION = '1.0.0';
export const PERFORMANCE_BUILD_DATE = new Date().toISOString();

// Default export removed to avoid scope issues - use named exports instead