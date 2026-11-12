<div align="center">

# TalkMate

**AI language-practice web app: chat, speak, read aloud and play your way to a new language.**

Ten practice modes, XP, streaks and achievements, AI feedback in your own language,
and an admin panel that manages all learning content without code.

[![CI](https://github.com/FaisalAhmedRafi/TalkMate/actions/workflows/ci.yml/badge.svg)](https://github.com/FaisalAhmedRafi/TalkMate/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/node-%3E%3D20.9-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)

[Deployment](docs/guides/deployment.md) ·
[Security](docs/security.md) ·
[Changelog](CHANGELOG.md) ·
[Contributor rules](AGENTS.md) ·
[Code reference](CLAUDE.md)

</div>

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [API overview](#api-overview)
- [Quality and CI](#quality-and-ci)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## Features

**Practice modes** (every mode is its own page)
- **Chat** (free) — talk with one of four AI tutors; a side panel reviews each message, with suggested replies and saved chat history
- **Call** — an audio-only "phone call" with a tutor using the browser's speech recognition and voices, plus advanced feedback
- **Sentence** — hear AI-written sentences, read them aloud, get a 1–5 pronunciation rating
- **Word** — 120 words in 10 units, each with a photo and three practice sentences; resumable lessons
- **Flashcards** — 18 topic decks with photos; mark cards *Learning* / *I know it*; a daily review
- **Dialogue** — 21 scripted conversations where you read your part aloud
- **Roleplays** — 24 real-life scenarios (café, airport, doctor…) with tasks to complete
- **Characters** — chat with 30 historical, mythological and fictional characters
- **Debates** — 24 topics; argue for or against while the tutor takes the other side
- **Photo** — describe a picture and get scored corrections and a better version

**Learning**
- Any target language and level; corrections, translations and feedback in your own language
- XP, levels, daily streaks (3 minutes of practice), achievements, practice-time charts
- Courses (32) and a Learn path that links Word, Sentence and Dialogue exercises
- Explore tab with daily picks; daily AI feedback on what you practised

**Accounts**
- Email sign-up with a 6-digit verification code, Google sign-in, password reset by email
- Country and phone number at sign-up (validated with libphonenumber-js)
- Profile, avatar, personalization, settings, refer-a-friend and support form
- Demo subscriptions (no real billing is connected)

**Admin panel** (`/admin`, for emails in `ADMIN_EMAILS`)
- Analytics: sign-ups today / 7 / 30 days, by country, activity, plans, latest users
- Add, edit, delete, reset and restore every element of the eight content modes; JSON import; picture uploads
- Changes go live for every learner at once (content lives in the database)

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 3, lucide-react |
| API | NestJS 11 (Express), class-validator, `@nestjs/throttler`, `@nestjs/jwt` |
| Database | MySQL 8 via Prisma 5 |
| AI | OpenRouter (default `openrouter/free`, configurable models with fallbacks) |
| Email | Gmail SMTP (nodemailer) or Resend |
| Speech | Browser Web Speech API (recognition and voices) |
| Pictures | Pixabay / Pexels stock photos, Wikipedia portraits, cached on the API's disk |

## Architecture

```
Browser (Next.js app, port 3000)
   │  fetch + Bearer JWT                       ┌─► OpenRouter (AI replies, reviews, feedback)
   ▼                                           ├─► Gmail SMTP / Resend (codes, reset links)
NestJS API (port 4000) ── modules per mode ────┼─► Google tokeninfo (sign-in)
   │  Prisma                                   └─► Pixabay / Pexels / Wikipedia (pictures)
   ▼
MySQL 8 ── users, progress, saved conversations, ContentItem (all learning content)
```

- Two independent apps in one repo (no root `package.json`).
- Every API module follows the same shape: catalog (live array filled from the
  database), prompts, DTOs, service, controller.
- `ContentStore` loads all learning content from `ContentItem` at start-up and polls
  for changes every 15 s, so several API instances stay in sync.
- The full module-by-module reference is in [`CLAUDE.md`](CLAUDE.md).

## Getting started

**Prerequisites:** Node.js ≥ 20.9 (22 LTS recommended), npm, Docker (or any MySQL 8.0.13+ server).

```bash
git clone https://github.com/FaisalAhmedRafi/TalkMate.git
cd TalkMate
docker compose up -d                       # MySQL 8 on localhost:3306 (user/password/db: talkpal)
```

```bash
# API — http://localhost:4000
cd backend
cp .env.example .env                       # set JWT_SECRET and OPENROUTER_API_KEY at least
npm install                                # also runs `prisma generate`
npm run prisma:deploy                      # creates the tables and loads the built-in content
npm run start:dev
```

```bash
# Web app — http://localhost:3000
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 and create an account. Without a mailer configured, the
6-digit verification code is printed in the API log. To open `/admin`, put your
account email in `ADMIN_EMAILS` and restart the API.

## Configuration

API (`backend/.env`, template [`backend/.env.example`](backend/.env.example)):

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | MySQL connection string |
| `JWT_SECRET` | yes | token signing key; ≥ 32 random chars (`openssl rand -hex 32`) |
| `OPENROUTER_API_KEY` | for AI | without it AI routes answer 503 |
| `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODELS` | no | model and comma-separated fallbacks (default `openrouter/free`) |
| `FRONTEND_URL` | no | comma-separated CORS origins; the first is the base of reset links (default `http://localhost:3000`) |
| `PUBLIC_API_URL` | no | public API URL for `/media/...` picture links (default `http://localhost:<PORT>`) |
| `PORT` | no | default `4000` |
| `ADMIN_EMAILS` | for admin | comma-separated admin account emails |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | for email | Gmail SMTP with an App Password (preferred) |
| `RESEND_API_KEY`, `MAIL_FROM` | for email | Resend, used when Gmail is not set |
| `GOOGLE_CLIENT_ID` | for Google sign-in | OAuth Web client ID |
| `PIXABAY_API_KEY`, `PEXELS_API_KEY` | no | stock photos (emoji fallback without them) |
| `MEDIA_DIR` | no | picture folder; falls back to `RAILWAY_VOLUME_MOUNT_PATH`, then `./media` |

Web app (`frontend/.env.local`, template [`frontend/.env.local.example`](frontend/.env.local.example)):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL (default `http://localhost:4000`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | same as the API's `GOOGLE_CLIENT_ID`; hides the Google button when empty |
| `NEXT_PUBLIC_CHARACTER_PORTRAITS` | `1` to use `public/characters/<id>.jpg` portraits |

## Scripts

| App | Command | What it does |
|---|---|---|
| backend | `npm run start:dev` | API with watch mode |
| backend | `npm run typecheck` | TypeScript check, no output |
| backend | `npm run build` / `npm run start:prod` | compile to `dist/` / run it |
| backend | `npm run prisma:deploy` | apply migrations (production and fresh databases) |
| backend | `npm run prisma:migrate` | create a migration in development (`migrate dev`) |
| backend | `npm run prisma:studio` | browse the data |
| frontend | `npm run dev` | dev server |
| frontend | `npm run typecheck` | TypeScript check |
| frontend | `npm run build` / `npm start` | production build / serve it |

## Project structure

```
.
├── backend/            NestJS API — prisma/ (schema, migrations), src/<module>/
├── frontend/           Next.js app — app/ (routes), components/, lib/, public/
├── docs/               security profile and deployment guide
├── .github/            CI workflow and Dependabot
├── docker-compose.yml  local MySQL 8
├── AGENTS.md           rules for contributors and AI agents
└── CLAUDE.md           detailed code reference
```

## API overview

All routes except `/health`, `/auth/*` need `Authorization: Bearer <token>`.
`/admin/*` also needs an email listed in `ADMIN_EMAILS`.

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Auth | `/auth/register`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/login`, `/auth/google`, `/auth/forgot-password`, `/auth/reset-password` |
| Progress | `/progress` (snapshot, practice time, settings, stats) |
| Account | `/account/*` (profile, avatar, password, personalization, referral, subscription, support, contact) |
| Modes | `/chat`, `/call`, `/sentence`, `/word`, `/flashcards`, `/dialogue`, `/roleplay`, `/characters`, `/debate`, `/photo` |
| Content | `GET /content/course-items` |
| Admin | `/admin/*` (analytics, items, covers, import) |
| AI | `/ai/feedback` (daily feedback); `/ai/chat`, `/ai/generate`, `/ai/photo` are legacy |

Every route, payload and limit is documented in [`CLAUDE.md`](CLAUDE.md).

## Quality and CI

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every
pull request and push to `main`:

- **Secret scan** — gitleaks over the full history
- **Dependency audit** — `npm audit --omit=dev --audit-level=high` for both apps
- **Backend** — type-check, build, `prisma migrate deploy` on MySQL 8, then a smoke
  test (health, content loaded, security headers, auth required, input validation)
- **Frontend** — type-check, build, then a smoke test (pages render, security headers)

Dependabot opens weekly update PRs for both apps and the workflow actions. There is
no unit-test suite or linter yet (see [`TODO.md`](TODO.md)).

## Deployment

Web app on Vercel, API on Railway, MySQL 8 on any host (e.g. Hostinger). Settings,
environment variables and the **go-live security checklist** are in
[`docs/guides/deployment.md`](docs/guides/deployment.md).

## Security

The project follows the NIST Cybersecurity Framework 2.0; the profile, data
classification and the checklist for every change are in
[`docs/security.md`](docs/security.md). Highlights: bcrypt passwords with a strength
rule, email verification, rate limits on auth, DTO validation on every route,
CSP and security headers on both apps, secrets only in environment variables, and
secret scanning plus dependency audits in CI. Known accepted risks (UI-only Premium,
JWT in `localStorage`) are listed there and in `TODO.md`.

Please report vulnerabilities privately to the maintainers rather than in a public issue.

## Contributing

1. Read [`AGENTS.md`](AGENTS.md) (rules and definition of done) and the relevant part of [`CLAUDE.md`](CLAUDE.md).
2. Create a branch, use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…).
3. Run `npm run typecheck` and `npm run build` in each app you touched.
4. Update `CHANGELOG.md`, `TODO.md` and the docs in the same change.
5. Open a pull request; merge only when CI is green.

## License

No license has been chosen yet, so all rights are reserved by the authors.
