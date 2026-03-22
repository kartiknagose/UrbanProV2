const prisma = require('../../config/prisma');

/**
 * Get high-level Admin KPIs
 * - GMV (Total value of all paid bookings)
 * - Platform Revenue (Commissions)
 * - Active Users (30-day login count)
 * - Active Workers
 * - Average Worker Response Time (Booking created to accepted) - Mock for now
 */
async function getAdminKPIs() {
    const activeSince = new Date();
    activeSince.setDate(activeSince.getDate() - 30);

    const [gmvData, revenueData, usersCount, workersCount, bookingsCount] = await Promise.all([
        // GMV: Sum of total price of COMPLETED/PAID bookings
        prisma.booking.aggregate({
            _sum: { totalPrice: true },
            where: { status: 'COMPLETED', paymentStatus: 'PAID' }
        }),
        // Revenue: Sum of platform commissions
        prisma.booking.aggregate({
            _sum: { platformCommission: true },
            where: { status: 'COMPLETED', paymentStatus: 'PAID' }
        }),
        // Users active in last 30 days
        prisma.user.count({
            where: {
                isActive: true,
                lastActiveAt: { gte: activeSince },
            },
        }),
        // Workers active + verified
        prisma.workerProfile.count({
            where: {
                isVerified: true,
                user: { isActive: true },
            },
        }),
        // Total Bookings
        prisma.booking.count(),
    ]);

    const gmv = Number(gmvData._sum.totalPrice || 0);
    const revenue = Number(revenueData._sum.platformCommission || 0);

    return {
        gmv,
        revenue,
        activeUsers: usersCount,
        activeWorkers: workersCount,
        totalBookings: bookingsCount,
        avgResponseTimeMinutes: null,
        growthMoM: null,
    };
}

/**
 * Get Monthly Revenue & GMV Data for charts
 */
async function getMonthlyPerformance() {
    const results = await prisma.$queryRaw`
        WITH monthly AS (
            SELECT
                DATE_TRUNC('month', "paidAt") AS month_date,
                SUM("totalPrice") AS gmv,
                SUM("platformCommission") AS revenue,
                COUNT("id") AS bookings
            FROM "Booking"
            WHERE "paymentStatus" = 'PAID'
              AND "status" = 'COMPLETED'
              AND "paidAt" IS NOT NULL
            GROUP BY DATE_TRUNC('month', "paidAt")
            ORDER BY month_date DESC
            LIMIT 6
        )
        SELECT
            TO_CHAR(month_date, 'Mon YYYY') AS month,
            gmv,
            revenue,
            bookings
        FROM monthly
        ORDER BY month_date ASC;
    `;

    return results.map(r => ({
        month: r.month,
        gmv: Number(r.gmv || 0),
        revenue: Number(r.revenue || 0),
        bookings: Number(r.bookings || 0)
    }));
}

/**
 * Get category-wise performance
 */
async function getCategoryBreakdown() {
    const results = await prisma.$queryRaw`
        SELECT 
            s.category as category,
            SUM(b."totalPrice") as value,
            COUNT(b."id") as count
        FROM "Booking" b
        JOIN "Service" s ON b."serviceId" = s.id
        WHERE b."status" = 'COMPLETED'
          AND b."paymentStatus" = 'PAID'
        GROUP BY s.category
        ORDER BY value DESC;
    `;

    return results.map(r => ({
        name: r.category,
        value: Number(r.value || 0),
        count: Number(r.count || 0)
    }));
}

/**
 * Worker Performance Metrics
 */
async function getWorkerMetrics() {
    const topEarners = await prisma.$queryRaw`
        SELECT
            u.name AS name,
            COALESCE(SUM(b."workerPayoutAmount"), 0) AS earnings
        FROM "WorkerProfile" wp
        JOIN "User" u ON wp."userId" = u.id
        LEFT JOIN "Booking" b ON b."workerProfileId" = wp.id
            AND b."status" = 'COMPLETED'
            AND b."paymentStatus" = 'PAID'
        WHERE u."isActive" = true
        GROUP BY u.name, wp.id
        ORDER BY earnings DESC
        LIMIT 5;
    `;

    const averageRating = await prisma.review.aggregate({
        _avg: { rating: true }
    });

    return {
        topEarners: topEarners.map((w) => ({
            name: w.name,
            earnings: Number(w.earnings || 0)
        })),
        overallRating: Math.round(Number(averageRating._avg.rating || 0) * 10) / 10
    };
}

module.exports = {
    getAdminKPIs,
    getMonthlyPerformance,
    getCategoryBreakdown,
    getWorkerMetrics
};
