const { Router } = require('express');
const auth = require('../../middleware/auth');
const { requireWorker } = require('../../middleware/requireRole');
const validate = require('../../middleware/validation');
const { saveProfile, me, addService, getServices, getWorkerServices, removeService, getLeaderboard } = require('./worker.controller');
const {
	addServiceSchema,
	removeServiceSchema,
	workerIdParamSchema,
	leaderboardQuerySchema,
} = require('./workerService.schemas');

const { workerProfileCache } = require('../cache/cache.middleware');
const router = Router();

const withWorkerProfileInvalidation = (handler) => async (req, res, next) => {
	try {
		const { invalidateWorkerProfile } = require('../cache/cache.service');
		await invalidateWorkerProfile(req.user.id);
		return handler(req, res, next);
	} catch (error) {
		next(error);
	}
};

// Create/update worker profile (requires login)
router.post('/profile', auth, withWorkerProfileInvalidation(saveProfile));

// Get my worker profile (requires login)
router.get('/me', auth, me);

// Add a service to worker's offered services (worker only)
router.post('/services', auth, requireWorker, addServiceSchema, validate, withWorkerProfileInvalidation(addService));

// Get all services I offer as a worker (worker only) - for managing my services
router.get('/me/services', auth, requireWorker, getServices);

// Get all services offered by a specific worker (public) - for customers to see
router.get('/:workerId/services', workerIdParamSchema, validate, getWorkerServices);

// Get worker leaderboard (Sprint 17 - #81)
router.get('/leaderboard/top', leaderboardQuerySchema, validate, getLeaderboard);

// Get worker profile details (public)
router.get('/:workerId', workerIdParamSchema, validate, workerProfileCache);

// Remove a service from worker's offered services (worker only)
router.delete('/services/:serviceId', auth, requireWorker, removeServiceSchema, validate, withWorkerProfileInvalidation(removeService));

module.exports = router;