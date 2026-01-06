/**
 * Image Resize Service
 * Converts images to fixed sizes and stores them permanently in the logos folder.
 * Each size is converted ONCE and stored with a fixed filename.
 * 
 * Gmail displays logos at actual file size, ignoring HTML/CSS resize attributes.
 * This service creates properly-sized versions and stores them permanently.
 */

import sharp from 'sharp';
import { getStorage } from 'firebase-admin/storage';
import { getApp } from '../firebase.js';

/**
 * Get the correct storage bucket name based on environment
 */
function getStorageBucketName() {
  // Check GCLOUD_PROJECT first (always set in Cloud Functions), then fall back to NODE_ENV
  if (process.env.GCLOUD_PROJECT === 'sams-sandyland-prod' || process.env.NODE_ENV === 'production') {
    return 'sams-sandyland-prod.firebasestorage.app';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'sams-staging-6cdcd.firebasestorage.app';
  }
  return 'sandyland-management-system.firebasestorage.app';
}

/**
 * Standard image sizes for different contexts
 * Each size has a fixed filename that's stored permanently in logos/{clientId}/
 */
export const IMAGE_SIZES = {
  email: { width: 200, filename: 'email_logo_200x200.png' },      // Email-safe logo
  thumbnail: { width: 100, filename: 'thumb_logo_100x100.png' },  // Small thumbnails
  medium: { width: 400, filename: 'medium_logo_400x400.png' },    // PWA, mobile
  large: { width: 800, filename: 'large_logo_800x800.png' }       // Desktop UI, reports
};

/**
 * Get a resized version of an image, stored permanently with a fixed filename.
 * Converts the image ONCE and stores it permanently - no per-session conversion.
 * 
 * @param {string} originalUrl - URL of the original full-size image
 * @param {string} clientId - Client ID for storage path
 * @param {string} sizeName - Size key from IMAGE_SIZES (e.g., 'email', 'thumbnail')
 * @param {Object} options - Optional overrides { width, height, format }
 * @returns {Promise<string>} - URL of resized image
 * 
 * Usage:
 *   const emailLogoUrl = await getResizedImage(logoUrl, 'AVII', 'email');
 *   const thumbUrl = await getResizedImage(logoUrl, 'AVII', 'thumbnail');
 */
export async function getResizedImage(originalUrl, clientId, sizeName, options = {}) {
  if (!originalUrl) {
    throw new Error('Original URL is required');
  }
  
  if (!clientId) {
    throw new Error('Client ID is required');
  }
  
  const sizeConfig = IMAGE_SIZES[sizeName];
  if (!sizeConfig && !options.width) {
    throw new Error(`Unknown size: ${sizeName}. Use one of: ${Object.keys(IMAGE_SIZES).join(', ')}`);
  }
  
  const width = options.width || sizeConfig.width;
  const filename = options.filename || sizeConfig?.filename || `logo_${width}x${width}.png`;
  const format = 'png'; // Always PNG for logos
  
  // Get Firebase Storage bucket (use explicit bucket name like PDF service)
  const app = await getApp();
  const bucketName = getStorageBucketName();
  const bucket = getStorage(app).bucket(bucketName);
  
  // Fixed path in logos folder: logos/{clientId}/{filename}
  // Example: logos/AVII/email_logo_200x200.png
  const storagePath = `logos/${clientId}/${filename}`;
  
  // Check if converted image already exists (bypass conversion if it does)
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  
  if (exists) {
    // File already exists - return URL directly (no conversion needed)
    // Make sure it's publicly accessible
    try {
      await file.makePublic();
    } catch (error) {
      // Ignore if already public
      if (!error.message.includes('already public')) {
        console.warn(`⚠️ Could not make image public: ${error.message}`);
      }
    }
    
    // Return public URL
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  }
  
  // File doesn't exist - convert ONCE and store permanently
  console.log(`📥 Fetching original image from: ${originalUrl}`);
  const response = await fetch(originalUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch original image: ${response.status} ${response.statusText}`);
  }
  
  const originalBuffer = Buffer.from(await response.arrayBuffer());
  
  // Resize with Sharp
  console.log(`🔄 Converting image to ${width}x${width}px (${filename})`);
  const resizedBuffer = await sharp(originalBuffer)
    .resize({ width, height: width, withoutEnlargement: true })
    .png({ quality: 90 })
    .toBuffer();
  
  // Upload to permanent storage location
  console.log(`💾 Storing converted image permanently: ${storagePath}`);
  try {
    await file.save(resizedBuffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          originalUrl,
          resizedWidth: width.toString(),
          createdAt: new Date().toISOString(),
          sizeName: sizeName
        }
      }
    });
    console.log(`✅ File stored permanently: ${storagePath}`);
  } catch (saveError) {
    console.error(`❌ Failed to save converted image: ${saveError.message}`);
    throw new Error(`Failed to save converted image: ${saveError.message}`);
  }
  
  // Make publicly accessible
  try {
    await file.makePublic();
    console.log(`✅ File made public: ${storagePath}`);
  } catch (publicError) {
    if (!publicError.message.includes('already public')) {
      console.warn(`⚠️ Could not make file public: ${publicError.message}`);
    }
  }
  
  // Return public URL
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  console.log(`✅ Converted image stored and accessible at: ${publicUrl}`);
  return publicUrl;
}

/**
 * Clear converted images for a client (call when logo changes)
 * Deletes all converted sizes stored in logos/{clientId}/
 * 
 * @param {string} clientId - Client ID
 * @returns {Promise<number>} - Number of files deleted
 */
export async function clearImageCache(clientId) {
  if (!clientId) {
    throw new Error('Client ID is required');
  }
  
  // Get Firebase Storage bucket (use explicit bucket name like PDF service)
  const app = await getApp();
  const bucketName = getStorageBucketName();
  const bucket = getStorage(app).bucket(bucketName);
  
  // Delete all converted images in logos/{clientId}/
  const prefix = `logos/${clientId}/`;
  
  console.log(`🗑️  Clearing converted images for client: ${clientId}`);
  const [files] = await bucket.getFiles({ prefix });
  
  // Delete all converted versions (email_logo_200x200.png, thumb_logo_100x100.png, etc.)
  const convertedFiles = files.filter(f => 
    f.name.startsWith(prefix) && 
    Object.values(IMAGE_SIZES).some(size => f.name.includes(size.filename))
  );
  
  if (convertedFiles.length > 0) {
    await Promise.all(convertedFiles.map(f => f.delete()));
    console.log(`✅ Deleted ${convertedFiles.length} converted image(s)`);
  } else {
    console.log(`ℹ️  No converted images found to delete`);
  }
  
  return convertedFiles.length;
}
