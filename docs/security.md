# Security — NIST CSF 2.0 profile

TalkMate follows the [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework).
This file is the **current profile**: what each CSF function means for this app and
which control implements it. Keep it current — any change that touches auth, data,
headers, dependencies or deployment must update the matching row (see `AGENTS.md` §2).

Scope: a Next.js web app (`frontend/`), a NestJS API (`backend/`), one MySQL 8
database, a media folder for pictures, and these third parties: OpenRouter (AI),
Google (sign-in), Gmail SMTP or Resend (email), Pixabay / Pexels / Wikipedia
(stock pictures), flagcdn.com (flag images).

## GV — Govern

| ID | Control | Where |
|---|---|---|
| GV.PO | Security rules are mandatory for every contributor and AI agent | `AGENTS.md` §2 rule 2 |
| GV.RR | Admins are the emails in `ADMIN_EMAILS`; added content records the admin's email (`ContentItem.createdBy`) | `admin/admin.guard.ts`, `content/content.store.ts` |
| GV.SC | Supply chain: both lockfiles committed, `npm audit` (high+) in CI, Dependabot weekly for both apps and Actions | `package-lock.json`, `.github/` |
| GV.OV | This profile is reviewed at every release and on any security-relevant change | `CHANGELOG.md` |

## ID — Identify

| ID | Control | Where |
|---|---|---|
| ID.AM | Assets: web app, API, MySQL database, media folder (`MEDIA_DIR`), environment secrets, OpenRouter / Google / mail / photo accounts, hosting accounts (Vercel, Railway, MySQL host), GitHub repo | this file |
| ID.RA | Main risks: account takeover, admin takeover (edits content for every learner), leak of personal data, abuse of the paid/free AI quota, Premium bypass, vulnerable dependencies, secrets committed to git | this file |
| ID.IM | Findings and follow-ups are tracked in `TODO.md` | `TODO.md` |

**Data classification**

| Data | Class | Notes |
|---|---|---|
| Email, first/last name, country, phone, avatar, time zone | Personal | `User`; deleted with the account (`DELETE /account`, cascade) |
| Password hash, reset-token hash, verification-code hash | Secret (derived) | bcrypt / sha256 only; raw values are never stored |
| Practice texts, chat / call / debate / roleplay / character transcripts | Personal (free text, may contain anything the learner writes or says) | Sent to OpenRouter for replies and reviews; deleted with the account |
| Photos the learner describes (Photo Mode) | Content | Built-in or admin pictures, sent to the AI model as base64 |
| Support messages | Personal | `SupportMessage`; read in the database only |
| Personalization answers, notification / privacy switches | Personal | Stored only; nothing reads them yet |
| Progress, XP, streak, subscription (demo) | Personal (low) | No payment data exists — billing is not connected |
| Learning content (`ContentItem`) | Public | Same for every learner |

**Data leaving the system**: learner messages and photos go to OpenRouter and the
model provider it routes to; the email address goes to the mail provider; Google
receives the sign-in request; stock-photo searches send only English search words.

## PR — Protect

| ID | Control | Where |
|---|---|---|
| PR.AA | Passwords: bcrypt cost 10; rule 8–72 chars with lower, upper and digit (same check on both sides); login answers the same message for unknown email and wrong password | `auth/password.rule.ts`, `frontend/lib/password.ts`, `auth/auth.service.ts` |
| PR.AA | Email ownership: 6-digit code (sha256, 15 min, 5 tries), reset links (sha256, 1 h, single use); Google ID tokens checked for `aud`, `iss` and a verified email | `auth/auth.service.ts` |
| PR.AA | Sessions: HS256 JWT, 1 day (30 days with "Remember this device"); every protected route uses `AuthGuard`; admin routes use `AdminGuard` (email in `ADMIN_EMAILS`, re-read on every request) | `auth/auth.guard.ts`, `admin/admin.guard.ts` |
| PR.AA | Brute-force limits: global 20 req/min per client; auth 10/min, forgot-password and resend-verification 3/min, change password 5/min | `@Throttle` in each controller |
| PR.AA | `JWT_SECRET` must be ≥ 32 random chars; the API logs a warning at start-up when it is shorter | `main.ts` |
| PR.DS | Input validation: class-validator DTOs on every route, global `ValidationPipe({ whitelist: true })` strips unknown fields; Prisma only (parameterised SQL) | `*/*.dto.ts`, `main.ts` |
| PR.DS | Uploads (admin pictures, avatars): data-URL type allow-list (jpeg/png/webp), size limits (3 MB pictures, ~400 KB avatars), server-chosen file names | `admin/admin.service.ts`, `account/` |
| PR.DS | Request body capped at 6 MB; CORS only for the origins in `FRONTEND_URL` | `main.ts` |
| PR.DS | Secrets only in environment variables; `.env*` git-ignored (templates excepted); gitleaks secret scan in CI; `NEXT_PUBLIC_*` values are public by design and never hold secrets | `.gitignore`, `ci.yml` |
| PR.DS | TLS in production (host certificates) + HSTS 2 years on both apps | `next.config.mjs`, `main.ts` |
| PR.PS | Web app headers: CSP (self + API + Google sign-in; images from https), HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (microphone for self only), COOP; `X-Powered-By` off; `/admin` is `no-store` + `noindex` | `frontend/next.config.mjs` |
| PR.PS | API headers: `default-src 'none'` CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, CORP cross-origin (pictures are used by the web app), HSTS in production; `X-Powered-By` off | `backend/src/main.ts` |
| PR.PS | AI prompts treat learner text as data, not instructions; system prompts are built server-side and clients may send only `user` / `assistant` roles | `*/*.prompts.ts`, `ai/` |

**Known, accepted risks (tracked in `TODO.md`)**
- Premium is enforced only in the UI; the API does not check it. Billing is a demo.
- The JWT is kept in `localStorage` (readable by any script that runs on the page,
  which is why the CSP matters). Tokens are not revoked on password change.
- The CSP allows `'unsafe-inline'` scripts because Next.js inlines its bootstrap
  without nonces here.
- Scores and "known" counts are sent by the browser and trusted (XP can be farmed).
- Rate limits are in memory per API instance and reset on restart.
- Notification and privacy opt-outs are stored but not acted on.

### Local testing vs production credentials

| | Local testing (your machine) | Production |
|---|---|---|
| `JWT_SECRET` | any 32+ chars | fresh `openssl rand -hex 32`, never reused from dev |
| Database | Docker MySQL, user/password `talkpal` | own user with a long random password; MySQL not reachable without TLS/allow-list |
| Test accounts | any; codes appear in the API log without a mailer | real mail delivery; no shared or test accounts |
| `ADMIN_EMAILS` | your own address | only the real admins' addresses, each with a strong password or Google sign-in |
| Env files | `backend/.env`, `frontend/.env.local` (git-ignored) | **no env files** — values only in the hosts' settings |
| API keys (OpenRouter, Gmail app password, Pixabay…) | personal dev keys are fine | separate production keys, rotated if ever exposed |

Before go-live run the *Go-live security checklist* in `docs/guides/deployment.md`.

## DE — Detect

| ID | Control | Where |
|---|---|---|
| DE.CM | Server errors and every failed AI call (model, status, reason) are logged | `ai/openrouter.service.ts`, Nest logger |
| DE.CM | Rate-limit hits answer 429 | `ThrottlerGuard` |
| DE.CM | Dependency vulnerabilities flagged by `npm audit` (CI) and Dependabot | `.github/` |
| DE.CM | Committed secrets flagged by gitleaks on every push and PR | `ci.yml` |
| DE.AE | Host logs (Railway runtime logs, Vercel function logs); uptime check on `GET /health` | hosting dashboards |

## RS — Respond

1. **Contain**: rotate `JWT_SECRET` (instantly invalidates every session), remove a
   compromised address from `ADMIN_EMAILS`, rotate the leaked key (OpenRouter,
   Gmail app password, Google client secret if any, DB password).
2. **Analyse**: host logs, `ContentItem.updatedAt` / `createdBy` for content changes,
   recent `User` rows.
3. **Eradicate**: patch or roll back (redeploy the last good commit).
4. **Notify**: if personal data was exposed, notify affected people and authorities
   as required by law (e.g. GDPR: 72 h).
5. Record the incident and lessons learned in `CHANGELOG.md`.

## RC — Recover

| ID | Control | Where |
|---|---|---|
| RC.RP | Code is in Git — any commit can be redeployed | GitHub, host deploy history |
| RC.RP | Daily database backups on the MySQL host; periodic copy of the media folder (uploaded admin pictures are also stored in the DB and re-created on start) | host backups, `content/content.store.ts` |
| RC.RP | Built-in content is re-created by `npm run prisma:deploy` on an empty database | `prisma/migrations/` |
| RC.CO | Restore test at least once per quarter; note the result in `CHANGELOG.md` | — |

## Checklist for every change

- [ ] New input? Add it to a DTO with validators (undeclared fields are stripped).
- [ ] New route? Behind `AuthGuard` / `AdminGuard` unless public on purpose; sensible `@Throttle`.
- [ ] New third-party host in the web app? Add it to the CSP in `frontend/next.config.mjs` and to *Scope* above.
- [ ] New personal data? Add it to the classification table and make sure account deletion removes it.
- [ ] New data sent to the AI? Treat learner text as data in the prompt; note it under *Data leaving the system*.
- [ ] New dependency? Maintained, widely used, justified in `CHANGELOG.md`; `npm audit` clean.
- [ ] No secrets in code, logs, `NEXT_PUBLIC_*` variables or commits.
