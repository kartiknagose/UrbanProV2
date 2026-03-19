// Weighted-score matching for worker assignment
function scoreWorker(worker) {
  // Weights: distance 30%, rating 25%, availability 20%, experience 15%, response rate 10%
  const distanceWeight = 0.3;
  const ratingWeight = 0.25;
  const availabilityWeight = 0.2;
  const experienceWeight = 0.15;
  const responseRateWeight = 0.1;

  const maxDistance = 20; // km, for normalization
  const distanceScore = Math.max(0, 1 - ((worker.distance || 0) / maxDistance));
  const ratingScore = worker.rating ? worker.rating / 5 : 0;
  const availabilityScore = worker.isAvailable ? 1 : 0;
  const experienceScore = worker.completedJobs ? Math.min(worker.completedJobs / 200, 1) : 0;
  const responseRateScore = worker.responseRate ? worker.responseRate : 0;

  return (
    distanceScore * distanceWeight +
    ratingScore * ratingWeight +
    availabilityScore * availabilityWeight +
    experienceScore * experienceWeight +
    responseRateScore * responseRateWeight
  );
}

// Auto-assignment and cascading logic
async function autoAssignWorker(bookingId, candidateWorkers) {
  const scoredWorkers = candidateWorkers.map(w => ({ ...w, score: scoreWorker(w) }))
    .sort((a, b) => b.score - a.score);

  for (const worker of scoredWorkers) {
    await offerBookingToWorker(bookingId, worker.id);
    const accepted = await waitForWorkerAcceptance(bookingId, worker.id, 5 * 60 * 1000);
    if (accepted) return worker.id;
  }
  return null; // No worker accepted
}

// Offer booking to a specific worker via Socket.IO notification
async function offerBookingToWorker(bookingId, workerId) {
  try {
    const prisma = require('../../config/prisma');
    const { getIo } = require('../../socket');

    // Get the worker's userId from their profile
    const profile = await prisma.workerProfile.findUnique({
      where: { id: workerId },
      select: { userId: true, user: { select: { name: true } } }
    });
    if (!profile) return;

    // Update booking to indicate it's being offered
    await prisma.booking.update({
      where: { id: bookingId },
      data: { offeredToWorkerId: workerId }
    });

    // Emit socket notification to the worker
    const io = getIo();
    io.to(`user:${profile.userId}`).emit('booking:offered', {
      bookingId,
      message: 'New booking offered to you. Accept within 5 minutes.',
    });

    // Create a notification record
    try {
      const { createNotification } = require('../notifications/notification.service');
      await createNotification({
        userId: profile.userId,
        type: 'BOOKING',
        title: 'New booking offered to you',
        message: `Booking #${bookingId} has been offered. Accept within 5 minutes.`,
        data: { bookingId }
      });
    } catch { /* notification failure shouldn't block assignment */ }
  } catch (err) {
    console.warn('offerBookingToWorker error:', err.message);
  }
}

// Wait for worker acceptance by polling DB
async function waitForWorkerAcceptance(bookingId, workerId, timeoutMs) {
  const prisma = require('../../config/prisma');
  const pollInterval = 5000; // 5 seconds
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, workerProfileId: true }
    });

    // Worker accepted (status changed to CONFIRMED and assigned to this worker)
    if (booking && booking.status === 'CONFIRMED' && booking.workerProfileId === workerId) {
      return true;
    }

    // Booking cancelled or already assigned to someone else
    if (booking && (booking.status === 'CANCELLED' || (booking.workerProfileId && booking.workerProfileId !== workerId))) {
      return false;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  return false; // Timed out
}
/**
 * BOOKING SERVICE - BUSINESS LOGIC LAYER
 * 
 * What is a "service" file?
 * This file contains the CORE BUSINESS LOGIC for bookings.
 * It talks directly to the database using Prisma ORM.
 * 
 * Think of it like a manager in a company:
 * - Controller (boss) tells the Service (manager) what to do
 * - Service (manager) does the actual work with the database (employees)
 * - Service returns results back to Controller
 * 
 * Why separate service from controller?
 * - Cleaner code organization
 * - Easier to test business logic
 * - Can reuse service functions in multiple places
 */

const prisma = require('../../config/prisma'); // Our database connection
const { randomInt } = require('crypto');
const AppError = require('../../common/errors/AppError');

// Helper to generate 4-digit OTP (1000–9999)
// Uses crypto.randomInt() — cryptographically secure, unlike Math.random().
const generateOTP = () => randomInt(1000, 10000).toString();

const SMSService = require('../notifications/sms.service');
const WhatsAppService = require('../notifications/whatsapp.service');
const GrowthService = require('../business_growth/business_growth.service');

/**
 * Fetch worker profile by userId. Throws AppError if not found.
 * @param {number} userId
 * @param {string} [errorMessage='Worker profile not found.']
 * @param {number} [statusCode=404]
 * @param {object} [include] - Optional Prisma include clause
 * @returns {Promise<object>} workerProfile
 */
async function requireWorkerProfile(userId, errorMessage = 'Worker profile not found.', statusCode = 404, include) {
  const profile = await prisma.workerProfile.findUnique({
    where: { userId },
    ...(include && { include }),
  });
  if (!profile) throw new AppError(statusCode, errorMessage);
  return profile;
}

/**
 * Check if a userId is the assigned worker for a booking.
 * Returns true/false without throwing.
 */
async function isWorkerForBooking(userId, booking) {
  const profile = await prisma.workerProfile.findUnique({ where: { userId } });
  return !!(profile && booking.workerProfileId === profile.id);
}


/**
 * CREATE A NEW BOOKING
 * 
 * Business Logic Flow:
 * 1. Check if the worker exists (can't book a non-existent worker)
 * 2. Check if the service exists (can't book a non-existent service)
 * 3. Check if the worker actually offers that service (plumber can't do electrical work)
 * 4. Create the booking in the database
 * 5. Return the new booking details
 * 
 * @param {number} customerId - The ID of the customer making the booking (from JWT token)
 * @param {object} bookingData - The booking details (workerId, serviceId, date, address, etc.)
 * @returns {Promise<object>} - The newly created booking
 * @throws {Error} - If validation fails (worker not found, service not offered, etc.)
 */
// HELPER: Check if worker is available for a given time slot.
// Uses estimatedDuration (minutes) from existing bookings and the new booking
// to detect true overlaps instead of a hardcoded 2-hour window.
// Accepts optional `client` param to run inside a transaction (defaults to global prisma).
const DEFAULT_DURATION_MINUTES = 120; // Fallback when estimatedDuration is not set

async function isWorkerAvailable(workerId, date, client = prisma, durationMinutes = DEFAULT_DURATION_MINUTES, excludeBookingId = null) {
  const newStart = new Date(date);
  const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);

  // 1. Check PENDING / CONFIRMED bookings — standard overlap on scheduledAt
  const pendingConfirmed = await client.booking.findMany({
    where: {
      workerProfileId: workerId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      scheduledAt: {
        gte: new Date(newStart.getTime() - 480 * 60 * 1000),
        lt: new Date(newEnd.getTime() + 480 * 60 * 1000),
      },
    },
    select: { scheduledAt: true, estimatedDuration: true },
  });

  const hasPendingConflict = pendingConfirmed.some((b) => {
    const existStart = new Date(b.scheduledAt);
    const existDur = b.estimatedDuration || DEFAULT_DURATION_MINUTES;
    const existEnd = new Date(existStart.getTime() + existDur * 60 * 1000);
    return existStart < newEnd && existEnd > newStart;
  });

  if (hasPendingConflict) return false;

  // 2. Session-aware check for IN_PROGRESS bookings.
  //    Worker is only blocked if:
  //    a) There is a currently-active session (isActive=true), OR
  //    b) There is a scheduled (future) session whose date overlaps the requested slot
  const inProgressBookings = await client.booking.findMany({
    where: {
      workerProfileId: workerId,
      status: 'IN_PROGRESS',
    },
    select: {
      id: true,
      scheduledAt: true,
      estimatedDuration: true,
      sessions: {
        select: { sessionDate: true, isActive: true, endTime: true },
      },
    },
  });

  for (const booking of inProgressBookings) {
    // If booking has no sessions, fall back to original overlap on scheduledAt
    if (!booking.sessions || booking.sessions.length === 0) {
      const existStart = new Date(booking.scheduledAt);
      const existDur = booking.estimatedDuration || DEFAULT_DURATION_MINUTES;
      const existEnd = new Date(existStart.getTime() + existDur * 60 * 1000);
      if (existStart < newEnd && existEnd > newStart) return false;
      continue;
    }

    for (const session of booking.sessions) {
      // Active session = worker is on-site right now → block
      if (session.isActive) return false;

      // Scheduled future session (not yet ended) — check overlap
      if (!session.endTime) {
        const sessStart = new Date(session.sessionDate);
        const sessDur = booking.estimatedDuration || DEFAULT_DURATION_MINUTES;
        const sessEnd = new Date(sessStart.getTime() + sessDur * 60 * 1000);
        if (sessStart < newEnd && sessEnd > newStart) return false;
      }
    }
  }

  return true;
}

// HELPER: Filter workers within X km of booking location using Haversine formula
async function filterWorkersByDistance(lat, lng, serviceId, radiusKm = 10) {
  // Prisma raw query for Haversine distance
  const workers = await prisma.$queryRaw`
    SELECT * FROM (
      SELECT wp.*, u.name, u.email, u.mobile, u."profilePhotoUrl", ws."serviceId",
        (6371 * acos(
          cos(radians(${lat})) * cos(radians(wp."baseLatitude")) *
          cos(radians(wp."baseLongitude") - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(wp."baseLatitude"))
        )) AS distance
      FROM "WorkerProfile" wp
      JOIN "User" u ON u.id = wp."userId"
      JOIN "WorkerService" ws ON ws."workerId" = wp.id
      LEFT JOIN "WorkerLocation" wl ON wl."workerProfileId" = wp.id
      WHERE ws."serviceId" = ${serviceId}
        AND wp."baseLatitude" IS NOT NULL
        AND wp."baseLongitude" IS NOT NULL
        AND (wl."isOnline" IS NULL OR wl."isOnline" = true)
    ) AS worker_results
    WHERE distance <= ${radiusKm}
    ORDER BY distance ASC
  `;
  return workers;
}

const axios = require('axios');
const GOOGLE_GEOCODING_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY;
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const { calculateDynamicPrice } = require('../pricing/pricing.service');

async function createBooking(customerId, bookingData) {
  let { workerProfileId, serviceId, scheduledDate, addressDetails, latitude, longitude, estimatedPrice, notes, estimatedDuration, couponCode, frequency } = bookingData;

  // BUSINESS GROWTH: Coupon Validation (Sprint 17)
  let appliedCoupon = null;
  if (couponCode) {
    // Fetch service for category info
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new AppError(404, 'Service not found.');

    appliedCoupon = await GrowthService.validateCoupon(couponCode, customerId, {
      bookingAmount: estimatedPrice,
      serviceCategory: service.category
    });
  }

  // Geocode address if lat/lng missing and addressDetails present
  if ((!latitude || !longitude) && addressDetails && GOOGLE_GEOCODING_API_KEY) {
    try {
      const geoResp = await axios.get(GOOGLE_GEOCODING_URL, {
        params: {
          address: addressDetails,
          key: GOOGLE_GEOCODING_API_KEY,
          language: 'en',
          region: 'IN',
        }
      });
      const geoResult = geoResp.data.results && geoResp.data.results[0];
      if (geoResult && geoResult.geometry && geoResult.geometry.location) {
        latitude = geoResult.geometry.location.lat;
        longitude = geoResult.geometry.location.lng;
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  }

  // FRAUD DETECTION: Booking Velocity
  // Prevent users from spamming bookings and cancelling them
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCancellations = await prisma.booking.count({
    where: {
      customerId,
      status: 'CANCELLED',
      updatedAt: { gte: oneHourAgo }
    }
  });

  if (recentCancellations >= 3) {
    throw new AppError(429, 'Suspicious activity detected. You have cancelled too many bookings recently. Please try again after an hour or contact support.');
  }

  // LOGIC BRANCH: Is this a Direct Booking (worker selected) or Open Booking (no worker)?
  const isDirectBooking = !!workerProfileId;

  // VALIDATE: Scheduled date must be in the future (at least 1 hour from now)
  const scheduledDateObj = new Date(scheduledDate);
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  if (scheduledDateObj <= now) {
    throw new AppError(400, 'Booking date must be in the future.');
  }

  if (scheduledDateObj < oneHourLater) {
    throw new AppError(400, 'Bookings must be scheduled at least 1 hour in advance.');
  }

  // VALIDATE: Customer cannot book themselves as a worker (implicit check - they shouldn't be a worker)
  // Removed restriction: Workers can now book services too.
  /* if (customer.role === 'WORKER') {
    throw new Error('Workers cannot book services (use customer account instead).');
  } */

  // VALIDATE: Address must be valid
  if (!addressDetails || addressDetails.length < 5) {
    throw new AppError(400, 'Please provide a valid address or select one on the map.');
  }

  // VALIDATE: Price must be positive (if provided)
  if (estimatedPrice !== undefined && (isNaN(estimatedPrice) || estimatedPrice < 0)) {
    throw new AppError(400, 'Estimated price must be a positive number.');
  }

  // VALIDATE: Price cannot exceed reasonable limit (e.g., $100,000)
  if (estimatedPrice !== undefined && estimatedPrice > 100000) {
    throw new AppError(400, 'Estimated price seems too high. Please check and try again.');
  }

  // VALIDATE: Worker specific checks (ONLY IF WORKER IS SELECTED)
  // All DB reads + the booking create are wrapped in a transaction to prevent
  // race conditions (two customers booking the same worker/slot simultaneously).
  const newBooking = await prisma.$transaction(async (tx) => {
    if (isDirectBooking) {
      // Verify the worker exists and has a worker profile
      const workerProfile = await tx.workerProfile.findUnique({
        where: { id: workerProfileId },
      });

      if (!workerProfile) {
        throw new AppError(404, 'Worker not found. Please select a valid worker.');
      }

      // CHECK 1: DISTANCE-BASED FILTERING (Haversine)
      if (latitude && longitude) {
        const nearbyWorkers = await filterWorkersByDistance(latitude, longitude, serviceId, workerProfile.serviceRadius || 10);
        const isNearby = nearbyWorkers.some(w => w.id === workerProfileId);
        if (!isNearby) {
          throw new AppError(400, `This worker is not within the service radius (${workerProfile.serviceRadius || 10} km) of the booking location.`);
        }
      }

      // CHECK 2: GEO-FENCING (Polygon)
      if (workerProfile.serviceAreas && Array.isArray(workerProfile.serviceAreas) && latitude && longitude) {
        // serviceAreas is an array of [lat, lng] pairs forming a polygon
        // Use ray-casting point-in-polygon algorithm
        const pointInPolygon = (point, polygon) => {
          let x = point[0], y = point[1];
          let inside = false;
          for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            let xi = polygon[i][0], yi = polygon[i][1];
            let xj = polygon[j][0], yj = polygon[j][1];
            let intersect = ((yi > y) !== (yj > y)) &&
              (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
            if (intersect) inside = !inside;
          }
          return inside;
        };

        if (!pointInPolygon([latitude, longitude], workerProfile.serviceAreas)) {
          throw new AppError(400, 'Booking location is outside the worker\'s service area. Please select a location within the defined zone.');
        }
      }

      // CHECK 2: AVAILABILITY (uses tx to read within the same transaction)
      if (!(await isWorkerAvailable(workerProfileId, scheduledDateObj, tx, estimatedDuration || DEFAULT_DURATION_MINUTES))) {
        throw new AppError(409, 'Worker is already booked for this time slot. Please choose another time.');
      }
    }

    // VALIDATE: Verify the service exists
    const service = await tx.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new AppError(404, 'Service not found. Please select a valid service.');
    }

    // VALIDATE: Verify the worker actually offers this service (ONLY IF WORKER IS SELECTED)
    if (isDirectBooking) {
      const workerOffersService = await tx.workerService.findUnique({
        where: {
          workerId_serviceId: {
            workerId: workerProfileId,
            serviceId: serviceId,
          },
        },
      });

      if (!workerOffersService) {
        throw new AppError(400, 'This worker does not offer the selected service. Please choose another worker or service.');
      }
    }

    // Calculate Dynamic Pricing Formula
    const pricing = await calculateDynamicPrice({
      serviceId,
      workerProfileId: isDirectBooking ? workerProfileId : null,
      scheduledAt: scheduledDateObj,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      basePriceOverride: Number(estimatedPrice) || 0
    });

    // Create the booking
    return await tx.booking.create({
      data: {
        customerId: customerId,
        workerProfileId: isDirectBooking ? workerProfileId : null,
        serviceId: serviceId,
        scheduledAt: scheduledDateObj,
        address: addressDetails,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        notes: notes,
        estimatedDuration: estimatedDuration || null,
        status: 'PENDING',
        totalPrice: appliedCoupon
          ? Math.max(0, Number(pricing.totalPrice) - appliedCoupon.discountAmount)
          : pricing.totalPrice,
        basePrice: pricing.basePrice,
        timeMultiplier: pricing.timeMultiplier,
        surgeMultiplier: pricing.surgeMultiplier,
        urgencyMultiplier: pricing.urgencyMultiplier,
        workerTierMultiplier: pricing.workerTierMultiplier,
        distanceSurcharge: pricing.distanceSurcharge,
        gstAmount: pricing.gstAmount,
        couponId: appliedCoupon?.couponId || null,
        couponAmount: appliedCoupon?.discountAmount || 0,
        frequency: frequency || 'ONE_TIME',
      },
      include: {
        service: {
          select: { id: true, name: true, category: true },
        },
        reviews: true,
        workerProfile: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
          },
        },
        customer: {
          select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true },
        },
      },
    });
  });

  // 5. If it's an OPEN booking (no worker selected), broadcast to matching workers
  if (!isDirectBooking && latitude && longitude) {
    // INTEGRATED PHASE 2.3: Intelligent Live Matching
    // 1. Find workers who are ONLINE and near the job
    const workersWithLiveLocation = await prisma.workerLocation.findMany({
      where: {
        isOnline: true,
        workerProfile: {
          services: { some: { serviceId } }
        }
      },
      include: {
        workerProfile: {
          include: {
            user: { select: { id: true, name: true } }
          }
        }
      }
    });

    // 2. Identify and Score Eligible Workers
    const eligibleWorkers = workersWithLiveLocation.map(loc => {
      const distance = Math.sqrt(
        Math.pow((loc.latitude - latitude) * 111, 2) +
        Math.pow((loc.longitude - longitude) * 111, 2)
      );

      // Simple Scoring Algorithm
      // Base: Distance (max 50 points, 0 if distance > 10km)
      const distanceScore = Math.max(0, 50 - (distance * 5));
      // Multiplier: Trust/Verification (max 50 points)
      const trustScore = (loc.workerProfile.verificationScore || 0) / 2;
      const levelBonus = loc.workerProfile.verificationLevel === 'PREMIUM' ? 20 :
        loc.workerProfile.verificationLevel === 'VERIFIED' ? 10 : 0;

      const totalScore = distanceScore + trustScore + levelBonus;

      return {
        ...loc.workerProfile,
        distance,
        matchScore: totalScore
      };
    }).filter(w => w.distance <= (w.serviceRadius || 10))
      .sort((a, b) => b.matchScore - a.matchScore);

    // 3. Launch cascading background auto-assignment (non-blocking)
    autoAssignWorker(newBooking.id, eligibleWorkers).catch(err => {
      console.error('Auto-assignment failed:', err);
    });
  }

  return newBooking;
}

/**
 * GET ALL BOOKINGS FOR A USER
 * 
 * Business Logic:
 * - If user is a CUSTOMER, show bookings they created
 * - If user is a WORKER, show bookings assigned to them
 * - If user is an ADMIN, show all bookings
 * 
 * Why filter by role?
 * - Customers shouldn't see other customers' bookings (privacy)
 * - Workers only need to see their own jobs
 * - Admins need full visibility for management
 * 
 * @param {number} userId - The ID of the user requesting bookings
 * @param {string} role - The user's role (CUSTOMER, WORKER, or ADMIN)
 * @returns {Promise<array>} - List of bookings for this user
 */
async function getBookingsByUser(userId, role, { skip = 0, limit = 20 } = {}) {
  let whereClause = {};

  if (role === 'CUSTOMER') {
    whereClause = { customerId: userId };
  } else if (role === 'WORKER') {
    const workerProfile = await prisma.workerProfile.findUnique({ where: { userId } });
    whereClause = { workerProfileId: workerProfile ? workerProfile.id : -1 };
  }

  const [data, total] = await Promise.all([
    prisma.booking.findMany({
      where: whereClause,
      include: {
        service: {
          select: { id: true, name: true, category: true },
        },
        reviews: {
          select: { id: true, reviewerId: true, rating: true },
        },
        photos: true,
        workerProfile: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
          },
        },
        customer: {
          select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where: whereClause }),
  ]);

  return { data, total };
}

/**
 * GET A SINGLE BOOKING BY ID
 * 
 * Business Logic:
 * - Anyone can view a booking IF they're involved in it
 * - Customers can view their own bookings
 * - Workers can view bookings assigned to them
 * - Admins can view any booking
 * 
 * @param {number} bookingId - The ID of the booking to retrieve
 * @param {number} userId - The ID of the user requesting the booking
 * @param {string} role - The user's role
 * @returns {Promise<object>} - The booking details
 * @throws {Error} - If booking not found or user doesn't have permission
 */
async function getBookingById(bookingId, userId, role) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: {
        select: { id: true, name: true, category: true, basePrice: true },
      },
      reviews: true,
      photos: true,
      workerProfile: {
        select: {
          id: true,
          userId: true,
          location: true,
          user: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } }
        },
      },
      customer: {
        select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true },
      },
    },
  });

  if (!booking) {
    throw new AppError(404, 'Booking not found.');
  }

  const isCustomer = booking.customerId === userId;
  const isWorker = role === 'WORKER' ? await isWorkerForBooking(userId, booking) : false;
  const isAdmin = role === 'ADMIN';

  if (!isCustomer && !isWorker && !isAdmin) {
    throw new AppError(403, 'You do not have permission to view this booking.');
  }

  return booking;
}

/**
 * UPDATE BOOKING STATUS
 * 
 * Business Logic:
 * - Only the WORKER assigned to the booking can change its status
 * - Admins can also change status (for management purposes)
 * - Customers cannot change status (they can only cancel)
 * 
 * Status Flow:
 * PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
 *    ↓
 * CANCELLED (can happen at any stage)
 * 
 * @param {number} bookingId - The ID of the booking to update
 * @param {string} newStatus - The new status (CONFIRMED, IN_PROGRESS, COMPLETED, etc.)
 * @param {number} userId - The ID of the user making the request
 * @param {string} role - The user's role
 * @returns {Promise<object>} - The updated booking
 * @throws {Error} - If booking not found or user doesn't have permission
 */
async function updateBookingStatus(bookingId, newStatus, userId, role) {
  // Fetch booking with transaction for atomicity
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new AppError(404, 'Booking not found.');
  }

  const isWorker = role === 'WORKER' ? await isWorkerForBooking(userId, booking) : false;
  const isAdmin = role === 'ADMIN';

  if (!isWorker && !isAdmin) {
    throw new AppError(403, 'Only the assigned worker or admin can update booking status.');
  }

  // Use transaction to prevent race conditions where two workers update simultaneously
  const updatedBooking = await prisma.$transaction(async (tx) => {
    // Re-fetch within transaction to get fresh data
    const currentBooking = await tx.booking.findUnique({
      where: { id: bookingId },
    });

    // Validate status transition
    const validTransitions = {
      'PENDING': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['IN_PROGRESS', 'CANCELLED'],
      'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [],
      'CANCELLED': [],
    };

    if (!validTransitions[currentBooking.status].includes(newStatus)) {
      throw new AppError(400, `Cannot transition from ${currentBooking.status} to ${newStatus}`);
    }

    // Update the booking
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
        // Generate Start OTP when confirmed
        ...(newStatus === 'CONFIRMED' && !currentBooking.startOtp && {
          startOtp: generateOTP(),
          otpGeneratedAt: new Date()
        }),
        // Generate Completion OTP when started (though workers usually use verifyBookingStart)
        ...(newStatus === 'IN_PROGRESS' && !currentBooking.completionOtp && {
          completionOtp: generateOTP(),
          otpGeneratedAt: new Date()
        })
      },
      include: {
        service: { select: { id: true, name: true, category: true } },
        reviews: true,
        workerProfile: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
          },
        },
        customer: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
      },
    });

    // Record audit trail
    await recordStatusChange(bookingId, currentBooking.status, newStatus, userId, null, tx);

    if (newStatus === 'COMPLETED') {
      await releaseEscrowIfEligible(bookingId, tx);
    }

    return updated;
  });

  return updatedBooking;
}

/**
 * CANCEL A BOOKING
 * 
 * Business Logic:
 * - Customers can cancel their own bookings
 * - Workers can cancel bookings assigned to them
 * - Admins can cancel any booking
 * - Cancellation reason is optional but recommended for transparency
 * 
 * @param {number} bookingId - The ID of the booking to cancel
 * @param {number} userId - The ID of the user cancelling
 * @param {string} role - The user's role
 * @param {string} cancellationReason - Why the booking is being cancelled (optional)
 * @returns {Promise<object>} - The cancelled booking
 * @throws {Error} - If booking not found or user doesn't have permission
 */
async function cancelBooking(bookingId, userId, role, cancellationReason) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new AppError(404, 'Booking not found.');
  }

  if (booking.status === 'CANCELLED') {
    throw new AppError(400, 'This booking is already cancelled.');
  }

  if (booking.status === 'COMPLETED') {
    throw new AppError(400, 'Cannot cancel a completed booking.');
  }

  const isCustomer = booking.customerId === userId;
  const isWorker = role === 'WORKER' ? await isWorkerForBooking(userId, booking) : false;
  const isAdmin = role === 'ADMIN';

  if (!isCustomer && !isWorker && !isAdmin) {
    throw new AppError(403, 'You do not have permission to cancel this booking.');
  }

  // Enforce cancellation policy (admins bypass penalties)
  const policy = getCancellationPolicy(booking);
  if (!policy.allowed) {
    throw new AppError(400, policy.reason);
  }

  const cancelledBooking = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancellationReason: cancellationReason || 'No reason provided',
        cancellationPenaltyPercent: isAdmin ? 0 : policy.penaltyPercent,
        updatedAt: new Date(),
      },
      include: {
        service: { select: { id: true, name: true, category: true } },
        reviews: true,
        workerProfile: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        customer: { select: { id: true, name: true, email: true } },
      },
    });
    await recordStatusChange(bookingId, booking.status, 'CANCELLED', userId, cancellationReason, tx);

    // Process Automated Refund if already PAID
    if (booking.paymentStatus === 'PAID' && booking.paymentReference && !!booking.totalPrice) {
      const penaltyPercent = isAdmin ? 0 : policy.penaltyPercent;
      const refundPercent = 100 - penaltyPercent;

      if (refundPercent > 0) {
        const rawAmount = Number(booking.totalPrice);
        const refundAmount = rawAmount * (refundPercent / 100);

        try {
          // const Razorpay = require('razorpay');
          // const rzp = new Razorpay({
          //   key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxx',
          //   key_secret: process.env.RAZORPAY_KEY_SECRET || 'xxxxxxxx'
          // });

          // In production, execute the refund via Razorpay APIs
          // await rzp.payments.refund(booking.paymentReference, { amount: Math.round(refundAmount * 100) });
          console.log(`[REFUND] Processed ₹${refundAmount.toFixed(2)} refund for Cancelled Booking #${bookingId}`);

          // Create payment record for local ledger tracking
          await tx.payment.create({
            data: {
              bookingId: bookingId,
              customerId: booking.customerId,
              amount: refundAmount,
              status: 'REFUNDED',
              reference: `refund-${Date.now()}`
            }
          });

          // BUSINESS GROWTH: Refund to Wallet (Sprint 17 - #83)
          await GrowthService.depositCredits(
            booking.customerId,
            refundAmount,
            `Refund for cancelled booking #${booking.id}`,
            `REFUND-${booking.id}`,
            tx
          );

          updated.paymentStatus = 'REFUNDED';
          await tx.booking.update({
            where: { id: bookingId },
            data: { paymentStatus: 'REFUNDED' }
          });
        } catch (err) {
          console.error('[REFUND] Gateway Refund/Wallet Deposit failed:', err.message);
        }
      }
    }

    return updated;
  });

  return cancelledBooking;
}

/**
 * PROCESS ESCROW PAYOUT (Triggered safely across payment & completion hooks)
 * Releases held funds into the worker's withdrawable wallet natively.
 */
async function releaseEscrowIfEligible(bookingId, tx) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, workerProfile: true }
  });

  // Only release if PAID AND COMPLETED, and hasn't been split yet (workerPayoutAmount is null)
  if (booking && booking.status === 'COMPLETED' && booking.paymentStatus === 'PAID' && booking.workerPayoutAmount === null && booking.workerProfileId) {
    const rawAmount = Number(booking.totalPrice) || 0;
    const commRate = Number(booking.service.commissionRate) || 15.0;
    const platformCut = rawAmount * (commRate / 100);
    const workerCut = rawAmount - platformCut;

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        platformCommission: platformCut,
        workerPayoutAmount: workerCut,
      }
    });

    await tx.workerProfile.update({
      where: { id: booking.workerProfileId },
      data: {
        walletBalance: { increment: workerCut }
      }
    });

    // Notify worker of escrow release
    try {
      const io = require('../../socket').getIo();
      io.to(`user:${booking.workerProfile.userId}`).emit('payout:released', {
        bookingId, amount: workerCut, message: 'Escrow funds released to your wallet'
      });
    } catch (err) {
      console.warn('Socket emit ignored for escrow:', err.message);
    }
  }
}

/**
 * PAY FOR A BOOKING
 *
 * Business Logic:
 * - Only the booking customer can pay
 * - Cannot pay cancelled booking
 * - Marks paymentStatus as PAID and sets paidAt
 */
async function payBooking(bookingId, userId, userRole, reqOptions) {
  const options = typeof reqOptions === 'string' ? { paymentReference: reqOptions } : (reqOptions || {});
  const {
    paymentReference,
    paymentOrderId,
    paymentSignature,
    createRazorpayOrder,
    isWebhook,
  } = options;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: { select: { id: true } } },
  });

  if (!booking) {
    throw new AppError(404, 'Booking not found.');
  }

  const isCashPayment = paymentReference === 'CASH';

  // Webhooks from Razorpay bypass the strict user identity check
  if (!isWebhook) {
    if (isCashPayment) {
      if (userRole !== 'WORKER') {
        throw new AppError(403, 'Only the assigned worker can verify cash collection.');
      }
      const isWorker = await isWorkerForBooking(userId, booking);
      if (!isWorker) {
        throw new AppError(403, 'You are not assigned to this booking to collect cash.');
      }
      if (booking.status !== 'COMPLETED' && booking.status !== 'IN_PROGRESS') {
        throw new AppError(400, 'Cash can only be collected during or after the service is started.');
      }
    } else {
      if (userRole !== 'CUSTOMER' || booking.customerId !== userId) {
        throw new AppError(403, 'Only the booking customer can pay for this booking.');
      }
    }
  }

  if (booking.status === 'CANCELLED') {
    throw new AppError(400, 'Cannot pay for a cancelled booking.');
  }

  if (booking.paymentStatus === 'PAID') {
    throw new AppError(400, 'Booking is already paid.');
  }

  if (createRazorpayOrder) {
    if (isCashPayment) throw new AppError(400, 'Cannot create online order for cash payment.');
    const { createRazorpayOrder: createOrderHelper } = require('../payments/payment.service');
    const amount = Number(booking.totalPrice) || Number(booking.estimatedPrice) || 0;
    if (amount <= 0) {
      throw new AppError(400, 'Invalid payment amount.');
    }
    const order = await createOrderHelper(bookingId, amount);
    return { order };
  }

  if (!isCashPayment && !isWebhook) {
    if (!paymentReference || !paymentOrderId || !paymentSignature) {
      throw new AppError(400, 'Missing payment verification details.');
    }

    const {
      verifyRazorpayPaymentSignature,
      fetchRazorpayOrder,
    } = require('../payments/payment.service');

    const isSignatureValid = verifyRazorpayPaymentSignature({
      orderId: paymentOrderId,
      paymentId: paymentReference,
      signature: paymentSignature,
    });

    if (!isSignatureValid) {
      throw new AppError(400, 'Invalid payment signature.');
    }

    const razorpayOrder = await fetchRazorpayOrder(paymentOrderId);
    const expectedAmount = Math.round((Number(booking.totalPrice) || Number(booking.estimatedPrice) || 0) * 100);

    if (!razorpayOrder || razorpayOrder.status !== 'paid') {
      throw new AppError(400, 'Payment has not been captured yet.');
    }

    if (Number(razorpayOrder.amount) !== expectedAmount) {
      throw new AppError(400, 'Payment amount mismatch.');
    }

    const notedBookingId = Number(razorpayOrder.notes?.bookingId);
    if (notedBookingId !== Number(bookingId)) {
      throw new AppError(400, 'Payment does not belong to this booking.');
    }
  }

  const reference = paymentReference || 'CASH';

  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'PAID',
        paymentReference: reference,
        paidAt: new Date(),
      },
      include: {
        service: { select: { id: true, name: true, category: true, commissionRate: true } },
        workerProfile: { select: { id: true, userId: true, user: { select: { id: true, name: true, profilePhotoUrl: true, rating: true, totalReviews: true } } } },
        customer: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
      },
    });

    await tx.payment.create({
      data: {
        bookingId: bookingId,
        customerId: booking.customerId,
        amount: updated.totalPrice || null,
        status: 'PAID',
        reference,
      },
    });

    if (isCashPayment && booking.workerProfileId) {
      // CASH: Worker keeps physical cash, so we deduct the platform's cut from their digital wallet
      const rawAmount = Number(updated.totalPrice) || 0;
      const commRate = Number(updated.service.commissionRate) || 15.0;
      const platformCut = rawAmount * (commRate / 100);
      const workerCut = rawAmount - platformCut;

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          platformCommission: platformCut,
          workerPayoutAmount: workerCut,
        }
      });

      await tx.workerProfile.update({
        where: { id: booking.workerProfileId },
        data: {
          walletBalance: { decrement: platformCut }
        }
      });

      try {
        const io = require('../../socket').getIo();
        io.to(`user:${updated.workerProfile.userId}`).emit('payout:deducted', {
          bookingId, amount: platformCut, message: `Platform fee deducted since you collected cash.`
        });
      } catch (_err) {
        // Ignore socket error
      }
    } else {
      // Normal Online Payment
      await releaseEscrowIfEligible(bookingId, tx);
    }

    return updated;
  });
}

/**
 * GET OPEN BOOKINGS FOR A WORKER
 * 
 * Business Logic:
 * - Worker sees jobs matching their SKILLS/SERVICES
 * - Worker sees jobs in their AREA (if we had location filtering)
 * - Only shows PENDING jobs with NO assigned worker
 */
async function getOpenBookingsForWorker(userId, { skip = 0, limit = 20 } = {}) {
  // 1. Get the worker's profile and their services
  const worker = await requireWorkerProfile(userId, 'Worker profile not found.', 404, {
    services: { select: { serviceId: true } }
  });

  const workerServiceIds = worker.services.map(s => s.serviceId);

  const where = {
    status: 'PENDING',
    workerProfileId: null, // Open booking
    serviceId: { in: workerServiceIds } // Matches worker's skills
  };

  // 2. Find PENDING bookings with NO worker assigned, matching their services
  const [openBookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, category: true, basePrice: true } },
        customer: {
          select: {
            id: true,
            name: true,
            addresses: {
              take: 1,
              select: { city: true }
            }
          }
        }
      },
      orderBy: {
        scheduledAt: 'asc' // Show urgent jobs first
      },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  // 3. Filter by Location (Service Area)
  // Only show jobs where the job address matches one of the worker's service areas
  const relevantBookings = openBookings.filter(booking => {
    if (!worker.serviceAreas || worker.serviceAreas.length === 0) return true;
    if (!booking.address) return false;
    return worker.serviceAreas.some(area => booking.address.toLowerCase().includes(area.toLowerCase()));
  });

  // Map to flatten city for frontend convenience
  return {
    data: relevantBookings.map(booking => ({
      ...booking,
      customer: {
        ...booking.customer,
        city: booking.customer.addresses?.[0]?.city || 'Local Area'
      }
    })),
    total,
  };
}

/**
 * ACCEPT AN OPEN BOOKING
 * 
 * Business Logic:
 * - Worker claims a job
 * - Status changes PENDING -> CONFIRMED
 * - Worker ID is assigned to the booking
 */
async function acceptBooking(bookingId, userId) {
  const worker = await requireWorkerProfile(userId, 'Only registered workers can accept bookings.', 403);

  // Transaction to ensure no two workers accept the same job at the exact same millisecond
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) throw new AppError(404, 'Booking not found.');

    // For direct bookings: only the assigned worker can accept
    if (booking.workerProfileId !== null && booking.workerProfileId !== worker.id) {
      throw new AppError(409, 'This booking has already been accepted by another worker.');
    }

    if (booking.status !== 'PENDING') {
      throw new AppError(409, 'Booking is no longer available.');
    }

    // CHECK AVAILABILITY: Prevents double booking (uses booking's estimatedDuration)
    if (!(await isWorkerAvailable(worker.id, booking.scheduledAt, tx, booking.estimatedDuration || DEFAULT_DURATION_MINUTES, bookingId))) {
      throw new AppError(409, 'You cannot accept this job because you have another booking scheduled near this time.');
    }

    // Assign to worker and confirm, generating Start OTP
    const otp = generateOTP();
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        workerProfileId: worker.id,
        status: 'CONFIRMED',
        startOtp: otp,
        otpGeneratedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        customer: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
        workerProfile: { select: { id: true, userId: true, user: { select: { id: true, name: true, profilePhotoUrl: true, rating: true, totalReviews: true } } } },
        service: true
      }
    });

    await recordStatusChange(bookingId, 'PENDING', 'CONFIRMED', userId, 'Worker accepted booking', tx);

    // MOCK SMS/WA INTEGRATION
    try {
      if (updated.customer?.mobile) {
        SMSService.sendBookingOTP(updated.customer.mobile, updated.startOtp, 'START');
        WhatsAppService.sendTemplateMessage(updated.customer.mobile, 'CONFIRMATION', {
          customerName: updated.customer.name,
          serviceName: updated.service?.name || 'Service',
          time: new Date(updated.scheduledAt || Date.now()).toLocaleString(),
          workerName: updated.workerProfile?.user?.name,
          estimate: updated.totalPrice || updated.estimatedPrice || updated.basePrice
        });
      }
    } catch (e) { console.error('SMS Mock Failed', e); }

    return updated;
  });
}

const LocationService = require('../location/location.service'); // Added for geo-fencing

/**
 * ... (existing functions) ...
 */

/**
 * VERIFY OTP TO START JOB
 * Worker enters OTP provided by Customer
 */
async function verifyBookingStart(bookingId, otp, userId, workerCoords = null) {
  const worker = await requireWorkerProfile(userId, 'Only workers can start jobs.', 403);

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) throw new AppError(404, 'Booking not found.');
  if (booking.workerProfileId !== worker.id) throw new AppError(403, 'You are not assigned to this job.');
  if (booking.status !== 'CONFIRMED') throw new AppError(400, 'Job must be CONFIRMED before starting.');

  // FRAUD DETECTION: Geo-fencing
  // Ensure worker is within 1km (1000m) of the booking location if both have coordinates
  if (booking.latitude && booking.longitude && workerCoords?.latitude && workerCoords?.longitude) {
    const distance = LocationService.calculateDistance(
      booking.latitude,
      booking.longitude,
      workerCoords.latitude,
      workerCoords.longitude
    );

    // Threshold: 1KM (more lenient than 500m to account for GPS drift)
    if (distance > 1) {
      throw new AppError(400, `Geo-verification failed. You are ${distance.toFixed(2)}km away from the job location. Please arrive at the customer address before starting the job.`);
    }
  }

  // Enforce 30-minute OTP expiry
  if (booking.otpGeneratedAt) {
    const minutesSinceGenerated = (Date.now() - new Date(booking.otpGeneratedAt).getTime()) / (1000 * 60);
    if (minutesSinceGenerated > 30) {
      throw new AppError(400, 'Start OTP has expired (30-minute limit). Please ask the customer to request a new one.');
    }
  }

  if (booking.startOtp !== otp) {
    throw new AppError(400, 'Invalid Start OTP.');
  }

  // OTP Valid -> Start Job and generate Completion OTP
  const updatedBooking = await prisma.$transaction(async (tx) => {
    const nextOtp = generateOTP();
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        completionOtp: nextOtp,
        otpGeneratedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        service: { select: { id: true, name: true, category: true } },
        reviews: true,
        workerProfile: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
          },
        },
        customer: {
          select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true },
        },
      },
    });

    await recordStatusChange(bookingId, 'CONFIRMED', 'IN_PROGRESS', userId, 'OTP verified — job started', tx);

    return updated;
  });

  // MOCK SMS/WA INTEGRATION
  try {
    if (updatedBooking.customer?.mobile) {
      SMSService.sendBookingOTP(updatedBooking.customer.mobile, updatedBooking.completionOtp, 'COMPLETE');
      WhatsAppService.sendTemplateMessage(updatedBooking.customer.mobile, 'ON_THE_WAY', {
        workerName: updatedBooking.workerProfile?.user?.name
      });
    }
  } catch (e) { console.error('SMS Mock Failed', e); }

  return updatedBooking;
}

/**
 * VERIFY OTP TO COMPLETE JOB
 * Worker enters OTP provided by Customer
 */
async function verifyBookingCompletion(bookingId, otp, userId) {
  const worker = await requireWorkerProfile(userId, 'Only workers can complete jobs.', 403);

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) throw new AppError(404, 'Booking not found.');
  if (booking.workerProfileId !== worker.id) throw new AppError(403, 'You are not assigned to this job.');
  if (booking.status !== 'IN_PROGRESS') throw new AppError(400, 'Job must be IN_PROGRESS before completing.');

  // Enforce 30-minute OTP expiry
  if (booking.otpGeneratedAt) {
    const minutesSinceGenerated = (Date.now() - new Date(booking.otpGeneratedAt).getTime()) / (1000 * 60);
    if (minutesSinceGenerated > 30) {
      throw new AppError(400, 'Completion OTP has expired (30-minute limit). Please ask the customer to request a new one.');
    }
  }

  if (booking.completionOtp !== otp) {
    throw new AppError(400, 'Invalid Completion OTP.');
  }

  const runNonBlocking = async (label, fn) => {
    try {
      await fn();
    } catch (err) {
      console.error(`[BOOKING_COMPLETE] ${label} failed for booking ${bookingId}:`, err.message);
    }
  };

  // OTP Valid -> Complete Job
  const updatedBooking = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        service: { select: { id: true, name: true, category: true } },
        reviews: true,
        workerProfile: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
          },
        },
        customer: {
          select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true },
        },
      },
    });

    await recordStatusChange(bookingId, 'IN_PROGRESS', 'COMPLETED', userId, 'OTP verified — job completed', tx);

    return updated;
  });

  // Run non-critical post-completion tasks outside the status transaction.
  // This prevents transient downstream failures from returning 500 on OTP verify.
  if (booking.couponId) {
    await runNonBlocking('Coupon usage increment', async () => {
      await prisma.coupon.update({
        where: { id: booking.couponId },
        data: { usageCount: { increment: 1 } }
      });
    });
  }

  await runNonBlocking('Referral bonus award', async () => {
    await GrowthService.awardReferralBonus(bookingId);
  });

  const totalPrice = Number(updatedBooking.totalPrice || 0);
  if (Number.isFinite(totalPrice) && totalPrice > 0) {
    await runNonBlocking('Loyalty points award', async () => {
      await GrowthService.awardLoyaltyPoints(updatedBooking.customerId, totalPrice);
    });
  }

  await runNonBlocking('Recurring booking handling', async () => {
    await handleRecurringBooking(updatedBooking, prisma);
  });

  await runNonBlocking('Escrow release', async () => {
    await releaseEscrowIfEligible(bookingId, prisma);
  });

  // MOCK SMS/WA INTEGRATION
  try {
    if (updatedBooking.customer?.mobile) {
      WhatsAppService.sendTemplateMessage(updatedBooking.customer.mobile, 'COMPLETED', {
        serviceName: updatedBooking.service?.name,
        total: updatedBooking.totalPrice || updatedBooking.estimatedPrice
      });
    }
  } catch (e) { console.error('SMS Mock Failed', e); }

  return updatedBooking;
}

/**
 * Refresh booking OTP for start/completion verification.
 * Only assigned worker can request a refresh; OTP is sent to customer mobile.
 */
async function refreshBookingOtp(bookingId, userId, otpType) {
  const worker = await requireWorkerProfile(userId, 'Only workers can request OTP refresh.', 403);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { id: true, name: true, mobile: true } },
      service: { select: { name: true } },
    },
  });

  if (!booking) throw new AppError(404, 'Booking not found.');
  if (booking.workerProfileId !== worker.id) throw new AppError(403, 'You are not assigned to this job.');

  const normalizedType = typeof otpType === 'string' ? otpType.trim().toUpperCase() : '';

  let resolvedType;
  if (normalizedType === 'START' || normalizedType === 'COMPLETE') {
    resolvedType = normalizedType;
  } else if (booking.status === 'CONFIRMED') {
    resolvedType = 'START';
  } else if (booking.status === 'IN_PROGRESS') {
    resolvedType = 'COMPLETE';
  } else {
    throw new AppError(400, 'OTP refresh is only available for CONFIRMED or IN_PROGRESS bookings.');
  }

  if (resolvedType === 'START' && booking.status !== 'CONFIRMED') {
    throw new AppError(400, 'Start OTP can only be refreshed while booking is CONFIRMED.');
  }
  if (resolvedType === 'COMPLETE' && booking.status !== 'IN_PROGRESS') {
    throw new AppError(400, 'Completion OTP can only be refreshed while booking is IN_PROGRESS.');
  }

  if (booking.otpGeneratedAt) {
    const secondsSinceLastOtp = Math.floor((Date.now() - new Date(booking.otpGeneratedAt).getTime()) / 1000);
    if (secondsSinceLastOtp < 30) {
      throw new AppError(429, `Please wait ${30 - secondsSinceLastOtp} seconds before requesting another OTP.`);
    }
  }

  const nextOtp = generateOTP();
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...(resolvedType === 'START' ? { startOtp: nextOtp } : { completionOtp: nextOtp }),
      otpGeneratedAt: new Date(),
      updatedAt: new Date(),
    },
    include: {
      customer: { select: { id: true, name: true, mobile: true } },
      service: { select: { name: true } },
    },
  });

  try {
    if (updated.customer?.mobile) {
      SMSService.sendBookingOTP(updated.customer.mobile, nextOtp, resolvedType);
    }
  } catch (err) {
    console.error('OTP refresh SMS failed:', err.message);
  }

  return {
    bookingId: updated.id,
    otpType: resolvedType,
    otpCode: nextOtp,
    expiresInMinutes: 30,
  };
}

// Export all service functions so controllers can use them
module.exports = {
  createBooking,
  getBookingsByUser,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  payBooking,
  getOpenBookingsForWorker,
  acceptBooking,
  verifyBookingStart,
  verifyBookingCompletion,
  refreshBookingOtp,
  // Session management (Phase 7)
  getBookingSessions,
  createSession,
  handleRecurringBooking,
  startSession,
  endSession,
  // Audit trail (Phase 7)
  recordStatusChange,
  // Booking lifecycle (Phase 7)
  rescheduleBooking,
  expirePendingBookings,
  // Overrun detection & Cancellation policy (Phase 7)
  detectOverrunSessions,
  getCancellationPolicy,
};

// ─── SESSION MANAGEMENT (Phase 7) ──────────────────────────────────

/**
 * Get all sessions for a booking.
 */
async function getBookingSessions(bookingId, userId, role) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new AppError(404, 'Booking not found.');

  // Auth check: customer, assigned worker, or admin
  const isCustomer = booking.customerId === userId;
  const isWorker = role === 'WORKER' ? await isWorkerForBooking(userId, booking) : false;
  const isAdmin = role === 'ADMIN';
  if (!isCustomer && !isWorker && !isAdmin) {
    throw new AppError(403, 'You do not have permission to view sessions for this booking.');
  }

  return prisma.bookingSession.findMany({
    where: { bookingId },
    orderBy: { sessionDate: 'asc' },
  });
}

/**
 * Create a follow-up session for a multi-day booking.
 * Only the assigned worker can schedule a next visit.
 * Booking must be IN_PROGRESS.
 */
async function createSession(bookingId, userId, { sessionDate, notes }) {
  const worker = await requireWorkerProfile(userId, 'Only workers can schedule sessions.', 403);

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new AppError(404, 'Booking not found.');
  if (booking.workerProfileId !== worker.id) throw new AppError(403, 'You are not assigned to this booking.');
  if (booking.status !== 'IN_PROGRESS') throw new AppError(400, 'Booking must be IN_PROGRESS to schedule a session.');

  const sessionDateObj = new Date(sessionDate);
  if (sessionDateObj <= new Date()) {
    throw new AppError(400, 'Session date must be in the future.');
  }

  // Ensure no overlapping active session
  const activeSession = await prisma.bookingSession.findFirst({
    where: { bookingId, isActive: true },
  });
  if (activeSession) {
    throw new AppError(409, 'There is already an active session. End it before scheduling the next one.');
  }

  // Generate OTP for this session's start verification
  const otp = generateOTP();

  return prisma.bookingSession.create({
    data: {
      bookingId,
      sessionDate: sessionDateObj,
      startOtp: otp,
      notes: notes || null,
    },
  });
}

/**
 * Start a session (worker verifies the session OTP).
 * Sets isActive=true, startTime=now, otpVerified=true.
 */
async function startSession(sessionId, otp, userId) {
  const worker = await requireWorkerProfile(userId, 'Only workers can start sessions.', 403);

  const session = await prisma.bookingSession.findUnique({
    where: { id: sessionId },
    include: { booking: true },
  });

  if (!session) throw new AppError(404, 'Session not found.');
  if (session.booking.workerProfileId !== worker.id) throw new AppError(403, 'You are not assigned to this booking.');
  if (session.isActive) throw new AppError(400, 'Session is already active.');
  if (session.endTime) throw new AppError(400, 'Session has already ended.');

  // Enforce 30-minute OTP expiry (session OTP generated at session creation)
  const sessionOtpAge = (Date.now() - new Date(session.createdAt).getTime()) / (1000 * 60);
  if (sessionOtpAge > 30) {
    throw new AppError(400, 'Session OTP has expired (30-minute limit). Please schedule a new session.');
  }

  if (session.startOtp !== otp) {
    throw new AppError(400, 'Invalid session OTP.');
  }

  return prisma.bookingSession.update({
    where: { id: sessionId },
    data: {
      isActive: true,
      startTime: new Date(),
      otpVerified: true,
    },
  });
}

/**
 * End an active session.
 * Sets isActive=false, endTime=now.
 */
async function endSession(sessionId, userId, { notes } = {}) {
  const worker = await requireWorkerProfile(userId, 'Only workers can end sessions.', 403);

  const session = await prisma.bookingSession.findUnique({
    where: { id: sessionId },
    include: { booking: true },
  });

  if (!session) throw new AppError(404, 'Session not found.');
  if (session.booking.workerProfileId !== worker.id) throw new AppError(403, 'You are not assigned to this booking.');
  if (!session.isActive) throw new AppError(400, 'Session is not currently active.');

  return prisma.bookingSession.update({
    where: { id: sessionId },
    data: {
      isActive: false,
      endTime: new Date(),
      ...(notes && { notes }),
    },
  });
}

// ─── AUDIT TRAIL (Phase 7) ─────────────────────────────────────────

/**
 * Record a status change in the audit trail.
 */
async function recordStatusChange(bookingId, fromStatus, toStatus, changedBy, reason, client = prisma) {
  return client.bookingStatusHistory.create({
    data: {
      bookingId,
      fromStatus,
      toStatus,
      changedBy,
      reason: reason || null,
    },
  });
}

// ─── RESCHEDULING (Phase 7) ────────────────────────────────────────

/**
 * Reschedule a booking to a new date/time.
 * Preserves worker assignment. Only PENDING or CONFIRMED bookings can be rescheduled.
 */
async function rescheduleBooking(bookingId, userId, role, { newScheduledDate }) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new AppError(404, 'Booking not found.');

  // Only customer, assigned worker, or admin can reschedule
  const isCustomer = booking.customerId === userId;
  const isWorker = role === 'WORKER' ? await isWorkerForBooking(userId, booking) : false;
  const isAdmin = role === 'ADMIN';
  if (!isCustomer && !isWorker && !isAdmin) {
    throw new AppError(403, 'You do not have permission to reschedule this booking.');
  }

  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw new AppError(400, 'Only PENDING or CONFIRMED bookings can be rescheduled.');
  }

  const newDate = new Date(newScheduledDate);
  const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
  if (newDate < oneHourLater) {
    throw new AppError(400, 'New date must be at least 1 hour in the future.');
  }

  // If worker is assigned, check their availability at the new time
  if (booking.workerProfileId) {
    const available = await isWorkerAvailable(
      booking.workerProfileId,
      newDate,
      prisma,
      booking.estimatedDuration || DEFAULT_DURATION_MINUTES,
      booking.id
    );
    if (!available) {
      throw new AppError(409, 'Worker is not available at the new time. Please choose another time.');
    }
  }

  const oldDate = booking.scheduledAt;
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { scheduledAt: newDate },
    include: {
      service: { select: { id: true, name: true, category: true } },
      workerProfile: {
        select: {
          id: true, userId: true,
          user: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
        },
      },
      customer: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
    },
  });

  await recordStatusChange(bookingId, booking.status, booking.status, userId,
    `Rescheduled from ${oldDate.toISOString()} to ${newDate.toISOString()}`);

  return updated;
}

// ─── BOOKING TIMEOUT / AUTO-EXPIRY (Phase 7) ──────────────────────

/**
 * Expire PENDING bookings older than the given threshold.
 * Called by a scheduled job (cron). Returns count of expired bookings.
 */
async function expirePendingBookings(hoursThreshold = 24) {
  const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

  const expired = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    select: { id: true, status: true },
  });

  if (expired.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.booking.updateMany({
      where: { id: { in: expired.map(b => b.id) } },
      data: { status: 'CANCELLED', cancellationReason: 'Auto-expired: no worker accepted within the time limit.' },
    });

    // Record audit trail for each
    for (const b of expired) {
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: b.id,
          fromStatus: b.status,
          toStatus: 'CANCELLED',
          changedBy: null, // System-initiated
          reason: 'Auto-expired: no worker accepted within the time limit.',
        },
      });
    }
  });

  return expired.length;
}

// ─── OVERRUN DETECTION (Phase 7) ──────────────────────────────────

/**
 * Detect active sessions that have exceeded the booking's estimated duration.
 * Returns list of overrun sessions with booking/customer info for notification.
 * Called by a scheduled job (e.g., every 15 minutes).
 */
async function detectOverrunSessions() {
  const activeSessions = await prisma.bookingSession.findMany({
    where: { isActive: true, startTime: { not: null } },
    include: {
      booking: {
        select: {
          id: true,
          estimatedDuration: true,
          customerId: true,
          service: { select: { name: true } },
          workerProfile: {
            select: { user: { select: { name: true } } },
          },
        },
      },
    },
  });

  const now = new Date();
  const overruns = [];

  for (const session of activeSessions) {
    const durationMs = now.getTime() - session.startTime.getTime();
    const expectedMs = (session.booking.estimatedDuration || DEFAULT_DURATION_MINUTES) * 60 * 1000;

    if (durationMs > expectedMs) {
      const overrunMinutes = Math.round((durationMs - expectedMs) / 60000);
      overruns.push({
        sessionId: session.id,
        bookingId: session.booking.id,
        customerId: session.booking.customerId,
        serviceName: session.booking.service?.name,
        workerName: session.booking.workerProfile?.user?.name,
        overrunMinutes,
        startTime: session.startTime,
      });
    }
  }

  return overruns;
}

// ─── CANCELLATION POLICY (Phase 7) ────────────────────────────────

/**
 * Calculate cancellation penalty based on timing.
 * Returns: { allowed, penaltyPercent, reason }
 *
 * Policy:
 * - > 24h before: free cancellation (0%)
 * - 12–24h before: 25% penalty
 * - 2–12h before: 50% penalty
 * - < 2h before: 100% penalty (no refund)
 * - IN_PROGRESS: 100% penalty
 */
function getCancellationPolicy(booking) {
  if (booking.status === 'IN_PROGRESS') {
    return { allowed: true, penaltyPercent: 100, reason: 'Job is already in progress — full charge applies.' };
  }

  if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
    return { allowed: false, penaltyPercent: 0, reason: `Cannot cancel a ${booking.status.toLowerCase()} booking.` };
  }

  const hoursUntil = (new Date(booking.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursUntil > 24) {
    return { allowed: true, penaltyPercent: 0, reason: 'Free cancellation (more than 24 hours before scheduled time).' };
  }
  if (hoursUntil > 12) {
    return { allowed: true, penaltyPercent: 25, reason: '25% cancellation fee (12–24 hours before scheduled time).' };
  }
  if (hoursUntil > 2) {
    return { allowed: true, penaltyPercent: 50, reason: '50% cancellation fee (2–12 hours before scheduled time).' };
  }
  return { allowed: true, penaltyPercent: 100, reason: 'Full charge — cancellation less than 2 hours before scheduled time.' };
}

/**
 * Handle recurring bookings (Sprint 17 - #78)
 * Creates the next scheduled booking if the original had a frequency.
 */
async function handleRecurringBooking(booking, tx) {
  if (!booking.frequency || booking.frequency === 'ONE_TIME') return;

  const nextScheduledAt = new Date(booking.scheduledAt);
  
  if (booking.frequency === 'WEEKLY') {
    nextScheduledAt.setDate(nextScheduledAt.getDate() + 7);
  } else if (booking.frequency === 'BI_WEEKLY') {
    nextScheduledAt.setDate(nextScheduledAt.getDate() + 14);
  } else if (booking.frequency === 'MONTHLY') {
    nextScheduledAt.setMonth(nextScheduledAt.getMonth() + 1);
  } else {
    return; // Safety for unknown frequencies
  }

  // Create the next booking object
  // Auto-assign to same worker for continuity
  const nextBooking = await tx.booking.create({
    data: {
      customerId: booking.customerId,
      workerProfileId: booking.workerProfileId,
      serviceId: booking.serviceId,
      scheduledAt: nextScheduledAt,
      address: booking.address,
      latitude: booking.latitude,
      longitude: booking.longitude,
      notes: booking.notes,
      estimatedDuration: booking.estimatedDuration,
      status: 'PENDING',
      totalPrice: booking.totalPrice,
      basePrice: booking.basePrice,
      timeMultiplier: booking.timeMultiplier,
      surgeMultiplier: booking.surgeMultiplier,
      urgencyMultiplier: booking.urgencyMultiplier,
      workerTierMultiplier: booking.workerTierMultiplier,
      distanceSurcharge: booking.distanceSurcharge,
      gstAmount: booking.gstAmount,
      frequency: booking.frequency, // Multi-instance chain
    }
  });

  console.log(`[RECURRING] Chain created: Booking #${booking.id} -> #${nextBooking.id} (${booking.frequency})`);
  
  // Notify customer about the next instance
  try {
    const { createNotification } = require('../notifications/notification.service');
    await createNotification({
      userId: booking.customerId,
      type: 'BOOKING',
      title: 'Next Recurring Booking Scheduled',
      message: `Your next ${booking.frequency.toLowerCase().replace('_', ' ')} booking is scheduled for ${nextScheduledAt.toLocaleDateString()}.`,
      data: { bookingId: nextBooking.id }
    }, tx);
  } catch (err) {
    console.warn('Recurring notification failed:', err.message);
  }
}

