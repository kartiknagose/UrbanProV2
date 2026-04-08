const messageStore = require('./messageStore');
const logger = require('../../config/logger');

const WHATSAPP_ENABLED = Boolean(process.env.WHATSAPP_PROVIDER_API_KEY);

/**
 * Service to handle WhatsApp Notifications
 * Implemented as a FREE Mock Service to avoid Twilio WhatsApp API costs.
 */

class WhatsAppService {
    /**
     * Send a rich WhatsApp message template simulate
     * @param {string} to - Destination phone number
     * @param {string} type - 'CONFIRMATION' | 'REMINDER' | 'ON_THE_WAY' | 'COMPLETED'
     * @param {Object} data - Variables for the template
     */
    static async sendTemplateMessage(to, type, data) {
        if (!to) return null;
        let message;

        switch (type) {
            case 'CONFIRMATION':
                message = `🟢 *Booking Confirmed!*\n\nHi ${data.customerName}, your ExpertsHub service for *${data.serviceName}* is confirmed for *${data.time}*.\nProvider: ${data.workerName}.\nTotal Estimate: ₹${data.estimate}`;
                break;
            case 'REMINDER':
                message = `⏳ *1-Hour Reminder*\n\nHi ${data.customerName}, your service professional *${data.workerName}* will arrive at *${data.time}* for your ${data.serviceName} booking. Please be ready!`;
                break;
            case 'ON_THE_WAY':
                message = `🚗 *Provider on the Way!*\n\n${data.workerName} is en route to your location. Estimated arrival time is soon.`;
                break;
            case 'COMPLETED':
                message = `✅ *Job Completed*\n\nYour service *${data.serviceName}* is complete. Final amount: *₹${data.total}*. Please visit the app to review and download your invoice.`;
                break;
            default:
                message = `New WhatsApp Alert from ExpertsHub: Please check the app.`;
        }

        try {
            if (!WHATSAPP_ENABLED) {
                logger.info(`[WHATSAPP_STUB] Would send to ${to}: ${message}`);
                const record = messageStore.add('WHATSAPP', to, message);
                return { success: true, messageId: record.id, status: 'DELIVERED_STUB', stubbed: true };
            }

            // FREE MOCK IMPLEMENTATION
            logger.info(`[MOCK WHATSAPP] Sending to ${to}: ${message}`);

            const record = messageStore.add('WHATSAPP', to, message);
            return { success: true, messageId: record.id, status: 'DELIVERED_MOCK' };
        } catch (error) {
            logger.error(`[MOCK WHATSAPP] Failed to send to ${to}`, error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = WhatsAppService;
