#!/usr/bin/env node

import fetch from 'node-fetch';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SAMS Deployment Version Checker
 * Verifies that all deployed components are running the same version
 */

const ENDPOINTS = {
  production: {
    backend: 'https://backend-liart-seven.vercel.app/api/version',
    desktop: 'https://sams.sandyland.com.mx',
    mobile: 'https://mobile.sams.sandyland.com.mx'
  },
  staging: {
    backend: 'https://backend-staging.vercel.app/api/version',
    desktop: 'https://sams-staging.vercel.app',
    mobile: 'https://sams-mobile-staging.vercel.app'
  }
};

/**
 * Fetch version info from a URL
 */
async function fetchVersion(url, component) {
  try {
    console.log(chalk.gray(`Checking ${component} at ${url}...`));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      component,
      url,
      success: true,
      version: data.version || 'unknown',
      gitCommit: data.git?.hash || data.gitCommit || 'unknown',
      buildDate: data.buildDate || data.build?.timestamp || 'unknown',
      data
    };
  } catch (error) {
    return {
      component,
      url,
      success: false,
      error: error.message
    };
  }
}

/**
 * Read local version file
 */
async function getLocalVersion() {
  try {
    const versionPath = path.join(__dirname, '../shared/version.json');
    const versionData = await fs.readFile(versionPath, 'utf8');
    const version = JSON.parse(versionData);
    
    return {
      component: 'local',
      success: true,
      version: version.version,
      gitCommit: version.git?.hash || 'unknown',
      buildDate: version.buildDate,
      data: version
    };
  } catch (error) {
    return {
      component: 'local',
      success: false,
      error: error.message
    };
  }
}

/**
 * Check versions for an environment
 */
async function checkEnvironment(env) {
  console.log(chalk.blue.bold(`\nChecking ${env.toUpperCase()} environment:`));
  console.log(chalk.gray('=' .repeat(50)));

  const endpoints = ENDPOINTS[env];
  const results = [];

  // Check backend
  results.push(await fetchVersion(endpoints.backend, 'backend'));

  // Check desktop (would need version endpoint in frontend)
  // For now, we'll just check if it's accessible
  results.push(await fetchVersion(endpoints.desktop + '/api/version', 'desktop'));
  
  // Check mobile (would need version endpoint in frontend)
  results.push(await fetchVersion(endpoints.mobile + '/api/version', 'mobile'));

  return results;
}

/**
 * Analyze results and report
 */
function analyzeResults(results, localVersion) {
  console.log(chalk.blue.bold('\nVersion Analysis:'));
  console.log(chalk.gray('=' .repeat(50)));

  // Display local version
  if (localVersion.success) {
    console.log(chalk.cyan('Local Repository:'));
    console.log(`  Version: ${chalk.white(localVersion.version)}`);
    console.log(`  Git Commit: ${chalk.white(localVersion.gitCommit)}`);
    console.log(`  Build Date: ${chalk.white(localVersion.buildDate)}`);
  }

  // Group by environment
  const environments = {
    production: results.filter(r => r.url?.includes('sandyland.com.mx') || r.url?.includes('backend-liart')),
    staging: results.filter(r => r.url?.includes('staging'))
  };

  Object.entries(environments).forEach(([env, envResults]) => {
    if (envResults.length === 0) return;

    console.log(chalk.cyan(`\n${env.toUpperCase()} Environment:`));
    
    const successfulResults = envResults.filter(r => r.success);
    const failedResults = envResults.filter(r => !r.success);

    // Show successful checks
    successfulResults.forEach(result => {
      console.log(chalk.green(`✓ ${result.component}:`));
      console.log(`  Version: ${chalk.white(result.version)}`);
      console.log(`  Git Commit: ${chalk.white(result.gitCommit)}`);
      console.log(`  Build Date: ${chalk.white(result.buildDate)}`);
    });

    // Show failed checks
    failedResults.forEach(result => {
      console.log(chalk.red(`✗ ${result.component}: ${result.error}`));
    });

    // Check for version mismatches
    if (successfulResults.length > 1) {
      const gitCommits = [...new Set(successfulResults.map(r => r.gitCommit))];
      const versions = [...new Set(successfulResults.map(r => r.version))];

      if (gitCommits.length > 1 || versions.length > 1) {
        console.log(chalk.yellow.bold('\n⚠️  VERSION MISMATCH DETECTED!'));
        console.log(chalk.yellow('Different versions are deployed:'));
        successfulResults.forEach(r => {
          console.log(chalk.yellow(`  ${r.component}: ${r.gitCommit} (${r.version})`));
        });
      } else {
        console.log(chalk.green.bold('\n✓ All components are in sync'));
      }
    }
  });
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.blue.bold('SAMS Deployment Version Checker'));
  console.log(chalk.gray('Checking version consistency across all deployments...\n'));

  const args = process.argv.slice(2);
  const environment = args[0] || 'all';

  try {
    // Get local version
    const localVersion = await getLocalVersion();
    
    const allResults = [];

    if (environment === 'all' || environment === 'production') {
      const prodResults = await checkEnvironment('production');
      allResults.push(...prodResults);
    }

    if (environment === 'all' || environment === 'staging') {
      const stagingResults = await checkEnvironment('staging');
      allResults.push(...stagingResults);
    }

    // Analyze and report
    analyzeResults(allResults, localVersion);

    // Check if local is ahead of production
    if (localVersion.success) {
      const prodBackend = allResults.find(r => r.component === 'backend' && r.url?.includes('backend-liart'));
      if (prodBackend?.success && prodBackend.gitCommit !== localVersion.gitCommit) {
        console.log(chalk.yellow.bold('\n⚠️  Local repository is not in sync with production!'));
        console.log(chalk.yellow(`Local: ${localVersion.gitCommit}`));
        console.log(chalk.yellow(`Production: ${prodBackend.gitCommit}`));
      }
    }

  } catch (error) {
    console.error(chalk.red('Error checking versions:'), error);
    process.exit(1);
  }
}

// Run the checker
main().catch(console.error);