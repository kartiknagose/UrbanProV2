# UrbanPro V2

UrbanPro V2 is now organized as a Supabase-first deployment with a React frontend, Supabase as the backend data platform, and a small Node bridge that stays in place for Redis-backed cache, Socket.IO, payment webhooks, and other long-running tasks that should not move to edge runtimes.

This repository keeps the existing Redis pipeline intact while moving the data, auth, storage, and deploy surface toward Supabase.

## Architecture

- Frontend: React + Vite, deployed on Vercel
- Backend data layer: Supabase Postgres
- Auth and public client config: Supabase Auth + VITE_ENV injection
- Edge functions: Supabase Edge Functions
- Node bridge: Render web service for Redis cache, Socket.IO, webhooks, and legacy endpoints that still need a stateful process
- Cache: Redis remains active and should not be removed until every cache-sensitive route has been migrated and validated
- Error tracking and performance: Sentry on both client and server

## What runs where

- Vercel serves the React app
- Supabase stores the database and hosts edge functions
- Render runs the Node bridge and cache-related compatibility layer
- Upstash Redis or your current Redis provider stays connected to the Node bridge

## Environment Strategy

Use `VITE_ENV` only for public frontend configuration.

Do not put secrets inside `VITE_ENV`; anything exposed to Vite is visible in the browser.

Recommended pattern:

- Public frontend values: `VITE_ENV` JSON payload or individual `VITE_*` variables
- Server secrets: Render environment variables or Supabase function secrets
- Redis secrets: Render or your Redis provider settings
- SMTP secrets: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `FROM_EMAIL`, `FROM_NAME`
- Sentry DSNs: frontend DSN in `VITE_SENTRY_DSN`, backend DSN in `SENTRY_DSN`

### Example `VITE_ENV`

```json
{
  "VITE_API_URL": "https://api.example.com/api",
  "VITE_SOCKET_URL": "https://api.example.com",
  "VITE_SUPABASE_URL": "https://project-ref.supabase.co",
  "VITE_SUPABASE_ANON_KEY": "public-anon-key",
  "VITE_SUPABASE_FUNCTIONS_URL": "https://project-ref.supabase.co/functions/v1",
  "VITE_SENTRY_DSN": "https://public-dsn.ingest.sentry.io/123456",
  "VITE_SENTRY_TRACES_SAMPLE_RATE": "0.1",
  "VITE_RAZORPAY_KEY_ID": "rzp_public_key",
  "VITE_GOOGLE_PLACES_API_KEY": "public-google-key"
}
```

## Local Development

### 1) Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 2) Start Redis and Postgres

If you use Docker locally:

```bash
docker compose up -d db redis
```

If you already use remote Supabase and Redis, you can skip local containers and point the app at your hosted services.

### 3) Configure environment variables

Server `.env` should include:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=replace-me
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service-role-key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=mailer@example.com
SMTP_PASS=strong-password
SMTP_SECURE=false
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1
```

Client `.env` should include:

```env
VITE_ENV={"VITE_API_URL":"http://localhost:3000/api","VITE_SOCKET_URL":"http://localhost:3000","VITE_SUPABASE_URL":"https://project-ref.supabase.co","VITE_SUPABASE_ANON_KEY":"public-anon-key"}
```

### 4) Run the apps

```bash
cd server
npm run dev

cd ../client
npm run dev
```

## Supabase Setup

### 1) Create the Supabase project

1. Create a new Supabase project.
2. Wait for provisioning to finish.
3. Open `Project Settings` > `Database`.
4. Copy the `Session pooler` connection string.
5. Use the pooler string as `DATABASE_URL` for the Node bridge if you keep Prisma.

### 2) Apply the database schema

This repo currently uses Prisma as the schema source of truth.

Run:

```bash
cd server
npx prisma generate
npx prisma migrate deploy
```

If you later convert fully to Supabase SQL migrations, keep the Prisma schema and Supabase SQL schema aligned before cutting over.

### 3) Configure auth and storage

In Supabase:

- Enable the auth providers you need
- Set redirect URLs for your frontend domain
- Create any storage buckets you need for profile photos, verification docs, booking media, and chat attachments
- Add RLS policies before moving any direct client reads or writes to Supabase

### 4) Create Supabase Edge Functions

This repo includes starter functions in `supabase/functions`:

- `health`
- `cache-relay`

Deploy them with the Supabase CLI:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy health
supabase functions deploy cache-relay
```

Set function secrets:

```bash
supabase secrets set CACHE_RELAY_SECRET=<secret>
supabase secrets set CACHE_RELAY_URL=https://<your-render-or-node-bridge>/api/cache/relay
```

The `cache-relay` function is a bridge that can forward cache invalidation requests to the Node service without breaking the Redis pipeline.

On the Node bridge, the matching endpoint is `POST /api/cache/relay` and it accepts cache invalidation payloads authenticated with the same `CACHE_RELAY_SECRET`.

## Render Deployment for the Node Bridge

The Node service stays online for Redis cache, Socket.IO, payments, webhooks, and any legacy route that has not been moved to Supabase yet.

Render config lives in `render.yaml`.

### Required Render env vars

```env
NODE_ENV=production
JWT_SECRET=...
DATABASE_URL=postgresql://...supabase pooler...
REDIS_URL=redis://...
CORS_ORIGIN=https://your-vercel-domain.vercel.app
FRONTEND_URL=https://your-vercel-domain.vercel.app
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=mailer@example.com
SMTP_PASS=...
SMTP_SECURE=false
SENTRY_DSN=...
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Render build and start

- Build: `npm install && npx prisma generate && npx prisma migrate deploy`
- Start: `npm run start`

The backend start script does not run migrations anymore; that work happens in the build phase.

## Vercel Deployment for the Frontend

### Project settings

- Framework preset: Vite
- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`

### Vercel env vars

Preferred approach: inject a single `VITE_ENV` JSON value.

Minimum values:

```env
VITE_ENV={"VITE_API_URL":"https://<your-api-domain>/api","VITE_SOCKET_URL":"https://<your-api-domain>","VITE_SUPABASE_URL":"https://project-ref.supabase.co","VITE_SUPABASE_ANON_KEY":"public-anon-key","VITE_SENTRY_DSN":"public-dsn"}
```

If you prefer individual variables, the app still supports `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the Sentry/Razorpay keys directly.

## Redis Cache Pipeline

Do not remove the Redis layer until all cache paths are replaced and load-tested.

Current cache responsibilities include:

- Service catalog caching
- Worker profile caching
- Socket or live activity support where applicable
- Any invalidation hooks used by the Node bridge

Keep these env vars set:

```env
REDIS_URL=redis://...
```

If you move invalidation triggers into Supabase Edge Functions, keep the functions calling the Node bridge through the `cache-relay` pattern so Redis behavior stays consistent.

## Sentry Setup

### Frontend

Set:

```env
VITE_SENTRY_DSN=https://public-dsn.ingest.sentry.io/123456
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
```

The client initializes Sentry in `client/src/config/sentry.js`.

### Backend

Set:

```env
SENTRY_DSN=https://private-dsn.ingest.sentry.io/123456
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

The server initializes Sentry through `server/src/config/sentry.js` and forwards captured exceptions from the shared monitoring layer.

## Deployment Order

Use this order to avoid broken references:

1. Provision Supabase project
2. Apply database schema and verify connection
3. Deploy Supabase edge functions
4. Deploy Render Node bridge
5. Deploy Vercel frontend
6. Verify frontend calls the correct API and socket domains
7. Verify Redis cache hits still work
8. Verify Sentry receives a test error and a trace sample

## Cleanup Checklist

After the migration is stable:

- Remove any routes that are still duplicated between Supabase and the Node bridge
- Delete dead API wrappers that no longer have a backend path
- Remove any unused env vars from Vercel and Render
- Remove obsolete cache code only after the Redis migration is finished
- Keep the Redis pipeline until the last cache-dependent route has been validated in production

## Troubleshooting

### Build fails on GitHub Actions

- Confirm `client/package-lock.json` is committed
- Confirm `npm ci` is used in CI
- Confirm the Rollup Linux optional binary is present
- Confirm the workflow installs the client dependency set before `npm run build`

### Supabase edge function returns 401

- Check the function secret headers
- Confirm `CACHE_RELAY_SECRET` matches between Supabase and the Node bridge

### Users do not receive verification email

- Confirm the SMTP environment variables are set on the Node bridge
- Confirm the sender address is allowed by your SMTP provider
- Check server logs for `[Email]` failures and SMTP response codes

### Frontend cannot reach the backend

- Check `VITE_API_URL` and `VITE_SOCKET_URL`
- Check `CORS_ORIGIN` on the Node bridge
- Confirm Vercel env vars are set for the correct production domain

### Redis cache appears broken

- Check `REDIS_URL`
- Verify the Node bridge is still running
- Confirm cache invalidation still routes through the bridge

## Current Status

This repository is configured for a Supabase-backed deployment foundation with:

- React frontend on Vercel
- Supabase database and edge functions
- Node bridge kept alive for Redis, sockets, and webhooks
- Sentry on both client and server

If you want a full one-way cutover to Supabase edge functions for every API route, the next step is to migrate each `server/src/modules/*` route one by one and remove the Node bridge only after parity is proven.
