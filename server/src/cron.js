const cron = require('node-cron');
const { processDailyCronPayouts } = require('./modules/payouts/payout.service');
const { initReminderCron } = require('./modules/bookings/reminder.cron');

let isInitialized = false;

// Initialize all background crons
function initCronJobs() {
    if (isInitialized) {
        console.log('[CRON] initCronJobs called again; skipping duplicate registration.');
        return;
    }

    isInitialized = true;
    console.log('[CRON] Initializing background jobs...');
    initReminderCron();

    // 11:00 PM IST — Daily automated bank payouts for workers
    cron.schedule('0 23 * * *', async () => {
        try {
            await processDailyCronPayouts();
        } catch (err) {
            console.error('[CRON] Error in daily payouts:', err);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    // 11:30 PM IST — Daily loyalty points expiration
    cron.schedule('30 23 * * *', async () => {
        try {
            const { expireOldPoints } = require('./modules/business_growth/loyalty.service');
            await expireOldPoints();
            console.log('[CRON] Loyalty points expiration check completed.');
        } catch (err) {
            console.error('[CRON] Error in loyalty expiration:', err);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('[CRON] Jobs scheduled successfully.');
}

module.exports = { initCronJobs };
