# Deployment — Vercel (web) + Railway (API) + MySQL 8

```
git push / PR ──► GitHub Actions CI ──(green, merge to main)──► Vercel builds frontend/
                  secret scan · npm audit ·                      Railway builds backend/
                  type-check · build ·                           (prisma migrate deploy → start)
                  migrate + smoke test
```

- **CI** (`.github/workflows/ci.yml`) runs on every push to `main` and every pull
  request. It is the quality gate: work on a branch, open a PR, merge only when green.
- **CD**: Vercel and Railway redeploy on pushes to `main` when their Git integration
  is on. Protect `main` on GitHub (Settings → Branches → require the *CI* checks) so
  only green code reaches production.
- **Dependabot** (`.github/dependabot.yml`) opens weekly update PRs for both apps
  and the Actions; they go through CI too.

Any host that runs Node.js ≥ 20.9 works. Two setups are documented: Vercel + Railway
(sections 1–3) and everything on Hostinger (section 4).

## 4. Hostinger (both apps + MySQL on one account)

Live since 2026-11-12: **https://talkmate.edsol.academy** (web) and
**https://talkmate-api.edsol.academy** (API), account `u138423697`, recorded in
`.hostinger/sites.json`. Each app is its own Node.js *website* (not a subdomain
folder of another site), and the database lives on the same server.

| | Web (`frontend/`) | API (`backend/`) |
|---|---|---|
| App type | Next.js | NestJS, entry file `main.js`, output `dist` |
| Node | 22 | 22 |
| Build | `npm run build` = `next build --webpack` (Turbopack's PostCSS worker cannot start on shared hosting) | `npm run build`; its `prebuild` generates the Prisma client and, with `MIGRATE_ON_BUILD=1`, runs `prisma migrate deploy` (Hostinger only runs `npm install` + `npm run build`, no start hook) |
| Env vars | `NEXT_PUBLIC_API_URL=https://talkmate-api.edsol.academy` (+ `NEXT_PUBLIC_GOOGLE_CLIENT_ID`); a change needs a rebuild | `DATABASE_URL` (host **`127.0.0.1`**, never `localhost` or `srvNNNN.hstgr.io`), `JWT_SECRET`, `MIGRATE_ON_BUILD=1`, `FRONTEND_URL`, `PUBLIC_API_URL`, `MEDIA_DIR=/home/<user>/talkmate-media` (outside the deploy folder so pictures survive redeploys), plus the AI / mail / Google / photo keys |

**Do not set `NODE_ENV=production` on the API**: Hostinger then installs only
`dependencies` and the build loses the Nest CLI and Prisma. HSTS is sent anyway
because `PUBLIC_API_URL` is `https://`.

Deploys are uploaded archives (`git archive --format=zip -o app.zip HEAD:backend`,
same for `frontend`) built with the Hostinger API; the repository is not reachable
from this Hostinger account's Git installation, so there is no auto-deploy yet.

The Vercel + Railway setup is described below.

## 1. Database (MySQL 8.0.13+)

1. Create a database and a user with a long random password (MariaDB is not
   supported: the schema uses JSON default expressions).
2. The API runs on another host, so enable **remote access** for that user (e.g.
   Hostinger hPanel → Databases → Remote MySQL). Allow only the API's address when
   the platform gives a fixed one. Use TLS when the server offers it (Prisma:
   append `?sslaccept=strict` to `DATABASE_URL`).
3. Enable daily backups.

The schema and the built-in learning content are created by `npm run prisma:deploy`
(two migrations: `20261112000000_init_mysql`, `20261112000100_content_builtin_data`).
The API refuses to start if the `ContentItem` table is missing.

## 2. API on Railway (`backend/`)

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `npm run build` (`npm ci` runs `prisma generate` via `postinstall`) |
| Start command | `npm run prisma:deploy && npm run start:prod` |
| Health check | `GET /health` → `{"ok":true}` |
| Volume | mount one (Railway sets `RAILWAY_VOLUME_MOUNT_PATH`) so downloaded photos survive redeploys |

**Environment variables** (Railway → Variables; never committed):

| Name | Value |
|---|---|
| `DATABASE_URL` | `mysql://USER:PASS@HOST:3306/DBNAME` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `NODE_ENV` | `production` (turns on HSTS) |
| `FRONTEND_URL` | the Vercel origin, e.g. `https://talkmate.example.com` (comma-separate several) |
| `PUBLIC_API_URL` | the API's public URL, e.g. `https://api.talkmate.example.com` |
| `ADMIN_EMAILS` | the real admins' emails |
| `OPENROUTER_API_KEY` | production key; optional `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODELS` |
| `GMAIL_USER` + `GMAIL_APP_PASSWORD` **or** `RESEND_API_KEY` + `MAIL_FROM` | mail for sign-up codes and password resets (required: sign-up needs mail) |
| `GOOGLE_CLIENT_ID` | for Google sign-in (add the Vercel origin to its JavaScript origins) |
| `PIXABAY_API_KEY` / `PEXELS_API_KEY` | optional stock photos |

See `backend/.env.example` for the full list with comments.

## 3. Web app on Vercel (`frontend/`)

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework | Next.js (build `npm run build`, Node 20.9+ / 22) |
| `NEXT_PUBLIC_API_URL` | the API URL (the same as `PUBLIC_API_URL`) — also added to the CSP at build time |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | same value as the API's `GOOGLE_CLIENT_ID` |

`NEXT_PUBLIC_*` values are compiled into the browser bundle: changing one needs a
redeploy, and none may ever hold a secret.

## Go-live security checklist

Local testing may use weak values (Docker `talkpal` passwords, a short
`JWT_SECRET`, codes printed in the log). Production must not (NIST CSF 2.0 —
`docs/security.md`). Tick every item before pointing users at the site:

- [ ] `NODE_ENV=production` on the API
- [ ] New `JWT_SECRET` (`openssl rand -hex 32`) and DB password — none reused from dev; the API log shows no `JWT_SECRET is shorter` warning
- [ ] Production API keys (OpenRouter, mail, photos) separate from personal dev keys
- [ ] No env file on any server or in git (`git ls-files | grep -i env` lists only the two templates)
- [ ] `FRONTEND_URL` lists only the real frontend origin(s)
- [ ] `ADMIN_EMAILS` lists only real admins; each has a strong password or uses Google sign-in
- [ ] Mail delivery works for an outside address (sign-up code arrives)
- [ ] HTTPS on both apps; headers present:
      `curl -sI https://<web> | grep -i content-security-policy` and
      `curl -sI https://<api>/health | grep -i strict-transport-security`
- [ ] Remote MySQL access limited to the API host (or at least a strong password + TLS)
- [ ] Backups enabled for the database and the media volume; one restore tested
- [ ] Known accepted risks in `docs/security.md` reviewed (Premium is UI-only, demo billing)
- [ ] CI green on the commit being deployed

## Every release

1. Branch → commit (Conventional Commits) → PR → CI green → merge.
2. Vercel and Railway rebuild; Railway applies new migrations on start.
3. Check the live site, sign in, open one mode and `/admin`. If broken, redeploy the
   previous deployment from the host's dashboard or revert the commit on `main`.

## Upgrading an existing database to this version

Older checkouts still carried 28 PostgreSQL migration folders from before the move
to MySQL. They were removed (they cannot run on MySQL and broke `migrate deploy` on
a fresh database). A MySQL database created from the MySQL baseline is unaffected.

## Local production check

```bash
docker compose up -d
cd backend && npm ci && npm run build && npm run prisma:deploy && npm run start:prod
cd frontend && npm ci && npm run build && npm start
```
