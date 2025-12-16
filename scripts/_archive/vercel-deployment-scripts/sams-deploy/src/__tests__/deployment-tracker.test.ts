import { DeploymentTracker } from '../monitors/deployment-tracker';
import { DeploymentResult } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('fs/promises');
jest.mock('../utils/logger');

describe('DeploymentTracker', () => {
  let tracker: DeploymentTracker;
  const mockFS = fs as jest.Mocked<typeof fs>;
  const testHistoryFile = '/tmp/.sams/deployment-history.json';

  beforeEach(() => {
    tracker = new DeploymentTracker(testHistoryFile);
    jest.clearAllMocks();
    
    // Mock file system operations
    mockFS.mkdir.mockResolvedValue(undefined);
    mockFS.access.mockRejectedValue(new Error('File not found'));
    mockFS.writeFile.mockResolvedValue(undefined);
    mockFS.readFile.mockResolvedValue(JSON.stringify({
      deployments: [],
      lastUpdated: new Date().toISOString()
    }));
  });

  describe('initialize', () => {
    it('should create directory and history file if they do not exist', async () => {
      await tracker.initialize();

      expect(mockFS.mkdir).toHaveBeenCalledWith(
        path.dirname(testHistoryFile),
        { recursive: true }
      );
      expect(mockFS.writeFile).toHaveBeenCalled();
    });

    it('should not create history file if it already exists', async () => {
      mockFS.access.mockResolvedValue(undefined); // File exists

      await tracker.initialize();

      expect(mockFS.mkdir).toHaveBeenCalled();
      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('recordDeployment', () => {
    it('should record a successful deployment', async () => {
      const result: DeploymentResult = {
        success: true,
        component: 'mobile',
        environment: 'production',
        deploymentId: 'dep_123',
        url: 'https://app.vercel.app',
        duration: 30000
      };

      const metadata = {
        gitCommit: 'abc123',
        gitBranch: 'main',
        deployedBy: 'testuser',
        version: '1.0.0'
      };

      const record = await tracker.recordDeployment(result, metadata);

      expect(record).toMatchObject({
        component: 'mobile',
        environment: 'production',
        deploymentId: 'dep_123',
        url: 'https://app.vercel.app',
        success: true,
        metadata
      });
      expect(mockFS.writeFile).toHaveBeenCalled();
    });

    it('should record a failed deployment', async () => {
      const result: DeploymentResult = {
        success: false,
        component: 'backend',
        environment: 'staging',
        error: new Error('Build failed')
      };

      const record = await tracker.recordDeployment(result);

      expect(record.success).toBe(false);
      expect(record.error).toBe('Build failed');
      expect(mockFS.writeFile).toHaveBeenCalled();
    });

    it('should maintain history size limit', async () => {
      const tracker = new DeploymentTracker(testHistoryFile, 2);
      
      // Mock existing history with 2 records
      const existingHistory = {
        deployments: [
          { id: 'old1', component: 'mobile', environment: 'production' },
          { id: 'old2', component: 'mobile', environment: 'production' }
        ],
        lastUpdated: new Date().toISOString()
      };
      
      mockFS.readFile.mockResolvedValue(JSON.stringify(existingHistory));

      const result: DeploymentResult = {
        success: true,
        component: 'mobile',
        environment: 'production'
      };

      await tracker.recordDeployment(result);

      const writeCall = mockFS.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      
      expect(writtenData.deployments).toHaveLength(2);
      expect(writtenData.deployments[0].id).not.toBe('old2'); // Old record should be removed
    });
  });

  describe('getDeploymentHistory', () => {
    it('should filter by component and environment', async () => {
      const history = {
        deployments: [
          { id: '1', component: 'mobile', environment: 'production', success: true },
          { id: '2', component: 'mobile', environment: 'staging', success: true },
          { id: '3', component: 'backend', environment: 'production', success: true },
          { id: '4', component: 'mobile', environment: 'production', success: true }
        ],
        lastUpdated: new Date().toISOString()
      };
      
      mockFS.readFile.mockResolvedValue(JSON.stringify(history));

      const results = await tracker.getDeploymentHistory('mobile', 'production', 10);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.component === 'mobile' && r.environment === 'production')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const history = {
        deployments: Array(10).fill(null).map((_, i) => ({
          id: `${i}`,
          component: 'mobile',
          environment: 'production',
          success: true
        })),
        lastUpdated: new Date().toISOString()
      };
      
      mockFS.readFile.mockResolvedValue(JSON.stringify(history));

      const results = await tracker.getDeploymentHistory('mobile', 'production', 5);

      expect(results).toHaveLength(5);
    });
  });

  describe('getRollbackCandidate', () => {
    it('should return the previous successful deployment', async () => {
      const history = {
        deployments: [
          { id: 'current', component: 'mobile', environment: 'production', success: true },
          { id: 'previous', component: 'mobile', environment: 'production', success: true },
          { id: 'older', component: 'mobile', environment: 'production', success: true }
        ],
        lastUpdated: new Date().toISOString()
      };
      
      mockFS.readFile.mockResolvedValue(JSON.stringify(history));

      const candidate = await tracker.getRollbackCandidate('mobile', 'production');

      expect(candidate?.id).toBe('previous');
    });

    it('should skip failed deployments', async () => {
      const history = {
        deployments: [
          { id: 'current', component: 'mobile', environment: 'production', success: true },
          { id: 'failed', component: 'mobile', environment: 'production', success: false },
          { id: 'previous', component: 'mobile', environment: 'production', success: true }
        ],
        lastUpdated: new Date().toISOString()
      };
      
      mockFS.readFile.mockResolvedValue(JSON.stringify(history));

      const candidate = await tracker.getRollbackCandidate('mobile', 'production');

      expect(candidate?.id).toBe('previous');
    });

    it('should return null if no rollback candidate exists', async () => {
      const history = {
        deployments: [
          { id: 'current', component: 'mobile', environment: 'production', success: true }
        ],
        lastUpdated: new Date().toISOString()
      };
      
      mockFS.readFile.mockResolvedValue(JSON.stringify(history));

      const candidate = await tracker.getRollbackCandidate('mobile', 'production');

      expect(candidate).toBeNull();
    });
  });

  describe('getStatistics', () => {
    it('should calculate deployment statistics correctly', async () => {
      const now = new Date();
      const history = {
        deployments: [
          { component: 'mobile', environment: 'production', success: true, duration: 30000, timestamp: now.toISOString() },
          { component: 'mobile', environment: 'production', success: false, duration: 20000, timestamp: now.toISOString() },
          { component: 'mobile', environment: 'production', success: true, duration: 40000, timestamp: now.toISOString() },
          { component: 'backend', environment: 'production', success: true, duration: 50000, timestamp: now.toISOString() }
        ],
        lastUpdated: now.toISOString()
      };
      
      mockFS.readFile.mockResolvedValue(JSON.stringify(history));

      const stats = await tracker.getStatistics('mobile', 'production');

      expect(stats.total).toBe(3);
      expect(stats.successful).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
      expect(stats.averageDuration).toBe(30000);
    });
  });

  describe('cleanup', () => {
    it('should remove old deployments', async () => {
      const now = new Date();
      const old = new Date();
      old.setDate(old.getDate() - 100);

      const history = {
        deployments: [
          { id: 'recent', timestamp: now.toISOString() },
          { id: 'old1', timestamp: old.toISOString() },
          { id: 'old2', timestamp: old.toISOString() }
        ],
        lastUpdated: now.toISOString()
      };
      
      mockFS.readFile.mockResolvedValue(JSON.stringify(history));

      const removed = await tracker.cleanup(90);

      expect(removed).toBe(2);
      
      const writeCall = mockFS.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.deployments).toHaveLength(1);
      expect(writtenData.deployments[0].id).toBe('recent');
    });
  });
});