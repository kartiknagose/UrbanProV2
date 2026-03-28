const { createLogger, format, transports } = require('winston');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: isProduction ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.splat(),
    format.errors({ stack: true }),
    isProduction
      ? format.json()
      : format.combine(format.colorize(), format.printf(({ timestamp, level, message, stack, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
        }))
  ),
  transports: [
    new transports.Console(),
    ...(isProduction
      ? [
          new transports.File({ filename: path.join('logs', 'error.log'), level: 'error', maxsize: 5242880, maxFiles: 5 }),
          new transports.File({ filename: path.join('logs', 'combined.log'), maxsize: 5242880, maxFiles: 5 }),
        ]
      : []),
  ],
});

module.exports = logger;
