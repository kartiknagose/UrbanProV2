// Express routes for Redis cache endpoints
const express = require('express');
const { CACHE_RELAY_SECRET } = require('../../config/env');
const { serviceCatalogCache, workerProfileCache } = require('./cache.middleware');
const cacheService = require('./cache.service');
const router = express.Router();

router.get('/service-catalog', serviceCatalogCache);
router.get('/worker-profile/:id', workerProfileCache);

router.post('/relay', async (req, res, next) => {
	try {
		const incomingSecret = req.headers['x-cache-secret'];
		if (!CACHE_RELAY_SECRET || incomingSecret !== CACHE_RELAY_SECRET) {
			return res.status(401).json({ message: 'Unauthorized' });
		}

		const action = req.body?.action || req.body?.type || 'invalidate';
		const target = req.body?.target;
		const workerId = req.body?.workerId ?? req.body?.id;

		if (action !== 'invalidate') {
			return res.status(400).json({ message: 'Unsupported cache relay action' });
		}

		if (target === 'service-catalog' || target === 'services') {
			await cacheService.invalidateServiceCatalog();
			return res.json({ ok: true, invalidated: ['service-catalog'] });
		}

		if (target === 'worker-profile') {
			const parsedWorkerId = Number(workerId);
			if (!Number.isFinite(parsedWorkerId)) {
				return res.status(400).json({ message: 'workerId is required for worker-profile invalidation' });
			}

			await cacheService.invalidateWorkerProfile(parsedWorkerId);
			return res.json({ ok: true, invalidated: [`worker-profile:${parsedWorkerId}`] });
		}

		if (target === 'all') {
			await Promise.all([cacheService.invalidateServiceCatalog()]);
			return res.json({ ok: true, invalidated: ['service-catalog'] });
		}

		return res.status(400).json({ message: 'Unsupported cache relay target' });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
