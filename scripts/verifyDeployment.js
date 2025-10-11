import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deployment Verification Script
 * Verifies that production deployment matches expected versions and configurations
 */

class DeploymentVerifier {
  constructor() {
    this.compatibilityPath = path.join(__dirname, '../shared/version-compatibility.json');
    this.versionPath = path.join(__dirname, '../shared/version.json');
    
    // Production URLs (update these as needed)
    this.urls = {
      frontend: 'https://sandyland-management-system.web.app',
      backend: 'https://backend-liart-seven.vercel.app'
    };
    
    this.results = {
      overall: 'unknown',
      frontend: null,
      backend: null,
      compatibility: null,
      issues: [],
      warnings: [],
      recommendations: []
    };
  }

  /**
   * Load compatibility matrix
   */
  loadCompatibilityMatrix() {
    try {
      const compatibilityData = JSON.parse(fs.readFileSync(this.compatibilityPath, 'utf8'));
      return compatibilityData;
    } catch (error) {
      console.error('❌ Could not load compatibility matrix:', error.message);
      return null;
    }
  }

  /**
   * Load expected version from shared version.json
   */
  loadExpectedVersion() {
    try {
      const versionData = JSON.parse(fs.readFileSync(this.versionPath, 'utf8'));
      return versionData;
    } catch (error) {
      console.error('❌ Could not load expected version:', error.message);
      return null;
    }
  }

  /**
   * Check frontend deployment
   */
  async checkFrontend() {
    console.log('🔍 Checking Frontend Deployment...');
    
    try {
      // Try to fetch version info from frontend
      const response = await fetch(`${this.urls.frontend}/version.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const versionData = await response.json();
      
      this.results.frontend = {
        url: this.urls.frontend,
        version: versionData.version,
        gitHash: versionData.git?.hash || 'unknown',
        buildDate: versionData.buildDate,
        environment: versionData.environment,
        status: 'healthy'
      };
      
      console.log(`✅ Frontend: v${versionData.version} (${versionData.git?.hash || 'unknown'})`);
      return true;
      
    } catch (error) {
      console.error(`❌ Frontend check failed:`, error.message);
      this.results.frontend = {
        url: this.urls.frontend,
        status: 'error',
        error: error.message
      };
      this.results.issues.push(`Frontend deployment check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check backend deployment
   */
  async checkBackend() {
    console.log('🔍 Checking Backend Deployment...');
    
    try {
      const response = await fetch(`${this.urls.backend}/api/version`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const versionData = await response.json();
      
      this.results.backend = {
        url: this.urls.backend,
        version: versionData.version,
        gitHash: versionData.git?.hash || 'unknown',
        buildDate: versionData.buildDate,
        environment: versionData.environment,
        deploymentId: versionData.deployment?.deploymentId || 'unknown',
        status: 'healthy'
      };
      
      console.log(`✅ Backend: v${versionData.version} (${versionData.git?.hash || 'unknown'})`);
      return true;
      
    } catch (error) {
      console.error(`❌ Backend check failed:`, error.message);
      this.results.backend = {
        url: this.urls.backend,
        status: 'error',
        error: error.message
      };
      this.results.issues.push(`Backend deployment check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check version compatibility
   */
  checkCompatibility() {
    console.log('🔍 Checking Version Compatibility...');
    
    const compatibility = this.loadCompatibilityMatrix();
    if (!compatibility) {
      this.results.issues.push('Could not load compatibility matrix');
      return false;
    }

    const frontend = this.results.frontend;
    const backend = this.results.backend;
    
    if (!frontend || !backend || frontend.status !== 'healthy' || backend.status !== 'healthy') {
      this.results.issues.push('Cannot check compatibility - frontend or backend check failed');
      return false;
    }

    // Check version compatibility
    const frontendVersion = frontend.version;
    const backendVersion = backend.version;
    
    // Parse versions
    const [feMajor, feMinor, fePatch] = frontendVersion.split('.').map(Number);
    const [beMajor, beMinor, bePatch] = backendVersion.split('.').map(Number);
    
    let compatible = true;
    let message = 'Versions are compatible';
    
    // Major version must match
    if (feMajor !== beMajor) {
      compatible = false;
      message = `Major version mismatch: Frontend v${frontendVersion} vs Backend v${backendVersion}`;
      this.results.issues.push(message);
    }
    // Minor version can differ by 1
    else if (Math.abs(feMinor - beMinor) > 1) {
      compatible = false;
      message = `Minor version gap too large: Frontend v${frontendVersion} vs Backend v${backendVersion}`;
      this.results.issues.push(message);
    }
    // Check git commit match for same version
    else if (frontendVersion === backendVersion && frontend.gitHash !== backend.gitHash) {
      compatible = false;
      message = `Same version but different git commits: Frontend (${frontend.gitHash}) vs Backend (${backend.gitHash})`;
      this.results.issues.push(message);
    }
    // Check build time difference
    else if (frontend.buildDate && backend.buildDate) {
      const frontendTime = new Date(frontend.buildDate).getTime();
      const backendTime = new Date(backend.buildDate).getTime();
      const timeDiff = Math.abs(frontendTime - backendTime);
      
      if (timeDiff > 300000) { // 5 minutes
        const minutes = Math.round(timeDiff / 60000);
        this.results.warnings.push(`Build times differ by ${minutes} minutes`);
        message = `Versions compatible but build times differ by ${minutes} minutes`;
      }
    }

    this.results.compatibility = {
      compatible,
      frontendVersion,
      backendVersion,
      gitMatch: frontend.gitHash === backend.gitHash,
      message
    };

    if (compatible) {
      console.log(`✅ Compatibility: ${message}`);
    } else {
      console.log(`❌ Compatibility: ${message}`);
    }

    return compatible;
  }

  /**
   * Check against expected version
   */
  checkExpectedVersion() {
    console.log('🔍 Checking Against Expected Version...');
    
    const expectedVersion = this.loadExpectedVersion();
    if (!expectedVersion) {
      this.results.warnings.push('Could not load expected version');
      return;
    }

    const frontend = this.results.frontend;
    const backend = this.results.backend;
    
    if (frontend && frontend.status === 'healthy') {
      if (frontend.version !== expectedVersion.version) {
        this.results.warnings.push(`Frontend version ${frontend.version} differs from expected ${expectedVersion.version}`);
      }
    }
    
    if (backend && backend.status === 'healthy') {
      if (backend.version !== expectedVersion.version) {
        this.results.warnings.push(`Backend version ${backend.version} differs from expected ${expectedVersion.version}`);
      }
    }
    
    console.log(`📋 Expected Version: v${expectedVersion.version}`);
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const frontend = this.results.frontend;
    const backend = this.results.backend;
    
    // If both are healthy and compatible
    if (frontend?.status === 'healthy' && backend?.status === 'healthy' && this.results.compatibility?.compatible) {
      this.results.recommendations.push('✅ Deployment is healthy and compatible');
      this.results.overall = 'success';
      return;
    }
    
    // If there are critical issues
    if (this.results.issues.length > 0) {
      this.results.recommendations.push('🚨 Critical issues detected - deployment may be unstable');
      this.results.recommendations.push('💡 Consider rolling back or fixing compatibility issues');
      this.results.overall = 'error';
      return;
    }
    
    // If there are warnings
    if (this.results.warnings.length > 0) {
      this.results.recommendations.push('⚠️ Warnings detected - monitor deployment closely');
      this.results.overall = 'warning';
      return;
    }
    
    this.results.overall = 'unknown';
  }

  /**
   * Print results summary
   */
  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 DEPLOYMENT VERIFICATION RESULTS');
    console.log('='.repeat(60));
    
    // Overall status
    const statusIcon = this.results.overall === 'success' ? '✅' : 
                      this.results.overall === 'warning' ? '⚠️' : 
                      this.results.overall === 'error' ? '❌' : '❓';
    console.log(`${statusIcon} Overall Status: ${this.results.overall.toUpperCase()}`);
    
    // Frontend status
    if (this.results.frontend) {
      const feIcon = this.results.frontend.status === 'healthy' ? '✅' : '❌';
      console.log(`${feIcon} Frontend: ${this.results.frontend.status} - ${this.results.frontend.url}`);
      if (this.results.frontend.version) {
        console.log(`   Version: v${this.results.frontend.version} (${this.results.frontend.gitHash})`);
      }
    }
    
    // Backend status
    if (this.results.backend) {
      const beIcon = this.results.backend.status === 'healthy' ? '✅' : '❌';
      console.log(`${beIcon} Backend: ${this.results.backend.status} - ${this.results.backend.url}`);
      if (this.results.backend.version) {
        console.log(`   Version: v${this.results.backend.version} (${this.results.backend.gitHash})`);
      }
    }
    
    // Compatibility status
    if (this.results.compatibility) {
      const compIcon = this.results.compatibility.compatible ? '✅' : '❌';
      console.log(`${compIcon} Compatibility: ${this.results.compatibility.message}`);
    }
    
    // Issues
    if (this.results.issues.length > 0) {
      console.log('\n❌ ISSUES:');
      this.results.issues.forEach(issue => console.log(`   • ${issue}`));
    }
    
    // Warnings
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      this.results.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    // Recommendations
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.results.recommendations.forEach(rec => console.log(`   ${rec}`));
    }
    
    console.log('='.repeat(60));
  }

  /**
   * Run full verification
   */
  async verify() {
    console.log('🚀 Starting Deployment Verification...\n');
    
    try {
      // Check deployments
      const frontendOk = await this.checkFrontend();
      const backendOk = await this.checkBackend();
      
      // Check compatibility if both are healthy
      if (frontendOk && backendOk) {
        this.checkCompatibility();
      }
      
      // Check against expected version
      this.checkExpectedVersion();
      
      // Generate recommendations
      this.generateRecommendations();
      
      // Print results
      this.printResults();
      
      // Exit with appropriate code
      if (this.results.overall === 'error') {
        process.exit(1);
      } else if (this.results.overall === 'warning') {
        process.exit(2);
      } else {
        process.exit(0);
      }
      
    } catch (error) {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    }
  }
}

// Run verification if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new DeploymentVerifier();
  verifier.verify();
}

export { DeploymentVerifier };
