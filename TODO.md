# TODO

Living backlog. Agents: tick items as you finish them and add follow-ups you discover.

## Done
- [x] AGENTS.md, NIST CSF 2.0 profile (`docs/security.md`), deployment guide with go-live checklist
- [x] CI (secret scan, audit, type-check, build, migrate + smoke test) and Dependabot
- [x] Security headers on both apps; `.env` templates; `.gitignore` hardening
- [x] Upgrade Next.js 14 → 16 / React 19 and NestJS 10 → 11 / nodemailer 10 (audit clean)
- [x] Remove the leftover PostgreSQL migrations

## Before go-live
- [ ] Hostinger API: add `OPENROUTER_API_KEY`, `GMAIL_USER` + `GMAIL_APP_PASSWORD`, `GOOGLE_CLIENT_ID`, `PIXABAY_API_KEY`, `ADMIN_EMAILS` (without a mailer nobody can verify a sign-up); web: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + rebuild; add https://talkmate.edsol.academy to the Google OAuth JavaScript origins
- [ ] Hostinger: auto-deploy from Git (the repo is under FaisalAhmedRafi; connect it or transfer it), and enable daily backups
- [ ] GitHub Actions do not run: the repo owner's account is locked for billing — fix it so CI can gate merges
- [ ] Complete the *Go-live security checklist* in `docs/guides/deployment.md`
- [ ] Protect `main` on GitHub (require the CI checks)
- [ ] Click through every mode in a browser after the framework upgrade (only login, dashboard, Chat and Explore were checked; Call/mic, Google sign-in and the Admin panel were not)
- [ ] Check on Vercel that the CSP allows everything in production (Google sign-in popup, flag images, photos); watch the browser console for CSP errors
- [ ] Choose a license (none yet — all rights reserved)

## Security (from `docs/security.md` accepted risks)
- [ ] Enforce Premium on the API, not only in the UI (needs real billing first)
- [ ] Move the JWT from `localStorage` to an `httpOnly` cookie; revoke tokens on password change / account deletion
- [ ] Refuse to start in production when `JWT_SECRET` < 32 chars (today: warning only)
- [ ] Tighten the CSP with nonces (drop `'unsafe-inline'` scripts)
- [ ] Shared rate-limit store (Redis/DB) so limits survive restarts and span instances; per-account login lockout
- [ ] Server-side validation of scores (Sentence, Word, Flashcards, Photo) to stop XP farming
- [ ] Honour the stored privacy opt-outs or remove the switches; publish a privacy notice (data goes to OpenRouter and model providers)
- [ ] Audit log for admin writes (who changed which element, when)
- [ ] Clean up unverified accounts and old archived chats/calls

## Engineering
- [ ] Add a linter (ESLint) and unit tests; run them in CI
- [ ] Remove dead code listed in `CLAUDE.md` gotcha 57 (GeneratePanel, PhotoPanel, legacy `/ai/*` routes)
- [ ] Prisma 5 → 6 when convenient
- [ ] Wire `MailService` into support messages (today they are only stored)
