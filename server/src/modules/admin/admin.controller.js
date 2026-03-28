const asyncHandler = require('../../common/utils/asyncHandler');
const parseId = require('../../common/utils/parseId');
const parsePagination = require('../../common/utils/parsePagination');
const AppError = require('../../common/errors/AppError');
const {
  getDashboardStats, listUsers, listWorkers, updateUserStatus, deleteUser, getFraudAlerts,
  createCoupon, listCoupons, toggleCoupon, deleteCoupon, getAiAuditSummary, listAiAudits
} = require('./admin.service');

let getIo;
try {
  ({ getIo } = require('../../socket'));
} catch (_e) {
  getIo = null;
}

function emitAdminDataChanged(eventName, payload) {
  if (!getIo) return;

  try {
    const io = getIo();
    io.to('admin').emit(eventName, payload);
  } catch (err) {
    console.warn(`Socket emit failed (${eventName}):`, err.message);
  }
}

exports.getDashboard = asyncHandler(async (req, res) => {
  const stats = await getDashboardStats();
  res.json({ stats });
});

exports.getUsers = asyncHandler(async (req, res) => {
  const role = req.query.role ? String(req.query.role).toUpperCase() : undefined;
  const { page, limit, skip } = parsePagination(req.query);
  const { data: users, total } = await listUsers(role, { skip, limit });
  res.json({ users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.getWorkers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { data: workers, total } = await listWorkers({ skip, limit });
  res.json({ workers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});
exports.updateUser = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'User ID');
  const { isActive } = req.body;

  if (req.user.id === id && isActive === false) {
    throw new AppError(400, 'You cannot deactivate your own admin account.');
  }

  const user = await updateUserStatus(id, isActive);
  res.json({ user });

  emitAdminDataChanged('admin:users_updated', { userId: id, action: 'status', isActive });
  emitAdminDataChanged('admin:workers_updated', { userId: id, action: 'status', isActive });

  // Real-time notification to the specific user being updated
  try {
    if (getIo) {
      const io = getIo();
      io.to(`user:${id}`).emit('user:status_changed', { isActive });
    }
  } catch (err) {
    console.warn(`Private socket emit failed for user ${id}:`, err.message);
  }
});

exports.removeUser = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'User ID');

  if (req.user.id === id) {
    throw new AppError(400, 'You cannot delete your own admin account.');
  }

  await deleteUser(id);
  res.json({ message: 'User deleted successfully' });

  emitAdminDataChanged('admin:users_updated', { userId: id, action: 'delete' });
  emitAdminDataChanged('admin:workers_updated', { userId: id, action: 'delete' });
});

exports.getFraudAlerts = asyncHandler(async (req, res) => {
  const alerts = await getFraudAlerts();
  res.json(alerts);
});

// Coupon Management
exports.getCoupons = asyncHandler(async (req, res) => {
  const coupons = await listCoupons();
  res.json({ coupons });
});

exports.createCoupon = asyncHandler(async (req, res) => {
  const payload = {
    code: String(req.body.code || '').trim().toUpperCase(),
    discountType: req.body.discountType,
    discountValue: Number(req.body.discountValue),
    minOrderValue: req.body.minOrderValue ?? null,
    maxDiscount: req.body.maxDiscount ?? null,
    usageLimit: req.body.usageLimit ?? null,
    applicableTo: req.body.applicableTo ? String(req.body.applicableTo).trim().toUpperCase() : 'ALL',
    firstTimeOnly: req.body.firstTimeOnly ?? false,
    isActive: req.body.isActive ?? true,
    startDate: req.body.startDate ? new Date(req.body.startDate) : null,
    endDate: req.body.endDate ? new Date(req.body.endDate) : null,
  };

  const coupon = await createCoupon(payload);
  res.status(201).json({ coupon });
  emitAdminDataChanged('admin:coupons_updated', { action: 'create' });
});

exports.updateCouponStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'Coupon ID');
  const { isActive } = req.body;
  const coupon = await toggleCoupon(id, isActive);
  res.json({ coupon });
  emitAdminDataChanged('admin:coupons_updated', { action: 'update', couponId: id });
});

exports.removeCoupon = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'Coupon ID');
  await deleteCoupon(id);
  res.json({ message: 'Coupon deleted successfully' });
  emitAdminDataChanged('admin:coupons_updated', { action: 'delete', couponId: id });
});

exports.getAiAuditSummary = asyncHandler(async (_req, res) => {
  const summary = await getAiAuditSummary();
  res.json({ summary });
});

exports.getAiAudits = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filters = {
    userId: req.query.userId,
    intent: req.query.intent,
    status: req.query.status,
    channel: req.query.channel,
    from: req.query.from,
    to: req.query.to,
  };

  const { data, total } = await listAiAudits(filters, { skip, limit });
  res.json({
    audits: data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
