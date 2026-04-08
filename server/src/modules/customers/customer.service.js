const prisma = require('../../config/prisma');

// Create or update customer profile (address + optional profile photo)
async function upsertCustomerProfile(userId, { name, line1, line2, city, state, postalCode, country, profilePhotoUrl }) {
  return prisma.$transaction(async (tx) => {
    const existingAddress = await tx.address.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const normalizedName = typeof name === 'string' ? name.trim() : undefined;
    const normalizedLine1 = String(line1 || '').trim();
    const normalizedLine2 = typeof line2 === 'string' ? line2.trim() : '';
    const normalizedCity = String(city || '').trim();
    const normalizedState = String(state || '').trim();
    const normalizedPostalCode = String(postalCode || '').trim();
    const normalizedCountry = String(country || '').trim();
    const normalizedPhotoUrl = typeof profilePhotoUrl === 'string' ? profilePhotoUrl.trim() : '';

    const addressData = {
      line1: normalizedLine1,
      line2: normalizedLine2 || null,
      city: normalizedCity,
      state: normalizedState,
      postalCode: normalizedPostalCode,
      country: normalizedCountry,
      user: { connect: { id: userId } },
    };

    let address;
    if (existingAddress) {
      address = await tx.address.update({ where: { id: existingAddress.id }, data: addressData });
    } else {
      address = await tx.address.create({ data: addressData });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        name: normalizedName || undefined,
        profilePhotoUrl: normalizedPhotoUrl || undefined,
        isProfileComplete: true,
      },
    });

    return address;
  });
}

async function getCustomerProfile(userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profilePhotoUrl: true,
      emailVerified: true,
      isProfileComplete: true,
      addresses: true,
    },
  });

  return user;
}

module.exports = { upsertCustomerProfile, getCustomerProfile };
