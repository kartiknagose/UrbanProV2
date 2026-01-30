const prisma = require('../../config/prisma');

// Create or update a worker profile for the current user (idempotent)
async function upsertWorkerProfile(userId, { bio, hourlyRate, skills, serviceAreas }) {
  // Store skills and serviceAreas as JSON arrays for flexibility
  const data = {
    bio: bio ?? null,
    hourlyRate: hourlyRate ?? null, // allow null; validate number in controller before
    skills: skills ? JSON.stringify(skills) : null,
    serviceAreas: serviceAreas ? JSON.stringify(serviceAreas) : null,
    user: { connect: { id: userId } },
  };

  // If profile exists -> update, else -> create
  const existing = await prisma.workerProfile.findUnique({ where: { userId } });
  if (existing) {
    return prisma.workerProfile.update({ where: { userId }, data });
  }
  return prisma.workerProfile.create({ data });
}

// Get the current user's worker profile (if any)
async function getMyWorkerProfile(userId) {
  return prisma.workerProfile.findUnique({ where: { userId } });
}

// Add a service to the worker's offered services
async function addWorkerService(userId, serviceId) {
  // 1. Get worker profile
  const workerProfile = await prisma.workerProfile.findUnique({
    where: { userId },
  });

  if (!workerProfile) {
    throw new Error('Worker profile not found. Please create your profile first.');
  }

  // 2. Check if service exists
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new Error('Service not found');
  }

  // 3. Check if association already exists
  const existing = await prisma.workerService.findUnique({
    where: {
      workerId_serviceId: {
        workerId: workerProfile.id,
        serviceId: serviceId,
      },
    },
  });

  if (existing) {
    throw new Error('You are already offering this service');
  }

  // 4. Create the association
  return prisma.workerService.create({
    data: {
      workerId: workerProfile.id,
      serviceId: serviceId,
    },
    include: {
      service: true, // Include service details in response
    },
  });
}

// Get all services a worker offers (my services)
async function getMyWorkerServices(userId) {
  const workerProfile = await prisma.workerProfile.findUnique({
    where: { userId },
  });

  if (!workerProfile) {
    throw new Error('Worker profile not found');
  }

  return prisma.workerService.findMany({
    where: { workerId: workerProfile.id },
    include: {
      service: true,
    },
  });
}

// Get all services offered by a specific worker (public endpoint)
async function getWorkerServicesById(workerId) {
  // workerId here is the profile ID, not user ID
  return prisma.workerService.findMany({
    where: { workerId },
    include: {
      service: true,
    },
  });
}

// Remove a service from worker's offered services
async function removeWorkerService(userId, serviceId) {
  // 1. Get worker profile
  const workerProfile = await prisma.workerProfile.findUnique({
    where: { userId },
  });

  if (!workerProfile) {
    throw new Error('Worker profile not found');
  }

  // 2. Check if association exists
  const existing = await prisma.workerService.findUnique({
    where: {
      workerId_serviceId: {
        workerId: workerProfile.id,
        serviceId: serviceId,
      },
    },
  });

  if (!existing) {
    throw new Error('You are not offering this service');
  }

  // 3. Delete the association
  return prisma.workerService.delete({
    where: {
      workerId_serviceId: {
        workerId: workerProfile.id,
        serviceId: serviceId,
      },
    },
  });
}

module.exports = { 
  upsertWorkerProfile, 
  getMyWorkerProfile,
  addWorkerService,
  getMyWorkerServices,
  getWorkerServicesById,
  removeWorkerService,
};