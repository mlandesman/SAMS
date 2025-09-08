import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check version consistency across applications
 */
function checkVersionConsistency() {
  const versionPath = path.join(__dirname, '../shared/version.json');
  const desktopPackage = path.join(__dirname, '../frontend/sams-ui/package.json');
  const mobilePackage = path.join(__dirname, '../frontend/mobile-app/package.json');
  
  try {
    const versionConfig = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    const desktopPkg = JSON.parse(fs.readFileSync(desktopPackage, 'utf8'));
    const mobilePkg = JSON.parse(fs.readFileSync(mobilePackage, 'utf8'));
    
    console.log('🔍 VERSION CONSISTENCY CHECK');
    console.log('='.repeat(40));
    console.log(`Shared Config: ${versionConfig.version}`);
    console.log(`Desktop UI:    ${desktopPkg.version}`);
    console.log(`Mobile PWA:    ${mobilePkg.version}`);
    console.log('='.repeat(40));
    
    const allVersions = [versionConfig.version, desktopPkg.version, mobilePkg.version];
    const isConsistent = allVersions.every(v => v === allVersions[0]);
    
    if (isConsistent) {
      console.log('✅ All versions are consistent');
      return true;
    } else {
      console.log('❌ Version mismatch detected!');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error checking versions:', error);
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const consistent = checkVersionConsistency();
  process.exit(consistent ? 0 : 1);
}

export { checkVersionConsistency };