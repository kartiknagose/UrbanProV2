const prisma = require('../config/prisma');
const logger = require('../config/logger');

const getTargetId = (req) => {
  const possible = [req.params?.id, req.params?.userId, req.params?.couponId];
  for (const value of possible) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

function adminAudit(action, targetType) {
  return (req, res, next) => {
    res.on('finish', async () => {
      if (!req.user?.id) return;
      if (res.statusCode >= 400) return;

      const payload = {
        adminId: req.user.id,
        action,
        targetId: getTargetId(req),
        targetType: targetType || null,
        details: {
          method: req.method,
          path: req.originalUrl,
          body: req.body || null,
        },
        ipAddress: req.ip,
      };

      try {
        if (prisma.adminAuditLog?.create) {
          await prisma.adminAuditLog.create({ data: payload });
        } else {
          logger.info('[ADMIN_AUDIT]', payload);
        }
      } catch (error) {
        logger.warn(`[ADMIN_AUDIT] failed: ${error.message}`);
      }
    });

    next();
  };
}

module.exports = adminAudit;
