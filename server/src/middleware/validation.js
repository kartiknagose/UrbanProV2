// Request validation middleware
// Use this after route validators created with `express-validator`.
// Example:
// router.post('/signup', [body('email').isEmail(), body('password').isLength({ min: 6 })], validate, handler)
const { validationResult } = require('express-validator');

module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const sanitized = errors.array().map((item) => ({
      message: item.msg,
      field: item.path,
      location: item.location,
    }));

    // Return the first message as `message` for quick client display and
    // include the full array under `errors` for richer client-side handling.
    return res.status(400).json({
      error: sanitized[0].message,
      statusCode: 400,
      errors: sanitized,
    });
  }
  next();
};