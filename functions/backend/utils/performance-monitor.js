/**
 * Enterprise Performance Monitoring System
 * Real-time performance tracking, metrics collection, and optimization
 * Phase 3: Performance & Monitoring Implementation
 */

import { getDbEnterprise, releaseDbConnection, getConnectionPoolStats } from '../firebase-enterprise.js';
import { getNow } from '../services/DateService.js';

// Performance monitoring configuration
const PERFORMANCE_CONFIG = {
  // Metrics collection intervals
  metricsInterval: 60000, // 1 minute
  aggregationInterval: 300000, // 5 minutes
  retentionDays: 30,

  // Performance thresholds
  thresholds: {
    responseTime: {
      excellent: 100,    // < 100ms
      good: 300,         // < 300ms
      acceptable: 1000,  // < 1s
      poor: 3000,        // < 3s
      critical: 10000    // >= 10s
    },
    throughput: {
      minimum: 10,       // ops/sec
      target: 100,       // ops/sec
      maximum: 1000      // ops/sec
    },
    errorRate: {
      excellent: 0.1,    // < 0.1%
      good: 0.5,         // < 0.5%
      acceptable: 1.0,   // < 1.0%
      poor: 5.0,         // < 5.0%
      critical: 10.0     // >= 10.0%
    },
    memoryUsage: {
      warning: 70,       // 70% of heap
      critical: 85       // 85% of heap
    },
    connectionPool: {
      warning: 70,       // 70% of max connections
      critical: 90       // 90% of max connections
    }
  },

  // Alert settings
  alerts: {
    enabled: true,
    cooldownMs: 300000, // 5 minutes between same alerts
    channels: ['console', 'database'] // Future: email, slack, etc.
  }
};

/**
 * Performance metrics collector
 */
class PerformanceMetricsCollector {
  constructor() {
    this.metrics = {
      requests: new Map(),
      responses: new Map(),
      errors: new Map(),
      database: new Map(),
      system: new Map()
    };

    this.intervals = new Map();
    this.lastAlerts = new Map();
    this.startTime = Date.now();

    this.startCollection();
  }

  /**
   * Start automatic metrics collection
   */
  startCollection() {
    // Collect metrics every minute
    const metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.collectDatabaseMetrics();
    }, PERFORMANCE_CONFIG.metricsInterval);

    // Aggregate and store metrics every 5 minutes
    const aggregationInterval = setInterval(() => {
      this.aggregateAndStoreMetrics();
    }, PERFORMANCE_CONFIG.aggregationInterval);

    this.intervals.set('metrics', metricsInterval);
    this.intervals.set('aggregation', aggregationInterval);

    console.log('📊 Performance monitoring started');
  }

  /**
   * Stop metrics collection
   */
  stopCollection() {
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    console.log('📊 Performance monitoring stopped');
  }

  /**
   * Record request start
   */
  recordRequestStart(requestId, metadata = {}) {
    this.metrics.requests.set(requestId, {
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
      metadata
    });
  }

  /**
   * Record request completion
   */
  recordRequestEnd(requestId, success = true, errorType = null) {
    const request = this.metrics.requests.get(requestId);
    if (!request) return;

    const endTime = Date.now();
    const duration = endTime - request.startTime;
    const endMemory = process.memoryUsage();

    const responseMetric = {
      requestId,
      duration,
      success,
      errorType,
      memoryDelta: endMemory.heapUsed - request.startMemory.heapUsed,
      timestamp: endTime,
      metadata: request.metadata
    };

    // Store response metric
    this.metrics.responses.set(requestId, responseMetric);

    // Track errors separately
    if (!success) {
      const errorKey = `${errorType || 'unknown'}_${Math.floor(endTime / 60000)}`;
      const existing = this.metrics.errors.get(errorKey) || { count: 0, type: errorType, minute: Math.floor(endTime / 60000) };
      existing.count++;
      this.metrics.errors.set(errorKey, existing);
    }

    // Clean up request tracking
    this.metrics.requests.delete(requestId);

    this.checkPerformanceThresholds(responseMetric);

    // Clean old response metrics (keep only last hour)
    this.cleanOldMetrics();
  }

  /**
   * Record database operation
   */
  recordDatabaseOperation(operation, duration, success = true, connectionCount = 0) {
    const timestamp = Date.now();
    const minute = Math.floor(timestamp / 60000);
    const key = `${operation}_${minute}`;

    const existing = this.metrics.database.get(key) || {
      operation,
      minute,
      count: 0,
      totalDuration: 0,
      successCount: 0,
      errorCount: 0,
      maxDuration: 0,
      minDuration: Infinity,
      connectionCount: 0
    };

    existing.count++;
    existing.totalDuration += duration;
    existing.maxDuration = Math.max(existing.maxDuration, duration);
    existing.minDuration = Math.min(existing.minDuration, duration);
    existing.connectionCount = Math.max(existing.connectionCount, connectionCount);

    if (success) {
      existing.successCount++;
    } else {
      existing.errorCount++;
    }

    this.metrics.database.set(key, existing);
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const timestamp = Date.now();
    const minute = Math.floor(timestamp / 60000);

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const poolStats = getConnectionPoolStats();

    const systemMetric = {
      minute,
      timestamp,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external,
        heapUtilization: (memoryUsage.heapUsed / memoryUsage.heapTotal * 100).toFixed(2)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      connectionPool: {
        active: poolStats.activeConnections,
        total: poolStats.totalConnections,
        failed: poolStats.failedConnections,
        utilization: poolStats.activeConnections && poolStats.maxConnections ?
          (poolStats.activeConnections / 100 * 100).toFixed(2) : '0.00' // Assuming max 100 from config
      },
      uptime: process.uptime()
    };

    this.metrics.system.set(minute, systemMetric);

    this.checkSystemThresholds(systemMetric);
  }

  /**
   * Collect database metrics
   */
  async collectDatabaseMetrics() {
    try {
      const startTime = Date.now();
      const db = await getDbEnterprise();

      try {
        // Perform a simple health check query
        const testRef = db.collection('health_check').doc('performance_test');
        await testRef.set({ timestamp: getNow(), test: true });

        const duration = Date.now() - startTime;
        this.recordDatabaseOperation('health_check', duration, true);

      } finally {
        releaseDbConnection();
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordDatabaseOperation('health_check', duration, false);
      console.error('❌ Database health check failed:', error.message);
    }
  }

  /**
   * Check performance thresholds and alert if needed
   */
  checkPerformanceThresholds(metric) {
    const { duration, success, errorType } = metric;
    const thresholds = PERFORMANCE_CONFIG.thresholds;

    if (duration >= thresholds.responseTime.critical) {
      this.triggerAlert('response_time_critical', `Critical response time: ${duration}ms`, 'critical');
    } else if (duration >= thresholds.responseTime.poor) {
      this.triggerAlert('response_time_poor', `Poor response time: ${duration}ms`, 'warning');
    }

    if (!success) {
      const recentErrors = this.getRecentErrorRate();
      if (recentErrors >= thresholds.errorRate.critical) {
        this.triggerAlert('error_rate_critical', `Critical error rate: ${recentErrors.toFixed(2)}%`, 'critical');
      } else if (recentErrors >= thresholds.errorRate.poor) {
        this.triggerAlert('error_rate_high', `High error rate: ${recentErrors.toFixed(2)}%`, 'warning');
      }
    }
  }

  /**
   * Check system thresholds
   */
  checkSystemThresholds(metric) {
    const thresholds = PERFORMANCE_CONFIG.thresholds;

    const memoryUsage = parseFloat(metric.memory.heapUtilization);
    if (memoryUsage >= thresholds.memoryUsage.critical) {
      this.triggerAlert('memory_critical', `Critical memory usage: ${memoryUsage}%`, 'critical');
    } else if (memoryUsage >= thresholds.memoryUsage.warning) {
      this.triggerAlert('memory_warning', `High memory usage: ${memoryUsage}%`, 'warning');
    }

    const poolUsage = parseFloat(metric.connectionPool.utilization);
    if (poolUsage >= thresholds.connectionPool.critical) {
      this.triggerAlert('pool_critical', `Critical connection pool usage: ${poolUsage}%`, 'critical');
    } else if (poolUsage >= thresholds.connectionPool.warning) {
      this.triggerAlert('pool_warning', `High connection pool usage: ${poolUsage}%`, 'warning');
    }
  }

  /**
   * Trigger performance alert
   */
  triggerAlert(alertType, message, severity = 'warning') {
    if (!PERFORMANCE_CONFIG.alerts.enabled) return;

    const now = Date.now();
    const lastAlert = this.lastAlerts.get(alertType);

    if (lastAlert && (now - lastAlert) < PERFORMANCE_CONFIG.alerts.cooldownMs) {
      return; // Still in cooldown
    }

    this.lastAlerts.set(alertType, now);

    const alert = {
      type: alertType,
      message,
      severity,
      timestamp: getNow().toISOString(),
      system: 'performance_monitor'
    };

    // Log to console
    if (PERFORMANCE_CONFIG.alerts.channels.includes('console')) {
      const icon = severity === 'critical' ? '🚨' : '⚠️';
      console.log(`${icon} PERFORMANCE ALERT [${severity.toUpperCase()}]: ${message}`);
    }

    // Store in database for analysis
    if (PERFORMANCE_CONFIG.alerts.channels.includes('database')) {
      this.storeAlert(alert);
    }
  }

  /**
   * Store alert in database
   */
  async storeAlert(alert) {
    try {
      const db = await getDbEnterprise();

      try {
        const alertRef = db.collection('performance_alerts').doc();
        await alertRef.set(alert);
      } finally {
        releaseDbConnection();
      }

    } catch (error) {
      console.error('❌ Failed to store performance alert:', error);
    }
  }

  /**
   * Get recent error rate (last minute)
   */
  getRecentErrorRate() {
    const now = Date.now();
    const minute = Math.floor(now / 60000);

    let totalRequests = 0;
    let totalErrors = 0;

    // Count requests in current minute
    for (const [, response] of this.metrics.responses) {
      if (Math.floor(response.timestamp / 60000) === minute) {
        totalRequests++;
        if (!response.success) {
          totalErrors++;
        }
      }
    }

    return totalRequests > 0 ? (totalErrors / totalRequests * 100) : 0;
  }

  /**
   * Clean old metrics to prevent memory leaks
   */
  cleanOldMetrics() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Clean old response metrics
    for (const [requestId, response] of this.metrics.responses) {
      if (response.timestamp < oneHourAgo) {
        this.metrics.responses.delete(requestId);
      }
    }

    // Clean old database metrics (keep last 24 hours)
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const dayAgoMinute = Math.floor(oneDayAgo / 60000);

    for (const [key, metric] of this.metrics.database) {
      if (metric.minute < dayAgoMinute) {
        this.metrics.database.delete(key);
      }
    }

    // Clean old system metrics (keep last 24 hours)
    for (const [minute, metric] of this.metrics.system) {
      if (minute < dayAgoMinute) {
        this.metrics.system.delete(minute);
      }
    }
  }

  /**
   * Aggregate and store metrics for long-term analysis
   */
  async aggregateAndStoreMetrics() {
    try {
      const aggregatedMetrics = this.getAggregatedMetrics();

      const db = await getDbEnterprise();

      try {
        const metricsRef = db.collection('performance_metrics').doc();
        await metricsRef.set({
          ...aggregatedMetrics,
          timestamp: getNow(),
          aggregationPeriod: PERFORMANCE_CONFIG.aggregationInterval
        });

        console.log('📊 Performance metrics aggregated and stored');

      } finally {
        releaseDbConnection();
      }

    } catch (error) {
      console.error('❌ Failed to store aggregated metrics:', error);
    }
  }

  /**
   * Get aggregated metrics for current period
   */
  getAggregatedMetrics() {
    const now = Date.now();
    const fiveMinutesAgo = now - PERFORMANCE_CONFIG.aggregationInterval;

    // Aggregate response metrics
    const recentResponses = Array.from(this.metrics.responses.values())
      .filter(r => r.timestamp >= fiveMinutesAgo);

    const responseMetrics = this.calculateResponseMetrics(recentResponses);

    // Aggregate database metrics
    const recentDbMetrics = Array.from(this.metrics.database.values())
      .filter(m => m.minute >= Math.floor(fiveMinutesAgo / 60000));

    const databaseMetrics = this.calculateDatabaseMetrics(recentDbMetrics);

    const systemMetrics = this.getLatestSystemMetrics();

    return {
      period: {
        start: new Date(fiveMinutesAgo).toISOString(),
        end: new Date(now).toISOString(),
        duration: PERFORMANCE_CONFIG.aggregationInterval
      },
      responses: responseMetrics,
      database: databaseMetrics,
      system: systemMetrics,
      summary: this.generatePerformanceSummary(responseMetrics, databaseMetrics, systemMetrics)
    };
  }

  /**
   * Calculate response metrics
   */
  calculateResponseMetrics(responses) {
    if (responses.length === 0) {
      return { count: 0, averageResponseTime: 0, successRate: 100, throughput: 0 };
    }

    const successCount = responses.filter(r => r.success).length;
    const totalDuration = responses.reduce((sum, r) => sum + r.duration, 0);
    const maxDuration = Math.max(...responses.map(r => r.duration));
    const minDuration = Math.min(...responses.map(r => r.duration));

    return {
      count: responses.length,
      successCount,
      errorCount: responses.length - successCount,
      successRate: (successCount / responses.length * 100).toFixed(2),
      averageResponseTime: Math.round(totalDuration / responses.length),
      maxResponseTime: maxDuration,
      minResponseTime: minDuration,
      throughput: (responses.length / (PERFORMANCE_CONFIG.aggregationInterval / 1000)).toFixed(2)
    };
  }

  /**
   * Calculate database metrics
   */
  calculateDatabaseMetrics(dbMetrics) {
    if (dbMetrics.length === 0) {
      return { operations: 0, averageDuration: 0, successRate: 100 };
    }

    const totalOps = dbMetrics.reduce((sum, m) => sum + m.count, 0);
    const totalDuration = dbMetrics.reduce((sum, m) => sum + m.totalDuration, 0);
    const totalSuccess = dbMetrics.reduce((sum, m) => sum + m.successCount, 0);
    const maxConnections = Math.max(...dbMetrics.map(m => m.connectionCount));

    return {
      operations: totalOps,
      averageDuration: totalOps > 0 ? Math.round(totalDuration / totalOps) : 0,
      successRate: totalOps > 0 ? (totalSuccess / totalOps * 100).toFixed(2) : 100,
      maxConnections,
      operationTypes: this.groupByOperation(dbMetrics)
    };
  }

  /**
   * Group database metrics by operation type
   */
  groupByOperation(dbMetrics) {
    const grouped = {};

    for (const metric of dbMetrics) {
      if (!grouped[metric.operation]) {
        grouped[metric.operation] = { count: 0, totalDuration: 0, successCount: 0 };
      }

      grouped[metric.operation].count += metric.count;
      grouped[metric.operation].totalDuration += metric.totalDuration;
      grouped[metric.operation].successCount += metric.successCount;
    }

    // Calculate averages
    for (const [operation, stats] of Object.entries(grouped)) {
      stats.averageDuration = stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0;
      stats.successRate = stats.count > 0 ? (stats.successCount / stats.count * 100).toFixed(2) : 100;
    }

    return grouped;
  }

  /**
   * Get latest system metrics
   */
  getLatestSystemMetrics() {
    const latestMinute = Math.max(...this.metrics.system.keys());
    return this.metrics.system.get(latestMinute) || null;
  }

  /**
   * Generate performance summary
   */
  generatePerformanceSummary(responseMetrics, databaseMetrics, systemMetrics) {
    const thresholds = PERFORMANCE_CONFIG.thresholds;

    // Determine overall health score (0-100)
    let healthScore = 100;
    const issues = [];

    // Response time health
    if (responseMetrics.averageResponseTime > thresholds.responseTime.critical) {
      healthScore -= 30;
      issues.push('Critical response times');
    } else if (responseMetrics.averageResponseTime > thresholds.responseTime.poor) {
      healthScore -= 15;
      issues.push('Poor response times');
    } else if (responseMetrics.averageResponseTime > thresholds.responseTime.acceptable) {
      healthScore -= 5;
      issues.push('Acceptable response times');
    }

    // Error rate health
    const errorRate = parseFloat(responseMetrics.successRate);
    if (errorRate < (100 - thresholds.errorRate.critical)) {
      healthScore -= 25;
      issues.push('Critical error rate');
    } else if (errorRate < (100 - thresholds.errorRate.poor)) {
      healthScore -= 10;
      issues.push('High error rate');
    }

    // System health
    if (systemMetrics) {
      const memoryUsage = parseFloat(systemMetrics.memory.heapUtilization);
      if (memoryUsage > thresholds.memoryUsage.critical) {
        healthScore -= 20;
        issues.push('Critical memory usage');
      } else if (memoryUsage > thresholds.memoryUsage.warning) {
        healthScore -= 10;
        issues.push('High memory usage');
      }
    }

    // Throughput health
    const throughput = parseFloat(responseMetrics.throughput);
    if (throughput < thresholds.throughput.minimum) {
      healthScore -= 15;
      issues.push('Low throughput');
    }

    healthScore = Math.max(0, healthScore);

    const status = healthScore >= 90 ? 'excellent' :
                   healthScore >= 75 ? 'good' :
                   healthScore >= 60 ? 'acceptable' :
                   healthScore >= 40 ? 'poor' : 'critical';

    return {
      healthScore,
      status,
      issues,
      recommendations: this.generateRecommendations(responseMetrics, databaseMetrics, systemMetrics)
    };
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(responseMetrics, databaseMetrics, systemMetrics) {
    const recommendations = [];
    const thresholds = PERFORMANCE_CONFIG.thresholds;

    // Response time recommendations
    if (responseMetrics.averageResponseTime > thresholds.responseTime.poor) {
      recommendations.push('Consider optimizing slow queries and database operations');
      recommendations.push('Review batch operation sizes and concurrency settings');
    }

    // Error rate recommendations
    const errorRate = 100 - parseFloat(responseMetrics.successRate);
    if (errorRate > thresholds.errorRate.acceptable) {
      recommendations.push('Investigate error patterns and implement better error handling');
      recommendations.push('Review input validation and data integrity checks');
    }

    // System recommendations
    if (systemMetrics) {
      const memoryUsage = parseFloat(systemMetrics.memory.heapUtilization);
      if (memoryUsage > thresholds.memoryUsage.warning) {
        recommendations.push('Monitor memory usage and consider increasing heap size');
        recommendations.push('Review memory leaks and optimize data structures');
      }

      const poolUsage = parseFloat(systemMetrics.connectionPool.utilization);
      if (poolUsage > thresholds.connectionPool.warning) {
        recommendations.push('Consider increasing connection pool size');
        recommendations.push('Optimize database connection usage and release patterns');
      }
    }

    // Throughput recommendations
    const throughput = parseFloat(responseMetrics.throughput);
    if (throughput < thresholds.throughput.minimum) {
      recommendations.push('Investigate bottlenecks in request processing');
      recommendations.push('Consider horizontal scaling or load balancing');
    }

    return recommendations;
  }

  /**
   * Get current performance status
   */
  getCurrentStatus() {
    const aggregated = this.getAggregatedMetrics();
    return {
      uptime: process.uptime(),
      status: aggregated.summary.status,
      healthScore: aggregated.summary.healthScore,
      activeRequests: this.metrics.requests.size,
      metricsCollected: {
        responses: this.metrics.responses.size,
        database: this.metrics.database.size,
        system: this.metrics.system.size,
        errors: this.metrics.errors.size
      },
      lastAggregation: getNow().toISOString()
    };
  }
}

// Global performance monitor instance
const performanceMonitor = new PerformanceMetricsCollector();

/**
 * Performance monitoring utilities
 */
class PerformanceUtils {
  /**
   * Create performance tracking middleware
   */
  static createTrackingMiddleware() {
    return (req, res, next) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      req.performanceId = requestId;

      // Record request start
      performanceMonitor.recordRequestStart(requestId, {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      // Hook into response end
      const originalEnd = res.end;
      res.end = function(...args) {
        const success = res.statusCode < 400;
        const errorType = success ? null : `http_${res.statusCode}`;

        performanceMonitor.recordRequestEnd(requestId, success, errorType);

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Track function performance
   */
  static async trackFunction(name, fn, context = {}) {
    const startTime = Date.now();
    const requestId = `fn_${name}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    performanceMonitor.recordRequestStart(requestId, { function: name, ...context });

    try {
      const result = await fn();
      performanceMonitor.recordRequestEnd(requestId, true);
      return result;
    } catch (error) {
      performanceMonitor.recordRequestEnd(requestId, false, error.name);
      throw error;
    }
  }

  /**
   * Track database operation performance
   */
  static trackDatabaseOperation(operation, duration, success = true, connectionCount = 0) {
    performanceMonitor.recordDatabaseOperation(operation, duration, success, connectionCount);
  }
}

export {
  PerformanceMetricsCollector,
  PerformanceUtils,
  performanceMonitor,
  PERFORMANCE_CONFIG
};