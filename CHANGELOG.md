# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- `AGENTS.md`: rules for contributors and AI agents (document every change, security first, CI green, no secrets in git, definition of done). `CLAUDE.md` points to it.
- `docs/security.md`: NIST CSF 2.0 profile (Govern / Identify / Protect / Detect / Respond / Recover), data classification, data that leaves the system, local vs production credentials, checklist for every change.
- `docs/guides/deployment.md`: Vercel + Railway + MySQL setup, environment variables, release steps and a go-live security checklist.
- CI (`.github/workflows/ci.yml`): gitleaks secret scan, `npm audit` (high+) for both apps, type-check and build for both apps, `prisma migrate deploy` on MySQL 8 and smoke tests (health, content loaded, security headers, auth required, validation, pages render).
- Dependabot for `backend/`, `frontend/` and GitHub Actions (weekly).
- `backend/.env.example` and `frontend/.env.local.example` (the README referred to them, but they did not exist).
- `npm run typecheck` in both apps; `engines.node >= 20.9`.
- Security headers on the web app (CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP; `no-store` + `noindex` on `/admin`) and on the API (`default-src 'none'` CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, CORP, HSTS in production); `X-Powered-By` removed from both.
- API start-up warning when `JWT_SECRET` is shorter than 32 characters.
- Root `.gitignore`; all `.env*` files (except the templates) are ignored in both apps.
- `README.md` rewritten: badges, features, stack, architecture, setup, configuration, scripts, structure, API overview, CI, deployment, security, contributing, license.
- `CHANGELOG.md` and `TODO.md`.

### Changed
- **Security upgrades** (all high/critical `npm audit` findings fixed, 0 left in production dependencies):
  - Frontend: Next.js 14.2 → 16.4, React 18 → 19 (Next 14 has no patched release for the current advisories). Three `RefObject` prop types adjusted for React 19; `tsconfig.json` updated by Next.
  - Backend: NestJS 10 → 11 (Express 5), `@nestjs/config` 3 → 4, `@nestjs/jwt` 10 → 11, `@nestjs/throttler` 6.5, nodemailer 6 → 10.
- `frontend/next.config.mjs` pins `turbopack.root` (the repo has no root `package.json`).

### Removed
- The 28 old PostgreSQL migration folders. They were left next to the MySQL baseline when the database moved to MySQL, could not run on MySQL, and made `prisma migrate deploy` fail on a fresh database.

## [0.1.0] — 2026-11-12

Initial state before this changelog: ten practice modes, accounts with email verification and Google sign-in, progress and achievements, Courses / Learn / Explore, Account pages, the Admin panel with Analytics, all content in MySQL. See `CLAUDE.md` for details.
