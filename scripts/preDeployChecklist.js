import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Pre-Deployment Checklist Script
 * Verifies readiness before pushing to production
 */

class PreDeployChecklist {
  constructor() {
    this.checks = [];
    this.warnings = [];
    this.errors = [];
    this.versionPath = path.join(__dirname, '../shared/version.json');
  }

  /**
   * Run all pre-deployment checks
   */
  async run() {
    console.log('🚀 SAMS Pre-Deployment Checklist');
    console.log('='.repeat(50));

    try {
      // Run all checks
      await this.checkGitStatus();
      await this.checkVersionFiles();
      await this.checkPackageJsonSync();
      await this.checkBuildCommands();
      await this.checkCompatibilityMatrix();
      await this.generateDeploymentNotes();

      // Print results
      this.printResults();

      // Exit with appropriate code
      if (this.errors.length > 0) {
        console.log('\n❌ DEPLOYMENT BLOCKED - Fix errors above before deploying');
        process.exit(1);
      } else if (this.warnings.length > 0) {
        console.log('\n⚠️ DEPLOYMENT WARNINGS - Review warnings above');
        process.exit(2);
      } else {
        console.log('\n✅ READY FOR DEPLOYMENT - All checks passed');
        process.exit(0);
      }

    } catch (error) {
      console.error('❌ Checklist failed:', error);
      process.exit(1);
    }
  }

  /**
   * Check git status
   */
  async checkGitStatus() {
    console.log('🔍 Checking Git Status...');
    
    try {
      // Check if working directory is clean
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
      
      if (gitStatus.trim()) {
        this.warnings.push('Working directory has uncommitted changes');
        console.log('⚠️  Working directory not clean');
      } else {
        this.checks.push('✅ Working directory is clean');
        console.log('✅ Working directory is clean');
      }

      // Check current branch
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      if (currentBranch !== 'main') {
        this.warnings.push(`Deploying from branch '${currentBranch}' instead of 'main'`);
        console.log(`⚠️  Current branch: ${currentBranch} (not main)`);
      } else {
        this.checks.push('✅ Deploying from main branch');
        console.log('✅ Deploying from main branch');
      }

      // Check if we're ahead of origin
      const aheadBehind = execSync('git rev-list --left-right --count origin/main...HEAD', { encoding: 'utf8' });
      const [behind, ahead] = aheadBehind.trim().split('\t').map(Number);
      
      if (behind > 0) {
        this.errors.push(`Local branch is ${behind} commits behind origin/main`);
        console.log(`❌ Local branch is ${behind} commits behind origin/main`);
      } else if (ahead > 0) {
        this.checks.push(`✅ Local branch is ${ahead} commits ahead of origin/main`);
        console.log(`✅ Local branch is ${ahead} commits ahead of origin/main`);
      } else {
        this.checks.push('✅ Local branch is up to date with origin/main');
        console.log('✅ Local branch is up to date with origin/main');
      }

    } catch (error) {
      this.errors.push(`Git status check failed: ${error.message}`);
      console.log(`❌ Git status check failed: ${error.message}`);
    }
  }

  /**
   * Check version files consistency
   */
  async checkVersionFiles() {
    console.log('🔍 Checking Version Files...');
    
    try {
      // Check if shared version.json exists
      if (!fs.existsSync(this.versionPath)) {
        this.errors.push('shared/version.json does not exist');
        console.log('❌ shared/version.json does not exist');
        return;
      }

      const versionData = JSON.parse(fs.readFileSync(this.versionPath, 'utf8'));
      const sharedVersion = versionData.version;

      // Check frontend package.json
      const frontendPackagePath = path.join(__dirname, '../frontend/sams-ui/package.json');
      if (fs.existsSync(frontendPackagePath)) {
        const frontendPackage = JSON.parse(fs.readFileSync(frontendPackagePath, 'utf8'));
        if (frontendPackage.version !== sharedVersion) {
          this.errors.push(`Frontend package.json version (${frontendPackage.version}) != shared version (${sharedVersion})`);
          console.log(`❌ Frontend package.json version mismatch`);
        } else {
          this.checks.push('✅ Frontend package.json version matches shared version');
          console.log('✅ Frontend package.json version matches shared version');
        }
      }

      // Check backend package.json
      const backendPackagePath = path.join(__dirname, '../backend/package.json');
      if (fs.existsSync(backendPackagePath)) {
        const backendPackage = JSON.parse(fs.readFileSync(backendPackagePath, 'utf8'));
        if (backendPackage.version !== sharedVersion) {
          this.errors.push(`Backend package.json version (${backendPackage.version}) != shared version (${sharedVersion})`);
          console.log(`❌ Backend package.json version mismatch`);
        } else {
          this.checks.push('✅ Backend package.json version matches shared version');
          console.log('✅ Backend package.json version matches shared version');
        }
      }

      this.checks.push(`✅ Version consistency check complete (v${sharedVersion})`);
      console.log(`✅ Version consistency check complete (v${sharedVersion})`);

    } catch (error) {
      this.errors.push(`Version files check failed: ${error.message}`);
      console.log(`❌ Version files check failed: ${error.message}`);
    }
  }

  /**
   * Check package.json sync
   */
  async checkPackageJsonSync() {
    console.log('🔍 Checking Package.json Synchronization...');
    
    try {
      const frontendPath = path.join(__dirname, '../frontend/sams-ui/package.json');
      const backendPath = path.join(__dirname, '../backend/package.json');
      
      if (fs.existsSync(frontendPath) && fs.existsSync(backendPath)) {
        const frontend = JSON.parse(fs.readFileSync(frontendPath, 'utf8'));
        const backend = JSON.parse(fs.readFileSync(backendPath, 'utf8'));
        
        if (frontend.version === backend.version) {
          this.checks.push('✅ Frontend and backend package.json versions match');
          console.log('✅ Frontend and backend package.json versions match');
        } else {
          this.errors.push(`Package.json version mismatch: Frontend (${frontend.version}) != Backend (${backend.version})`);
          console.log('❌ Package.json version mismatch');
        }
      } else {
        this.warnings.push('Could not check package.json synchronization - files missing');
        console.log('⚠️  Could not check package.json synchronization');
      }

    } catch (error) {
      this.errors.push(`Package.json sync check failed: ${error.message}`);
      console.log(`❌ Package.json sync check failed: ${error.message}`);
    }
  }

  /**
   * Check build commands availability
   */
  async checkBuildCommands() {
    console.log('🔍 Checking Build Commands...');
    
    try {
      const packagePath = path.join(__dirname, '../frontend/sams-ui/package.json');
      
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const scripts = packageJson.scripts || {};
        
        const requiredScripts = [
          'version:bump',
          'version:bump:minor', 
          'version:bump:major',
          'version:validate',
          'deploy:verify'
        ];
        
        let missingScripts = [];
        requiredScripts.forEach(script => {
          if (!scripts[script]) {
            missingScripts.push(script);
          }
        });
        
        if (missingScripts.length > 0) {
          this.warnings.push(`Missing build scripts: ${missingScripts.join(', ')}`);
          console.log(`⚠️  Missing build scripts: ${missingScripts.join(', ')}`);
        } else {
          this.checks.push('✅ All required build scripts available');
          console.log('✅ All required build scripts available');
        }
      } else {
        this.errors.push('Frontend package.json not found');
        console.log('❌ Frontend package.json not found');
      }

    } catch (error) {
      this.errors.push(`Build commands check failed: ${error.message}`);
      console.log(`❌ Build commands check failed: ${error.message}`);
    }
  }

  /**
   * Check compatibility matrix
   */
  async checkCompatibilityMatrix() {
    console.log('🔍 Checking Compatibility Matrix...');
    
    try {
      const compatibilityPath = path.join(__dirname, '../shared/version-compatibility.json');
      
      if (!fs.existsSync(compatibilityPath)) {
        this.warnings.push('Version compatibility matrix not found');
        console.log('⚠️  Version compatibility matrix not found');
        return;
      }

      const compatibility = JSON.parse(fs.readFileSync(compatibilityPath, 'utf8'));
      
      if (!compatibility.compatibilityMatrix) {
        this.warnings.push('Compatibility matrix is empty or malformed');
        console.log('⚠️  Compatibility matrix is empty or malformed');
        return;
      }

      this.checks.push('✅ Version compatibility matrix is valid');
      console.log('✅ Version compatibility matrix is valid');

    } catch (error) {
      this.errors.push(`Compatibility matrix check failed: ${error.message}`);
      console.log(`❌ Compatibility matrix check failed: ${error.message}`);
    }
  }

  /**
   * Generate deployment notes from recent commits
   */
  async generateDeploymentNotes() {
    console.log('🔍 Generating Deployment Notes...');
    
    try {
      // Get last 5 commits
      const commits = execSync('git log --oneline -5', { encoding: 'utf8' });
      
      console.log('\n📝 Recent Commits:');
      console.log(commits);
      
      this.checks.push('✅ Deployment notes generated');
      console.log('✅ Deployment notes generated');

    } catch (error) {
      this.warnings.push(`Could not generate deployment notes: ${error.message}`);
      console.log(`⚠️  Could not generate deployment notes: ${error.message}`);
    }
  }

  /**
   * Print final results
   */
  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 PRE-DEPLOYMENT CHECKLIST RESULTS');
    console.log('='.repeat(50));
    
    if (this.checks.length > 0) {
      console.log('\n✅ PASSED CHECKS:');
      this.checks.forEach(check => console.log(`   ${check}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      this.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

// Run checklist if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const checklist = new PreDeployChecklist();
  checklist.run();
}

export { PreDeployChecklist };
