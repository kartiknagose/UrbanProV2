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
const AppError = require('../../common/errors/AppError');
const parsePagination = require('../../common/utils/parsePagination');
const parseId = require('../../common/utils/parseId');
const { createService, listServices, getServiceById, getServiceWorkers, updateService, deleteService } = require('./service.service');

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
  // Extract filters from query string (e.g., ?category=Plumbing&search=cleaning)
  const { category, search } = req.query;
  const { page, limit, skip } = parsePagination(req.query);

  // Call service function to fetch services (with optional filter + pagination)
  const { data: services, total } = await listServices({ category, search, skip, limit });

  // Send services back to client
  res.json({ services, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
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
  const id = parseId(req.params.id, 'Service ID');

  // Call service function to fetch the specific service
  const service = await getServiceById(id);

  // Check if service was found
  if (!service) {
    throw new AppError(404, 'Service not found');
  }

  // Service found, send it back to client
  res.json({ service });
});

/**
 * GET WORKERS FOR A SERVICE
 *
 * HTTP Endpoint: GET /api/services/:id/workers
 * Who can access: Anyone (public endpoint)
 *
 * Response (200 OK):
 * {
 *   "workers": [ ...worker profiles... ]
 * }
 */
exports.getWorkers = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'Service ID');

  const { page, limit, skip } = parsePagination(req.query);
  const { data: workers, total } = await getServiceWorkers(id, { skip, limit });
  res.json({ workers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'Service ID');
  const payload = {
    ...(req.body.name !== undefined ? { name: req.body.name } : {}),
    ...(req.body.description !== undefined ? { description: req.body.description } : {}),
    ...(req.body.category !== undefined ? { category: req.body.category } : {}),
    ...(req.body.basePrice !== undefined ? { basePrice: req.body.basePrice } : {}),
  };

  if (Object.keys(payload).length === 0) {
    throw new AppError(400, 'No valid fields provided for update.');
  }

  const updated = await updateService(id, payload);
  res.json({ service: updated });
});

exports.remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'Service ID');
  await deleteService(id);
  res.json({ message: 'Service deleted' });
});