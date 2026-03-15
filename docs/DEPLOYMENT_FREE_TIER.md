# UrbanPro V2 Free-Tier Deployment Guide (Render + Vercel)

This setup keeps costs at zero (or near zero) while supporting your current architecture:

- Frontend: Vercel (free)
- Backend API + Socket.IO: Render Web Service (free)
- PostgreSQL: Neon (free) or Supabase (free)
- Redis: Upstash Redis (free)

## Docker policy for this project

- Production deployment does not require Docker.
- Recommended production path is platform-native deploys:
  - Frontend on Vercel
  - Backend on Render Node runtime
  - Managed PostgreSQL + managed Redis
- Docker remains optional for local development parity only.

## 1) Why this split

- Vercel is great for static React/Vite hosting.
- Your backend uses long-lived Express + Socket.IO + cron jobs, which fit Render better than serverless platforms.
- Prisma requires a stable `DATABASE_URL`, and Redis is used by multiple modules.

## 2) Backend deploy on Render

### Option A: Blueprint (recommended)

1. Push this repo to GitHub.
2. In Render, click New + then Blueprint.
3. Select this repository.
4. Render will detect [render.yaml](../render.yaml).
5. Fill required env vars in Render dashboard.

### Option B: Manual service

1. New + then Web Service.
2. Connect repository.
3. Root Directory: `server`
4. Runtime: `Node`
5. Build command:

```bash
npm install && npx prisma generate
```

6. Start command:

```bash
npm run start
```

7. Health check path: `/health`

### Backend env vars (minimum required)

Required:

- `NODE_ENV=production`
- `JWT_SECRET=<long-random-secret>`
- `DATABASE_URL=<postgres-connection-string>`
- `REDIS_URL=<upstash-redis-url>`
- `CORS_ORIGIN=<your-vercel-frontend-url>`

Recommended for full features:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`, `FROM_NAME`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PAYOUT_MODE=SIMULATED`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `GOOGLE_GEOCODING_API_KEY`

Notes:

- `npm run start` now runs `prisma migrate deploy` automatically before starting Express.
- If `CORS_ORIGIN` is wrong, cookies/auth and Socket.IO will fail.
- Local-disk uploads are ephemeral on free hosts. Use Cloudinary for persistent media.

## 3) Database (Neon or Supabase)

1. Create free PostgreSQL project.
2. Copy connection string.
3. Set it as `DATABASE_URL` in Render.
4. Redeploy backend (or trigger manual deploy).

### Supabase-first setup

If you are starting with Supabase, use this exact flow.

1. Create a new Supabase project.
2. Wait until the database is fully provisioned.
3. Open `Project Settings` then `Database`.
4. Open the connection info panel.
5. Copy the `Supavisor Session pooler` connection string.

Use the Session pooler string ending in port `5432` for this project because the backend runs as a long-lived server on Render.

Do not use the transaction pooler on port `6543` for the main `DATABASE_URL` in this deployment.

Example shape:

```env
DATABASE_URL=postgresql://postgres.tzzlrpbuxjpsazrqjxob:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

Recommended hardening for Prisma on Supabase:

1. In Supabase SQL Editor, create a dedicated `prisma` database user.
2. Grant that user access to the `public` schema.
3. Use that user in the final `DATABASE_URL` instead of the default account.

After you have the final connection string:

1. Go to Render.
2. Open your backend service.
3. Add `DATABASE_URL` with the Supabase connection string.
4. Save changes and redeploy.

If Render starts successfully, Prisma migrations will run automatically on startup.

If deployment fails with database connection errors, verify:

- the password is correct
- `sslmode=require` is present
- you copied the Session pooler URL, not the transaction pooler URL
- the string does not include accidental spaces or line breaks

## 4) Redis (Upstash)

1. Create free Redis database in Upstash.
2. Copy redis URL.
3. Set as `REDIS_URL` in Render.
4. Redeploy backend.

## 5) Frontend deploy on Vercel

1. Import the same repository in Vercel.
2. Framework preset: `Vite`
3. Root Directory: `client`
4. Build command: `npm run build`
5. Output directory: `dist`

Set Vercel environment variables:

- `VITE_API_URL=https://<your-render-backend-domain>/api`
- `VITE_SOCKET_URL=https://<your-render-backend-domain>`
- `VITE_RAZORPAY_KEY_ID=<optional>`
- `VITE_GOOGLE_PLACES_API_KEY=<optional>`

`client/vercel.json` already includes SPA rewrites for React Router refresh support.

## 6) Post-deploy verification checklist

1. Open backend health URL: `https://<render-domain>/health` should return JSON.
2. Open frontend URL and register/login.
3. Confirm auth cookie flow works (no CORS errors in browser console).
4. Verify real-time events (notifications/chat/location) connect via Socket.IO.
5. Open system status page and confirm backend + DB checks are green.

## 7) Common failures and fixes

- Login succeeds but user appears logged out:
  - `CORS_ORIGIN` mismatch or frontend/backend on `http` vs `https` mismatch.

- Socket not connecting:
  - Ensure `VITE_SOCKET_URL` points to backend origin without `/api`.

- Build works but API calls fail:
  - `VITE_API_URL` must include `/api` suffix.

- Uploaded files disappear:
  - Expected on ephemeral disk. Enable Cloudinary and use returned URLs.

## 8) Optional single-platform alternative

You can deploy both frontend and backend on Render (Static Site + Web Service). It is simpler for CORS/cookies, but Vercel + Render usually gives better frontend performance on free tier.
