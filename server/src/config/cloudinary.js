const { v2: cloudinary } = require('cloudinary');
const logger = require('./logger');
const CircuitBreaker = require('../common/utils/circuitBreaker');

const cloudinaryBreaker = new CircuitBreaker('cloudinary', {
  failureThreshold: 5,
  resetTimeout: 60000,
  successThreshold: 2,
});

const isConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  logger.info(`Cloudinary configured (cloud: ${process.env.CLOUDINARY_CLOUD_NAME})`);
} else {
  logger.warn('Cloudinary env vars missing — file uploads will use local disk storage');
}

/**
 * Get the current server time offset from Cloudinary's reference time.
 * Used to detect clock skew issues that cause "Stale request" errors.
 * @returns {object} { offsetMs: number, isSkewed: boolean }
 */
function getClockSkewInfo() {
  // This is a placeholder - Cloudinary doesn't expose time sync endpoint
  // In production, monitor system clock via NTP or cloud provider APIs
  // For now, we track if uploads are failing due to time issues
  return {
    offsetMs: 0,
    isSkewed: false,
    lastCheck: new Date().toISOString()
  };
}

/**
 * Upload a buffer to Cloudinary with automatic retry on clock skew errors.
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {object} options - { folder, public_id, resource_type, transformation }
 * @param {number} retryCount - Internal retry counter (default: 0)
 * @returns {Promise<{url: string, publicId: string}>}
 */
function uploadToCloudinary(buffer, options = {}, retryCount = 0) {
  const MAX_RETRIES = 2;

  return cloudinaryBreaker.execute(async () => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || 'ExpertsHub',
          public_id: options.public_id,
          resource_type: options.resource_type || 'image',
          transformation: options.transformation,
        },
        (error, result) => {
          if (error) {
            // Check if error is due to stale request / clock skew
            const errorMsg = error.message || '';
            const isClockSkewError = errorMsg.includes('Stale request') ||
                                     errorMsg.includes('reported time') ||
                                     errorMsg.includes('more than');

            if (isClockSkewError && retryCount < MAX_RETRIES) {
              const clockInfo = getClockSkewInfo();
              logger.warn(`[CLOUDINARY] Clock skew detected (attempt ${retryCount + 1}/${MAX_RETRIES}). Retrying upload for ${options.public_id || 'unknown'}`);
              logger.warn(`[CLOUDINARY] Server time: ${new Date().toISOString()}, Offset: ${clockInfo.offsetMs}ms, Skewed: ${clockInfo.isSkewed}`);
              logger.warn(`[CLOUDINARY] Original error: ${error.message}`);

              // Wait slightly before retry (clock sync can take a moment)
              setTimeout(() => {
                uploadToCloudinary(buffer, options, retryCount + 1)
                  .then(resolve)
                  .catch(reject);
              }, Math.min(1000 * Math.pow(2, retryCount), 3000));
            } else if (isClockSkewError) {
              const criticalMsg = `[CRITICAL] Cloudinary clock skew persists after ${MAX_RETRIES} retries. Server time: ${new Date().toISOString()}. Check system clock and sync with NTP. Original error: ${error.message}`;
              logger.error(criticalMsg);

              const err = new Error(
                'Upload failed: Server clock is severely out of sync with Cloudinary (>1 hour difference). ' +
                'Fix: ntpdate -s time.nist.gov (Linux/WSL), sudo ntpdate -s time.apple.com (macOS), ' +
                'or w32tm /resync /force (Windows admin). See docs/CLOUDINARY_STALE_REQUEST_FIX.md'
              );
              err.isClockSkewError = true;
              err.originalError = error;
              reject(err);
            } else {
              reject(error);
            }
          } else {
            resolve({ url: result.secure_url, publicId: result.public_id });
          }
        }
      );
      stream.end(buffer);
    });
  });
}

/**
 * Delete a file from Cloudinary by public ID.
 */
async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!isConfigured || !publicId) return;
  try {
    await cloudinaryBreaker.execute(async () => {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    });
  } catch (err) {
    logger.warn('Cloudinary delete failed for %s: %s', publicId, err.message);
  }
}

module.exports = { isConfigured, uploadToCloudinary, deleteFromCloudinary };
