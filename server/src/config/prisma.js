const { PrismaClient } = require('@prisma/client');

const isDev = process.env.NODE_ENV === 'development';

const prisma = new PrismaClient({
  log: isDev
    ? [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ]
    : ['error', 'warn'],
});

// Log slow queries in development
if (isDev) {
  prisma.$on('query', (e) => {
    const slowThreshold = 100; // ms
    if (e.duration > slowThreshold) {
      const params = e.params ? ` [params: ${e.params}]` : '';
      console.warn(`[SLOW_QUERY] ${e.duration}ms: ${e.query}${params}`);
    }
  });
}

module.exports = prisma;