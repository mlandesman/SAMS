/**
 * Concurrent Operation Manager for Enterprise Backend Integration
 * FRONTEND-ALIGNMENT-001 - Phase 2.3
 * 
 * Enables efficient concurrent operations by leveraging enterprise backend
 * parallel processing capabilities and intelligent operation coordination
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PerformanceMonitor } from '../ErrorHandling/PerformanceErrorMonitor';
import { ErrorFactory } from '../ErrorHandling/StandardizedError';
import { ERROR_CODES } from '../ErrorHandling';

/**
 * Concurrent operation configuration
 */
export interface ConcurrentOperationConfig {
  // Operation limits
  maxConcurrentOperations: number;
  maxParallelRequests: number;
  operationTimeout: number;
  
  // Coordination settings
  enableOperationBatching: boolean;
  batchWindow: number;
  maxBatchSize: number;
  
  // Resource management
  enableResourceThrottling: boolean;
  resourcePriority: 'cpu' | 'memory' | 'network' | 'balanced';
  adaptiveThrottling: boolean;
  
  // Progress tracking
  enableProgressTracking: boolean;
  progressUpdateInterval: number;
  enableOperationMetrics: boolean;
}

/**
 * Default concurrent operation configuration
 */
const DEFAULT_CONCURRENT_CONFIG: ConcurrentOperationConfig = {
  maxConcurrentOperations: 10,      // Max 10 concurrent operations
  maxParallelRequests: 6,           // Max 6 parallel HTTP requests
  operationTimeout: 30000,          // 30 seconds timeout
  
  enableOperationBatching: true,
  batchWindow: 100,                 // 100ms batching window
  maxBatchSize: 5,                  // Max 5 operations per batch
  
  enableResourceThrottling: true,
  resourcePriority: 'balanced',
  adaptiveThrottling: true,
  
  enableProgressTracking: true,
  progressUpdateInterval: 500,      // 500ms progress updates
  enableOperationMetrics: true
};

/**
 * Operation definition
 */
interface Operation<T = any> {
  id: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  executor: () => Promise<T>;
  dependencies?: string[];
  timeout?: number;
  retryable?: boolean;
  maxRetries?: number;
  metadata?: Record<string, any>;
}

/**
 * Operation result
 */
interface OperationResult<T = any> {
  id: string;
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
  retryCount: number;
  startTime: number;
  endTime: number;
}

/**
 * Operation progress tracking
 */
interface OperationProgress {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: number;
  estimatedDuration?: number;
  message?: string;
}

/**
 * Concurrent operation statistics
 */
interface ConcurrentOperationStats {
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  activeOperations: number;
  averageDuration: number;
  concurrencyUtilization: number;
  batchEfficiency: number;
}

/**
 * Operation batch for coordinated execution
 */
interface OperationBatch {
  id: string;
  operations: Operation[];
  batchType: 'parallel' | 'sequential' | 'mixed';
  priority: 'low' | 'normal' | 'high' | 'critical';
  startTime: number;
}

/**
 * Concurrent operation manager
 */
export class ConcurrentOperationManager {
  private static instance: ConcurrentOperationManager;
  private config: ConcurrentOperationConfig;
  private operationQueue: Operation[] = [];
  private activeOperations: Map<string, OperationProgress> = new Map();
  private operationResults: Map<string, OperationResult> = new Map();
  private operationBatches: Map<string, OperationBatch> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private stats: ConcurrentOperationStats;
  private performanceMonitor: PerformanceMonitor;
  private progressCallbacks: Map<string, (progress: OperationProgress) => void> = new Map();

  constructor(config: Partial<ConcurrentOperationConfig> = {}) {
    this.config = { ...DEFAULT_CONCURRENT_CONFIG, ...config };
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.stats = {
      totalOperations: 0,
      completedOperations: 0,
      failedOperations: 0,
      activeOperations: 0,
      averageDuration: 0,
      concurrencyUtilization: 0,
      batchEfficiency: 0
    };
  }

  static getInstance(config?: Partial<ConcurrentOperationConfig>): ConcurrentOperationManager {
    if (!ConcurrentOperationManager.instance) {
      ConcurrentOperationManager.instance = new ConcurrentOperationManager(config);
    }
    return ConcurrentOperationManager.instance;
  }

  /**
   * Execute multiple operations concurrently with enterprise optimization
   */
  async executeConcurrent<T = any>(
    operations: Operation<T>[],
    options: {
      coordinationStrategy?: 'parallel' | 'sequential' | 'mixed' | 'auto';
      progressCallback?: (progress: OperationProgress[]) => void;
      failureStrategy?: 'fail-fast' | 'continue' | 'retry-failed';
      resourcePriority?: ConcurrentOperationConfig['resourcePriority'];
    } = {}
  ): Promise<OperationResult<T>[]> {
    const {
      coordinationStrategy = 'auto',
      progressCallback,
      failureStrategy = 'continue',
      resourcePriority = this.config.resourcePriority
    } = options;

    console.log(`🚀 Starting concurrent execution of ${operations.length} operations`);

    // Apply resource throttling if enabled
    if (this.config.enableResourceThrottling) {
      await this.applyResourceThrottling(operations.length, resourcePriority);
    }

    // Determine optimal coordination strategy
    const strategy = coordinationStrategy === 'auto' 
      ? this.determineOptimalStrategy(operations)
      : coordinationStrategy;

    // Set up progress tracking
    if (this.config.enableProgressTracking && progressCallback) {
      this.setupProgressTracking(operations, progressCallback);
    }

    try {
      let results: OperationResult<T>[];

      switch (strategy) {
        case 'parallel':
          results = await this.executeParallel(operations, failureStrategy);
          break;
        case 'sequential':
          results = await this.executeSequential(operations, failureStrategy);
          break;
        case 'mixed':
          results = await this.executeMixed(operations, failureStrategy);
          break;
        default:
          results = await this.executeParallel(operations, failureStrategy);
      }

      // Update statistics
      this.updateConcurrencyStats(results);

      console.log(`✅ Concurrent execution completed: ${results.filter(r => r.success).length}/${results.length} successful`);
      return results;

    } catch (error) {
      console.error('❌ Concurrent execution failed:', error);
      throw error;
    } finally {
      // Clean up progress tracking
      operations.forEach(op => {
        this.activeOperations.delete(op.id);
        this.progressCallbacks.delete(op.id);
      });
    }
  }

  /**
   * Queue operation for batch processing
   */
  queueOperation<T = any>(operation: Operation<T>): Promise<OperationResult<T>> {
    return new Promise((resolve, reject) => {
      const enhancedOperation = {
        ...operation,
        resolve,
        reject
      } as Operation<T> & { resolve: Function; reject: Function };

      this.operationQueue.push(enhancedOperation);
      this.stats.totalOperations++;

      // Process queue if batching is enabled
      if (this.config.enableOperationBatching) {
        this.processBatchQueue();
      } else {
        this.processQueue();
      }
    });
  }

  /**
   * Execute operations in parallel
   */
  private async executeParallel<T>(
    operations: Operation<T>[],
    failureStrategy: string
  ): Promise<OperationResult<T>[]> {
    const chunks = this.chunkOperations(operations, this.config.maxParallelRequests);
    const allResults: OperationResult<T>[] = [];

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(op => this.executeOperation(op));
      
      if (failureStrategy === 'fail-fast') {
        const chunkResults = await Promise.all(chunkPromises);
        allResults.push(...chunkResults);
        
        // Check for failures
        const failures = chunkResults.filter(r => !r.success);
        if (failures.length > 0) {
          throw new Error(`Operation failed: ${failures[0].error?.message}`);
        }
      } else {
        const chunkResults = await Promise.allSettled(chunkPromises);
        const processedResults = chunkResults.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            return this.createFailureResult(chunk[index], result.reason);
          }
        });
        allResults.push(...processedResults);
      }
    }

    return allResults;
  }

  /**
   * Execute operations sequentially
   */
  private async executeSequential<T>(
    operations: Operation<T>[],
    failureStrategy: string
  ): Promise<OperationResult<T>[]> {
    const results: OperationResult<T>[] = [];

    for (const operation of operations) {
      try {
        const result = await this.executeOperation(operation);
        results.push(result);

        if (!result.success && failureStrategy === 'fail-fast') {
          throw new Error(`Operation ${operation.id} failed: ${result.error?.message}`);
        }
      } catch (error) {
        const failureResult = this.createFailureResult(operation, error);
        results.push(failureResult);

        if (failureStrategy === 'fail-fast') {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Execute operations with mixed strategy (dependencies-aware)
   */
  private async executeMixed<T>(
    operations: Operation<T>[],
    failureStrategy: string
  ): Promise<OperationResult<T>[]> {
    const dependencyGraph = this.buildDependencyGraph(operations);
    const results: OperationResult<T>[] = [];
    const completed = new Set<string>();

    while (completed.size < operations.length) {
      // Find operations that can run (dependencies satisfied)
      const runnableOps = operations.filter(op => 
        !completed.has(op.id) && 
        this.areDependenciesSatisfied(op, completed)
      );

      if (runnableOps.length === 0) {
        throw new Error('Circular dependency detected or unresolvable dependencies');
      }

      // Execute runnable operations in parallel
      const batchResults = await this.executeParallel(runnableOps, failureStrategy);
      results.push(...batchResults);

      // Mark completed operations
      batchResults.forEach(result => {
        if (result.success) {
          completed.add(result.id);
        }
      });
    }

    return results;
  }

  /**
   * Execute a single operation with monitoring
   */
  private async executeOperation<T>(operation: Operation<T>): Promise<OperationResult<T>> {
    const startTime = performance.now();
    
    // Update progress tracking
    if (this.config.enableProgressTracking) {
      this.updateOperationProgress(operation.id, {
        id: operation.id,
        type: operation.type,
        status: 'running',
        progress: 0,
        startTime: Date.now()
      });
    }

    try {
      // Set timeout for operation
      const timeout = operation.timeout || this.config.operationTimeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout);
      });

      // Execute operation with timeout
      const result = await Promise.race([
        operation.executor(),
        timeoutPromise
      ]);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Record performance metrics
      if (this.config.enableOperationMetrics) {
        this.performanceMonitor.recordMetric(
          `concurrent_op_${operation.type}`,
          duration,
          'concurrent',
          {
            operationId: operation.id,
            priority: operation.priority,
            success: true
          }
        );
      }

      // Update progress to completed
      if (this.config.enableProgressTracking) {
        this.updateOperationProgress(operation.id, {
          id: operation.id,
          type: operation.type,
          status: 'completed',
          progress: 100,
          startTime: Date.now() - duration
        });
      }

      const operationResult: OperationResult<T> = {
        id: operation.id,
        success: true,
        result,
        duration,
        retryCount: 0,
        startTime,
        endTime
      };

      this.operationResults.set(operation.id, operationResult);
      return operationResult;

    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Record error metrics
      if (this.config.enableOperationMetrics) {
        this.performanceMonitor.recordMetric(
          `concurrent_op_${operation.type}_error`,
          duration,
          'concurrent',
          {
            operationId: operation.id,
            priority: operation.priority,
            success: false,
            error: error.message
          }
        );
      }

      // Update progress to failed
      if (this.config.enableProgressTracking) {
        this.updateOperationProgress(operation.id, {
          id: operation.id,
          type: operation.type,
          status: 'failed',
          progress: 0,
          startTime: Date.now() - duration,
          message: error.message
        });
      }

      const operationResult: OperationResult<T> = {
        id: operation.id,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
        retryCount: 0,
        startTime,
        endTime
      };

      this.operationResults.set(operation.id, operationResult);
      return operationResult;
    }
  }

  /**
   * Determine optimal coordination strategy based on operations
   */
  private determineOptimalStrategy(operations: Operation[]): 'parallel' | 'sequential' | 'mixed' {
    // Check for dependencies
    const hasDependencies = operations.some(op => op.dependencies && op.dependencies.length > 0);
    if (hasDependencies) {
      return 'mixed';
    }

    // Check operation types and priorities
    const criticalOps = operations.filter(op => op.priority === 'critical').length;
    const totalOps = operations.length;

    // If many critical operations, use sequential to avoid overwhelming
    if (criticalOps / totalOps > 0.5) {
      return 'sequential';
    }

    // Default to parallel for better performance
    return 'parallel';
  }

  /**
   * Chunk operations for parallel execution
   */
  private chunkOperations<T>(operations: Operation<T>[], chunkSize: number): Operation<T>[][] {
    const chunks: Operation<T>[][] = [];
    for (let i = 0; i < operations.length; i += chunkSize) {
      chunks.push(operations.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Build dependency graph for mixed execution
   */
  private buildDependencyGraph(operations: Operation[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    operations.forEach(op => {
      graph.set(op.id, op.dependencies || []);
    });
    return graph;
  }

  /**
   * Check if operation dependencies are satisfied
   */
  private areDependenciesSatisfied(operation: Operation, completed: Set<string>): boolean {
    if (!operation.dependencies) return true;
    return operation.dependencies.every(dep => completed.has(dep));
  }

  /**
   * Apply resource throttling based on system state
   */
  private async applyResourceThrottling(operationCount: number, priority: string): Promise<void> {
    if (!this.config.adaptiveThrottling) return;

    // Check system resources (simplified implementation)
    const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
    const connectionCount = this.activeOperations.size;

    if (memoryUsage > 50000000 || connectionCount > this.config.maxConcurrentOperations * 0.8) {
      const throttleDelay = this.calculateThrottleDelay(operationCount, priority);
      if (throttleDelay > 0) {
        console.log(`⏳ Applying resource throttling: ${throttleDelay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, throttleDelay));
      }
    }
  }

  /**
   * Calculate throttle delay based on resources and priority
   */
  private calculateThrottleDelay(operationCount: number, priority: string): number {
    const basePriorityDelays = {
      'cpu': 100,
      'memory': 200,
      'network': 50,
      'balanced': 100
    };

    const baseDelay = basePriorityDelays[priority] || 100;
    return Math.min(baseDelay * Math.sqrt(operationCount), 2000);
  }

  /**
   * Set up progress tracking for operations
   */
  private setupProgressTracking(
    operations: Operation[],
    progressCallback: (progress: OperationProgress[]) => void
  ): void {
    // Initialize progress for all operations
    operations.forEach(op => {
      this.updateOperationProgress(op.id, {
        id: op.id,
        type: op.type,
        status: 'pending',
        progress: 0,
        startTime: Date.now()
      });
    });

    // Set up periodic progress updates
    const progressInterval = setInterval(() => {
      const allProgress = Array.from(this.activeOperations.values());
      progressCallback(allProgress);

      // Stop interval when all operations are done
      const pendingOps = allProgress.filter(p => p.status === 'pending' || p.status === 'running');
      if (pendingOps.length === 0) {
        clearInterval(progressInterval);
      }
    }, this.config.progressUpdateInterval);
  }

  /**
   * Update operation progress
   */
  private updateOperationProgress(operationId: string, progress: OperationProgress): void {
    this.activeOperations.set(operationId, progress);
    
    const callback = this.progressCallbacks.get(operationId);
    if (callback) {
      callback(progress);
    }
  }

  /**
   * Create failure result for operation
   */
  private createFailureResult<T>(operation: Operation<T>, error: any): OperationResult<T> {
    return {
      id: operation.id,
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      duration: 0,
      retryCount: 0,
      startTime: Date.now(),
      endTime: Date.now()
    };
  }

  /**
   * Process operation batch queue
   */
  private processBatchQueue(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      const batchOps = this.operationQueue.splice(0, this.config.maxBatchSize);
      if (batchOps.length > 0) {
        this.processBatch(batchOps);
      }
      this.batchTimer = null;
    }, this.config.batchWindow);
  }

  /**
   * Process operation queue
   */
  private processQueue(): void {
    while (this.operationQueue.length > 0 && 
           this.activeOperations.size < this.config.maxConcurrentOperations) {
      const operation = this.operationQueue.shift()!;
      this.executeOperation(operation);
    }
  }

  /**
   * Process a batch of operations
   */
  private async processBatch(operations: (Operation & { resolve: Function; reject: Function })[]): Promise<void> {
    try {
      const results = await this.executeParallel(operations, 'continue');
      
      // Resolve/reject individual operation promises
      results.forEach((result, index) => {
        const operation = operations[index];
        if (result.success) {
          operation.resolve(result);
        } else {
          operation.reject(result.error);
        }
      });
    } catch (error) {
      // Reject all operations in batch
      operations.forEach(op => op.reject(error));
    }
  }

  /**
   * Update concurrency statistics
   */
  private updateConcurrencyStats(results: OperationResult[]): void {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    this.stats.completedOperations += successful.length;
    this.stats.failedOperations += failed.length;

    // Calculate average duration
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const newAverage = totalDuration / results.length;
    
    this.stats.averageDuration = (
      (this.stats.averageDuration * (this.stats.completedOperations - successful.length)) + 
      (newAverage * results.length)
    ) / this.stats.completedOperations;

    // Calculate concurrency utilization
    this.stats.concurrencyUtilization = this.activeOperations.size / this.config.maxConcurrentOperations;
  }

  /**
   * Get concurrent operation statistics
   */
  getStats(): ConcurrentOperationStats {
    return { ...this.stats };
  }

  /**
   * Get active operations
   */
  getActiveOperations(): OperationProgress[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Get operation result
   */
  getOperationResult(operationId: string): OperationResult | null {
    return this.operationResults.get(operationId) || null;
  }

  /**
   * Cancel operation
   */
  cancelOperation(operationId: string): boolean {
    const progress = this.activeOperations.get(operationId);
    if (progress && (progress.status === 'pending' || progress.status === 'running')) {
      this.updateOperationProgress(operationId, {
        ...progress,
        status: 'cancelled'
      });
      return true;
    }
    return false;
  }

  /**
   * Clear completed operations
   */
  clearCompletedOperations(): void {
    const completed = Array.from(this.activeOperations.entries())
      .filter(([_, progress]) => progress.status === 'completed' || progress.status === 'failed');
    
    completed.forEach(([id]) => {
      this.activeOperations.delete(id);
      this.operationResults.delete(id);
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConcurrentOperationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * React hook for concurrent operations
 */
export const useConcurrentOperations = (config?: Partial<ConcurrentOperationConfig>) => {
  const [manager] = useState(() => ConcurrentOperationManager.getInstance(config));
  const [activeOps, setActiveOps] = useState<OperationProgress[]>([]);
  const [stats, setStats] = useState(manager.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveOps(manager.getActiveOperations());
      setStats(manager.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, [manager]);

  const executeConcurrent = useCallback(
    <T = any>(operations: Operation<T>[], options?: Parameters<typeof manager.executeConcurrent>[1]) => {
      return manager.executeConcurrent<T>(operations, options);
    },
    [manager]
  );

  const queueOperation = useCallback(
    <T = any>(operation: Operation<T>) => {
      return manager.queueOperation<T>(operation);
    },
    [manager]
  );

  return {
    executeConcurrent,
    queueOperation,
    activeOperations: activeOps,
    stats,
    cancelOperation: manager.cancelOperation.bind(manager),
    clearCompleted: manager.clearCompletedOperations.bind(manager),
    updateConfig: manager.updateConfig.bind(manager)
  };
};

export default ConcurrentOperationManager;