import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Enhanced version update with Git integration and environment detection
 */
class VersionManager {
  constructor() {
    this.versionPath = path.join(__dirname, '../shared/version.json');
    this.packagePaths = [
      path.join(__dirname, '../frontend/sams-ui/package.json'),
      path.join(__dirname, '../frontend/mobile-app/package.json')
    ];
  }

  /**
   * Get Git information for build tracking
   */
  getGitInfo() {
    try {
      const gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      const gitDate = execSync('git log -1 --format=%cd --date=iso', { encoding: 'utf8' }).trim();
      
      return {
        hash: gitHash,
        branch: gitBranch,
        lastCommitDate: gitDate
      };
    } catch (error) {
      console.warn('⚠️  Git information not available:', error.message);
      return {
        hash: 'unknown',
        branch: 'unknown',
        lastCommitDate: null
      };
    }
  }

  /**
   * Detect deployment environment with enhanced logic
   */
  detectEnvironment() {
    // Check explicit environment variable first
    if (process.env.REACT_APP_ENVIRONMENT) {
      return process.env.REACT_APP_ENVIRONMENT;
    }

    // Check NODE_ENV
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    // Check for CI/CD environment variables
    if (process.env.VERCEL_ENV) {
      switch (process.env.VERCEL_ENV) {
        case 'production': return 'production';
        case 'preview': return 'staging';
        default: return 'development';
      }
    }

    // Check for other common CI environments
    if (process.env.CI) {
      if (process.env.GITHUB_REF === 'refs/heads/main') return 'production';
      if (process.env.GITHUB_REF === 'refs/heads/staging') return 'staging';
      return 'staging'; // Default for CI environments
    }

    return nodeEnv;
  }

  /**
   * Get package.json version from main package
   */
  getPackageVersion() {
    try {
      const mainPackage = JSON.parse(fs.readFileSync(this.packagePaths[0], 'utf8'));
      return mainPackage.version || '1.0.0';
    } catch (error) {
      console.warn('⚠️  Could not read package version:', error.message);
      return '1.0.0';
    }
  }

  /**
   * Update version configuration with comprehensive information
   */
  updateVersion(options = {}) {
    try {
      // Read current version configuration
      let versionConfig;
      try {
        versionConfig = JSON.parse(fs.readFileSync(this.versionPath, 'utf8'));
      } catch (error) {
        console.log('📝 Creating default version configuration...');
        versionConfig = this.getDefaultConfig();
      }

      // Get Git and environment information
      const gitInfo = this.getGitInfo();
      const environment = this.detectEnvironment();
      const packageVersion = this.getPackageVersion();
      
      // Update build-specific information
      const buildTimestamp = new Date().toISOString();
      
      // Enhanced version configuration
      const updatedConfig = {
        ...versionConfig,
        version: options.version || packageVersion,
        buildDate: buildTimestamp,
        buildTimestamp: Date.now(),
        environment: environment,
        git: gitInfo,
        build: {
          timestamp: buildTimestamp,
          environment: environment,
          nodeVersion: process.version,
          platform: process.platform,
          buildNumber: this.generateBuildNumber(buildTimestamp)
        },
        deployment: {
          target: environment,
          date: buildTimestamp,
          automated: true
        }
      };

      // Write updated configuration
      fs.writeFileSync(this.versionPath, JSON.stringify(updatedConfig, null, 2));
      
      // Copy version file to frontend directories
      this.copyVersionToFrontends(updatedConfig);
      
      // Log build information
      this.logBuildInfo(updatedConfig);
      
      return updatedConfig;
      
    } catch (error) {
      console.error('❌ Error updating version:', error);
      process.exit(1);
    }
  }

  /**
   * Generate build number from timestamp
   */
  generateBuildNumber(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}${month}${day}.${hour}${minute}`;
  }

  /**
   * Copy version.json to frontend directories
   */
  copyVersionToFrontends(versionConfig) {
    const frontendPaths = [
      path.join(__dirname, '../frontend/sams-ui/version.json'),
      path.join(__dirname, '../frontend/sams-ui/public/version.json'), // PUBLIC FOLDER - gets copied to dist!
      path.join(__dirname, '../frontend/mobile-app/version.json')
    ];

    frontendPaths.forEach(frontendPath => {
      try {
        // Ensure directory exists
        const dir = path.dirname(frontendPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Copy version file
        fs.writeFileSync(frontendPath, JSON.stringify(versionConfig, null, 2));
        console.log(`📋 Copied version.json to ${path.basename(path.dirname(frontendPath))}`);
      } catch (error) {
        console.warn(`⚠️  Could not copy version.json to ${frontendPath}:`, error.message);
      }
    });
  }

  /**
   * Get default version configuration
   */
  getDefaultConfig() {
    return {
      version: "1.0.0",
      appName: "Sandyland Asset Management System",
      shortName: "SAMS",
      companyName: "Sandyland Management",
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
  }

  /**
   * Log comprehensive build information
   */
  logBuildInfo(config) {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 BUILD INFORMATION');
    console.log('='.repeat(60));
    console.log(`📦 Version: ${config.version}`);
    console.log(`🌍 Environment: ${config.environment}`);
    console.log(`📅 Build Date: ${new Date(config.buildDate).toLocaleString()}`);
    console.log(`🔢 Build Number: ${config.build.buildNumber}`);
    console.log(`🌿 Git Branch: ${config.git.branch}`);
    console.log(`📝 Git Hash: ${config.git.hash}`);
    console.log(`💻 Node Version: ${config.build.nodeVersion}`);
    console.log(`🖥️  Platform: ${config.build.platform}`);
    console.log('='.repeat(60));
  }

  /**
   * Set version to a specific value
   */
  setVersion(newVersion) {
    try {
      // Validate version format
      if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
        console.error('❌ Invalid version format. Use semantic versioning: X.Y.Z (e.g., 0.0.10)');
        process.exit(1);
      }

      // Update package.json files
      this.updatePackageVersions(newVersion);
      
      // Update version config
      this.updateVersion({ version: newVersion });
      
      console.log(`✅ Version manually set to ${newVersion}`);
      console.log('📝 Remember to commit these changes!\n');
      return newVersion;
      
    } catch (error) {
      console.error('❌ Error setting version:', error);
      process.exit(1);
    }
  }

  /**
   * Bump version (patch, minor, or major)
   */
  bumpVersion(type = 'patch') {
    try {
      // Read current version
      const config = JSON.parse(fs.readFileSync(this.versionPath, 'utf8'));
      const currentVersion = config.version || '1.0.0';
      
      // Parse version
      const [major, minor, patch] = currentVersion.split('.').map(Number);
      
      // Calculate new version
      let newVersion;
      switch (type) {
        case 'major':
          newVersion = `${major + 1}.0.0`;
          break;
        case 'minor':
          newVersion = `${major}.${minor + 1}.0`;
          break;
        case 'patch':
        default:
          newVersion = `${major}.${minor}.${patch + 1}`;
          break;
      }
      
      // Update package.json files
      this.updatePackageVersions(newVersion);
      
      // Update version config
      this.updateVersion({ version: newVersion });
      
      console.log(`✅ Version bumped: ${currentVersion} → ${newVersion}`);
      return newVersion;
      
    } catch (error) {
      console.error('❌ Error bumping version:', error);
      process.exit(1);
    }
  }

  /**
   * Update package.json versions
   */
  updatePackageVersions(newVersion) {
    this.packagePaths.forEach(packagePath => {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        packageJson.version = newVersion;
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
        console.log(`📝 Updated ${path.basename(path.dirname(packagePath))} package.json`);
      } catch (error) {
        console.warn(`⚠️  Could not update ${packagePath}:`, error.message);
      }
    });
  }

  /**
   * Validate deployment environment
   */
  validateDeployment() {
    try {
      const config = JSON.parse(fs.readFileSync(this.versionPath, 'utf8'));
      
      console.log('\n🔍 DEPLOYMENT VALIDATION');
      console.log('='.repeat(40));
      console.log(`Version: ${config.version}`);
      console.log(`Environment: ${config.environment}`);
      console.log(`Build Date: ${config.buildDate}`);
      console.log(`Git Hash: ${config.git?.hash || 'N/A'}`);
      console.log('='.repeat(40));
      
      // Validation checks
      const checks = [
        { name: 'Version Format', pass: /^\d+\.\d+\.\d+$/.test(config.version) },
        { name: 'Environment Set', pass: !!config.environment },
        { name: 'Build Date Recent', pass: (Date.now() - new Date(config.buildDate)) < 300000 }, // 5 minutes
        { name: 'Git Information', pass: !!config.git?.hash }
      ];
      
      let allPassed = true;
      checks.forEach(check => {
        const status = check.pass ? '✅' : '❌';
        console.log(`${status} ${check.name}`);
        if (!check.pass) allPassed = false;
      });
      
      if (allPassed) {
        console.log('\n🎉 Deployment validation passed!');
      } else {
        console.log('\n⚠️  Deployment validation failed!');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Validation error:', error);
      process.exit(1);
    }
  }
}

// CLI Interface
const versionManager = new VersionManager();

const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'update':
    versionManager.updateVersion();
    break;
  case 'bump':
    versionManager.bumpVersion(arg || 'patch');
    break;
  case 'set':
    if (!arg) {
      console.error('❌ Please provide a version number: node updateVersion.js set X.Y.Z');
      process.exit(1);
    }
    versionManager.setVersion(arg);
    break;
  case 'validate':
    versionManager.validateDeployment();
    break;
  default:
    versionManager.updateVersion();
    break;
}

// Legacy export for backward compatibility
const updateVersion = () => versionManager.updateVersion();

export { VersionManager, updateVersion };