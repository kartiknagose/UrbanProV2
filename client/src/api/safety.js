import axiosInstance from './axios';
import { normalizeQueryInput } from './queryContext';

/**
 * TRIGGER SOS ALERT
 * @param {Object} data - { bookingId, location: { latitude, longitude } }
 */
export const triggerSOS = async (data) => {
    const response = await axiosInstance.post('/safety/sos', data);
    return response.data;
};

/**
 * GET EMERGENCY CONTACTS
 */
export const getEmergencyContacts = async () => {
    const response = await axiosInstance.get('/safety/contacts');
    return response.data;
};

/**
 * ADD EMERGENCY CONTACT
 * @param {Object} data - { name, phone, relation }
 */
export const addEmergencyContact = async (data) => {
    const response = await axiosInstance.post('/safety/contacts', data);
    return response.data;
};

/**
 * DELETE EMERGENCY CONTACT
 * @param {number} contactId
 */
export const deleteEmergencyContact = async (contactId) => {
    const response = await axiosInstance.delete(`/safety/contacts/${contactId}`);
    return response.data;
};

/**
 * GET CURRENT ACTIVE BOOKING (for global SOS button)
 * Returns the most recent CONFIRMED or IN_PROGRESS booking for the user, or null.
 */
export const getActiveBooking = async () => {
    const response = await axiosInstance.get('/safety/active-booking');
    return response.data;
};

/**
 * CREATE BOOKING REPORT
 * @param {Object} data - { bookingId, category, details, evidenceUrl? }
 */
export const createBookingReport = async (data) => {
    const response = await axiosInstance.post('/safety/reports', data);
    return response.data;
};

/**
 * GET MY BOOKING REPORTS
 * @param {Object} params - optional { bookingId, page, limit }
 */
export const getMyBookingReports = async (params = {}) => {
    const normalized = normalizeQueryInput(params);
    const response = await axiosInstance.get('/safety/reports/me', {
        params: normalized.params,
        signal: normalized.signal,
    });
    return response.data;
};

/**
 * ADMIN: GET BOOKING REPORT SUMMARY
 */
export const getBookingReportSummary = async () => {
    const response = await axiosInstance.get('/safety/reports/summary');
    return response.data;
};

/**
 * ADMIN: GET BOOKING REPORTS
 */
export const getBookingReports = async (params = {}) => {
    const normalized = normalizeQueryInput(params);
    const response = await axiosInstance.get('/safety/reports', {
        params: normalized.params,
        signal: normalized.signal,
    });
    return response.data;
};

/**
 * ADMIN: UPDATE BOOKING REPORT STATUS
 */
export const updateBookingReportStatus = async (reportId, data) => {
    const response = await axiosInstance.patch(`/safety/reports/${reportId}/status`, data);
    return response.data;
};

/**
 * ADMIN: GET ALL ACTIVE SOS ALERTS
 */
export const getActiveSosAlerts = async () => {
    const response = await axiosInstance.get('/safety/sos/alerts');
    return response.data;
};

/**
 * ADMIN: UPDATE SOS ALERT STATUS
 * @param {number} alertId
 * @param {string} status - 'ACKNOWLEDGED' | 'RESOLVED'
 */
export const updateSosAlertStatus = async (alertId, status) => {
    const response = await axiosInstance.patch(`/safety/sos/alerts/${alertId}`, { status });
    return response.data;
};
