/**
 * User Experience Enhancement Components and Services
 * FRONTEND-ALIGNMENT-001 - Phase 3.1
 * 
 * Enterprise-grade UX components that leverage backend capabilities
 * for intelligent loading states, real-time feedback, and progressive enhancement
 */

// Loading State Management
export {
  LoadingStateManager,
  LoadingController,
  LoadingStateProvider,
  useLoadingState,
  type LoadingStateConfig,
  type LoadingContext,
  type LoadingStateInfo
} from './LoadingStateManager';

// Loading UI Components
export {
  EnterpriseLoadingSpinner,
  AdaptiveSkeletonLoader,
  EnterpriseProgressIndicator,
  EnterpriseLoadingOverlay,
  SmartLoadingButton,
  LoadingStateSummary
} from './LoadingComponents';

// Real-time Feedback System
export {
  FeedbackSystem,
  ProgressFeedbackController,
  FeedbackSystemProvider,
  useFeedback,
  type FeedbackSystemConfig,
  type FeedbackContext,
  type FeedbackItem,
  type FeedbackType
} from './FeedbackSystem';

// Feedback UI Components
export {
  FeedbackToast,
  FeedbackContainer,
  InlineFeedback,
  ActionFeedback,
  ProgressOverlay,
  StatusIndicator,
  FeedbackSummary
} from './FeedbackComponents';

// Progressive Enhancement System
export {
  ProgressiveEnhancementManager,
  ProgressiveEnhancementProvider,
  useProgressiveEnhancement,
  type ProgressiveEnhancementConfig,
  type DeviceCapabilities,
  type EnhancementResult,
  type EnhancementLevel
} from './ProgressiveEnhancement';

// Progressive Enhancement UI Components
export {
  FeatureGate,
  AdaptiveComponent,
  ProgressiveImage,
  ProgressiveForm,
  ProgressiveTable,
  ConnectionStatus,
  CapabilitySummary
} from './ProgressiveComponents';

// Re-export for convenience (removed duplicates)

/**
 * UX enhancement utilities
 */
export const UXUtils = {
  /**
   * Initialize enterprise UX enhancements
   */
  initializeUXEnhancements: (config?: {
    loadingState?: Partial<import('./LoadingStateManager').LoadingStateConfig>;
    feedback?: Partial<import('./FeedbackSystem').FeedbackSystemConfig>;
  }) => {
    const loadingStateManager = LoadingStateManager.getInstance(config?.loadingState);
    const feedbackSystem = FeedbackSystem.getInstance(config?.feedback);
    
    console.log('🎨 Enterprise UX enhancements initialized');
    
    return {
      loadingStateManager,
      feedbackSystem,
      getStats: () => ({
        loadingState: {
          activeLoadings: loadingStateManager.getActiveLoadings().size,
          predictionStats: loadingStateManager.getPredictionStats()
        },
        feedback: feedbackSystem.getStats()
      })
    };
  },

  /**
   * Get UX recommendations based on current state
   */
  getUXRecommendations: () => {
    const loadingStateManager = LoadingStateManager.getInstance();
    const feedbackSystem = FeedbackSystem.getInstance();
    const predictionStats = loadingStateManager.getPredictionStats();
    const activeLoadings = loadingStateManager.getActiveLoadings();
    const feedbackStats = feedbackSystem.getStats();
    
    const recommendations: string[] = [];
    
    // Loading state recommendations
    if (activeLoadings.size > 5) {
      recommendations.push('High number of concurrent operations - consider operation batching');
    }
    
    if (predictionStats.averageConfidence < 0.6) {
      recommendations.push('Low loading prediction confidence - more data needed for better UX');
    }
    
    // Check for slow operations
    const slowOperations = Array.from(activeLoadings.values())
      .filter(loading => loading.state === 'slow').length;
    
    if (slowOperations > 0) {
      recommendations.push(`${slowOperations} slow operations detected - consider showing detailed progress`);
    }
    
    // Feedback system recommendations
    if (feedbackStats.activeFeedback > 3) {
      recommendations.push('High number of active feedback items - consider consolidating messages');
    }
    
    if (feedbackStats.queuedFeedback > 0) {
      recommendations.push('Feedback queue backlog detected - consider increasing max concurrent feedback');
    }
    
    return recommendations;
  },

  /**
   * UX performance summary
   */
  getUXPerformanceSummary: () => {
    const loadingStateManager = LoadingStateManager.getInstance();
    const feedbackSystem = FeedbackSystem.getInstance();
    const predictionStats = loadingStateManager.getPredictionStats();
    const activeLoadings = Array.from(loadingStateManager.getActiveLoadings().values());
    const feedbackStats = feedbackSystem.getStats();
    
    return {
      loadingState: {
        activeOperations: activeLoadings.length,
        slowOperations: activeLoadings.filter(l => l.state === 'slow').length,
        optimisticOperations: activeLoadings.filter(l => l.state === 'optimistic').length,
        predictionAccuracy: predictionStats.averageConfidence
      },
      feedback: {
        activeFeedback: feedbackStats.activeFeedback,
        queuedFeedback: feedbackStats.queuedFeedback,
        totalFeedbackShown: feedbackStats.totalFeedbackShown,
        averageDuration: feedbackStats.averageFeedbackDuration
      },
      recommendations: UXUtils.getUXRecommendations(),
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Version information
 */
export const UX_VERSION = '1.0.0';
export const UX_BUILD_DATE = new Date().toISOString();

// Default export removed to avoid scope issues - use named exports instead