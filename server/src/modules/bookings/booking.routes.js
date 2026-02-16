/**
 * BOOKING ROUTES - API ENDPOINTS
 * 
 * What are routes?
 * Routes define the URLs (endpoints) that clients can call to interact with your API.
 * Think of them like doors in a building - each door leads to a different room (function).
 * 
 * Example:
 * - POST /api/bookings → Create a new booking
 * - GET /api/bookings → Get all my bookings
 * - GET /api/bookings/5 → Get booking with ID 5
 * - PATCH /api/bookings/5/status → Update status of booking 5
 * - PATCH /api/bookings/5/cancel → Cancel booking 5
 * 
 * This file connects:
 * 1. HTTP method (GET, POST, PATCH, DELETE)
 * 2. URL path (/bookings, /bookings/:id)
 * 3. Middleware (authentication, validation)
 * 4. Controller function (what to do when this URL is called)
 */

const express = require('express');
const router = express.Router();

// Import middleware
const authenticate = require('../../middleware/auth');
const validate = require('../../middleware/validation');
const { bookingLimiter } = require('../../config/rateLimit');
const { requireCustomer, requireWorker } = require('../../middleware/requireRole');

// Import validation schemas
const {
  createBookingSchema,
  updateBookingStatusSchema,
  cancelBookingSchema,
  payBookingSchema,
} = require('./booking.schemas');

// Import controller functions
const bookingController = require('./booking.controller');

/**
 * ROUTE 1: CREATE A NEW BOOKING
 * 
 * Endpoint: POST /api/bookings
 * Access: Private (must be logged in)
 * 
 * Flow:
 * 1. authenticate middleware checks if user has valid JWT token
 * 2. createBookingSchema validates request body (workerId, serviceId, date, etc.)
 * 3. validate middleware checks for validation errors
 * 4. If all checks pass, bookingController.createBooking runs
 * 
 * Example Request:
 * POST http://localhost:3000/api/bookings
 * Headers: Cookie: token=<JWT_TOKEN>
 * Body: { "workerId": 1, "serviceId": 2, "scheduledDate": "2026-02-15T10:00:00Z", ... }
 */
router.post(
  '/',
  authenticate,           // Step 1: Check if user is logged in
  requireCustomer,        // Step 1.5: Only customers can create bookings
  bookingLimiter,         // Step 2: Rate limiting (max 20 per hour)
  createBookingSchema,    // Step 3: Validate request body
  validate,               // Step 4: Check for validation errors
  bookingController.createBooking // Step 5: Execute controller function
);

/**
 * ROUTE 2: GET ALL MY BOOKINGS
 * 
 * Endpoint: GET /api/bookings
 * Access: Private (must be logged in)
 * 
 * Flow:
 * 1. authenticate middleware checks JWT token
 * 2. If valid, bookingController.getMyBookings runs
 * 
 * Behavior:
 * - Customers see bookings they created
 * - Workers see bookings assigned to them
 * - Admins see ALL bookings
 * 
 * Example Request:
 * GET http://localhost:3000/api/bookings
 * Headers: Cookie: token=<JWT_TOKEN>
 */
router.get(
  '/',
  authenticate,                   // Step 1: Check if user is logged in
  bookingController.getMyBookings // Step 2: Execute controller function
);

/**
 * ROUTE 3: GET OPEN BOOKINGS (JOB BOARD)
 * 
 * Endpoint: GET /api/bookings/open
 * Access: Private (WORKER only)
 * NOTE: This must be defined BEFORE /:id routes to avoid conflict
 */
router.get(
  '/open',
  authenticate,
  bookingController.getOpenBookings
);

/**
 * ROUTE 4: GET A SINGLE BOOKING BY ID
 * 
 * Endpoint: GET /api/bookings/:id
 * Access: Private (must be logged in and involved in the booking)
 * 
 * URL Parameter:
 * - :id is a placeholder for the booking ID
 * - Example: GET /api/bookings/5 → fetch booking with ID = 5
 * 
 * Example Request:
 * GET http://localhost:3000/api/bookings/5
 * Headers: Cookie: token=<JWT_TOKEN>
 */
router.get(
  '/:id',
  authenticate,                      // Step 1: Check if user is logged in
  bookingController.getBookingById   // Step 2: Execute controller function
);

/**
 * ROUTE 4: UPDATE BOOKING STATUS
 * 
 * Endpoint: PATCH /api/bookings/:id/status
 * Access: Private (must be the assigned worker or admin)
 * 
 * Use Case:
 * - Worker accepts booking: { "status": "CONFIRMED" }
 * - Worker starts job: { "status": "IN_PROGRESS" }
 * - Worker completes job: { "status": "COMPLETED" }
 * 
 * Example Request:
 * PATCH http://localhost:3000/api/bookings/5/status
 * Headers: Cookie: token=<JWT_TOKEN>
 * Body: { "status": "CONFIRMED" }
 */
router.patch(
  '/:id/status',
  authenticate,                         // Step 1: Check if user is logged in
  updateBookingStatusSchema,            // Step 2: Validate status value
  validate,                             // Step 3: Check for validation errors
  bookingController.updateBookingStatus // Step 4: Execute controller function
);

/**
 * ROUTE 5: CANCEL A BOOKING
 * 
 * Endpoint: PATCH /api/bookings/:id/cancel
 * Access: Private (must be customer, worker, or admin)
 * 
 * Use Case:
 * - Customer cancels before service starts
 * - Worker cancels if they can't complete the job
 * - Admin cancels for management reasons
 * 
 * Example Request:
 * PATCH http://localhost:3000/api/bookings/5/cancel
 * Headers: Cookie: token=<JWT_TOKEN>
 * Body: { "cancellationReason": "Emergency came up" }
 */
router.patch(
  '/:id/cancel',
  authenticate,                      // Step 1: Check if user is logged in
  cancelBookingSchema,               // Step 2: Validate cancellation reason (if provided)
  validate,                          // Step 3: Check for validation errors
  bookingController.cancelBooking    // Step 4: Execute controller function
);

/**
 * ROUTE 6: PAY FOR A BOOKING
 * 
 * Endpoint: POST /api/bookings/:id/pay
 * Access: Private (CUSTOMER only)
 */
router.post(
  '/:id/pay',
  authenticate,
  requireCustomer,
  payBookingSchema,
  validate,
  bookingController.payBooking
);



/**
 * ROUTE 7: ACCEPT AN OPEN BOOKING
 * 
 * Endpoint: POST /api/bookings/:id/accept
 * Access: Private (WORKER only)
 */
router.post(
  '/:id/accept',
  authenticate,
  requireWorker,
  bookingController.acceptBooking
);

/**
 * ROUTE 8: VERIFY START OTP
 * 
 * Endpoint: POST /api/bookings/:id/start
 * Access: Private (WORKER only)
 */
router.post(
  '/:id/start',
  authenticate,
  requireWorker,
  bookingController.verifyBookingStart
);

/**
 * ROUTE 9: VERIFY COMPLETION OTP
 * 
 * Endpoint: POST /api/bookings/:id/complete
 * Access: Private (WORKER only)
 */
router.post(
  '/:id/complete',
  authenticate,
  requireWorker,
  bookingController.verifyBookingCompletion
);

// Export the router so index.js can mount it at /api/bookings
module.exports = router;
