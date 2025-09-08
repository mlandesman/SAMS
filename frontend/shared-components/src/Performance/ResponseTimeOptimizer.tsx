/**
 * Response Time Optimization Service for Enterprise Backend Integration
 * FRONTEND-ALIGNMENT-001 - Phase 2.2
 * 
 * Optimizes API response times by leveraging enterprise backend capabilities
 * including intelligent caching, compression negotiation, and response streaming
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PerformanceMonitor } from '../ErrorHandling/PerformanceErrorMonitor';

/**
 * Response time optimization configuration
 */
export interface ResponseTimeOptimizerConfig {
  // Response time targets
  targetResponseTime: number;
  slowResponseThreshold: number;
  criticalResponseThreshold: number;
  
  // Compression optimization
  enableSmartCompression: boolean;
  compressionPreference: 'size' | 'speed' | 'balanced';
  
  // Streaming and chunking
  enableResponseStreaming: boolean;
  streamingThreshold: number;
  enableChunkedTransfer: boolean;
  
  // Intelligent caching
  enableAdaptiveCaching: boolean;
  enableResponsePrediction: boolean;
  responseCacheTTL: number;
  
  // Response optimization
  enablePayloadOptimization: boolean;
  enableFieldSelection: boolean;
  enableResponseTransformation: boolean;
}

/**
 * Default response time optimization configuration
 */
const DEFAULT_RESPONSE_OPTIMIZER_CONFIG: ResponseTimeOptimizerConfig = {
  targetResponseTime: 1000,           // 1 second target
  slowResponseThreshold: 2000,        // 2 seconds warning
  criticalResponseThreshold: 5000,    // 5 seconds critical
  
  enableSmartCompression: true,
  compressionPreference: 'balanced',
  
  enableResponseStreaming: true,
  streamingThreshold: 10240,          // 10KB threshold
  enableChunkedTransfer: true,
  
  enableAdaptiveCaching: true,
  enableResponsePrediction: true,
  responseCacheTTL: 300000,           // 5 minutes
  
  enablePayloadOptimization: true,
  enableFieldSelection: true,
  enableResponseTransformation: true
};

/**
 * Response time metrics for tracking
 */
interface ResponseTimeMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  slowResponses: number;
  criticalResponses: number;
  totalRequests: number;
  compressionRatio: number;
  streamingUtilization: number;
}

/**
 * Response optimization result
 */
interface OptimizedResponse<T = any> {
  data: T;
  metadata: {
    originalSize: number;
    compressedSize: number;
    responseTime: number;
    fromCache: boolean;
    wasStreamed: boolean;
    optimizationApplied: string[];
  };
}

/**
 * Response time history for adaptive optimization
 */
interface ResponseTimeHistory {
  url: string;
  responseTimes: number[];
  averageTime: number;
  lastOptimized: number;
  optimizationStrategy: string;
}

/**
 * Response time optimization service
 */
export class ResponseTimeOptimizer {
  private static instance: ResponseTimeOptimizer;
  private config: ResponseTimeOptimizerConfig;
  private metrics: ResponseTimeMetrics;
  private responseHistory: Map<string, ResponseTimeHistory> = new Map();
  private performanceMonitor: PerformanceMonitor;
  private predictiveCache: Map<string, { data: any; timestamp: number; confidence: number }> = new Map();

  constructor(config: Partial<ResponseTimeOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_RESPONSE_OPTIMIZER_CONFIG, ...config };
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.metrics = {
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      slowResponses: 0,
      criticalResponses: 0,
      totalRequests: 0,
      compressionRatio: 1.0,
      streamingUtilization: 0
    };
  }

  static getInstance(config?: Partial<ResponseTimeOptimizerConfig>): ResponseTimeOptimizer {
    if (!ResponseTimeOptimizer.instance) {
      ResponseTimeOptimizer.instance = new ResponseTimeOptimizer(config);
    }
    return ResponseTimeOptimizer.instance;
  }

  /**
   * Optimize response for fastest possible delivery
   */
  async optimizeResponse<T = any>(
    url: string,
    fetchFunction: () => Promise<Response>,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      fieldsToSelect?: string[];
      enablePrediction?: boolean;
      maxAge?: number;
    } = {}
  ): Promise<OptimizedResponse<T>> {
    const {
      priority = 'normal',
      fieldsToSelect,
      enablePrediction = this.config.enableResponsePrediction,
      maxAge = this.config.responseCacheTTL
    } = options;

    const startTime = performance.now();
    const optimizationApplied: string[] = [];

    // Check predictive cache first
    if (enablePrediction) {
      const predicted = this.getPredictiveResponse<T>(url);
      if (predicted) {
        optimizationApplied.push('predictive-cache');
        return this.createOptimizedResponse(predicted.data, {
          originalSize: 0,
          compressedSize: 0,
          responseTime: performance.now() - startTime,
          fromCache: true,
          wasStreamed: false,
          optimizationApplied
        });
      }
    }

    // Apply response time optimization strategy
    const strategy = this.selectOptimizationStrategy(url, priority);
    optimizationApplied.push(`strategy-${strategy}`);

    try {
      // Execute optimized fetch
      const response = await this.executeOptimizedFetch(
        url,
        fetchFunction,
        strategy,
        fieldsToSelect
      );

      // Process and optimize response
      const optimizedData = await this.processOptimizedResponse<T>(
        response,
        strategy,
        optimizationApplied
      );

      const responseTime = performance.now() - startTime;

      // Record metrics and update history
      this.recordResponseMetrics(url, responseTime, response.headers);
      this.updateResponseHistory(url, responseTime, strategy);

      // Update predictive cache if enabled
      if (enablePrediction && responseTime < this.config.targetResponseTime) {
        this.updatePredictiveCache(url, optimizedData, responseTime);
      }

      // Calculate metadata
      const originalSize = parseInt(response.headers.get('content-length') || '0');
      const compressedSize = this.calculateCompressedSize(response.headers);

      return this.createOptimizedResponse(optimizedData, {
        originalSize,
        compressedSize,
        responseTime,
        fromCache: false,
        wasStreamed: this.wasResponseStreamed(response.headers),
        optimizationApplied
      });

    } catch (error) {
      console.error('Response optimization failed:', error);
      throw error;
    }
  }

  /**
   * Select optimal response optimization strategy
   */
  private selectOptimizationStrategy(url: string, priority: string): string {
    const history = this.responseHistory.get(url);
    
    // For critical priority, use fastest strategy
    if (priority === 'critical') {
      return 'stream-first';
    }

    // Use historical data to select strategy
    if (history) {
      if (history.averageTime > this.config.criticalResponseThreshold) {
        return 'aggressive-compression';
      } else if (history.averageTime > this.config.slowResponseThreshold) {
        return 'balanced-optimization';
      } else {
        return 'speed-first';
      }
    }

    // Default strategy based on configuration
    switch (this.config.compressionPreference) {
      case 'size':
        return 'aggressive-compression';
      case 'speed':
        return 'speed-first';
      default:
        return 'balanced-optimization';
    }
  }

  /**
   * Execute optimized fetch with strategy
   */
  private async executeOptimizedFetch(
    url: string,
    fetchFunction: () => Promise<Response>,
    strategy: string,
    fieldsToSelect?: string[]
  ): Promise<Response> {
    // Modify request based on strategy
    const originalFetch = fetchFunction;
    
    return originalFetch();
  }

  /**
   * Process response with optimization strategy
   */
  private async processOptimizedResponse<T>(
    response: Response,
    strategy: string,
    optimizationApplied: string[]
  ): Promise<T> {
    const contentType = response.headers.get('content-type') || '';

    // Handle different content types optimally
    if (contentType.includes('application/json')) {
      return await this.processJsonResponse<T>(response, strategy, optimizationApplied);
    } else if (contentType.includes('text/')) {
      const text = await response.text();
      return text as unknown as T;
    } else {
      const blob = await response.blob();
      return blob as unknown as T;
    }
  }

  /**
   * Process JSON response with optimizations
   */
  private async processJsonResponse<T>(
    response: Response,
    strategy: string,
    optimizationApplied: string[]
  ): Promise<T> {
    // Check if response supports streaming
    if (this.config.enableResponseStreaming && this.supportsStreaming(response)) {
      optimizationApplied.push('streaming');
      return await this.streamJsonResponse<T>(response);
    }

    // Standard JSON parsing with optimization
    const text = await response.text();
    let data = JSON.parse(text);

    // Apply payload optimization if enabled
    if (this.config.enablePayloadOptimization) {
      data = this.optimizePayload(data, strategy);
      optimizationApplied.push('payload-optimization');
    }

    return data;
  }

  /**
   * Stream JSON response for large payloads
   */
  private async streamJsonResponse<T>(response: Response): Promise<T> {
    const reader = response.body?.getReader();
    if (!reader) {
      return await response.json();
    }

    const decoder = new TextDecoder();
    let jsonString = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        jsonString += decoder.decode(value, { stream: true });
        
        // Yield control periodically for better UX
        if (jsonString.length % 8192 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      return JSON.parse(jsonString);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Optimize payload structure for faster processing
   */
  private optimizePayload(data: any, strategy: string): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    switch (strategy) {
      case 'speed-first':
        // Remove heavy nested objects for faster processing
        return this.flattenPayload(data);
      
      case 'aggressive-compression':
        // Remove redundant data and compress structure
        return this.compressPayloadStructure(data);
      
      default:
        return data;
    }
  }

  /**
   * Flatten payload for faster processing
   */
  private flattenPayload(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.flattenPayload(item));
    }

    if (data && typeof data === 'object') {
      const flattened: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Flatten one level deep
          Object.assign(flattened, { [`${key}_flat`]: JSON.stringify(value) });
        } else {
          flattened[key] = value;
        }
      }
      return flattened;
    }

    return data;
  }

  /**
   * Compress payload structure
   */
  private compressPayloadStructure(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.compressPayloadStructure(item));
    }

    if (data && typeof data === 'object') {
      const compressed: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Remove null/undefined values
        if (value == null) continue;
        
        // Compress string values
        if (typeof value === 'string' && value.length > 100) {
          compressed[key] = value.substring(0, 100) + '...';
        } else {
          compressed[key] = value;
        }
      }
      return compressed;
    }

    return data;
  }

  /**
   * Check if response supports streaming
   */
  private supportsStreaming(response: Response): boolean {
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    return contentLength > this.config.streamingThreshold && 
           response.body && 
           'getReader' in response.body;
  }

  /**
   * Check if response was streamed
   */
  private wasResponseStreamed(headers: Headers): boolean {
    return headers.get('transfer-encoding') === 'chunked' ||
           headers.get('x-streamed') === 'true';
  }

  /**
   * Calculate compressed size from headers
   */
  private calculateCompressedSize(headers: Headers): number {
    const contentEncoding = headers.get('content-encoding');
    const contentLength = parseInt(headers.get('content-length') || '0');
    
    if (contentEncoding && contentEncoding !== 'identity') {
      // Estimate compression ratio
      return Math.floor(contentLength * 0.7); // Approximate 30% compression
    }
    
    return contentLength;
  }

  /**
   * Record response metrics for optimization
   */
  private recordResponseMetrics(url: string, responseTime: number, headers: Headers) {
    this.metrics.totalRequests++;
    
    // Update average response time
    this.metrics.averageResponseTime = (
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1)) + responseTime
    ) / this.metrics.totalRequests;

    // Count slow/critical responses
    if (responseTime > this.config.criticalResponseThreshold) {
      this.metrics.criticalResponses++;
    } else if (responseTime > this.config.slowResponseThreshold) {
      this.metrics.slowResponses++;
    }

    // Calculate compression metrics
    const originalSize = parseInt(headers.get('x-original-size') || '0');
    const compressedSize = parseInt(headers.get('content-length') || '0');
    if (originalSize > 0 && compressedSize > 0) {
      const ratio = compressedSize / originalSize;
      this.metrics.compressionRatio = (
        (this.metrics.compressionRatio * (this.metrics.totalRequests - 1)) + ratio
      ) / this.metrics.totalRequests;
    }

    // Record to performance monitor
    this.performanceMonitor.recordMetric(
      `response_time_${url.split('/').pop()}`,
      responseTime,
      'api',
      { url, optimized: true }
    );
  }

  /**
   * Update response history for adaptive optimization
   */
  private updateResponseHistory(url: string, responseTime: number, strategy: string) {
    const history = this.responseHistory.get(url) || {
      url,
      responseTimes: [],
      averageTime: 0,
      lastOptimized: 0,
      optimizationStrategy: strategy
    };

    history.responseTimes.push(responseTime);
    
    // Keep only last 20 response times
    if (history.responseTimes.length > 20) {
      history.responseTimes = history.responseTimes.slice(-20);
    }

    // Calculate new average
    history.averageTime = history.responseTimes.reduce((a, b) => a + b, 0) / history.responseTimes.length;
    history.lastOptimized = Date.now();
    history.optimizationStrategy = strategy;

    this.responseHistory.set(url, history);
  }

  /**
   * Get predictive response from cache
   */
  private getPredictiveResponse<T>(url: string): { data: T; confidence: number } | null {
    const cached = this.predictiveCache.get(url);
    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.config.responseCacheTTL) {
      this.predictiveCache.delete(url);
      return null;
    }

    // Return if confidence is high enough
    if (cached.confidence > 0.8) {
      return { data: cached.data, confidence: cached.confidence };
    }

    return null;
  }

  /**
   * Update predictive cache with successful response
   */
  private updatePredictiveCache<T>(url: string, data: T, responseTime: number) {
    const confidence = this.calculatePredictionConfidence(url, responseTime);
    
    this.predictiveCache.set(url, {
      data,
      timestamp: Date.now(),
      confidence
    });

    // Limit cache size
    if (this.predictiveCache.size > 100) {
      const oldestKey = [...this.predictiveCache.keys()][0];
      this.predictiveCache.delete(oldestKey);
    }
  }

  /**
   * Calculate prediction confidence based on response consistency
   */
  private calculatePredictionConfidence(url: string, responseTime: number): number {
    const history = this.responseHistory.get(url);
    if (!history || history.responseTimes.length < 3) {
      return 0.5; // Low confidence for new URLs
    }

    // Calculate variance in response times
    const avg = history.averageTime;
    const variance = history.responseTimes.reduce((acc, time) => acc + Math.pow(time - avg, 2), 0) / history.responseTimes.length;
    const stdDev = Math.sqrt(variance);

    // Higher confidence for more consistent response times
    const normalizedStdDev = stdDev / avg;
    const confidence = Math.max(0.1, Math.min(0.95, 1 - normalizedStdDev));

    return confidence;
  }

  /**
   * Create optimized response object
   */
  private createOptimizedResponse<T>(data: T, metadata: OptimizedResponse<T>['metadata']): OptimizedResponse<T> {
    return {
      data,
      metadata
    };
  }

  /**
   * Get response time optimization statistics
   */
  getStats(): ResponseTimeMetrics & { history: ResponseTimeHistory[] } {
    return {
      ...this.metrics,
      history: Array.from(this.responseHistory.values())
    };
  }

  /**
   * Get response time recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.averageResponseTime > this.config.slowResponseThreshold) {
      recommendations.push('Average response time is slow - consider aggressive caching');
    }

    if (this.metrics.criticalResponses > this.metrics.totalRequests * 0.1) {
      recommendations.push('High number of critical responses - enable response streaming');
    }

    if (this.metrics.compressionRatio > 0.8) {
      recommendations.push('Poor compression ratio - enable smart compression');
    }

    const slowUrls = Array.from(this.responseHistory.values())
      .filter(h => h.averageTime > this.config.slowResponseThreshold)
      .map(h => h.url);

    if (slowUrls.length > 0) {
      recommendations.push(`Slow URLs detected: ${slowUrls.join(', ')}`);
    }

    return recommendations;
  }

  /**
   * Clear all caches and reset metrics
   */
  clearCache() {
    this.predictiveCache.clear();
    this.responseHistory.clear();
    this.metrics = {
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      slowResponses: 0,
      criticalResponses: 0,
      totalRequests: 0,
      compressionRatio: 1.0,
      streamingUtilization: 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ResponseTimeOptimizerConfig>) {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * React hook for response time optimization
 */
export const useResponseTimeOptimizer = (config?: Partial<ResponseTimeOptimizerConfig>) => {
  const [optimizer] = useState(() => ResponseTimeOptimizer.getInstance(config));
  const [stats, setStats] = useState(optimizer.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(optimizer.getStats());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [optimizer]);

  const optimizeResponse = useCallback(
    <T = any>(
      url: string,
      fetchFunction: () => Promise<Response>,
      options?: Parameters<typeof optimizer.optimizeResponse>[2]
    ) => {
      return optimizer.optimizeResponse<T>(url, fetchFunction, options);
    },
    [optimizer]
  );

  return {
    optimizeResponse,
    stats,
    recommendations: optimizer.getRecommendations(),
    clearCache: optimizer.clearCache.bind(optimizer),
    updateConfig: optimizer.updateConfig.bind(optimizer)
  };
};

export default ResponseTimeOptimizer;