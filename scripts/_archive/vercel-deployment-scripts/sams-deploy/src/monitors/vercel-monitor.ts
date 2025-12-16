import { logger } from '../utils/logger';
import { DeploymentError } from '../utils/error-handler';
import { executeWithRetry } from '../utils/process';
import ora, { Ora } from 'ora';
import chalk from 'chalk';

export interface VercelDeploymentStatus {
  id: string;
  state: 'QUEUED' | 'BUILDING' | 'UPLOADING' | 'DEPLOYING' | 'READY' | 'ERROR' | 'CANCELED';
  readyState: 'QUEUED' | 'BUILDING' | 'UPLOADING' | 'DEPLOYING' | 'READY' | 'ERROR' | 'CANCELED';
  url: string;
  aliasError?: string;
  createdAt: number;
  buildingAt?: number;
  ready?: number;
  error?: {
    message: string;
    code: string;
  };
}

export interface MonitorOptions {
  pollInterval?: number;
  timeout?: number;
  showProgress?: boolean;
  token?: string;
}

export class VercelMonitor {
  private readonly DEFAULT_POLL_INTERVAL = 2000; // 2 seconds
  private readonly DEFAULT_TIMEOUT = 600000; // 10 minutes
  private spinner: Ora | null = null;

  /**
   * Monitor a Vercel deployment by its ID
   */
  async monitorDeployment(
    deploymentId: string,
    options: MonitorOptions = {}
  ): Promise<VercelDeploymentStatus> {
    const {
      pollInterval = this.DEFAULT_POLL_INTERVAL,
      timeout = this.DEFAULT_TIMEOUT,
      showProgress = true,
      token = process.env.VERCEL_TOKEN
    } = options;

    if (!token) {
      throw new DeploymentError(
        'VERCEL_TOKEN is required for monitoring deployments',
        'VERCEL_TOKEN_MISSING'
      );
    }

    const startTime = Date.now();
    let lastState = '';
    let progressPercentage = 0;

    if (showProgress) {
      this.spinner = ora({
        text: 'Initializing deployment monitoring...',
        color: 'blue',
        spinner: 'dots'
      }).start();
    }

    try {
      while (true) {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          throw new DeploymentError(
            `Deployment monitoring timed out after ${timeout / 1000}s`,
            'MONITORING_TIMEOUT',
            { deploymentId, timeout }
          );
        }

        // Get deployment status
        const status = await this.getDeploymentStatus(deploymentId, token);

        // Update progress
        if (status.state !== lastState) {
          lastState = status.state;
          progressPercentage = this.calculateProgress(status.state);
          
          if (showProgress && this.spinner) {
            this.updateSpinner(status, progressPercentage);
          }
        }

        // Check if deployment is complete
        if (this.isDeploymentComplete(status)) {
          if (showProgress && this.spinner) {
            if (status.state === 'READY') {
              this.spinner.succeed(chalk.green(`Deployment ready! URL: ${status.url}`));
            } else if (status.state === 'ERROR') {
              this.spinner.fail(chalk.red(`Deployment failed: ${status.error?.message || 'Unknown error'}`));
            } else if (status.state === 'CANCELED') {
              this.spinner.fail(chalk.yellow('Deployment was canceled'));
            }
          }

          return status;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    } catch (error) {
      if (showProgress && this.spinner) {
        this.spinner.fail(chalk.red('Deployment monitoring failed'));
      }
      throw error;
    }
  }

  /**
   * Get deployment status from Vercel API
   */
  private async getDeploymentStatus(
    deploymentId: string,
    token: string
  ): Promise<VercelDeploymentStatus> {
    const args = [
      'inspect',
      deploymentId,
      '--token', token,
      '--json'
    ];

    try {
      const result = await executeWithRetry('vercel', args, {
        captureOutput: true,
        timeout: 30000, // 30 second timeout for API call
        maxRetries: 3,
        retryDelay: 1000
      });

      const output = result.stdout.trim();
      
      // Parse JSON response
      try {
        const deployment = JSON.parse(output);
        
        return {
          id: deployment.id || deploymentId,
          state: deployment.readyState || deployment.state || 'QUEUED',
          readyState: deployment.readyState || deployment.state || 'QUEUED',
          url: deployment.url || deployment.alias || '',
          aliasError: deployment.aliasError,
          createdAt: deployment.createdAt,
          buildingAt: deployment.buildingAt,
          ready: deployment.ready,
          error: deployment.error
        };
      } catch (parseError) {
        throw new DeploymentError(
          'Failed to parse Vercel deployment status',
          'PARSE_ERROR',
          { output, parseError }
        );
      }
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }

      throw new DeploymentError(
        `Failed to get deployment status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        { deploymentId, error }
      );
    }
  }

  /**
   * Check if deployment is in a terminal state
   */
  private isDeploymentComplete(status: VercelDeploymentStatus): boolean {
    return ['READY', 'ERROR', 'CANCELED'].includes(status.state);
  }

  /**
   * Calculate progress percentage based on deployment state
   */
  private calculateProgress(state: string): number {
    switch (state) {
      case 'QUEUED':
        return 10;
      case 'BUILDING':
        return 30;
      case 'UPLOADING':
        return 60;
      case 'DEPLOYING':
        return 80;
      case 'READY':
        return 100;
      case 'ERROR':
      case 'CANCELED':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Update spinner with current deployment status
   */
  private updateSpinner(status: VercelDeploymentStatus, progress: number): void {
    if (!this.spinner) return;

    const progressBar = this.createProgressBar(progress);
    let message = '';

    switch (status.state) {
      case 'QUEUED':
        message = 'Deployment queued, waiting to start...';
        break;
      case 'BUILDING':
        message = 'Building application...';
        break;
      case 'UPLOADING':
        message = 'Uploading build artifacts...';
        break;
      case 'DEPLOYING':
        message = 'Deploying to Vercel edge network...';
        break;
      case 'READY':
        message = 'Deployment ready!';
        break;
      case 'ERROR':
        message = `Deployment failed: ${status.error?.message || 'Unknown error'}`;
        break;
      case 'CANCELED':
        message = 'Deployment canceled';
        break;
    }

    this.spinner.text = `${progressBar} ${progress}% - ${message}`;
  }

  /**
   * Create a visual progress bar
   */
  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    
    const filledBar = chalk.green('█'.repeat(filled));
    const emptyBar = chalk.gray('░'.repeat(empty));
    
    return `[${filledBar}${emptyBar}]`;
  }

  /**
   * Extract deployment ID from Vercel deployment URL
   */
  static extractDeploymentId(deploymentUrl: string): string {
    // Handle various URL formats:
    // https://project-abc123.vercel.app
    // https://project.vercel.app
    // https://project-git-branch-user.vercel.app
    
    const urlParts = deploymentUrl.replace('https://', '').split('.');
    const subdomain = urlParts[0];
    
    // If subdomain contains a dash followed by alphanumeric characters at the end,
    // that's likely the deployment ID
    const deploymentIdMatch = subdomain.match(/-([a-zA-Z0-9]+)$/);
    
    if (deploymentIdMatch) {
      return deploymentIdMatch[1];
    }
    
    // If no deployment ID found in URL, we might need to use the Vercel API
    // to list deployments and find the matching one
    logger.debug(`Could not extract deployment ID from URL: ${deploymentUrl}`);
    return subdomain;
  }

  /**
   * Get the latest deployment for a project
   */
  async getLatestDeployment(projectId: string, token?: string): Promise<VercelDeploymentStatus | null> {
    const vercelToken = token || process.env.VERCEL_TOKEN;
    
    if (!vercelToken) {
      throw new DeploymentError(
        'VERCEL_TOKEN is required for getting deployment info',
        'VERCEL_TOKEN_MISSING'
      );
    }

    const args = [
      'ls',
      '--project', projectId,
      '--token', vercelToken,
      '--limit', '1',
      '--json'
    ];

    try {
      const result = await executeWithRetry('vercel', args, {
        captureOutput: true,
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000
      });

      const output = result.stdout.trim();
      
      try {
        const response = JSON.parse(output);
        const deployments = response.deployments || [];
        
        if (deployments.length === 0) {
          return null;
        }

        const latest = deployments[0];
        return {
          id: latest.uid,
          state: latest.state || latest.readyState,
          readyState: latest.readyState || latest.state,
          url: latest.url,
          createdAt: latest.created,
          buildingAt: latest.buildingAt,
          ready: latest.ready,
          error: latest.error
        };
      } catch (parseError) {
        throw new DeploymentError(
          'Failed to parse Vercel deployments list',
          'PARSE_ERROR',
          { output, parseError }
        );
      }
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }

      throw new DeploymentError(
        `Failed to get latest deployment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        { projectId, error }
      );
    }
  }
}