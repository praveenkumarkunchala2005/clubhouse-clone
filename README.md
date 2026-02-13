# foundersTribe

A production-grade, scalable real-time voice + text application built with React, Node.js, Supabase, LiveKit, and Socket.io.

## Architecture

```
┌─────────────┐     Socket.io      ┌──────────────┐      SQL        ┌─────────┐
│   React +   │◄──────────────────►│  Express +   │◄──────────────►│ Supabase│
│  LiveKit SDK │     WebSocket      │  Socket.io   │    service key  │ Postgres│
└──────┬──────┘                    └──────┬───────┘                 └─────────┘
       │                                  │
       │ WebRTC (SFU)                     │ Token Gen
       │                                  │
       ▼                                  ▼
┌─────────────┐                    ┌──────────────┐
│   LiveKit    │◄─────────────────│    Redis     │
│   Server     │   (scaling)       │  (pub/sub)   │
└─────────────┘                    └──────────────┘
```

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- A [Supabase](https://supabase.com) project

### 1. Setup Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Note your **Project URL**, **anon key**, **service role key**, and **JWT secret** (Settings → API)

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your Supabase credentials

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your Supabase URL + anon key
```

### 3. Start Infrastructure (Docker)

```bash
docker compose up -d livekit redis
```

This starts:
- **LiveKit** SFU server on port 7880
- **Redis** on port 6379

### 4. Start Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:3001`

### 5. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### 6. Open the App

Navigate to `http://localhost:5173`, create an account, and start a room!

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | Server port (default 3001) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (for server-side ops) |
| `SUPABASE_JWT_SECRET` | JWT secret for token verification |
| `LIVEKIT_API_KEY` | LiveKit API key (default `devkey`) |
| `LIVEKIT_API_SECRET` | LiveKit API secret (default `secret`) |
| `LIVEKIT_URL` | LiveKit server URL (`ws://localhost:7880`) |
| `REDIS_URL` | Redis connection URL |
| `CORS_ORIGIN` | Allowed CORS origin |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `VITE_BACKEND_URL` | Backend API URL |
| `VITE_LIVEKIT_URL` | LiveKit server WebSocket URL |

---

## Deployment (VPS / GCP)

### Production Build

```bash
# Build frontend
cd frontend && npm run build
# Output in frontend/dist/

# Build backend
cd backend && npm run build
# Output in backend/dist/
```

### Docker Production Deploy

```bash
# Build and start everything
docker compose up -d --build

# With Nginx reverse proxy
# Copy frontend/dist to /usr/share/nginx/html
# Use the provided nginx.conf
```

### GCP / Cloud Run

1. Push backend Docker image to Container Registry
2. Deploy to Cloud Run with environment variables
3. Use a managed Redis (Memorystore)
4. Host frontend on Cloud Storage + CDN
5. Point LiveKit to a dedicated VM with UDP ports open

### SSL/TLS

For production, use `wss://` for LiveKit and enable HTTPS:
- Use Let's Encrypt with Nginx
- Update `LIVEKIT_URL` to `wss://your-domain:7880`
- Update `CORS_ORIGIN` to your production domain

---

## Key Design Decisions

### Refresh-Safe Reconnect
- On disconnect, a **30-second grace period** keeps the user's seat
- On reconnect, socket re-authenticates and restores room state
- Missed chat messages are fetched via timestamp

### Mic Toggle Lifecycle
- **Mic ON**: Creates local audio track → publishes to LiveKit
- **Mic OFF**: Unpublishes track → stops track → room connection stays alive
- No room disconnect or reconnect on toggle — only track publish/unpublish

### Role-Based Security
- Roles enforced server-side (never trust client)
- LiveKit tokens encode permissions (`canPublish` / `canSubscribe`)
- Role hierarchy prevents privilege escalation
- Only host can promote to co-host

### Horizontal Scaling
- Socket.io uses Redis pub/sub adapter for multi-instance
- Room state in Supabase (shared across instances)
- LiveKit handles media routing independently
