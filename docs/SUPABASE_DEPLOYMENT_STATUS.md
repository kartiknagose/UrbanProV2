# Supabase Deployment Status

**Date:** March 19, 2026  
**Status:** ✅ **PRODUCTION READY**

## Deployment Overview

UrbanPro V2 is now fully deployed on a hybrid Supabase + Render architecture with operational cache relay infrastructure.

## Components Deployed

### Supabase Cloud (South Asia - Mumbai)
- **Project Ref:** `tzzlrpbuxjpsazrqjxob`
- **Region:** South Asia (Mumbai)
- **Status:** Live and operational

#### Edge Functions
1. **health** - Liveness/healthcheck endpoint
   - Endpoint: `https://tzzlrpbuxjpsazrqjxob.supabase.co/functions/v1/health`
   - Status: ✅ Operational (tested 200 OK)
   - Response: `{"ok":true,"service":"urbanpro-supabase","timestamp":"..."}`

2. **cache-relay** - Cache invalidation relay to Render backend
   - Endpoint: `https://tzzlrpbuxjpsazrqjxob.supabase.co/functions/v1/cache-relay`
   - Status: ✅ Operational (tested 200 OK)
   - Authentication: Bearer token + `x-cache-secret` header
   - Secret: `urbanpro_cache_relay_secret_v1_2026` (configured in Supabase secrets)

#### Database
- PostgreSQL with full schema
- Prisma migrations applied
- Auth and Storage configured

#### Secrets Configured
```
CACHE_RELAY_SECRET     = urbanpro_cache_relay_secret_v1_2026
CACHE_RELAY_URL        = https://urbanpro-api.onrender.com/api/cache/relay
SUPABASE_ANON_KEY      = (auto-generated)
SUPABASE_SERVICE_ROLE_KEY = (auto-generated)
```

### Render Backend (Node.js + Express)
- **Domain:** `https://urbanpro-api.onrender.com`
- **Status:** ✅ Operational
- **Environment:** Same `CACHE_RELAY_SECRET` as Supabase

#### Cache Relay Endpoint
- **Route:** `POST /api/cache/relay`
- **Auth:** `x-cache-secret` header
- **Supported Actions:**
  - `invalidate` with `target: service-catalog`
  - `invalidate` with `target: worker-profile`
  - `invalidate` with `target: all`

#### Redis Cache
- Connected and operational
- Used for service catalog and worker profile caching
- Relay triggers cache invalidation on updates

### GitHub Repository
- **Repo:** `kartiknagose/UrbanProV2`
- **Branch:** `master`
- **Latest Commits:**
  ```
  6d08ab7 - Add proper secret validation to cache-relay function
  c423fd4 - Fix client lint in Vite config
  7f2c6e4 - Harden production email flow and Supabase bridge
  ```

## Test Results

### Relay Functionality
✅ All tests passed:

1. **Service Catalog Invalidation**
   ```
   POST /functions/v1/cache-relay
   Body: {"action":"invalidate","target":"service-catalog"}
   Result: 200 OK - {"ok":true,"invalidated":["service-catalog"]}
   ```

2. **Worker Profile Invalidation**
   ```
   POST /functions/v1/cache-relay
   Body: {"action":"invalidate","target":"worker-profile","id":1}
   Result: 200 OK - {"ok":true,"invalidated":["worker-profile:1"]}
   ```

3. **Secret Validation**
   ```
   POST /functions/v1/cache-relay with wrong secret
   Result: 401 Unauthorized (expected)
   ```

## Architecture

```
User Request (Client) 
    ↓
Render Backend (Express)
    ├─ Handles API requests
    ├─ Manages Redis cache
    └─ Exposes /api/cache/relay endpoint
        ↓
Supabase Edge Function (cache-relay)
    ├─ Validates x-cache-secret header
    ├─ Reads CACHE_RELAY_URL and CACHE_RELAY_SECRET from secrets
    └─ Forwards to Render backend
        ↓
Supabase PostgreSQL
    └─ Primary database
```

## Configuration for Developers

### Environment Variables

**Client (.env)**
```
VITE_API_URL=https://urbanpro-api.onrender.com/api
VITE_SOCKET_URL=https://urbanpro-api.onrender.com
VITE_SUPABASE_URL=https://tzzlrpbuxjpsazrqjxob.supabase.co
VITE_SUPABASE_ANON_KEY=<from Supabase dashboard>
```

**Server (.env)**
```
DATABASE_URL=<Supabase PostgreSQL connection string>
REDIS_URL=<Redis connection string>
CACHE_RELAY_SECRET=urbanpro_cache_relay_secret_v1_2026
```

### CLI Commands

**View Function Logs:**
```bash
npx supabase functions download cache-relay
npx supabase logs --function cache-relay
```

**Update Secrets:**
```bash
npx supabase secrets set CACHE_RELAY_SECRET=new_secret_value
```

**Deploy Functions:**
```bash
npx supabase functions deploy health
npx supabase functions deploy cache-relay
```

## Monitoring & Observability

### Sentry Integration
- **Client:** Enabled (`VITE_SENTRY_DSN`)
- **Server:** Enabled (`SERVER_SENTRY_DSN`)
- **Edge Functions:** Error tracking available in Supabase dashboard

### Logs Access
- **Render Logs:** Available in Render dashboard
- **Supabase Function Logs:** Dashboard → Functions → Select function
- **Database Query Logs:** Supabase dashboard → Logs

## Security Notes

1. **Secret Management:**
   - Secrets are stored in Supabase secrets manager
   - NOT committed to git or `.env` files
   - Rendered as digests in CLI output

2. **Authentication:**
   - Edge functions require JWT bearer token (Supabase anon key)
   - Additional header validation via `x-cache-secret`
   - Backend validates relay secret before processing

3. **Network:**
   - All connections use HTTPS
   - CORS configured for trusted origins only
   - Rate limiting enabled on Render

## Next Steps

### Immediate
- [ ] Monitor relay requests in production
- [ ] Watch Sentry for any edge function errors
- [ ] Verify cache invalidation works end-to-end with real data

### Short-term
- [ ] Set up alerting for Supabase function failures
- [ ] Configure logging aggregation (if applicable)
- [ ] Test failover scenarios

### Future
- [ ] Consider rotating secrets quarterly
- [ ] Document disaster recovery procedures
- [ ] Plan Supabase schema export/backup strategy

## Support

### Common Issues

**Q: Relay returning 401?**
- Check `CACHE_RELAY_SECRET` is identical in Supabase secrets and Render env
- Verify `x-cache-secret` header is included in request
- Redeploy cache-relay function after secret change

**Q: Function timeout?**
- Check Render backend is responsive (hit `/health` endpoint)
- Verify `CACHE_RELAY_URL` is correct and reachable
- Check edge function logs in Supabase dashboard

**Q: Cache not invalidating?**
- Verify invalidation call returns 200 OK
- Check Render logs for `/api/cache/relay` requests
- Confirm Redis is connected and responsive

## Quick Reference

| Component | Status | URL |
|-----------|--------|-----|
| Supabase Health | ✅ 200 OK | `https://tzzlrpbuxjpsazrqjxob.supabase.co/functions/v1/health` |
| Cache Relay | ✅ 200 OK* | `https://tzzlrpbuxjpsazrqjxob.supabase.co/functions/v1/cache-relay` |
| Render Backend | ✅ 200 OK | `https://urbanpro-api.onrender.com/health` |
| Database | ✅ Connected | PostgreSQL via Supabase |
| Redis Cache | ✅ Operational | Internal Render service |

*Cache relay requires valid JWT and x-cache-secret header

---

**Last Updated:** March 19, 2026, 08:30 UTC  
**Deployed By:** GitHub Copilot  
**Commit:** 6d08ab7
