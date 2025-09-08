import * as fs from 'fs/promises';
import * as path from 'path';
import { Component, Environment, DeploymentResult } from '../types';
import { logger } from '../utils/logger';
import { DeploymentError } from '../utils/error-handler';

export interface DeploymentRecord {
  id: string;
  component: Component;
  environment: Environment;
  deploymentId: string;
  url: string;
  timestamp: string;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: {
    gitCommit?: string;
    gitBranch?: string;
    deployedBy?: string;
    version?: string;
    previousDeploymentId?: string;
    rolledBackTo?: string;
    rolledBackAt?: string;
  };
}

export interface DeploymentHistory {
  deployments: DeploymentRecord[];
  lastUpdated: string;
}

export class DeploymentTracker {
  private readonly historyFile: string;
  private readonly maxHistorySize: number;

  constructor(historyFile?: string, maxHistorySize = 100) {
    // Default to ~/.sams/deployment-history.json
    this.historyFile = historyFile || path.join(
      process.env.HOME || process.env.USERPROFILE || '.',
      '.sams',
      'deployment-history.json'
    );
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Initialize the deployment tracker (create directory if needed)
   */
  async initialize(): Promise<void> {
    const dir = path.dirname(this.historyFile);
    
    try {
      await fs.mkdir(dir, { recursive: true });
      
      // Check if history file exists, create if not
      try {
        await fs.access(this.historyFile);
      } catch {
        const initialHistory: DeploymentHistory = {
          deployments: [],
          lastUpdated: new Date().toISOString()
        };
        await this.saveHistory(initialHistory);
        logger.debug(`Created deployment history file at: ${this.historyFile}`);
      }
    } catch (error) {
      throw new DeploymentError(
        `Failed to initialize deployment tracker: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRACKER_INIT_ERROR',
        { historyFile: this.historyFile, error }
      );
    }
  }

  /**
   * Record a new deployment
   */
  async recordDeployment(
    result: DeploymentResult,
    metadata?: DeploymentRecord['metadata']
  ): Promise<DeploymentRecord> {
    await this.initialize();

    const history = await this.loadHistory();
    
    // Get previous deployment for this component/environment
    const previousDeployment = await this.getLatestDeployment(
      result.component,
      result.environment,
      history
    );

    const record: DeploymentRecord = {
      id: this.generateId(),
      component: result.component,
      environment: result.environment,
      deploymentId: result.deploymentId || '',
      url: result.url || '',
      timestamp: new Date().toISOString(),
      duration: result.duration || 0,
      success: result.success,
      error: result.error?.message,
      metadata: {
        ...metadata,
        previousDeploymentId: previousDeployment?.deploymentId
      }
    };

    // Add to history
    history.deployments.unshift(record);
    
    // Trim history if needed
    if (history.deployments.length > this.maxHistorySize) {
      history.deployments = history.deployments.slice(0, this.maxHistorySize);
    }

    history.lastUpdated = new Date().toISOString();
    
    await this.saveHistory(history);
    
    logger.debug(`Recorded deployment: ${record.id} for ${record.component}:${record.environment}`);
    
    return record;
  }

  /**
   * Get deployment history for a specific component and environment
   */
  async getDeploymentHistory(
    component?: Component,
    environment?: Environment,
    limit = 10
  ): Promise<DeploymentRecord[]> {
    await this.initialize();
    
    const history = await this.loadHistory();
    let deployments = history.deployments;

    // Filter by component if specified
    if (component) {
      deployments = deployments.filter(d => d.component === component);
    }

    // Filter by environment if specified
    if (environment) {
      deployments = deployments.filter(d => d.environment === environment);
    }

    // Apply limit
    return deployments.slice(0, limit);
  }

  /**
   * Get the latest deployment for a component/environment
   */
  async getLatestDeployment(
    component: Component,
    environment: Environment,
    history?: DeploymentHistory
  ): Promise<DeploymentRecord | null> {
    const deploymentHistory = history || await this.loadHistory();
    
    const deployment = deploymentHistory.deployments.find(
      d => d.component === component && 
           d.environment === environment &&
           d.success
    );

    return deployment || null;
  }

  /**
   * Get deployment by ID
   */
  async getDeploymentById(id: string): Promise<DeploymentRecord | null> {
    await this.initialize();
    
    const history = await this.loadHistory();
    return history.deployments.find(d => d.id === id) || null;
  }

  /**
   * Get rollback candidate for a component/environment
   */
  async getRollbackCandidate(
    component: Component,
    environment: Environment
  ): Promise<DeploymentRecord | null> {
    await this.initialize();
    
    const history = await this.loadHistory();
    
    // Find successful deployments for this component/environment
    const successfulDeployments = history.deployments.filter(
      d => d.component === component && 
           d.environment === environment &&
           d.success
    );

    // Return the second most recent (first is current)
    return successfulDeployments.length > 1 ? successfulDeployments[1] : null;
  }

  /**
   * Mark a deployment as rolled back
   */
  async markRollback(
    fromDeploymentId: string,
    toDeploymentId: string
  ): Promise<void> {
    await this.initialize();
    
    const history = await this.loadHistory();
    
    const deployment = history.deployments.find(d => d.id === fromDeploymentId);
    if (deployment && deployment.metadata) {
      deployment.metadata.rolledBackTo = toDeploymentId;
      deployment.metadata.rolledBackAt = new Date().toISOString();
    }

    history.lastUpdated = new Date().toISOString();
    await this.saveHistory(history);
  }

  /**
   * Get deployment statistics
   */
  async getStatistics(
    component?: Component,
    environment?: Environment,
    days = 30
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
    successRate: number;
  }> {
    await this.initialize();
    
    const history = await this.loadHistory();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let deployments = history.deployments.filter(
      d => new Date(d.timestamp) > cutoffDate
    );

    if (component) {
      deployments = deployments.filter(d => d.component === component);
    }

    if (environment) {
      deployments = deployments.filter(d => d.environment === environment);
    }

    const total = deployments.length;
    const successful = deployments.filter(d => d.success).length;
    const failed = total - successful;
    
    const totalDuration = deployments.reduce((sum, d) => sum + d.duration, 0);
    const averageDuration = total > 0 ? totalDuration / total : 0;
    
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      total,
      successful,
      failed,
      averageDuration,
      successRate
    };
  }

  /**
   * Clean up old deployments
   */
  async cleanup(daysToKeep = 90): Promise<number> {
    await this.initialize();
    
    const history = await this.loadHistory();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const originalCount = history.deployments.length;
    
    history.deployments = history.deployments.filter(
      d => new Date(d.timestamp) > cutoffDate
    );

    const removedCount = originalCount - history.deployments.length;
    
    if (removedCount > 0) {
      history.lastUpdated = new Date().toISOString();
      await this.saveHistory(history);
      logger.info(`Cleaned up ${removedCount} old deployment records`);
    }

    return removedCount;
  }

  /**
   * Load deployment history from file
   */
  private async loadHistory(): Promise<DeploymentHistory> {
    try {
      const data = await fs.readFile(this.historyFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return {
          deployments: [],
          lastUpdated: new Date().toISOString()
        };
      }
      
      throw new DeploymentError(
        `Failed to load deployment history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'HISTORY_LOAD_ERROR',
        { historyFile: this.historyFile, error }
      );
    }
  }

  /**
   * Save deployment history to file
   */
  private async saveHistory(history: DeploymentHistory): Promise<void> {
    try {
      const data = JSON.stringify(history, null, 2);
      await fs.writeFile(this.historyFile, data, 'utf-8');
    } catch (error) {
      throw new DeploymentError(
        `Failed to save deployment history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'HISTORY_SAVE_ERROR',
        { historyFile: this.historyFile, error }
      );
    }
  }

  /**
   * Generate unique deployment ID
   */
  private generateId(): string {
    return `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export deployment history
   */
  async exportHistory(outputFile: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    await this.initialize();
    
    const history = await this.loadHistory();
    
    if (format === 'json') {
      await fs.writeFile(outputFile, JSON.stringify(history, null, 2));
    } else if (format === 'csv') {
      const csv = this.convertToCSV(history.deployments);
      await fs.writeFile(outputFile, csv);
    }
    
    logger.success(`Exported deployment history to: ${outputFile}`);
  }

  /**
   * Convert deployments to CSV format
   */
  private convertToCSV(deployments: DeploymentRecord[]): string {
    const headers = [
      'ID',
      'Component',
      'Environment',
      'Deployment ID',
      'URL',
      'Timestamp',
      'Duration (ms)',
      'Success',
      'Error',
      'Git Commit',
      'Git Branch',
      'Deployed By',
      'Version'
    ];

    const rows = deployments.map(d => [
      d.id,
      d.component,
      d.environment,
      d.deploymentId,
      d.url,
      d.timestamp,
      d.duration.toString(),
      d.success.toString(),
      d.error || '',
      d.metadata?.gitCommit || '',
      d.metadata?.gitBranch || '',
      d.metadata?.deployedBy || '',
      d.metadata?.version || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }
}