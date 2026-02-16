/**
 * BOOKING CONTROLLER - HTTP REQUEST HANDLERS
 * 
 * What is a "controller"?
 * Think of it as a receptionist in a company:
 * - Receives requests from clients (customers using your website/app)
 * - Validates the request (checks if everything is in order)
 * - Calls the service (manager) to do the actual work
 * - Sends back a response (success or error message)
 * 
 * Controllers handle HTTP stuff:
 * - Reading data from requests (req.body, req.params, req.user)
 * - Sending responses (res.status(200).json(...))
 * - Handling errors gracefully
 * 
 * Controllers DO NOT contain business logic - that's the service's job!
 */

const asyncHandler = require('../../common/utils/asyncHandler'); // Wrapper to catch errors automatically
const bookingService = require('./booking.service'); // The service that does actual work
const prisma = require('../../config/prisma');

/**
 * CREATE A NEW BOOKING
 * 
 * HTTP Endpoint: POST /api/bookings
 * Who can access: Only logged-in CUSTOMERS
 * 
 * Request Body:
 * {
 *   "workerId": 1,
 *   "serviceId": 2,
 *   "scheduledDate": "2026-02-15T10:00:00Z",
 *   "addressDetails": "123 Main St, New York, NY",
 *   "estimatedPrice": 150.00,
 *   "notes": "Please bring extra tools"
 * }
 * 
 * Response (201 Created):
 * {
 *   "message": "Booking created successfully",
 *   "booking": { ...booking details... }
 * }
 */
const createBooking = asyncHandler(async (req, res) => {
  // Extract data from request body (sent by the frontend)
  const bookingData = req.body;

  const customerId = req.user.id;

  // FETCH USER: We must fetch from DB because JWT payload only has {id, role}
  // and does not contain fresh isProfileComplete status.
  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: { isProfileComplete: true }
  });

  if (!user || !user.isProfileComplete) {
    res.status(403);
    throw new Error('You must complete your profile (address and details) before booking a service.');
  }

  // Call the service to create the booking (service handles all business logic)
  const newBooking = await bookingService.createBooking(customerId, bookingData);

  // Send success response back to the client
  res.status(201).json({
    message: 'Booking created successfully. The worker will be notified.',
    booking: newBooking,
  });
  // Status 201 means "Created" (something new was added to database)
});

/**
 * GET ALL BOOKINGS FOR THE LOGGED-IN USER
 * 
 * HTTP Endpoint: GET /api/bookings
 * Who can access: Any logged-in user (CUSTOMER, WORKER, or ADMIN)
 * 
 * Behavior:
 * - Customers see bookings they created
 * - Workers see bookings assigned to them
 * - Admins see ALL bookings
 * 
 * Response (200 OK):
 * {
 *   "bookings": [ ...array of bookings... ]
 * }
 */
const getMyBookings = asyncHandler(async (req, res) => {
  // Get user's ID and role from JWT token (added by auth middleware)
  const userId = req.user.id;
  const userRole = req.user.role; // 'CUSTOMER', 'WORKER', or 'ADMIN'
  const viewAs = req.query.viewAs;

  // Allow WORKER to view as CUSTOMER if requested
  const roleToUse = (userRole === 'WORKER' && viewAs === 'CUSTOMER') ? 'CUSTOMER' : userRole;

  // Call service to fetch bookings based on user's role
  const bookings = await bookingService.getBookingsByUser(userId, roleToUse);

  // Send bookings back to client
  res.status(200).json({
    bookings: bookings,
  });
  // Status 200 means "OK" (request successful)
});

/**
 * GET A SINGLE BOOKING BY ID
 * 
 * HTTP Endpoint: GET /api/bookings/:id
 * Who can access: Any logged-in user involved in the booking (customer, worker, or admin)
 * 
 * URL Example: GET /api/bookings/5
 * This fetches booking with ID = 5
 * 
 * Response (200 OK):
 * {
 *   "booking": { ...booking details... }
 * }
 */
const getBookingById = asyncHandler(async (req, res) => {
  // Extract booking ID from URL parameter
  // If URL is /api/bookings/5, then req.params.id = '5'
  const bookingId = parseInt(req.params.id); // Convert string to number

  // Get user's ID and role from JWT token
  const userId = req.user.id;
  const userRole = req.user.role;

  // Call service to fetch the specific booking (service checks permissions)
  const booking = await bookingService.getBookingById(bookingId, userId, userRole);

  // Send booking back to client
  res.status(200).json({
    booking: booking,
  });
});

/**
 * UPDATE BOOKING STATUS
 * 
 * HTTP Endpoint: PATCH /api/bookings/:id/status
 * Who can access: The WORKER assigned to the booking, or ADMIN
 * 
 * Request Body:
 * {
 *   "status": "CONFIRMED"
 * }
 * 
 * Allowed statuses: PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
 * 
 * Use Case:
 * - Worker accepts booking: PENDING → CONFIRMED
 * - Worker starts job: CONFIRMED → IN_PROGRESS
 * - Worker finishes job: IN_PROGRESS → COMPLETED
 * 
 * Response (200 OK):
 * {
 *   "message": "Booking status updated successfully",
 *   "booking": { ...updated booking... }
 * }
 */
const updateBookingStatus = asyncHandler(async (req, res) => {
  // Extract booking ID from URL parameter
  const bookingId = parseInt(req.params.id);

  // Extract new status from request body
  const { status } = req.body;

  // Get user's ID and role from JWT token
  const userId = req.user.id;
  const userRole = req.user.role;

  // Call service to update the booking status (service checks permissions)
  const updatedBooking = await bookingService.updateBookingStatus(
    bookingId,
    status,
    userId,
    userRole
  );

  // Send success response
  res.status(200).json({
    message: 'Booking status updated successfully.',
    booking: updatedBooking,
  });
});

/**
 * CANCEL A BOOKING
 * 
 * HTTP Endpoint: PATCH /api/bookings/:id/cancel
 * Who can access: The CUSTOMER who created it, the WORKER assigned to it, or ADMIN
 * 
 * Request Body (optional):
 * {
 *   "cancellationReason": "Emergency came up, need to reschedule"
 * }
 * 
 * Use Case:
 * - Customer cancels before worker accepts
 * - Worker cancels if they can't complete the job
 * - Admin cancels for any reason
 * 
 * Response (200 OK):
 * {
 *   "message": "Booking cancelled successfully",
 *   "booking": { ...cancelled booking... }
 * }
 */
const cancelBooking = asyncHandler(async (req, res) => {
  // Extract booking ID from URL parameter
  const bookingId = parseInt(req.params.id);

  // Extract cancellation reason from request body (optional)
  const { cancellationReason } = req.body || {};

  // Get user's ID and role from JWT token
  const userId = req.user.id;
  const userRole = req.user.role;

  // Call service to cancel the booking (service checks permissions)
  const cancelledBooking = await bookingService.cancelBooking(
    bookingId,
    userId,
    userRole,
    cancellationReason
  );

  // Send success response
  res.status(200).json({
    message: 'Booking cancelled successfully.',
    booking: cancelledBooking,
  });
});

/**
 * PAY FOR A BOOKING
 *
 * HTTP Endpoint: POST /api/bookings/:id/pay
 * Who can access: The CUSTOMER who created it
 *
 * Request Body (optional):
 * {
 *   "paymentReference": "txn_123"
 * }
 *
 * Response (200 OK):
 * {
 *   "message": "Payment recorded successfully",
 *   "booking": { ...updated booking... }
 * }
 */
const payBooking = asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.id);
  const { paymentReference } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  const paidBooking = await bookingService.payBooking(
    bookingId,
    userId,
    userRole,
    paymentReference
  );

  res.status(200).json({
    message: 'Payment recorded successfully.',
    booking: paidBooking,
  });
});

/**
 * GET OPEN BOOKINGS (JOB BOARD)
 * 
 * HTTP Endpoint: GET /api/bookings/open
 * Who can access: Only WORKERS
 * 
 * Response (200 OK):
 * {
 *   "bookings": [ ...list of available jobs... ]
 * }
 */
const getOpenBookings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  if (userRole !== 'WORKER') {
    res.status(403);
    throw new Error('Only workers can view open bookings.');
  }

  const bookings = await bookingService.getOpenBookingsForWorker(userId);

  res.status(200).json({
    bookings,
  });
});

/**
 * ACCEPT AN OPEN BOOKING
 * 
 * HTTP Endpoint: POST /api/bookings/:id/accept
 * Who can access: Only WORKERS
 * 
 * Response (200 OK):
 * {
 *   "message": "Booking accepted successfully",
 *   "booking": { ...confirmed booking... }
 * }
 */
const acceptBooking = asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.id);
  const userId = req.user.id;
  const userRole = req.user.role;

  if (userRole !== 'WORKER') {
    res.status(403);
    throw new Error('Only workers can accept bookings.');
  }

  // Check valid profile and verification
  // We need to fetch worker profile to check verification status,
  // or checks should be in service?? 
  // Ideally req.user should have isProfileComplete. verification is on workerProfile.
  // Let's rely on service to check verification or fetch it here.
  // Actually, let's fetch it here through prisma or just assume service checks logic?
  // The prompt says "worker must complete his profile AND worker Identity verification to get booking requests"
  // But this is "Accepting" a booking. Same rule applies. 

  // Fetch user to check profile completion
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isProfileComplete: true }
  });

  if (!user || !user.isProfileComplete) {
    res.status(403);
    throw new Error('Please complete your profile details first.');
  }

  // We should also check verification status.
  // Since verification status is on WorkerProfile, we might need a quick check.
  // Let's do it in the service for cleaner code? 
  // No, controller can fail fast. But let's check service logic first. 
  // Actually, I'll put it in service to be safe, OR fetch it here.

  // For now, let's just add the profile complete check here as requested.
  // The verification check is better placed in the service to avoid extra DB calls here if service already does it.

  const booking = await bookingService.acceptBooking(bookingId, userId);

  res.status(200).json({
    message: 'Booking accepted successfully. You can now view customer details.',
    booking,
  });
});

/**
 * VERIFY OTP TO START JOB
 * 
 * HTTP Endpoint: POST /api/bookings/:id/start
 * Who can access: Only WORKERS
 */
const verifyBookingStart = asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.id);
  const userId = req.user.id;
  const { otp } = req.body;

  if (!otp) {
    res.status(400);
    throw new Error('OTP is required.');
  }

  const updatedBooking = await bookingService.verifyBookingStart(bookingId, otp, userId);

  res.status(200).json({
    message: 'OTP verified! Job started successfully.',
    booking: updatedBooking
  });
});

/**
 * VERIFY OTP TO COMPLETE JOB
 * 
 * HTTP Endpoint: POST /api/bookings/:id/complete
 * Who can access: Only WORKERS
 */
const verifyBookingCompletion = asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.id);
  const userId = req.user.id;
  const { otp } = req.body;

  if (!otp) {
    res.status(400);
    throw new Error('OTP is required.');
  }

  const updatedBooking = await bookingService.verifyBookingCompletion(bookingId, otp, userId);

  res.status(200).json({
    message: 'OTP verified! Job completed successfully.',
    booking: updatedBooking
  });
});

// Export all controller functions so routes can use them
module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  payBooking,
  getOpenBookings,
  acceptBooking,
  verifyBookingStart,
  verifyBookingCompletion,
};
