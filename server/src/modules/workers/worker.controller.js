const asyncHandler = require('../../common/utils/asyncHandler');
const { 
  upsertWorkerProfile, 
  getMyWorkerProfile,
  addWorkerService,
  getMyWorkerServices,
  getWorkerServicesById,
  removeWorkerService,
} = require('./worker.service');

// POST /api/workers/profile
// Create or update the authenticated user's worker profile (lets any user become a worker)
exports.saveProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id; // from auth middleware
  const { bio, hourlyRate, skills, serviceAreas } = req.body;

  const profile = await upsertWorkerProfile(userId, {
    bio,
    hourlyRate: typeof hourlyRate === 'number' ? hourlyRate : undefined, // avoid storing non-numeric values
    skills, // array like ["plumbing", "cleaning"]
    serviceAreas, // array like ["Mumbai", "Pune"]
  });

  res.status(201).json({ profile });
});

// GET /api/workers/me
// Return the authenticated user's worker profile
exports.me = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profile = await getMyWorkerProfile(userId);
  if (!profile) return res.status(404).json({ error: 'No worker profile found' });
  res.json({ profile });
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
  const { workerId } = req.params;
  const services = await getWorkerServicesById(parseInt(workerId));
  
  res.json({ services });
});

// DELETE /api/workers/services/:serviceId
// Remove a service from the authenticated worker's offered services
exports.removeService = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { serviceId } = req.params;

  await removeWorkerService(userId, parseInt(serviceId));

  res.json({ 
    message: 'Service removed successfully',
  });
});