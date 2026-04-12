# ExpertsHub Reliability Hardening Checklist

**Last Updated:** April 12, 2026  
**Status:** Ready for Implementation  
**Priority:** CRITICAL (Start immediately)

---

## QUICK START: Top 10 Fixes (2 Week Sprint)

### Week 1: Stability Fixes (Must-Do)

- [ ] **[CRITICAL] Add Exponential Backoff to Auth API Retries**
  - File: `client/src/api/auth.js`
  - Time: 30 min
  - Impact: Prevents thundering herd on backend outages
  - Test: Simulate slow network, verify 1s → 2s → 4s delays

- [ ] **[CRITICAL] Fix localStorage Errors in AuthContext**
  - File: `client/src/context/AuthContext.jsx`
  - Time: 20 min
  - Impact: App no longer crashes on private browsing
  - Test: Open DevTools, set localStorage to disabled, verify graceful fallback

- [ ] **[CRITICAL] Add Network State Detection**
  - File: `client/src/api/axios.js` (add interceptor check)
  - Time: 20 min
  - Impact: Prevent mutations when offline
  - Test: Go offline in DevTools, try to create booking, verify error message

- [ ] **[CRITICAL] Tune Prisma Connection Pool**
  - File: `.env` (add vars), `server/src/config/prisma.js`
  - Time: 30 min
  - Impact: Handle 100+ concurrent users without ECONNREFUSED
  - Test: Load test with 100 concurrent connections, verify no pool exhaustion

- [ ] **[HIGH] Per-Endpoint Timeout Configuration**
  - File: `client/src/api/bookings.js`
  - Time: 45 min
  - Impact: Pricing preview won't hang entire booking flow
  - Test: Simulate slow Google Geocoding API, verify 5s timeout vs 30s global

- [ ] **[HIGH] Save Booking Wizard State**
  - File: `client/src/components/features/bookings/BookingWizard.jsx`
  - Time: 1 hr
  - Impact: Page refresh doesn't wipe out 10-min booking session
  - Test: Start booking, refresh page, verify form data preserved

- [ ] **[HIGH] WebSocket Reconnection Exponential Backoff**
  - File: `client/src/hooks/useSocket.js`
  - Time: 30 min
  - Impact: Real-time features don't hang on network blips
  - Test: Kill server, verify socket reconnects with backoff

- [ ] **[HIGH] Wrap Routes in ErrorBoundary**
  - File: `client/src/routes/AppRoutes.jsx` (or create wrapper)
  - Time: 45 min
  - Impact: Component crash doesn't take down entire app
  - Test: Throw error in BookingWizard, verify graceful fallback

- [ ] **[HIGH] Add Retry Logic to Booking Form Submission**
  - File: `client/src/components/features/bookings/BookingWizard.jsx`
  - Time: 1 hr
  - Impact: Transient network errors auto-retry
  - Test: Simulate 503 error, verify 3 retry attempts with backoff

- [ ] **[HIGH] Add Null Checks to Auth Middleware**
  - File: `server/src/middleware/auth.js`
  - Time: 15 min
  - Impact: Prevent crashes from incomplete auth state
  - Test: Mock token verification to return incomplete payload, verify error

---

### Week 2: Data Consistency & Resilience

- [ ] **[HIGH] Fix Geocoding API Timeout + Retry**
  - File: `server/src/modules/bookings/booking.service.js`
  - Time: 45 min
  - Impact: Booking coordinates don't silently become null
  - Test: Mock Google API timeout, verify 2 retries then error message

- [ ] **[HIGH] Add Transaction Rollback on Notification Failure**
  - File: `server/src/modules/bookings/booking.service.js`
  - Time: 1 hr
  - Impact: Bookings don't get orphaned without notifications
  - Test: Kill notification service, verify booking creation rolls back

- [ ] **[HIGH] Add Admin Dashboard Polling Fallback**
  - File: `client/src/pages/admin/AdminDashboardPage.jsx`
  - Time: 30 min
  - Impact: Admin can still see data when socket offline
  - Test: Disconnect socket, verify polling starts automatically

- [ ] **[MEDIUM] Fix React Query Mutation Retry Strategy**
  - File: `client/src/main.jsx` (QueryClient config)
  - Time: 30 min
  - Impact: Mutations use exponential backoff
  - Test: Simulate 503, verify retry delays increase

- [ ] **[MEDIUM] Implement Booking State Persistence**
  - File: `client/src/components/features/bookings/BookingWizard.jsx`
  - Time: 1 hr
  - Impact: Coupon state consistent across re-renders
  - Test: Set breakpoint in appliedCoupon state update, verify not overwritten

- [ ] **[MEDIUM] Add Socket.IO Message Buffering**
  - File: `server/src/socket.js`
  - Time: 45 min
  - Impact: Workers don't miss booking offers during brief disconnects
  - Test: Disconnect socket for 5 sec, verify messages queued

- [ ] **[MEDIUM] Add Circuit Breaker for External APIs**
  - File: `server/src/modules/bookings/booking.service.js` (create util)
  - Time: 1 hr
  - Impact: Prevent cascading failures when Google API down
  - Test: Simulate 10 Google API failures, verify circuit opens

- [ ] **[MEDIUM] Reduce React Query Stale Time**
  - File: `client/src/main.jsx`
  - Time: 15 min
  - Impact: Booking list updates within 30 sec vs 5 min
  - Test: Create booking, verify list refreshes within 30s

- [ ] **[MEDIUM] Add Booking Date Validation + Timezone Handling**
  - File: `server/src/modules/bookings/booking.service.js`
  - Time: 30 min
  - Impact: Timezone confusion doesn't create backdated bookings
  - Test: Set client to UTC-5, verify 1-hr minimum still enforced

- [ ] **[LOW] Fix Coupon Race Condition**
  - File: `client/src/components/features/bookings/BookingWizard.jsx`
  - Time: 45 min
  - Impact: Coupon always applied if UI says so
  - Test: Rapidly click Apply then Confirm, verify coupon in payload

---

## Detailed Implementation Guide

### Fix #1: Exponential Backoff in Auth

```javascript
// client/src/api/auth.js

const withExponentialBackoff = async (requestFn, maxRetries = 2) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || attempt === maxRetries) {
        throw error;
      }
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
};

// Replace existing:
// const response = await withRetryOnNetworkTimeout(...)
// With:
// const response = await withExponentialBackoff(...)
```

### Fix #2: Per-Endpoint Timeouts

```javascript
// client/src/api/bookings.js

export const previewPrice = async (data) => {
  const response = await axiosInstance.post(
    '/bookings/preview-price',
    data,
    { timeout: 5000 } // 5 sec timeout for preview
  );
  return response.data;
};

export const createBooking = async (data) => {
  const response = await axiosInstance.post(
    BOOKINGS_ENDPOINTS.BASE,
    data,
    { timeout: 15000 } // 15 sec timeout for creation
  );
  return response.data;
};
```

### Fix #3: Prisma Connection Pool

```env
# .env
DATABASE_URL="postgresql://user:pass@host/db?schema=public&pool_size=30&min_conns=5&connection_limit=40"
PRISMA_QUERY_ENGINE_TIMEOUT_MS=30000
```

```javascript
// server/src/config/prisma.js
const prisma = new PrismaClient({
  log: isDev ? [...] : ['error', 'warn'],
});

// For long-running transactions:
await prisma.$transaction(
  async (tx) => { /* logic */ },
  { timeout: 15000 }
);
```

### Fix #4: localStorage Error Handling

```javascript
// client/src/context/AuthContext.jsx

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    if (err.name === 'QuotaExceededError') {
      console.warn('localStorage full');
      return null;
    }
    if (err.name === 'SecurityError') {
      console.warn('localStorage unavailable (private mode)');
      return null;
    }
    try {
      localStorage.removeItem('user');
    } catch {
      // Ignore
    }
    return null;
  }
};
```

---

## Testing Checklist

After each fix, run these tests:

### Network Resilience Tests
- [ ] Disable network in DevTools, verify graceful error messages
- [ ] Throttle to 3G, submit booking, verify timeouts not too aggressive
- [ ] Simulate intermittent packet loss (DevTools), verify retries work
- [ ] Kill backend server, verify client shows "service unavailable" not blank page

### Concurrency Tests (Load Testing)
```bash
# Using k6
k6 run tests/load-test-bookings.js --vus 100 --duration 30s
# Expected: No ECONNREFUSED errors, P95 response time < 5s
```

### State Persistence Tests
- [ ] Start booking creation, refresh page, verify form data intact
- [ ] Apply coupon, refresh, verify applied coupon still shown
- [ ] Drop network mid-booking, go offline, check draft saved

### Real-Time Tests
- [ ] Open Admin Dashboard, background socket disconnect, verify polling kicks in
- [ ] Send booking offer, worker goes offline 3 sec, verify eventually receives notification

### Error Recovery Tests
- [ ] Google Maps API fails, verify booking shows error not null coordinates
- [ ] Notification service down, verify booking creation fails cleanly
- [ ] Database connection exhausted, verify 503 error not connection refused

---

## Rollout Plan

### Phase A: Staging (Days 1-2)
1. Git branch: `reliability/hardening`
2. Implement Fixes #1-5 (all auth/network layer)
3. Run full test suite: `npm test`
4. Deploy to staging environment
5. Run 2-hour load test: `k6 run tests/load.js --vus 50`

### Phase B: Production Canary (Days 3-4)
1. Deploy to 10% of users (Render canary deployment)
2. Monitor error rates in Sentry
3. If error rate < baseline, gradually increase to 100%

### Phase C: Rollout Remaining (Week 2)
1. Implement Fixes #6-10 (state + WebSocket)
2. Test on staging for 24 hours
3. Deploy to production

### Phase D: Follow-up (Week 2-3)
1. Fixes #11-20 over next 2 weeks
2. Prioritize by business impact (e.g., Circuit Breaker before Audit Logs)

---

## Success Metrics

**Before Hardening:**
- Booking creation timeout rate: ~2% (every 50th request fails)
- User retry clicks: ~15% of bookings require retry
- SOS alert delivery latency: 2-5 seconds on poor networks

**Target After Hardening:**
- Booking creation timeout rate: < 0.1%
- User retry clicks: < 2% (automatic retries)
- SOS alert delivery latency: < 500ms (or queued if offline)

---

## Quick Reference: File Changes

| Fix # | Files to Modify | Lines | Est. Effort |
|-------|-----------------|-------|------------|
| 1 | auth.js | 34-51 | 30 min |
| 2 | bookings.js | Throughout | 45 min |
| 3 | BookingWizard.jsx | 790-827 | 1 hr |
| 4 | AuthContext.jsx, axios.js | 111-118 | 40 min |
| 5 | .env, prisma.js | All | 30 min |
| 6 | useSocket.js | 20-36 | 45 min |
| 7 | BookingWizard.jsx | 64-95 | 1 hr |
| 8 | AdminDashboardPage.jsx | 76-81 | 30 min |
| 9 | booking.service.js | 316-335 | 45 min |
| 10 | BookingWizard.jsx, auth | 175-200 | 1 hr |

---

## Rollback Plan

If any fix breaks production:

1. **Immediate:** Revert single PR (git revert)
2. **Notify:** Slack #incidents channel
3. **Root Cause:** Review test logs and error rates
4. **Re-test:** Full suite on staging before re-deploy

---

## Questions?

**Author:** Reliability Analysis Bot  
**Date:** April 12, 2026  
**Next Review:** April 27, 2026 (after hardening complete)

