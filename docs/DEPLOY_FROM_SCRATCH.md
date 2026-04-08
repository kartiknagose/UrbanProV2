# Deploy ExpertsHub From Scratch (Docker Compose)

## 1. Install Docker (Windows)

- Install Docker Desktop and start it.
- Verify in PowerShell:

```powershell
docker --version
docker compose version
```

## 2. Prepare environment

From project root:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set at least:
- `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `FRONTEND_URL`
- `GROQ_API_KEY` (if AI agent features are required)

## 3. Build and run

From project root:

```powershell
docker compose --env-file .env up -d --build
```

## 4. Verify deployment

```powershell
docker compose ps
Invoke-WebRequest -UseBasicParsing http://localhost/ | Select-Object -ExpandProperty StatusCode
Invoke-WebRequest -UseBasicParsing http://localhost/health | Select-Object -ExpandProperty Content
```

Expected:
- Frontend on `http://localhost`
- Health returns `healthy` or `degraded` JSON

## 5. Logs and troubleshooting

```powershell
docker compose logs -f server
docker compose logs -f client
docker compose logs -f db
docker compose logs -f redis
```

## 6. Stop / restart

```powershell
docker compose down
docker compose up -d
```

## Notes

- Client Nginx proxies:
  - `/api/*` -> `server:5000/api/*`
  - `/socket.io/*` -> `server:5000/socket.io/*`
- Prisma migrations run automatically when the server container starts.
- For production domain deployment, set `CORS_ORIGIN` and `FRONTEND_URL` to real HTTPS domain(s).
