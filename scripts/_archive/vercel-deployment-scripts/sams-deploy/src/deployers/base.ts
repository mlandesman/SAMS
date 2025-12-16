import { 
  Component, 
  Environment, 
  DeploymentOptions, 
  DeploymentResult, 
  DeploymentStatus,
  ProjectConfig,
  DeployConfig,
  VerificationConfig,
  VerificationResult
} from '../types';
import { logger } from '../utils/logger';
import { executeWithRetry, checkCommandExists } from '../utils/process';
import { DeploymentError } from '../utils/error-handler';
import { VercelMonitor, DeploymentTracker } from '../monitors';
import { DeploymentVerifier } from '../verifiers';
import { getCurrentBranch, getCurrentCommitHash } from '../utils/git';
import { getCurrentVersion } from '../utils/version';
import { DeploymentHistory } from '../rollback/deployment-history';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface DeployerOptions {
  component: Component;
  environment: Environment;
  config: DeployConfig;
  options: DeploymentOptions;
  verificationConfig?: VerificationConfig;
}

export interface VercelDeployOptions {
  env?: Record<string, string>;
  buildCommand?: string;
  outputDirectory?: string;
  prod?: boolean;
  prebuilt?: boolean;
  force?: boolean;
  skipBuild?: boolean;
  token?: string;
}

export abstract class BaseDeployer {
  protected component: Component;
  protected environment: Environment;
  protected config: DeployConfig;
  protected options: DeploymentOptions;
  protected verificationConfig?: VerificationConfig;
  protected status: DeploymentStatus;
  protected projectPath: string;
  protected startTime: Date;

  constructor({ component, environment, config, options, verificationConfig }: DeployerOptions) {
    this.component = component;
    this.environment = environment;
    this.config = config;
    this.options = options;
    this.verificationConfig = verificationConfig;
    this.status = {
      state: 'pending',
      progress: 0,
      message: 'Initializing deployment',
      startTime: new Date()
    };
    this.startTime = new Date();
    
    // Set project path based on component
    // Use process.cwd() if we're in the SAMS directory, otherwise calculate from __dirname
    const cwd = process.cwd();
    const baseDir = cwd.includes('SAMS') ? 
      cwd.substring(0, cwd.lastIndexOf('SAMS') + 4) : 
      path.resolve(__dirname, '../../../../..');
    
    this.projectPath = this.getProjectPath(baseDir);
  }

  /**
   * Build the component before deployment
   */
  abstract build(): Promise<void>;

  /**
   * Deploy the component to the target environment
   */
  abstract deploy(): Promise<DeploymentResult>;

  /**
   * Execute Vercel deployment with common options and error handling
   */
  protected async executeVercelDeploy(
    projectId: string, 
    options: VercelDeployOptions = {}
  ): Promise<string> {
    const args: string[] = [];
    
    // Add project ID
    args.push('--project', projectId);
    
    // Add environment flag for production
    if (options.prod || this.environment === 'production') {
      args.push('--prod');
    }
    
    // Add build command if specified
    if (options.buildCommand) {
      args.push('--build-command', options.buildCommand);
    }
    
    // Add output directory if specified
    if (options.outputDirectory) {
      args.push('--output', options.outputDirectory);
    }
    
    // Add prebuilt flag if specified
    if (options.prebuilt) {
      args.push('--prebuilt');
    }
    
    // Add force flag if specified
    if (options.force || this.options.force) {
      args.push('--force');
    }
    
    // Add skip build flag if specified
    if (options.skipBuild) {
      args.push('--skip-build');
    }
    
    // Add token if available
    const vercelToken = options.token || process.env.VERCEL_TOKEN;
    if (vercelToken) {
      args.push('--token', vercelToken);
    }
    
    // Add environment variables
    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        args.push('--build-env', `${key}=${value}`);
      }
    }
    
    // Add yes flag to skip confirmation
    args.push('--yes');
    
    // Execute deployment
    this.logProgress('Deploying to Vercel...');
    
    try {
      const result = await executeWithRetry('vercel', args, {
        cwd: this.projectPath,
        timeout: this.config.deploymentSettings.deploymentTimeout,
        maxRetries: this.config.deploymentSettings.retryAttempts,
        retryDelay: this.config.deploymentSettings.retryDelay,
        captureOutput: true,
        onStdout: (data) => {
          // Parse Vercel output for deployment URL
          const urlMatch = data.match(/https:\/\/[^\s]+\.vercel\.app/);
          if (urlMatch) {
            this.logProgress(`Deployment URL: ${urlMatch[0]}`);
          }
        }
      });
      
      // Extract deployment URL from output
      const urlMatch = result.stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
      if (!urlMatch) {
        throw new DeploymentError(
          'Failed to extract deployment URL from Vercel output',
          'VERCEL_URL_NOT_FOUND',
          { stdout: result.stdout }
        );
      }
      
      const deploymentUrl = urlMatch[0];
      
      // If monitoring is enabled, track deployment status
      if (this.options.monitor) {
        await this.monitorDeployment(deploymentUrl);
      }
      
      return deploymentUrl;
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }
      
      throw new DeploymentError(
        `Vercel deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VERCEL_DEPLOY_FAILED',
        { error: error instanceof Error ? error.stack : error }
      );
    }
  }

  /**
   * Monitor Vercel deployment status
   */
  protected async monitorDeployment(deploymentUrl: string): Promise<void> {
    const monitor = new VercelMonitor();
    
    try {
      // Extract deployment ID from URL
      const deploymentId = VercelMonitor.extractDeploymentId(deploymentUrl);
      
      this.logProgress('Monitoring deployment progress...');
      
      // Monitor the deployment
      const status = await monitor.monitorDeployment(deploymentId, {
        timeout: this.config.deploymentSettings.deploymentTimeout,
        showProgress: !this.options.quiet
      });
      
      if (status.state !== 'READY') {
        throw new DeploymentError(
          `Deployment failed with state: ${status.state}`,
          'DEPLOYMENT_FAILED',
          { status }
        );
      }
      
      this.logProgress('Deployment verified successfully!');
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }
      
      // If monitoring fails, log warning but don't fail deployment
      logger.warn('Failed to monitor deployment status, but deployment may have succeeded');
      logger.debug(`Monitoring error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check prerequisites before deployment
   */
  protected async checkPrerequisites(): Promise<void> {
    this.logProgress('Checking prerequisites...');
    
    // Check if Vercel CLI is installed
    const hasVercel = await checkCommandExists('vercel');
    if (!hasVercel) {
      throw new DeploymentError(
        'Vercel CLI is not installed',
        'VERCEL_NOT_FOUND'
      );
    }
    
    // Check if project directory exists
    try {
      await fs.access(this.projectPath);
    } catch {
      throw new DeploymentError(
        `Project directory not found: ${this.projectPath}`,
        'PROJECT_DIR_NOT_FOUND',
        { path: this.projectPath }
      );
    }
    
    // Check for Vercel token
    if (!process.env.VERCEL_TOKEN) {
      logger.warn('VERCEL_TOKEN not found in environment. You may be prompted to login.');
    }
    
    // Additional component-specific checks can be added in derived classes
    await this.checkComponentPrerequisites();
  }

  /**
   * Component-specific prerequisite checks (to be overridden)
   */
  protected async checkComponentPrerequisites(): Promise<void> {
    // Override in derived classes for component-specific checks
  }

  /**
   * Log progress message with component and environment context
   */
  protected logProgress(message: string): void {
    const prefix = `[${this.component.toUpperCase()}:${this.environment}]`;
    logger.info(`${prefix} ${message}`);
  }

  /**
   * Update deployment status
   */
  protected updateStatus(state: DeploymentStatus['state'], progress: number, message: string): void {
    this.status = {
      state,
      progress,
      message,
      startTime: this.startTime,
      endTime: state === 'ready' || state === 'error' || state === 'cancelled' ? new Date() : undefined
    };
    
    this.logProgress(`${message} (${progress}%)`);
  }

  /**
   * Get project-specific configuration
   */
  protected getProjectConfig(): ProjectConfig {
    const projectConfig = this.config.projects[this.component as keyof typeof this.config.projects];
    if (!projectConfig) {
      throw new DeploymentError(
        `No configuration found for component: ${this.component}`,
        'CONFIG_MISSING',
        { component: this.component }
      );
    }
    return projectConfig;
  }

  /**
   * Get environment-specific configuration
   */
  protected getEnvironmentConfig() {
    const envConfig = this.config.environments[this.environment];
    if (!envConfig) {
      throw new DeploymentError(
        `No configuration found for environment: ${this.environment}`,
        'ENV_CONFIG_MISSING',
        { environment: this.environment }
      );
    }
    return envConfig;
  }

  /**
   * Get the full project path for the component
   */
  private getProjectPath(baseDir: string): string {
    switch (this.component) {
      case 'desktop':
        return path.join(baseDir, 'frontend', 'sams-ui');
      case 'mobile':
        return path.join(baseDir, 'frontend', 'mobile-app');
      case 'backend':
        return path.join(baseDir, 'backend');
      case 'firebase':
        return baseDir; // Firebase rules are at root
      default:
        throw new DeploymentError(
          `Unknown component: ${this.component}`,
          'UNKNOWN_COMPONENT',
          { component: this.component }
        );
    }
  }

  /**
   * Create a deployment result object
   */
  protected createResult(success: boolean, url?: string, error?: Error): DeploymentResult {
    const duration = Date.now() - this.startTime.getTime();
    
    return {
      success,
      component: this.component,
      environment: this.environment,
      deploymentId: url ? this.extractDeploymentId(url) : undefined,
      url,
      duration,
      error
    };
  }

  /**
   * Extract deployment ID from Vercel URL
   */
  private extractDeploymentId(url: string): string {
    // Extract deployment ID from URL pattern: https://[project]-[deploymentId].vercel.app
    const match = url.match(/https:\/\/[^-]+-([^.]+)\.vercel\.app/);
    return match ? match[1] : url;
  }

  /**
   * Pre-deployment hook (can be overridden)
   */
  protected async preDeployHook(): Promise<void> {
    this.logProgress('Running pre-deployment checks...');
    // Override in derived classes for component-specific pre-deployment tasks
  }

  /**
   * Post-deployment hook (can be overridden)
   */
  protected async postDeployHook(_result: DeploymentResult): Promise<void> {
    this.logProgress('Running post-deployment tasks...');
    // Override in derived classes for component-specific post-deployment tasks
  }

  /**
   * Run post-deployment verification
   */
  protected async runVerification(result: DeploymentResult): Promise<VerificationResult | null> {
    if (!this.verificationConfig || !result.success || !result.url) {
      return null;
    }

    try {
      this.logProgress('Running post-deployment verification...');
      
      const verifier = new DeploymentVerifier({
        component: this.component,
        environment: this.environment,
        baseUrl: result.url,
        deploymentResult: result,
        config: this.verificationConfig,
        timeout: this.config.deploymentSettings.verificationTimeout,
        retries: this.config.deploymentSettings.retryAttempts,
        verbose: this.options.verbose
      });

      const verificationResult = await verifier.verify();
      
      if (verificationResult.success) {
        this.logProgress(`Verification passed: ${verificationResult.checks.filter(c => c.success).length}/${verificationResult.checks.length} checks`);
      } else {
        const failedChecks = verificationResult.checks.filter(c => !c.success);
        this.logProgress(`Verification failed: ${failedChecks.length} checks failed`);
        
        if (this.options.verbose) {
          for (const check of failedChecks) {
            logger.warn(`  - ${check.name}: ${check.message}`);
          }
        }
      }
      
      return verificationResult;
    } catch (error) {
      logger.warn(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Main deployment orchestration method
   */
  async run(): Promise<DeploymentResult> {
    const tracker = new DeploymentTracker();
    const history = new DeploymentHistory();
    
    try {
      // Initialize tracker and history
      await Promise.all([
        tracker.initialize(),
        history.initialize()
      ]);
      
      // Check prerequisites
      this.updateStatus('pending', 10, 'Checking prerequisites');
      await this.checkPrerequisites();
      
      // Run pre-deployment hook
      this.updateStatus('pending', 20, 'Running pre-deployment tasks');
      await this.preDeployHook();
      
      // Build
      this.updateStatus('building', 30, 'Building component');
      await this.build();
      
      // Deploy
      this.updateStatus('deploying', 70, 'Deploying to Vercel');
      const result = await this.deploy();
      
      // Run post-deployment hook
      this.updateStatus('ready', 85, 'Running post-deployment tasks');
      await this.postDeployHook(result);
      
      // Run verification
      this.updateStatus('ready', 95, 'Running post-deployment verification');
      const verificationResult = await this.runVerification(result);
      
      // Complete
      this.updateStatus('ready', 100, 'Deployment completed successfully');
      
      // Record deployment if successful
      if (result.success && !this.options.dryRun) {
        const versionInfo = await getCurrentVersion();
        const gitBranch = await getCurrentBranch();
        const gitCommit = await getCurrentCommitHash();
        
        // Record in legacy tracker
        await tracker.recordDeployment(result, {
          gitCommit,
          gitBranch,
          deployedBy: process.env.USER || versionInfo.deployedBy,
          version: versionInfo.version
        });
        
        // Record in comprehensive deployment history
        await history.recordDeployment(
          {
            component: this.component,
            environment: this.environment,
            deploymentId: result.deploymentId || '',
            url: result.url,
            version: versionInfo.version,
            buildNumber: versionInfo.buildNumber,
            deploymentType: this.determineDeploymentType(),
            triggeredBy: this.getTriggeredBy(),
            deploymentDuration: result.duration,
            verificationStatus: verificationResult?.success ? 'passed' : 'failed'
          },
          {
            success: result.success,
            verificationResults: verificationResult ? {
              healthChecks: verificationResult.checks.some(c => c.type === 'health' && c.success),
              functionalTests: verificationResult.checks.some(c => c.type === 'ui' && c.success),
              performanceTests: verificationResult.checks.some(c => c.type === 'performance' && c.success),
              securityChecks: verificationResult.checks.some(c => c.type === 'security' && c.success)
            } : undefined
          },
          {
            hash: gitCommit,
            branch: gitBranch,
            message: 'Deployment commit',
            author: process.env.USER || 'unknown',
            timestamp: new Date().toISOString()
          }
        );
        
        // Log deployment statistics
        const stats = await tracker.getStatistics(this.component, this.environment, 7);
        logger.info(`Deployment success rate (last 7 days): ${stats.successRate.toFixed(1)}% (${stats.successful}/${stats.total})`);
      }
      
      return result;
      
    } catch (error) {
      this.updateStatus('error', 0, error instanceof Error ? error.message : 'Unknown error');
      
      const deploymentError = error instanceof Error ? error : new Error('Unknown deployment error');
      const result = this.createResult(false, undefined, deploymentError);
      
      // Record failed deployment
      if (!this.options.dryRun) {
        try {
          const versionInfo = await getCurrentVersion();
          const gitBranch = await getCurrentBranch();
          const gitCommit = await getCurrentCommitHash();
          
          // Record in legacy tracker
          await tracker.recordDeployment(result, {
            gitCommit,
            gitBranch,
            deployedBy: process.env.USER || versionInfo.deployedBy,
            version: versionInfo.version
          });
          
          // Record in comprehensive deployment history
          await history.recordDeployment(
            {
              component: this.component,
              environment: this.environment,
              deploymentId: result.deploymentId || '',
              url: result.url,
              version: versionInfo.version,
              buildNumber: versionInfo.buildNumber,
              deploymentType: this.determineDeploymentType(),
              triggeredBy: this.getTriggeredBy(),
              deploymentDuration: result.duration,
              verificationStatus: 'failed'
            },
            {
              success: false,
              error: deploymentError.message,
              rollbackRequired: this.shouldTriggerAutoRollback(deploymentError)
            },
            {
              hash: gitCommit,
              branch: gitBranch,
              message: 'Failed deployment commit',
              author: process.env.USER || 'unknown',
              timestamp: new Date().toISOString()
            }
          );
        } catch (trackingError) {
          logger.debug(`Failed to record deployment failure: ${trackingError}`);
        }
      }
      
      return result;
    }
  }

  /**
   * Determine deployment type based on environment and options
   */
  private determineDeploymentType(): 'release' | 'hotfix' | 'rollback' | 'emergency' {
    if (this.options.force) {
      return 'emergency';
    }
    if (this.environment === 'production') {
      return 'release';
    }
    return 'release'; // Default to release for staging/dev
  }

  /**
   * Determine what triggered this deployment
   */
  private getTriggeredBy(): 'manual' | 'ci' | 'scheduled' | 'webhook' {
    if (process.env.CI) {
      return 'ci';
    }
    if (process.env.GITHUB_ACTIONS || process.env.VERCEL_GIT_COMMIT_SHA) {
      return 'webhook';
    }
    return 'manual';
  }

  /**
   * Determine if auto-rollback should be triggered
   */
  private shouldTriggerAutoRollback(error: Error): boolean {
    // Define conditions that should trigger auto-rollback
    const rollbackTriggers = [
      'VERCEL_DEPLOY_FAILED',
      'VERIFICATION_FAILED',
      'HEALTH_CHECK_FAILED'
    ];
    
    return this.environment === 'production' && 
           rollbackTriggers.some(trigger => error.message.includes(trigger));
  }
}