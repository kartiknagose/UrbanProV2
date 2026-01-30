/**
 * SERVICE CONTROLLER - HTTP REQUEST HANDLERS
 * 
 * What is this file?
 * Controllers handle HTTP requests and responses.
 * They call service functions to do the actual work, then send responses back.
 * 
 * Think of it as a receptionist:
 * - Receives requests from clients (frontend/Postman)
 * - Validates requests
 * - Calls the service (manager) to do the work
 * - Sends back responses (success or error)
 */

const asyncHandler = require('../../common/utils/asyncHandler');
const { createService, listServices, getServiceById } = require('./service.service');

/**
 * CREATE A NEW SERVICE
 * 
 * HTTP Endpoint: POST /api/services
 * Who can access: Only authenticated users (later: admin only)
 * 
 * Request Body:
 * {
 *   "name": "Plumbing Repair",
 *   "description": "Professional plumbing services",
 *   "category": "Plumbing",
 *   "basePrice": 800
 * }
 * 
 * Response (201 Created):
 * {
 *   "message": "Service created successfully",
 *   "service": { id: 1, name: "Plumbing Repair", ... }
 * }
 */
exports.create = asyncHandler(async (req, res) => {
  // Extract service data from request body (sent by frontend/Postman)
  const serviceData = req.body;

  // Call the service function to create the service (handles business logic)
  const newService = await createService(serviceData);

  // Send success response back to client
  res.status(201).json({
    message: 'Service created successfully',
    service: newService,
  });
  // Status 201 means "Created" (something new was added to database)
});

/**
 * LIST ALL SERVICES (with optional category filter)
 * 
 * HTTP Endpoint: GET /api/services
 * Who can access: Anyone (public endpoint - no auth required)
 * 
 * Query Parameters (optional):
 * - category: Filter by category (e.g., ?category=Plumbing)
 * 
 * Example URLs:
 * - GET /api/services → Get all services
 * - GET /api/services?category=Plumbing → Get only plumbing services
 * 
 * Response (200 OK):
 * {
 *   "services": [ ...array of services... ]
 * }
 */
exports.list = asyncHandler(async (req, res) => {
  // Extract category filter from query string (e.g., ?category=Plumbing)
  const { category } = req.query;
  
  // Call service function to fetch services (with optional filter)
  const services = await listServices({ category });
  
  // Send services back to client
  res.json({ services });
  // Status 200 (default) means "OK" (request successful)
});

/**
 * GET A SINGLE SERVICE BY ID
 * 
 * HTTP Endpoint: GET /api/services/:id
 * Who can access: Anyone (public endpoint)
 * 
 * URL Parameter:
 * - :id is a placeholder for the service ID
 * - Example: GET /api/services/5 → fetch service with ID = 5
 * 
 * Response (200 OK):
 * {
 *   "service": { id: 5, name: "House Cleaning", ... }
 * }
 * 
 * Response (404 Not Found):
 * {
 *   "error": "Service not found"
 * }
 */
exports.getOne = asyncHandler(async (req, res) => {
  // Extract service ID from URL parameter
  // If URL is /api/services/5, then req.params.id = '5' (string)
  const id = Number(req.params.id); // Convert string to number
  
  // Check if conversion was successful
  if (Number.isNaN(id)) {
    // ID is not a valid number (e.g., /api/services/abc)
    return res.status(400).json({ error: 'Invalid service id' });
    // Status 400 means "Bad Request" (client sent wrong data)
  }

  // Call service function to fetch the specific service
  const service = await getServiceById(id);
  
  // Check if service was found
  if (!service) {
    // Service doesn't exist in database
    return res.status(404).json({ error: 'Service not found' });
    // Status 404 means "Not Found"
  }
  
  // Service found, send it back to client
  res.json({ service });
});