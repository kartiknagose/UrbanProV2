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
async function createBooking(customerId, bookingData) {
  const { workerId, serviceId, scheduledDate, addressDetails, estimatedPrice, notes } = bookingData;

  // STEP 1: Verify the worker exists and has a worker profile
  // Why? Can't book someone who isn't registered as a worker
  const workerProfile = await prisma.workerProfile.findUnique({
    where: { id: workerId }, // Look for worker by their ID
  });

  if (!workerProfile) {
    // If worker doesn't exist, throw an error that controller will catch
    throw new Error('Worker not found. Please select a valid worker.');
  }

  // STEP 2: Verify the service exists
  // Why? Can't book a service that doesn't exist in our system
  const service = await prisma.service.findUnique({
    where: { id: serviceId }, // Look for service by its ID
  });

  if (!service) {
    throw new Error('Service not found. Please select a valid service.');
  }

  // STEP 3: Verify the worker actually offers this service
  // Why? A plumber shouldn't accept electrical work bookings
  // We check the "WorkerService" junction table that connects workers to their services
  const workerOffersService = await prisma.workerService.findUnique({
    where: {
      workerId_serviceId: { // Compound key: both workerId AND serviceId must match
        workerId: workerId,
        serviceId: serviceId,
      },
    },
  });

  if (!workerOffersService) {
    throw new Error('This worker does not offer the selected service. Please choose another worker or service.');
  }

  // STEP 4: All validations passed! Create the booking in the database
  const newBooking = await prisma.booking.create({
    data: {
      customerId: customerId,        // Who is booking (from JWT token)
      workerId: workerId,             // The worker's profile ID (consistent with WorkerService)
      serviceId: serviceId,           // What service they want
      scheduledAt: new Date(scheduledDate), // Convert string to Date object
      address: addressDetails, // Where the service happens
      totalPrice: estimatedPrice, // How much they expect to pay (optional)
      notes: notes,                   // Any special instructions (optional)
      status: 'PENDING',              // Initial status (waiting for worker to accept)
    },
    // Include related data in the response (so we can show service name, worker name, etc.)
    include: {
      service: {
        select: { id: true, name: true, category: true }, // Get service details
      },
      worker: {
        select: { id: true, name: true, email: true }, // Get worker details
      },
      customer: {
        select: { id: true, name: true, email: true }, // Get customer details
      },
    },
  });

  // Return the complete booking object
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
  let whereClause = {}; // Empty filter by default

  // Determine the filter based on user role
  if (role === 'CUSTOMER') {
    // Customers see only bookings they created
    whereClause = { customerId: userId };
  } else if (role === 'WORKER') {
    // Workers see bookings where their profile is assigned
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (workerProfile) {
      whereClause = { workerId: workerProfile.id };
    } else {
      whereClause = { workerId: -1 }; // No profile = no bookings
    }
  }
  // If role is ADMIN, whereClause stays empty, so they see ALL bookings

  // Fetch bookings from database with the appropriate filter
  const bookings = await prisma.booking.findMany({
    where: whereClause, // Apply the role-based filter
    include: {
      service: {
        select: { id: true, name: true, category: true }, // Show what service was booked
      },
      worker: {
        select: { id: true, name: true, email: true }, // Show who's doing the work
      },
      customer: {
        select: { id: true, name: true, email: true }, // Show who booked it
      },
    },
    orderBy: {
      createdAt: 'desc', // Show newest bookings first
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
  // Fetch the booking from database
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: {
        select: { id: true, name: true, category: true, basePrice: true },
      },
      worker: {
        select: { id: true, name: true, email: true },
      },
      customer: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  // If booking doesn't exist, throw error
  if (!booking) {
    throw new Error('Booking not found.');
  }

  // Check if user has permission to view this booking
  // Admins can view everything
  // Customers can view their own bookings
  // Workers can view bookings assigned to them
  const isCustomer = booking.customerId === userId;
  let isWorker = false;
  if (role === 'WORKER') {
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId },
    });
    isWorker = workerProfile && booking.workerId === workerProfile.id;
  }
  const isAdmin = role === 'ADMIN';

  if (!isCustomer && !isWorker && !isAdmin) {
    // User is not involved in this booking and is not an admin
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
  // First, fetch the booking to check permissions
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new Error('Booking not found.');
  }

  // Check if user has permission to update this booking
  let isWorker = false;
  if (role === 'WORKER') {
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId },
    });
    isWorker = workerProfile && booking.workerId === workerProfile.id;
  }
  const isAdmin = role === 'ADMIN';

  if (!isWorker && !isAdmin) {
    // Only the assigned worker or an admin can update status
    throw new Error('Only the assigned worker or admin can update booking status.');
  }

  // Update the booking status in the database
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: newStatus, // Change to new status
      updatedAt: new Date(), // Update the timestamp
    },
    include: {
      service: { select: { id: true, name: true, category: true } },
      worker: { select: { id: true, name: true, email: true } },
      customer: { select: { id: true, name: true, email: true } },
    },
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
  // Fetch the booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new Error('Booking not found.');
  }

  // Check if booking is already cancelled
  if (booking.status === 'CANCELLED') {
    throw new Error('This booking is already cancelled.');
  }

  // Check if booking is already completed
  if (booking.status === 'COMPLETED') {
    throw new Error('Cannot cancel a completed booking.');
  }

  // Check if user has permission to cancel
  const isCustomer = booking.customerId === userId;
  let isWorker = false;
  if (role === 'WORKER') {
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId },
    });
    isWorker = workerProfile && booking.workerId === workerProfile.id;
  }
  const isAdmin = role === 'ADMIN';

  if (!isCustomer && !isWorker && !isAdmin) {
    throw new Error('You do not have permission to cancel this booking.');
  }

  // Cancel the booking
  const cancelledBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
      cancellationReason: cancellationReason || 'No reason provided',
      updatedAt: new Date(),
    },
    include: {
      service: { select: { id: true, name: true, category: true } },
      worker: { select: { id: true, name: true, email: true } },
      customer: { select: { id: true, name: true, email: true } },
    },
  });

  return cancelledBooking;
}

// Export all service functions so controllers can use them
module.exports = {
  createBooking,
  getBookingsByUser,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
};
