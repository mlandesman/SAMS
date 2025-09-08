import { VercelMonitor } from '../monitors/vercel-monitor';
import { DeploymentError } from '../utils/error-handler';
import * as processUtils from '../utils/process';

jest.mock('../utils/process');
jest.mock('../utils/logger');

describe('VercelMonitor', () => {
  let monitor: VercelMonitor;
  const mockExecuteWithRetry = processUtils.executeWithRetry as jest.MockedFunction<typeof processUtils.executeWithRetry>;

  beforeEach(() => {
    monitor = new VercelMonitor();
    jest.clearAllMocks();
    process.env.VERCEL_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.VERCEL_TOKEN;
  });

  describe('monitorDeployment', () => {
    it('should successfully monitor a deployment until ready', async () => {
      const deploymentId = 'dep_123';
      
      // Mock responses for different states
      const responses = [
        { readyState: 'QUEUED' },
        { readyState: 'BUILDING' },
        { readyState: 'UPLOADING' },
        { readyState: 'DEPLOYING' },
        { readyState: 'READY', url: 'https://my-app.vercel.app' }
      ];
      
      let callCount = 0;
      mockExecuteWithRetry.mockImplementation(async () => ({
        stdout: JSON.stringify({
          id: deploymentId,
          ...responses[callCount++]
        }),
        stderr: '',
        code: 0,
        duration: 1000
      }));

      const result = await monitor.monitorDeployment(deploymentId, {
        pollInterval: 10,
        showProgress: false
      });

      expect(result.state).toBe('READY');
      expect(result.url).toBe('https://my-app.vercel.app');
      expect(mockExecuteWithRetry).toHaveBeenCalledTimes(5);
    });

    it('should throw error when deployment fails', async () => {
      const deploymentId = 'dep_123';
      
      mockExecuteWithRetry.mockResolvedValue({
        stdout: JSON.stringify({
          id: deploymentId,
          readyState: 'ERROR',
          error: { message: 'Build failed', code: 'BUILD_ERROR' }
        }),
        stderr: '',
        code: 0,
        duration: 1000
      });

      const result = await monitor.monitorDeployment(deploymentId, {
        pollInterval: 10,
        showProgress: false
      });

      expect(result.state).toBe('ERROR');
      expect(result.error).toEqual({ message: 'Build failed', code: 'BUILD_ERROR' });
    });

    it('should handle deployment cancellation', async () => {
      const deploymentId = 'dep_123';
      
      mockExecuteWithRetry.mockResolvedValue({
        stdout: JSON.stringify({
          id: deploymentId,
          readyState: 'CANCELED'
        }),
        stderr: '',
        code: 0,
        duration: 1000
      });

      const result = await monitor.monitorDeployment(deploymentId, {
        pollInterval: 10,
        showProgress: false
      });

      expect(result.state).toBe('CANCELED');
    });

    it('should throw error on timeout', async () => {
      const deploymentId = 'dep_123';
      
      mockExecuteWithRetry.mockResolvedValue({
        stdout: JSON.stringify({
          id: deploymentId,
          readyState: 'BUILDING'
        }),
        stderr: '',
        code: 0,
        duration: 1000
      });

      await expect(
        monitor.monitorDeployment(deploymentId, {
          pollInterval: 10,
          timeout: 50,
          showProgress: false
        })
      ).rejects.toThrow(DeploymentError);
    });

    it('should throw error when VERCEL_TOKEN is missing', async () => {
      delete process.env.VERCEL_TOKEN;

      await expect(
        monitor.monitorDeployment('dep_123')
      ).rejects.toThrow('VERCEL_TOKEN is required for monitoring deployments');
    });
  });

  describe('extractDeploymentId', () => {
    it('should extract deployment ID from standard URL', () => {
      const url = 'https://my-app-abc123.vercel.app';
      const id = VercelMonitor.extractDeploymentId(url);
      expect(id).toBe('abc123');
    });

    it('should extract deployment ID from complex URL', () => {
      const url = 'https://my-app-git-feature-user-xyz789.vercel.app';
      const id = VercelMonitor.extractDeploymentId(url);
      expect(id).toBe('xyz789');
    });

    it('should return subdomain when no deployment ID found', () => {
      const url = 'https://my-app.vercel.app';
      const id = VercelMonitor.extractDeploymentId(url);
      expect(id).toBe('my-app');
    });
  });

  describe('getLatestDeployment', () => {
    it('should return the latest deployment for a project', async () => {
      const projectId = 'my-project';
      
      mockExecuteWithRetry.mockResolvedValue({
        stdout: JSON.stringify({
          deployments: [{
            uid: 'dep_123',
            state: 'READY',
            url: 'https://my-app.vercel.app',
            created: Date.now()
          }]
        }),
        stderr: '',
        code: 0,
        duration: 1000
      });

      const result = await monitor.getLatestDeployment(projectId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('dep_123');
      expect(result?.state).toBe('READY');
      expect(mockExecuteWithRetry).toHaveBeenCalledWith(
        'vercel',
        expect.arrayContaining(['ls', '--project', projectId]),
        expect.any(Object)
      );
    });

    it('should return null when no deployments found', async () => {
      const projectId = 'my-project';
      
      mockExecuteWithRetry.mockResolvedValue({
        stdout: JSON.stringify({ deployments: [] }),
        stderr: '',
        code: 0,
        duration: 1000
      });

      const result = await monitor.getLatestDeployment(projectId);
      expect(result).toBeNull();
    });
  });
});