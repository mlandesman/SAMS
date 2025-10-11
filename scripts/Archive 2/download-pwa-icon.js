#!/usr/bin/env node

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import sharp from 'sharp';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Initialize Firebase Admin
const serviceAccount = require('../backend/sams-production-serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'sams-sandyland-prod.firebasestorage.app'
});

const bucket = admin.storage().bucket();

async function downloadAndConvertIcon() {
  console.log('📥 Downloading icon from Firebase Storage...');
  
  const fileName = 'icons/MTC/icon_1751506930875_sandyland-properties-icon-only.png';
  const file = bucket.file(fileName);
  
  try {
    // Download the file
    const [buffer] = await file.download();
    console.log('✅ Icon downloaded successfully');
    
    // Save original
    const tempPath = path.join(__dirname, 'temp-icon.png');
    fs.writeFileSync(tempPath, buffer);
    
    // Convert to required sizes
    const sizes = [
      { size: 192, name: 'icon-192x192.png' },
      { size: 512, name: 'icon-512x512.png' }
    ];
    
    const outputDir = path.join(__dirname, '../frontend/mobile-app/public');
    
    for (const { size, name } of sizes) {
      console.log(`🔄 Creating ${size}x${size} icon...`);
      
      await sharp(buffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(path.join(outputDir, name));
        
      console.log(`✅ Created ${name}`);
    }
    
    // Also save to dist directory if it exists
    const distDir = path.join(__dirname, '../frontend/mobile-app/dist');
    if (fs.existsSync(distDir)) {
      for (const { size, name } of sizes) {
        await sharp(buffer)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .png()
          .toFile(path.join(distDir, name));
      }
      console.log('✅ Also updated icons in dist directory');
    }
    
    // Clean up temp file
    fs.unlinkSync(tempPath);
    
    console.log('\n🎉 Icon update complete!');
    console.log('\nNext steps:');
    console.log('1. Build the app: cd frontend/mobile-app && npm run build');
    console.log('2. Deploy: sams-deploy-simple -c mobile');
    console.log('3. Users may need to clear cache or reinstall PWA to see new icon');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

downloadAndConvertIcon();