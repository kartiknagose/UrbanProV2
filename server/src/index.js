const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const { PORT, CORS_ORIGIN } = require('./config/env');
const { corsOptions } = require('./config/cors');
const i18n = require('./config/i18n');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const workerRoutes = require('./modules/workers/worker.routes');
const serviceRoutes = require('./modules/services/service.routes');

// Routes
const authRoutes = require('./modules/auth/auth.routes');
const bookingRoutes = require('./modules/bookings/booking.routes');

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(i18n);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', locale: req.locale });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes); // Mount booking routes at /api/bookings

// 404 and error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server only if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`CORS origin: ${CORS_ORIGIN}`);
  });
}

module.exports = app;