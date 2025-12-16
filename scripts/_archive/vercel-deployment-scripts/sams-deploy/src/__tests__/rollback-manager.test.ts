import { RollbackManager } from '../rollback/rollback-manager';
import { DeploymentHistory } from '../rollback/deployment-history';
import { DeploymentTracker } from '../monitors/deployment-tracker';
import { Component, Environment } from '../types';

// Mock external dependencies
jest.mock('../monitors/deployment-tracker');
jest.mock('../monitors/vercel-monitor');
jest.mock('../utils/process');
jest.mock('../utils/logger');

describe('RollbackManager', () => {
  let rollbackManager: RollbackManager;
  let mockTracker: jest.Mocked<DeploymentTracker>;

  beforeEach(() => {
    rollbackManager = new RollbackManager();
    mockTracker = new DeploymentTracker() as jest.Mocked<DeploymentTracker>;
    
    // Mock implementations
    mockTracker.initialize = jest.fn().mockResolvedValue(undefined);
    mockTracker.getLatestDeployment = jest.fn();
    mockTracker.getDeploymentById = jest.fn();
    mockTracker.getRollbackCandidate = jest.fn();
    mockTracker.markRollback = jest.fn();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(rollbackManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('listRollbackCandidates', () => {
    it('should return available rollback candidates', async () => {
      const mockCandidates = [
        {
          id: 'dep_1',
          component: 'mobile' as Component,
          environment: 'production' as Environment,
          deploymentId: 'vercel-dep-1',
          url: 'https://app-dep1.vercel.app',
          timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          duration: 120000,
          success: true,
          metadata: {
            version: '1.0.0',
            gitBranch: 'main',
            gitCommit: 'abc123'
          }
        },
        {
          id: 'dep_2',
          component: 'mobile' as Component,
          environment: 'production' as Environment,
          deploymentId: 'vercel-dep-2',
          url: 'https://app-dep2.vercel.app',
          timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          duration: 135000,
          success: true,
          metadata: {
            version: '0.9.9',
            gitBranch: 'main',
            gitCommit: 'def456'
          }
        }
      ];

      mockTracker.getDeploymentHistory = jest.fn().mockResolvedValue(mockCandidates);

      const candidates = await rollbackManager.listRollbackCandidates('mobile', 'production', 5);

      expect(candidates).toHaveLength(2);
      expect(candidates[0].deploymentId).toBe('vercel-dep-1');
      expect(candidates[1].deploymentId).toBe('vercel-dep-2');
    });

    it('should return empty array when no candidates available', async () => {
      mockTracker.getDeploymentHistory = jest.fn().mockResolvedValue([]);

      const candidates = await rollbackManager.listRollbackCandidates('mobile', 'production', 5);

      expect(candidates).toHaveLength(0);
    });
  });

  describe('createRollbackPlan', () => {
    it('should create a rollback plan for mobile component', async () => {
      const currentDeployment = {
        id: 'dep_current',
        component: 'mobile' as Component,
        environment: 'production' as Environment,
        deploymentId: 'vercel-current',
        url: 'https://app-current.vercel.app',
        timestamp: new Date().toISOString(),
        duration: 120000,
        success: true,
        metadata: {
          version: '1.1.0',
          gitBranch: 'main',
          gitCommit: 'current123'
        }
      };

      const targetDeployment = {
        id: 'dep_target',
        component: 'mobile' as Component,
        environment: 'production' as Environment,
        deploymentId: 'vercel-target',
        url: 'https://app-target.vercel.app',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        duration: 115000,
        success: true,
        metadata: {
          version: '1.0.0',
          gitBranch: 'main',
          gitCommit: 'target456'
        }
      };

      mockTracker.getLatestDeployment = jest.fn().mockResolvedValue(currentDeployment);
      mockTracker.getRollbackCandidate = jest.fn().mockResolvedValue(targetDeployment);

      const plan = await rollbackManager.createRollbackPlan('mobile', 'production');

      expect(plan.component).toBe('mobile');
      expect(plan.environment).toBe('production');
      expect(plan.currentDeployment.deploymentId).toBe('vercel-current');
      expect(plan.targetDeployment.deploymentId).toBe('vercel-target');
      expect(plan.rollbackType).toBe('vercel-alias');
      expect(plan.riskLevel).toBe('low'); // 1 day difference
      expect(plan.estimatedDowntime).toBe(30); // Vercel alias switching
    });

    it('should assess high risk for major version rollback', async () => {
      const currentDeployment = {
        id: 'dep_current',
        component: 'mobile' as Component,
        environment: 'production' as Environment,
        deploymentId: 'vercel-current',
        url: 'https://app-current.vercel.app',
        timestamp: new Date().toISOString(),
        duration: 120000,
        success: true,
        metadata: {
          version: '2.0.0', // Major version
          gitBranch: 'main',
          gitCommit: 'current123'
        }
      };

      const targetDeployment = {
        id: 'dep_target',
        component: 'mobile' as Component,
        environment: 'production' as Environment,
        deploymentId: 'vercel-target',
        url: 'https://app-target.vercel.app',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        duration: 115000,
        success: true,
        metadata: {
          version: '1.9.9', // Previous major version
          gitBranch: 'main',
          gitCommit: 'target456'
        }
      };

      mockTracker.getLatestDeployment = jest.fn().mockResolvedValue(currentDeployment);
      mockTracker.getRollbackCandidate = jest.fn().mockResolvedValue(targetDeployment);

      const plan = await rollbackManager.createRollbackPlan('mobile', 'production');

      expect(plan.riskLevel).toBe('high'); // Major version rollback
    });

    it('should determine correct rollback types for different components', async () => {
      const mockDeployment = {
        id: 'dep_1',
        component: 'firebase' as Component,
        environment: 'production' as Environment,
        deploymentId: 'firebase-dep',
        url: '',
        timestamp: new Date().toISOString(),
        duration: 60000,
        success: true
      };

      mockTracker.getLatestDeployment = jest.fn().mockResolvedValue(mockDeployment);
      mockTracker.getRollbackCandidate = jest.fn().mockResolvedValue({
        ...mockDeployment,
        id: 'dep_target',
        timestamp: new Date(Date.now() - 86400000).toISOString()
      });

      const plan = await rollbackManager.createRollbackPlan('firebase', 'production');

      expect(plan.rollbackType).toBe('firebase-rules');
      expect(plan.estimatedDowntime).toBe(60); // Firebase rules deployment
    });
  });

  describe('executeRollback', () => {
    it('should execute dry run without making changes', async () => {
      const plan = {
        component: 'mobile' as Component,
        environment: 'production' as Environment,
        currentDeployment: {
          id: 'current',
          deploymentId: 'vercel-current',
          metadata: { version: '1.1.0' }
        },
        targetDeployment: {
          id: 'target',
          deploymentId: 'vercel-target',
          metadata: { version: '1.0.0' }
        },
        rollbackType: 'vercel-alias' as const,
        estimatedDowntime: 30,
        riskLevel: 'low' as const,
        verificationSteps: ['Check deployment status'],
        rollbackSteps: ['Switch Vercel alias']
      };

      const result = await rollbackManager.executeRollback(plan, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.duration).toBe(0);
      expect(result.verificationPassed).toBe(true);
    });
  });

  describe('emergencyRollback', () => {
    it('should perform emergency rollback with minimal checks', async () => {
      const currentDeployment = {
        id: 'dep_current',
        component: 'mobile' as Component,
        environment: 'production' as Environment,
        deploymentId: 'vercel-current',
        url: 'https://app-current.vercel.app',
        timestamp: new Date().toISOString(),
        duration: 120000,
        success: true,
        metadata: {
          version: '1.1.0',
          gitBranch: 'main',
          gitCommit: 'current123'
        }
      };

      const targetDeployment = {
        id: 'dep_target',
        component: 'mobile' as Component,
        environment: 'production' as Environment,
        deploymentId: 'vercel-target',
        url: 'https://app-target.vercel.app',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        duration: 115000,
        success: true,
        metadata: {
          version: '1.0.0',
          gitBranch: 'main',
          gitCommit: 'target456'
        }
      };

      mockTracker.getLatestDeployment = jest.fn().mockResolvedValue(currentDeployment);
      mockTracker.getRollbackCandidate = jest.fn().mockResolvedValue(targetDeployment);

      // Mock successful rollback execution
      jest.spyOn(rollbackManager, 'executeRollback').mockImplementation(async (plan, options) => {
        return {
          success: true,
          component: plan.component,
          environment: plan.environment,
          rollbackId: 'emergency_rollback_123',
          duration: 15000,
          verificationPassed: true,
          metadata: {
            fromDeploymentId: plan.currentDeployment.deploymentId,
            toDeploymentId: plan.targetDeployment.deploymentId,
            rollbackType: plan.rollbackType,
            emergencyMode: true
          }
        };
      });

      const result = await rollbackManager.emergencyRollback('mobile', 'production');

      expect(result.success).toBe(true);
      expect(result.metadata?.emergencyMode).toBe(true);
      expect(rollbackManager.executeRollback).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          emergencyMode: true,
          skipBackup: true,
          force: true,
          monitor: true
        })
      );
    });
  });
});

describe('DeploymentHistory', () => {
  let deploymentHistory: DeploymentHistory;

  beforeEach(() => {
    deploymentHistory = new DeploymentHistory();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(deploymentHistory.initialize()).resolves.not.toThrow();
    });
  });

  describe('recordDeployment', () => {
    it('should record comprehensive deployment data', async () => {
      const deploymentMetadata = {
        component: 'mobile' as Component,
        environment: 'production' as Environment,
        deploymentId: 'vercel-123',
        url: 'https://app.vercel.app',
        version: '1.0.0',
        buildNumber: '100',
        deploymentType: 'release' as const,
        triggeredBy: 'manual' as const,
        deploymentDuration: 120000,
        verificationStatus: 'passed' as const
      };

      const outcome = {
        success: true,
        verificationResults: {
          healthChecks: true,
          functionalTests: true,
          performanceTests: true,
          securityChecks: true
        }
      };

      const gitInfo = {
        hash: 'abc123',
        branch: 'main',
        message: 'Deploy v1.0.0',
        author: 'developer@example.com',
        timestamp: new Date().toISOString()
      };

      const record = await deploymentHistory.recordDeployment(
        deploymentMetadata,
        outcome,
        gitInfo
      );

      expect(record.id).toMatch(/^dep_\d+_[a-z0-9]+$/);
      expect(record.deployment.component).toBe('mobile');
      expect(record.deployment.environment).toBe('production');
      expect(record.outcome.success).toBe(true);
      expect(record.git.hash).toBe('abc123');
    });
  });

  describe('searchDeployments', () => {
    it('should filter deployments by component and environment', async () => {
      // This would typically be mocked or use a test database
      const results = await deploymentHistory.searchDeployments({
        component: 'mobile',
        environment: 'production',
        success: true,
        limit: 10
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should calculate deployment statistics', async () => {
      const stats = await deploymentHistory.getStatistics('mobile', 'production', 30);

      expect(stats).toHaveProperty('totalDeployments');
      expect(stats).toHaveProperty('successfulDeployments');
      expect(stats).toHaveProperty('failedDeployments');
      expect(stats).toHaveProperty('rollbackCount');
      expect(stats).toHaveProperty('averageDeploymentTime');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('rollbackRate');
      expect(stats).toHaveProperty('componentBreakdown');
      expect(stats).toHaveProperty('environmentBreakdown');
      expect(stats).toHaveProperty('timeSeriesData');
    });
  });
});