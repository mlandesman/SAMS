/**
 * Intelligent Loading State Manager for Enterprise Backend Integration
 * FRONTEND-ALIGNMENT-001 - Phase 3.1
 * 
 * Provides sophisticated loading state management that adapts to enterprise
 * backend performance characteristics and user context
 */

import React, { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import { PerformanceMonitor } from '../ErrorHandling/PerformanceErrorMonitor';

/**
 * Loading state configuration
 */
interface LoadingStateConfig {
  // Timing thresholds
  instantThreshold: number;          // < 200ms = instant
  fastThreshold: number;             // < 1s = fast
  slowThreshold: number;             // > 3s = slow
  
  // UI behavior
  enableSkeletonLoading: boolean;
  enableProgressBars: boolean;
  enableIntelligentDelays: boolean;
  enableContextualMessages: boolean;
  
  // Enterprise integration
  enableBackendAwareness: boolean;
  enableLoadPrediction: boolean;
  enableAdaptiveTimeouts: boolean;
  
  // User experience
  enableOptimisticUpdates: boolean;
  enablePreloadingHints: boolean;
  minimumLoadingTime: number;        // Prevent flashing
}

/**
 * Default loading state configuration
 */
const DEFAULT_LOADING_CONFIG: LoadingStateConfig = {
  instantThreshold: 200,
  fastThreshold: 1000,
  slowThreshold: 3000,
  
  enableSkeletonLoading: true,
  enableProgressBars: true,
  enableIntelligentDelays: true,
  enableContextualMessages: true,
  
  enableBackendAwareness: true,
  enableLoadPrediction: true,
  enableAdaptiveTimeouts: true,
  
  enableOptimisticUpdates: true,
  enablePreloadingHints: true,
  minimumLoadingTime: 300           // Prevent flashing for 300ms
};

/**
 * Loading state types
 */
type LoadingState = 
  | 'idle'
  | 'pending'
  | 'loading'
  | 'slow'
  | 'error'
  | 'success'
  | 'optimistic';

/**
 * Loading context information
 */
interface LoadingContext {
  operationType: 'read' | 'write' | 'upload' | 'download' | 'batch';
  dataSize?: number;
  complexity?: 'simple' | 'medium' | 'complex';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  userContext?: {
    isFirstTime?: boolean;
    hasSlowConnection?: boolean;
    prefersSkeleton?: boolean;
  };
}

/**
 * Loading state information
 */
interface LoadingStateInfo {
  state: LoadingState;
  progress?: number;
  estimatedDuration?: number;
  actualDuration?: number;
  message?: string;
  context?: LoadingContext;
  startTime: number;
  canCancel?: boolean;
  showSkeleton?: boolean;
  showProgress?: boolean;
}

/**
 * Loading prediction data
 */
interface LoadingPrediction {
  operationKey: string;
  historicalDurations: number[];
  averageDuration: number;
  confidence: number;
  lastUpdated: number;
}

/**
 * Loading state manager
 */
export class LoadingStateManager {
  private static instance: LoadingStateManager;
  private config: LoadingStateConfig;
  private activeLoadings: Map<string, LoadingStateInfo> = new Map();
  private loadingPredictions: Map<string, LoadingPrediction> = new Map();
  private performanceMonitor: PerformanceMonitor;
  private stateCallbacks: Map<string, (state: LoadingStateInfo) => void> = new Map();

  constructor(config: Partial<LoadingStateConfig> = {}) {
    this.config = { ...DEFAULT_LOADING_CONFIG, ...config };
    this.performanceMonitor = PerformanceMonitor.getInstance();
  }

  static getInstance(config?: Partial<LoadingStateConfig>): LoadingStateManager {
    if (!LoadingStateManager.instance) {
      LoadingStateManager.instance = new LoadingStateManager(config);
    }
    return LoadingStateManager.instance;
  }

  /**
   * Start intelligent loading state with enterprise backend awareness
   */
  startLoading(
    loadingId: string,
    context: LoadingContext,
    callback?: (state: LoadingStateInfo) => void
  ): LoadingController {
    const startTime = performance.now();
    
    // Predict loading duration based on enterprise backend performance
    const prediction = this.config.enableLoadPrediction 
      ? this.predictLoadingDuration(context)
      : null;

    // Determine UI strategy based on prediction and context
    const uiStrategy = this.determineUIStrategy(context, prediction);

    const loadingInfo: LoadingStateInfo = {
      state: 'pending',
      startTime: Date.now(),
      context,
      estimatedDuration: prediction?.averageDuration,
      showSkeleton: uiStrategy.showSkeleton,
      showProgress: uiStrategy.showProgress,
      canCancel: uiStrategy.canCancel
    };

    this.activeLoadings.set(loadingId, loadingInfo);

    if (callback) {
      this.stateCallbacks.set(loadingId, callback);
    }

    // Set up intelligent loading progression
    const controller = new LoadingController(loadingId, this);
    this.setupIntelligentProgression(loadingId, uiStrategy, controller);

    console.log(`🔄 Started intelligent loading: ${loadingId}`, { 
      context, 
      prediction: prediction?.averageDuration,
      strategy: uiStrategy 
    });

    return controller;
  }

  /**
   * Update loading progress with enterprise backend feedback
   */
  updateProgress(
    loadingId: string,
    progress: number,
    message?: string,
    estimatedRemaining?: number
  ): void {
    const loadingInfo = this.activeLoadings.get(loadingId);
    if (!loadingInfo) return;

    const updatedInfo: LoadingStateInfo = {
      ...loadingInfo,
      progress,
      message,
      state: progress >= 100 ? 'success' : loadingInfo.state,
      estimatedDuration: estimatedRemaining 
        ? (Date.now() - loadingInfo.startTime) + estimatedRemaining
        : loadingInfo.estimatedDuration
    };

    this.activeLoadings.set(loadingId, updatedInfo);
    this.notifyStateChange(loadingId, updatedInfo);
  }

  /**
   * Complete loading with performance recording
   */
  completeLoading(loadingId: string, result?: any): void {
    const loadingInfo = this.activeLoadings.get(loadingId);
    if (!loadingInfo) return;

    const actualDuration = Date.now() - loadingInfo.startTime;
    const wasOptimistic = loadingInfo.state === 'optimistic';

    // Record performance metrics
    if (this.config.enableBackendAwareness && loadingInfo.context) {
      this.recordLoadingPerformance(loadingInfo.context, actualDuration);
    }

    // Update loading prediction data
    if (this.config.enableLoadPrediction && loadingInfo.context) {
      this.updateLoadingPrediction(loadingInfo.context, actualDuration);
    }

    // Ensure minimum loading time to prevent flashing
    const minimumTime = this.config.minimumLoadingTime;
    const remainingTime = minimumTime - actualDuration;

    if (remainingTime > 0 && !wasOptimistic) {
      setTimeout(() => {
        this.finalizeLoading(loadingId, 'success', actualDuration, result);
      }, remainingTime);
    } else {
      this.finalizeLoading(loadingId, 'success', actualDuration, result);
    }
  }

  /**
   * Handle loading error with intelligent fallback
   */
  errorLoading(loadingId: string, error: Error): void {
    const loadingInfo = this.activeLoadings.get(loadingId);
    if (!loadingInfo) return;

    const actualDuration = Date.now() - loadingInfo.startTime;

    // Record error metrics
    if (this.config.enableBackendAwareness) {
      this.performanceMonitor.recordMetric(
        'loading_error',
        actualDuration,
        'ux',
        {
          loadingId,
          operationType: loadingInfo.context?.operationType,
          error: error.message
        }
      );
    }

    this.finalizeLoading(loadingId, 'error', actualDuration, error);
  }

  /**
   * Cancel loading operation
   */
  cancelLoading(loadingId: string): void {
    const loadingInfo = this.activeLoadings.get(loadingId);
    if (!loadingInfo || !loadingInfo.canCancel) return;

    const actualDuration = Date.now() - loadingInfo.startTime;
    console.log(`❌ Loading cancelled: ${loadingId} after ${actualDuration}ms`);

    this.finalizeLoading(loadingId, 'idle', actualDuration);
  }

  /**
   * Set optimistic loading state for immediate UI updates
   */
  setOptimistic(loadingId: string, optimisticData: any): void {
    if (!this.config.enableOptimisticUpdates) return;

    const loadingInfo = this.activeLoadings.get(loadingId);
    if (!loadingInfo) return;

    const updatedInfo: LoadingStateInfo = {
      ...loadingInfo,
      state: 'optimistic',
      progress: 100,
      message: 'Update applied'
    };

    this.activeLoadings.set(loadingId, updatedInfo);
    this.notifyStateChange(loadingId, updatedInfo);

    console.log(`⚡ Optimistic update applied: ${loadingId}`);
  }

  /**
   * Predict loading duration based on historical data
   */
  private predictLoadingDuration(context: LoadingContext): LoadingPrediction | null {
    const operationKey = this.generateOperationKey(context);
    const prediction = this.loadingPredictions.get(operationKey);

    if (!prediction || prediction.historicalDurations.length < 3) {
      return null;
    }

    // Adjust prediction based on current system state
    const performanceState = this.performanceMonitor.getCurrentState();
    let adjustedDuration = prediction.averageDuration;

    // Factor in current performance
    if (performanceState.averageResponseTime > 2000) {
      adjustedDuration *= 1.5; // Slower backend = longer loading
    } else if (performanceState.averageResponseTime < 500) {
      adjustedDuration *= 0.8; // Faster backend = shorter loading
    }

    // Factor in data size
    if (context.dataSize) {
      const sizeMultiplier = Math.max(1, context.dataSize / 1000000); // Per MB
      adjustedDuration *= sizeMultiplier;
    }

    return {
      ...prediction,
      averageDuration: adjustedDuration
    };
  }

  /**
   * Determine optimal UI strategy based on context and prediction
   */
  private determineUIStrategy(
    context: LoadingContext,
    prediction: LoadingPrediction | null
  ): {
    showSkeleton: boolean;
    showProgress: boolean;
    canCancel: boolean;
    useOptimistic: boolean;
  } {
    const estimatedDuration = prediction?.averageDuration || 1000;
    const isSlowOperation = estimatedDuration > this.config.slowThreshold;
    const isComplexOperation = context.complexity === 'complex';
    const isWriteOperation = context.operationType === 'write';

    return {
      showSkeleton: this.config.enableSkeletonLoading && 
                   (isSlowOperation || context.userContext?.prefersSkeleton === true),
      
      showProgress: this.config.enableProgressBars && 
                   (isSlowOperation || isComplexOperation),
      
      canCancel: estimatedDuration > this.config.slowThreshold && 
                context.operationType !== 'write',
      
      useOptimistic: this.config.enableOptimisticUpdates && 
                    isWriteOperation && 
                    !isComplexOperation
    };
  }

  /**
   * Set up intelligent loading progression
   */
  private setupIntelligentProgression(
    loadingId: string,
    uiStrategy: any,
    controller: LoadingController
  ): void {
    const loadingInfo = this.activeLoadings.get(loadingId)!;
    
    // Immediate state (0-200ms)
    setTimeout(() => {
      if (this.activeLoadings.has(loadingId)) {
        this.updateLoadingState(loadingId, 'loading', 'Processing...');
      }
    }, this.config.instantThreshold);

    // Fast threshold (1s)
    setTimeout(() => {
      if (this.activeLoadings.has(loadingId)) {
        const message = this.getContextualMessage(loadingInfo.context!, 'fast');
        this.updateLoadingState(loadingId, 'loading', message);
      }
    }, this.config.fastThreshold);

    // Slow threshold (3s)
    setTimeout(() => {
      if (this.activeLoadings.has(loadingId)) {
        const message = this.getContextualMessage(loadingInfo.context!, 'slow');
        this.updateLoadingState(loadingId, 'slow', message);
        
        // Enable cancellation for slow operations
        const updated = this.activeLoadings.get(loadingId)!;
        updated.canCancel = true;
        this.activeLoadings.set(loadingId, updated);
        this.notifyStateChange(loadingId, updated);
      }
    }, this.config.slowThreshold);
  }

  /**
   * Get contextual loading message
   */
  private getContextualMessage(context: LoadingContext, phase: 'fast' | 'slow'): string {
    if (!this.config.enableContextualMessages) {
      return phase === 'fast' ? 'Loading...' : 'This is taking longer than expected...';
    }

    const messages = {
      read: {
        fast: 'Retrieving data...',
        slow: 'Large dataset loading...'
      },
      write: {
        fast: 'Saving changes...',
        slow: 'Complex operation in progress...'
      },
      upload: {
        fast: 'Uploading file...',
        slow: 'Large file upload in progress...'
      },
      download: {
        fast: 'Downloading...',
        slow: 'Large download in progress...'
      },
      batch: {
        fast: 'Processing batch...',
        slow: 'Large batch operation in progress...'
      }
    };

    return messages[context.operationType]?.[phase] || 'Processing...';
  }

  /**
   * Update loading state
   */
  private updateLoadingState(loadingId: string, state: LoadingState, message?: string): void {
    const loadingInfo = this.activeLoadings.get(loadingId);
    if (!loadingInfo) return;

    const updatedInfo: LoadingStateInfo = {
      ...loadingInfo,
      state,
      message
    };

    this.activeLoadings.set(loadingId, updatedInfo);
    this.notifyStateChange(loadingId, updatedInfo);
  }

  /**
   * Finalize loading operation
   */
  private finalizeLoading(
    loadingId: string,
    finalState: LoadingState,
    actualDuration: number,
    result?: any
  ): void {
    const loadingInfo = this.activeLoadings.get(loadingId);
    if (!loadingInfo) return;

    const finalInfo: LoadingStateInfo = {
      ...loadingInfo,
      state: finalState,
      actualDuration,
      progress: finalState === 'success' ? 100 : undefined
    };

    this.notifyStateChange(loadingId, finalInfo);

    // Clean up
    setTimeout(() => {
      this.activeLoadings.delete(loadingId);
      this.stateCallbacks.delete(loadingId);
    }, 1000); // Keep for 1 second for UI transitions

    console.log(`✅ Loading finalized: ${loadingId}`, { 
      state: finalState, 
      duration: actualDuration 
    });
  }

  /**
   * Notify state change to callbacks
   */
  private notifyStateChange(loadingId: string, state: LoadingStateInfo): void {
    const callback = this.stateCallbacks.get(loadingId);
    if (callback) {
      callback(state);
    }
  }

  /**
   * Record loading performance for backend awareness
   */
  private recordLoadingPerformance(context: LoadingContext, duration: number): void {
    this.performanceMonitor.recordMetric(
      `loading_${context.operationType}`,
      duration,
      'ux',
      {
        operationType: context.operationType,
        complexity: context.complexity,
        dataSize: context.dataSize
      }
    );
  }

  /**
   * Update loading prediction data
   */
  private updateLoadingPrediction(context: LoadingContext, actualDuration: number): void {
    const operationKey = this.generateOperationKey(context);
    const existing = this.loadingPredictions.get(operationKey);

    if (!existing) {
      this.loadingPredictions.set(operationKey, {
        operationKey,
        historicalDurations: [actualDuration],
        averageDuration: actualDuration,
        confidence: 0.1,
        lastUpdated: Date.now()
      });
    } else {
      // Keep last 20 durations
      const durations = [...existing.historicalDurations, actualDuration].slice(-20);
      const average = durations.reduce((a, b) => a + b, 0) / durations.length;
      
      // Calculate confidence based on consistency
      const variance = durations.reduce((acc, d) => acc + Math.pow(d - average, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);
      const confidence = Math.min(0.95, Math.max(0.1, 1 - (stdDev / average)));

      this.loadingPredictions.set(operationKey, {
        operationKey,
        historicalDurations: durations,
        averageDuration: average,
        confidence,
        lastUpdated: Date.now()
      });
    }
  }

  /**
   * Generate operation key for prediction caching
   */
  private generateOperationKey(context: LoadingContext): string {
    return `${context.operationType}_${context.complexity || 'medium'}_${Math.floor((context.dataSize || 0) / 100000)}`;
  }

  /**
   * Get all active loadings
   */
  getActiveLoadings(): Map<string, LoadingStateInfo> {
    return new Map(this.activeLoadings);
  }

  /**
   * Get loading prediction statistics
   */
  getPredictionStats(): { totalPredictions: number; averageConfidence: number } {
    const predictions = Array.from(this.loadingPredictions.values());
    const averageConfidence = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
      : 0;

    return {
      totalPredictions: predictions.length,
      averageConfidence
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LoadingStateConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Loading controller for individual loading operations
 */
export class LoadingController {
  constructor(
    private loadingId: string,
    private manager: LoadingStateManager
  ) {}

  updateProgress(progress: number, message?: string, estimatedRemaining?: number): void {
    this.manager.updateProgress(this.loadingId, progress, message, estimatedRemaining);
  }

  complete(result?: any): void {
    this.manager.completeLoading(this.loadingId, result);
  }

  error(error: Error): void {
    this.manager.errorLoading(this.loadingId, error);
  }

  cancel(): void {
    this.manager.cancelLoading(this.loadingId);
  }

  setOptimistic(data: any): void {
    this.manager.setOptimistic(this.loadingId, data);
  }
}

/**
 * Loading state context for React components
 */
const LoadingStateContext = createContext<LoadingStateManager | null>(null);

/**
 * Loading state provider component
 */
export const LoadingStateProvider: React.FC<{
  children: React.ReactNode;
  config?: Partial<LoadingStateConfig>;
}> = ({ children, config }) => {
  const manager = LoadingStateManager.getInstance(config);
  
  return (
    <LoadingStateContext.Provider value={manager}>
      {children}
    </LoadingStateContext.Provider>
  );
};

/**
 * React hook for intelligent loading states
 */
export const useLoadingState = (config?: Partial<LoadingStateConfig>) => {
  const contextManager = useContext(LoadingStateContext);
  const [manager] = useState(() => contextManager || LoadingStateManager.getInstance(config));
  const [activeLoadings, setActiveLoadings] = useState<Map<string, LoadingStateInfo>>(new Map());

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLoadings(new Map(manager.getActiveLoadings()));
    }, 100); // Update every 100ms for smooth UI

    return () => clearInterval(interval);
  }, [manager]);

  const startLoading = useCallback(
    (loadingId: string, context: LoadingContext) => {
      return manager.startLoading(loadingId, context, (state) => {
        setActiveLoadings(prev => new Map(prev.set(loadingId, state)));
      });
    },
    [manager]
  );

  const getLoadingState = useCallback(
    (loadingId: string): LoadingStateInfo | null => {
      return activeLoadings.get(loadingId) || null;
    },
    [activeLoadings]
  );

  return {
    startLoading,
    getLoadingState,
    activeLoadings: Array.from(activeLoadings.values()),
    predictionStats: manager.getPredictionStats(),
    updateConfig: manager.updateConfig.bind(manager)
  };
};

export default LoadingStateManager;