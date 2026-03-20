// Middleware to use Redis cache for service catalog and worker profile endpoints
const cacheService = require('./cache.service');

async function serviceCatalogCache(req, res, next) {
  try {
    const services = await cacheService.getServiceCatalog();
    res.json({ services });
  } catch (err) {
    next(err);
  }
}

async function workerProfileCache(req, res, next) {
  try {
    const workerId = parseInt(req.params.workerId || req.params.id);
    if (isNaN(workerId)) return next(); // Fallback if ID is invalid
    
    const profile = await cacheService.getWorkerProfile(workerId);
    if (!profile) return res.status(404).json({ message: 'Worker not found' });

    // Ensure response matches the expected structure { profile, services }
    res.json({ 
      profile, 
      services: profile.services || [] 
    });
  } catch (err) {
    // Cache/Redis failures should not break profile viewing.
    try {
      const workerId = parseInt(req.params.workerId || req.params.id);
      if (isNaN(workerId)) return next(err);

      const { getWorkerProfileById, getWorkerServicesById } = require('../workers/worker.service');
      const profile = await getWorkerProfileById(workerId);

      if (!profile) {
        return res.status(404).json({ message: 'Worker not found' });
      }

      const services = await getWorkerServicesById(workerId);
      return res.json({ profile, services: services || [] });
    } catch (fallbackErr) {
      next(fallbackErr);
    }
  }
}

module.exports = {
  serviceCatalogCache,
  workerProfileCache
};
