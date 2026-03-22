// Middleware to use Redis cache for service catalog and worker profile endpoints
const cacheService = require('./cache.service');

async function serviceCatalogCache(req, res, next) {
  try {
    const services = await cacheService.getServiceCatalog();
    res.json({ services });
  } catch (_err) {
    // Redis/cache failures should not break catalog listing.
    try {
      const prisma = require('../../config/prisma');
      const services = await prisma.service.findMany();
      return res.json({ services });
    } catch (fallbackErr) {
      next(fallbackErr);
    }
  }
}

async function workerProfileCache(req, res, next) {
  try {
    const workerId = Number(req.params.workerId || req.params.id);
    if (!Number.isInteger(workerId) || workerId < 1) return next(); // Fallback if ID is invalid
    
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
      const workerId = Number(req.params.workerId || req.params.id);
      if (!Number.isInteger(workerId) || workerId < 1) return next(err);

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
