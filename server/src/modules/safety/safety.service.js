const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');
const { sendEmail } = require('../../common/utils/mailer');
const { createNotification } = require('../notifications/notification.service');

// ─────────────────────────────────────────────────────────────────────────────
// Email-to-SMS Gateway map (free, no API key needed)
// Each carrier has a gateway that converts email → SMS text message.
// Format: phone_number@gateway.domain
// ─────────────────────────────────────────────────────────────────────────────
const SMS_GATEWAYS = {
    airtel: '@airtelmail.com',
    jio: '@jiomail.com',
    vi: '@vimail.in',
    bsnl: '@bsnl.in',
    // International fallbacks
    att: '@txt.att.net',
    tmobile: '@tmomail.net',
    verizon: '@vtext.com',
    sprint: '@messaging.sprintpcs.com',
};

// Default gateway when carrier is unknown — tries jio (most common in India)
const DEFAULT_GATEWAY = '@jiomail.com';

const REPORT_CATEGORIES = ['SAFETY', 'HARASSMENT', 'NO_SHOW', 'PROPERTY_DAMAGE', 'PAYMENT_DISPUTE', 'MISCONDUCT', 'FRAUD', 'OTHER'];
const REPORT_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];
const REPORT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const SOS_RETRIGGER_COOLDOWN_MS = 2 * 60 * 1000;
const SOS_NOTIFY_TIMEOUT_MS = 10 * 1000;

const withTimeout = (promise, timeoutMs, timeoutValue = null) => Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(timeoutValue), timeoutMs)),
]);

function isSchemaDriftError(error) {
    const code = String(error?.code || '').toUpperCase();
    return code === 'P2021' || code === 'P2022';
}

function throwBookingReportsUnavailable(error) {
    if (isSchemaDriftError(error)) {
        throw new AppError(503, 'Booking reports are temporarily unavailable. Please apply the latest database migration and try again.');
    }

    throw error;
}

const bookingReportSelect = {
    id: true,
    bookingId: true,
    reporterId: true,
    reportedUserId: true,
    reportedRole: true,
    category: true,
    status: true,
    priority: true,
    details: true,
    evidenceUrl: true,
    adminNotes: true,
    reviewedById: true,
    reviewedAt: true,
    createdAt: true,
    updatedAt: true,
    booking: {
        select: {
            id: true,
            status: true,
            scheduledAt: true,
            service: { select: { id: true, name: true, category: true } },
            customer: {
                select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, role: true },
            },
            workerProfile: {
                select: {
                    id: true,
                    userId: true,
                    user: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, role: true } },
                },
            },
        },
    },
    reporter: {
        select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, role: true },
    },
    reportedUser: {
        select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, role: true },
    },
    reviewedBy: {
        select: { id: true, name: true, email: true, role: true },
    },
};

function resolveReportPriority(category) {
    switch (category) {
        case 'SAFETY':
        case 'HARASSMENT':
        case 'FRAUD':
            return 'HIGH';
        case 'PROPERTY_DAMAGE':
        case 'PAYMENT_DISPUTE':
            return 'MEDIUM';
        case 'NO_SHOW':
        case 'MISCONDUCT':
            return 'MEDIUM';
        default:
            return 'LOW';
    }
}

function normalizeReportStatus(status) {
    const normalized = String(status || '').toUpperCase();
    if (!REPORT_STATUSES.includes(normalized)) {
        throw new AppError(400, 'Invalid report status.');
    }
    return normalized;
}

function normalizeReportCategory(category) {
    const normalized = String(category || '').toUpperCase();
    if (!REPORT_CATEGORIES.includes(normalized)) {
        throw new AppError(400, 'Invalid report category.');
    }
    return normalized;
}

function normalizeReportPriority(priority) {
    const normalized = String(priority || '').toUpperCase();
    if (!REPORT_PRIORITIES.includes(normalized)) {
        throw new AppError(400, 'Invalid report priority.');
    }
    return normalized;
}

function buildReportWhere(filters = {}) {
    const where = {};

    if (filters.status) where.status = String(filters.status).toUpperCase();
    if (filters.category) where.category = String(filters.category).toUpperCase();
    if (filters.priority) where.priority = normalizeReportPriority(filters.priority);
    if (filters.bookingId) where.bookingId = Number(filters.bookingId);

    return where;
}

function emitReportEvent(eventName, payload) {
    try {
        const { getIo } = require('../../socket');
        const io = getIo();
        if (!io) return;
        io.to('admin').emit(eventName, payload);
    } catch (err) {
        console.warn('[REPORT] Socket emit failed:', err.message);
    }
}

async function notifyReportAdmins(report, reporterRole) {
    try {
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN', isActive: true, deletedAt: null },
            select: { id: true },
        });

        await Promise.allSettled(admins.map((admin) => createNotification({
            userId: admin.id,
            type: 'BOOKING_REPORT',
            title: 'New booking report',
            message: `A ${reporterRole.toLowerCase()} reported ${report.reportedRole.toLowerCase()} for booking #${report.bookingId}.`,
            data: {
                bookingId: report.bookingId,
                reportId: report.id,
                category: report.category,
                status: report.status,
                url: '/admin/reports',
            },
        })));
    } catch (err) {
        console.warn('[REPORT] Admin notifications failed:', err.message);
    }
}

async function notifyReportReporter(report, message, url) {
    try {
        await createNotification({
            userId: report.reporterId,
            type: 'BOOKING_REPORT',
            title: 'Report received',
            message,
            data: {
                bookingId: report.bookingId,
                reportId: report.id,
                category: report.category,
                status: report.status,
                url,
            },
        });
    } catch (err) {
        console.warn('[REPORT] Reporter notification failed:', err.message);
    }
}

/**
 * Send SMS via Email-to-SMS gateway (free)
 * Falls back silently if email credentials not configured
 */
async function sendSMSViaEmail(phone, message, carrier = 'default') {
    // Clean phone number — strip spaces, dashes, +91 prefix
    const cleanPhone = String(phone || '').replace(/[^\d]/g, '').replace(/^91/, '').slice(-10);
    if (cleanPhone.length < 10) {
        return { sent: false, reason: 'invalid_phone' };
    }

    const gateway = SMS_GATEWAYS[carrier] || DEFAULT_GATEWAY;
    const smsEmail = `${cleanPhone}${gateway}`;

    try {
        await sendEmail({
            to: smsEmail,
            logContext: 'SOS SMS Gateway',
            subject: '🚨 SOS ALERT — ExpertsHub Emergency',
            text: message, // SMS gateways use the plain text body as the SMS
        });
        console.log(`[SOS] SMS sent to ${smsEmail}`);
        return { sent: true, to: smsEmail };
    } catch (err) {
        console.error(`[SOS] SMS failed to ${smsEmail}:`, err.message);
        return { sent: false, reason: err.message };
    }
}

/**
 * Send email alert to emergency contact (free Gmail)
 */
async function sendEmailAlert(to, subject, body) {
    const recipient = String(to || '').trim();
    if (!recipient || !recipient.includes('@')) return;

    try {
        await sendEmail({
            to: recipient,
            logContext: 'SOS Email Alert',
            subject,
            text: body
        });
        console.log(`[SOS] Email sent to ${recipient}`);
    } catch (err) {
        console.error(`[SOS] Email failed to ${recipient}:`, err.message);
    }
}

function triggerEmergencyFanout(contacts, smsMessage, emailBody) {
    if (!Array.isArray(contacts) || contacts.length === 0) return;

    Promise.allSettled(
        contacts.map(async (contact) => {
            await Promise.allSettled([
                withTimeout(sendSMSViaEmail(contact.phone, smsMessage), SOS_NOTIFY_TIMEOUT_MS),
                // EmergencyContact currently stores phone/name/relation only.
                // Keep email path for forward compatibility if schema adds it.
                contact.email
                    ? withTimeout(sendEmailAlert(contact.email, '🚨 SOS ALERT — ExpertsHub Emergency', emailBody), SOS_NOTIFY_TIMEOUT_MS)
                    : Promise.resolve(),
            ]);
        })
    ).catch((error) => {
        console.warn('[SOS] Emergency contact fanout failed:', error.message);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER SOS ALERT
// ─────────────────────────────────────────────────────────────────────────────
async function triggerSOS(userId, bookingId, location) {
    // 1. Verify user is part of this booking
    const booking = await prisma.booking.findFirst({
        where: {
            id: bookingId,
            OR: [
                { customerId: userId },
                { workerProfile: { userId: userId } }
            ]
        },
        include: {
            customer: { select: { id: true, name: true, email: true } },
            workerProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
            service: { select: { name: true } },
        }
    });

    if (!booking) {
        throw new AppError(404, 'Booking not found or you are not authorized to trigger SOS for this job.');
    }

    if (!['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) {
        throw new AppError(400, 'SOS can only be triggered for active bookings.');
    }

    let normalizedLocation = null;
    if (location && typeof location === 'object') {
        const latitude = Number(location.latitude);
        const longitude = Number(location.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            throw new AppError(400, 'Location latitude/longitude must be valid numbers.');
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new AppError(400, 'Location latitude/longitude out of range.');
        }

        normalizedLocation = { latitude, longitude };
    }

    // 2. Get triggering user's info
    const triggeringUser = booking.customerId === userId
        ? booking.customer
        : booking.workerProfile?.user;

    const role = booking.customerId === userId ? 'Customer' : 'Worker';
    const locationStr = normalizedLocation
        ? `GPS: ${normalizedLocation.latitude.toFixed(5)}, ${normalizedLocation.longitude.toFixed(5)}\nhttps://maps.google.com/?q=${normalizedLocation.latitude},${normalizedLocation.longitude}`
        : 'Location not shared';

    // Avoid duplicate alert storms from repeated taps/retries.
    const recentAlert = await prisma.sOSAlert.findFirst({
        where: {
            bookingId,
            triggeredBy: userId,
            status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
            createdAt: { gte: new Date(Date.now() - SOS_RETRIGGER_COOLDOWN_MS) },
        },
        orderBy: { createdAt: 'desc' },
    });

    if (recentAlert) {
        return {
            sosAlert: recentAlert,
            message: 'SOS was already triggered recently. Admin team is already notified.',
            contactsNotified: [],
        };
    }

    // 3. Create SOS Alert in DB
    const sosAlert = await prisma.sOSAlert.create({
        data: {
            bookingId,
            triggeredBy: userId,
            latitude: normalizedLocation?.latitude,
            longitude: normalizedLocation?.longitude,
            status: 'ACTIVE'
        }
    });

    // 4. Fetch emergency contacts
    const contacts = await prisma.emergencyContact.findMany({ where: { userId }, take: 5 });

    // 5. Build alert message
    const smsMessage =
        `🚨 SOS ALERT from ExpertsHub!\n` +
        `${triggeringUser?.name || 'User'} (${role}) needs IMMEDIATE help.\n` +
        `Booking #${bookingId} - ${booking.service?.name || 'Service'}\n` +
        `${locationStr}\n` +
        `Call them NOW!`;

    const emailBody =
        `🚨 EMERGENCY SOS ALERT — ExpertsHub Safety System\n\n` +
        `${triggeringUser?.name || 'A user'} (${role}) has triggered an SOS emergency alert.\n\n` +
        `📋 Booking Details:\n` +
        `  • Booking ID: #${bookingId}\n` +
        `  • Service: ${booking.service?.name || 'Unknown Service'}\n` +
        `  • Status: ${booking.status}\n\n` +
        `📍 Location:\n  ${locationStr}\n\n` +
        `👤 Person in Distress:\n` +
        `  • Name: ${triggeringUser?.name || 'Unknown'}\n` +
        `  • Role: ${role}\n\n` +
        `⚠️ Please contact them IMMEDIATELY and ensure their safety.\n\n` +
        `— ExpertsHub Safety Team`;

    // 6. Notify emergency contacts in background (non-blocking for API response)
    triggerEmergencyFanout(contacts, smsMessage, emailBody);

    // 7. Emit real-time Socket.IO alerts
    try {
        const { getIo } = require('../../socket');
        const io = getIo();
        if (io) {
            const socketPayload = {
                alertId: sosAlert.id,
                bookingId,
                triggeredBy: {
                    id: userId,
                    name: triggeringUser?.name,
                    role,
                },
                location: normalizedLocation,
                service: booking.service?.name,
                timestamp: sosAlert.createdAt,
                status: 'ACTIVE',
            };

            // Notify all admins
            io.to('admin').emit('sos:alert', socketPayload);

            // Notify the "other party" in the booking (partner)
            const otherUserId = booking.customerId === userId
                ? booking.workerProfile?.userId
                : booking.customerId;

            if (otherUserId) {
                io.to(`user:${otherUserId}`).emit('sos:alert', {
                    ...socketPayload,
                    message: `🚨 SAFETY ALERT: The other party in Booking #${bookingId} has triggered an SOS alert. Please check in on them if possible or contact support.`,
                });
            }
            console.log('[SOS] Socket alerts emitted to admin and partner');
        }
    } catch (err) {
        console.warn('[SOS] Could not emit socket alerts:', err.message);
    }

    return {
        sosAlert,
        message: contacts.length > 0
            ? `SOS triggered! ${contacts.length} emergency contact(s) notified via SMS and the admin team has been alerted.`
            : `SOS triggered! Admin team notified. Add emergency contacts in your profile for wider coverage.`,
        contactsNotified: contacts.map((contact) => ({ name: contact.name, phone: contact.phone })),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY CONTACTS CRUD
// ─────────────────────────────────────────────────────────────────────────────
async function addEmergencyContact(userId, contactData) {
    const existingCount = await prisma.emergencyContact.count({ where: { userId } });
    if (existingCount >= 5) {
        throw new AppError(400, 'You can add up to 5 emergency contacts only.');
    }

    const normalizedPhone = String(contactData.phone || '').replace(/\s+/g, '');

    const existingContact = await prisma.emergencyContact.findFirst({
        where: {
            userId,
            phone: normalizedPhone,
        },
        select: { id: true },
    });

    if (existingContact) {
        throw new AppError(409, 'This phone number is already saved as an emergency contact.');
    }

    return await prisma.emergencyContact.create({
        data: {
            userId,
            name: String(contactData.name || '').trim(),
            phone: normalizedPhone,
            relation: String(contactData.relation || '').trim()
        }
    });
}

async function getEmergencyContacts(userId) {
    return await prisma.emergencyContact.findMany({ where: { userId } });
}

async function deleteEmergencyContact(userId, contactId) {
    const contact = await prisma.emergencyContact.findFirst({ where: { id: contactId, userId } });
    if (!contact) throw new AppError(404, 'Contact not found or not authorized.');
    return await prisma.emergencyContact.delete({ where: { id: contactId } });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Get all active SOS alerts
// ─────────────────────────────────────────────────────────────────────────────
async function getActiveSosAlerts({ skip = 0, limit = 20 } = {}) {
    const where = { status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } };
    const [data, total] = await Promise.all([
        prisma.sOSAlert.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                booking: {
                    include: {
                        customer: { select: { id: true, name: true, email: true } },
                        workerProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
                        service: { select: { name: true } },
                    }
                }
            },
            skip,
            take: limit,
        }),
        prisma.sOSAlert.count({ where }),
    ]);
    return { data, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Acknowledge / Resolve SOS alert
// ─────────────────────────────────────────────────────────────────────────────
async function updateSosAlertStatus(alertId, status) {
    const alert = await prisma.sOSAlert.update({
        where: { id: alertId },
        data: { status },
    });

    // Notify via socket
    try {
        const { getIo } = require('../../socket');
        const io = getIo();
        io.to('admin').emit('sos:alert_updated', { alertId, status });
        // Also notify the user's room
        io.to(`user:${alert.triggeredBy}`).emit('sos:alert_updated', { alertId, status });
    } catch (err) {
        console.warn('[SOS] Could not emit status update socket:', err.message);
    }

    return alert;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER: Get their active bookings (for global floating button)
// ─────────────────────────────────────────────────────────────────────────────
async function getActiveBookingForUser(userId) {
    const booking = await prisma.booking.findFirst({
        where: {
            status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
            OR: [
                { customerId: userId },
                { workerProfile: { userId } }
            ]
        },
        select: { id: true, status: true, service: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
    });
    return booking;
}

async function createBookingReport({ bookingId, reporterId, reporterRole, category, details, evidenceUrl }) {
    const normalizedCategory = normalizeReportCategory(category);
    const cleanedDetails = String(details || '').trim();
    const cleanedEvidenceUrl = evidenceUrl ? String(evidenceUrl).trim() : null;

    if (cleanedDetails.length < 20) {
        throw new AppError(400, 'Report details must be at least 20 characters long.');
    }

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
            id: true,
            status: true,
            customerId: true,
            customer: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, role: true } },
            workerProfile: {
                select: {
                    id: true,
                    userId: true,
                    user: { select: { id: true, name: true, email: true, mobile: true, profilePhotoUrl: true, role: true } },
                },
            },
            service: { select: { id: true, name: true } },
        },
    });

    if (!booking) {
        throw new AppError(404, 'Booking not found.');
    }

    if (!booking.workerProfile?.userId) {
        throw new AppError(409, 'This booking does not have a professional assigned yet.');
    }

    const reporterRoleUpper = String(reporterRole || '').toUpperCase();
    const reportTarget = reporterRoleUpper === 'CUSTOMER'
        ? { reportedUserId: booking.workerProfile.userId, reportedRole: 'WORKER' }
        : reporterRoleUpper === 'WORKER'
            ? { reportedUserId: booking.customerId, reportedRole: 'CUSTOMER' }
            : null;

    if (reporterRoleUpper === 'CUSTOMER') {
        if (Number(booking.customerId) !== Number(reporterId)) {
            throw new AppError(403, 'You can only report bookings that belong to you.');
        }
    } else if (reporterRoleUpper === 'WORKER') {
        if (Number(booking.workerProfile.userId) !== Number(reporterId)) {
            throw new AppError(403, 'You can only report bookings assigned to you.');
        }
    } else {
        throw new AppError(403, 'Only customers and workers can file booking reports.');
    }

    if (!reportTarget) {
        throw new AppError(403, 'Only customers and workers can file booking reports.');
    }

    let existingOpenReport;
    try {
        existingOpenReport = await prisma.bookingReport.findFirst({
            where: {
                bookingId,
                reporterId,
                status: { in: ['OPEN', 'UNDER_REVIEW'] },
            },
            select: { id: true, status: true },
        });
    } catch (error) {
        throwBookingReportsUnavailable(error);
    }

    if (existingOpenReport) {
        throw new AppError(409, 'You already have an open report for this booking.');
    }

    let report;
    try {
        report = await prisma.bookingReport.create({
            data: {
                bookingId,
                reporterId,
                reportedUserId: reportTarget.reportedUserId,
                reportedRole: reportTarget.reportedRole,
                category: normalizedCategory,
                priority: resolveReportPriority(normalizedCategory),
                details: cleanedDetails,
                evidenceUrl: cleanedEvidenceUrl,
            },
            select: bookingReportSelect,
        });
    } catch (error) {
        throwBookingReportsUnavailable(error);
    }

    await Promise.allSettled([
        notifyReportAdmins(report, reporterRoleUpper.toLowerCase()),
        notifyReportReporter(
            report,
            'We received your report and the safety team will review it shortly.',
            reporterRoleUpper === 'CUSTOMER' ? `/customer/bookings/${bookingId}` : `/worker/bookings/${bookingId}`,
        ),
    ]);

    emitReportEvent('reports:created', {
        reportId: report.id,
        bookingId: report.bookingId,
        category: report.category,
        status: report.status,
        priority: report.priority,
    });

    return report;
}

async function getMyBookingReports(userId, { bookingId, skip = 0, limit = 20 } = {}) {
    const where = {
        reporterId: userId,
        ...(bookingId ? { bookingId } : {}),
    };

    let data;
    let total;

    try {
        [data, total] = await Promise.all([
            prisma.bookingReport.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: bookingReportSelect,
            }),
            prisma.bookingReport.count({ where }),
        ]);
    } catch (error) {
        throwBookingReportsUnavailable(error);
    }

    return { data, total };
}

async function getAdminBookingReports(filters = {}, { skip = 0, limit = 20 } = {}) {
    const where = buildReportWhere(filters);

    let data;
    let total;

    try {
        [data, total] = await Promise.all([
            prisma.bookingReport.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: bookingReportSelect,
            }),
            prisma.bookingReport.count({ where }),
        ]);
    } catch (error) {
        throwBookingReportsUnavailable(error);
    }

    return { data, total };
}

async function getBookingReportSummary() {
    let total;
    let open;
    let underReview;
    let resolved;
    let dismissed;
    let urgent;
    let byCategory;

    try {
        [total, open, underReview, resolved, dismissed, urgent, byCategory] = await Promise.all([
            prisma.bookingReport.count(),
            prisma.bookingReport.count({ where: { status: 'OPEN' } }),
            prisma.bookingReport.count({ where: { status: 'UNDER_REVIEW' } }),
            prisma.bookingReport.count({ where: { status: 'RESOLVED' } }),
            prisma.bookingReport.count({ where: { status: 'DISMISSED' } }),
            prisma.bookingReport.count({ where: { priority: 'HIGH' } }),
            prisma.bookingReport.groupBy({
                by: ['category'],
                _count: { category: true },
            }),
        ]);
    } catch (error) {
        throwBookingReportsUnavailable(error);
    }

    return {
        total,
        open,
        underReview,
        resolved,
        dismissed,
        urgent,
        byCategory: byCategory.reduce((acc, entry) => {
            acc[entry.category] = entry._count.category;
            return acc;
        }, {}),
    };
}

async function updateBookingReportStatus({ reportId, adminId, status, adminNotes }) {
    const normalizedStatus = normalizeReportStatus(status);
    let report;
    try {
        report = await prisma.bookingReport.findUnique({
            where: { id: reportId },
            select: bookingReportSelect,
        });
    } catch (error) {
        throwBookingReportsUnavailable(error);
    }

    if (!report) {
        throw new AppError(404, 'Report not found.');
    }

    let updated;
    try {
        updated = await prisma.bookingReport.update({
            where: { id: reportId },
            data: {
                status: normalizedStatus,
                adminNotes: adminNotes ? String(adminNotes).trim() : report.adminNotes,
                reviewedById: adminId,
                reviewedAt: new Date(),
            },
            select: bookingReportSelect,
        });
    } catch (error) {
        throwBookingReportsUnavailable(error);
    }

    await Promise.allSettled([
        notifyReportReporter(
            updated,
            `Your report for booking #${updated.bookingId} is now ${updated.status.toLowerCase().replace(/_/g, ' ')}.`,
            updated.booking?.customer?.id === updated.reporterId
                ? `/customer/bookings/${updated.bookingId}`
                : `/worker/bookings/${updated.bookingId}`,
        ),
    ]);

    emitReportEvent('reports:updated', {
        reportId: updated.id,
        bookingId: updated.bookingId,
        status: updated.status,
        priority: updated.priority,
    });

    return updated;
}

module.exports = {
    triggerSOS,
    addEmergencyContact,
    getEmergencyContacts,
    deleteEmergencyContact,
    getActiveSosAlerts,
    updateSosAlertStatus,
    getActiveBookingForUser,
    createBookingReport,
    getMyBookingReports,
    getAdminBookingReports,
    getBookingReportSummary,
    updateBookingReportStatus,
};
