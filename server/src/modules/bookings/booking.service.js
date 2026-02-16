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

// Helper to generate 4-digit OTP
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();


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
// HELPER: Check if worker is available (2-hour buffer)
async function isWorkerAvailable(workerId, date) {
  const start = new Date(date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

  // Check for overlapping bookings
  // A booking overlaps if it starts before our end AND ends after our start
  // We check for any booking that starts within a +/- 2 hour window of the requested time

  const conflictingBooking = await prisma.booking.findFirst({
    where: {
      workerProfileId: workerId,
      // PENDING direct requests also block the slot to prevent double-booking 
      // while the worker is deciding.
      status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
      scheduledAt: {
        gte: new Date(start.getTime() - 119 * 60 * 1000), // Check ~2 hours before
        lt: end // Check up until our end time
      }
    }
  });

  return !conflictingBooking;
}

// HELPER: Check if address is in worker's service area
function isLocationMatch(workerServiceAreas, address) {
  if (!workerServiceAreas || !Array.isArray(workerServiceAreas) || workerServiceAreas.length === 0) return true;
  if (!address) return false;

  const normalizedAddress = address.toLowerCase();
  // Check if any defined service area is part of the address string
  return workerServiceAreas.some(area => normalizedAddress.includes(area.toLowerCase()));
}

async function createBooking(customerId, bookingData) {
  const { workerProfileId, serviceId, scheduledDate, addressDetails, estimatedPrice, notes } = bookingData;

  // LOGIC BRANCH: Is this a Direct Booking (worker selected) or Open Booking (no worker)?
  const isDirectBooking = !!workerProfileId;

  // VALIDATE: Scheduled date must be in the future (at least 1 hour from now)
  const scheduledDateObj = new Date(scheduledDate);
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  if (scheduledDateObj <= now) {
    throw new Error('Booking date must be in the future.');
  }

  if (scheduledDateObj < oneHourLater) {
    throw new Error('Bookings must be scheduled at least 1 hour in advance.');
  }

  // VALIDATE: Customer cannot book themselves as a worker (implicit check - they shouldn't be a worker)
  const customer = await prisma.user.findUnique({ where: { id: customerId } });
  // Removed restriction: Workers can now book services too.
  /* if (customer.role === 'WORKER') {
    throw new Error('Workers cannot book services (use customer account instead).');
  } */

  // VALIDATE: Worker specific checks (ONLY IF WORKER IS SELECTED)
  if (isDirectBooking) {
    // Verify the worker exists and has a worker profile
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { id: workerProfileId },
    });

    if (!workerProfile) {
      throw new Error('Worker not found. Please select a valid worker.');
    }

    // CHECK 1: LOCATION
    if (!isLocationMatch(workerProfile.serviceAreas, addressDetails)) {
      throw new Error(`This worker only accepts jobs in: ${workerProfile.serviceAreas?.join(', ') || 'their local area'}. Address provided: ${addressDetails}`);
    }

    // CHECK 2: AVAILABILITY
    if (!(await isWorkerAvailable(workerProfileId, scheduledDateObj))) {
      throw new Error('Worker is already booked for this time slot. Please choose another time.');
    }
  }

  // VALIDATE: Verify the service exists
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new Error('Service not found. Please select a valid service.');
  }

  // VALIDATE: Verify the worker actually offers this service (ONLY IF WORKER IS SELECTED)
  if (isDirectBooking) {
    const workerOffersService = await prisma.workerService.findUnique({
      where: {
        workerId_serviceId: {
          workerId: workerProfileId,
          serviceId: serviceId,
        },
      },
    });

    if (!workerOffersService) {
      throw new Error('This worker does not offer the selected service. Please choose another worker or service.');
    }
  }

  // VALIDATE: Address must be at least 10 characters
  if (!addressDetails || addressDetails.length < 10) {
    throw new Error('Address must be at least 10 characters long.');
  }

  // VALIDATE: Price must be positive (if provided)
  if (estimatedPrice !== undefined && (isNaN(estimatedPrice) || estimatedPrice < 0)) {
    throw new Error('Estimated price must be a positive number.');
  }

  // VALIDATE: Price cannot exceed reasonable limit (e.g., $100,000)
  if (estimatedPrice !== undefined && estimatedPrice > 100000) {
    throw new Error('Estimated price seems too high. Please check and try again.');
  }

  // Create booking with transaction to ensure atomicity
  const newBooking = await prisma.booking.create({
    data: {
      customerId: customerId,

      workerProfileId: isDirectBooking ? workerProfileId : null, // Null for Open Booking
      serviceId: serviceId,
      scheduledAt: scheduledDateObj,
      address: addressDetails,
      totalPrice: estimatedPrice,
      notes: notes,
      status: 'PENDING',
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
async function getBookingsByUser(userId, role) {
  let whereClause = {};

  if (role === 'CUSTOMER') {
    whereClause = { customerId: userId };
  } else if (role === 'WORKER') {
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (workerProfile) {
      whereClause = { workerProfileId: workerProfile.id };
    } else {
      whereClause = { workerProfileId: -1 };
    }
  }

  const bookings = await prisma.booking.findMany({
    where: whereClause,
    include: {
      service: {
        select: { id: true, name: true, category: true },
      },
      reviews: {
        select: { id: true, reviewerId: true, rating: true },
      },
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
  });

  return bookings;
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
      workerProfile: {
        select: {
          id: true,
          userId: true,
          user: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } }
        },
      },
      customer: {
        select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true },
      },
    },
  });

  if (!booking) {
    throw new Error('Booking not found.');
  }

  const isCustomer = booking.customerId === userId;
  let isWorker = false;
  if (role === 'WORKER') {
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId },
    });
    isWorker = workerProfile && booking.workerProfileId === workerProfile.id;
  }
  const isAdmin = role === 'ADMIN';

  if (!isCustomer && !isWorker && !isAdmin) {
    throw new Error('You do not have permission to view this booking.');
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
    throw new Error('Booking not found.');
  }

  let isWorker = false;
  if (role === 'WORKER') {
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId },
    });
    isWorker = workerProfile && booking.workerProfileId === workerProfile.id;
  }
  const isAdmin = role === 'ADMIN';

  if (!isWorker && !isAdmin) {
    throw new Error('Only the assigned worker or admin can update booking status.');
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
      throw new Error(`Cannot transition from ${currentBooking.status} to ${newStatus}`);
    }

    // Update the booking
    return await tx.booking.update({
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
    throw new Error('Booking not found.');
  }

  if (booking.status === 'CANCELLED') {
    throw new Error('This booking is already cancelled.');
  }

  if (booking.status === 'COMPLETED') {
    throw new Error('Cannot cancel a completed booking.');
  }

  const isCustomer = booking.customerId === userId;
  let isWorker = false;
  if (role === 'WORKER') {
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId },
    });
    isWorker = workerProfile && booking.workerProfileId === workerProfile.id;
  }
  const isAdmin = role === 'ADMIN';

  if (!isCustomer && !isWorker && !isAdmin) {
    throw new Error('You do not have permission to cancel this booking.');
  }

  const cancelledBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
      cancellationReason: cancellationReason || 'No reason provided',
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

  return cancelledBooking;
}

/**
 * PAY FOR A BOOKING
 *
 * Business Logic:
 * - Only the booking customer can pay
 * - Cannot pay cancelled booking
 * - Marks paymentStatus as PAID and sets paidAt
 */
async function payBooking(bookingId, userId, userRole, paymentReference) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: { select: { id: true } } },
  });

  if (!booking) {
    throw new Error('Booking not found.');
  }

  if (userRole !== 'CUSTOMER' || booking.customerId !== userId) {
    throw new Error('Only the booking customer can pay for this booking.');
  }

  if (booking.status === 'CANCELLED') {
    throw new Error('Cannot pay for a cancelled booking.');
  }

  if (booking.paymentStatus === 'PAID') {
    throw new Error('Booking is already paid.');
  }

  const reference = paymentReference || `manual-${Date.now()}`;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'PAID',
        paymentReference: reference,
        paidAt: new Date(),
      },
      include: {
        service: { select: { id: true, name: true, category: true } },
        workerProfile: { select: { id: true, userId: true, user: { select: { id: true, name: true, profilePhotoUrl: true, rating: true, totalReviews: true } } } },
        customer: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
      },
    });

    await tx.payment.create({
      data: {
        bookingId: bookingId,
        customerId: userId,
        amount: updated.totalPrice || null,
        status: 'PAID',
        reference,
      },
    });

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
async function getOpenBookingsForWorker(userId) {
  // 1. Get the worker's profile and their services
  const worker = await prisma.workerProfile.findUnique({
    where: { userId },
    include: {
      services: {
        select: { serviceId: true }
      }
    }
  });

  if (!worker) {
    throw new Error('Worker profile not found.');
  }

  const workerServiceIds = worker.services.map(s => s.serviceId);

  // 2. Find PENDING bookings with NO worker assigned, matching their services
  const openBookings = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      workerProfileId: null, // Open booking
      serviceId: { in: workerServiceIds } // Matches worker's skills
    },
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
    }
  });

  // 3. Filter by Location (Service Area)
  // Only show jobs where the job address matches one of the worker's service areas
  const relevantBookings = openBookings.filter(booking => {
    return isLocationMatch(worker.serviceAreas, booking.address);
  });

  // Map to flatten city for frontend convenience
  return relevantBookings.map(booking => ({
    ...booking,
    customer: {
      ...booking.customer,
      city: booking.customer.addresses?.[0]?.city || 'Local Area'
    }
  }));
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
  const worker = await prisma.workerProfile.findUnique({
    where: { userId }
  });

  if (!worker) {
    throw new Error('Only registered workers can accept bookings.');
  }

  // Transaction to ensure no two workers accept the same job at the exact same millisecond
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) throw new Error('Booking not found.');

    if (booking.workerProfileId !== null) {
      throw new Error('This booking has already been accepted by another worker.');
    }

    if (booking.status !== 'PENDING') {
      throw new Error('Booking is no longer available.');
    }

    // CHECK AVAILABILITY: Prevents double booking
    if (!(await isWorkerAvailable(worker.id, booking.scheduledAt))) {
      throw new Error('You cannot accept this job because you have another booking scheduled near this time.');
    }

    // Assign to worker and confirm, generating Start OTP
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        workerProfileId: worker.id,
        status: 'CONFIRMED',
        startOtp: generateOTP(),
        otpGeneratedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        customer: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, rating: true, totalReviews: true } },
        workerProfile: { select: { id: true, userId: true, user: { select: { id: true, name: true, profilePhotoUrl: true, rating: true, totalReviews: true } } } },
        service: true
      }
    });

    return updated; // In real app, SMS/Email this OTP to customer
  });

}

/**
 * VERIFY OTP TO START JOB
 * Worker enters OTP provided by Customer
 */
async function verifyBookingStart(bookingId, otp, userId) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId } });
  if (!worker) throw new Error('Only workers can start jobs.');

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) throw new Error('Booking not found.');
  if (booking.workerProfileId !== worker.id) throw new Error('You are not assigned to this job.');
  if (booking.status !== 'CONFIRMED') throw new Error('Job must be CONFIRMED before starting.');

  if (booking.startOtp !== otp) {
    throw new Error('Invalid Start OTP.');
  }

  // OTP Valid -> Start Job and generate Completion OTP
  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      completionOtp: generateOTP(), // Generate completion OTP now
      otpGeneratedAt: new Date(),
      updatedAt: new Date()
    }
  });
}

/**
 * VERIFY OTP TO COMPLETE JOB
 * Worker enters OTP provided by Customer
 */
async function verifyBookingCompletion(bookingId, otp, userId) {
  const worker = await prisma.workerProfile.findUnique({ where: { userId } });
  if (!worker) throw new Error('Only workers can complete jobs.');

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) throw new Error('Booking not found.');
  if (booking.workerProfileId !== worker.id) throw new Error('You are not assigned to this job.');
  if (booking.status !== 'IN_PROGRESS') throw new Error('Job must be IN_PROGRESS before completing.');

  if (booking.completionOtp !== otp) {
    throw new Error('Invalid Completion OTP.');
  }

  // OTP Valid -> Complete Job
  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      updatedAt: new Date()
    }
  });
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
  verifyBookingCompletion
};
