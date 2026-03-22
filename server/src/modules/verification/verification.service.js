const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');

async function getMyApplication(userId) {
  return prisma.workerVerificationApplication.findFirst({
    where: { userId },
    orderBy: { submittedAt: 'desc' },
    include: {
      documents: true,
      references: true,
      media: true,
    },
  });
}

async function applyForVerification(userId, data) {
  const workerProfile = await prisma.workerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!workerProfile) {
    throw new AppError(403, 'Worker profile is required before applying for verification.');
  }

  const notes = typeof data.notes === 'string' ? data.notes.trim() : null;
  const documents = Array.isArray(data.documents)
    ? data.documents
      .filter((doc) => doc && doc.type && doc.url)
      .map((doc) => ({
        type: doc.type,
        url: String(doc.url).trim(),
      }))
    : [];

  return prisma.$transaction(async (tx) => {
    const latest = await tx.workerVerificationApplication.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });

    if (latest && (latest.status === 'PENDING' || latest.status === 'APPROVED')) {
      throw new AppError(409, 'Verification already in progress or approved.');
    }

    return tx.workerVerificationApplication.create({
      data: {
        userId,
        notes,
        status: 'PENDING',
        documents: {
          create: documents,
        },
      },
      include: {
        documents: true,
      },
    });
  });
}

async function listApplications({ skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    prisma.workerVerificationApplication.findMany({
      orderBy: { submittedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, mobile: true } },
        documents: true,
        references: true,
        media: true,
      },
      skip,
      take: limit,
    }),
    prisma.workerVerificationApplication.count(),
  ]);
  return { data, total };
}

async function reviewApplication(applicationId, data) {
  const application = await prisma.workerVerificationApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, userId: true, score: true, notes: true },
  });

  if (!application) {
    throw new AppError(404, 'Verification application not found.');
  }

  const normalizedNotes = typeof data.notes === 'string' ? data.notes.trim() : undefined;
  const normalizedLevel = data.level || undefined;

  // Wrap application update + profile sync in a transaction
  const updatedApp = await prisma.$transaction(async (tx) => {
    const updated = await tx.workerVerificationApplication.update({
      where: { id: applicationId },
      data: {
        status: data.status,
        score: data.score ?? application.score,
        notes: normalizedNotes ?? application.notes,
        reviewedAt: new Date(),
      },
    });

    // Sync verification status with WorkerProfile
    if (data.status === 'APPROVED' || data.status === 'REJECTED' || normalizedLevel) {
      const level = normalizedLevel || (data.status === 'APPROVED' ? 'VERIFIED' : 'BASIC');

      const workerProfile = await tx.workerProfile.findUnique({
        where: { userId: application.userId },
        select: { id: true },
      });

      if (!workerProfile) {
        throw new AppError(404, 'Worker profile not found for verification sync.');
      }

      await tx.workerProfile.update({
        where: { id: workerProfile.id },
        data: {
          isVerified: data.status === 'APPROVED',
          isProbation: data.status !== 'APPROVED',
          verificationScore: data.score ?? application.score,
          verificationLevel: level,
        },
      });
    }

    return updated;
  });

  return updatedApp;
}

module.exports = {
  getMyApplication,
  applyForVerification,
  listApplications,
  reviewApplication,
};
