export type Environment = 'development' | 'staging' | 'production';
export type Component = 'desktop' | 'mobile' | 'backend' | 'firebase' | 'all';

export interface DeploymentOptions {
  env: string;
  component: string;
  dryRun: boolean;
  monitor: boolean;
  rollback: boolean;
  verbose: boolean;
  quiet: boolean;
  firebaseProject?: string;
  cache: boolean;
  force: boolean;
  timeout: string;
}

export interface ProjectConfig {
  vercelProjectId: string;
  buildCommand: string;
  outputDirectory: string;
  domains?: string[];
}

export interface EnvironmentConfig {
  firebaseProject: string;
  desktopUrl: string;
  mobileUrl: string;
  backendUrl: string;
}

export interface DeploymentSettings {
  buildTimeout: number;
  deploymentTimeout: number;
  verificationTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  cacheVersion?: string;
  notifications: {
    enabled: boolean;
    slackWebhook?: string;
  };
}

export interface HealthCheck {
  endpoint: string;
  expectedStatus: number;
  timeout: number;
}

export interface DeployConfig {
  projects: {
    desktop: ProjectConfig;
    mobile: ProjectConfig;
    backend: ProjectConfig;
  };
  environments: {
    development: EnvironmentConfig;
    staging: EnvironmentConfig;
    production: EnvironmentConfig;
  };
  deploymentSettings: DeploymentSettings;
  healthChecks: {
    desktop: HealthCheck;
    mobile: HealthCheck;
    backend: HealthCheck;
  };
  verification?: VerificationConfig;
}

export interface DeploymentResult {
  success: boolean;
  component: Component;
  environment: Environment;
  deploymentId?: string;
  url?: string;
  duration?: number;
  error?: Error;
}

export interface DeploymentStatus {
  state: 'pending' | 'building' | 'deploying' | 'ready' | 'error' | 'cancelled';
  progress: number;
  message: string;
  startTime: Date;
  endTime?: Date;
}

export interface VerificationResult {
  success: boolean;
  component: Component;
  environment: Environment;
  checks: VerificationCheck[];
  duration: number;
  error?: Error;
}

export interface VerificationCheck {
  name: string;
  type: 'health' | 'ui' | 'api' | 'security' | 'performance' | 'cache' | 'integration';
  success: boolean;
  message: string;
  duration: number;
  metadata?: Record<string, any>;
  error?: Error;
}

export interface HealthCheckConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  expectedStatus: number;
  timeout: number;
  retries: number;
  headers?: Record<string, string>;
  body?: any;
  checkContent?: string | RegExp;
}

export interface UICheckConfig {
  url: string;
  selector?: string;
  waitFor?: string | number;
  screenshot?: boolean;
  checkText?: string;
  checkElement?: string;
  checkConsoleErrors?: boolean;
  timeout?: number;
}

export interface PerformanceCheckConfig {
  url: string;
  metrics: ('load' | 'fcp' | 'lcp' | 'cls' | 'fid')[];
  thresholds: Record<string, number>;
}

export interface SecurityCheckConfig {
  url: string;
  checks: ('https' | 'headers' | 'csp' | 'hsts' | 'xframe' | 'xss')[];
}

export interface CacheCheckConfig {
  url: string;
  cacheKey: string;
  expectedVersion: string;
}

export interface VerificationConfig {
  healthChecks: Partial<Record<Component, HealthCheckConfig>>;
  uiChecks: Partial<Record<Component, UICheckConfig>>;
  performanceChecks: Partial<Record<Component, PerformanceCheckConfig>>;
  securityChecks: Partial<Record<Component, SecurityCheckConfig>>;
  cacheChecks: Partial<Record<Component, CacheCheckConfig>>;
  integrationChecks: {
    crossComponentUrls: string[];
    apiEndpoints: string[];
  };
}