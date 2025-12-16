import * as fs from 'fs/promises';
import * as path from 'path';
import { Component, Environment } from '../types';
import { logger } from '../utils/logger';
import { DeploymentError } from '../utils/error-handler';
import { executeCommand } from '../utils/process';

export interface GitMetadata {
  hash: string;
  branch: string;
  message: string;
  author: string;
  timestamp: string;
  tag?: string;
  remoteUrl?: string;
}

export interface DeploymentMetadata {
  component: Component;
  environment: Environment;
  deploymentId: string;
  url?: string;
  version?: string;
  buildNumber?: string;
  deploymentType: 'release' | 'hotfix' | 'rollback' | 'emergency';
  triggeredBy: 'manual' | 'ci' | 'scheduled' | 'webhook';
  buildDuration?: number;
  deploymentDuration?: number;
  verificationStatus?: 'passed' | 'failed' | 'skipped';
  performance?: {
    buildSize?: number;
    loadTime?: number;
    healthCheckResponse?: number;
  };
}

export interface DeploymentOutcome {
  success: boolean;
  error?: string;
  warnings?: string[];
  rollbackRequired?: boolean;
  rollbackReason?: string;
  verificationResults?: {
    healthChecks: boolean;
    functionalTests: boolean;
    performanceTests: boolean;
    securityChecks: boolean;
  };
}

export interface RollbackRecord {
  id: string;
  timestamp: string;
  component: Component;
  environment: Environment;
  fromDeploymentId: string;
  toDeploymentId: string;
  rollbackType: 'vercel-alias' | 'firebase-rules' | 'backend-redeploy';
  success: boolean;
  duration?: number;
  error?: string;
  triggeredBy: string;
  reason: string;
  emergencyMode?: boolean;
  verificationPassed?: boolean;
  metadata?: Record<string, any>;
}

export interface BackupRecord {
  id: string;
  timestamp: string;
  component: Component;
  environment: Environment;
  backupType: 'pre-rollback' | 'scheduled' | 'manual';
  data: any;
  size?: number;
  location?: string;
}

export interface ComprehensiveDeploymentRecord {
  id: string;
  timestamp: string;
  git: GitMetadata;
  deployment: DeploymentMetadata;
  outcome: DeploymentOutcome;
  rollbacks?: RollbackRecord[];
  backups?: BackupRecord[];
}

export interface DeploymentSearchOptions {
  component?: Component;
  environment?: Environment;
  success?: boolean;
  deploymentType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  gitBranch?: string;
  version?: string;
  triggeredBy?: string;
  limit?: number;
}

export interface DeploymentStatistics {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  rollbackCount: number;
  averageDeploymentTime: number;
  averageBuildTime: number;
  successRate: number;
  rollbackRate: number;
  componentBreakdown: Record<Component, {
    deployments: number;
    successes: number;
    failures: number;
    rollbacks: number;
  }>;
  environmentBreakdown: Record<Environment, {
    deployments: number;
    successes: number;
    failures: number;
    rollbacks: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    deployments: number;
    successes: number;
    failures: number;
    rollbacks: number;
  }>;
}

export class DeploymentHistory {
  private readonly historyDir: string;
  private readonly deploymentsFile: string;
  private readonly rollbacksFile: string;
  private readonly backupsFile: string;
  private readonly auditFile: string;

  constructor(baseDir?: string) {
    this.historyDir = baseDir || path.join(
      process.env.HOME || process.env.USERPROFILE || '.',
      '.sams',
      'deployment-history'
    );
    
    this.deploymentsFile = path.join(this.historyDir, 'deployments.json');
    this.rollbacksFile = path.join(this.historyDir, 'rollbacks.json');
    this.backupsFile = path.join(this.historyDir, 'backups.json');
    this.auditFile = path.join(this.historyDir, 'audit.json');
  }

  /**
   * Initialize the deployment history system
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.historyDir, { recursive: true });
      
      // Initialize files if they don't exist
      const files = [
        { path: this.deploymentsFile, data: { deployments: [], lastUpdated: new Date().toISOString() } },
        { path: this.rollbacksFile, data: { rollbacks: [], lastUpdated: new Date().toISOString() } },
        { path: this.backupsFile, data: { backups: [], lastUpdated: new Date().toISOString() } },
        { path: this.auditFile, data: { events: [], lastUpdated: new Date().toISOString() } }
      ];

      for (const file of files) {
        try {
          await fs.access(file.path);
        } catch {
          await fs.writeFile(file.path, JSON.stringify(file.data, null, 2));
          logger.debug(`Created history file: ${file.path}`);
        }
      }
    } catch (error) {
      throw new DeploymentError(
        `Failed to initialize deployment history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'HISTORY_INIT_ERROR'
      );
    }
  }

  /**
   * Record a comprehensive deployment with full metadata
   */
  async recordDeployment(
    deployment: DeploymentMetadata,
    outcome: DeploymentOutcome,
    gitInfo?: Partial<GitMetadata>
  ): Promise<ComprehensiveDeploymentRecord> {
    await this.initialize();

    // Get comprehensive Git information
    const git = await this.getGitMetadata(gitInfo);

    const record: ComprehensiveDeploymentRecord = {
      id: this.generateId('dep'),
      timestamp: new Date().toISOString(),
      git,
      deployment,
      outcome,
      rollbacks: [],
      backups: []
    };

    // Load existing deployments
    const data = await this.loadFile(this.deploymentsFile);
    data.deployments.unshift(record);
    
    // Maintain history size (keep last 1000 deployments)
    if (data.deployments.length > 1000) {
      data.deployments = data.deployments.slice(0, 1000);
    }

    data.lastUpdated = new Date().toISOString();
    await this.saveFile(this.deploymentsFile, data);

    // Record audit event
    await this.recordAuditEvent('deployment_recorded', {
      deploymentId: record.id,
      component: deployment.component,
      environment: deployment.environment,
      success: outcome.success
    });

    logger.debug(`Recorded deployment: ${record.id} for ${deployment.component}:${deployment.environment}`);
    return record;
  }

  /**
   * Record a rollback operation
   */
  async recordRollback(rollback: Omit<RollbackRecord, 'id'>): Promise<RollbackRecord> {
    await this.initialize();

    const record: RollbackRecord = {
      ...rollback,
      id: this.generateId('rb')
    };

    const data = await this.loadFile(this.rollbacksFile);
    data.rollbacks.unshift(record);
    
    // Maintain history size
    if (data.rollbacks.length > 500) {
      data.rollbacks = data.rollbacks.slice(0, 500);
    }

    data.lastUpdated = new Date().toISOString();
    await this.saveFile(this.rollbacksFile, data);

    // Record audit event
    await this.recordAuditEvent('rollback_executed', {
      rollbackId: record.id,
      component: rollback.component,
      environment: rollback.environment,
      success: rollback.success,
      emergencyMode: rollback.emergencyMode
    });

    return record;
  }

  /**
   * Record a backup operation
   */
  async recordBackup(backup: Omit<BackupRecord, 'id'>): Promise<BackupRecord> {
    await this.initialize();

    const record: BackupRecord = {
      ...backup,
      id: this.generateId('bak')
    };

    const data = await this.loadFile(this.backupsFile);
    data.backups.unshift(record);
    
    // Maintain history size
    if (data.backups.length > 200) {
      data.backups = data.backups.slice(0, 200);
    }

    data.lastUpdated = new Date().toISOString();
    await this.saveFile(this.backupsFile, data);

    return record;
  }

  /**
   * Search deployments with comprehensive filtering
   */
  async searchDeployments(options: DeploymentSearchOptions): Promise<ComprehensiveDeploymentRecord[]> {
    await this.initialize();

    const data = await this.loadFile(this.deploymentsFile);
    let deployments = data.deployments as ComprehensiveDeploymentRecord[];

    // Apply filters
    if (options.component) {
      deployments = deployments.filter(d => d.deployment.component === options.component);
    }

    if (options.environment) {
      deployments = deployments.filter(d => d.deployment.environment === options.environment);
    }

    if (options.success !== undefined) {
      deployments = deployments.filter(d => d.outcome.success === options.success);
    }

    if (options.deploymentType) {
      deployments = deployments.filter(d => d.deployment.deploymentType === options.deploymentType);
    }

    if (options.gitBranch) {
      deployments = deployments.filter(d => d.git.branch === options.gitBranch);
    }

    if (options.version) {
      deployments = deployments.filter(d => d.deployment.version === options.version);
    }

    if (options.triggeredBy) {
      deployments = deployments.filter(d => d.deployment.triggeredBy === options.triggeredBy);
    }

    if (options.dateFrom) {
      deployments = deployments.filter(d => new Date(d.timestamp) >= options.dateFrom!);
    }

    if (options.dateTo) {
      deployments = deployments.filter(d => new Date(d.timestamp) <= options.dateTo!);
    }

    // Apply limit
    if (options.limit) {
      deployments = deployments.slice(0, options.limit);
    }

    return deployments;
  }

  /**
   * Get rollback history
   */
  async getRollbackHistory(
    component?: Component,
    environment?: Environment,
    limit = 20
  ): Promise<RollbackRecord[]> {
    await this.initialize();

    const data = await this.loadFile(this.rollbacksFile);
    let rollbacks = data.rollbacks as RollbackRecord[];

    if (component) {
      rollbacks = rollbacks.filter(r => r.component === component);
    }

    if (environment) {
      rollbacks = rollbacks.filter(r => r.environment === environment);
    }

    return rollbacks.slice(0, limit);
  }

  /**
   * Get deployment statistics
   */
  async getStatistics(
    component?: Component,
    environment?: Environment,
    days = 30
  ): Promise<DeploymentStatistics> {
    await this.initialize();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const deployments = await this.searchDeployments({
      component,
      environment,
      dateFrom: cutoffDate
    });

    const rollbacks = await this.getRollbackHistory(component, environment, 1000);
    const relevantRollbacks = rollbacks.filter(r => new Date(r.timestamp) >= cutoffDate);

    const stats: DeploymentStatistics = {
      totalDeployments: deployments.length,
      successfulDeployments: deployments.filter(d => d.outcome.success).length,
      failedDeployments: deployments.filter(d => !d.outcome.success).length,
      rollbackCount: relevantRollbacks.length,
      averageDeploymentTime: 0,
      averageBuildTime: 0,
      successRate: 0,
      rollbackRate: 0,
      componentBreakdown: {} as any,
      environmentBreakdown: {} as any,
      timeSeriesData: []
    };

    // Calculate averages
    const deploymentsWithDuration = deployments.filter(d => d.deployment.deploymentDuration);
    const deploymentsWithBuildDuration = deployments.filter(d => d.deployment.buildDuration);

    if (deploymentsWithDuration.length > 0) {
      stats.averageDeploymentTime = deploymentsWithDuration.reduce(
        (sum, d) => sum + (d.deployment.deploymentDuration || 0), 0
      ) / deploymentsWithDuration.length;
    }

    if (deploymentsWithBuildDuration.length > 0) {
      stats.averageBuildTime = deploymentsWithBuildDuration.reduce(
        (sum, d) => sum + (d.deployment.buildDuration || 0), 0
      ) / deploymentsWithBuildDuration.length;
    }

    // Calculate rates
    if (stats.totalDeployments > 0) {
      stats.successRate = (stats.successfulDeployments / stats.totalDeployments) * 100;
      stats.rollbackRate = (stats.rollbackCount / stats.totalDeployments) * 100;
    }

    // Generate breakdowns
    stats.componentBreakdown = this.generateComponentBreakdown(deployments, relevantRollbacks);
    stats.environmentBreakdown = this.generateEnvironmentBreakdown(deployments, relevantRollbacks);

    // Generate time series data
    stats.timeSeriesData = this.generateTimeSeriesData(deployments, relevantRollbacks, days);

    return stats;
  }

  /**
   * Export comprehensive deployment data
   */
  async exportData(
    outputDir: string,
    format: 'json' | 'csv' = 'json',
    options: DeploymentSearchOptions = {}
  ): Promise<void> {
    await this.initialize();
    await fs.mkdir(outputDir, { recursive: true });

    const deployments = await this.searchDeployments(options);
    const rollbacks = await this.getRollbackHistory(options.component, options.environment, 1000);
    const statistics = await this.getStatistics(options.component, options.environment, 365);

    if (format === 'json') {
      await fs.writeFile(
        path.join(outputDir, 'deployments.json'),
        JSON.stringify(deployments, null, 2)
      );
      await fs.writeFile(
        path.join(outputDir, 'rollbacks.json'),
        JSON.stringify(rollbacks, null, 2)
      );
      await fs.writeFile(
        path.join(outputDir, 'statistics.json'),
        JSON.stringify(statistics, null, 2)
      );
    } else {
      await fs.writeFile(
        path.join(outputDir, 'deployments.csv'),
        this.convertDeploymentsToCSV(deployments)
      );
      await fs.writeFile(
        path.join(outputDir, 'rollbacks.csv'),
        this.convertRollbacksToCSV(rollbacks)
      );
    }

    logger.success(`Exported deployment data to: ${outputDir}`);
  }

  /**
   * Get Git metadata for the current repository
   */
  private async getGitMetadata(partial?: Partial<GitMetadata>): Promise<GitMetadata> {
    try {
      const [hash, branch, message, author, timestamp, remoteUrl] = await Promise.all([
        partial?.hash || executeCommand('git', ['rev-parse', 'HEAD']).then(r => r.stdout.trim()).catch(() => 'unknown'),
        partial?.branch || executeCommand('git', ['branch', '--show-current']).then(r => r.stdout.trim()).catch(() => 'unknown'),
        partial?.message || executeCommand('git', ['log', '-1', '--pretty=%s']).then(r => r.stdout.trim()).catch(() => 'unknown'),
        partial?.author || executeCommand('git', ['log', '-1', '--pretty=%an <%ae>']).then(r => r.stdout.trim()).catch(() => 'unknown'),
        partial?.timestamp || executeCommand('git', ['log', '-1', '--pretty=%aI']).then(r => r.stdout.trim()).catch(() => new Date().toISOString()),
        partial?.remoteUrl || executeCommand('git', ['config', '--get', 'remote.origin.url']).then(r => r.stdout.trim()).catch(() => undefined)
      ]);

      // Try to get tag if on a tagged commit
      const tag = await executeCommand('git', ['describe', '--tags', '--exact-match']).then(r => r.stdout.trim()).catch(() => undefined);

      return {
        hash: hash.substring(0, 7), // Short hash
        branch,
        message,
        author,
        timestamp,
        tag,
        remoteUrl
      };
    } catch (error) {
      logger.warn(`Failed to get Git metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        hash: partial?.hash || 'unknown',
        branch: partial?.branch || 'unknown',
        message: partial?.message || 'unknown',
        author: partial?.author || 'unknown',
        timestamp: partial?.timestamp || new Date().toISOString(),
        remoteUrl: partial?.remoteUrl
      };
    }
  }

  /**
   * Record an audit event
   */
  private async recordAuditEvent(event: string, data: any): Promise<void> {
    try {
      const auditData = await this.loadFile(this.auditFile);
      
      auditData.events.unshift({
        id: this.generateId('audit'),
        timestamp: new Date().toISOString(),
        event,
        data,
        user: process.env.USER || process.env.USERNAME || 'unknown'
      });

      // Keep last 10000 audit events
      if (auditData.events.length > 10000) {
        auditData.events = auditData.events.slice(0, 10000);
      }

      auditData.lastUpdated = new Date().toISOString();
      await this.saveFile(this.auditFile, auditData);
    } catch (error) {
      logger.warn(`Failed to record audit event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate component breakdown statistics
   */
  private generateComponentBreakdown(
    deployments: ComprehensiveDeploymentRecord[],
    rollbacks: RollbackRecord[]
  ): Record<Component, any> {
    const components: Component[] = ['desktop', 'mobile', 'backend', 'firebase'];
    const breakdown: any = {};

    for (const component of components) {
      const componentDeployments = deployments.filter(d => d.deployment.component === component);
      const componentRollbacks = rollbacks.filter(r => r.component === component);

      breakdown[component] = {
        deployments: componentDeployments.length,
        successes: componentDeployments.filter(d => d.outcome.success).length,
        failures: componentDeployments.filter(d => !d.outcome.success).length,
        rollbacks: componentRollbacks.length
      };
    }

    return breakdown;
  }

  /**
   * Generate environment breakdown statistics
   */
  private generateEnvironmentBreakdown(
    deployments: ComprehensiveDeploymentRecord[],
    rollbacks: RollbackRecord[]
  ): Record<Environment, any> {
    const environments: Environment[] = ['development', 'staging', 'production'];
    const breakdown: any = {};

    for (const environment of environments) {
      const envDeployments = deployments.filter(d => d.deployment.environment === environment);
      const envRollbacks = rollbacks.filter(r => r.environment === environment);

      breakdown[environment] = {
        deployments: envDeployments.length,
        successes: envDeployments.filter(d => d.outcome.success).length,
        failures: envDeployments.filter(d => !d.outcome.success).length,
        rollbacks: envRollbacks.length
      };
    }

    return breakdown;
  }

  /**
   * Generate time series data for statistics
   */
  private generateTimeSeriesData(
    deployments: ComprehensiveDeploymentRecord[],
    rollbacks: RollbackRecord[],
    days: number
  ): Array<any> {
    const data = [];
    const endDate = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      const dayDeployments = deployments.filter(d => 
        d.timestamp.startsWith(dateString)
      );
      const dayRollbacks = rollbacks.filter(r => 
        r.timestamp.startsWith(dateString)
      );

      data.push({
        date: dateString,
        deployments: dayDeployments.length,
        successes: dayDeployments.filter(d => d.outcome.success).length,
        failures: dayDeployments.filter(d => !d.outcome.success).length,
        rollbacks: dayRollbacks.length
      });
    }

    return data;
  }

  /**
   * Convert deployments to CSV format
   */
  private convertDeploymentsToCSV(deployments: ComprehensiveDeploymentRecord[]): string {
    const headers = [
      'ID', 'Timestamp', 'Component', 'Environment', 'Deployment ID', 'URL', 'Version',
      'Success', 'Git Hash', 'Git Branch', 'Git Author', 'Deployment Type', 'Triggered By',
      'Build Duration', 'Deployment Duration', 'Error'
    ];

    const rows = deployments.map(d => [
      d.id,
      d.timestamp,
      d.deployment.component,
      d.deployment.environment,
      d.deployment.deploymentId,
      d.deployment.url || '',
      d.deployment.version || '',
      d.outcome.success.toString(),
      d.git.hash,
      d.git.branch,
      d.git.author,
      d.deployment.deploymentType,
      d.deployment.triggeredBy,
      d.deployment.buildDuration?.toString() || '',
      d.deployment.deploymentDuration?.toString() || '',
      d.outcome.error || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Convert rollbacks to CSV format
   */
  private convertRollbacksToCSV(rollbacks: RollbackRecord[]): string {
    const headers = [
      'ID', 'Timestamp', 'Component', 'Environment', 'From Deployment', 'To Deployment',
      'Rollback Type', 'Success', 'Duration', 'Triggered By', 'Reason', 'Emergency Mode', 'Error'
    ];

    const rows = rollbacks.map(r => [
      r.id,
      r.timestamp,
      r.component,
      r.environment,
      r.fromDeploymentId,
      r.toDeploymentId,
      r.rollbackType,
      r.success.toString(),
      r.duration?.toString() || '',
      r.triggeredBy,
      r.reason,
      r.emergencyMode?.toString() || 'false',
      r.error || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Load data from a JSON file
   */
  private async loadFile(filePath: string): Promise<any> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return { deployments: [], rollbacks: [], backups: [], events: [], lastUpdated: new Date().toISOString() };
      }
      throw error;
    }
  }

  /**
   * Save data to a JSON file
   */
  private async saveFile(filePath: string, data: any): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}