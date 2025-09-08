import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const updateVersion = (environment) => {
  const versionFile = path.join(__dirname, '../shared/version.json');
  const currentVersion = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
  
  // Increment staging version
  const parts = currentVersion.version.split('.');
  parts[2] = (parseInt(parts[2]) + 1).toString();
  
  const newVersion = {
    version: parts.join('.'),
    buildDate: new Date().toISOString(),
    environment: environment,
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || 'staging'
  };
  
  fs.writeFileSync(versionFile, JSON.stringify(newVersion, null, 2));
  console.log(`✅ Updated to version ${newVersion.version} for ${environment}`);
  console.log(`📅 Build date: ${newVersion.buildDate}`);
  console.log(`🌳 Branch: ${newVersion.gitBranch}`);
  console.log(`📦 Commit: ${newVersion.gitCommit}`);
};

updateVersion('staging');