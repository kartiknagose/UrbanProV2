const { Router } = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireRole');
const validate = require('../../middleware/validation');
const {
	triggerSosSchema,
	addContactSchema,
	deleteContactSchema,
	listSosAlertsQuerySchema,
	updateSosAlertStatusSchema,
} = require('./safety.schemas');
const safetyController = require('./safety.controller');

const router = Router();

// ─── User endpoints ──────────────────────────────────────────────────────────
// Trigger SOS Alert (authenticated user during active booking)
router.post('/sos', auth, triggerSosSchema, validate, safetyController.triggerSOS);

// Emergency Contacts CRUD
router.get('/contacts', auth, safetyController.getContacts);
router.post('/contacts', auth, addContactSchema, validate, safetyController.addContact);
router.delete('/contacts/:id', auth, deleteContactSchema, validate, safetyController.deleteContact);

// Get current active booking (for global floating SOS button)
router.get('/active-booking', auth, safetyController.getActiveBooking);

// ─── Admin endpoints ─────────────────────────────────────────────────────────
router.get('/sos/alerts', auth, requireAdmin, listSosAlertsQuerySchema, validate, safetyController.getActiveSosAlerts);
router.patch('/sos/alerts/:id', auth, requireAdmin, updateSosAlertStatusSchema, validate, safetyController.updateSosAlertStatus);

module.exports = router;
