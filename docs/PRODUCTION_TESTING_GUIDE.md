# Production Testing Guide - UrbanPro V2

**Date:** March 19, 2026  
**Environment:** Live Production (Supabase + Render)  
**Status:** Ready for testing

---

## Testing Checklist

### 1️⃣ Infrastructure & Health Checks

#### Supabase
```bash
# Test health function
curl -X GET \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://tzzlrpbuxjpsazrqjxob.supabase.co/functions/v1/health

# Expected: {"ok":true,"service":"urbanpro-supabase","timestamp":"..."}
```

#### Render Backend
```bash
# Test backend health
curl https://urbanpro-api.onrender.com/health

# Expected: {"status":"ok","timestamp":"...","uptime":...}
```

#### Frontend Client Build
```bash
cd client
npm run build
# Check for no lint errors and successful build

# Verify production env config
cat .env.production | grep VITE_API_URL
# Expected: VITE_API_URL=https://urbanpro-api.onrender.com/api
```

---

### 2️⃣ Cache Relay Testing

#### Test 1: Service Catalog Invalidation
```bash
# Setup
ANON_KEY="your_supabase_anon_key"
SECRET="urbanpro_cache_relay_secret_v1_2026"

# Call relay
curl -X POST \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "apikey: $ANON_KEY" \
  -H "x-cache-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"invalidate","target":"service-catalog"}' \
  https://tzzlrpbuxjpsazrqjxob.supabase.co/functions/v1/cache-relay

# Expected: {"ok":true,"invalidated":["service-catalog"]}
```

#### Test 2: Worker Profile Invalidation
```bash
curl -X POST \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "apikey: $ANON_KEY" \
  -H "x-cache-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"invalidate","target":"worker-profile","id":1}' \
  https://tzzlrpbuxjpsazrqjxob.supabase.co/functions/v1/cache-relay

# Expected: {"ok":true,"invalidated":["worker-profile:1"]}
```

#### Test 3: Wrong Secret (Should Fail)
```bash
curl -X POST \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "apikey: $ANON_KEY" \
  -H "x-cache-secret: wrong_secret" \
  -H "Content-Type: application/json" \
  -d '{"action":"invalidate","target":"service-catalog"}' \
  https://tzzlrpbuxjpsazrqjxob.supabase.co/functions/v1/cache-relay

# Expected: 401 Unauthorized
```

---

### 3️⃣ Authentication Flow Testing

#### Test 1: Customer Register & Login
**Steps:**
1. Open browser → app homepage
2. Click "Sign Up" / "Register"
3. Fill in: email, password, name
4. Submit
5. Check:
   - ✓ Account created in Supabase auth
   - ✓ Verification email received (if applicable)
   - ✓ Redirected to customer dashboard

**Verify:**
```sql
-- Check Supabase auth_users table
SELECT id, email, created_at FROM auth.users 
WHERE email = 'test@example.com' LIMIT 1;
```

#### Test 2: Worker Registration & Verification
**Steps:**
1. Register as worker with same flow
2. Fill in: service type, experience, location
3. Submit ID/verification docs
4. Check:
   - ✓ Worker profile created
   - ✓ Verification status set to `pending`
   - ✓ Email sent for verification

**Verify:**
```sql
-- Check worker profile
SELECT id, email, verification_status, created_at 
FROM workers WHERE email = 'worker@example.com' LIMIT 1;
```

#### Test 3: JWT Token Validation
**Steps:**
1. Login
2. Open DevTools → Application → Cookies/LocalStorage
3. Check for `sb-access-token`
4. Verify token structure in [jwt.io](https://jwt.io)

---

### 4️⃣ Real-time Features Testing

#### Test 1: WebSocket Connection
**Steps:**
1. Open DevTools → Network
2. Filter by "WS" (WebSocket)
3. Login to app
4. Verify connection to `wss://urbanpro-api.onrender.com`

**Verify:**
```javascript
// In browser console
// Should show active WebSocket
Object.entries(navigator.mediaDevices || {})
// Or check socket.io logs
console.log(io() || 'Socket.IO available')
```

#### Test 2: Live Notifications
**Steps:**
1. Have 2 browser tabs open (logged in as different users)
2. In Tab 1: Worker accepts a booking
3. In Tab 2: Customer should see real-time notification
4. Check:
   - ✓ Notification appears within 2 seconds
   - ✓ Notification content is correct
   - ✓ No page refresh needed

#### Test 3: Chat Real-time
**Steps:**
1. Start chat between customer and worker
2. Send message from Customer tab
3. In Worker tab, message should appear instantly
4. Check:
   - ✓ Message visible without refresh
   - ✓ Timestamp correct
   - ✓ Delivery confirmed

---

### 5️⃣ Full User Workflows

#### Workflow 1: Service Discovery → Booking → Completion
**Steps:**
1. **Customer Login** → See homepage
2. **Search Services** → Filter by location/category
   - Check: Services load from cache/API
3. **View Service Details** → See worker profile
4. **Select Worker** → Create booking
   - Check: Booking saved to DB
5. **Payment** (if applicable)
   - Check: Payment processed
6. **Worker Accepts**
   - Check: Notification sent to customer
7. **Service Completion**
   - Check: Status updated, review prompt shows
8. **Leave Review**
   - Check: Review saved, rating updated

**Verify:**
```sql
SELECT * FROM bookings ORDER BY created_at DESC LIMIT 1;
SELECT * FROM reviews ORDER BY created_at DESC LIMIT 1;
```

#### Workflow 2: Worker Profile Update & Cache Invalidation
**Steps:**
1. **Worker Login** → Edit profile
2. **Update availability** (e.g., add time slots)
   - Check: Request sent for cache invalidation
3. **Verify Cache Update:**
   - In another session, refresh services list
   - Check: Updated availability shows immediately
4. **Backend Verification:**
   - Check Render logs for `/api/cache/relay` POST request
   - Verify cache key was invalidated in Redis

**Log Check:**
```bash
# In Render dashboard → Logs, search for:
POST /api/cache/relay
# Should show successful 200 responses
```

#### Workflow 3: Admin Dashboard Access
**Steps:**
1. **Admin Login** (if applicable)
2. **View Analytics** → Check data loads
3. **Manage Users** → Edit/verify user
4. **Check Audit Logs**

---

### 6️⃣ API Endpoint Testing

#### Test Service Endpoints
```bash
BACKEND="https://urbanpro-api.onrender.com"
TOKEN="your_jwt_token"

# List services
curl -H "Authorization: Bearer $TOKEN" \
  $BACKEND/api/services

# Create booking
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service_id":1,"worker_id":1,"date":"2026-03-20"}' \
  $BACKEND/api/bookings

# Get profile
curl -H "Authorization: Bearer $TOKEN" \
  $BACKEND/api/customers/me
```

#### Check Response Times
```bash
# Test from multiple regions using curl timing
curl -w "Time: %{time_total}s\n" \
  https://urbanpro-api.onrender.com/health
# Expected: < 500ms
```

---

### 7️⃣ Error Handling & Edge Cases

#### Test 1: Invalid Authentication
```bash
# Call with invalid token
curl -H "Authorization: Bearer invalid_token" \
  https://urbanpro-api.onrender.com/api/customers/me
# Expected: 401 Unauthorized
```

#### Test 2: Non-existent Resource
```bash
curl https://urbanpro-api.onrender.com/api/services/99999
# Expected: 404 Not Found
```

#### Test 3: Rate Limiting
```bash
# Make 100 requests in quick succession
for i in {1..100}; do
  curl https://urbanpro-api.onrender.com/health
done
# Expected: Some requests throttled with 429 status
```

#### Test 4: Network Failure Handling
**Steps:**
1. Disable internet briefly while on app
2. Try to perform action (search, book, etc.)
3. Check:
   - ✓ Error message shown
   - ✓ Retry button available
   - ✓ No data loss

---

### 8️⃣ Performance Testing

#### Frontend
```bash
cd client
npm run build
# Check bundle size
du -sh dist/
# Expected: < 500KB for gzipped assets

# Run lighthouse
npm run lighthouse
# or use: npx lighthouse https://your-frontend-url
```

#### Backend Response Times
```bash
# Test critical endpoints
time curl -o /dev/null -s https://urbanpro-api.onrender.com/api/services
time curl -o /dev/null -s https://urbanpro-api.onrender.com/api/workers
time curl -o /dev/null -s https://urbanpro-api.onrender.com/health
# Expected: Each < 300ms
```

#### Database Query Performance
```sql
-- Check slow queries (if logging enabled)
SELECT query, duration_ms FROM query_log 
WHERE duration_ms > 1000 
ORDER BY duration_ms DESC LIMIT 10;

-- Test with realistic data volume
SELECT COUNT(*) as service_count FROM services;
SELECT COUNT(*) as booking_count FROM bookings;
-- Should be performant with > 1000 records
```

---

### 9️⃣ Security Testing

#### Test 1: CORS Headers
```bash
curl -i -X OPTIONS https://urbanpro-api.onrender.com/api/services
# Check for proper Access-Control-* headers
```

#### Test 2: HTTPS Only
```bash
# Should redirect or fail
curl http://urbanpro-api.onrender.com/health
# Expected: Redirect to HTTPS or connection refused
```

#### Test 3: Sensitive Data in Logs
**Steps:**
1. Check Render logs for any passwords/tokens
2. Check browser console for exposed API keys
3. Check network tab for credentials in URLs

---

### 🔟 Monitoring & Observability

#### Sentry Errors
1. Go to Sentry dashboard
2. Check "Issues" for any errors captured
3. Review stack traces and context
4. Expected: No critical errors, minimal warnings

#### Supabase Logs
```bash
# View edge function logs
npx supabase functions download --project-ref tzzlrpbuxjpsazrqjxob cache-relay
npx supabase logs --function cache-relay
# Expected: Clean logs, no repeated errors
```

#### Redis Connection
```bash
# Check Redis is working
curl -i https://urbanpro-api.onrender.com/health | grep redis
# Or check in Render dashboard for memory usage
```

---

## Test Execution Checklist

Use this table to track completion:

| Test # | Category | Test Name | Status | Notes |
|--------|----------|-----------|--------|-------|
| 1.1 | Infrastructure | Supabase Health | ⬜ | |
| 1.2 | Infrastructure | Render Backend | ⬜ | |
| 1.3 | Infrastructure | Frontend Build | ⬜ | |
| 2.1 | Cache Relay | Service Catalog | ⬜ | |
| 2.2 | Cache Relay | Worker Profile | ⬜ | |
| 2.3 | Cache Relay | Secret Validation | ⬜ | |
| 3.1 | Auth | Customer Register | ⬜ | |
| 3.2 | Auth | Worker Registration | ⬜ | |
| 3.3 | Auth | JWT Validation | ⬜ | |
| 4.1 | Realtime | WebSocket | ⬜ | |
| 4.2 | Realtime | Live Notifications | ⬜ | |
| 4.3 | Realtime | Chat | ⬜ | |
| 5.1 | Workflow | Service-to-Review | ⬜ | |
| 5.2 | Workflow | Cache Invalidation | ⬜ | |
| 5.3 | Workflow | Admin Dashboard | ⬜ | |
| 6.1 | API | Service Endpoints | ⬜ | |
| 6.2 | API | Response Times | ⬜ | |
| 7.1 | Errors | Invalid Auth | ⬜ | |
| 7.2 | Errors | 404 Handling | ⬜ | |
| 7.3 | Errors | Rate Limiting | ⬜ | |
| 7.4 | Errors | Network Failure | ⬜ | |
| 8.1 | Performance | Bundle Size | ⬜ | |
| 8.2 | Performance | API Response | ⬜ | |
| 8.3 | Performance | DB Query | ⬜ | |
| 9.1 | Security | CORS Headers | ⬜ | |
| 9.2 | Security | HTTPS Only | ⬜ | |
| 9.3 | Security | Data Exposure | ⬜ | |
| 10.1 | Monitoring | Sentry | ⬜ | |
| 10.2 | Monitoring | Function Logs | ⬜ | |
| 10.3 | Monitoring | Redis Health | ⬜ | |

---

## Critical Issues

Report any of these immediately (production-breaking):
- ❌ Cache relay returning 500/401 errors
- ❌ WebSocket disconnections
- ❌ Database query failures
- ❌ Authentication bypass
- ❌ Payment failures
- ❌ Data loss/corruption

---

## Success Criteria

✅ **All tests pass** when:
1. Infrastructure is responsive (all health checks 200 OK)
2. Cache relay works end-to-end
3. User can complete full workflow (register → book → review)
4. Real-time features work without refresh
5. No critical errors in Sentry
6. Response times acceptable (< 500ms)
7. No security vulnerabilities detected

---

## Notes for Testing

- **Test Data:** Use test email + random suffix (test_2026_0319_xxx@example.com)
- **Multiple Sessions:** Keep 2-3 browser tabs open during workflow testing
- **Network Throttling:** Use DevTools to simulate slow networks (3G, 4G)
- **Different Devices:** Test on phone, tablet, desktop if possible
- **Log Everything:** Screenshot errors, save curl outputs, document timing

---

**Ready to test?** Start with Section 1️⃣ and work through sequentially.  
**Issues found?** Document in `.md` or as GitHub issue for tracking.
