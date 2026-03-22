// server/src/socket.js
// Simple Socket.IO initializer and accessor for the app.
// Usage:
//  const { init } = require('./socket');
//  const io = init(httpServer);
//  // In controllers: const { getIo } = require('./socket'); getIo().emit(...)

const { CORS_ORIGIN } = require('./config/env');
const { verifyJwt } = require('./common/utils/jwt');
let ioInstance = null;

const parsePositiveId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

function init(server) {
  // Lazy-require to avoid adding heavy deps when not needed in tests
  const { Server } = require('socket.io');
  const isDev = process.env.NODE_ENV !== 'production';

  // Allow `CORS_ORIGIN` to be a single origin or a comma-separated list
  // (eg. "http://localhost:5173,http://localhost:5174"). Socket.IO accepts
  // either a string or an array for the `origin` option; normalize here.
  const configuredOrigins = String(CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = configuredOrigins.length > 0
    ? configuredOrigins
    : (isDev ? '*' : false);

  ioInstance = new Server(server, {
    cors: {
      origin,
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
  ioInstance.use((socket, next) => {
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

      socket.user = payload; // { id, role }
      return next();
    } catch (_err) {
      return next(new Error('Authentication failed.'));
    }
  });

  ioInstance.on('connection', (socket) => {
    console.log('Socket connected:', socket.id, 'userId=', socket.user.id, 'role=', socket.user.role);

    // ─── Auto-join user-specific rooms based on verified identity ───
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === 'WORKER') socket.join(`worker:${socket.user.id}`);
    if (socket.user.role === 'CUSTOMER') socket.join(`customer:${socket.user.id}`);
    if (socket.user.role === 'ADMIN') socket.join('admin');

    // ─── SECURITY: Validate room join requests ───
    // Users can only join rooms they are authorized for:
    //   - Their own user/worker/customer room (already auto-joined above)
    //   - 'admin' room only if role is ADMIN
    //   - 'booking:X' rooms (for live booking updates) — allowed for any authenticated user
    // All other room join attempts are silently rejected.
    socket.on('joinRoom', async (room) => {
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
    });

    socket.on('leaveRoom', (room) => {
      if (typeof room !== 'string' || room.length === 0 || room.length > 100) return;
      // Only allow leaving dynamic rooms (not their own user/role rooms)
      if (room.startsWith('booking:') || room.startsWith('conversation:') || room.startsWith('worker_tracking:')) {
        socket.leave(room);
      }
    });

    socket.on('disconnect', () => {
      // noop for now
    });
  });

  return ioInstance;
}

function getIo() {
  if (!ioInstance) throw new Error('Socket.IO not initialized. Call init(server) first.');
  return ioInstance;
}

module.exports = { init, getIo };
