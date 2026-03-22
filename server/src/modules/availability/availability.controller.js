const asyncHandler = require('../../common/utils/asyncHandler');
const parseId = require('../../common/utils/parseId');
const {
  listAvailability,
  createAvailability,
  removeAvailability,
} = require('./availability.service');

exports.listMine = asyncHandler(async (req, res) => {
  const availability = await listAvailability(req.user.id);
  res.json({ availability });
});

exports.create = asyncHandler(async (req, res) => {
  const availability = await createAvailability(req.user.id, req.body);
  res.status(201).json({
    message: 'Availability added successfully.',
    availability,
  });
});

exports.remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'Availability ID');

  await removeAvailability(req.user.id, id);
  res.json({ message: 'Availability removed successfully.' });
});
