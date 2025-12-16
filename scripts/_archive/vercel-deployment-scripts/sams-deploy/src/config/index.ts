import { z } from 'zod';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { DeployConfig, Environment } from '../types';
import { DeploymentError } from '../utils/error-handler';
import { logger } from '../utils/logger';

// Zod schema for configuration validation
const ProjectConfigSchema = z.object({
  vercelProjectId: z.string(),
  buildCommand: z.string(),
  outputDirectory: z.string(),
  domains: z.array(z.string()).optional()
});

const EnvironmentConfigSchema = z.object({
  firebaseProject: z.string(),
  desktopUrl: z.string().url(),
  mobileUrl: z.string().url(),
  backendUrl: z.string().url()
});

const DeploymentSettingsSchema = z.object({
  buildTimeout: z.number().positive(),
  deploymentTimeout: z.number().positive(),
  verificationTimeout: z.number().positive(),
  retryAttempts: z.number().int().nonnegative(),
  retryDelay: z.number().positive(),
  notifications: z.object({
    enabled: z.boolean(),
    slackWebhook: z.string().url().optional()
  })
});

const HealthCheckSchema = z.object({
  endpoint: z.string(),
  expectedStatus: z.number().int().positive(),
  timeout: z.number().positive()
});

const HealthCheckConfigSchema = z.object({
  endpoint: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'HEAD']).default('GET'),
  expectedStatus: z.number().int().positive().default(200),
  timeout: z.number().positive().default(30000),
  retries: z.number().int().nonnegative().default(3),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  checkContent: z.union([z.string(), z.instanceof(RegExp)]).optional()
});

const UICheckConfigSchema = z.object({
  url: z.string().url(),
  selector: z.string().optional(),
  waitFor: z.union([z.string(), z.number()]).optional(),
  screenshot: z.boolean().default(false),
  checkText: z.string().optional(),
  checkElement: z.string().optional(),
  checkConsoleErrors: z.boolean().default(true),
  timeout: z.number().positive().default(30000)
});

const PerformanceCheckConfigSchema = z.object({
  url: z.string().url(),
  metrics: z.array(z.enum(['load', 'fcp', 'lcp', 'cls', 'fid'])).default(['load']),
  thresholds: z.record(z.number()).default({ load: 5000 })
});

const SecurityCheckConfigSchema = z.object({
  url: z.string().url(),
  checks: z.array(z.enum(['https', 'headers', 'csp', 'hsts', 'xframe', 'xss'])).default(['https', 'headers'])
});

const CacheCheckConfigSchema = z.object({
  url: z.string().url(),
  cacheKey: z.string(),
  expectedVersion: z.string()
});

const VerificationConfigSchema = z.object({
  healthChecks: z.record(z.enum(['desktop', 'mobile', 'backend', 'firebase']), HealthCheckConfigSchema).default({}),
  uiChecks: z.record(z.enum(['desktop', 'mobile', 'backend', 'firebase']), UICheckConfigSchema).default({}),
  performanceChecks: z.record(z.enum(['desktop', 'mobile', 'backend', 'firebase']), PerformanceCheckConfigSchema).default({}),
  securityChecks: z.record(z.enum(['desktop', 'mobile', 'backend', 'firebase']), SecurityCheckConfigSchema).default({}),
  cacheChecks: z.record(z.enum(['desktop', 'mobile', 'backend', 'firebase']), CacheCheckConfigSchema).default({}),
  integrationChecks: z.object({
    crossComponentUrls: z.array(z.string().url()).default([]),
    apiEndpoints: z.array(z.string().url()).default([])
  }).default({ crossComponentUrls: [], apiEndpoints: [] })
}).optional();

const DeployConfigSchema = z.object({
  projects: z.object({
    desktop: ProjectConfigSchema,
    mobile: ProjectConfigSchema,
    backend: ProjectConfigSchema
  }),
  environments: z.object({
    development: EnvironmentConfigSchema,
    staging: EnvironmentConfigSchema,
    production: EnvironmentConfigSchema
  }),
  deploymentSettings: DeploymentSettingsSchema,
  healthChecks: z.object({
    desktop: HealthCheckSchema,
    mobile: HealthCheckSchema,
    backend: HealthCheckSchema
  }),
  verification: VerificationConfigSchema
});

let cachedConfig: DeployConfig | null = null;

export async function loadConfiguration(): Promise<DeployConfig> {
  if (cachedConfig) {
    logger.debug('Using cached configuration');
    return cachedConfig;
  }

  try {
    // Try multiple locations for the config file
    const possiblePaths = [
      resolve(process.cwd(), 'scripts', 'deploy-config.json'),
      resolve(process.cwd(), 'deploy-config.json'),
      resolve(__dirname, '..', '..', '..', 'deploy-config.json')
    ];

    let configPath: string | null = null;
    let configData: string | null = null;

    for (const path of possiblePaths) {
      try {
        logger.debug(`Checking for config at: ${path}`);
        configData = await readFile(path, 'utf-8');
        configPath = path;
        break;
      } catch (error) {
        // Continue to next path
      }
    }

    if (!configData || !configPath) {
      throw new DeploymentError(
        'Configuration file not found',
        'CONFIG_NOT_FOUND',
        { searchedPaths: possiblePaths }
      );
    }

    logger.debug(`Configuration loaded from: ${configPath}`);

    // Parse JSON
    let rawConfig: any;
    try {
      rawConfig = JSON.parse(configData);
    } catch (error) {
      throw new DeploymentError(
        'Invalid JSON in configuration file',
        'CONFIG_INVALID',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    // Validate with Zod
    const result = DeployConfigSchema.safeParse(rawConfig);
    if (!result.success) {
      throw new DeploymentError(
        'Configuration validation failed',
        'CONFIG_INVALID',
        { errors: result.error.format() }
      );
    }

    cachedConfig = result.data;
    logger.debug('Configuration validated successfully');

    return cachedConfig;
  } catch (error) {
    if (error instanceof DeploymentError) {
      throw error;
    }
    throw new DeploymentError(
      'Failed to load configuration',
      'CONFIG_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

export function validateEnvironment(env: string): Environment {
  const normalizedEnv = env.toLowerCase();
  
  // Handle aliases
  const envMap: Record<string, Environment> = {
    'dev': 'development',
    'development': 'development',
    'staging': 'staging',
    'prod': 'production',
    'production': 'production'
  };

  const validEnv = envMap[normalizedEnv];
  if (!validEnv) {
    throw new DeploymentError(
      `Invalid environment: ${env}`,
      'ENV_INVALID',
      { provided: env, valid: Object.keys(envMap) }
    );
  }

  return validEnv;
}

export function getEnvironmentConfig(config: DeployConfig, environment: Environment) {
  return config.environments[environment];
}

export function getProjectConfig(config: DeployConfig, component: 'desktop' | 'mobile' | 'backend') {
  return config.projects[component];
}

export async function loadEnvironmentVariables(environment: Environment): Promise<void> {
  try {
    const { config } = await import('dotenv');
    
    // Load base .env file
    config({ path: '.env' });
    
    // Load environment-specific .env file
    config({ path: `.env.${environment}`, override: true });
    
    logger.debug(`Environment variables loaded for ${environment}`);
  } catch (error) {
    logger.warn('Failed to load environment variables from .env files');
  }
}

export function validateRequiredEnvironmentVariables(required: string[]): void {
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new DeploymentError(
      'Missing required environment variables',
      'ENV_VARS_MISSING',
      { missing }
    );
  }
}