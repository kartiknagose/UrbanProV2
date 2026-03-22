const invoiceService = require('./invoice.service');
const asyncHandler = require('../../common/utils/asyncHandler');
const parseId = require('../../common/utils/parseId');

const downloadBookingInvoice = asyncHandler(async (req, res) => {
    const bookingId = parseId(req.params.id, 'Booking ID');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${bookingId}.pdf"`);
    await invoiceService.generateBookingInvoicePDF({
        bookingId,
        requesterId: req.user.id,
        requesterRole: req.user.role,
        res,
    });
});

const downloadWorkerReport = asyncHandler(async (req, res) => {
    const { month, year } = req.query;
    const m = Number.isInteger(month) ? month : Number(month) || (new Date().getMonth() + 1);
    const y = Number.isInteger(year) ? year : Number(year) || new Date().getFullYear();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="worker-earnings-${m}-${y}.pdf"`);
    await invoiceService.generateWorkerRevenuePDF(req.user.id, m, y, res);
});

const exportGSTR1 = asyncHandler(async (req, res) => {
    const { month, year } = req.query;
    const m = Number.isInteger(month) ? month : Number(month) || (new Date().getMonth() + 1);
    const y = Number.isInteger(year) ? year : Number(year) || new Date().getFullYear();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="gstr1-${m}-${y}.csv"`);
    await invoiceService.exportGSTR1CSV(m, y, res);
});

module.exports = {
    downloadBookingInvoice,
    downloadWorkerReport,
    exportGSTR1
};
