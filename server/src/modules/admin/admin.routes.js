const { Router } = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireRole');
const validate = require('../../middleware/validation');
const adminAudit = require('../../middleware/adminAudit');
const {
    getUsersSchema,
    updateUserStatusSchema,
    listWorkersSchema,
    userIdParamSchema,
    createCouponSchema,
    updateCouponStatusSchema,
    couponIdParamSchema,
} = require('./admin.schemas');
const {
    getDashboard, getUsers, getWorkers, updateUser, removeUser, getFraudAlerts,
    getCoupons, createCoupon, updateCouponStatus, removeCoupon, getAiAuditSummary, getAiAudits
} = require('./admin.controller');

const router = Router();

router.get('/dashboard', auth, requireAdmin, getDashboard);
router.get('/fraud-alerts', auth, requireAdmin, getFraudAlerts);
router.get('/ai-audits/summary', auth, requireAdmin, getAiAuditSummary);
router.get('/ai-audits', auth, requireAdmin, getAiAudits);
router.get('/users', auth, requireAdmin, getUsersSchema, validate, getUsers);
router.get('/workers', auth, requireAdmin, listWorkersSchema, validate, getWorkers);
router.patch('/users/:id/status', auth, requireAdmin, adminAudit('UPDATE_USER_STATUS', 'User'), updateUserStatusSchema, validate, updateUser);
router.delete('/users/:id', auth, requireAdmin, adminAudit('DELETE_USER', 'User'), userIdParamSchema, validate, removeUser);

// Coupon Management
router.get('/coupons', auth, requireAdmin, getCoupons);
router.post('/coupons', auth, requireAdmin, adminAudit('CREATE_COUPON', 'Coupon'), createCouponSchema, validate, createCoupon);
router.patch('/coupons/:id/status', auth, requireAdmin, adminAudit('UPDATE_COUPON_STATUS', 'Coupon'), updateCouponStatusSchema, validate, updateCouponStatus);
router.delete('/coupons/:id', auth, requireAdmin, adminAudit('DELETE_COUPON', 'Coupon'), couponIdParamSchema, validate, removeCoupon);

module.exports = router;
