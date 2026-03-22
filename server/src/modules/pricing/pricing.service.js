const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');

const GST_RATE = 0.18; // 18%
const DISTANCE_OZONE_KM = 5; // First 5km is free
const DISTANCE_FEE_PER_KM = 10; // ₹10 per km after 5km

const round2 = (value) => Math.round(Number(value) * 100) / 100;

const toFiniteNumber = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new AppError(400, `${fieldName} must be a valid number.`);
    }
    return parsed;
};

/**
 * Calculate dynamic price for a booking based on Sprint 9 requirements
 */
async function calculateDynamicPrice({
    serviceId,
    workerProfileId, // Optional, if directly assigned
    scheduledAt,
    latitude,
    longitude,
    basePriceOverride // From UI, but server recalculates anyway
}) {
    const parsedServiceId = Number(serviceId);
    if (!Number.isInteger(parsedServiceId) || parsedServiceId <= 0) {
        throw new AppError(400, 'Service ID must be a positive integer.');
    }

    const deliveryDate = new Date(scheduledAt);
    if (!scheduledAt || Number.isNaN(deliveryDate.getTime())) {
        throw new AppError(400, 'Scheduled time is invalid.');
    }

    const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
    const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';
    if (hasLatitude !== hasLongitude) {
        throw new AppError(400, 'Both latitude and longitude are required together.');
    }

    const parsedLatitude = hasLatitude ? toFiniteNumber(latitude, 'Latitude') : null;
    const parsedLongitude = hasLongitude ? toFiniteNumber(longitude, 'Longitude') : null;

    if (parsedLatitude !== null && (parsedLatitude < -90 || parsedLatitude > 90)) {
        throw new AppError(400, 'Latitude must be between -90 and 90.');
    }
    if (parsedLongitude !== null && (parsedLongitude < -180 || parsedLongitude > 180)) {
        throw new AppError(400, 'Longitude must be between -180 and 180.');
    }

    const service = await prisma.service.findUnique({
        where: { id: parsedServiceId }
    });

    if (!service) throw new AppError(404, 'Service not found');

    const normalizedBasePrice = service.basePrice === null || service.basePrice === undefined
        ? (basePriceOverride === undefined || basePriceOverride === null || basePriceOverride === ''
            ? 0
            : toFiniteNumber(basePriceOverride, 'Base price'))
        : toFiniteNumber(service.basePrice, 'Base price');

    if (normalizedBasePrice < 0) {
        throw new AppError(400, 'Base price cannot be negative.');
    }

    const basePrice = round2(normalizedBasePrice);

    // 1. Time-of-day / Weekend Multiplier
    let timeMultiplier = 1.0;
    const hour = deliveryDate.getHours();
    const day = deliveryDate.getDay(); // 0 = Sunday, 6 = Saturday

    if (day === 0 || day === 6) {
        timeMultiplier = 1.3; // Weekend premium
    } else if (hour >= 18 || hour < 6) {
        timeMultiplier = 1.2; // Evening/Night premium (6 PM to 6 AM)
    }

    // 2. Urgency Multiplier
    let urgencyMultiplier = 1.0;
    const now = new Date();
    const hoursUntilJob = (deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilJob <= 2) {
        urgencyMultiplier = 1.5; // Within 2 hours
    } else if (hoursUntilJob <= 24 && deliveryDate.toDateString() === now.toDateString()) {
        urgencyMultiplier = 1.2; // Same-day
    }

    // 3. Demand/Supply Surge Multiplier (Real-time DB query)
    let surgeMultiplier = 1.0;
    try {
        const [pendingCount, activeWorkers] = await Promise.all([
            prisma.booking.count({
                where: { serviceId: parsedServiceId, status: 'PENDING' }
            }),
            prisma.workerLocation.count({
                where: {
                    isOnline: true,
                    workerProfile: {
                        isVerified: true,
                        user: { isActive: true },
                        services: { some: { serviceId: parsedServiceId } }
                    }
                }
            })
        ]);

        // Ratio: If more pending jobs than active workers -> Surge
        const effectiveWorkers = Math.max(activeWorkers, 1); // Avoid div by 0
        const ratio = pendingCount / effectiveWorkers;

        // Cap ratio impact between 1.0x and 2.0x max
        if (ratio > 1) {
            surgeMultiplier = Math.min(1.0 + (ratio * 0.1), 2.0); // Rough curve
        }
    } catch (_e) { /* Ignore surge failure and fallback to 1.0 */ }


    // 4. Worker Tier Multiplier (If worker selected, or we average it out? Usually 1.0 if open booking)
    let workerTierMultiplier = 1.0;
    let distanceSurcharge = 0.0;

    const parsedWorkerProfileId = workerProfileId === undefined || workerProfileId === null || workerProfileId === ''
        ? null
        : Number(workerProfileId);

    if (parsedWorkerProfileId !== null && (!Number.isInteger(parsedWorkerProfileId) || parsedWorkerProfileId <= 0)) {
        throw new AppError(400, 'Worker profile ID must be a positive integer.');
    }

    if (parsedWorkerProfileId !== null) {
        const worker = await prisma.workerProfile.findUnique({
            where: { id: parsedWorkerProfileId }
        });

        if (worker) {
            if (worker.verificationLevel === 'PREMIUM') workerTierMultiplier = 1.15;
            else if (worker.verificationLevel === 'VERIFIED') workerTierMultiplier = 1.0;
            else workerTierMultiplier = 0.9; // BASIC / DOCUMENTS = promotional

            // Calculate specific distance from worker to job if lat/long match
            if (
                worker.baseLatitude !== null
                && worker.baseLongitude !== null
                && parsedLatitude !== null
                && parsedLongitude !== null
            ) {
                const distKm = getDistanceFromLatLonInKm(
                    parsedLatitude,
                    parsedLongitude,
                    Number(worker.baseLatitude),
                    Number(worker.baseLongitude)
                );
                if (distKm > DISTANCE_OZONE_KM) {
                    distanceSurcharge = (distKm - DISTANCE_OZONE_KM) * DISTANCE_FEE_PER_KM;
                }
            }
        }
    }

    // We should round multipliers to 2 decimals for cleanliness
    surgeMultiplier = round2(surgeMultiplier);

    // Calculate Subtotal (Base * multipliers)
    const modifiedBase = basePrice * timeMultiplier * surgeMultiplier * urgencyMultiplier * workerTierMultiplier;

    // Surcharge added strictly *after* multipliers
    const subtotal = modifiedBase + distanceSurcharge;

    // Tax computed on the final subtotal
    const gstAmount = round2(subtotal * GST_RATE);
    const totalPrice = round2(subtotal + gstAmount);

    return {
        basePrice,
        timeMultiplier,
        surgeMultiplier,
        urgencyMultiplier,
        workerTierMultiplier,
        distanceSurcharge: round2(distanceSurcharge),
        gstAmount,
        totalPrice
    };
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

module.exports = {
    calculateDynamicPrice
};
