const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const ensureWorkerProfile = async (userId) => {
  const profile = await prisma.workerProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError(404, 'Worker profile not found.');
  }
  return profile;
};

async function listAvailability(userId) {
  const profile = await ensureWorkerProfile(userId);

  return prisma.availability.findMany({
    where: { workerId: profile.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}

async function createAvailability(userId, data) {
  const profile = await ensureWorkerProfile(userId);
  const dayOfWeek = Number(data.dayOfWeek);
  const startTime = String(data.startTime || '').trim();
  const endTime = String(data.endTime || '').trim();

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new AppError(400, 'Day of week must be between 0 (Sunday) and 6 (Saturday).');
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
    throw new AppError(400, 'Time must be in HH:mm format.');
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (startMinutes >= endMinutes) {
    throw new AppError(400, 'Start time must be before end time.');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.availability.findMany({
        where: { workerId: profile.id, dayOfWeek },
      });

      const hasOverlap = existing.some((slot) => {
        const slotStart = timeToMinutes(slot.startTime);
        const slotEnd = timeToMinutes(slot.endTime);
        return startMinutes < slotEnd && endMinutes > slotStart;
      });

      if (hasOverlap) {
        throw new AppError(409, 'Availability overlaps with an existing slot.');
      }

      return tx.availability.create({
        data: {
          workerId: profile.id,
          dayOfWeek,
          startTime,
          endTime,
        },
      });
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'Availability slot already exists.');
    }
    throw error;
  }
}

async function removeAvailability(userId, availabilityId) {
  const profile = await ensureWorkerProfile(userId);

  const slot = await prisma.availability.findUnique({ where: { id: availabilityId } });
  if (!slot || slot.workerId !== profile.id) {
    throw new AppError(404, 'Availability slot not found.');
  }

  await prisma.availability.delete({ where: { id: availabilityId } });
}

module.exports = {
  listAvailability,
  createAvailability,
  removeAvailability,
};
