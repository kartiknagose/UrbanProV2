// server/src/socket.js
// Simple Socket.IO initializer and accessor for the app.
// Usage:
//  const { init } = require('./socket');
//  const io = init(httpServer);
//  // In controllers: const { getIo } = require('./socket'); getIo().emit(...)

const { allowedOrigins, matchesAllowedOrigin } = require('./config/cors');
const { verifyJwt } = require('./common/utils/jwt');
const { getTokenVersion } = require('./common/utils/tokenVersion');
let ioInstance = null;

const parsePositiveId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Location update throttling map: userId -> lastUpdateTime
const locationThrottles = new Map();

function init(server) {
  // Lazy-require to avoid adding heavy deps when not needed in tests
  const { Server } = require('socket.io');
  const isDev = process.env.NODE_ENV !== 'production';

  const hasConfiguredOrigins = Array.isArray(allowedOrigins) && allowedOrigins.length > 0;
  const socketCorsOrigin = (origin, callback) => {
    if (!hasConfiguredOrigins) {
      callback(null, true);
      return;
    }

    if (matchesAllowedOrigin(origin, allowedOrigins)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  };

  ioInstance = new Server(server, {
    cors: {
      origin: socketCorsOrigin,
      credentials: true,
    },
    allowRequest: isDev ? (_req, callback) => callback(null, true) : undefined,
  });

  // ─── Redis Adapter for horizontal scaling ───
  try {
    const { createAdapter, pubClient, subClient } = require('./config/socketRedis');
    // ioredis auto-connects, no need for .connect() calls
    ioInstance.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.IO Redis adapter enabled');
  } catch (err) {
    console.warn('Socket.IO Redis adapter not enabled:', err.message);
  }

  // ─── SECURITY: Authenticate ALL socket connections ───
  // Parse the JWT from the cookie header. If the token is missing or invalid,
  // REJECT the connection entirely. This prevents unauthenticated users from
  // eavesdropping on any real-time events (SOS alerts, bookings, admin data).
  ioInstance.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers?.cookie || '';
      const match = cookieHeader.match(/(?:^|; )token=([^;]+)/);
      const token = match ? decodeURIComponent(match[1]) : null;

      if (!token) {
        return next(new Error('Authentication required — no token provided.'));
      }

      const payload = verifyJwt(token);
      if (!payload || !payload.id) {
        return next(new Error('Authentication required — invalid or expired token.'));
      }

      const currentVersion = await getTokenVersion(payload.id);
      const tokenVersion = Number.isInteger(Number(payload.tv)) ? Number(payload.tv) : 0;
      if (currentVersion < 0) {
        return next(new Error('Authentication service unavailable.'));
      }
      if (tokenVersion !== currentVersion) {
        return next(new Error('Authentication required — session expired.'));
      }

      socket.user = payload; // { id, role }
      return next();
    } catch (_err) {
      return next(new Error('Authentication failed.'));
    }
  });

  ioInstance.on('connection', async (socket) => {
    console.log('Socket connected:', socket.id, 'userId=', socket.user.id, 'role=', socket.user.role);

    // ─── Auto-join user-specific rooms based on verified identity ───
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === 'WORKER') socket.join(`worker:${socket.user.id}`);
    if (socket.user.role === 'CUSTOMER') socket.join(`customer:${socket.user.id}`);
    if (socket.user.role === 'ADMIN') socket.join('admin');

    // ─── WORKER ENGAGEMENT: Auto-guidance for availability ───
    if (socket.user.role === 'WORKER') {
      // Do not block listener registration on this background reminder check.
      (async () => {
        try {
          const prisma = require('./config/prisma');
          const profile = await prisma.workerProfile.findUnique({
            where: { userId: socket.user.id },
            select: { availability: true }
          });

          if (profile) {
            const dayOfWeek = new Date().getDay();
            const availabilityToday = profile.availability?.some((a) => a.dayOfWeek === dayOfWeek);

            // Send availability reminder if not set for today
            if (!availabilityToday) {
              const { createNotification } = require('./modules/notifications/notification.service');
              await createNotification({
                userId: socket.user.id,
                type: 'AVAILABILITY_REMINDER',
                title: 'Set your availability',
                message: 'You haven\'t set your availability for today. Add your working hours to receive more bookings.',
                data: { actionUrl: '/worker/availability', actionType: 'SET_AVAILABILITY' }
              });
            }
          }
        } catch (err) {
          console.warn('Worker availability check error:', err.message);
        }
      })();
    }

    // ─── SECURITY: Validate room join requests ───
    // Users can only join rooms they are authorized for:
    //   - Their own user/worker/customer room (already auto-joined above)
    //   - 'admin' room only if role is ADMIN
    //   - 'booking:X' rooms (for live booking updates) — allowed for any authenticated user
    // All other room join attempts are silently rejected.
    socket.on('joinRoom', async (room) => {
      try {
        if (typeof room !== 'string' || room.length === 0 || room.length > 100) return;

        if (room.startsWith('booking:')) {
          const bookingId = parsePositiveId(room.split(':')[1]);
          if (!bookingId) return;

          const prisma = require('./config/prisma');
          const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            select: {
              id: true,
              customerId: true,
              workerProfile: { select: { userId: true } },
            },
          });

          if (!booking) return;

          const isAllowed =
            socket.user.role === 'ADMIN'
            || booking.customerId === socket.user.id
            || booking.workerProfile?.userId === socket.user.id;

          if (!isAllowed) {
            console.warn(`Socket ${socket.id} denied join to booking room: ${room}`);
            return;
          }

          socket.join(room);
          return;
        }

        if (room.startsWith('conversation:')) {
          const conversationId = parsePositiveId(room.split(':')[1]);
          if (!conversationId) return;

          const prisma = require('./config/prisma');
          const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: {
              id: true,
              customerId: true,
              workerUserId: true,
            },
          });

          if (!conversation) return;

          const isAllowed =
            socket.user.role === 'ADMIN'
            || conversation.customerId === socket.user.id
            || conversation.workerUserId === socket.user.id;

          if (!isAllowed) {
            console.warn(`Socket ${socket.id} denied join to conversation room: ${room}`);
            return;
          }

          socket.join(room);
          return;
        }

        if (room.startsWith('worker_tracking:')) {
          const workerProfileId = parsePositiveId(room.split(':')[1]);
          if (!workerProfileId) return;

          const prisma = require('./config/prisma');

          if (socket.user.role === 'ADMIN') {
            socket.join(room);
            return;
          }

          if (socket.user.role === 'WORKER') {
            const ownProfile = await prisma.workerProfile.findUnique({
              where: { userId: socket.user.id },
              select: { id: true },
            });

            if (ownProfile?.id === workerProfileId) {
              socket.join(room);
              return;
            }

            console.warn(`Socket ${socket.id} denied join to worker tracking room: ${room}`);
            return;
          }

          const hasRelevantBooking = await prisma.booking.findFirst({
            where: {
              workerProfileId,
              customerId: socket.user.id,
              status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
            },
            select: { id: true },
          });

          if (!hasRelevantBooking) {
            console.warn(`Socket ${socket.id} denied join to worker tracking room: ${room}`);
            return;
          }

          socket.join(room);
          return;
        }

        // Block all other room joins — users already have their role rooms
        // This prevents non-admins from joining 'admin', and users from
        // joining other users' private rooms.
        console.warn(`Socket ${socket.id} (user:${socket.user.id}) denied join to room: ${room}`);
      } catch (err) {
        console.error(`Socket ${socket.id} joinRoom error for "${room}":`, err.message);
        socket.emit('error', { message: 'Could not join room. Please try again.' });
      }
    });

    socket.on('leaveRoom', (room) => {
      if (typeof room !== 'string' || room.length === 0 || room.length > 100) return;
      // Only allow leaving dynamic rooms (not their own user/role rooms)
      if (room.startsWith('booking:') || room.startsWith('conversation:') || room.startsWith('worker_tracking:')) {
        socket.leave(room);
      }
    });

    // ─── LOCATION TRACKING with Throttling (4.8) ───
    // Workers can update their location via socket, but we throttle to prevent
    // excessive database writes. Only allow updates every 10 seconds.
    socket.on('location:update', async (data, ack) => {
      const respond = (payload) => {
        if (typeof ack === 'function') {
          ack(payload);
        }
      };

      if (socket.user.role !== 'WORKER') {
        respond({ ok: false, reason: 'forbidden' });
        return;
      }

      try {
        const prisma = require('./config/prisma');
        const key = `loc:${socket.user.id}`;
        const lastUpdate = locationThrottles.get(key) || 0;
        const now = Date.now();

        // Fast in-memory throttle for single-process hot path.
        if (now - lastUpdate < 10000) {
          respond({ ok: true, throttled: true, source: 'memory' });
          return;
        }

        // Validate incoming data
        const latitude = Number(data?.latitude);
        const longitude = Number(data?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          respond({ ok: false, reason: 'invalid_coordinates' });
          return;
        }

        // Get worker profile ID for this user
        const profile = await prisma.workerProfile.findUnique({
          where: { userId: socket.user.id },
          select: { id: true },
        });

        if (!profile) {
          respond({ ok: false, reason: 'worker_profile_not_found' });
          return;
        }

        // Strong throttle guard backed by DB timestamp so reconnects/multi-instance
        // cannot bypass the 10-second write window.
        const existingLocation = await prisma.workerLocation.findUnique({
          where: { workerProfileId: profile.id },
          select: { lastUpdated: true },
        });

        if (existingLocation?.lastUpdated) {
          const lastDbUpdate = new Date(existingLocation.lastUpdated).getTime();
          if (Number.isFinite(lastDbUpdate) && now - lastDbUpdate < 10000) {
            respond({ ok: true, throttled: true, source: 'database' });
            return;
          }
        }

        locationThrottles.set(key, now);

        // Upsert location (create if not exists, update if exists)
        await prisma.workerLocation.upsert({
          where: { workerProfileId: profile.id },
          update: {
            latitude,
            longitude,
            lastUpdated: new Date(),
          },
          create: {
            workerProfileId: profile.id,
            latitude,
            longitude,
            lastUpdated: new Date(),
          },
        });

        respond({ ok: true, throttled: false });
      } catch (err) {
        console.error(`Socket ${socket.id} location update error:`, err.message);
        respond({ ok: false, reason: 'internal_error' });
      }
    });

    socket.on('disconnect', () => {
      // Clean up throttle entries for this user on disconnect
      locationThrottles.delete(`loc:${socket.user.id}`);
    });
  });

  return ioInstance;
}

function getIo() {
  if (!ioInstance) throw new Error('Socket.IO not initialized. Call init(server) first.');
  return ioInstance;
}

module.exports = { init, getIo };
