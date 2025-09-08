/**
 * Performance Validation System for Enterprise UX
 * FRONTEND-ALIGNMENT-001 - Phase 4.4
 * 
 * Validates performance improvements across all implemented UX systems
 * and ensures enterprise-grade responsiveness and efficiency
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LoadingStateManager } from './LoadingStateManager';
import { FeedbackSystem } from './FeedbackSystem';
import { ProgressiveEnhancementManager } from './ProgressiveEnhancement';

/**
 * Performance metric definition
 */
interface PerformanceMetric {
  name: string;
  category: 'initialization' | 'operation' | 'memory' | 'responsiveness' | 'throughput';
  value: number;
  unit: 'ms' | 'mb' | 'ops/sec' | 'count' | 'percent';
  threshold: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  improvement?: number; // Percentage improvement over baseline
}

/**
 * Performance benchmark result
 */
interface BenchmarkResult {
  testName: string;
  category: string;
  metrics: PerformanceMetric[];
  duration: number;
  timestamp: number;
  baseline?: PerformanceMetric[];
}

/**
 * Performance validation configuration
 */
interface PerformanceConfig {
  // Timing thresholds (ms)
  initializationThreshold: number;
  operationThreshold: number;
  responseTimeThreshold: number;
  
  // Memory thresholds (MB)
  memoryUsageThreshold: number;
  memoryLeakThreshold: number;
  
  // Throughput thresholds
  operationsPerSecondThreshold: number;
  concurrentOperationsThreshold: number;
  
  // Test configuration
  warmupIterations: number;
  testIterations: number;
  concurrencyLevels: number[];
}

/**
 * Default performance configuration
 */
const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  initializationThreshold: 500,        // 500ms max initialization
  operationThreshold: 100,             // 100ms max operation
  responseTimeThreshold: 50,           // 50ms max response time
  
  memoryUsageThreshold: 10,            // 10MB max usage
  memoryLeakThreshold: 5,              // 5MB max leak
  
  operationsPerSecondThreshold: 100,   // 100 ops/sec min
  concurrentOperationsThreshold: 50,   // 50 concurrent ops
  
  warmupIterations: 10,
  testIterations: 100,
  concurrencyLevels: [1, 5, 10, 25, 50]
};

/**
 * Enterprise Performance Validator
 */
export class PerformanceValidator {
  private static instance: PerformanceValidator;
  private config: PerformanceConfig;
  private loadingManager: LoadingStateManager;
  private feedbackSystem: FeedbackSystem;
  private enhancementManager: ProgressiveEnhancementManager;
  private benchmarkResults: BenchmarkResult[] = [];
  private baselineMetrics: Map<string, PerformanceMetric[]> = new Map();

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    this.loadingManager = LoadingStateManager.getInstance();
    this.feedbackSystem = FeedbackSystem.getInstance();
    this.enhancementManager = ProgressiveEnhancementManager.getInstance();
  }

  static getInstance(config?: Partial<PerformanceConfig>): PerformanceValidator {
    if (!PerformanceValidator.instance) {
      PerformanceValidator.instance = new PerformanceValidator(config);
    }
    return PerformanceValidator.instance;
  }

  /**
   * Run comprehensive performance validation
   */
  async runPerformanceValidation(): Promise<BenchmarkResult[]> {
    console.log('🚀 Starting comprehensive performance validation...');

    this.benchmarkResults = [];

    try {
      // 1. System Initialization Performance
      await this.benchmarkInitialization();

      // 2. Loading State Performance
      await this.benchmarkLoadingState();

      // 3. Feedback System Performance
      await this.benchmarkFeedbackSystem();

      // 4. Progressive Enhancement Performance
      await this.benchmarkProgressiveEnhancement();

      // 5. Memory Usage Validation
      await this.benchmarkMemoryUsage();

      // 6. Concurrent Operations Performance
      await this.benchmarkConcurrentOperations();

      // 7. Response Time Validation
      await this.benchmarkResponseTimes();

      // 8. Throughput Validation
      await this.benchmarkThroughput();

      console.log('✅ Performance validation completed', {
        totalBenchmarks: this.benchmarkResults.length,
        excellentMetrics: this.countMetricsByStatus('excellent'),
        goodMetrics: this.countMetricsByStatus('good'),
        warningMetrics: this.countMetricsByStatus('warning'),
        criticalMetrics: this.countMetricsByStatus('critical')
      });

    } catch (error) {
      console.error('❌ Performance validation failed:', error);
    }

    return this.benchmarkResults;
  }

  /**
   * Benchmark system initialization performance
   */
  private async benchmarkInitialization(): Promise<void> {
    const metrics: PerformanceMetric[] = [];

    // Loading State Manager initialization
    const loadingStartTime = performance.now();
    LoadingStateManager.getInstance();
    const loadingInitTime = performance.now() - loadingStartTime;

    metrics.push({
      name: 'Loading Manager Init',
      category: 'initialization',
      value: loadingInitTime,
      unit: 'ms',
      threshold: this.config.initializationThreshold,
      status: this.getPerformanceStatus(loadingInitTime, this.config.initializationThreshold)
    });

    // Feedback System initialization
    const feedbackStartTime = performance.now();
    FeedbackSystem.getInstance();
    const feedbackInitTime = performance.now() - feedbackStartTime;

    metrics.push({
      name: 'Feedback System Init',
      category: 'initialization',
      value: feedbackInitTime,
      unit: 'ms',
      threshold: this.config.initializationThreshold,
      status: this.getPerformanceStatus(feedbackInitTime, this.config.initializationThreshold)
    });

    // Progressive Enhancement initialization
    const enhancementStartTime = performance.now();
    await this.enhancementManager.initialize();
    const enhancementInitTime = performance.now() - enhancementStartTime;

    metrics.push({
      name: 'Progressive Enhancement Init',
      category: 'initialization',
      value: enhancementInitTime,
      unit: 'ms',
      threshold: this.config.initializationThreshold,
      status: this.getPerformanceStatus(enhancementInitTime, this.config.initializationThreshold)
    });

    this.addBenchmarkResult('System Initialization', 'initialization', metrics);
  }

  /**
   * Benchmark loading state performance
   */
  private async benchmarkLoadingState(): Promise<void> {
    const metrics: PerformanceMetric[] = [];

    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      const controller = this.loadingManager.startLoading(`warmup-${i}`, {
        operationType: 'read',
        complexity: 'low'
      });
      controller.complete();
    }

    // Test loading state creation performance
    const creationTimes: number[] = [];
    for (let i = 0; i < this.config.testIterations; i++) {
      const startTime = performance.now();
      const controller = this.loadingManager.startLoading(`test-${i}`, {
        operationType: 'read',
        complexity: 'medium',
        priority: 'normal'
      });
      const creationTime = performance.now() - startTime;
      creationTimes.push(creationTime);
      controller.complete();
    }

    const avgCreationTime = creationTimes.reduce((a, b) => a + b, 0) / creationTimes.length;
    const maxCreationTime = Math.max(...creationTimes);
    const minCreationTime = Math.min(...creationTimes);

    metrics.push({
      name: 'Loading State Creation (Avg)',
      category: 'operation',
      value: avgCreationTime,
      unit: 'ms',
      threshold: this.config.operationThreshold,
      status: this.getPerformanceStatus(avgCreationTime, this.config.operationThreshold)
    });

    metrics.push({
      name: 'Loading State Creation (Max)',
      category: 'operation',
      value: maxCreationTime,
      unit: 'ms',
      threshold: this.config.operationThreshold * 2,
      status: this.getPerformanceStatus(maxCreationTime, this.config.operationThreshold * 2)
    });

    // Test prediction system performance
    const predictionTimes: number[] = [];
    for (let i = 0; i < 50; i++) {
      const controller = this.loadingManager.startLoading(`prediction-test-${i}`, {
        operationType: 'read',
        complexity: 'medium'
      });
      
      const startTime = performance.now();
      controller.getPredictedDuration();
      const predictionTime = performance.now() - startTime;
      predictionTimes.push(predictionTime);
      
      controller.complete();
    }

    const avgPredictionTime = predictionTimes.reduce((a, b) => a + b, 0) / predictionTimes.length;

    metrics.push({
      name: 'Duration Prediction',
      category: 'operation',
      value: avgPredictionTime,
      unit: 'ms',
      threshold: this.config.operationThreshold / 2,
      status: this.getPerformanceStatus(avgPredictionTime, this.config.operationThreshold / 2)
    });

    this.addBenchmarkResult('Loading State Performance', 'operation', metrics);
  }

  /**
   * Benchmark feedback system performance
   */
  private async benchmarkFeedbackSystem(): Promise<void> {
    const metrics: PerformanceMetric[] = [];

    // Test feedback creation performance
    const creationTimes: number[] = [];
    for (let i = 0; i < this.config.testIterations; i++) {
      const startTime = performance.now();
      const feedbackId = this.feedbackSystem.showFeedback('info', `Test message ${i}`, {
        urgency: 'normal'
      });
      const creationTime = performance.now() - startTime;
      creationTimes.push(creationTime);
      this.feedbackSystem.dismissFeedback(feedbackId);
    }

    const avgCreationTime = creationTimes.reduce((a, b) => a + b, 0) / creationTimes.length;

    metrics.push({
      name: 'Feedback Creation',
      category: 'operation',
      value: avgCreationTime,
      unit: 'ms',
      threshold: this.config.operationThreshold,
      status: this.getPerformanceStatus(avgCreationTime, this.config.operationThreshold)
    });

    // Test optimistic feedback performance
    const optimisticTimes: number[] = [];
    for (let i = 0; i < 20; i++) {
      const promise = Promise.resolve({ success: true });
      const startTime = performance.now();
      await this.feedbackSystem.showOptimisticFeedback(`Optimistic test ${i}`, promise);
      const optimisticTime = performance.now() - startTime;
      optimisticTimes.push(optimisticTime);
    }

    const avgOptimisticTime = optimisticTimes.reduce((a, b) => a + b, 0) / optimisticTimes.length;

    metrics.push({
      name: 'Optimistic Feedback',
      category: 'operation',
      value: avgOptimisticTime,
      unit: 'ms',
      threshold: this.config.operationThreshold * 2,
      status: this.getPerformanceStatus(avgOptimisticTime, this.config.operationThreshold * 2)
    });

    // Test feedback throughput
    const throughputStartTime = performance.now();
    const feedbackIds = [];
    for (let i = 0; i < 100; i++) {
      feedbackIds.push(this.feedbackSystem.showFeedback('info', `Throughput test ${i}`));
    }
    const throughputTime = performance.now() - throughputStartTime;
    const throughput = 100 / (throughputTime / 1000); // ops per second

    // Clean up
    feedbackIds.forEach(id => this.feedbackSystem.dismissFeedback(id));

    metrics.push({
      name: 'Feedback Throughput',
      category: 'throughput',
      value: throughput,
      unit: 'ops/sec',
      threshold: this.config.operationsPerSecondThreshold,
      status: this.getPerformanceStatus(throughput, this.config.operationsPerSecondThreshold, true)
    });

    this.addBenchmarkResult('Feedback System Performance', 'operation', metrics);
  }

  /**
   * Benchmark progressive enhancement performance
   */
  private async benchmarkProgressiveEnhancement(): Promise<void> {
    const metrics: PerformanceMetric[] = [];

    // Test capability detection performance
    const detectionTimes: number[] = [];
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      await this.enhancementManager.initialize();
      const detectionTime = performance.now() - startTime;
      detectionTimes.push(detectionTime);
    }

    const avgDetectionTime = detectionTimes.reduce((a, b) => a + b, 0) / detectionTimes.length;

    metrics.push({
      name: 'Capability Detection',
      category: 'initialization',
      value: avgDetectionTime,
      unit: 'ms',
      threshold: this.config.initializationThreshold,
      status: this.getPerformanceStatus(avgDetectionTime, this.config.initializationThreshold)
    });

    // Test feature availability checking performance
    const features = ['basic-crud', 'real-time-updates', 'advanced-analytics', 'live-collaboration'];
    const featureTimes: number[] = [];
    
    for (let i = 0; i < this.config.testIterations; i++) {
      const feature = features[i % features.length];
      const startTime = performance.now();
      this.enhancementManager.isFeatureAvailable(feature);
      const featureTime = performance.now() - startTime;
      featureTimes.push(featureTime);
    }

    const avgFeatureTime = featureTimes.reduce((a, b) => a + b, 0) / featureTimes.length;

    metrics.push({
      name: 'Feature Availability Check',
      category: 'operation',
      value: avgFeatureTime,
      unit: 'ms',
      threshold: this.config.operationThreshold / 10,
      status: this.getPerformanceStatus(avgFeatureTime, this.config.operationThreshold / 10)
    });

    // Test adaptation performance
    const adaptationTimes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();
      await this.enhancementManager.adaptToConditions();
      const adaptationTime = performance.now() - startTime;
      adaptationTimes.push(adaptationTime);
    }

    const avgAdaptationTime = adaptationTimes.reduce((a, b) => a + b, 0) / adaptationTimes.length;

    metrics.push({
      name: 'Condition Adaptation',
      category: 'operation',
      value: avgAdaptationTime,
      unit: 'ms',
      threshold: this.config.operationThreshold * 2,
      status: this.getPerformanceStatus(avgAdaptationTime, this.config.operationThreshold * 2)
    });

    this.addBenchmarkResult('Progressive Enhancement Performance', 'operation', metrics);
  }

  /**
   * Benchmark memory usage
   */
  private async benchmarkMemoryUsage(): Promise<void> {
    const metrics: PerformanceMetric[] = [];

    if ((performance as any).memory) {
      const initialMemory = (performance as any).memory.usedJSHeapSize;

      // Create many operations to test memory usage
      const controllers = [];
      const feedbackIds = [];

      for (let i = 0; i < 200; i++) {
        controllers.push(this.loadingManager.startLoading(`memory-test-${i}`, {
          operationType: 'read',
          complexity: 'medium'
        }));
        
        feedbackIds.push(this.feedbackSystem.showFeedback('info', `Memory test ${i}`));
      }

      const peakMemory = (performance as any).memory.usedJSHeapSize;
      const memoryUsage = (peakMemory - initialMemory) / 1024 / 1024; // MB

      // Clean up
      controllers.forEach(controller => controller.complete());
      feedbackIds.forEach(id => this.feedbackSystem.dismissFeedback(id));

      // Force garbage collection if available
      if ((window as any).gc) {
        (window as any).gc();
      }

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = (performance as any).memory.usedJSHeapSize;
      const memoryLeak = (finalMemory - initialMemory) / 1024 / 1024; // MB

      metrics.push({
        name: 'Peak Memory Usage',
        category: 'memory',
        value: memoryUsage,
        unit: 'mb',
        threshold: this.config.memoryUsageThreshold,
        status: this.getPerformanceStatus(memoryUsage, this.config.memoryUsageThreshold)
      });

      metrics.push({
        name: 'Memory Leak',
        category: 'memory',
        value: memoryLeak,
        unit: 'mb',
        threshold: this.config.memoryLeakThreshold,
        status: this.getPerformanceStatus(memoryLeak, this.config.memoryLeakThreshold)
      });
    } else {
      metrics.push({
        name: 'Memory Monitoring',
        category: 'memory',
        value: 0,
        unit: 'mb',
        threshold: 0,
        status: 'warning'
      });
    }

    this.addBenchmarkResult('Memory Usage', 'memory', metrics);
  }

  /**
   * Benchmark concurrent operations
   */
  private async benchmarkConcurrentOperations(): Promise<void> {
    const metrics: PerformanceMetric[] = [];

    for (const concurrency of this.config.concurrencyLevels) {
      const startTime = performance.now();
      const operations = [];
      const feedbacks = [];

      // Create concurrent operations
      for (let i = 0; i < concurrency; i++) {
        operations.push(this.loadingManager.startLoading(`concurrent-${concurrency}-${i}`, {
          operationType: 'read',
          complexity: 'low'
        }));
        
        if (i % 3 === 0) {
          feedbacks.push(this.feedbackSystem.showFeedback('info', `Concurrent test ${i}`));
        }
      }

      const creationTime = performance.now() - startTime;
      
      // Complete all operations
      const completionStartTime = performance.now();
      operations.forEach(op => op.complete());
      feedbacks.forEach(id => this.feedbackSystem.dismissFeedback(id));
      const completionTime = performance.now() - completionStartTime;

      const totalTime = performance.now() - startTime;
      const throughput = concurrency / (totalTime / 1000);

      metrics.push({
        name: `Concurrent Ops (${concurrency})`,
        category: 'throughput',
        value: throughput,
        unit: 'ops/sec',
        threshold: this.config.operationsPerSecondThreshold,
        status: this.getPerformanceStatus(throughput, this.config.operationsPerSecondThreshold, true)
      });
    }

    this.addBenchmarkResult('Concurrent Operations', 'throughput', metrics);
  }

  /**
   * Benchmark response times
   */
  private async benchmarkResponseTimes(): Promise<void> {
    const metrics: PerformanceMetric[] = [];

    // Test various operation response times
    const operations = [
      () => this.loadingManager.startLoading('response-test', { operationType: 'read', complexity: 'low' }),
      () => this.feedbackSystem.showFeedback('info', 'Response test'),
      () => this.enhancementManager.isFeatureAvailable('basic-crud')
    ];

    for (let i = 0; i < operations.length; i++) {
      const times: number[] = [];
      const operation = operations[i];
      
      for (let j = 0; j < 50; j++) {
        const startTime = performance.now();
        const result = operation();
        const responseTime = performance.now() - startTime;
        times.push(responseTime);
        
        // Clean up if needed
        if (typeof result === 'object' && 'complete' in result) {
          result.complete();
        } else if (typeof result === 'string') {
          this.feedbackSystem.dismissFeedback(result);
        }
      }

      const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxResponseTime = Math.max(...times);
      const p95ResponseTime = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      metrics.push({
        name: `Response Time ${i + 1} (Avg)`,
        category: 'responsiveness',
        value: avgResponseTime,
        unit: 'ms',
        threshold: this.config.responseTimeThreshold,
        status: this.getPerformanceStatus(avgResponseTime, this.config.responseTimeThreshold)
      });

      metrics.push({
        name: `Response Time ${i + 1} (P95)`,
        category: 'responsiveness',
        value: p95ResponseTime,
        unit: 'ms',
        threshold: this.config.responseTimeThreshold * 2,
        status: this.getPerformanceStatus(p95ResponseTime, this.config.responseTimeThreshold * 2)
      });
    }

    this.addBenchmarkResult('Response Times', 'responsiveness', metrics);
  }

  /**
   * Benchmark system throughput
   */
  private async benchmarkThroughput(): Promise<void> {
    const metrics: PerformanceMetric[] = [];

    // Loading state throughput
    const loadingStartTime = performance.now();
    const controllers = [];
    for (let i = 0; i < 1000; i++) {
      controllers.push(this.loadingManager.startLoading(`throughput-${i}`, {
        operationType: 'read',
        complexity: 'low'
      }));
    }
    controllers.forEach(c => c.complete());
    const loadingTime = performance.now() - loadingStartTime;
    const loadingThroughput = 1000 / (loadingTime / 1000);

    metrics.push({
      name: 'Loading State Throughput',
      category: 'throughput',
      value: loadingThroughput,
      unit: 'ops/sec',
      threshold: this.config.operationsPerSecondThreshold,
      status: this.getPerformanceStatus(loadingThroughput, this.config.operationsPerSecondThreshold, true)
    });

    // Feedback system throughput
    const feedbackStartTime = performance.now();
    const feedbackIds = [];
    for (let i = 0; i < 500; i++) {
      feedbackIds.push(this.feedbackSystem.showFeedback('info', `Throughput test ${i}`));
    }
    feedbackIds.forEach(id => this.feedbackSystem.dismissFeedback(id));
    const feedbackTime = performance.now() - feedbackStartTime;
    const feedbackThroughput = 500 / (feedbackTime / 1000);

    metrics.push({
      name: 'Feedback Throughput',
      category: 'throughput',
      value: feedbackThroughput,
      unit: 'ops/sec',
      threshold: this.config.operationsPerSecondThreshold,
      status: this.getPerformanceStatus(feedbackThroughput, this.config.operationsPerSecondThreshold, true)
    });

    this.addBenchmarkResult('System Throughput', 'throughput', metrics);
  }

  /**
   * Get performance status based on value and threshold
   */
  private getPerformanceStatus(
    value: number, 
    threshold: number, 
    higherIsBetter: boolean = false
  ): PerformanceMetric['status'] {
    const ratio = higherIsBetter ? value / threshold : threshold / value;
    
    if (ratio >= 2) return 'excellent';
    if (ratio >= 1.5) return 'good';
    if (ratio >= 1) return higherIsBetter ? 'good' : 'warning';
    return 'critical';
  }

  /**
   * Add benchmark result
   */
  private addBenchmarkResult(
    testName: string,
    category: string,
    metrics: PerformanceMetric[]
  ): void {
    const startTime = Date.now();
    
    const result: BenchmarkResult = {
      testName,
      category,
      metrics,
      duration: 0, // Will be updated
      timestamp: startTime
    };

    this.benchmarkResults.push(result);
    
    console.log(`📊 ${testName} completed - ${metrics.length} metrics`);
  }

  /**
   * Count metrics by status
   */
  private countMetricsByStatus(status: PerformanceMetric['status']): number {
    return this.benchmarkResults
      .flatMap(result => result.metrics)
      .filter(metric => metric.status === status)
      .length;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalMetrics: number;
    excellent: number;
    good: number;
    warning: number;
    critical: number;
    overallScore: number;
    categories: Record<string, { metrics: number; avgScore: number }>;
  } {
    const allMetrics = this.benchmarkResults.flatMap(result => result.metrics);
    
    const excellent = allMetrics.filter(m => m.status === 'excellent').length;
    const good = allMetrics.filter(m => m.status === 'good').length;
    const warning = allMetrics.filter(m => m.status === 'warning').length;
    const critical = allMetrics.filter(m => m.status === 'critical').length;
    
    const overallScore = allMetrics.length > 0 ? 
      ((excellent * 4 + good * 3 + warning * 2 + critical * 1) / (allMetrics.length * 4)) * 100 : 0;

    const categories = this.benchmarkResults.reduce((acc, result) => {
      if (!acc[result.category]) {
        acc[result.category] = { metrics: 0, avgScore: 0 };
      }
      acc[result.category].metrics += result.metrics.length;
      
      const categoryScore = result.metrics.reduce((sum, metric) => {
        const score = metric.status === 'excellent' ? 4 : 
                     metric.status === 'good' ? 3 :
                     metric.status === 'warning' ? 2 : 1;
        return sum + score;
      }, 0) / result.metrics.length;
      
      acc[result.category].avgScore = categoryScore;
      return acc;
    }, {} as Record<string, { metrics: number; avgScore: number }>);

    return {
      totalMetrics: allMetrics.length,
      excellent,
      good,
      warning,
      critical,
      overallScore,
      categories
    };
  }

  /**
   * Get benchmark results
   */
  getBenchmarkResults(): BenchmarkResult[] {
    return [...this.benchmarkResults];
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * React hook for performance validation
 */
export const usePerformanceValidation = (config?: Partial<PerformanceConfig>) => {
  const [validator] = useState(() => PerformanceValidator.getInstance(config));
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [summary, setSummary] = useState(validator.getPerformanceSummary());

  const runValidation = useCallback(async () => {
    setIsRunning(true);
    try {
      const benchmarkResults = await validator.runPerformanceValidation();
      setResults(benchmarkResults);
      setSummary(validator.getPerformanceSummary());
    } finally {
      setIsRunning(false);
    }
  }, [validator]);

  return {
    runValidation,
    isRunning,
    results,
    summary,
    validator
  };
};

export default PerformanceValidator;