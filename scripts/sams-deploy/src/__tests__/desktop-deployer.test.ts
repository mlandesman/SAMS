import { DesktopDeployer } from '../deployers/desktop';
import { DeployConfig, Environment, DeploymentOptions } from '../types';
import * as path from 'path';

describe('DesktopDeployer', () => {
  const mockConfig: DeployConfig = {
    projects: {
      desktop: {
        vercelProjectId: 'prj_7fOoszBOVxj0e3FaCrCVvctRP3CT',
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
        domains: ['sams.sandyland.com.mx']
      },
      mobile: {
        vercelProjectId: 'prj_mobile',
        buildCommand: 'npm run build',
        outputDirectory: 'dist'
      },
      backend: {
        vercelProjectId: 'prj_backend',
        buildCommand: 'npm run build',
        outputDirectory: 'dist'
      }
    },
    environments: {
      development: {
        firebaseProject: 'sams-dev',
        desktopUrl: 'https://sams-dev.vercel.app',
        mobileUrl: 'https://mobile-sams-dev.vercel.app',
        backendUrl: 'https://backend-sams-dev.vercel.app'
      },
      staging: {
        firebaseProject: 'sams-staging',
        desktopUrl: 'https://sams-staging.vercel.app',
        mobileUrl: 'https://mobile-sams-staging.vercel.app',
        backendUrl: 'https://backend-sams-staging.vercel.app'
      },
      production: {
        firebaseProject: 'sams-production',
        desktopUrl: 'https://sams.sandyland.com.mx',
        mobileUrl: 'https://mobile.sams.sandyland.com.mx',
        backendUrl: 'https://api.sams.sandyland.com.mx'
      }
    },
    deploymentSettings: {
      buildTimeout: 300000,
      deploymentTimeout: 600000,
      verificationTimeout: 60000,
      retryAttempts: 3,
      retryDelay: 5000,
      cacheVersion: '4.0.0',
      notifications: {
        enabled: false
      }
    },
    healthChecks: {
      desktop: {
        endpoint: '/',
        expectedStatus: 200,
        timeout: 30000
      },
      mobile: {
        endpoint: '/',
        expectedStatus: 200,
        timeout: 30000
      },
      backend: {
        endpoint: '/health',
        expectedStatus: 200,
        timeout: 30000
      }
    }
  };

  const mockOptions: DeploymentOptions = {
    env: 'development',
    component: 'desktop',
    dryRun: false,
    monitor: false,
    rollback: false,
    verbose: false,
    quiet: false,
    cache: true,
    force: false,
    timeout: '10m'
  };

  it('should create a DesktopDeployer instance', () => {
    const deployer = new DesktopDeployer({
      component: 'desktop',
      environment: 'development' as Environment,
      config: mockConfig,
      options: mockOptions
    });

    expect(deployer).toBeDefined();
    expect(deployer).toBeInstanceOf(DesktopDeployer);
  });

  it('should have correct Vercel project ID', () => {
    const deployer = new DesktopDeployer({
      component: 'desktop',
      environment: 'development' as Environment,
      config: mockConfig,
      options: mockOptions
    });

    // Access private property for testing
    expect((deployer as any).VERCEL_PROJECT_ID).toBe('prj_7fOoszBOVxj0e3FaCrCVvctRP3CT');
  });

  it('should have correct production domain', () => {
    const deployer = new DesktopDeployer({
      component: 'desktop',
      environment: 'production' as Environment,
      config: mockConfig,
      options: mockOptions
    });

    // Access private property for testing
    expect((deployer as any).PRODUCTION_DOMAIN).toBe('sams.sandyland.com.mx');
  });

  it('should set correct project paths', () => {
    const deployer = new DesktopDeployer({
      component: 'desktop',
      environment: 'development' as Environment,
      config: mockConfig,
      options: mockOptions
    });

    // Access private properties for testing
    const projectPath = (deployer as any).projectPath;
    const sharedComponentsPath = (deployer as any).sharedComponentsPath;

    expect(projectPath).toContain(path.join('frontend', 'sams-ui'));
    expect(sharedComponentsPath).toContain(path.join('frontend', 'shared-components'));
  });
});