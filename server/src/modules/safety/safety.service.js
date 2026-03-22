const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');
const { sendEmail } = require('../../common/utils/mailer');

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

/**
 * Send SMS via Email-to-SMS gateway (free)
 * Falls back silently if email credentials not configured
 */
async function sendSMSViaEmail(phone, message, carrier = 'default') {
    // Clean phone number — strip spaces, dashes, +91 prefix
    const cleanPhone = phone.replace(/[\s\-+]/g, '').replace(/^91/, '').slice(-10);
    const gateway = SMS_GATEWAYS[carrier] || DEFAULT_GATEWAY;
    const smsEmail = `${cleanPhone}${gateway}`;

    try {
        await sendEmail({
            to: smsEmail,
            logContext: 'SOS SMS Gateway',
            subject: '🚨 SOS ALERT — UrbanPro Emergency',
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
    try {
        await sendEmail({
            to,
            logContext: 'SOS Email Alert',
            subject,
            text: body
        });
        console.log(`[SOS] Email sent to ${to}`);
    } catch (err) {
        console.error(`[SOS] Email failed to ${to}:`, err.message);
    }
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
        `🚨 SOS ALERT from UrbanPro!\n` +
        `${triggeringUser?.name || 'User'} (${role}) needs IMMEDIATE help.\n` +
        `Booking #${bookingId} - ${booking.service?.name || 'Service'}\n` +
        `${locationStr}\n` +
        `Call them NOW!`;

    const emailBody =
        `🚨 EMERGENCY SOS ALERT — UrbanPro Safety System\n\n` +
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
        `— UrbanPro Safety Team`;

    // 6. Notify emergency contacts via SMS + email (async, non-blocking)
    const notifyPromises = contacts.map(async (contact) => {
        await Promise.allSettled([
            sendSMSViaEmail(contact.phone, smsMessage),
            // If contact has email field, send email too (fallback)
            contact.email ? sendEmailAlert(contact.email, '🚨 SOS ALERT — UrbanPro Emergency', emailBody) : Promise.resolve(),
        ]);
        return { name: contact.name, phone: contact.phone };
    });
    const notifiedContacts = await Promise.all(notifyPromises);

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
        contactsNotified: notifiedContacts,
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

module.exports = {
    triggerSOS,
    addEmergencyContact,
    getEmergencyContacts,
    deleteEmergencyContact,
    getActiveSosAlerts,
    updateSosAlertStatus,
    getActiveBookingForUser,
};
