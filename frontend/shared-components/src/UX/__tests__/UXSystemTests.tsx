/**
 * Comprehensive Test Suite for Enterprise UX Systems
 * FRONTEND-ALIGNMENT-001 - Phase 4.1
 * 
 * Tests all three major UX systems:
 * - Loading State Management
 * - Real-time Feedback Systems  
 * - Progressive Enhancement Features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Loading State Management
import { LoadingStateManager, LoadingStateProvider, useLoadingState } from '../LoadingStateManager';
import { EnterpriseLoadingSpinner, AdaptiveSkeletonLoader } from '../LoadingComponents';

// Feedback Systems
import { FeedbackSystem, FeedbackSystemProvider, useFeedback } from '../FeedbackSystem';
import { FeedbackToast, FeedbackContainer } from '../FeedbackComponents';

// Progressive Enhancement
import { ProgressiveEnhancementManager, ProgressiveEnhancementProvider, useProgressiveEnhancement } from '../ProgressiveEnhancement';
import { FeatureGate, AdaptiveComponent, ProgressiveTable } from '../ProgressiveComponents';

// Mock dependencies
jest.mock('../ErrorHandling/PerformanceErrorMonitor', () => ({
  PerformanceMonitor: {
    getInstance: jest.fn(() => ({
      recordMetric: jest.fn(),
      getCurrentState: jest.fn(() => ({
        averageResponseTime: 500,
        networkLatency: 100,
        errorRate: 0.01
      }))
    }))
  }
}));

jest.mock('../Performance/ConnectionManager', () => ({
  ConnectionManager: {
    getInstance: jest.fn(() => ({
      isOnline: jest.fn(() => true),
      getConnectionQuality: jest.fn(() => 'good'),
      monitorConnection: jest.fn()
    }))
  }
}));

describe('Enterprise UX Systems - Comprehensive Test Suite', () => {
  beforeEach(() => {
    // Reset all managers before each test
    jest.clearAllMocks();
    
    // Mock browser APIs
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      value: {
        effectiveType: '4g',
        saveData: false
      }
    });
  });

  describe('Loading State Management System', () => {
    let loadingManager: LoadingStateManager;

    beforeEach(() => {
      loadingManager = LoadingStateManager.getInstance();
    });

    test('should create and manage loading states', () => {
      const controller = loadingManager.startLoading('test-operation', {
        operationType: 'read',
        complexity: 'medium',
        priority: 'normal'
      });

      expect(controller).toBeDefined();
      expect(controller.getState().state).toBe('loading');
      expect(loadingManager.getActiveLoadings().size).toBe(1);
    });

    test('should predict loading duration based on historical data', async () => {
      // Start several operations to build history
      const controller1 = loadingManager.startLoading('operation-1', {
        operationType: 'read',
        complexity: 'low'
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      controller1.complete();

      const controller2 = loadingManager.startLoading('operation-2', {
        operationType: 'read', 
        complexity: 'low'
      });

      const prediction = controller2.getPredictedDuration();
      expect(prediction.duration).toBeGreaterThan(0);
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    test('should handle loading state transitions correctly', () => {
      const controller = loadingManager.startLoading('transition-test', {
        operationType: 'create',
        complexity: 'high'
      });

      expect(controller.getState().state).toBe('loading');
      
      controller.setOptimistic();
      expect(controller.getState().state).toBe('optimistic');
      
      controller.setSlow();
      expect(controller.getState().state).toBe('slow');
      
      controller.complete();
      expect(controller.getState().state).toBe('complete');
    });

    test('should render loading components correctly', () => {
      const TestComponent = () => (
        <LoadingStateProvider>
          <EnterpriseLoadingSpinner 
            loadingId="test-spinner"
            message="Loading test data"
          />
          <AdaptiveSkeletonLoader 
            loadingId="test-skeleton"
            variant="table"
            lines={5}
          />
        </LoadingStateProvider>
      );

      render(<TestComponent />);
      
      expect(screen.getByText('Loading test data')).toBeInTheDocument();
      expect(screen.getByTestId('enterprise-loading-spinner')).toBeInTheDocument();
      expect(screen.getByTestId('adaptive-skeleton-loader')).toBeInTheDocument();
    });
  });

  describe('Real-time Feedback System', () => {
    let feedbackSystem: FeedbackSystem;

    beforeEach(() => {
      feedbackSystem = FeedbackSystem.getInstance();
    });

    test('should create and display feedback correctly', () => {
      const feedbackId = feedbackSystem.showFeedback('success', 'Operation completed successfully', {
        title: 'Success',
        urgency: 'normal'
      });

      expect(feedbackId).toBeDefined();
      
      const activeFeedback = feedbackSystem.getActiveFeedback();
      expect(activeFeedback).toHaveLength(1);
      expect(activeFeedback[0].message).toBe('Operation completed successfully');
      expect(activeFeedback[0].type).toBe('success');
    });

    test('should handle optimistic feedback with promise resolution', async () => {
      const successPromise = Promise.resolve({ id: 123 });
      
      const resultPromise = feedbackSystem.showOptimisticFeedback(
        'Saving changes...',
        successPromise,
        {
          successMessage: 'Changes saved successfully',
          errorMessage: 'Failed to save changes'
        }
      );

      // Initially should show optimistic feedback
      let activeFeedback = feedbackSystem.getActiveFeedback();
      expect(activeFeedback[0].type).toBe('optimistic');
      expect(activeFeedback[0].message).toBe('Saving changes...');

      // Wait for promise resolution
      await resultPromise;

      // Should now show success feedback
      activeFeedback = feedbackSystem.getActiveFeedback();
      expect(activeFeedback[0].type).toBe('success');
      expect(activeFeedback[0].message).toBe('Changes saved successfully');
    });

    test('should handle optimistic feedback with promise rejection', async () => {
      const failurePromise = Promise.reject(new Error('Network error'));
      
      const resultPromise = feedbackSystem.showOptimisticFeedback(
        'Saving changes...',
        failurePromise,
        {
          successMessage: 'Changes saved successfully',
          errorMessage: 'Failed to save changes'
        }
      );

      try {
        await resultPromise;
      } catch (error) {
        // Expected to fail
      }

      // Should show error feedback
      const activeFeedback = feedbackSystem.getActiveFeedback();
      expect(activeFeedback[0].type).toBe('error');
      expect(activeFeedback[0].message).toBe('Failed to save changes');
    });

    test('should manage progress feedback correctly', () => {
      const progressController = feedbackSystem.showProgressFeedback('Uploading file...', {
        initialProgress: 0,
        estimatedDuration: 5000
      });

      expect(progressController).toBeDefined();
      
      progressController.updateProgress(25, 'Uploading... 25%');
      progressController.updateProgress(50, 'Uploading... 50%');
      progressController.updateProgress(75, 'Uploading... 75%');
      progressController.complete('File uploaded successfully');

      const activeFeedback = feedbackSystem.getActiveFeedback();
      expect(activeFeedback[0].type).toBe('success');
      expect(activeFeedback[0].message).toBe('File uploaded successfully');
    });

    test('should render feedback components correctly', () => {
      const TestComponent = () => {
        const { showFeedback, activeFeedback } = useFeedback();
        
        React.useEffect(() => {
          showFeedback('info', 'Test feedback message', {
            title: 'Test Title',
            actions: [{
              label: 'Action',
              action: 'test-action',
              style: 'primary'
            }]
          });
        }, [showFeedback]);

        return (
          <FeedbackSystemProvider>
            <FeedbackContainer position="top-right" />
          </FeedbackSystemProvider>
        );
      };

      render(<TestComponent />);
      
      waitFor(() => {
        expect(screen.getByText('Test feedback message')).toBeInTheDocument();
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
      });
    });
  });

  describe('Progressive Enhancement System', () => {
    let enhancementManager: ProgressiveEnhancementManager;

    beforeEach(() => {
      enhancementManager = ProgressiveEnhancementManager.getInstance();
    });

    test('should detect device capabilities correctly', async () => {
      const result = await enhancementManager.initialize();
      
      expect(result).toBeDefined();
      expect(result.level).toMatch(/^(baseline|enhanced|premium)$/);
      expect(result.capabilities).toBeDefined();
      expect(result.availableFeatures).toBeInstanceOf(Array);
    });

    test('should determine enhancement level based on capabilities', async () => {
      // Mock low-end device
      Object.defineProperty(navigator, 'deviceMemory', {
        writable: true,
        value: 2
      });
      
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '2g',
          saveData: true
        }
      });

      const result = await enhancementManager.initialize();
      expect(result.level).toBe('baseline');
    });

    test('should check feature availability correctly', async () => {
      await enhancementManager.initialize();
      
      // Basic features should always be available
      expect(enhancementManager.isFeatureAvailable('basic-crud')).toBe(true);
      expect(enhancementManager.isFeatureAvailable('simple-navigation')).toBe(true);
      
      // Advanced features depend on capabilities
      const hasRealTime = enhancementManager.isFeatureAvailable('real-time-updates');
      const hasAnalytics = enhancementManager.isFeatureAvailable('advanced-analytics');
      
      expect(typeof hasRealTime).toBe('boolean');
      expect(typeof hasAnalytics).toBe('boolean');
    });

    test('should adapt to changing conditions', async () => {
      const initialResult = await enhancementManager.initialize();
      const initialLevel = initialResult.level;
      
      // Simulate network degradation
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: 'slow-2g',
          saveData: true
        }
      });
      
      const adaptedResult = await enhancementManager.adaptToConditions();
      
      // Should degrade to baseline on slow connection
      expect(adaptedResult.level).toBe('baseline');
    });

    test('should render progressive components correctly', async () => {
      const TestComponent = () => {
        const { enhancementResult, isFeatureAvailable } = useProgressiveEnhancement();
        
        if (!enhancementResult) {
          return <div>Loading capabilities...</div>;
        }

        return (
          <ProgressiveEnhancementProvider>
            <FeatureGate 
              feature="real-time-updates"
              fallback={<div>Real-time updates not available</div>}
            >
              <div>Real-time updates enabled</div>
            </FeatureGate>
            
            <AdaptiveComponent
              baseline={<div>Basic UI</div>}
              enhanced={<div>Enhanced UI</div>}
              premium={<div>Premium UI</div>}
            />
            
            <ProgressiveTable
              data={[
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' }
              ]}
              columns={[
                { key: 'id', label: 'ID' },
                { key: 'name', label: 'Name' }
              ]}
            />
          </ProgressiveEnhancementProvider>
        );
      };

      render(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByText(/UI/)).toBeInTheDocument();
        expect(screen.getByText('ID')).toBeInTheDocument();
        expect(screen.getByText('Name')).toBeInTheDocument();
      });
    });
  });

  describe('System Integration Tests', () => {
    test('should integrate all UX systems together', async () => {
      const IntegratedComponent = () => {
        const { startLoading } = useLoadingState();
        const { showFeedback, showOptimistic } = useFeedback();
        const { enhancementResult, isFeatureAvailable } = useProgressiveEnhancement();

        const handleComplexOperation = async () => {
          // Start loading state
          const loadingController = startLoading('complex-operation', {
            operationType: 'create',
            complexity: 'high',
            priority: 'normal'
          });

          try {
            // Show optimistic feedback
            const operation = new Promise((resolve) => {
              setTimeout(() => resolve({ success: true }), 1000);
            });

            await showOptimistic('Processing...', operation, {
              successMessage: 'Operation completed successfully'
            });

            loadingController.complete();
          } catch (error) {
            loadingController.error('Operation failed');
            showFeedback('error', 'Something went wrong');
          }
        };

        return (
          <div>
            <button onClick={handleComplexOperation}>
              Start Complex Operation
            </button>
            
            <FeatureGate feature="advanced-analytics">
              <div>Advanced features available</div>
            </FeatureGate>
            
            {enhancementResult && (
              <div data-testid="enhancement-level">
                Level: {enhancementResult.level}
              </div>
            )}
          </div>
        );
      };

      const App = () => (
        <LoadingStateProvider>
          <FeedbackSystemProvider>
            <ProgressiveEnhancementProvider>
              <IntegratedComponent />
            </ProgressiveEnhancementProvider>
          </FeedbackSystemProvider>
        </LoadingStateProvider>
      );

      render(<App />);
      
      const button = screen.getByText('Start Complex Operation');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('enhancement-level')).toBeInTheDocument();
      });
    });

    test('should maintain performance under load', async () => {
      const loadingManager = LoadingStateManager.getInstance();
      const feedbackSystem = FeedbackSystem.getInstance();
      
      const startTime = performance.now();
      
      // Create multiple loading states
      const controllers = [];
      for (let i = 0; i < 50; i++) {
        controllers.push(loadingManager.startLoading(`operation-${i}`, {
          operationType: 'read',
          complexity: 'medium'
        }));
      }
      
      // Create multiple feedback items
      for (let i = 0; i < 20; i++) {
        feedbackSystem.showFeedback('info', `Message ${i}`, {
          urgency: 'normal'
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
      
      // Clean up
      controllers.forEach(controller => controller.complete());
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle offline scenarios gracefully', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      const enhancementManager = ProgressiveEnhancementManager.getInstance();
      await enhancementManager.initialize();
      
      enhancementManager.enableOfflineMode();
      
      const result = enhancementManager.getCurrentStatus();
      expect(result.level).toBe('baseline');
      expect(result.recommendations).toContain('Limited functionality in offline mode');
    });

    test('should handle memory constraints', async () => {
      Object.defineProperty(navigator, 'deviceMemory', {
        writable: true,
        value: 1 // 1GB RAM
      });
      
      const enhancementManager = ProgressiveEnhancementManager.getInstance();
      const result = await enhancementManager.initialize();
      
      expect(result.level).toBe('baseline');
      expect(result.recommendations).toContain('Low memory device - reducing feature complexity');
    });

    test('should handle invalid loading operations', () => {
      const loadingManager = LoadingStateManager.getInstance();
      
      // Test with missing required parameters
      expect(() => {
        loadingManager.startLoading('', {
          operationType: 'read'
        });
      }).not.toThrow(); // Should handle gracefully
    });

    test('should handle feedback system limits', () => {
      const feedbackSystem = FeedbackSystem.getInstance();
      
      // Create more feedback than max concurrent limit
      for (let i = 0; i < 10; i++) {
        feedbackSystem.showFeedback('info', `Message ${i}`);
      }
      
      const stats = feedbackSystem.getStats();
      expect(stats.activeFeedback).toBeLessThanOrEqual(5); // Default max
      expect(stats.queuedFeedback).toBeGreaterThanOrEqual(0);
    });
  });
});