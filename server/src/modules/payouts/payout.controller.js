const asyncHandler = require('../../common/utils/asyncHandler');
const payoutService = require('./payout.service');

exports.getBankDetails = asyncHandler(async (req, res) => {
    const details = await payoutService.getWorkerBankDetails(req.user.id);
    res.json(details);
});

exports.updateBankDetails = asyncHandler(async (req, res) => {
    const { bankAccountNumber, bankIfsc, razorpayAccountId } = req.body;
    const details = await payoutService.updateWorkerBankDetails(req.user.id, bankAccountNumber, bankIfsc, razorpayAccountId);
    res.json({ message: 'Bank details updated successfully', data: details });
});

exports.requestInstantPayout = asyncHandler(async (req, res) => {
    const payout = await payoutService.processInstantPayout(req.user.id);
    res.json({ message: 'Instant payout initiated successfully', data: payout });
});

exports.getPayoutHistory = asyncHandler(async (req, res) => {
    const { skip, limit } = req.query;
    const history = await payoutService.getWorkerPayoutHistory(req.user.id, {
        skip: Number.isInteger(skip) ? skip : Number(skip) || 0,
        limit: Number.isInteger(limit) ? limit : Number(limit) || 20
    });
    res.json(history);
});
