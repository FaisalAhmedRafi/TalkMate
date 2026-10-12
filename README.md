# TalkMate

- `backend/`  NestJS API: PostgreSQL (Prisma), JWT auth, OpenRouter free models
- `frontend/` Next.js (App Router) + Tailwind dashboard
- `docker-compose.yml`  local PostgreSQL 16

## Run

```bash
# 0. Database (needs Docker; or point DATABASE_URL at any PostgreSQL)
docker compose up -d

# 1. Backend (http://localhost:4000)
cd backend
cp .env.example .env      # set OPENROUTER_API_KEY and JWT_SECRET
npm install               # also runs `prisma generate`
npx prisma migrate dev --name init
npm run start:dev

# 2. Frontend (http://localhost:3000)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000, create an account, and practice.

## API

All routes except `/auth/*` and `/health` need `Authorization: Bearer <token>`.

| Route | Purpose |
|---|---|
| `POST /auth/register`, `POST /auth/login` | Email + password, returns a 7-day JWT |
| `GET /progress` | XP, streak, settings, today's practice |
| `POST /progress/practice` | Add a practice entry (+10 XP, updates streak) |
| `PATCH /progress/settings` | Language and level |
| `POST /progress/premium` | Demo unlock (replace with real billing) |
| `POST /progress/gift` | One-time +20 XP |
| `POST /ai/chat` | Chat, Call, Roleplays, Characters, Debates |
| `POST /ai/generate` | Sentence, Word, Dialogue, Flashcards |
| `POST /ai/photo` | Photo Mode |
| `POST /ai/feedback` | Daily feedback |

## Database

Tables: `User`, `Progress` (one row per user), `PracticeEntry` (one row per practice message). Streak days use UTC dates. Browse data with `npx prisma studio`.

## Notes

- Default model is `openrouter/free`; pin models with `OPENROUTER_MODEL` / `OPENROUTER_FALLBACK_MODELS`.
- Free models are rate limited: 20 requests/min per client, 10/min on auth routes.
- Call Mode uses the browser's speech APIs (best in Chrome).
- The JWT is kept in localStorage for simplicity. Move it to an httpOnly cookie before production.
