// Register cache routes in main Express app
const cacheRoutes = require('./cache.routes');

module.exports = function(app, basePath = '/api') {
  app.use(`${basePath}/cache`, cacheRoutes);
};
