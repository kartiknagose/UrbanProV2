const { Router } = require('express');
const multer = require('multer');
const auth = require('../../middleware/auth');
const { aiChatLimiter, aiVoiceLimiter } = require('../../config/rateLimit');
const controller = require('./ai.controller');

const router = Router();
const uploadVoiceAudio = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: Number(process.env.AI_VOICE_MAX_BYTES || 15 * 1024 * 1024),
	},
	fileFilter: (_req, file, cb) => {
		const mime = String(file.mimetype || '').toLowerCase();
		if (!mime.startsWith('audio/')) {
			return cb(new Error('Only audio files are allowed.'));
		}
		cb(null, true);
	},
});

router.post('/chat', auth, aiChatLimiter, controller.chat);
router.post('/voice', auth, aiVoiceLimiter, uploadVoiceAudio.single('audio'), controller.voice);
router.post('/session/reset', auth, aiChatLimiter, controller.clearSession);

module.exports = router;
