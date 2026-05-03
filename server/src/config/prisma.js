const { PrismaClient } = require('@prisma/client');

const isDev = process.env.NODE_ENV === 'development';

/**
 * Configure Prisma connection pool
 * 
 * The connection pool manages database connections efficiently
 * - maxOpenConnections: max connections to open to database
 * - minOpenConnections: min connections to keep open
 * 
 * Default is small (2-10) which causes ECONNREFUSED at 50+ users
 * We increase this for production to handle traffic
 */
const getConnectionString = () => {
  let url = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL || '';

  if (!url) {
    throw new Error('DATABASE_URL or DIRECT_DATABASE_URL must be set to connect to the database.');
  }
  
  // For PgBouncer / connection poolers, tune for performance
  if (shouldEnablePgbouncerMode(url)) {
    // PgBouncer mode: less aggressive since pooler handles connection management
    const separator = url.includes('?') ? '&' : '?';
    if (!url.includes('pgbouncer=')) {
      url += `${separator}pgbouncer=true`;
    }
    // For pooler, use moderate settings
    const poolSize = Math.max(parseInt(process.env.DATABASE_POOL_SIZE || '20', 10), 5);
    
    if (!url.includes('max_pool_size=')) {
      url += `&max_pool_size=${poolSize}&pool_mode=transaction&connection_limit_reserve=5&statement_limit=20`;
    }
  } else {
    // Direct connection: more aggressive pool sizing
    const poolSize = Math.max(parseInt(process.env.DATABASE_POOL_SIZE || '50', 10), 20);
    const connLifetime = Math.max(parseInt(process.env.DATABASE_CONN_LIFETIME || '600', 10), 60);
    const idleTimeout = Math.max(parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30', 10), 10);
    
    if (url && !url.includes('max_connections=')) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}max_connections=${poolSize}&connection_lifetime=${connLifetime}&idle_in_transaction_session_timeout=${idleTimeout}`;
    }
  }
  
  return url;
};

const connectionString = getConnectionString();

function shouldEnablePgbouncerMode(url) {
  const normalized = String(url || '').toLowerCase();
  if (!normalized) return false;
  if (String(process.env.PRISMA_FORCE_PGBOUNCER || '').toLowerCase() === 'true') return true;

  // Keep markers local to avoid TDZ/startup ordering issues.
  const markers = ['pooler', 'pgbouncer', 'supabase.co:6543', 'supabase.com:6543'];
  return markers.some((marker) => normalized.includes(marker));
}

const ensurePgbouncerFlag = (url) => {
  const value = String(url || '').trim();
  if (!value || !shouldEnablePgbouncerMode(value)) return value;

  const separator = value.includes('?') ? '&' : '?';
  if (!/([?&])pgbouncer=/i.test(value)) {
    return `${value}${separator}pgbouncer=true`;
  }
  return value;
};

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = ensurePgbouncerFlag(process.env.DATABASE_URL);
}

if (!process.env.DATABASE_URL && process.env.DIRECT_DATABASE_URL) {
  process.env.DATABASE_URL = ensurePgbouncerFlag(process.env.DIRECT_DATABASE_URL);
}

const hasDeletedAtFilter = (where) => {
  if (!where || typeof where !== 'object') {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(where, 'deletedAt')) {
    return true;
  }

  return ['AND', 'OR', 'NOT'].some((key) => {
    const value = where[key];
    if (!value) return false;
    if (Array.isArray(value)) {
      return value.some((item) => hasDeletedAtFilter(item));
    }
    return hasDeletedAtFilter(value);
  });
};

const USER_READ_ACTIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const isMissingDeletedAtError = (error) => {
  if (!error || error.code !== 'P2022') return false;
  const metaColumn = String(error?.meta?.column || '').toLowerCase();
  return metaColumn.includes('deletedat') || metaColumn.includes('deleted_at');
};

const isPreparedStatementConflictError = (error) => {
  const text = String(error?.message || '').toLowerCase();
  return text.includes('prepared statement') && text.includes('already exists');
};

const stripDeletedAtFilter = (where) => {
  if (!where || typeof where !== 'object') return where;

  if (Array.isArray(where)) {
    return where.map((item) => stripDeletedAtFilter(item)).filter(Boolean);
  }

  const next = {};
  for (const [key, value] of Object.entries(where)) {
    if (key === 'deletedAt') continue;
    if (key === 'AND' || key === 'OR' || key === 'NOT') {
      const normalized = stripDeletedAtFilter(value);
      if (Array.isArray(normalized) && normalized.length === 0) continue;
      if (normalized && typeof normalized === 'object' && !Array.isArray(normalized) && Object.keys(normalized).length === 0) continue;
      next[key] = normalized;
      continue;
    }
    next[key] = value;
  }

  return next;
};

const removeDeletedAtFromArgs = (args = {}) => {
  const nextArgs = { ...args };
  if (nextArgs.where && typeof nextArgs.where === 'object') {
    nextArgs.where = stripDeletedAtFilter(nextArgs.where);
  }
  if (nextArgs.select && typeof nextArgs.select === 'object' && Object.prototype.hasOwnProperty.call(nextArgs.select, 'deletedAt')) {
    const nextSelect = { ...nextArgs.select };
    delete nextSelect.deletedAt;
    nextArgs.select = nextSelect;
  }
  return nextArgs;
};

const injectActiveUserFilter = (args = {}) => {
  const nextArgs = { ...args };
  const where = nextArgs.where && typeof nextArgs.where === 'object' ? { ...nextArgs.where } : {};

  if (!hasDeletedAtFilter(where)) {
    where.deletedAt = null;
  }

  nextArgs.where = where;
  return nextArgs;
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      // Use configured connection string with proper pool settings
      url: connectionString,
    },
  },
  log: isDev
    ? [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ]
    : ['error', 'warn'],
});

const retriedPreparedStatementParams = new WeakSet();

prisma.$use(async (params, next) => {
  if (params.model === 'User') {
    if (params.action === 'findUnique') {
      params.action = 'findFirst';
      params.args = injectActiveUserFilter(params.args);
    } else if (params.action === 'findUniqueOrThrow') {
      params.action = 'findFirstOrThrow';
      params.args = injectActiveUserFilter(params.args);
    } else if (['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
      params.args = injectActiveUserFilter(params.args);
    } else if (params.action === 'delete') {
      params.action = 'update';
      params.args = {
        ...params.args,
        data: {
          ...(params.args?.data || {}),
          deletedAt: new Date(),
          isActive: false,
        },
      };
    } else if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      params.args = {
        ...params.args,
        data: {
          ...(params.args?.data || {}),
          deletedAt: new Date(),
          isActive: false,
        },
      };
    }
  }

  try {
    return await next(params);
  } catch (error) {
    if (isPreparedStatementConflictError(error) && !retriedPreparedStatementParams.has(params)) {
      retriedPreparedStatementParams.add(params);
      try {
        await prisma.$disconnect();
      } catch {
        // Best-effort reset.
      }
      try {
        await prisma.$connect();
      } catch {
        // Reconnect failure should surface original error context on retry.
      }
      return next(params);
    }

    if (USER_READ_ACTIONS.has(params.action) && isMissingDeletedAtError(error)) {
      const fallbackParams = {
        ...params,
        args: removeDeletedAtFromArgs(params.args),
      };
      return next(fallbackParams);
    }
    throw error;
  }
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

/**
 * Connect with retry logic
 * Better handles connection pool exhaustion and transient connection errors
 */
const connectWithRetry = async (maxRetries = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$connect();
      console.log('[Prisma] Connected to database');
      return;
    } catch (error) {
      lastError = error;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.warn(`[Prisma] Connection attempt ${attempt} failed (retry in ${delay}ms):`, error.message);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};

module.exports = prisma;
module.exports.connectWithRetry = connectWithRetry;

