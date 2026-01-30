const { Router } = require('express');
const auth = require('../../middleware/auth');
const { requireWorker } = require('../../middleware/requireRole');
const validate = require('../../middleware/validation');
const { saveProfile, me, addService, getServices, getWorkerServices, removeService } = require('./worker.controller');
const { addServiceSchema } = require('./workerService.schemas');

const router = Router();

// Create/update worker profile (requires login)
router.post('/profile', auth, saveProfile);

// Get my worker profile (requires login)
router.get('/me', auth, me);

// Add a service to worker's offered services (worker only)
router.post('/services', auth, requireWorker, addServiceSchema, validate, addService);

// Get all services I offer as a worker (worker only) - for managing my services
router.get('/me/services', auth, requireWorker, getServices);

// Get all services offered by a specific worker (public) - for customers to see
router.get('/:workerId/services', getWorkerServices);

// Remove a service from worker's offered services (worker only)
router.delete('/services/:serviceId', auth, requireWorker, removeService);

module.exports = router;