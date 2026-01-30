/**
 * SERVICE BUSINESS LOGIC
 * 
 * This file handles all service-related operations:
 * - Creating new services (admin only)
 * - Listing services (public - anyone can browse)
 * - Getting service details (public)
 * 
 * Why separate this from controllers?
 * - Controllers handle HTTP stuff (requests/responses)
 * - Services handle business logic and database operations
 * - This makes code reusable and easier to test
 */

const prisma = require('../../config/prisma');

/**
 * CREATE A NEW SERVICE
 * 
 * Business Logic:
 * 1. Check if service with this name already exists (prevent duplicates)
 * 2. If exists, throw error
 * 3. If unique, create the service in database
 * 4. Return the newly created service
 * 
 * @param {object} serviceData - The service details { name, description, category, basePrice }
 * @returns {Promise<object>} - The newly created service
 * @throws {Error} - If service name already exists
 */
async function createService(serviceData) {
  const { name, description, category, basePrice } = serviceData;

  // STEP 1: Check if a service with this name already exists
  // Why? We don't want two "Plumbing Repair" services - creates confusion
  const existingService = await prisma.service.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive', // Case-insensitive search (e.g., "plumbing" === "Plumbing")
      },
    },
  });

  if (existingService) {
    // Service name already taken, reject the request
    throw new Error(`A service with the name "${name}" already exists. Please choose a different name.`);
  }

  // STEP 2: All checks passed, create the service
  const newService = await prisma.service.create({
    data: {
      name: name,                           // The service name
      description: description || null,     // Optional description (null if not provided)
      category: category || null,           // Optional category (null if not provided)
      basePrice: basePrice || null,         // Optional base price (null if not provided)
      // translations field is not used yet (for future multi-language support)
    },
  });

  // STEP 3: Return the newly created service
  return newService;
}

/**
 * LIST ALL SERVICES (with optional category filter)
 * 
 * Business Logic:
 * - If category provided, only return services in that category
 * - If no category, return all services
 * - Always sort alphabetically by name for better UX
 * 
 * @param {object} filters - Optional filters { category: "Plumbing" }
 * @returns {Promise<array>} - List of services
 */
async function listServices({ category } = {}) {
  // Build filter: if category exists, filter by it; otherwise, empty filter (get all)
  const where = category ? { category } : {};
  
  // Fetch services from database, sorted alphabetically
  return prisma.service.findMany({ 
    where, 
    orderBy: { name: 'asc' } // 'asc' means ascending (A-Z)
  });
}

/**
 * GET A SINGLE SERVICE BY ID
 * 
 * Business Logic:
 * - Fetch service by its unique ID
 * - Return null if not found (controller will handle 404 error)
 * 
 * @param {number} id - The service ID
 * @returns {Promise<object|null>} - The service or null if not found
 */
async function getServiceById(id) {
  return prisma.service.findUnique({ where: { id } });
}

// Export all service functions so controllers can use them
module.exports = { 
  createService,    // NEW: For creating services
  listServices,     // Existing: For browsing services
  getServiceById    // Existing: For viewing service details
};