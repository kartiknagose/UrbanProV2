const asyncHandler = require('../../common/utils/asyncHandler');
const AppError = require('../../common/errors/AppError');
const parseId = require('../../common/utils/parseId');
const locationService = require('./location.service');

let getIo;
try {
    ({ getIo } = require('../../socket'));
} catch (_err) {
    getIo = null;
}

const updateLocation = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { latitude, longitude, isOnline } = req.body;

    const location = await locationService.updateLocation(userId, {
        latitude,
        longitude,
        isOnline
    });

    try {
        const io = getIo ? getIo() : null;
        if (io) {
            // Broadcast update to anyone listening for this worker
            io.to(`worker_tracking:${location.workerProfileId}`).emit('worker:location_updated', {
                workerProfileId: location.workerProfileId,
                latitude: location.latitude,
                longitude: location.longitude,
                isOnline: location.isOnline,
                lastUpdated: location.lastUpdated
            });

            // Optionally broadcast to admin room if it's a critical update or for health monitoring
            if (location.isOnline === false) {
                io.to('admin').emit('worker:offline', { workerId: userId });
            }
        }
    } catch (socketError) {
        console.warn('Location socket broadcast failed:', socketError.message);
    }

    res.json({ success: true, location });
});

const getWorkerLocation = asyncHandler(async (req, res) => {
    const workerProfileId = parseId(req.params.id, 'Worker ID');
    const location = await locationService.getWorkerLocation(workerProfileId);

    res.json({ location: location || null });
});

const getNearbyWorkers = asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = req.query.radius ? Number(req.query.radius) : 10;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new AppError(400, 'Latitude and longitude must be valid numbers');
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new AppError(400, 'Latitude/longitude out of valid range');
    }

    if (!Number.isFinite(radius) || radius <= 0 || radius > 100) {
        throw new AppError(400, 'Radius must be a number between 1 and 100 km');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new AppError(400, 'Limit must be between 1 and 100');
    }

    const workers = await locationService.getNearbyWorkers(
        lat,
        lng,
        radius,
        limit
    );

    res.json({ workers });
});

const getCities = asyncHandler(async (req, res) => {
    const cities = await locationService.getCities();
    res.json({ cities });
});

const getCityServices = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const services = await locationService.getCityServices(slug);
    res.json({ services });
});

module.exports = {
    updateLocation,
    getWorkerLocation,
    getNearbyWorkers,
    getCities,
    getCityServices
};
