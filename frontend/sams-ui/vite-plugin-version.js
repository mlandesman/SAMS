import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Vite plugin for injecting version information at build time
 * This replaces the need for version.json files at runtime
 */
export default function vitePluginVersion(options = {}) {
  let versionData = null;

  // Get Git information (works in both local and CI/CD)
  const getGitInfo = () => {
    try {
      // Check for Vercel environment variables first (CI/CD)
      if (process.env.VERCEL_GIT_COMMIT_SHA) {
        return {
          hash: process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7),
          fullHash: process.env.VERCEL_GIT_COMMIT_SHA,
          branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
          lastCommitDate: process.env.VERCEL_GIT_COMMIT_DATE || null
        };
      }

      // Fallback to local git commands
      const gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      const gitDate = execSync('git log -1 --format=%cd --date=iso', { encoding: 'utf8' }).trim();
      
      return {
        hash: gitHash,
        fullHash: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
        branch: gitBranch,
        lastCommitDate: gitDate
      };
    } catch (error) {
      console.warn('⚠️  Git information not available:', error.message);
      return {
        hash: 'unknown',
        fullHash: 'unknown',
        branch: 'unknown',
        lastCommitDate: null
      };
    }
  };

  // Get package.json version
  const getPackageVersion = () => {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
      return packageJson.version || '1.0.0';
    } catch (error) {
      console.warn('⚠️  Could not read package version:', error.message);
      return '1.0.0';
    }
  };

  // Detect environment
  const detectEnvironment = () => {
    // Vercel provides VERCEL_ENV
    if (process.env.VERCEL_ENV) {
      switch (process.env.VERCEL_ENV) {
        case 'production': return 'production';
        case 'preview': return 'staging';
        default: return 'development';
      }
    }

    // Check for explicit environment variable
    if (process.env.REACT_APP_ENVIRONMENT) {
      return process.env.REACT_APP_ENVIRONMENT;
    }

    // Check NODE_ENV
    return process.env.NODE_ENV || 'development';
  };

  // Generate build number from timestamp
  const generateBuildNumber = (timestamp) => {
    const date = new Date(timestamp);
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}${month}${day}.${hour}${minute}`;
  };

  return {
    name: 'vite-plugin-version',
    configResolved(config) {
      // Generate version data once during config resolution
      const buildTimestamp = new Date().toISOString();
      const gitInfo = getGitInfo();
      const environment = detectEnvironment();
      const packageVersion = getPackageVersion();

      versionData = {
        // Core version info
        version: packageVersion,
        buildDate: buildTimestamp,
        buildTimestamp: Date.now(),
        environment: environment,
        
        // Git information
        git: gitInfo,
        
        // Build metadata
        build: {
          timestamp: buildTimestamp,
          environment: environment,
          nodeVersion: process.version,
          platform: process.platform,
          buildNumber: generateBuildNumber(buildTimestamp)
        },

        // Deployment info
        deployment: {
          target: environment,
          date: buildTimestamp,
          automated: true,
          vercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID || null
        },

        // App metadata
        appName: "SAMS",
        shortName: "SAMS",
        companyName: "Sandyland Properties",
        copyright: "2025",
        developers: ["Michael Landesman", "Claude AI"],
        features: [
          "PWA Support",
          "Multi-Client Management", 
          "Financial Reporting",
          "Document Storage",
          "Unit Management"
        ],
        description: "Comprehensive property management system for condominiums and HOAs"
      };

      console.log('\n🚀 VERSION INJECTION PLUGIN');
      console.log('='.repeat(40));
      console.log(`📦 Version: ${versionData.version}`);
      console.log(`🌍 Environment: ${versionData.environment}`);
      console.log(`📅 Build Date: ${new Date(versionData.buildDate).toLocaleString()}`);
      console.log(`🔢 Build Number: ${versionData.build.buildNumber}`);
      console.log(`🌿 Git Branch: ${versionData.git.branch}`);
      console.log(`📝 Git Hash: ${versionData.git.hash}`);
      console.log(`💻 Node Version: ${versionData.build.nodeVersion}`);
      console.log('='.repeat(40));
    },
    transformIndexHtml(html) {
      // Inject build metadata into HTML comment
      const buildComment = `<!-- SAMS v${versionData.version} | Build: ${versionData.buildDate} | Commit: ${versionData.git.hash} | Environment: ${versionData.environment}${versionData.deployment.vercelDeploymentId ? ` | Vercel: ${versionData.deployment.vercelDeploymentId}` : ''} -->`;
      
      return html.replace('<head>', `<head>\n  ${buildComment}`);
    },
    generateBundle() {
      // Make version data available as environment variables for the app
      // This is injected into the bundle at build time
      return {
        'import.meta.env.VITE_VERSION': JSON.stringify(versionData.version),
        'import.meta.env.VITE_VERSION_FULL': JSON.stringify(versionData),
        'import.meta.env.VITE_BUILD_DATE': JSON.stringify(versionData.buildDate),
        'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(versionData.buildTimestamp),
        'import.meta.env.VITE_ENVIRONMENT': JSON.stringify(versionData.environment),
        'import.meta.env.VITE_GIT_HASH': JSON.stringify(versionData.git.hash),
        'import.meta.env.VITE_GIT_FULL_HASH': JSON.stringify(versionData.git.fullHash),
        'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(versionData.git.branch),
        'import.meta.env.VITE_GIT_COMMIT_DATE': JSON.stringify(versionData.git.lastCommitDate),
        'import.meta.env.VITE_BUILD_NUMBER': JSON.stringify(versionData.build.buildNumber),
        'import.meta.env.VITE_NODE_VERSION': JSON.stringify(versionData.build.nodeVersion),
        'import.meta.env.VITE_PLATFORM': JSON.stringify(versionData.build.platform),
        'import.meta.env.VITE_VERCEL_DEPLOYMENT_ID': JSON.stringify(versionData.deployment.vercelDeploymentId),
        'import.meta.env.VITE_APP_NAME': JSON.stringify(versionData.appName),
        'import.meta.env.VITE_APP_SHORT_NAME': JSON.stringify(versionData.shortName),
        'import.meta.env.VITE_COMPANY_NAME': JSON.stringify(versionData.companyName),
        'import.meta.env.VITE_COPYRIGHT': JSON.stringify(versionData.copyright),
        'import.meta.env.VITE_DEVELOPERS': JSON.stringify(versionData.developers),
        'import.meta.env.VITE_FEATURES': JSON.stringify(versionData.features),
        'import.meta.env.VITE_APP_DESCRIPTION': JSON.stringify(versionData.description)
      };
    }
  };
}
