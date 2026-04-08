const { PrismaClient } = require('@prisma/client');

const isDev = process.env.NODE_ENV === 'development';

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
  log: isDev
    ? [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ]
    : ['error', 'warn'],
});

prisma.$use(async (params, next) => {
  if (params.model !== 'User') {
    return next(params);
  }

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

  try {
    return await next(params);
  } catch (error) {
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

module.exports = prisma;