module.exports = (ms = 30000) => (req, res, next) => {
  res.setTimeout(ms, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'Request timed out. Please try again.' });
    }
  });
  next();
};
