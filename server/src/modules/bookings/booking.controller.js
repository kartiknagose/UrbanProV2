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

  // Get the customer's ID from the JWT token
  // Remember: Our auth middleware (auth.js) adds req.user to every authenticated request
  const customerId = req.user.id;

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

  // Call service to fetch bookings based on user's role
  const bookings = await bookingService.getBookingsByUser(userId, userRole);

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
  const { cancellationReason } = req.body;

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

// Export all controller functions so routes can use them
module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
};
