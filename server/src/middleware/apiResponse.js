const apiResponse = require('../common/utils/apiResponse');

module.exports = function apiResponseMiddleware(req, res, next) {
  res.success = (data, statusCode = 200) => apiResponse.success(res, data, statusCode);
  res.fail = (message, statusCode = 500, details = null) => apiResponse.error(res, message, statusCode, details);
  next();
};
