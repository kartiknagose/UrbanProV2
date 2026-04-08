function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

function error(res, message, statusCode = 500, details = null) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  success,
  error,
};
