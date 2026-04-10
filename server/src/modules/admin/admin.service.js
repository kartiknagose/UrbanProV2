const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');

const DASHBOARD_CACHE_TTL_MS = 10000;
let dashboardCache = {
  data: null,
  expiresAt: 0,
};

async function getDashboardStats() {
  if (dashboardCache.data && dashboardCache.expiresAt > Date.now()) {
    return dashboardCache.data;
  }

  const [users, workers, services, bookings, pendingBookings, pendingVerifications] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { role: 'WORKER', deletedAt: null } }),
    prisma.service.count(),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: 'PENDING' } }),
    prisma.workerVerificationApplication.count({ where: { status: 'PENDING' } }),
  ]);

  const result = {
    users,
    workers,
    services,
    bookings,
    pendingBookings,
    pendingVerifications,
  };

  dashboardCache = {
    data: result,
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
  };

  return result;
}

async function listUsers(role, { skip = 0, limit = 20 } = {}) {
  const where = {
    deletedAt: null,
    ...(role ? { role } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        isActive: true,
        emailVerified: true,
        profilePhotoUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  return { data, total };
}

async function listWorkers({ skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    prisma.workerProfile.findMany({
      where: {
        user: {
          deletedAt: null,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            profilePhotoUrl: true,
          },
        },
        services: {
          include: {
            service: { select: { id: true, name: true, category: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
      skip,
      take: limit,
    }),
    prisma.workerProfile.count({
      where: {
        user: {
          deletedAt: null,
        },
      },
    }),
  ]);
  return { data, total };
}

async function updateUserStatus(userId, isActive) {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new AppError(404, 'User not found.');
    }
    throw error;
  }
}

async function deleteUser(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, mobile: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new AppError(404, 'User not found.');
    }

    const ts = Date.now();
    const tombstoneEmail = `deleted_${user.id}_${ts}_${user.email}`;
    const tombstoneMobile = `deleted_${user.id}_${ts}`;

    return await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
        emailVerified: false,
        email: tombstoneEmail,
        mobile: tombstoneMobile,
        referralCode: null,
      },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new AppError(404, 'User not found.');
    }
    throw error;
  }
}

/**
 * Get Suspicious Activity Alerts
 */
async function getFraudAlerts() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [highCancellers, badWorkers] = await Promise.all([
    // Users who cancelled > 2 bookings in last hour
    prisma.user.findMany({
      where: {
        bookingsCustomer: {
          some: {
            status: 'CANCELLED',
            updatedAt: { gte: oneHourAgo }
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: { bookingsCustomer: { where: { status: 'CANCELLED', updatedAt: { gte: oneHourAgo } } } }
        }
      }
    }),
    // Workers with multiple 1-star reviews
    prisma.workerProfile.findMany({
      where: {
        bookingsWorker: {
          some: {
            reviews: {
              some: { rating: { lte: 2 } }
            }
          }
        }
      },
      include: {
        user: { select: { name: true, email: true } },
        _count: {
          select: { bookingsWorker: { where: { reviews: { some: { rating: { lte: 2 } } } } } }
        }
      },
      take: 10
    })
  ]);

  return {
    highCancellers: highCancellers.filter(u => u._count.bookingsCustomer > 1).map(u => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      type: 'VELOCITY_ALERT',
      reason: `${u._count.bookingsCustomer} cancellations in 1 hour`,
      severity: 'HIGH'
    })),
    badWorkers: badWorkers.map(w => ({
      workerId: w.id,
      name: w.user.name,
      email: w.user.email,
      type: 'QUALITY_ALERT',
      reason: `${w._count.bookingsWorker} low ratings recently`,
      severity: 'MEDIUM'
    }))
  };
}

/**
 * Coupon Management (Sprint 17)
 */
async function createCoupon(data) {
  const discountType = String(data.discountType || '').toUpperCase();
  if (!['PERCENTAGE', 'FIXED'].includes(discountType)) {
    throw new AppError(400, 'Invalid discount type.');
  }

  const discountValue = Number(data.discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw new AppError(400, 'discountValue must be greater than zero.');
  }

  if (discountType === 'PERCENTAGE' && discountValue > 100) {
    throw new AppError(400, 'Percentage discount cannot exceed 100.');
  }

  const payload = {
    code: String(data.code || '').trim().toUpperCase(),
    discountType,
    discountValue,
    minOrderValue: data.minOrderValue == null ? null : Number(data.minOrderValue),
    maxDiscount: data.maxDiscount == null ? null : Number(data.maxDiscount),
    usageLimit: data.usageLimit == null ? null : Number(data.usageLimit),
    applicableTo: data.applicableTo == null ? null : String(data.applicableTo).trim().toUpperCase(),
    firstTimeOnly: Boolean(data.firstTimeOnly),
    isActive: data.isActive == null ? true : Boolean(data.isActive),
    startDate: data.startDate || null,
    endDate: data.endDate || null,
  };

  try {
    return await prisma.coupon.create({ data: payload });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'Coupon code already exists.');
    }
    throw error;
  }
}

async function listCoupons() {
  return prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

async function toggleCoupon(id, isActive) {
  try {
    return await prisma.coupon.update({
      where: { id },
      data: { isActive }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new AppError(404, 'Coupon not found.');
    }
    throw error;
  }
}

async function deleteCoupon(id) {
  try {
    return await prisma.coupon.delete({
      where: { id }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new AppError(404, 'Coupon not found.');
    }
    throw error;
  }
}

async function getAiAuditSummary() {
  const [total, failed, declined, byIntentRows, byChannelRows] = await Promise.all([
    prisma.aIActionAudit.count(),
    prisma.aIActionAudit.count({ where: { status: 'FAILED' } }),
    prisma.aIActionAudit.count({ where: { status: 'DECLINED' } }),
    prisma.aIActionAudit.groupBy({
      by: ['intent'],
      _count: { _all: true },
      orderBy: { _count: { intent: 'desc' } },
      take: 8,
    }),
    prisma.aIActionAudit.groupBy({
      by: ['channel'],
      _count: { _all: true },
      orderBy: { _count: { channel: 'desc' } },
    }),
  ]);

  return {
    total,
    failed,
    declined,
    byIntent: byIntentRows.map((row) => ({ intent: row.intent, count: row._count._all })),
    byChannel: byChannelRows.map((row) => ({ channel: row.channel, count: row._count._all })),
  };
}

async function listAiAudits(filters = {}, { skip = 0, limit = 20 } = {}) {
  const where = {};

  if (filters.userId) {
    where.userId = Number(filters.userId);
  }

  if (filters.intent) {
    where.intent = String(filters.intent).toLowerCase();
  }

  if (filters.status) {
    where.status = String(filters.status).toUpperCase();
  }

  if (filters.channel) {
    where.channel = String(filters.channel).toUpperCase();
  }

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) where.createdAt.lte = new Date(filters.to);
  }

  const [data, total] = await Promise.all([
    prisma.aIActionAudit.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.aIActionAudit.count({ where }),
  ]);

  return { data, total };
}

module.exports = {
  getDashboardStats,
  listUsers,
  listWorkers,
  updateUserStatus,
  deleteUser,
  getFraudAlerts,
  createCoupon,
  listCoupons,
  toggleCoupon,
  deleteCoupon,
  getAiAuditSummary,
  listAiAudits,
};
