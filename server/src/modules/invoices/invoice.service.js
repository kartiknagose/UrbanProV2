const PDFDocument = require('pdfkit');
const { format } = require('@fast-csv/format');
const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');

/**
 * Generate PDF Invoice for Customer
 */
exports.generateBookingInvoicePDF = async ({ bookingId, requesterId, requesterRole, res }) => {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            customer: { select: { id: true, name: true } },
            workerProfile: { select: { userId: true, user: { select: { name: true } } } },
            service: true
        }
    });

    if (!booking) throw new AppError(404, 'Booking not found');

    const canAccess =
        requesterRole === 'ADMIN'
        || booking.customerId === requesterId
        || booking.workerProfile?.userId === requesterId;

    if (!canAccess) {
        throw new AppError(403, 'You are not authorized to access this invoice.');
    }

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('TAX INVOICE', { align: 'center' });
    doc.moveDown();

    // Platform Info
    doc.fontSize(10)
        .text('UrbanPro Logistics & Services Platform', { align: 'right' })
        .text('GSTIN: 27AABCU9603R1ZM', { align: 'right' })
        .text('Support: support@urbanpro.com', { align: 'right' });

    doc.moveDown();

    // Customer / Booking Info
    doc.text(`Invoice No: INV-${booking.id}`)
        .text(`Date: ${new Date(booking.createdAt).toLocaleDateString()}`)
        .text(`Customer: ${booking.customer.name}`)
        .text(`Address: ${booking.address || 'N/A'}`);

    doc.moveDown(2);

    // Itemized Details
    doc.fontSize(12).text('Charges Breakdown', { underline: true });
    doc.moveDown();

    doc.fontSize(10);
    const drawRow = (label, amount) => {
        doc.text(label, 50, doc.y, { continued: true })
            .text(`Rs ${Number(amount).toFixed(2)}`, { align: 'right' });
    };

    drawRow('Base Service Rate', booking.basePrice || booking.totalPrice);

    if (booking.timeMultiplier > 1) {
        drawRow(`Time/Weekend Premium (x${booking.timeMultiplier})`, booking.basePrice * (booking.timeMultiplier - 1));
    }
    if (booking.surgeMultiplier > 1) {
        const sub1 = booking.basePrice * booking.timeMultiplier;
        drawRow(`Demand Surge (x${booking.surgeMultiplier})`, sub1 * (booking.surgeMultiplier - 1));
    }
    if (booking.urgencyMultiplier > 1) {
        const sub2 = booking.basePrice * booking.timeMultiplier * booking.surgeMultiplier;
        drawRow(`Urgency Priority (x${booking.urgencyMultiplier})`, sub2 * (booking.urgencyMultiplier - 1));
    }
    if (booking.distanceSurcharge > 0) {
        drawRow('Distance Surcharge (>5km)', booking.distanceSurcharge);
    }

    doc.moveDown();
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    drawRow('GST (18%)', booking.gstAmount || 0);

    doc.moveDown();
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('TOTAL AMOUNT', 50, doc.y, { continued: true })
        .text(`Rs ${Number(booking.totalPrice).toFixed(2)}`, { align: 'right' });

    doc.font('Helvetica').fontSize(10).moveDown(2);

    if (booking.paymentStatus === 'PAID') {
        doc.fillColor('green').text('STATUS: PAID', { align: 'center' }).fillColor('black');
        if (booking.paymentReference) {
            doc.text(`Payment Ref: ${booking.paymentReference}`, { align: 'center' });
        }
    } else {
        doc.fillColor('red').text(`STATUS: ${booking.paymentStatus}`, { align: 'center' }).fillColor('black');
    }

    doc.moveDown(4);
    doc.fontSize(8).text('This is a computer-generated invoice and does not require a signature.', { align: 'center' });

    doc.end();
};

/**
 * Generate Monthly Revenue & TDS Report for a Worker
 */
exports.generateWorkerRevenuePDF = async (userId, month, year, res) => {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new AppError(400, 'Month must be between 1 and 12.');
    }
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
        throw new AppError(400, 'Year must be between 2020 and 2100.');
    }

    const profile = await prisma.workerProfile.findUnique({
        where: { userId },
        include: { user: true }
    });

    if (!profile) throw new AppError(404, 'Worker profile not found');

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const payouts = await prisma.payout.findMany({
        where: {
            workerProfileId: profile.id,
            status: 'PROCESSED',
            createdAt: { gte: startDate, lte: endDate }
        }
    });

    const bookings = await prisma.booking.findMany({
        where: {
            workerProfileId: profile.id,
            status: 'COMPLETED',
            paymentStatus: 'PAID',
            createdAt: { gte: startDate, lte: endDate }
        }
    });

    const totalEarned = bookings.reduce((sum, b) => sum + Number(b.workerPayoutAmount || 0), 0);
    const totalCommission = bookings.reduce((sum, b) => sum + Number(b.platformCommission || 0), 0);
    const totalWithdrawn = payouts.reduce((sum, p) => sum + Number(p.amount), 0);
    const expectedTDS = totalEarned * 0.01; // India 1% TDS standard logic illustration under 194O

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).text('MONTHLY EARNINGS & TAX REPORT', { align: 'center' });
    doc.fontSize(12).text(`${startDate.toLocaleString('default', { month: 'long' })} ${year}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(10)
        .text(`Name: ${profile.user.name}`)
        .text(`Phone: ${profile.user.mobile}`)
        .text(`Account Linked: ${profile.razorpayAccountId || 'N/A'}`);

    doc.moveDown(2);

    const drawRow = (label, val) => {
        doc.text(label, 50, doc.y, { continued: true }).text(`Rs ${val.toFixed(2)}`, { align: 'right' });
    };

    doc.fontSize(12).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.moveDown().font('Helvetica').fontSize(10);

    drawRow('Total Jobs Completed', bookings.length);
    drawRow('Gross Earnings', totalEarned + totalCommission);
    drawRow('Platform Commission Deducted', -totalCommission);

    doc.moveDown();
    drawRow('Net Mappable Earnings', totalEarned);
    drawRow('TDS Applicable (1% 194-O)', -expectedTDS);

    doc.moveDown().font('Helvetica-Bold');
    drawRow('Funds Withdrawn to Bank', totalWithdrawn);

    doc.font('Helvetica').moveDown(3);
    doc.fontSize(8).text('Note: This report helps file Income Tax Returns under section 194-O.', { align: 'center' });

    doc.end();
};

/**
 * Platform Admin - Export CSV for GSTR-1 logic
 */
exports.exportGSTR1CSV = async (month, year, res) => {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new AppError(400, 'Month must be between 1 and 12.');
    }
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
        throw new AppError(400, 'Year must be between 2020 and 2100.');
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const bookings = await prisma.booking.findMany({
        where: {
            paymentStatus: 'PAID',
            status: 'COMPLETED',
            paidAt: { gte: startDate, lte: endDate }
        },
        include: { service: true, customer: true }
    });

    const csvStream = format({ headers: true });
    csvStream.pipe(res);

    for (const b of bookings) {
        csvStream.write({
            'Invoice No': `INV-${b.id}`,
            'Date': new Date(b.paidAt || b.createdAt).toLocaleDateString(),
            'Customer Name': b.customer.name,
            'Service Category': b.service?.category || 'N/A',
            'Taxable Base Value': Number(b.basePrice || b.totalPrice || 0) - Number(b.gstAmount || 0),
            'IGST/CGST/SGST Amount': Number(b.gstAmount || 0),
            'Total Invoice Value': Number(b.totalPrice || 0),
            'Platform Commission': Number(b.platformCommission || 0),
            'Worker Payout': Number(b.workerPayoutAmount || 0),
            'Status': b.paymentStatus
        });
    }

    csvStream.end();
};
