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
const AppError = require('../../common/errors/AppError');

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
  const name = String(serviceData.name || '').trim();
  const description = serviceData.description === undefined ? undefined : String(serviceData.description || '').trim();
  const category = serviceData.category === undefined ? undefined : String(serviceData.category || '').trim();
  const basePrice = serviceData.basePrice === undefined || serviceData.basePrice === null || serviceData.basePrice === ''
    ? null
    : Number(serviceData.basePrice);

  if (!name) {
    throw new AppError(400, 'Service name is required.');
  }

  if (basePrice !== null && (!Number.isFinite(basePrice) || basePrice < 0)) {
    throw new AppError(400, 'Base price must be a valid non-negative number.');
  }

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
    throw new AppError(409, `A service with the name "${name}" already exists. Please choose a different name.`);
  }

  // STEP 2: All checks passed, create the service
  const newService = await prisma.service.create({
    data: {
      name: name,                           // The service name
      description: description || null,     // Optional description (null if not provided)
      category: category || null,           // Optional category (null if not provided)
      basePrice,                            // Optional base price (null if not provided)
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
async function listServices({ category, search, skip = 0, limit = 20 } = {}) {
  const where = {};

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Fetch services from database, sorted alphabetically
  const [data, total] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.service.count({ where }),
  ]);
  return { data, total };
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

/**
 * GET WORKERS WHO OFFER A SERVICE
 *
 * Business Logic:
 * - Find worker profiles that have the requested service
 * - Include basic user info for display
 *
 * @param {number} serviceId - The service ID
 * @returns {Promise<array>} - List of worker profiles offering the service
 */
async function getServiceWorkers(serviceId, { skip = 0, limit = 20 } = {}) {
  const where = {
    serviceId,
    worker: {
      isVerified: true,
      user: { isActive: true },
      location: { isOnline: true },
    },
  };
  const [workers, total] = await Promise.all([
    prisma.workerService.findMany({
      where,
      include: {
        worker: {
          select: {
            id: true,
            hourlyRate: true,
            rating: true,
            totalReviews: true,
            isVerified: true,
            user: {
              select: { id: true, name: true, profilePhotoUrl: true },
            },
          },
        },
      },
      skip,
      take: limit,
    }),
    prisma.workerService.count({ where }),
  ]);

  // Flatten to worker profiles for easier consumption by frontend
  return { data: workers.map((entry) => entry.worker), total };
}

/**
 * UDPATE A SERVICE
 * @param {number} id - Service ID
 * @param {object} data - { name, description, ... }
 */
async function updateService(id, data) {
  const updateData = {
    ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
    ...(data.description !== undefined ? { description: data.description === null ? null : String(data.description).trim() } : {}),
    ...(data.category !== undefined ? { category: data.category === null ? null : String(data.category).trim() } : {}),
    ...(data.basePrice !== undefined
      ? {
        basePrice: data.basePrice === null || data.basePrice === ''
          ? null
          : Number(data.basePrice),
      }
      : {}),
  };

  if (updateData.basePrice !== undefined && updateData.basePrice !== null && (!Number.isFinite(updateData.basePrice) || updateData.basePrice < 0)) {
    throw new AppError(400, 'Base price must be a valid non-negative number.');
  }

  const existingById = await prisma.service.findUnique({ where: { id }, select: { id: true } });
  if (!existingById) {
    throw new AppError(404, 'Service not found.');
  }

  // Optional: Check name uniqueness if name is being changed
  if (updateData.name) {
    const existing = await prisma.service.findFirst({
      where: {
        name: { equals: updateData.name, mode: 'insensitive' },
        NOT: { id }
      }
    });
    if (existing) {
      throw new AppError(409, `Service '${updateData.name}' already exists.`);
    }
  }

  try {
    return await prisma.service.update({
      where: { id },
      data: updateData,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new AppError(404, 'Service not found.');
    }
    throw error;
  }
}

/**
 * DELETE A SERVICE
 * @param {number} id - Service ID
 */
async function deleteService(id) {
  try {
    return await prisma.service.delete({
      where: { id },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new AppError(404, 'Service not found.');
    }
    if (error.code === 'P2003') {
      throw new AppError(409, 'Cannot delete service because it is referenced by existing records.');
    }
    throw error;
  }
}

// Export all service functions so controllers can use them
module.exports = {
  createService,    // NEW: For creating services
  listServices,     // Existing: For browsing services
  getServiceById,   // Existing: For viewing service details
  getServiceWorkers, // NEW: For listing workers offering a service
  updateService,
  deleteService,
};