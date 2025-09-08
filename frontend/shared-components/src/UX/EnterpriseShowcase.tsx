/**
 * Enterprise Feature Showcase Component
 * FRONTEND-ALIGNMENT-001 - Phase 4.3
 * 
 * Demonstrates all enterprise UX features implemented in the alignment project:
 * - Loading State Management with predictive capabilities
 * - Real-time Feedback Systems with optimistic updates
 * - Progressive Enhancement with device adaptation
 * - Integration validation and performance monitoring
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LoadingStateProvider, useLoadingState } from './LoadingStateManager';
import { FeedbackSystemProvider, useFeedback } from './FeedbackSystem';
import { ProgressiveEnhancementProvider, useProgressiveEnhancement } from './ProgressiveEnhancement';
import { useUXValidation } from './ValidationSystem';

// UI Components
import { EnterpriseLoadingSpinner, AdaptiveSkeletonLoader, SmartLoadingButton } from './LoadingComponents';
import { FeedbackContainer, InlineFeedback, ActionFeedback, StatusIndicator } from './FeedbackComponents';
import { FeatureGate, AdaptiveComponent, ProgressiveTable, ConnectionStatus, CapabilitySummary } from './ProgressiveComponents';
import { UXUtils } from './index';

/**
 * Main Enterprise Showcase Component
 */
const EnterpriseShowcase: React.FC = () => {
  return (
    <LoadingStateProvider>
      <FeedbackSystemProvider>
        <ProgressiveEnhancementProvider>
          <div className="enterprise-showcase min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
              <ShowcaseHeader />
              <ShowcaseContent />
              <FeedbackContainer position="top-right" />
            </div>
          </div>
        </ProgressiveEnhancementProvider>
      </FeedbackSystemProvider>
    </LoadingStateProvider>
  );
};

/**
 * Showcase Header with System Status
 */
const ShowcaseHeader: React.FC = () => {
  const { enhancementResult } = useProgressiveEnhancement();
  const { stats } = useFeedback();
  const [uxStats, setUxStats] = useState(UXUtils.getUXPerformanceSummary());

  useEffect(() => {
    const interval = setInterval(() => {
      setUxStats(UXUtils.getUXPerformanceSummary());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-8">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Enterprise UX Systems Showcase
            </h1>
            <p className="text-gray-600 mt-2">
              FRONTEND-ALIGNMENT-001 - Complete implementation demonstration
            </p>
          </div>
          <div className="text-right">
            <ConnectionStatus className="mb-2" />
            <div className="text-sm text-gray-500">
              Build: {new Date().toISOString().split('T')[0]}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Enhancement Level</h3>
            <div className="text-2xl font-bold text-blue-700">
              {enhancementResult?.level.toUpperCase() || 'DETECTING...'}
            </div>
            <div className="text-sm text-blue-600">
              {enhancementResult?.availableFeatures.length || 0} features available
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-medium text-green-900 mb-2">Loading Performance</h3>
            <div className="text-2xl font-bold text-green-700">
              {uxStats.loadingState.activeOperations}
            </div>
            <div className="text-sm text-green-600">
              Active operations ({Math.round(uxStats.loadingState.predictionAccuracy * 100)}% accuracy)
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="font-medium text-purple-900 mb-2">Feedback System</h3>
            <div className="text-2xl font-bold text-purple-700">
              {stats.activeFeedback}
            </div>
            <div className="text-sm text-purple-600">
              Active feedback items
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <h3 className="font-medium text-orange-900 mb-2">System Health</h3>
            <div className="text-2xl font-bold text-orange-700">
              {uxStats.recommendations.length === 0 ? '100%' : '85%'}
            </div>
            <div className="text-sm text-orange-600">
              System efficiency
            </div>
          </div>
        </div>

        {uxStats.recommendations.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">System Recommendations:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {uxStats.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Main Showcase Content
 */
const ShowcaseContent: React.FC = () => {
  return (
    <div className="space-y-8">
      <LoadingStateDemo />
      <FeedbackSystemDemo />
      <ProgressiveEnhancementDemo />
      <IntegrationDemo />
      <ValidationDemo />
    </div>
  );
};

/**
 * Loading State Management Demo
 */
const LoadingStateDemo: React.FC = () => {
  const { startLoading } = useLoadingState();
  const [demoResults, setDemoResults] = useState<any[]>([]);

  const runLoadingDemo = useCallback(async (complexity: 'low' | 'medium' | 'high') => {
    const controller = startLoading(`demo-${complexity}-${Date.now()}`, {
      operationType: 'read',
      complexity,
      priority: 'normal',
      dataSize: complexity === 'low' ? 1000 : complexity === 'medium' ? 10000 : 100000
    });

    const prediction = controller.getPredictedDuration();
    
    // Simulate operation with realistic timing
    const duration = complexity === 'low' ? 500 : complexity === 'medium' ? 1500 : 3000;
    
    if (duration > 1000) {
      setTimeout(() => controller.setSlow(), 1000);
    }

    setTimeout(() => {
      controller.complete();
      setDemoResults(prev => [...prev, {
        complexity,
        prediction,
        actualDuration: duration,
        timestamp: Date.now()
      }].slice(-5));
    }, duration);

    return controller;
  }, [startLoading]);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Loading State Management Demo
      </h2>
      <p className="text-gray-600 mb-6">
        Intelligent loading states with predictive duration and adaptive UI components.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Interactive Controls</h3>
          <div className="space-y-3">
            <SmartLoadingButton
              onClick={() => runLoadingDemo('low')}
              loadingText="Processing low complexity..."
              className="w-full"
            >
              Start Low Complexity Operation
            </SmartLoadingButton>
            
            <SmartLoadingButton
              onClick={() => runLoadingDemo('medium')}
              loadingText="Processing medium complexity..."
              className="w-full"
              variant="secondary"
            >
              Start Medium Complexity Operation
            </SmartLoadingButton>
            
            <SmartLoadingButton
              onClick={() => runLoadingDemo('high')}
              loadingText="Processing high complexity..."
              className="w-full"
              variant="danger"
            >
              Start High Complexity Operation
            </SmartLoadingButton>
          </div>
          
          <div className="mt-4">
            <AdaptiveSkeletonLoader
              loadingId="demo-skeleton"
              variant="card"
              lines={3}
              className="h-32"
            />
          </div>
        </div>

        <div>
          <h3 className="font-medium text-gray-900 mb-3">Recent Operations</h3>
          <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto">
            {demoResults.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Start some operations to see prediction vs actual results
              </div>
            ) : (
              <div className="space-y-2">
                {demoResults.map((result, index) => (
                  <div key={index} className="bg-white rounded p-3 text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium capitalize">{result.complexity} Complexity</span>
                      <span className="text-gray-500">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-600">
                      Predicted: {result.prediction.duration}ms (confidence: {Math.round(result.prediction.confidence * 100)}%)
                    </div>
                    <div className="text-gray-600">
                      Actual: {result.actualDuration}ms
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Feedback System Demo
 */
const FeedbackSystemDemo: React.FC = () => {
  const { showFeedback, showOptimistic, showProgress } = useFeedback();

  const demoBasicFeedback = (type: 'success' | 'error' | 'warning' | 'info') => {
    const messages = {
      success: 'Operation completed successfully!',
      error: 'Something went wrong, please try again.',
      warning: 'Operation completed with warnings.',
      info: 'Here is some helpful information.'
    };

    showFeedback(type, messages[type], {
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Demo`,
      urgency: type === 'error' ? 'high' : 'normal',
      actions: type === 'error' ? [{
        label: 'Retry',
        action: 'retry',
        style: 'primary'
      }, {
        label: 'Cancel',
        action: 'cancel',
        style: 'secondary'
      }] : []
    });
  };

  const demoOptimisticFeedback = () => {
    const operation = new Promise((resolve, reject) => {
      const success = Math.random() > 0.3; // 70% success rate
      setTimeout(() => {
        if (success) {
          resolve({ id: 123, name: 'Test Item' });
        } else {
          reject(new Error('Simulated network error'));
        }
      }, 2000);
    });

    showOptimistic(
      'Saving your changes...',
      operation,
      {
        successMessage: 'Changes saved successfully!',
        errorMessage: 'Failed to save changes. Please try again.',
        context: {
          operationType: 'update',
          entityType: 'document'
        }
      }
    );
  };

  const demoProgressFeedback = () => {
    const controller = showProgress('Uploading file...', {
      initialProgress: 0,
      estimatedDuration: 3000
    });

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        controller.complete('File uploaded successfully!');
        clearInterval(interval);
      } else {
        controller.updateProgress(progress, `Uploading... ${Math.round(progress)}%`);
      }
    }, 200);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Real-time Feedback System Demo
      </h2>
      <p className="text-gray-600 mb-6">
        Enterprise feedback with optimistic updates, progress tracking, and contextual actions.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Basic Feedback</h3>
          <div className="space-y-2">
            <button
              onClick={() => demoBasicFeedback('success')}
              className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              Show Success
            </button>
            <button
              onClick={() => demoBasicFeedback('error')}
              className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              Show Error
            </button>
            <button
              onClick={() => demoBasicFeedback('warning')}
              className="w-full px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
            >
              Show Warning
            </button>
            <button
              onClick={() => demoBasicFeedback('info')}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Show Info
            </button>
          </div>
        </div>

        <div>
          <h3 className="font-medium text-gray-900 mb-3">Optimistic Updates</h3>
          <button
            onClick={demoOptimisticFeedback}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Demo Optimistic Save
          </button>
          <div className="mt-3 text-sm text-gray-600">
            70% success rate - shows immediate feedback then resolves to actual result.
          </div>
          
          <div className="mt-4">
            <InlineFeedback
              type="info"
              message="Optimistic updates provide immediate user feedback"
              size="small"
            />
          </div>
        </div>

        <div>
          <h3 className="font-medium text-gray-900 mb-3">Progress Tracking</h3>
          <button
            onClick={demoProgressFeedback}
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Demo Progress Upload
          </button>
          <div className="mt-3 text-sm text-gray-600">
            Real-time progress updates with estimated completion time.
          </div>

          <div className="mt-4 space-y-2">
            <StatusIndicator status="loading" message="Processing..." size="small" />
            <StatusIndicator status="success" message="Completed" size="small" />
            <StatusIndicator status="error" message="Failed" size="small" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Progressive Enhancement Demo
 */
const ProgressiveEnhancementDemo: React.FC = () => {
  const { enhancementResult, isFeatureAvailable, adaptToConditions } = useProgressiveEnhancement();

  const sampleData = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    category: ['Electronics', 'Clothing', 'Books', 'Sports'][i % 4],
    price: Math.floor(Math.random() * 1000) + 10,
    status: ['Active', 'Inactive', 'Pending'][i % 3]
  }));

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Progressive Enhancement Demo
      </h2>
      <p className="text-gray-600 mb-6">
        Device-aware UI that adapts based on capabilities and network conditions.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h3 className="font-medium text-gray-900 mb-3">Adaptive Data Table</h3>
          <ProgressiveTable
            data={sampleData}
            columns={[
              { key: 'id', label: 'ID', sortable: true },
              { key: 'name', label: 'Name', sortable: true },
              { key: 'category', label: 'Category' },
              { key: 'price', label: 'Price' },
              { key: 'status', label: 'Status' }
            ]}
            enableVirtualization={true}
            enableInfiniteScroll={true}
            pageSize={20}
          />
        </div>

        <div>
          <CapabilitySummary showDetails={true} />
          
          <div className="mt-4">
            <h4 className="font-medium text-gray-900 mb-3">Feature Gates</h4>
            <div className="space-y-3">
              <FeatureGate 
                feature="real-time-updates"
                fallback={<div className="text-gray-500 text-sm">Real-time updates not available</div>}
              >
                <div className="text-green-600 text-sm">✓ Real-time updates enabled</div>
              </FeatureGate>

              <FeatureGate 
                feature="advanced-analytics"
                fallback={<div className="text-gray-500 text-sm">Advanced analytics not available</div>}
              >
                <div className="text-blue-600 text-sm">✓ Advanced analytics available</div>
              </FeatureGate>

              <FeatureGate 
                feature="live-collaboration"
                fallback={<div className="text-gray-500 text-sm">Live collaboration not available</div>}
              >
                <div className="text-purple-600 text-sm">✓ Live collaboration enabled</div>
              </FeatureGate>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={adaptToConditions}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              Re-evaluate Capabilities
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-medium text-gray-900 mb-3">Adaptive Components</h3>
        <AdaptiveComponent
          baseline={
            <div className="p-4 bg-gray-100 rounded border">
              <h4 className="font-medium">Baseline Experience</h4>
              <p className="text-sm text-gray-600 mt-1">
                Essential functionality for all devices
              </p>
            </div>
          }
          enhanced={
            <div className="p-4 bg-blue-100 rounded border border-blue-200">
              <h4 className="font-medium text-blue-900">Enhanced Experience</h4>
              <p className="text-sm text-blue-700 mt-1">
                Additional features for capable devices
              </p>
              <div className="mt-2 text-xs text-blue-600">
                ✓ Rich interactions ✓ Advanced UI ✓ Background processing
              </div>
            </div>
          }
          premium={
            <div className="p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded border border-purple-200">
              <h4 className="font-medium text-purple-900">Premium Experience</h4>
              <p className="text-sm text-purple-700 mt-1">
                Full-featured experience for high-end devices
              </p>
              <div className="mt-2 text-xs text-purple-600">
                ✓ AI features ✓ Real-time collaboration ✓ Advanced analytics ✓ Premium UI
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
};

/**
 * Integration Demo
 */
const IntegrationDemo: React.FC = () => {
  const { startLoading } = useLoadingState();
  const { showOptimistic } = useFeedback();
  const [isRunning, setIsRunning] = useState(false);

  const runIntegratedDemo = async () => {
    if (isRunning) return;
    setIsRunning(true);

    try {
      // Start loading state
      const loadingController = startLoading('integrated-demo', {
        operationType: 'batch',
        complexity: 'high',
        priority: 'normal',
        dataSize: 50000
      });

      // Create complex operation
      const complexOperation = new Promise((resolve, reject) => {
        const steps = ['Validating data...', 'Processing records...', 'Updating database...', 'Generating report...'];
        let stepIndex = 0;

        const stepInterval = setInterval(() => {
          if (stepIndex < steps.length - 1) {
            stepIndex++;
          } else {
            clearInterval(stepInterval);
            // 80% success rate
            if (Math.random() > 0.2) {
              resolve({ processed: 150, updated: 145, errors: 5 });
            } else {
              reject(new Error('Database connection timeout'));
            }
          }
        }, 800);
      });

      // Show optimistic feedback
      await showOptimistic(
        'Processing batch operation...',
        complexOperation,
        {
          successMessage: 'Batch operation completed successfully',
          errorMessage: 'Batch operation failed - please retry',
          context: {
            operationType: 'batch',
            entityType: 'records'
          }
        }
      );

      loadingController.complete();
    } catch (error) {
      console.error('Demo error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        System Integration Demo
      </h2>
      <p className="text-gray-600 mb-6">
        All UX systems working together for complex enterprise operations.
      </p>

      <div className="text-center">
        <ActionFeedback isLoading={isRunning}>
          <button
            onClick={runIntegratedDemo}
            disabled={isRunning}
            className={`
              px-8 py-4 rounded-lg font-medium text-white transition-colors
              ${isRunning 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
              }
            `}
          >
            {isRunning ? 'Running Integrated Demo...' : 'Run Complete Integration Demo'}
          </button>
        </ActionFeedback>

        <p className="text-sm text-gray-600 mt-4">
          Demonstrates loading states, optimistic feedback, and progressive enhancement working together.
        </p>
      </div>
    </div>
  );
};

/**
 * Validation Demo
 */
const ValidationDemo: React.FC = () => {
  const { runValidation, isRunning, results, summary } = useUXValidation();

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        System Validation
      </h2>
      <p className="text-gray-600 mb-6">
        Comprehensive validation of all UX systems for enterprise readiness.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Validation Results</h3>
            <button
              onClick={runValidation}
              disabled={isRunning}
              className={`
                px-4 py-2 rounded text-sm font-medium transition-colors
                ${isRunning 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }
              `}
            >
              {isRunning ? 'Running...' : 'Run Validation'}
            </button>
          </div>

          {summary.total > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-700">{summary.passed}</div>
                <div className="text-sm text-green-600">Passed</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded">
                <div className="text-2xl font-bold text-red-700">{summary.failed}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded">
                <div className="text-2xl font-bold text-yellow-700">{summary.warnings}</div>
                <div className="text-sm text-yellow-600">Warnings</div>
              </div>
            </div>
          )}

          <div className="text-center py-8">
            {summary.total === 0 ? (
              <div className="text-gray-500">Click "Run Validation" to test all systems</div>
            ) : (
              <div className={`text-2xl font-bold ${summary.isValid ? 'text-green-600' : 'text-red-600'}`}>
                {summary.isValid ? '✅ All Systems Valid' : '❌ Validation Failed'}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-medium text-gray-900 mb-3">Recent Test Results</h3>
          <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto">
            {results.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No validation results yet
              </div>
            ) : (
              <div className="space-y-2">
                {results.slice(-10).map((result, index) => (
                  <div 
                    key={index} 
                    className={`
                      p-2 rounded text-sm border-l-4
                      ${result.status === 'passed' ? 'bg-green-50 border-green-400 text-green-800' :
                        result.status === 'failed' ? 'bg-red-50 border-red-400 text-red-800' :
                        'bg-yellow-50 border-yellow-400 text-yellow-800'}
                    `}
                  >
                    <div className="font-medium">{result.testName}</div>
                    <div className="text-xs opacity-75">
                      {result.message} ({result.duration.toFixed(1)}ms)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseShowcase;