const { Router } = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireRole');
const validate = require('../../middleware/validation');
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
    getCoupons, createCoupon, updateCouponStatus, removeCoupon
} = require('./admin.controller');

const router = Router();

router.get('/dashboard', auth, requireAdmin, getDashboard);
router.get('/fraud-alerts', auth, requireAdmin, getFraudAlerts);
router.get('/users', auth, requireAdmin, getUsersSchema, validate, getUsers);
router.get('/workers', auth, requireAdmin, listWorkersSchema, validate, getWorkers);
router.patch('/users/:id/status', auth, requireAdmin, updateUserStatusSchema, validate, updateUser);
router.delete('/users/:id', auth, requireAdmin, userIdParamSchema, validate, removeUser);

// Coupon Management
router.get('/coupons', auth, requireAdmin, getCoupons);
router.post('/coupons', auth, requireAdmin, createCouponSchema, validate, createCoupon);
router.patch('/coupons/:id/status', auth, requireAdmin, updateCouponStatusSchema, validate, updateCouponStatus);
router.delete('/coupons/:id', auth, requireAdmin, couponIdParamSchema, validate, removeCoupon);

module.exports = router;
