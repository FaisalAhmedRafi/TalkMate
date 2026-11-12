# AGENTS.md — rules for AI agents and contributors

This file is the operating manual for anyone (human or AI agent) changing this
repository. Read it fully before making changes. `CLAUDE.md` points here and holds
the detailed, module-by-module reference of how the code works.

## 1. Project in one paragraph

**TalkMate** is an AI language-practice web app. A learner picks a target language
and level, then practises in ten modes (Chat, Call, Sentence, Word, Dialogue,
Roleplays, Characters, Debates, Photo, Flashcards), earning XP, streaks and
achievements; an LLM (OpenRouter) writes replies, reviews and daily feedback.
All learning content lives in the database and is managed from an **Admin panel**
(`/admin`, access by `ADMIN_EMAILS`). It is a two-app monorepo: a **NestJS 11 API**
(`backend/`, Prisma + MySQL 8, JWT auth) and a **Next.js 16 web app** (`frontend/`,
React 19, Tailwind). There is no root `package.json`.

## 2. Non-negotiable rules

1. **Document every change.**
   - Update `CHANGELOG.md` (under `## [Unreleased]`) in the same change.
   - Update `TODO.md`: tick finished items, add discovered follow-ups. Never leave
     unfinished work unrecorded.
   - Update the matching section of `CLAUDE.md` (routes, models, gotchas) and of
     `docs/` when you change behaviour, the schema, security or deployment.
2. **Security first — NIST CSF 2.0.** `docs/security.md` is the security profile.
   Every change must pass its *Checklist for every change*: validate input with
   class-validator DTOs (the global `ValidationPipe` strips undeclared fields),
   keep routes behind `AuthGuard` / `AdminGuard` unless public on purpose, add new
   third-party hosts to the CSP in `frontend/next.config.mjs`, classify new
   personal data, no secrets in code, logs or `NEXT_PUBLIC_*` variables.
   Production must pass the *Go-live security checklist* in
   `docs/guides/deployment.md`.
3. **No secrets in git.** Real values live in `backend/.env` and
   `frontend/.env.local` (git-ignored) locally and in the hosts' settings in
   production. Templates: `backend/.env.example`, `frontend/.env.local.example`.
   Never print or paste secret values.
4. **CI must stay green**: `.github/workflows/ci.yml` (secret scan, `npm audit`,
   type-check, build, migrate + smoke test for both apps). Never merge a red pipeline.
5. **Content is data, not code.** Learning content (skills, words, topics,
   scenarios, characters, photos) is edited in the Admin panel or shipped as a
   data migration — never added to the catalog files (see `CLAUDE.md` → Content).
6. **Never edit an applied migration** or `package-lock.json` by hand. Change
   `schema.prisma`, run `npx prisma migrate dev --name <change>`, commit the folder.
7. **Never rename an id that has progress** (skill, word, topic, scenario,
   character, photo ids key learners' progress rows).

## 3. Folder structure

```
.
├── AGENTS.md / CLAUDE.md     ← agent rules (this file) / detailed code reference
├── README.md, CHANGELOG.md, TODO.md
├── docs/
│   ├── security.md           ← NIST CSF 2.0 profile
│   └── guides/deployment.md  ← Vercel + Railway + MySQL, go-live checklist
├── .github/                  ← CI workflow + Dependabot
├── docker-compose.yml        ← local MySQL 8
├── backend/                  ← NestJS API
│   ├── prisma/               ← schema.prisma + migrations (commit them)
│   ├── scripts/              ← one-off maintenance scripts
│   └── src/
│       ├── main.ts           ← bootstrap: headers, CORS, static /media, validation
│       ├── auth/ progress/ account/ admin/ content/ ai/
│       └── <mode>/           ← one module per practice mode (catalog, prompts, dto, service, controller)
└── frontend/                 ← Next.js App Router
    ├── app/                  ← routes (dashboard, login, admin, one folder per mode)
    ├── components/           ← UI, one folder per mode + account/ admin/
    ├── lib/                  ← API client (api.ts), helpers per mode
    └── public/               ← images (modes, tutors, photo, login)
```

**Module rule (backend):** each feature is a Nest module. Reuse another module's
service only through its exported providers (`ProgressService`, `OpenRouterService`,
`WordImageService`, ...). All OpenRouter calls go through `OpenRouterService`.

## 4. How to add things

| Want to… | Do this |
|---|---|
| Add content (skill, word, topic, scenario, character, photo) | Admin panel, or a data migration for built-in content (`CLAUDE.md` → Content) |
| Add an API field | DTO (validators) → service → `frontend/lib/api.ts` types → callers |
| Add a route | Controller method with `@UseGuards(AuthGuard)` (or `AdminGuard`); think about the throttle limit |
| Change the DB | Edit `schema.prisma`, `npx prisma migrate dev --name <change>`, commit the folder, note it in CHANGELOG |
| Add a third-party host to the web app | Add it to the CSP in `frontend/next.config.mjs` and to `docs/security.md` |
| Add a chat-style mode, tutor, achievement… | Follow the *Recipes* in `CLAUDE.md` |

## 5. Conventions

- **Reuse before you write.** Search the module and `lib/` for an existing helper.
  New dependencies must be actively maintained, widely used and justified in the
  CHANGELOG.
- TypeScript strict in the frontend; match the existing (looser) backend style
  unless deliberately tightening it.
- Backend: single quotes; frontend: double quotes, 2-space indent, `"use client"`
  on client components. Tailwind utilities only.
- Short one-line comments that explain *why*.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`,
  `chore:`, `ci:`). Work on a branch and open a PR; never push to `main` directly.

## 6. Definition of done

- [ ] Works in the browser (checked, not assumed) — or say clearly that it was not
- [ ] `npm run typecheck` and `npm run build` pass in every app you touched; CI green
- [ ] Security checklist in `docs/security.md` satisfied
- [ ] `CHANGELOG.md`, `TODO.md`, `CLAUDE.md` and relevant `docs/` updated
