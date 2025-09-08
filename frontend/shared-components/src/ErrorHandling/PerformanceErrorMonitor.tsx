/**
 * Performance Error Monitor for Enterprise Backend Alignment
 * FRONTEND-ALIGNMENT-001 - Phase 1.3
 * 
 * Integrates error handling with performance monitoring to track and respond
 * to performance-related issues in alignment with enterprise backend capabilities
 */

import React, { useEffect, useRef, useState } from 'react';
import { StandardizedError, ErrorFactory, ErrorMetrics } from './StandardizedError';

/**
 * Performance thresholds aligned with enterprise backend expectations
 */
export const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE: {
    FAST: 500,      // < 500ms - excellent
    NORMAL: 2000,   // < 2s - acceptable
    SLOW: 5000,     // < 5s - slow warning
    TIMEOUT: 30000  // > 30s - timeout error
  },
  COMPONENT_RENDER: {
    FAST: 16,       // < 16ms - 60fps
    NORMAL: 33,     // < 33ms - 30fps
    SLOW: 100,      // < 100ms - noticeable
    TIMEOUT: 1000   // > 1s - critical
  },
  RESOURCE_LOAD: {
    FAST: 1000,     // < 1s - excellent
    NORMAL: 3000,   // < 3s - acceptable
    SLOW: 10000,    // < 10s - slow warning
    TIMEOUT: 30000  // > 30s - timeout error
  },
  MEMORY: {
    LOW: 50,        // < 50MB - normal
    MEDIUM: 100,    // < 100MB - acceptable
    HIGH: 200,      // < 200MB - warning
    CRITICAL: 500   // > 500MB - critical
  }
};

/**
 * Performance metrics tracking
 */
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'api' | 'render' | 'resource' | 'memory' | 'custom';
  metadata?: Record<string, any>;
}

/**
 * Performance error context
 */
interface PerformanceErrorContext {
  metric: PerformanceMetric;
  threshold: number;
  currentPerformance: any;
  systemInfo: any;
}

/**
 * Enhanced error class for performance issues
 */
export class PerformanceError extends StandardizedError {
  public readonly performanceCategory: string;
  public readonly metric: PerformanceMetric;
  public readonly threshold: number;
  public readonly suggestion: string;

  constructor(
    message: string,
    code: string,
    context: PerformanceErrorContext
  ) {
    super(message, code, {
      category: 'system',
      severity: context.metric.value > context.threshold * 2 ? 'high' : 'medium',
      retry: context.metric.category === 'api',
      ...context.metric.metadata
    });

    this.performanceCategory = context.metric.category;
    this.metric = context.metric;
    this.threshold = context.threshold;
    this.suggestion = this.generatePerformanceSuggestion();
  }

  private generatePerformanceSuggestion(): string {
    const suggestionMap: Record<string, Record<string, string>> = {
      api: {
        slow: 'Try refreshing the page or check your internet connection',
        timeout: 'The server may be experiencing high load. Please try again later'
      },
      render: {
        slow: 'Close other browser tabs or applications to improve performance',
        timeout: 'This page may be too complex for your device. Try a simpler view'
      },
      resource: {
        slow: 'Check your internet connection or try refreshing the page',
        timeout: 'Resources failed to load. Please check your connection'
      },
      memory: {
        high: 'Close other browser tabs to free up memory',
        critical: 'Restart your browser to improve performance'
      }
    };

    const category = suggestionMap[this.performanceCategory];
    if (!category) return 'Please try again or contact support if the issue persists';

    const severity = this.metric.value > this.threshold * 2 ? 'timeout' : 'slow';
    return category[severity] || category['slow'] || 'Please try again later';
  }

  protected generateUserFriendlyMessage(): string {
    const messageMap: Record<string, string> = {
      API_SLOW: 'The application is responding slowly. Please be patient.',
      API_TIMEOUT: 'The request timed out. Please try again.',
      RENDER_SLOW: 'The page is loading slowly. Please wait.',
      RENDER_TIMEOUT: 'The page failed to load properly.',
      RESOURCE_SLOW: 'Resources are loading slowly.',
      RESOURCE_TIMEOUT: 'Failed to load required resources.',
      MEMORY_HIGH: 'The application is using a lot of memory.',
      MEMORY_CRITICAL: 'Memory usage is critically high.'
    };

    return messageMap[this.code] || 'Performance issue detected. Please try again.';
  }

  protected generateActionItems(): string[] {
    return [
      this.suggestion,
      'Close unnecessary browser tabs',
      'Try refreshing the page',
      'Contact support if the issue persists'
    ];
  }
}

/**
 * Performance monitoring service
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private errorCallback?: (error: PerformanceError) => void;
  private isMonitoring = false;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(errorCallback?: (error: PerformanceError) => void) {
    if (this.isMonitoring) return;

    this.errorCallback = errorCallback;
    this.isMonitoring = true;

    // Monitor navigation timing
    this.monitorNavigationTiming();

    // Monitor resource timing
    this.monitorResourceTiming();

    // Monitor long tasks
    this.monitorLongTasks();

    // Monitor memory usage
    this.monitorMemoryUsage();

    // Monitor web vitals
    this.monitorWebVitals();

    console.log('🎯 Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    console.log('🛑 Performance monitoring stopped');
  }

  /**
   * Record a custom performance metric
   */
  recordMetric(
    name: string,
    value: number,
    category: PerformanceMetric['category'] = 'custom',
    metadata?: Record<string, any>
  ) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      category,
      metadata
    };

    this.metrics.push(metric);
    this.checkThresholds(metric);

    // Keep only last 100 metrics to prevent memory leak
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  /**
   * Monitor navigation timing
   */
  private monitorNavigationTiming() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return;

    // Page load time
    const loadTime = navigation.loadEventEnd - navigation.fetchStart;
    this.recordMetric('page_load', loadTime, 'resource', {
      url: window.location.href,
      type: 'navigation'
    });

    // DNS lookup time
    const dnsTime = navigation.domainLookupEnd - navigation.domainLookupStart;
    this.recordMetric('dns_lookup', dnsTime, 'resource');

    // Server response time
    const responseTime = navigation.responseEnd - navigation.requestStart;
    this.recordMetric('server_response', responseTime, 'api');
  }

  /**
   * Monitor resource timing
   */
  private monitorResourceTiming() {
    if (!PerformanceObserver.supportedEntryTypes?.includes('resource')) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resource = entry as PerformanceResourceTiming;
        
        this.recordMetric(`resource_${resource.initiatorType}`, entry.duration, 'resource', {
          url: resource.name,
          size: resource.transferSize || 0,
          cached: resource.transferSize === 0 && resource.decodedBodySize > 0
        });
      }
    });

    observer.observe({ entryTypes: ['resource'] });
    this.observers.push(observer);
  }

  /**
   * Monitor long tasks (> 50ms)
   */
  private monitorLongTasks() {
    if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric('long_task', entry.duration, 'render', {
          startTime: entry.startTime,
          attribution: (entry as any).attribution?.[0]?.name || 'unknown'
        });
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
    this.observers.push(observer);
  }

  /**
   * Monitor memory usage
   */
  private monitorMemoryUsage() {
    if (!(performance as any).memory) return;

    const checkMemory = () => {
      if (!this.isMonitoring) return;

      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      
      this.recordMetric('memory_usage', usedMB, 'memory', {
        total: memory.totalJSHeapSize / 1024 / 1024,
        limit: memory.jsHeapSizeLimit / 1024 / 1024
      });

      setTimeout(checkMemory, 10000); // Check every 10 seconds
    };

    checkMemory();
  }

  /**
   * Monitor Web Vitals
   */
  private monitorWebVitals() {
    // Largest Contentful Paint (LCP)
    if (PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('lcp', lastEntry.startTime, 'render');
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    }

    // First Input Delay (FID)
    if (PerformanceObserver.supportedEntryTypes?.includes('first-input')) {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('fid', (entry as any).processingStart - entry.startTime, 'render');
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    }

    // Cumulative Layout Shift (CLS)
    if (PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.recordMetric('cls', clsValue, 'render');
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    }
  }

  /**
   * Check performance thresholds and trigger errors if needed
   */
  private checkThresholds(metric: PerformanceMetric) {
    const thresholds = this.getThresholdsForMetric(metric);
    if (!thresholds) return;

    let threshold: number;
    let code: string;

    if (metric.value > thresholds.TIMEOUT) {
      threshold = thresholds.TIMEOUT;
      code = `${metric.category.toUpperCase()}_TIMEOUT`;
    } else if (metric.value > thresholds.SLOW) {
      threshold = thresholds.SLOW;
      code = `${metric.category.toUpperCase()}_SLOW`;
    } else {
      return; // Within acceptable limits
    }

    const error = new PerformanceError(
      `Performance issue detected: ${metric.name} took ${metric.value.toFixed(2)}ms`,
      code,
      {
        metric,
        threshold,
        currentPerformance: this.getCurrentPerformanceInfo(),
        systemInfo: this.getSystemInfo()
      }
    );

    // Record error in metrics
    ErrorMetrics.recordError(error);

    // Trigger error callback if provided
    if (this.errorCallback) {
      this.errorCallback(error);
    }

    console.warn('⚡ Performance threshold exceeded:', {
      metric: metric.name,
      value: metric.value,
      threshold,
      error: error.toResponse()
    });
  }

  /**
   * Get appropriate thresholds for a metric
   */
  private getThresholdsForMetric(metric: PerformanceMetric) {
    switch (metric.category) {
      case 'api':
        return PERFORMANCE_THRESHOLDS.API_RESPONSE;
      case 'render':
        return PERFORMANCE_THRESHOLDS.COMPONENT_RENDER;
      case 'resource':
        return PERFORMANCE_THRESHOLDS.RESOURCE_LOAD;
      case 'memory':
        return PERFORMANCE_THRESHOLDS.MEMORY;
      default:
        return null;
    }
  }

  /**
   * Get current performance information
   */
  private getCurrentPerformanceInfo() {
    return {
      timing: performance.timing,
      memory: (performance as any).memory,
      navigation: performance.navigation,
      recentMetrics: this.metrics.slice(-10)
    };
  }

  /**
   * Get system information
   */
  private getSystemInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      cores: navigator.hardwareConcurrency,
      connectionType: (navigator as any).connection?.effectiveType
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const now = Date.now();
    const recent = this.metrics.filter(m => now - m.timestamp < 60000); // Last minute

    const summary = {
      totalMetrics: this.metrics.length,
      recentMetrics: recent.length,
      categories: {} as Record<string, number>,
      averages: {} as Record<string, number>,
      issues: 0
    };

    // Calculate summaries
    recent.forEach(metric => {
      summary.categories[metric.category] = (summary.categories[metric.category] || 0) + 1;
      
      const thresholds = this.getThresholdsForMetric(metric);
      if (thresholds && metric.value > thresholds.SLOW) {
        summary.issues++;
      }
    });

    return summary;
  }
}

/**
 * React hook for performance monitoring
 */
export const usePerformanceMonitor = (options: {
  autoStart?: boolean;
  onPerformanceError?: (error: PerformanceError) => void;
} = {}) => {
  const { autoStart = true, onPerformanceError } = options;
  const monitorRef = useRef<PerformanceMonitor>();
  const [performanceData, setPerformanceData] = useState<{
    metrics: PerformanceMetric[];
    summary: any;
    isMonitoring: boolean;
  }>({
    metrics: [],
    summary: {},
    isMonitoring: false
  });

  useEffect(() => {
    monitorRef.current = PerformanceMonitor.getInstance();

    if (autoStart) {
      monitorRef.current.startMonitoring(onPerformanceError);
      setPerformanceData(prev => ({ ...prev, isMonitoring: true }));
    }

    return () => {
      if (monitorRef.current) {
        monitorRef.current.stopMonitoring();
        setPerformanceData(prev => ({ ...prev, isMonitoring: false }));
      }
    };
  }, [autoStart, onPerformanceError]);

  const recordMetric = (name: string, value: number, category?: PerformanceMetric['category']) => {
    if (monitorRef.current) {
      monitorRef.current.recordMetric(name, value, category);
      updatePerformanceData();
    }
  };

  const updatePerformanceData = () => {
    if (monitorRef.current) {
      setPerformanceData({
        metrics: monitorRef.current.getMetrics(),
        summary: monitorRef.current.getPerformanceSummary(),
        isMonitoring: true
      });
    }
  };

  return {
    ...performanceData,
    recordMetric,
    updatePerformanceData,
    monitor: monitorRef.current
  };
};

export default PerformanceMonitor;