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
const router = express.Router(); // Create a router to define routes

// Import middleware
const authenticate = require('../../middleware/auth'); // Checks if user is logged in (has valid JWT)
const validate = require('../../middleware/validation'); // Checks if request data is valid

// Import validation schemas
const {
  createBookingSchema,
  updateBookingStatusSchema,
  cancelBookingSchema,
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
  createBookingSchema,    // Step 2: Validate request body
  validate,               // Step 3: Check for validation errors
  bookingController.createBooking // Step 4: Execute controller function
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
 * ROUTE 3: GET A SINGLE BOOKING BY ID
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

// Export the router so index.js can mount it at /api/bookings
module.exports = router;
