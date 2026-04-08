const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auth = require('../../middleware/auth');
const { clockSyncMiddleware } = require('../../middleware/clockSync');
const asyncHandler = require('../../common/utils/asyncHandler');
const prisma = require('../../config/prisma');
const { isConfigured: cloudinaryEnabled, uploadToCloudinary } = require('../../config/cloudinary');
const { optimizeImage } = require('./imageOptimization');
const AppError = require('../../common/errors/AppError');

const router = Router();

// Apply clock sync validation to all upload routes
router.use(clockSyncMiddleware);

// Ensure upload directory exists
const profilePhotoDir = path.join(__dirname, '../../uploads/profile-photos');
if (!fs.existsSync(profilePhotoDir)) {
  fs.mkdirSync(profilePhotoDir, { recursive: true });
}

const verificationDocDir = path.join(__dirname, '../../uploads/verification-docs');
if (!fs.existsSync(verificationDocDir)) {
  fs.mkdirSync(verificationDocDir, { recursive: true });
}

const bookingPhotoDir = path.join(__dirname, '../../uploads/booking-photos');
if (!fs.existsSync(bookingPhotoDir)) {
  fs.mkdirSync(bookingPhotoDir, { recursive: true });
}

const chatAttachmentDir = path.join(__dirname, '../../uploads/chat-attachments');
if (!fs.existsSync(chatAttachmentDir)) {
  fs.mkdirSync(chatAttachmentDir, { recursive: true });
}

function buildLocalProfilePhotoUrl(userId, buffer) {
  const fileName = `user-${userId}-${Date.now()}.webp`;
  const filePath = path.join(profilePhotoDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/profile-photos/${fileName}`;
}

function getSafeExtension(fileName, fallbackExt) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  return ext || fallbackExt;
}

function buildLocalUploadUrl({ directory, publicPrefix, filePrefix, userId, buffer, extension }) {
  const fileName = `${filePrefix}-${userId}-${Date.now()}${extension}`;
  const filePath = path.join(directory, fileName);
  fs.writeFileSync(filePath, buffer);
  return `${publicPrefix}/${fileName}`;
}

// Multer storage config for profile photos
const profilePhotoStorage = cloudinaryEnabled
  ? multer.memoryStorage()
  : multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, profilePhotoDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `user-${req.user.id}-${Date.now()}${ext}`);
    },
  });

// Multer storage config for verification documents
const verificationDocStorage = cloudinaryEnabled
  ? multer.memoryStorage()
  : multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, verificationDocDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `verif-${req.user.id}-${Date.now()}${ext}`);
    },
  });

// Multer storage config for booking photos
const bookingPhotoStorage = cloudinaryEnabled
  ? multer.memoryStorage()
  : multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, bookingPhotoDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `booking-${req.user.id}-${Date.now()}${ext}`);
    },
  });

// Multer storage config for chat attachments
const chatAttachmentStorage = cloudinaryEnabled
  ? multer.memoryStorage()
  : multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, chatAttachmentDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `chat-${req.user.id}-${Date.now()}${ext}`);
    },
  });

// ─── SECURITY: Safe image extensions whitelist ───
// SVG files can contain <script> tags and JS event handlers.
// Since uploads are served as static files, a malicious SVG would execute
// JavaScript in any visitor's browser (Stored XSS). We reject SVGs AND
// validate by extension (MIME types can be spoofed by the client).
const SAFE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff']);
const SAFE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff']);
const SAFE_DOC_EXTENSIONS = new Set(['.pdf', ...SAFE_IMAGE_EXTENSIONS]);
const CHAT_AUDIO_EXTENSIONS = new Set(['.mp3', '.webm', '.wav', '.ogg', '.m4a']);
const CHAT_AUDIO_MIME_TYPES = new Set(['audio/mpeg', 'audio/webm', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a']);

// Only allow safe raster image uploads (NO SVG)
const imageFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  // Check 1: MIME type must be explicitly allowed image type
  if (!SAFE_IMAGE_MIME_TYPES.has(mime)) {
    return cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed. SVG is not permitted.'), false);
  }

  // Check 2: Extension must be in the safe whitelist
  if (!SAFE_IMAGE_EXTENSIONS.has(ext)) {
    return cb(new Error(`File extension "${ext}" is not allowed. Use JPG, PNG, GIF, or WebP.`), false);
  }

  cb(null, true);
};

// Allow safe images and PDF uploads (NO SVG)
const docFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  // PDFs are allowed for verification documents
  if (mime === 'application/pdf' && ext === '.pdf') {
    return cb(null, true);
  }

  if (!SAFE_IMAGE_MIME_TYPES.has(mime)) {
    return cb(new Error('Only image files (JPG, PNG, GIF, WebP) or PDF are allowed. SVG is not permitted.'), false);
  }

  if (!SAFE_DOC_EXTENSIONS.has(ext)) {
    return cb(new Error(`File extension "${ext}" is not allowed. Use JPG, PNG, GIF, WebP, or PDF.`), false);
  }

  cb(null, true);
};

const chatAttachmentFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  if (mime === 'application/pdf' && ext === '.pdf') {
    return cb(null, true);
  }

  if (SAFE_IMAGE_MIME_TYPES.has(mime) && SAFE_DOC_EXTENSIONS.has(ext)) {
    return cb(null, true);
  }

  if (CHAT_AUDIO_MIME_TYPES.has(mime) && CHAT_AUDIO_EXTENSIONS.has(ext)) {
    return cb(null, true);
  }

  return cb(new Error('Only images, PDF, and supported audio files are allowed for chat attachments.'), false);
};

const uploadProfile = multer({
  storage: profilePhotoStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadVerification = multer({
  storage: verificationDocStorage,
  fileFilter: docFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadBooking = multer({
  storage: bookingPhotoStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadChatAttachment = multer({
  storage: chatAttachmentStorage,
  fileFilter: chatAttachmentFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// POST /api/uploads/profile-photo
router.post(
  '/profile-photo',
  auth,
  uploadProfile.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let photoUrl;
    let optimizedBuffer = req.file.buffer;

    // Optimize image before upload
    if (optimizedBuffer) {
      optimizedBuffer = await optimizeImage(optimizedBuffer, { width: 400, height: 400, quality: 80 });
    }

    if (cloudinaryEnabled && optimizedBuffer) {
      try {
        const result = await uploadToCloudinary(optimizedBuffer, {
          folder: 'ExpertsHub/profile-photos',
          public_id: `user-${req.user.id}-${Date.now()}`,
          transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
        });
        photoUrl = result.url;
      } catch (_cloudinaryError) {
        // Fallback to local storage so profile update is not blocked by external clock/network issues.
        photoUrl = buildLocalProfilePhotoUrl(req.user.id, optimizedBuffer);
      }
    } else {
      photoUrl = `/uploads/profile-photos/${req.file.filename}`;
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { profilePhotoUrl: photoUrl },
    });

    res.status(201).json({ url: photoUrl });
  })
);

// POST /api/uploads/verification-doc
router.post(
  '/verification-doc',
  auth,
  uploadVerification.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let docUrl;

    if (cloudinaryEnabled && req.file.buffer) {
      try {
        const isPdf = req.file.mimetype === 'application/pdf';
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: 'ExpertsHub/verification-docs',
          public_id: `verif-${req.user.id}-${Date.now()}`,
          resource_type: isPdf ? 'raw' : 'image',
        });
        docUrl = result.url;
      } catch (_cloudinaryError) {
        const fallbackExt = req.file.mimetype === 'application/pdf' ? '.pdf' : '.jpg';
        docUrl = buildLocalUploadUrl({
          directory: verificationDocDir,
          publicPrefix: '/uploads/verification-docs',
          filePrefix: 'verif',
          userId: req.user.id,
          buffer: req.file.buffer,
          extension: getSafeExtension(req.file.originalname, fallbackExt),
        });
      }
    } else {
      docUrl = `/uploads/verification-docs/${req.file.filename}`;
    }

    res.status(201).json({ url: docUrl });
  })
);

/**
 * POST /api/uploads/booking-photo
 * Upload a photo for a booking (BEFORE or AFTER)
 */
router.post(
  '/booking-photo',
  auth,
  uploadBooking.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let photoUrl;

    if (cloudinaryEnabled && req.file.buffer) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: 'ExpertsHub/booking-photos',
          public_id: `booking-${req.user.id}-${Date.now()}`,
        });
        photoUrl = result.url;
      } catch (_cloudinaryError) {
        photoUrl = buildLocalUploadUrl({
          directory: bookingPhotoDir,
          publicPrefix: '/uploads/booking-photos',
          filePrefix: 'booking',
          userId: req.user.id,
          buffer: req.file.buffer,
          extension: getSafeExtension(req.file.originalname, '.jpg'),
        });
      }
    } else {
      photoUrl = `/uploads/booking-photos/${req.file.filename}`;
    }

    // Optionally link to booking if details provided
    const { bookingId, type } = req.body;
    if ((bookingId && !type) || (!bookingId && type)) {
      throw new AppError(400, 'bookingId and type are required together.');
    }

    if (bookingId && type) {
      const parsedBookingId = Number(bookingId);
      const normalizedType = String(type).trim().toUpperCase();

      if (!Number.isInteger(parsedBookingId) || parsedBookingId <= 0) {
        throw new AppError(400, 'Booking ID must be a positive integer.');
      }

      if (!['BEFORE', 'AFTER'].includes(normalizedType)) {
        throw new AppError(400, 'Photo type must be BEFORE or AFTER.');
      }

      const booking = await prisma.booking.findUnique({
        where: { id: parsedBookingId },
        select: {
          id: true,
          customerId: true,
          workerProfile: { select: { userId: true } },
        },
      });

      if (!booking) {
        throw new AppError(404, 'Booking not found.');
      }

      const canAttachPhoto =
        req.user.role === 'ADMIN'
        || booking.customerId === req.user.id
        || booking.workerProfile?.userId === req.user.id;

      if (!canAttachPhoto) {
        throw new AppError(403, 'You are not authorized to upload photos for this booking.');
      }

      await prisma.bookingPhoto.create({
        data: {
          bookingId: parsedBookingId,
          url: photoUrl,
          type: normalizedType,
        }
      });
    }

    res.status(201).json({
      url: photoUrl,
      message: 'Photo uploaded successfully'
    });
  })
);

/**
 * POST /api/uploads/chat-attachment
 * Upload a file for chat (image or document)
 */
router.post(
  '/chat-attachment',
  auth,
  uploadChatAttachment.single('attachment'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let fileUrl;

    if (cloudinaryEnabled && req.file.buffer) {
      try {
        const isPdf = req.file.mimetype === 'application/pdf';
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: 'ExpertsHub/chat-attachments',
          public_id: `chat-${req.user.id}-${Date.now()}`,
          resource_type: isPdf ? 'raw' : 'image',
        });
        fileUrl = result.url;
      } catch (_cloudinaryError) {
        const fallbackExt = req.file.mimetype === 'application/pdf' ? '.pdf' : '.jpg';
        fileUrl = buildLocalUploadUrl({
          directory: chatAttachmentDir,
          publicPrefix: '/uploads/chat-attachments',
          filePrefix: 'chat',
          userId: req.user.id,
          buffer: req.file.buffer,
          extension: getSafeExtension(req.file.originalname, fallbackExt),
        });
      }
    } else {
      fileUrl = `/uploads/chat-attachments/${req.file.filename}`;
    }

    res.status(201).json({
      url: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimetype: req.file.mimetype,
    });
  })
);

router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Uploaded file is too large.' });
    }

    return res.status(400).json({ message: err.message || 'Invalid upload request.' });
  }

  if (typeof err?.message === 'string' && /Only image files|images, PDF, and supported audio|extension|not allowed|No file uploaded/i.test(err.message)) {
    return res.status(400).json({ message: err.message });
  }

  return next(err);
});

module.exports = router;
