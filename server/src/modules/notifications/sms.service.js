const messageStore = require('./messageStore');
const logger = require('../../config/logger');

const SMS_ENABLED = Boolean(process.env.SMS_PROVIDER_API_KEY);

/**
 * Service to handle SMS Notifications
 * Currently implemented as a FREE Mock Service to avoid Twilio/MSG91 costs.
 * To upgrade to real Twilio: Replace the internals of these functions with the Twilio SDK.
 */

class SMSService {
    /**
     * Send a general SMS message
     * @param {string} to - Destination phone number
     * @param {string} message - The text content of the SMS
     */
    static async sendSMS(to, message) {
        if (!to) return null;

        try {
            if (!SMS_ENABLED) {
                logger.info(`[SMS_STUB] Would send to ${to}: ${message}`);
                const record = messageStore.add('SMS', to, message);
                return { success: true, messageId: record.id, status: 'DELIVERED_STUB', stubbed: true };
            }

            // FREE MOCK IMPLEMENTATION
            logger.info(`[MOCK SMS] Sending to ${to}: ${message}`);

            const record = messageStore.add('SMS', to, message);
            return { success: true, messageId: record.id, status: 'DELIVERED_MOCK' };
        } catch (error) {
            logger.error(`[MOCK SMS] Failed to send to ${to}`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send an OTP via SMS
     * @param {string} to - Destination phone number
     * @param {string} otp - The OTP code
     */
    static async sendOTP(to, otp) {
        const message = `Your ExpertsHub verification code is: ${otp}. Do not share this code with anyone.`;
        return this.sendSMS(to, message);
    }

    /**
     * Send Booking Start/Completion OTPs
     * @param {string} to - Customer phone 
     * @param {string} otp - The OTP
     * @param {string} type - 'START' or 'COMPLETE'
     */
    static async sendBookingOTP(to, otp, type) {
        const action = type === 'START' ? 'start' : 'complete';
        const message = `Provide this OTP: ${otp} to your worker to ${action} the job securely. - ExpertsHub`;
        return this.sendSMS(to, message);
    }
}

module.exports = SMSService;
