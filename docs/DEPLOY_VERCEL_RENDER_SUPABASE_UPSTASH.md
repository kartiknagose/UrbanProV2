# Deploy Without Docker: Vercel + Render + Supabase + Upstash

## Architecture

- Frontend: Vercel from client
- Backend API: Render from server
- Postgres: Supabase
- Redis: Upstash

## 1. Supabase setup (database)

1. Create a Supabase project.
2. In Supabase, open Project Settings -> Database.
3. Copy both connection strings:
- Transaction pooler URL for app traffic
- Direct connection URL for migrations

Use them as:
- DATABASE_URL = pooled URL with sslmode=require
- DIRECT_DATABASE_URL = direct URL with sslmode=require

## 2. Upstash setup (redis)

1. Create an Upstash Redis database.
2. Copy the Redis URL.
3. Use it as REDIS_URL in Render.

Example format:
rediss://default:password@host:port

## 3. Deploy backend on Render

1. Push this repo to GitHub.
2. In Render, click New -> Blueprint and connect the repo.
3. Render will detect render.yaml at root.
4. Create the web service.
5. In Render service environment variables, set real values for all sync:false keys.

Minimum required to boot:
- DATABASE_URL
- DIRECT_DATABASE_URL
- REDIS_URL
- JWT_SECRET
- CORS_ORIGIN
- FRONTEND_URL
- GROQ_API_KEY

Build command:
npm ci && npx prisma generate && npx prisma migrate deploy

Start command:
npm start

Health check:
/health

After deploy, copy the backend URL, for example:
https://expertshub-api.onrender.com

## 4. Deploy frontend on Vercel

1. In Vercel, create a new project from the same repo.
2. Set Root Directory to client.
3. Framework preset: Vite.
4. Add environment variables:
- VITE_API_URL = https://your-render-domain/api
- VITE_SOCKET_URL = https://your-render-domain
- VITE_APP_ENV = production
- VITE_RAZORPAY_KEY_ID = your_publishable_key_if_used
- VITE_GOOGLE_PLACES_API_KEY = if_used
- VITE_SENTRY_DSN = if_used

5. Deploy.
6. Copy frontend URL, for example:
https://expertshub.vercel.app

## 5. Final backend env updates on Render

After frontend is live, update on Render:
- CORS_ORIGIN = https://your-vercel-domain
- FRONTEND_URL = https://your-vercel-domain

Redeploy Render service.

## 6. Post-deploy verification

Backend checks:
- GET https://your-render-domain/health
- POST https://your-render-domain/api/auth/login
- POST https://your-render-domain/api/v1/auth/login

Frontend checks:
- Load home page
- Login flow works
- Socket connection works after login
- AI chat endpoint works for authorized roles

## 7. Common fixes

1. Prisma migration fails on Render:
- Ensure DIRECT_DATABASE_URL is direct Supabase URL, not pooled URL.

2. CORS blocked in browser:
- Set CORS_ORIGIN exactly to your Vercel URL.
- Set FRONTEND_URL to the same URL.

3. Redis disabled warnings:
- Ensure REDIS_URL is set to valid Upstash rediss URL.

4. AI tool timeout errors:
- Confirm GROQ_API_KEY is valid.
- Keep INTERNAL_API_BASE_URL as http://127.0.0.1:5000 on Render.

## 8. Security checklist

- Use strong random JWT_SECRET.
- Keep all secrets only in Render and Vercel env settings.
- Do not commit real secrets to git.
