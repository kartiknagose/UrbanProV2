const asyncHandler = require('../../common/utils/asyncHandler');
const AppError = require('../../common/errors/AppError');
const parseId = require('../../common/utils/parseId');
const { isValidUploadUrl } = require('../../common/utils/validateUploadUrl');
const {
  upsertWorkerProfile,
  getMyWorkerProfile,
  addWorkerService,
  getMyWorkerServices,
  getWorkerServicesById,
  getWorkerProfileById,
  removeWorkerService,
  getTopWorkers,
} = require('./worker.service');

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
          .filter(Boolean);
      }
    } catch {
      // fall through to comma-separated parsing
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
}

function toNumberOrUndefined(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

// POST /api/workers/profile
// Create or update the authenticated user's worker profile (lets any user become a worker)
exports.saveProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id; // from auth middleware
  const { bio, hourlyRate, skills, serviceAreas, profilePhotoUrl, baseLatitude, baseLongitude, serviceRadius } = req.body;

  const normalizedHourlyRate = toNumberOrUndefined(hourlyRate);
  const normalizedBaseLatitude = toNumberOrUndefined(baseLatitude);
  const normalizedBaseLongitude = toNumberOrUndefined(baseLongitude);
  const normalizedServiceRadius = toNumberOrUndefined(serviceRadius);
  const normalizedSkills = normalizeStringArray(skills);
  const normalizedServiceAreas = normalizeStringArray(serviceAreas);

  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== '' && normalizedHourlyRate === undefined) {
    throw new AppError(400, 'Invalid hourlyRate value. Please provide a valid number.');
  }

  if (baseLatitude !== undefined && baseLatitude !== null && baseLatitude !== '' && normalizedBaseLatitude === undefined) {
    throw new AppError(400, 'Invalid baseLatitude value. Please provide a valid number.');
  }

  if (baseLongitude !== undefined && baseLongitude !== null && baseLongitude !== '' && normalizedBaseLongitude === undefined) {
    throw new AppError(400, 'Invalid baseLongitude value. Please provide a valid number.');
  }

  if (serviceRadius !== undefined && serviceRadius !== null && serviceRadius !== '' && normalizedServiceRadius === undefined) {
    throw new AppError(400, 'Invalid serviceRadius value. Please provide a valid number.');
  }

  // Validate profilePhotoUrl if provided — only accept URLs from our upload endpoint
  if (profilePhotoUrl && !isValidUploadUrl(profilePhotoUrl, ['/uploads/profile-photos/'])) {
    throw new AppError(400, 'Invalid profile photo URL. Please use the upload endpoint.');
  }

  const profile = await upsertWorkerProfile(userId, {
    bio,
    hourlyRate: normalizedHourlyRate,
    skills: normalizedSkills,
    serviceAreas: normalizedServiceAreas,
    profilePhotoUrl,
    baseLatitude: normalizedBaseLatitude,
    baseLongitude: normalizedBaseLongitude,
    serviceRadius: normalizedServiceRadius,
  });

  res.status(201).json({ profile });
});

// GET /api/workers/me
// Return the authenticated user's worker profile
exports.me = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profile = await getMyWorkerProfile(userId);

  // First-time workers may not have a profile yet.
  // Return 200 with null profile so the client can render the edit form
  // instead of failing the whole page load with a 404.
  res.json({ profile: profile || null });
});

// POST /api/workers/services
// Add a service to the worker's offered services
exports.addService = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { serviceId } = req.body;

  const workerService = await addWorkerService(userId, serviceId);

  res.status(201).json({
    message: 'Service added successfully',
    workerService,
  });
});

// GET /api/workers/services
// Get all services the authenticated worker offers (my services)
exports.getServices = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const services = await getMyWorkerServices(userId);

  res.json({ services });
});

// GET /api/workers/:workerId/services
// Get all services offered by a specific worker (public endpoint - any user can view)
exports.getWorkerServices = asyncHandler(async (req, res) => {
  const workerId = parseId(req.params.workerId, 'Worker ID');
  const services = await getWorkerServicesById(workerId);

  res.json({ services });
});

// GET /api/workers/:workerId
// Get worker public profile (name, rating, bio, etc)
exports.getProfile = asyncHandler(async (req, res) => {
  const workerId = parseId(req.params.workerId, 'Worker ID');
  const profile = await getWorkerProfileById(workerId);

  if (!profile) throw new AppError(404, 'Worker not found');

  // Also fetch services to make it a complete profile view
  const services = await getWorkerServicesById(workerId);

  res.json({ profile, services });
});

// DELETE /api/workers/services/:serviceId
// Remove a service from the authenticated worker's offered services
exports.removeService = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const serviceId = parseId(req.params.serviceId, 'Service ID');

  await removeWorkerService(userId, serviceId);

  res.json({
    message: 'Service removed successfully',
  });
});

// GET /api/workers/leaderboard (Sprint 17 - #81)
// Get top workers based on ratings and reviews
exports.getLeaderboard = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const workers = await getTopWorkers(safeLimit);
  res.json({ workers });
});