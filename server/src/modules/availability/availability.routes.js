const { Router } = require('express');
const auth = require('../../middleware/auth');
const { requireWorker } = require('../../middleware/requireRole');
const validate = require('../../middleware/validation');
const { createAvailabilitySchema, removeAvailabilitySchema } = require('./availability.schemas');
const { listMine, create, remove } = require('./availability.controller');

const router = Router();

router.get('/me', auth, requireWorker, listMine);
router.post('/', auth, requireWorker, createAvailabilitySchema, validate, create);
router.delete('/:id', auth, requireWorker, removeAvailabilitySchema, validate, remove);

module.exports = router;
