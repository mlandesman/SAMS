/**
 * Integration Validation System for Enterprise UX Components
 * FRONTEND-ALIGNMENT-001 - Phase 4.2
 * 
 * Validates that all UX systems work together correctly and meet
 * enterprise requirements for performance, reliability, and functionality
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LoadingStateManager } from './LoadingStateManager';
import { FeedbackSystem } from './FeedbackSystem';
import { ProgressiveEnhancementManager } from './ProgressiveEnhancement';

/**
 * Validation test result
 */
interface ValidationResult {
  testName: string;
  category: 'loading' | 'feedback' | 'enhancement' | 'integration' | 'performance';
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: any;
  duration: number;
  timestamp: number;
}

/**
 * Validation configuration
 */
interface ValidationConfig {
  enablePerformanceTests: boolean;
  enableIntegrationTests: boolean;
  enableStressTests: boolean;
  performanceThresholds: {
    maxInitializationTime: number;    // ms
    maxOperationTime: number;         // ms
    maxMemoryUsage: number;           // MB
    maxConcurrentOperations: number;
  };
  testTimeout: number;                // ms
}

/**
 * Default validation configuration
 */
const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  enablePerformanceTests: true,
  enableIntegrationTests: true,
  enableStressTests: false,
  performanceThresholds: {
    maxInitializationTime: 500,       // 500ms max init
    maxOperationTime: 100,            // 100ms max operation
    maxMemoryUsage: 50,               // 50MB max usage
    maxConcurrentOperations: 100      // 100 concurrent max
  },
  testTimeout: 5000                   // 5 second timeout
};

/**
 * Enterprise UX Validation System
 */
export class UXValidationSystem {
  private static instance: UXValidationSystem;
  private config: ValidationConfig;
  private loadingManager: LoadingStateManager;
  private feedbackSystem: FeedbackSystem;
  private enhancementManager: ProgressiveEnhancementManager;
  private validationResults: ValidationResult[] = [];
  private isRunning = false;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
    this.loadingManager = LoadingStateManager.getInstance();
    this.feedbackSystem = FeedbackSystem.getInstance();
    this.enhancementManager = ProgressiveEnhancementManager.getInstance();
  }

  static getInstance(config?: Partial<ValidationConfig>): UXValidationSystem {
    if (!UXValidationSystem.instance) {
      UXValidationSystem.instance = new UXValidationSystem(config);
    }
    return UXValidationSystem.instance;
  }

  /**
   * Run comprehensive validation of all UX systems
   */
  async runFullValidation(): Promise<ValidationResult[]> {
    if (this.isRunning) {
      throw new Error('Validation already in progress');
    }

    this.isRunning = true;
    this.validationResults = [];

    console.log('🔍 Starting comprehensive UX validation...');

    try {
      // 1. System Initialization Tests
      await this.runInitializationTests();

      // 2. Individual System Tests
      await this.runLoadingStateTests();
      await this.runFeedbackSystemTests();
      await this.runProgressiveEnhancementTests();

      // 3. Integration Tests
      if (this.config.enableIntegrationTests) {
        await this.runIntegrationTests();
      }

      // 4. Performance Tests
      if (this.config.enablePerformanceTests) {
        await this.runPerformanceTests();
      }

      // 5. Stress Tests
      if (this.config.enableStressTests) {
        await this.runStressTests();
      }

      console.log('✅ UX validation completed', {
        totalTests: this.validationResults.length,
        passed: this.validationResults.filter(r => r.status === 'passed').length,
        failed: this.validationResults.filter(r => r.status === 'failed').length,
        warnings: this.validationResults.filter(r => r.status === 'warning').length
      });

    } catch (error) {
      console.error('❌ Validation failed with error:', error);
      this.addResult({
        testName: 'validation_system_error',
        category: 'integration',
        status: 'failed',
        message: `Validation system error: ${error.message}`,
        details: { error }
      });
    } finally {
      this.isRunning = false;
    }

    return this.validationResults;
  }

  /**
   * Test system initialization
   */
  private async runInitializationTests(): Promise<void> {
    // Test Loading State Manager initialization
    await this.runTest('loading_manager_init', 'loading', async () => {
      const startTime = performance.now();
      const manager = LoadingStateManager.getInstance();
      const duration = performance.now() - startTime;

      if (duration > this.config.performanceThresholds.maxInitializationTime) {
        throw new Error(`Initialization too slow: ${duration}ms`);
      }

      return { duration, initialized: true };
    });

    // Test Feedback System initialization
    await this.runTest('feedback_system_init', 'feedback', async () => {
      const startTime = performance.now();
      const system = FeedbackSystem.getInstance();
      const duration = performance.now() - startTime;

      if (duration > this.config.performanceThresholds.maxInitializationTime) {
        throw new Error(`Initialization too slow: ${duration}ms`);
      }

      return { duration, initialized: true };
    });

    // Test Progressive Enhancement initialization
    await this.runTest('enhancement_manager_init', 'enhancement', async () => {
      const startTime = performance.now();
      const result = await this.enhancementManager.initialize();
      const duration = performance.now() - startTime;

      if (duration > this.config.performanceThresholds.maxInitializationTime) {
        throw new Error(`Initialization too slow: ${duration}ms`);
      }

      if (!result || !result.level) {
        throw new Error('Enhancement manager failed to initialize properly');
      }

      return { duration, result };
    });
  }

  /**
   * Test Loading State Management system
   */
  private async runLoadingStateTests(): Promise<void> {
    // Test basic loading state creation
    await this.runTest('loading_state_creation', 'loading', async () => {
      const controller = this.loadingManager.startLoading('test-operation', {
        operationType: 'read',
        complexity: 'medium',
        priority: 'normal'
      });

      if (!controller) {
        throw new Error('Failed to create loading controller');
      }

      const state = controller.getState();
      if (state.state !== 'loading') {
        throw new Error(`Expected loading state, got: ${state.state}`);
      }

      controller.complete();
      return { controller: true, state: state.state };
    });

    // Test loading state transitions
    await this.runTest('loading_state_transitions', 'loading', async () => {
      const controller = this.loadingManager.startLoading('transition-test', {
        operationType: 'create',
        complexity: 'high'
      });

      const states = [];
      states.push(controller.getState().state);

      controller.setOptimistic();
      states.push(controller.getState().state);

      controller.setSlow();
      states.push(controller.getState().state);

      controller.complete();
      states.push(controller.getState().state);

      const expectedStates = ['loading', 'optimistic', 'slow', 'complete'];
      for (let i = 0; i < expectedStates.length; i++) {
        if (states[i] !== expectedStates[i]) {
          throw new Error(`State transition ${i} failed: expected ${expectedStates[i]}, got ${states[i]}`);
        }
      }

      return { transitions: states };
    });

    // Test prediction system
    await this.runTest('loading_prediction_accuracy', 'loading', async () => {
      const predictions = [];
      
      // Create multiple operations to build prediction data
      for (let i = 0; i < 5; i++) {
        const controller = this.loadingManager.startLoading(`prediction-test-${i}`, {
          operationType: 'read',
          complexity: 'low'
        });
        
        const prediction = controller.getPredictedDuration();
        predictions.push(prediction);
        
        // Simulate operation completion
        setTimeout(() => controller.complete(), 50 + Math.random() * 100);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
      
      if (avgConfidence < 0.1) {
        throw new Error(`Low prediction confidence: ${avgConfidence}`);
      }

      return { predictions, avgConfidence };
    });
  }

  /**
   * Test Feedback System
   */
  private async runFeedbackSystemTests(): Promise<void> {
    // Test basic feedback creation
    await this.runTest('feedback_creation', 'feedback', async () => {
      const feedbackId = this.feedbackSystem.showFeedback('success', 'Test message', {
        title: 'Test',
        urgency: 'normal'
      });

      if (!feedbackId) {
        throw new Error('Failed to create feedback');
      }

      const activeFeedback = this.feedbackSystem.getActiveFeedback();
      if (activeFeedback.length === 0) {
        throw new Error('Feedback not found in active list');
      }

      this.feedbackSystem.dismissFeedback(feedbackId);
      return { feedbackId, created: true };
    });

    // Test optimistic feedback
    await this.runTest('optimistic_feedback', 'feedback', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve({ success: true }), 100));
      
      const result = this.feedbackSystem.showOptimisticFeedback(
        'Processing...',
        promise,
        {
          successMessage: 'Success!',
          errorMessage: 'Failed!'
        }
      );

      await result;

      const activeFeedback = this.feedbackSystem.getActiveFeedback();
      const successFeedback = activeFeedback.find(f => f.message === 'Success!');
      
      if (!successFeedback) {
        throw new Error('Optimistic feedback did not resolve to success');
      }

      return { optimistic: true, resolved: true };
    });

    // Test progress feedback
    await this.runTest('progress_feedback', 'feedback', async () => {
      const controller = this.feedbackSystem.showProgressFeedback('Testing progress...', {
        initialProgress: 0
      });

      if (!controller) {
        throw new Error('Failed to create progress controller');
      }

      controller.updateProgress(25);
      controller.updateProgress(50);
      controller.updateProgress(75);
      controller.complete('Progress complete!');

      return { progress: true, completed: true };
    });
  }

  /**
   * Test Progressive Enhancement system
   */
  private async runProgressiveEnhancementTests(): Promise<void> {
    // Test capability detection
    await this.runTest('capability_detection', 'enhancement', async () => {
      const result = await this.enhancementManager.initialize();
      
      if (!result.capabilities) {
        throw new Error('Capabilities not detected');
      }

      const requiredCapabilities = ['connectionType', 'isOnline', 'serviceWorkerSupported'];
      for (const cap of requiredCapabilities) {
        if (!(cap in result.capabilities)) {
          throw new Error(`Missing capability: ${cap}`);
        }
      }

      return { capabilities: result.capabilities };
    });

    // Test feature availability
    await this.runTest('feature_availability', 'enhancement', async () => {
      const basicFeatures = ['basic-crud', 'simple-navigation'];
      const advancedFeatures = ['real-time-updates', 'advanced-analytics'];

      for (const feature of basicFeatures) {
        const available = this.enhancementManager.isFeatureAvailable(feature);
        if (!available) {
          throw new Error(`Basic feature ${feature} should always be available`);
        }
      }

      const advancedResults = advancedFeatures.map(feature => ({
        feature,
        available: this.enhancementManager.isFeatureAvailable(feature)
      }));

      return { basicFeatures, advancedResults };
    });

    // Test enhancement level determination
    await this.runTest('enhancement_level_logic', 'enhancement', async () => {
      const result = await this.enhancementManager.initialize();
      const level = result.level;

      if (!['baseline', 'enhanced', 'premium'].includes(level)) {
        throw new Error(`Invalid enhancement level: ${level}`);
      }

      // Test feature availability matches level
      const baselineFeatures = ['basic-crud', 'simple-navigation'];
      const enhancedFeatures = ['real-time-updates', 'advanced-filtering'];
      const premiumFeatures = ['live-collaboration', 'advanced-analytics'];

      let expectedFeatures = [...baselineFeatures];
      if (level === 'enhanced' || level === 'premium') {
        expectedFeatures = [...expectedFeatures, ...enhancedFeatures];
      }
      if (level === 'premium') {
        expectedFeatures = [...expectedFeatures, ...premiumFeatures];
      }

      for (const feature of expectedFeatures) {
        const available = this.enhancementManager.isFeatureAvailable(feature);
        if (!available && baselineFeatures.includes(feature)) {
          throw new Error(`Feature ${feature} should be available for level ${level}`);
        }
      }

      return { level, expectedFeatures };
    });
  }

  /**
   * Test system integration
   */
  private async runIntegrationTests(): Promise<void> {
    // Test loading + feedback integration
    await this.runTest('loading_feedback_integration', 'integration', async () => {
      const controller = this.loadingManager.startLoading('integration-test', {
        operationType: 'create',
        complexity: 'medium'
      });

      const feedbackId = this.feedbackSystem.showFeedback('info', 'Operation in progress', {
        context: {
          operationType: 'create',
          entityType: 'transaction'
        }
      });

      controller.complete();
      this.feedbackSystem.dismissFeedback(feedbackId);

      return { integration: true };
    });

    // Test enhancement + loading integration
    await this.runTest('enhancement_loading_integration', 'integration', async () => {
      const enhancementResult = await this.enhancementManager.initialize();
      const level = enhancementResult.level;

      // Create loading based on enhancement level
      const complexity = level === 'premium' ? 'high' : level === 'enhanced' ? 'medium' : 'low';
      
      const controller = this.loadingManager.startLoading('enhancement-aware-loading', {
        operationType: 'read',
        complexity,
        priority: 'normal'
      });

      const state = controller.getState();
      controller.complete();

      return { level, complexity, state: state.state };
    });

    // Test all systems working together
    await this.runTest('full_system_integration', 'integration', async () => {
      // Initialize all systems
      const enhancementResult = await this.enhancementManager.initialize();
      
      // Start complex operation
      const loadingController = this.loadingManager.startLoading('full-integration-test', {
        operationType: 'batch',
        complexity: 'high',
        priority: 'high'
      });

      // Show optimistic feedback
      const operation = new Promise(resolve => setTimeout(() => resolve({ success: true }), 200));
      const feedbackPromise = this.feedbackSystem.showOptimisticFeedback(
        'Processing complex operation...',
        operation,
        {
          successMessage: 'Complex operation completed',
          context: {
            operationType: 'batch',
            entityType: 'multiple'
          }
        }
      );

      // Wait for all to complete
      await feedbackPromise;
      loadingController.complete();

      // Verify final state
      const finalStats = this.feedbackSystem.getStats();
      const loadingStats = this.loadingManager.getActiveLoadings();

      return {
        enhancementLevel: enhancementResult.level,
        feedbackStats: finalStats,
        activeLoadings: loadingStats.size,
        integration: 'complete'
      };
    });
  }

  /**
   * Test system performance
   */
  private async runPerformanceTests(): Promise<void> {
    // Test concurrent operations performance
    await this.runTest('concurrent_operations_performance', 'performance', async () => {
      const startTime = performance.now();
      const operations = [];

      // Create multiple concurrent operations
      for (let i = 0; i < 20; i++) {
        operations.push(this.loadingManager.startLoading(`perf-test-${i}`, {
          operationType: 'read',
          complexity: 'medium'
        }));
      }

      const creationTime = performance.now() - startTime;

      // Complete all operations
      const completionStart = performance.now();
      operations.forEach(op => op.complete());
      const completionTime = performance.now() - completionStart;

      if (creationTime > this.config.performanceThresholds.maxOperationTime * 2) {
        throw new Error(`Operation creation too slow: ${creationTime}ms`);
      }

      return { creationTime, completionTime, operations: operations.length };
    });

    // Test feedback system performance
    await this.runTest('feedback_system_performance', 'performance', async () => {
      const startTime = performance.now();
      const feedbackIds = [];

      // Create multiple feedback items
      for (let i = 0; i < 15; i++) {
        feedbackIds.push(this.feedbackSystem.showFeedback('info', `Performance test ${i}`, {
          urgency: 'normal',
          duration: 1000
        }));
      }

      const creationTime = performance.now() - startTime;

      // Dismiss all feedback
      const dismissStart = performance.now();
      feedbackIds.forEach(id => this.feedbackSystem.dismissFeedback(id));
      const dismissTime = performance.now() - dismissStart;

      if (creationTime > this.config.performanceThresholds.maxOperationTime * 3) {
        throw new Error(`Feedback creation too slow: ${creationTime}ms`);
      }

      return { creationTime, dismissTime, feedbackCount: feedbackIds.length };
    });

    // Test memory usage
    await this.runTest('memory_usage_check', 'performance', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Create and clean up operations to test memory leaks
      for (let cycle = 0; cycle < 5; cycle++) {
        const operations = [];
        const feedbacks = [];

        // Create operations
        for (let i = 0; i < 10; i++) {
          operations.push(this.loadingManager.startLoading(`memory-test-${cycle}-${i}`, {
            operationType: 'read',
            complexity: 'low'
          }));
          
          feedbacks.push(this.feedbackSystem.showFeedback('info', `Memory test ${cycle}-${i}`));
        }

        // Clean up
        operations.forEach(op => op.complete());
        feedbacks.forEach(id => this.feedbackSystem.dismissFeedback(id));

        // Force garbage collection if available
        if ((window as any).gc) {
          (window as any).gc();
        }
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryDiff = (finalMemory - initialMemory) / 1024 / 1024; // MB

      if (memoryDiff > this.config.performanceThresholds.maxMemoryUsage) {
        throw new Error(`Memory usage too high: ${memoryDiff}MB increase`);
      }

      return { initialMemory, finalMemory, diffMB: memoryDiff };
    });
  }

  /**
   * Test system under stress
   */
  private async runStressTests(): Promise<void> {
    // Stress test with maximum concurrent operations
    await this.runTest('max_concurrent_stress', 'performance', async () => {
      const maxOps = this.config.performanceThresholds.maxConcurrentOperations;
      const operations = [];
      const feedbacks = [];

      try {
        // Create maximum operations
        for (let i = 0; i < maxOps; i++) {
          operations.push(this.loadingManager.startLoading(`stress-${i}`, {
            operationType: 'read',
            complexity: 'low'
          }));
          
          if (i % 5 === 0) {
            feedbacks.push(this.feedbackSystem.showFeedback('info', `Stress test ${i}`));
          }
        }

        // Verify system still responsive
        const testController = this.loadingManager.startLoading('responsiveness-test', {
          operationType: 'read',
          complexity: 'low'
        });

        if (!testController) {
          throw new Error('System became unresponsive under stress');
        }

        testController.complete();

        return { maxOperations: maxOps, systemResponsive: true };
      } finally {
        // Clean up
        operations.forEach(op => op.complete());
        feedbacks.forEach(id => this.feedbackSystem.dismissFeedback(id));
      }
    });
  }

  /**
   * Run individual test with error handling and timing
   */
  private async runTest(
    testName: string,
    category: ValidationResult['category'],
    testFn: () => Promise<any>
  ): Promise<ValidationResult> {
    const startTime = performance.now();
    
    try {
      const result = await Promise.race([
        testFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), this.config.testTimeout)
        )
      ]);

      const duration = performance.now() - startTime;
      const validationResult: ValidationResult = {
        testName,
        category,
        status: 'passed',
        message: 'Test passed successfully',
        details: result,
        duration,
        timestamp: Date.now()
      };

      this.addResult(validationResult);
      return validationResult;

    } catch (error) {
      const duration = performance.now() - startTime;
      const validationResult: ValidationResult = {
        testName,
        category,
        status: 'failed',
        message: error.message || 'Test failed',
        details: { error: error.message },
        duration,
        timestamp: Date.now()
      };

      this.addResult(validationResult);
      return validationResult;
    }
  }

  /**
   * Add validation result
   */
  private addResult(result: Omit<ValidationResult, 'duration' | 'timestamp'>): void {
    const fullResult: ValidationResult = {
      ...result,
      duration: result.duration || 0,
      timestamp: result.timestamp || Date.now()
    };

    this.validationResults.push(fullResult);
    
    const icon = fullResult.status === 'passed' ? '✅' : 
                 fullResult.status === 'failed' ? '❌' : '⚠️';
    
    console.log(`${icon} ${fullResult.testName}: ${fullResult.message} (${fullResult.duration.toFixed(1)}ms)`);
  }

  /**
   * Get validation results
   */
  getResults(): ValidationResult[] {
    return [...this.validationResults];
  }

  /**
   * Get validation summary
   */
  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    categories: Record<string, { passed: number; failed: number; warnings: number }>;
    averageDuration: number;
    isValid: boolean;
  } {
    const results = this.validationResults;
    const total = results.length;
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const warnings = results.filter(r => r.status === 'warning').length;

    const categories = results.reduce((acc, result) => {
      if (!acc[result.category]) {
        acc[result.category] = { passed: 0, failed: 0, warnings: 0 };
      }
      acc[result.category][result.status]++;
      return acc;
    }, {} as Record<string, { passed: number; failed: number; warnings: number }>);

    const averageDuration = total > 0 ? 
      results.reduce((sum, r) => sum + r.duration, 0) / total : 0;

    return {
      total,
      passed,
      failed,
      warnings,
      categories,
      averageDuration,
      isValid: failed === 0
    };
  }

  /**
   * Update validation configuration
   */
  updateConfig(newConfig: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * React hook for validation system
 */
export const useUXValidation = (config?: Partial<ValidationConfig>) => {
  const [validator] = useState(() => UXValidationSystem.getInstance(config));
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [summary, setSummary] = useState(validator.getSummary());

  const runValidation = useCallback(async () => {
    setIsRunning(true);
    try {
      const validationResults = await validator.runFullValidation();
      setResults(validationResults);
      setSummary(validator.getSummary());
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

export default UXValidationSystem;