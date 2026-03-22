const express = require('express');
const router = express.Router();

const authenticate = require('../../middleware/auth');
const { requireWorker, requireAdmin } = require('../../middleware/requireRole');
const validate = require('../../middleware/validation');
const invoiceController = require('./invoice.controller');
const {
	bookingInvoiceParamSchema,
	reportQuerySchema,
} = require('./invoice.schemas');

// GET /api/invoices/booking/:id - Standard booking invoice for Customers / Workers
router.get('/booking/:id', authenticate, bookingInvoiceParamSchema, validate, invoiceController.downloadBookingInvoice);

// GET /api/invoices/worker-report - Monthly Revenue & TDS statement for ITR
router.get('/worker-report', authenticate, requireWorker, reportQuerySchema, validate, invoiceController.downloadWorkerReport);

// GET /api/invoices/gstr1 - Export GST compatible sales CSV
router.get('/gstr1', authenticate, requireAdmin, reportQuerySchema, validate, invoiceController.exportGSTR1);

module.exports = router;
