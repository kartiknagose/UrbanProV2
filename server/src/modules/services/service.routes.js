/**
 * SERVICE ROUTES - API ENDPOINTS
 * 
 * What are routes?
 * Routes define the URLs (endpoints) that clients can call to interact with services.
 * 
 * Example:
 * - POST /api/services → Create a new service (admin)
 * - GET /api/services → List all services (public)
 * - GET /api/services/5 → Get service with ID 5 (public)
 * 
 * This file connects:
 * 1. HTTP method (GET, POST, PATCH, DELETE)
 * 2. URL path (/services, /services/:id)
 * 3. Middleware (authentication, validation)
 * 4. Controller function (what to do when this URL is called)
 */

const { Router } = require('express');
const { create, list, getOne } = require('./service.controller');
const authenticate = require('../../middleware/auth'); // Check if user is logged in
const { requireAdmin } = require('../../middleware/requireRole'); // Check if user is admin
const validate = require('../../middleware/validation'); // Check if request data is valid
const { createServiceSchema } = require('./service.schemas'); // Validation rules

const router = Router();

/**
 * ROUTE 1: CREATE A NEW SERVICE
 * 
 * Endpoint: POST /api/services
 * Access: Admin Only (customers and workers cannot create services)
 * 
 * Flow:
 * 1. authenticate middleware checks if user has valid JWT token
 * 2. requireAdmin middleware checks if user's role is ADMIN
 * 3. createServiceSchema validates request body (name, description, etc.)
 * 4. validate middleware checks for validation errors
 * 5. If all checks pass, create controller runs
 * 
 * Example Request:
 * POST http://localhost:3000/api/services
 * Headers: Cookie: token=<ADMIN_JWT_TOKEN>
 * Body: { "name": "Plumbing Repair", "category": "Plumbing", "basePrice": 800 }
 * 
 * Why admin-only?
 * - Prevents fake services from being created
 * - Maintains marketplace quality and trust
 * - Only verified admins should manage service catalog
 * 
 * What happens if non-admin tries?
 * - Response: 403 Forbidden
 * - Error: "Access denied. This endpoint requires ADMIN role. Your role: CUSTOMER."
 */
router.post(
  '/',
  authenticate,          // Step 1: Check if user is logged in
  requireAdmin,          // Step 2: Check if user is admin
  createServiceSchema,   // Step 3: Validate request body
  validate,              // Step 4: Check for validation errors
  create                 // Step 5: Execute create controller
);

/**
 * ROUTE 2: LIST ALL SERVICES
 * 
 * Endpoint: GET /api/services
 * Access: Public (anyone can browse services, no auth required)
 * 
 * Query Parameters (optional):
 * - ?category=Plumbing → Filter by category
 * 
 * Example Request:
 * GET http://localhost:3000/api/services
 * GET http://localhost:3000/api/services?category=Plumbing
 * 
 * Why public?
 * - Customers need to browse services before registering
 * - Helps with SEO and discoverability
 */
router.get('/', list);

/**
 * ROUTE 3: GET A SINGLE SERVICE BY ID
 * 
 * Endpoint: GET /api/services/:id
 * Access: Public (anyone can view service details)
 * 
 * URL Parameter:
 * - :id is a placeholder for the service ID
 * - Example: GET /api/services/5 → fetch service with ID = 5
 * 
 * Example Request:
 * GET http://localhost:3000/api/services/5
 * 
 * Why public?
 * - Customers need to see service details before booking
 * - Helps with sharing direct links to services
 */
router.get('/:id', getOne);

// Export the router so index.js can mount it at /api/services
module.exports = router;