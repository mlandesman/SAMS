/**
 * Real-time Feedback System for Enterprise Backend Integration
 * FRONTEND-ALIGNMENT-001 - Phase 3.2
 * 
 * Provides intelligent real-time feedback mechanisms that leverage
 * enterprise backend capabilities for immediate user responsiveness
 */

import React, { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import { PerformanceMonitor } from '../ErrorHandling/PerformanceErrorMonitor';
import { ErrorFactory } from '../ErrorHandling/StandardizedError';
import { ERROR_CODES } from '../ErrorHandling';

/**
 * Feedback system configuration
 */
interface FeedbackSystemConfig {
  // Feedback timing
  instantFeedbackThreshold: number;    // < 100ms = instant
  quickFeedbackThreshold: number;      // < 500ms = quick
  delayedFeedbackThreshold: number;    // > 2s = delayed
  
  // Feedback types
  enableVisualFeedback: boolean;
  enableHapticFeedback: boolean;
  enableAudioFeedback: boolean;
  enableToastNotifications: boolean;
  
  // Enterprise integration
  enableBackendFeedback: boolean;
  enableOptimisticFeedback: boolean;
  enableContextualFeedback: boolean;
  enableRollbackSupport: boolean;
  
  // User experience
  feedbackPersistence: number;         // How long feedback shows
  maxConcurrentFeedback: number;       // Max feedback items shown
  enableFeedbackQueuing: boolean;
}

/**
 * Default feedback system configuration
 */
const DEFAULT_FEEDBACK_CONFIG: FeedbackSystemConfig = {
  instantFeedbackThreshold: 100,
  quickFeedbackThreshold: 500,
  delayedFeedbackThreshold: 2000,
  
  enableVisualFeedback: true,
  enableHapticFeedback: true,
  enableAudioFeedback: false,
  enableToastNotifications: true,
  
  enableBackendFeedback: true,
  enableOptimisticFeedback: true,
  enableContextualFeedback: true,
  enableRollbackSupport: true,
  
  feedbackPersistence: 3000,           // 3 seconds
  maxConcurrentFeedback: 5,
  enableFeedbackQueuing: true
};

/**
 * Feedback types
 */
type FeedbackType = 
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'progress'
  | 'optimistic'
  | 'rollback';

/**
 * Feedback urgency levels
 */
type FeedbackUrgency = 'low' | 'normal' | 'high' | 'critical';

/**
 * Feedback context information
 */
interface FeedbackContext {
  operationType?: 'create' | 'read' | 'update' | 'delete' | 'batch';
  entityType?: string;
  userAction?: string;
  expectedDuration?: number;
  canRollback?: boolean;
  relatedEntities?: string[];
}

/**
 * Feedback item definition
 */
interface FeedbackItem {
  id: string;
  type: FeedbackType;
  urgency: FeedbackUrgency;
  message: string;
  title?: string;
  context?: FeedbackContext;
  timestamp: number;
  duration?: number;
  actions?: FeedbackAction[];
  metadata?: Record<string, any>;
  isOptimistic?: boolean;
  rollbackData?: any;
}

/**
 * Feedback action definition
 */
interface FeedbackAction {
  label: string;
  action: string;
  style?: 'primary' | 'secondary' | 'danger';
  handler?: () => void | Promise<void>;
}

/**
 * Feedback display component props
 */
interface FeedbackDisplayProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
  showProgress?: boolean;
  enableAnimations?: boolean;
  className?: string;
}

/**
 * Real-time feedback system manager
 */
export class FeedbackSystem {
  private static instance: FeedbackSystem;
  private config: FeedbackSystemConfig;
  private activeFeedback: Map<string, FeedbackItem> = new Map();
  private feedbackQueue: FeedbackItem[] = [];
  private feedbackCallbacks: Map<string, (feedback: FeedbackItem[]) => void> = new Map();
  private performanceMonitor: PerformanceMonitor;
  private feedbackHistory: FeedbackItem[] = [];

  constructor(config: Partial<FeedbackSystemConfig> = {}) {
    this.config = { ...DEFAULT_FEEDBACK_CONFIG, ...config };
    this.performanceMonitor = PerformanceMonitor.getInstance();
  }

  static getInstance(config?: Partial<FeedbackSystemConfig>): FeedbackSystem {
    if (!FeedbackSystem.instance) {
      FeedbackSystem.instance = new FeedbackSystem(config);
    }
    return FeedbackSystem.instance;
  }

  /**
   * Show immediate feedback with enterprise backend awareness
   */
  showFeedback(
    type: FeedbackType,
    message: string,
    options: {
      title?: string;
      urgency?: FeedbackUrgency;
      duration?: number;
      context?: FeedbackContext;
      actions?: FeedbackAction[];
      enableOptimistic?: boolean;
      rollbackData?: any;
    } = {}
  ): string {
    const {
      title,
      urgency = 'normal',
      duration = this.config.feedbackPersistence,
      context,
      actions = [],
      enableOptimistic = this.config.enableOptimisticFeedback,
      rollbackData
    } = options;

    const feedbackId = this.generateFeedbackId();
    
    const feedback: FeedbackItem = {
      id: feedbackId,
      type,
      urgency,
      message,
      title,
      context,
      timestamp: Date.now(),
      duration,
      actions,
      isOptimistic: enableOptimistic && type === 'success',
      rollbackData
    };

    // Apply enterprise backend feedback strategies
    this.applyEnterpriseStrategy(feedback);

    // Handle feedback based on urgency and current state
    this.processFeedback(feedback);

    console.log(`📢 Feedback shown: ${type} - ${message}`, { feedback });

    return feedbackId;
  }

  /**
   * Show optimistic feedback for immediate user response
   */
  showOptimisticFeedback(
    message: string,
    promise: Promise<any>,
    options: {
      successMessage?: string;
      errorMessage?: string;
      context?: FeedbackContext;
      rollbackHandler?: () => void;
    } = {}
  ): Promise<any> {
    const {
      successMessage = 'Operation completed successfully',
      errorMessage = 'Operation failed',
      context,
      rollbackHandler
    } = options;

    // Show immediate optimistic feedback
    const optimisticId = this.showFeedback('optimistic', message, {
      urgency: 'normal',
      context,
      enableOptimistic: true,
      actions: rollbackHandler ? [{
        label: 'Undo',
        action: 'rollback',
        style: 'secondary',
        handler: rollbackHandler
      }] : []
    });

    // Handle promise resolution
    return promise
      .then((result) => {
        // Replace optimistic feedback with success
        this.updateFeedback(optimisticId, {
          type: 'success',
          message: successMessage,
          isOptimistic: false
        });
        return result;
      })
      .catch((error) => {
        // Replace optimistic feedback with error
        this.updateFeedback(optimisticId, {
          type: 'error',
          message: typeof error === 'string' ? error : errorMessage,
          isOptimistic: false,
          actions: []
        });
        throw error;
      });
  }

  /**
   * Show progress feedback with real-time updates
   */
  showProgressFeedback(
    message: string,
    options: {
      initialProgress?: number;
      context?: FeedbackContext;
      estimatedDuration?: number;
    } = {}
  ): ProgressFeedbackController {
    const {
      initialProgress = 0,
      context,
      estimatedDuration
    } = options;

    const progressId = this.showFeedback('progress', message, {
      urgency: 'normal',
      context: {
        ...context,
        expectedDuration: estimatedDuration
      },
      duration: -1, // Persistent until completed
      metadata: {
        progress: initialProgress,
        estimatedDuration
      }
    });

    return new ProgressFeedbackController(progressId, this);
  }

  /**
   * Show contextual feedback based on user action
   */
  showContextualFeedback(
    userAction: string,
    result: 'success' | 'error' | 'warning',
    details?: any
  ): void {
    if (!this.config.enableContextualFeedback) return;

    const contextualMessages = this.getContextualMessage(userAction, result, details);
    
    this.showFeedback(result, contextualMessages.message, {
      title: contextualMessages.title,
      urgency: result === 'error' ? 'high' : 'normal',
      context: {
        userAction,
        operationType: this.inferOperationType(userAction)
      }
    });
  }

  /**
   * Update existing feedback
   */
  updateFeedback(
    feedbackId: string,
    updates: Partial<FeedbackItem>
  ): void {
    const existing = this.activeFeedback.get(feedbackId);
    if (!existing) return;

    const updated: FeedbackItem = {
      ...existing,
      ...updates,
      timestamp: Date.now()
    };

    this.activeFeedback.set(feedbackId, updated);
    this.notifyCallbacks();
  }

  /**
   * Dismiss feedback
   */
  dismissFeedback(feedbackId: string): void {
    const feedback = this.activeFeedback.get(feedbackId);
    if (feedback) {
      this.activeFeedback.delete(feedbackId);
      this.feedbackHistory.push({ ...feedback, duration: Date.now() - feedback.timestamp });
      this.notifyCallbacks();
      console.log(`📢 Feedback dismissed: ${feedbackId}`);
    }
  }

  /**
   * Dismiss all feedback of a specific type
   */
  dismissFeedbackByType(type: FeedbackType): void {
    const toDelete: string[] = [];
    for (const [id, feedback] of this.activeFeedback.entries()) {
      if (feedback.type === type) {
        toDelete.push(id);
      }
    }
    toDelete.forEach(id => this.dismissFeedback(id));
  }

  /**
   * Trigger haptic feedback if supported
   */
  triggerHaptic(pattern: 'light' | 'medium' | 'heavy' = 'light'): void {
    if (!this.config.enableHapticFeedback || !navigator.vibrate) return;

    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30]
    };

    navigator.vibrate(patterns[pattern]);
  }

  /**
   * Process feedback based on configuration and current state
   */
  private processFeedback(feedback: FeedbackItem): void {
    // Check if we've reached max concurrent feedback
    if (this.activeFeedback.size >= this.config.maxConcurrentFeedback) {
      if (this.config.enableFeedbackQueuing) {
        this.feedbackQueue.push(feedback);
        return;
      } else {
        // Remove oldest feedback
        const oldestId = this.getOldestFeedbackId();
        if (oldestId) {
          this.dismissFeedback(oldestId);
        }
      }
    }

    this.activeFeedback.set(feedback.id, feedback);

    // Set up auto-dismissal
    if (feedback.duration && feedback.duration > 0) {
      setTimeout(() => {
        this.dismissFeedback(feedback.id);
        this.processQueue();
      }, feedback.duration);
    }

    // Trigger haptic feedback for urgent items
    if (feedback.urgency === 'high' || feedback.urgency === 'critical') {
      this.triggerHaptic(feedback.urgency === 'critical' ? 'heavy' : 'medium');
    }

    // Record performance metrics
    this.performanceMonitor.recordMetric(
      `feedback_${feedback.type}`,
      0,
      'ux',
      {
        urgency: feedback.urgency,
        context: feedback.context
      }
    );

    this.notifyCallbacks();
  }

  /**
   * Apply enterprise backend feedback strategies
   */
  private applyEnterpriseStrategy(feedback: FeedbackItem): void {
    if (!this.config.enableBackendFeedback) return;

    // Enhance based on operation type
    if (feedback.context?.operationType) {
      const operationType = feedback.context.operationType;
      
      switch (operationType) {
        case 'create':
          if (feedback.type === 'success') {
            feedback.message = `✅ ${feedback.context.entityType || 'Item'} created successfully`;
          }
          break;
        case 'update':
          if (feedback.type === 'success') {
            feedback.message = `🔄 ${feedback.context.entityType || 'Item'} updated successfully`;
          }
          break;
        case 'delete':
          if (feedback.type === 'success') {
            feedback.message = `🗑️ ${feedback.context.entityType || 'Item'} deleted successfully`;
            feedback.actions = feedback.actions || [];
            if (this.config.enableRollbackSupport && feedback.rollbackData) {
              feedback.actions.push({
                label: 'Undo',
                action: 'rollback',
                style: 'secondary'
              });
            }
          }
          break;
        case 'batch':
          if (feedback.type === 'success') {
            feedback.message = `📦 Batch operation completed successfully`;
          }
          break;
      }
    }

    // Add enterprise context
    if (feedback.context) {
      feedback.metadata = {
        ...feedback.metadata,
        enterpriseContext: true,
        operationTimestamp: Date.now()
      };
    }
  }

  /**
   * Get contextual message based on user action
   */
  private getContextualMessage(
    userAction: string,
    result: 'success' | 'error' | 'warning',
    details?: any
  ): { title?: string; message: string } {
    const actionMessages = {
      'save_transaction': {
        success: { message: 'Transaction saved successfully', title: 'Success' },
        error: { message: 'Failed to save transaction', title: 'Error' },
        warning: { message: 'Transaction saved with warnings', title: 'Warning' }
      },
      'delete_transaction': {
        success: { message: 'Transaction deleted successfully', title: 'Deleted' },
        error: { message: 'Failed to delete transaction', title: 'Error' },
        warning: { message: 'Transaction deletion has warnings', title: 'Warning' }
      },
      'upload_document': {
        success: { message: 'Document uploaded successfully', title: 'Uploaded' },
        error: { message: 'Failed to upload document', title: 'Upload Error' },
        warning: { message: 'Document uploaded with warnings', title: 'Warning' }
      },
      'generate_report': {
        success: { message: 'Report generated successfully', title: 'Report Ready' },
        error: { message: 'Failed to generate report', title: 'Report Error' },
        warning: { message: 'Report generated with warnings', title: 'Warning' }
      }
    };

    return actionMessages[userAction]?.[result] || {
      message: `Action ${userAction} ${result}`,
      title: result.charAt(0).toUpperCase() + result.slice(1)
    };
  }

  /**
   * Infer operation type from user action
   */
  private inferOperationType(userAction: string): FeedbackContext['operationType'] {
    if (userAction.includes('save') || userAction.includes('create')) return 'create';
    if (userAction.includes('update') || userAction.includes('edit')) return 'update';
    if (userAction.includes('delete') || userAction.includes('remove')) return 'delete';
    if (userAction.includes('batch') || userAction.includes('bulk')) return 'batch';
    return 'read';
  }

  /**
   * Process queued feedback
   */
  private processQueue(): void {
    if (this.feedbackQueue.length === 0) return;
    if (this.activeFeedback.size >= this.config.maxConcurrentFeedback) return;

    const feedback = this.feedbackQueue.shift()!;
    this.processFeedback(feedback);
  }

  /**
   * Get oldest feedback ID for cleanup
   */
  private getOldestFeedbackId(): string | null {
    let oldestId: string | null = null;
    let oldestTime = Date.now();

    for (const [id, feedback] of this.activeFeedback.entries()) {
      if (feedback.timestamp < oldestTime) {
        oldestTime = feedback.timestamp;
        oldestId = id;
      }
    }

    return oldestId;
  }

  /**
   * Generate unique feedback ID
   */
  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify all callbacks of feedback changes
   */
  private notifyCallbacks(): void {
    const feedbackArray = Array.from(this.activeFeedback.values())
      .sort((a, b) => b.timestamp - a.timestamp);

    for (const callback of this.feedbackCallbacks.values()) {
      callback(feedbackArray);
    }
  }

  /**
   * Register callback for feedback updates
   */
  registerCallback(id: string, callback: (feedback: FeedbackItem[]) => void): void {
    this.feedbackCallbacks.set(id, callback);
  }

  /**
   * Unregister callback
   */
  unregisterCallback(id: string): void {
    this.feedbackCallbacks.delete(id);
  }

  /**
   * Get current active feedback
   */
  getActiveFeedback(): FeedbackItem[] {
    return Array.from(this.activeFeedback.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get feedback statistics
   */
  getStats(): {
    activeFeedback: number;
    queuedFeedback: number;
    totalFeedbackShown: number;
    averageFeedbackDuration: number;
  } {
    const totalShown = this.feedbackHistory.length + this.activeFeedback.size;
    const averageDuration = this.feedbackHistory.length > 0
      ? this.feedbackHistory.reduce((sum, f) => sum + (f.duration || 0), 0) / this.feedbackHistory.length
      : 0;

    return {
      activeFeedback: this.activeFeedback.size,
      queuedFeedback: this.feedbackQueue.length,
      totalFeedbackShown: totalShown,
      averageFeedbackDuration: averageDuration
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FeedbackSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Progress feedback controller
 */
export class ProgressFeedbackController {
  constructor(
    private feedbackId: string,
    private feedbackSystem: FeedbackSystem
  ) {}

  updateProgress(progress: number, message?: string): void {
    this.feedbackSystem.updateFeedback(this.feedbackId, {
      message: message || `Progress: ${Math.round(progress)}%`,
      metadata: {
        progress: Math.max(0, Math.min(100, progress))
      }
    });
  }

  complete(successMessage?: string): void {
    this.feedbackSystem.updateFeedback(this.feedbackId, {
      type: 'success',
      message: successMessage || 'Operation completed successfully',
      metadata: { progress: 100 },
      duration: 3000
    });
  }

  error(errorMessage: string): void {
    this.feedbackSystem.updateFeedback(this.feedbackId, {
      type: 'error',
      message: errorMessage,
      metadata: { progress: 0 },
      duration: 5000
    });
  }

  dismiss(): void {
    this.feedbackSystem.dismissFeedback(this.feedbackId);
  }
}

/**
 * Feedback system context for React components
 */
const FeedbackSystemContext = createContext<FeedbackSystem | null>(null);

/**
 * Feedback system provider component
 */
export const FeedbackSystemProvider: React.FC<{
  children: React.ReactNode;
  config?: Partial<FeedbackSystemConfig>;
}> = ({ children, config }) => {
  const feedbackSystem = FeedbackSystem.getInstance(config);
  
  return (
    <FeedbackSystemContext.Provider value={feedbackSystem}>
      {children}
    </FeedbackSystemContext.Provider>
  );
};

/**
 * React hook for real-time feedback
 */
export const useFeedback = (config?: Partial<FeedbackSystemConfig>) => {
  const contextSystem = useContext(FeedbackSystemContext);
  const [system] = useState(() => contextSystem || FeedbackSystem.getInstance(config));
  const [activeFeedback, setActiveFeedback] = useState<FeedbackItem[]>([]);
  const callbackId = useRef(`callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const callback = (feedback: FeedbackItem[]) => {
      setActiveFeedback(feedback);
    };

    system.registerCallback(callbackId.current, callback);
    
    return () => {
      system.unregisterCallback(callbackId.current);
    };
  }, [system]);

  const showFeedback = useCallback(
    (type: FeedbackType, message: string, options?: Parameters<typeof system.showFeedback>[2]) => {
      return system.showFeedback(type, message, options);
    },
    [system]
  );

  const showOptimistic = useCallback(
    (message: string, promise: Promise<any>, options?: Parameters<typeof system.showOptimisticFeedback>[2]) => {
      return system.showOptimisticFeedback(message, promise, options);
    },
    [system]
  );

  const showProgress = useCallback(
    (message: string, options?: Parameters<typeof system.showProgressFeedback>[1]) => {
      return system.showProgressFeedback(message, options);
    },
    [system]
  );

  const showContextual = useCallback(
    (userAction: string, result: 'success' | 'error' | 'warning', details?: any) => {
      return system.showContextualFeedback(userAction, result, details);
    },
    [system]
  );

  return {
    showFeedback,
    showOptimistic,
    showProgress,
    showContextual,
    dismissFeedback: system.dismissFeedback.bind(system),
    dismissByType: system.dismissFeedbackByType.bind(system),
    triggerHaptic: system.triggerHaptic.bind(system),
    activeFeedback,
    stats: system.getStats(),
    updateConfig: system.updateConfig.bind(system)
  };
};

export default FeedbackSystem;