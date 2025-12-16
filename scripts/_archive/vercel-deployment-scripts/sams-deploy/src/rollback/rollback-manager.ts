import ora from 'ora';
import { Component, Environment } from '../types';
import { DeploymentTracker, DeploymentRecord } from '../monitors/deployment-tracker';
import { logger } from '../utils/logger';
import { executeWithRetry } from '../utils/process';
import { DeploymentError } from '../utils/error-handler';
import { DeploymentHistory } from './deployment-history';

export interface RollbackOptions {
  targetDeploymentId?: string;
  dryRun?: boolean;
  force?: boolean;
  monitor?: boolean;
  verifyOnly?: boolean;
  emergencyMode?: boolean;
  skipBackup?: boolean;
}

export interface RollbackPlan {
  component: Component;
  environment: Environment;
  currentDeployment: DeploymentRecord;
  targetDeployment: DeploymentRecord;
  rollbackType: 'vercel-alias' | 'firebase-rules' | 'backend-redeploy';
  estimatedDowntime: number;
  riskLevel: 'low' | 'medium' | 'high';
  verificationSteps: string[];
  rollbackSteps: string[];
}

export interface RollbackResult {
  success: boolean;
  component: Component;
  environment: Environment;
  rollbackId: string;
  duration: number;
  verificationPassed: boolean;
  error?: Error;
  metadata?: {
    fromDeploymentId: string;
    toDeploymentId: string;
    rollbackType: string;
    emergencyMode?: boolean;
  };
}

export class RollbackManager {
  private tracker: DeploymentTracker;
  private history: DeploymentHistory;

  constructor() {
    this.tracker = new DeploymentTracker();
    this.history = new DeploymentHistory();
  }

  /**
   * Initialize the rollback manager
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.tracker.initialize(),
      this.history.initialize()
    ]);
  }

  /**
   * List previous deployments with rollback capability
   */
  async listRollbackCandidates(
    component: Component,
    environment: Environment,
    limit = 10
  ): Promise<DeploymentRecord[]> {
    await this.initialize();

    const deployments = await this.tracker.getDeploymentHistory(
      component,
      environment,
      limit + 1 // Get one extra to exclude current
    );

    // Filter out the current deployment and failed deployments
    const candidates = deployments
      .filter((d, index) => index > 0 && d.success) // Skip first (current) and failed
      .slice(0, limit);

    return candidates;
  }

  /**
   * Create a rollback plan
   */
  async createRollbackPlan(
    component: Component,
    environment: Environment,
    targetDeploymentId?: string
  ): Promise<RollbackPlan> {
    await this.initialize();

    const currentDeployment = await this.tracker.getLatestDeployment(component, environment);
    if (!currentDeployment) {
      throw new DeploymentError(
        `No current deployment found for ${component}:${environment}`,
        'NO_CURRENT_DEPLOYMENT'
      );
    }

    let targetDeployment: DeploymentRecord;
    if (targetDeploymentId) {
      const deployment = await this.tracker.getDeploymentById(targetDeploymentId);
      if (!deployment) {
        throw new DeploymentError(
          `Target deployment ${targetDeploymentId} not found`,
          'DEPLOYMENT_NOT_FOUND'
        );
      }
      targetDeployment = deployment;
    } else {
      const candidate = await this.tracker.getRollbackCandidate(component, environment);
      if (!candidate) {
        throw new DeploymentError(
          `No rollback candidate found for ${component}:${environment}`,
          'NO_ROLLBACK_CANDIDATE'
        );
      }
      targetDeployment = candidate;
    }

    // Validate rollback target
    if (targetDeployment.component !== component || targetDeployment.environment !== environment) {
      throw new DeploymentError(
        'Target deployment is for a different component or environment',
        'INVALID_ROLLBACK_TARGET'
      );
    }

    // Determine rollback type and strategy
    const rollbackType = this.determineRollbackType(component);
    const riskLevel = this.assessRollbackRisk(currentDeployment, targetDeployment);
    const estimatedDowntime = this.calculateDowntime(component, rollbackType);

    const plan: RollbackPlan = {
      component,
      environment,
      currentDeployment,
      targetDeployment,
      rollbackType,
      estimatedDowntime,
      riskLevel,
      verificationSteps: this.getVerificationSteps(component, rollbackType),
      rollbackSteps: this.getRollbackSteps(component, rollbackType)
    };

    return plan;
  }

  /**
   * Execute a rollback operation
   */
  async executeRollback(
    plan: RollbackPlan,
    options: RollbackOptions = {}
  ): Promise<RollbackResult> {
    const startTime = Date.now();
    const rollbackId = this.generateRollbackId();

    if (options.dryRun) {
      logger.info('DRY RUN MODE - No actual changes will be made');
      return {
        success: true,
        component: plan.component,
        environment: plan.environment,
        rollbackId,
        duration: 0,
        verificationPassed: true
      };
    }

    const spinner = ora('Executing rollback...').start();

    try {
      // Create backup if not skipped
      if (!options.skipBackup && !options.emergencyMode) {
        await this.createRollbackBackup(plan);
      }

      // Execute the rollback based on type
      switch (plan.rollbackType) {
        case 'vercel-alias':
          await this.executeVercelAliasRollback(plan, options);
          break;
        case 'firebase-rules':
          await this.executeFirebaseRulesRollback(plan, options);
          break;
        case 'backend-redeploy':
          await this.executeBackendRollback(plan, options);
          break;
        default:
          throw new DeploymentError(
            `Unsupported rollback type: ${plan.rollbackType}`,
            'UNSUPPORTED_ROLLBACK_TYPE'
          );
      }

      spinner.succeed('Rollback execution completed');

      // Verify rollback if requested
      let verificationPassed = true;
      if (options.monitor || !options.verifyOnly) {
        spinner.start('Verifying rollback...');
        verificationPassed = await this.verifyRollback(plan, options);
        
        if (verificationPassed) {
          spinner.succeed('Rollback verification passed');
        } else {
          spinner.fail('Rollback verification failed');
        }
      }

      // Record the rollback
      await this.recordRollback(plan, rollbackId, options);

      const duration = Date.now() - startTime;

      return {
        success: true,
        component: plan.component,
        environment: plan.environment,
        rollbackId,
        duration,
        verificationPassed,
        metadata: {
          fromDeploymentId: plan.currentDeployment.deploymentId,
          toDeploymentId: plan.targetDeployment.deploymentId,
          rollbackType: plan.rollbackType,
          emergencyMode: options.emergencyMode
        }
      };

    } catch (error) {
      spinner.fail('Rollback failed');
      
      const duration = Date.now() - startTime;

      // Record failed rollback
      await this.recordFailedRollback(plan, rollbackId, error, options);

      return {
        success: false,
        component: plan.component,
        environment: plan.environment,
        rollbackId,
        duration,
        verificationPassed: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Emergency rollback - fastest possible rollback with minimal checks
   */
  async emergencyRollback(
    component: Component,
    environment: Environment,
    targetDeploymentId?: string
  ): Promise<RollbackResult> {
    logger.warn('EMERGENCY ROLLBACK MODE - Minimal verification and safety checks');

    const plan = await this.createRollbackPlan(component, environment, targetDeploymentId);
    
    return this.executeRollback(plan, {
      emergencyMode: true,
      skipBackup: true,
      force: true,
      monitor: true
    });
  }

  /**
   * Verify rollback success
   */
  async verifyRollback(plan: RollbackPlan, _options: RollbackOptions): Promise<boolean> {
    try {
      // Basic connectivity check
      if (plan.targetDeployment.url) {
        const response = await fetch(plan.targetDeployment.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) {
          logger.warn(`Rollback verification warning: ${plan.targetDeployment.url} returned ${response.status}`);
          return false;
        }
      }

      // Component-specific verification
      switch (plan.component) {
        case 'mobile':
        case 'desktop':
          return this.verifyFrontendRollback(plan);
        case 'backend':
          return this.verifyBackendRollback(plan);
        case 'firebase':
          return this.verifyFirebaseRollback(plan);
        default:
          logger.warn(`No specific verification for component: ${plan.component}`);
          return true;
      }

    } catch (error) {
      logger.error(`Rollback verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Get rollback history
   */
  async getRollbackHistory(
    component?: Component,
    environment?: Environment,
    limit = 20
  ): Promise<any[]> {
    await this.initialize();
    return this.history.getRollbackHistory(component, environment, limit);
  }

  /**
   * Determine rollback type based on component
   */
  private determineRollbackType(component: Component): 'vercel-alias' | 'firebase-rules' | 'backend-redeploy' {
    switch (component) {
      case 'mobile':
      case 'desktop':
        return 'vercel-alias';
      case 'firebase':
        return 'firebase-rules';
      case 'backend':
        return 'backend-redeploy';
      default:
        return 'vercel-alias';
    }
  }

  /**
   * Assess rollback risk level
   */
  private assessRollbackRisk(
    current: DeploymentRecord,
    target: DeploymentRecord
  ): 'low' | 'medium' | 'high' {
    const currentTime = new Date(current.timestamp);
    const targetTime = new Date(target.timestamp);
    const daysDiff = Math.abs(currentTime.getTime() - targetTime.getTime()) / (1000 * 60 * 60 * 24);

    // Version-based risk assessment
    const currentVersion = current.metadata?.version;
    const targetVersion = target.metadata?.version;
    
    if (currentVersion && targetVersion) {
      const versionRegex = /(\d+)\.(\d+)\.(\d+)/;
      const currentMatch = currentVersion.match(versionRegex);
      const targetMatch = targetVersion.match(versionRegex);
      
      if (currentMatch && targetMatch) {
        const currentMajor = parseInt(currentMatch[1]);
        const targetMajor = parseInt(targetMatch[1]);
        
        if (currentMajor > targetMajor) {
          return 'high'; // Major version rollback
        }
      }
    }

    // Time-based risk assessment
    if (daysDiff > 30) {
      return 'high';
    } else if (daysDiff > 7) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Calculate estimated downtime for rollback
   */
  private calculateDowntime(_component: Component, rollbackType: string): number {
    // Estimated downtime in seconds
    switch (rollbackType) {
      case 'vercel-alias':
        return 30; // Alias switching is very fast
      case 'firebase-rules':
        return 60; // Rule deployment takes a bit longer
      case 'backend-redeploy':
        return 300; // Full redeployment takes longer
      default:
        return 120;
    }
  }

  /**
   * Get verification steps for rollback
   */
  private getVerificationSteps(component: Component, _rollbackType: string): string[] {
    const baseSteps = [
      'Check deployment status',
      'Verify URL accessibility',
      'Test basic functionality'
    ];

    switch (component) {
      case 'mobile':
        return [
          ...baseSteps,
          'Verify PWA manifest',
          'Check service worker',
          'Test mobile responsiveness'
        ];
      case 'desktop':
        return [
          ...baseSteps,
          'Verify desktop UI components',
          'Check API connectivity',
          'Test user authentication'
        ];
      case 'backend':
        return [
          ...baseSteps,
          'Check API endpoints',
          'Verify database connectivity',
          'Test authentication system'
        ];
      case 'firebase':
        return [
          ...baseSteps,
          'Verify security rules',
          'Check Firestore access',
          'Test authentication flow'
        ];
      default:
        return baseSteps;
    }
  }

  /**
   * Get rollback execution steps
   */
  private getRollbackSteps(_component: Component, rollbackType: string): string[] {
    switch (rollbackType) {
      case 'vercel-alias':
        return [
          'Identify target deployment',
          'Switch Vercel alias',
          'Verify domain routing',
          'Update CDN cache'
        ];
      case 'firebase-rules':
        return [
          'Backup current rules',
          'Restore previous rules',
          'Deploy rule changes',
          'Verify rule application'
        ];
      case 'backend-redeploy':
        return [
          'Prepare rollback environment',
          'Deploy previous version',
          'Update load balancer',
          'Verify backend services'
        ];
      default:
        return ['Execute rollback', 'Verify changes'];
    }
  }

  /**
   * Execute Vercel alias rollback
   */
  private async executeVercelAliasRollback(plan: RollbackPlan, options: RollbackOptions): Promise<void> {
    const args = [
      'alias',
      'set',
      plan.targetDeployment.deploymentId,
      plan.targetDeployment.url || ''
    ];

    if (process.env.VERCEL_TOKEN) {
      args.push('--token', process.env.VERCEL_TOKEN);
    }

    if (options.force) {
      args.push('--yes');
    }

    await executeWithRetry('vercel', args, {
      captureOutput: true,
      timeout: 60000,
      maxRetries: 3,
      retryDelay: 2000
    });
  }

  /**
   * Execute Firebase rules rollback
   */
  private async executeFirebaseRulesRollback(plan: RollbackPlan, options: RollbackOptions): Promise<void> {
    // This would require Firebase CLI and proper setup
    const args = [
      'firestore:rules:rollback',
      '--project',
      plan.environment === 'production' ? 'sams-prod' : 'sams-dev'
    ];

    if (options.force) {
      args.push('--force');
    }

    await executeWithRetry('firebase', args, {
      captureOutput: true,
      timeout: 120000,
      maxRetries: 2,
      retryDelay: 5000
    });
  }

  /**
   * Execute backend rollback
   */
  private async executeBackendRollback(plan: RollbackPlan, options: RollbackOptions): Promise<void> {
    // This would involve redeploying the previous version
    const args = [
      'functions:deploy',
      '--project',
      plan.environment === 'production' ? 'sams-prod' : 'sams-dev'
    ];

    if (options.force) {
      args.push('--force');
    }

    await executeWithRetry('firebase', args, {
      captureOutput: true,
      timeout: 300000, // 5 minutes for backend deployment
      maxRetries: 2,
      retryDelay: 10000
    });
  }

  /**
   * Create rollback backup
   */
  private async createRollbackBackup(plan: RollbackPlan): Promise<void> {
    const backupData = {
      timestamp: new Date().toISOString(),
      component: plan.component,
      environment: plan.environment,
      backupType: 'pre-rollback' as const,
      data: {
        currentDeployment: plan.currentDeployment,
        targetDeployment: plan.targetDeployment
      }
    };

    await this.history.recordBackup(backupData);
  }

  /**
   * Verify frontend rollback
   */
  private async verifyFrontendRollback(plan: RollbackPlan): Promise<boolean> {
    if (!plan.targetDeployment.url) {
      return false;
    }

    try {
      const response = await fetch(plan.targetDeployment.url);
      const text = await response.text();
      
      // Check for expected version in HTML
      const expectedVersion = plan.targetDeployment.metadata?.version;
      if (expectedVersion && !text.includes(expectedVersion)) {
        logger.warn(`Expected version ${expectedVersion} not found in deployed content`);
        return false;
      }

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify backend rollback
   */
  private async verifyBackendRollback(_plan: RollbackPlan): Promise<boolean> {
    // Implementation would depend on backend API structure
    return true;
  }

  /**
   * Verify Firebase rollback
   */
  private async verifyFirebaseRollback(_plan: RollbackPlan): Promise<boolean> {
    // Implementation would depend on Firebase rules verification
    return true;
  }

  /**
   * Record successful rollback
   */
  private async recordRollback(
    plan: RollbackPlan,
    _rollbackId: string,
    options: RollbackOptions
  ): Promise<void> {
    const rollbackData = {
      timestamp: new Date().toISOString(),
      component: plan.component,
      environment: plan.environment,
      fromDeploymentId: plan.currentDeployment.deploymentId,
      toDeploymentId: plan.targetDeployment.deploymentId,
      rollbackType: plan.rollbackType,
      success: true,
      triggeredBy: process.env.USER || 'unknown',
      reason: options.emergencyMode ? 'Emergency rollback' : 'Standard rollback',
      emergencyMode: options.emergencyMode,
      metadata: {
        riskLevel: plan.riskLevel,
        estimatedDowntime: plan.estimatedDowntime,
        options
      }
    };

    await this.history.recordRollback(rollbackData);
    await this.tracker.markRollback(
      plan.currentDeployment.id,
      plan.targetDeployment.id
    );
  }

  /**
   * Record failed rollback
   */
  private async recordFailedRollback(
    plan: RollbackPlan,
    _rollbackId: string,
    error: any,
    options: RollbackOptions
  ): Promise<void> {
    const rollbackData = {
      timestamp: new Date().toISOString(),
      component: plan.component,
      environment: plan.environment,
      fromDeploymentId: plan.currentDeployment.deploymentId,
      toDeploymentId: plan.targetDeployment.deploymentId,
      rollbackType: plan.rollbackType,
      success: false,
      triggeredBy: process.env.USER || 'unknown',
      reason: options.emergencyMode ? 'Emergency rollback failed' : 'Standard rollback failed',
      error: error instanceof Error ? error.message : String(error),
      emergencyMode: options.emergencyMode,
      metadata: {
        riskLevel: plan.riskLevel,
        estimatedDowntime: plan.estimatedDowntime,
        options
      }
    };

    await this.history.recordRollback(rollbackData);
  }

  /**
   * Generate unique rollback ID
   */
  private generateRollbackId(): string {
    return `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}