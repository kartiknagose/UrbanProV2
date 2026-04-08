const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { io } = require('socket.io-client');

const CircuitBreaker = require('../src/common/utils/circuitBreaker');
const timeoutMiddleware = require('../src/middleware/timeout');
const prisma = require('../src/config/prisma');
const { signJwt } = require('../src/common/utils/jwt');

async function httpGet(url, headers = {}) {
  const response = await fetch(url, { method: 'GET', headers });
  const text = await response.text();
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    text,
  };
}

async function verifyHealthAndMetrics() {
  const health = await httpGet('http://127.0.0.1:3000/health');
  const metrics = await httpGet('http://127.0.0.1:3000/metrics');
  return {
    healthStatus: health.status,
    healthBody: health.text,
    metricsStatus: metrics.status,
    metricsLooksPrometheus: metrics.text.includes('# HELP') && metrics.text.includes('process_cpu_seconds_total'),
  };
}

async function verifyEtagAndCompression() {
  const res = await httpGet('http://127.0.0.1:3000/api/cache/service-catalog', {
    'Accept-Encoding': 'gzip',
  });
  return {
    status: res.status,
    etagPresent: Boolean(res.headers.etag),
    contentEncoding: res.headers['content-encoding'] || null,
  };
}

function verifyDbUrlPoolingConfig() {
  const envPath = path.resolve(__dirname, '..', '.env');
  const envText = fs.readFileSync(envPath, 'utf8');
  const line = envText.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')) || '';
  return {
    hasConnectionLimit: line.includes('connection_limit='),
    hasPoolTimeout: line.includes('pool_timeout='),
    line,
  };
}

async function verifyCacheEndpoint() {
  const res = await httpGet('http://127.0.0.1:3000/api/cache/service-catalog');
  let parsed;
  try {
    parsed = JSON.parse(res.text);
  } catch (_err) {
    parsed = null;
  }
  return {
    status: res.status,
    hasServicesArray: Array.isArray(parsed?.services),
    count: Array.isArray(parsed?.services) ? parsed.services.length : 0,
  };
}

async function verifyPrismaSlowQueryLogging() {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => {
    warnings.push(args.map((x) => String(x)).join(' '));
    originalWarn(...args);
  };

  try {
    await prisma.$executeRawUnsafe('SELECT pg_sleep(0.2)');
  } finally {
    console.warn = originalWarn;
  }

  return {
    slowQueryLogged: warnings.some((w) => w.includes('[SLOW_QUERY]')),
    warningsCount: warnings.length,
  };
}

async function verifyCircuitBreaker() {
  const breaker = new CircuitBreaker('runtime-check', {
    failureThreshold: 3,
    resetTimeout: 60000,
    successThreshold: 1,
  });

  const seen = [];
  for (let i = 0; i < 4; i += 1) {
    try {
      await breaker.execute(async () => {
        throw new Error('forced-failure');
      });
    } catch (err) {
      seen.push({ i, code: err.code || null, message: err.message, state: breaker.getState().state });
    }
  }

  return {
    opened: seen.some((x) => x.state === 'OPEN'),
    fastFailCodeSeen: seen.some((x) => x.code === 'CIRCUIT_OPEN'),
    attempts: seen,
  };
}

async function verifyTimeoutMiddleware() {
  const app = express();
  app.use(timeoutMiddleware(1000));
  app.get('/slow', async (_req, res) => {
    await new Promise((r) => setTimeout(r, 2000));
    if (!res.headersSent) res.json({ ok: true });
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(3101, () => resolve(s));
  });

  const result = await new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3101/slow', (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += String(chunk);
      });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', (err) => resolve({ status: 0, body: err.message }));
  });

  await new Promise((resolve) => server.close(resolve));

  return {
    status: result.status,
    body: result.body,
    timedOutAsExpected: result.status === 503 && result.body.includes('Request timed out'),
  };
}

async function verifyLocationThrottling() {
  const profile = await prisma.workerProfile.findFirst({ select: { id: true, userId: true } });
  if (!profile) {
    return { skipped: true, reason: 'No workerProfile found in DB' };
  }

  await prisma.workerLocation.deleteMany({ where: { workerProfileId: profile.id } });

  const token = signJwt({ id: profile.userId, role: 'WORKER', tv: 0 });
  const socket = io('http://127.0.0.1:3000', {
    transports: ['websocket'],
    extraHeaders: {
      Cookie: `token=${encodeURIComponent(token)}`,
    },
  });

  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });

  const seed = Number(String(Date.now()).slice(-3)) / 100000;
  const lat1 = 19.111111 + seed;
  const lon1 = 72.111111 + seed;
  const lat2 = 20.222222 + seed;
  const lon2 = 73.222222 + seed;

  const emitWithAck = (payload) => new Promise((resolve) => {
    socket.timeout(4000).emit('location:update', payload, (err, response) => {
      if (err) return resolve({ ok: false, timeout: true });
      return resolve(response || { ok: false, empty: true });
    });
  });

  const firstAck = await emitWithAck({ latitude: lat1, longitude: lon1 });
  await new Promise((r) => setTimeout(r, 300));
  const secondAck = await emitWithAck({ latitude: lat2, longitude: lon2 });
  await new Promise((r) => setTimeout(r, 300));

  const loc = await prisma.workerLocation.findUnique({
    where: { workerProfileId: profile.id },
    select: { latitude: true, longitude: true, lastUpdated: true },
  });

  socket.disconnect();

  return {
    workerUserId: profile.userId,
    first: { latitude: lat1, longitude: lon1 },
    second: { latitude: lat2, longitude: lon2 },
    firstAck,
    secondAck,
    location: loc,
    throttleWorked:
      Boolean(firstAck?.ok)
      && firstAck?.throttled === false
      && Boolean(secondAck?.ok)
      && secondAck?.throttled === true,
  };
}

async function main() {
  const safeRun = async (fn) => {
    try {
      return await fn();
    } catch (err) {
      return {
        error: err?.message || String(err),
      };
    }
  };

  const report = {};
  report.section_4_1_pooling = verifyDbUrlPoolingConfig();
  report.section_4_7_health_and_metrics = await safeRun(verifyHealthAndMetrics);
  report.section_4_5_etag_and_compression = await safeRun(verifyEtagAndCompression);
  report.section_4_2_cache = await safeRun(verifyCacheEndpoint);
  report.section_4_6_prisma_logging = await safeRun(verifyPrismaSlowQueryLogging);
  report.section_4_4_circuit_breaker = await safeRun(verifyCircuitBreaker);
  report.section_4_3_timeout = await safeRun(verifyTimeoutMiddleware);
  report.section_4_8_location_throttle = await safeRun(verifyLocationThrottling);

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error('RUNTIME_VERIFY_FAILED', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
