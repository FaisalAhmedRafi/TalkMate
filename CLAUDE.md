# CLAUDE.md

Guidance for working in this repository. Every source file in the project was read to write this.

## What this is

TalkMate is an AI language-practice web app (a Talkpal-style clone; the UI even says "in this clone"). A learner picks a target language and level, then practices in ten "modes": Chat, Call (voice), Sentence, Word, Dialogue, Roleplays, Characters, Debates, Photo and Flashcards. Practice earns XP, levels, streaks and achievements, and an LLM writes daily feedback.

Monorepo with two independent apps, **no root `package.json`**. Run every npm command inside `backend/` or `frontend/`.

| Path | What | Version (from lockfiles) | Port |
|---|---|---|---|
| `backend/` | NestJS API, Prisma + PostgreSQL, JWT, OpenRouter | Nest 10.4.x, Prisma 5.22 | 4000 |
| `frontend/` | Next.js App Router, React 18, Tailwind 3, lucide-react | Next 14.2.x | 3000 |
| `docker-compose.yml` | Local Postgres 16, user/password/db all `talkpal`, port 5432, volume `pgdata` | | 5432 |

Naming leftovers: npm packages are `talkpal-backend` / `talkpal-frontend`, DB credentials are `talkpal`, but the product, UI, `X-Title` header and localStorage key use "TalkMate". Do not rename these unless asked, since the DB credentials are baked into local volumes.

## Commands

```bash
docker compose up -d                 # start Postgres (or point DATABASE_URL at any Postgres)

# backend/  (http://localhost:4000)
npm install                          # postinstall runs `prisma generate`
npx prisma migrate dev               # apply existing migrations / create new ones (add --name <change>)
npm run start:dev                    # nest start --watch
npm run build                        # nest build -> dist/
npm run start:prod                   # node dist/main
npm run prisma:deploy                # migrate deploy (production)
npm run prisma:studio                # browse data

# frontend/  (http://localhost:3000)
npm install
npm run dev | build | start
```

No tests, linter, formatter or CI exist. `frontend` code has `eslint-disable` comments but ESLint is not installed. The only verification available is `npm run build` in each app plus manual testing. Say so rather than claiming tests pass.

## Environment variables

Backend `.env` (git-ignored). The README says `cp .env.example .env`, but **there is no `.env.example` in the repo**. Create `.env` by hand:

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | e.g. `postgresql://talkpal:talkpal@localhost:5432/talkpal` |
| `JWT_SECRET` | yes | `getOrThrow`, so the app will not boot without it |
| `OPENROUTER_API_KEY` | for `/ai/*` | missing key returns 503 "OPENROUTER_API_KEY is not set on the server" |
| `OPENROUTER_MODEL` | no | default `openrouter/free` |
| `OPENROUTER_FALLBACK_MODELS` | no | comma-separated, tried in order after the primary |
| `FRONTEND_URL` | no | comma-separated CORS origins, default `http://localhost:3000` |
| `PORT` | no | default 4000, binds `0.0.0.0` |

Frontend `.env.local` (copy from `.env.local.example`): `NEXT_PUBLIC_API_URL=http://localhost:4000`.

## Repository map

```
backend/
  prisma/schema.prisma            4 models (below)
  prisma/migrations/
    20261007160943_init/          User, Progress, PracticeEntry
    20261013154234_practice_time/ PracticeDay
  src/main.ts                     bootstrap, body limit, CORS, ValidationPipe
  src/app.module.ts               ConfigModule (global), Throttler, HealthController (GET /health)
  src/prisma/prisma.module.ts     global PrismaService (extends PrismaClient, connects on init)
  src/auth/                       controller, service, guard, dto, module
  src/progress/                   controller, service, dto, module
  src/ai/                         controller, service, openrouter.service, prompts, dto, module
frontend/
  app/layout.tsx, globals.css     root layout (title "TalkMate"), Tailwind directives
  app/page.tsx                    redirects to /dashboard
  app/login/page.tsx              login + register form
  app/dashboard/page.tsx          the whole app shell (client component)
  components/                     ChatPanel, GeneratePanel, PhotoPanel, ProgressView, PracticeTimer, Modal
  lib/api.ts, modes.ts, dates.ts  API client + types, mode/language constants, local-date helpers
```

## Backend in detail

### Bootstrap (`main.ts`)
- `bodyParser: false`, then `json({ limit: '6mb' })`. Needed for base64 photos (the DTO allows up to 5,000,000 chars).
- `trust proxy` = 1 (so throttling sees the real client IP behind one proxy).
- CORS allows only the origins in `FRONTEND_URL`.
- Global `ValidationPipe({ whitelist: true, transform: true })`: unknown properties are silently stripped, so a new request field **must** be added to the DTO or it will vanish.

### Rate limiting
Global `ThrottlerGuard`: 20 requests / 60 s per client. `AuthController` overrides with 10 / 60 s. This protects the free OpenRouter quota and password guessing.

### Auth (`src/auth`)
- `POST /auth/register`: email lowercased/trimmed, 409 if it exists, bcryptjs cost 10, creates `User` and an empty `Progress` in one nested create, returns `{ token, user: { id, email } }`.
- `POST /auth/login`: same error ("Invalid email or password.") for unknown email and wrong password. Keep it that way to avoid account enumeration.
- JWT: `JwtModule.registerAsync({ global: true })`, secret from `JWT_SECRET`, 7-day expiry, payload `{ sub, email }`. No refresh tokens.
- `AuthGuard` parses `Authorization: Bearer <token>` and sets `req.user = { id, email }`. Controllers read `req.user.id`.
- DTOs: register email max 254, password 8..72 (bcrypt ignores bytes past 72), name optional max 60. Login password max 72.

### Progress (`src/progress`)
Constants: `STUDY_SECONDS = 180`, `XP_PER_LEVEL = 50`. Dates in this file are **UTC** (`ymd = toISOString().slice(0,10)`).

- `snapshot(userId)` is what almost every endpoint returns: `{ email, xp, streak, longest, messages, premium, giftClaimed, language, level, today: string[] }`. `today` is the user's last 30 `PracticeEntry` texts for the UTC day, oldest first. If `lastDay` is more than 1 day before UTC today, `streak` is reported as 0 without writing to the DB.
- `practice(text)`: in one transaction, `xp += 10`, `messages += 1`, insert `PracticeEntry` (text truncated to 1000). Returns a snapshot.
- `addTime(seconds, day)`: `day` is the **browser's local date**. Rejected (400 "Invalid day") if more than 1 day away from UTC today. Upserts `PracticeDay` (increments seconds). Only when this call makes the day's total cross 180 seconds does the streak change: gap = days between `lastDay` and `day`; if `lastDay` is null or gap > 0, `streak = gap === 1 ? streak + 1 : 1`, `longest = max(...)`, `lastDay = day`.
- `stats()`: `{ totalSeconds, studiedDays (days >= 180s), activeDays (days > 0s), days: last 400 PracticeDay rows oldest-first, achievements }`.
- `settings(dto)`: updates `language` (any string up to 40 chars, not validated against the frontend list) and `level` (Beginner | Intermediate | Advanced).
- `unlockPremium()`: demo only, sets `premium = true` for anyone who calls it.
- `claimGift()`: one-time +20 XP, guarded by `giftClaimed`.
- `ensure(userId)` upserts a `Progress` row defensively before every operation.
- Achievements are code, not data: the `ACHIEVEMENTS` array (ids `first_step`, `warm_up`, `on_a_roll`, `week`, `chatterbox`, `hour`, `level5`) is evaluated on each `stats()` call against facts (messages, longest streak, total seconds, studied days, level). Nothing is persisted per achievement.

### AI (`src/ai`)
All routes are behind `AuthGuard`.

- `POST /ai/chat` `{ mode, messages[1..30], context?, targetLanguage?, nativeLanguage?, level? }` -> `{ reply }`. System prompt from `chatSystem(mode, learner, context)` is prepended server-side; clients may only send `user` / `assistant` roles (content max 2000). Temperature 0.8; max tokens 200 for `call`, 450 otherwise.
- `POST /ai/generate` `{ type, topic (max 120), count? (3..12), ...learner }` -> parsed JSON. Defaults: 8 items for flashcards, 6 otherwise; dialogue uses `max(count, 6)` lines. Temperature 0.6, max tokens 1400. Up to 2 attempts; the model output is stripped of code fences, the outermost `{...}` is extracted and `JSON.parse`d; both failing returns 502 "unreadable answer". Response shapes:
  - sentence: `{ items: [{ sentence, translation, note }] }`
  - word: `{ items: [{ word, translation, example, exampleTranslation }] }`
  - dialogue: `{ title, lines: [{ speaker: "A"|"B", text, translation }] }`
  - flashcards: `{ items: [{ front, back, hint }] }`
- `POST /ai/photo` `{ image (data:image/png|jpeg|webp;base64,..., max 5M chars), description? (max 1500) }` -> `{ feedback }`. Sends an OpenAI-style multimodal message (`image_url`). With a description the model grades it (Accuracy / Corrections / Better version / New words); without one it writes a sample description plus 5 words. Whether `openrouter/free` routes to a vision-capable model is not guaranteed; pin a vision model via `OPENROUTER_MODEL` if photos fail.
- `POST /ai/feedback` `{ texts[1..40] (each max 1000), ...learner }` -> `{ feedback }`. Writes strengths, up to 3 mistakes with corrections, one thing to practice tomorrow, under 150 words, in the learner's native language. Temperature 0.5, 500 tokens.
- `learner()` fallback defaults in `ai.service.ts`: target `Bengali`, native `English`, level `Beginner`. The frontend never sends `nativeLanguage`, so feedback and corrections are always in English today.
- `prompts.ts` is the single place for tutor behavior:
  - chat: friendly teacher, 2-4 short sentences in the target language, ends with a question, adds a `Correction:` line when needed.
  - call: 1-2 short sentences, **no emojis, markdown or lists** because the reply is read aloud by the browser.
  - roleplay: plays the other party in a scenario (default restaurant), adds `(Tip: ...)`.
  - characters: age-appropriate, stays in voice, must not claim to be the real person.
  - debate: user argues `for`/`against` (default `for`), AI takes the opposite side, respectful, one argument per turn.
  - generate prompts demand JSON only and embed the schemas above. Changing a schema means updating the prompt, `GeneratePanel` rendering and the response handling together.
- `OpenRouterService.complete()`: POST `https://openrouter.ai/api/v1/chat/completions` with `Authorization`, `X-Title: TalkMate`, 45 s timeout. For each model (primary, then fallbacks) up to 2 attempts: 200 with empty content moves to the next model; 401/402/403 throws 502 immediately ("Check your API key"); 429 or 5xx sleeps 700 ms x attempt and retries; other statuses move on. Everything exhausted returns 502 "The free AI models are busy or rate limited."

### Database (`prisma/schema.prisma`)
- `User(id cuid, email unique, name?, passwordHash, createdAt)`.
- `Progress(userId PK -> User, xp, streak, longest, messages, lastDay "YYYY-MM-DD"?, premium, giftClaimed, language default "Spanish", level default "Beginner", updatedAt)`.
- `PracticeEntry(id cuid, userId, day "YYYY-MM-DD" (UTC), text, createdAt)`, index on `(userId, day)`.
- `PracticeDay(userId, day "YYYY-MM-DD" (browser local), seconds)`, composite PK `(userId, day)`.
- All child relations `onDelete: Cascade`. Dates are stored as strings, not `DateTime`.
- Never edit an applied migration. Change the schema, then run `npx prisma migrate dev --name <change>` and commit the generated folder.

## Frontend in detail

### Shell and routing
- `/` redirects to `/dashboard`. `/login` toggles between login and register and **clears the token on mount**, so visiting it logs you out.
- `app/dashboard/page.tsx` (client component) holds all state: `Progress` snapshot `s`, active tab, open mode, upsell/feedback/account modals, toast. It redirects to `/login` if there is no token, loads `/progress`, and shows a retry screen on failure.
- Sidebar tabs: Home, Courses, Explore, Premium, Progress. Courses and Explore render a "This section isn't built yet" placeholder; Premium opens the upsell modal. The sidebar is `hidden md:flex`, so **on screens below `md` there is no navigation** (no way to reach Progress, Account or the gift). Fix this if mobile matters.
- Home lists `MODES` from `lib/modes.ts`. Only Chat is free; the other 9 show a lock and open the upsell modal unless `s.premium`. The upsell button calls the demo `POST /progress/premium`. Language and level selects update state optimistically and PATCH `/progress/settings`.
- Mode routing in the dashboard uses hard-coded id arrays: chat/call/roleplay/characters/debate -> `ChatPanel`; sentence/word/dialogue/flashcards -> `GeneratePanel`; photo -> `PhotoPanel`. `FeedbackModal` (defined at the bottom of the dashboard file) calls `/ai/feedback` with `s.today`.
- `PracticeTimer` is mounted **only while a mode modal is open**, so practice time is counted only inside a mode.

### `lib/api.ts`
Single API client. `BASE` = `NEXT_PUBLIC_API_URL`. Token key `talkmate-token` in `localStorage`. `request()` adds the Bearer header, turns network failure into "Can't reach the server...", flattens Nest validation message arrays, and on any 401 (when a token existed) clears it and hard-redirects to `/login`. `keepalive` is used for the final timer flush on unmount. Exports types `Msg`, `ChatMode`, `GenerateType`, `Learner` (`targetLanguage`, `level` only), `Progress`, `Stats`, `Achievement`, and the `api` object.

### Components
- `ChatPanel`: message list, text input, and (Call mode) a mic button using `SpeechRecognition`/`webkitSpeechRecognition` (Chrome-first) and `speechSynthesis` to read replies aloud, with the language mapped through `SPEECH_LANG`. Sends the last 20 messages. Always sends the full `context` object (scenario, character, topic, stance) regardless of mode. Changing scenario/character/topic/stance clears the conversation. After each successful reply it calls `onPractice(userText)`, which logs the learner's message and awards 10 XP. Scenario, character and topic option lists are constants at the top of the file.
- `GeneratePanel`: topic input with per-type default, "Generate"/"Regenerate", renders list / dialogue bubbles / flip-card carousel. On each successful generation it calls `onPractice("Studied <mode>: <topic>")`, so every (re)generate gives +10 XP and adds a line to the daily feedback input.
- `PhotoPanel`: client-side resize to max 800 px JPEG (quality 0.8) via canvas, then POST. Only logs practice when the learner typed a description.
- `ProgressView`: fetches `/progress/stats` (refetches when `s.messages` or `s.streak` change). Cards for Stats, streak, a 1- or 5-week calendar (a day is "studied" at >= 180 s), an inline-SVG `AreaChart` (7 / 28 days / all time), level bar, Share (navigator.share or clipboard), a Certificates placeholder ("Courses not built yet"), and Achievements (first 4 unlocked, "See all" modal). `ICONS` maps achievement ids to lucide icons.
- `Modal.tsx` exports `Modal` (backdrop click and Escape close, `wide` prop), `Select` and `ErrorText`.
- `PracticeTimer`: renders nothing; counts 1 s ticks while `document.visibilityState === "visible"`, flushes every 30 s (capped at 60 s per request) and once on unmount, calling `api.progress.time(seconds, localDay())`.
- `lib/dates.ts`: local-date helpers (`ymd`, `localDay`, `parseDay`, `addDays`, `startOfWeek` = Monday, `shortDate`).
- `lib/modes.ts`: `MODES` (id, title, desc, emoji, premium), `LANGUAGES` (12), `LEVELS`, `SPEECH_LANG`.

### Styling and TypeScript
Tailwind utility classes only (`globals.css` is just the three directives). Dark theme: page `bg-[#16161c]`, cards `bg-[#1f1f27]`, indigo-600 primary, pink accents for premium, `white/10` surfaces. Keep new UI consistent with this. `tsconfig` is `strict`; path alias `@/*` = frontend root. Client components start with `"use client"`. Frontend uses double quotes and 2-space indent; backend uses single quotes.

## Recipes

**Add a chat-style mode**: add the id to `CHAT_MODES` in `backend/src/ai/dto.ts`; add a `case` to `chatSystem` in `prompts.ts` (the switch has no default, so TypeScript will flag a missing case); add the id to `ChatMode` in `frontend/lib/api.ts`; add an entry to `MODES` in `lib/modes.ts`; add the id to the chat array in `dashboard/page.tsx`; add any selector UI in `ChatPanel`.

**Add a generate type**: `GENERATE_TYPES` in `dto.ts`, a `case` in `generateSystem`, `GenerateType` and `DEFAULT_TOPIC` in the frontend, a render block in `GeneratePanel`, a `MODES` entry, and the dashboard id array.

**Add an achievement**: append to `ACHIEVEMENTS` in `progress.service.ts` (add new facts to the `Facts` type and `stats()` if needed) and add an icon to `ICONS` in `ProgressView.tsx`.

**Change XP, level size or the study threshold**: `XP_PER_LEVEL` lives in `progress.service.ts`, `dashboard/page.tsx` and `ProgressView.tsx`; `STUDY_SECONDS` lives in `progress.service.ts` and `ProgressView.tsx`. Change all copies.

**Add an API field**: DTO (validators) -> service -> `lib/api.ts` types/helpers -> callers. Remember `whitelist: true` drops undeclared fields.

## Known issues and gotchas

1. **Premium is only enforced in the UI.** Backend `/ai/*` routes never check `premium`, and `/progress/premium` unlocks any logged-in user. Needs real billing and server-side gating before launch.
2. **Two day systems.** `PracticeEntry.day` and the streak-lapse check use UTC; `PracticeDay.day`, streak increments and the calendar use the browser's local date. Do not mix them; the +/-1 day tolerance in `addTime` exists because of this.
3. **Streak depends on timer seconds, not messages.** Sending messages gives XP but never extends the streak; 180 s of visible-tab time inside an open mode does.
4. **XP farming**: every Regenerate and every message gives +10 XP with no limit other than the 20 req/min throttle.
5. **`addTime` is not atomic** (read, upsert, update in separate calls); concurrent requests could double or skip a streak step.
6. **README is stale**: it lists three tables (there are four, `PracticeDay` is missing), omits `GET /progress/stats` and `POST /progress/time`, and suggests `migrate dev --name init` although migrations already exist.
7. **Native language** is stored in `Progress.nativeLanguage` (default English), set with the "My language" select on Home, and sent with every AI call. Translations, tips and feedback are written in it. Nothing stops it being the same as the target language.
8. **Language default mismatch**: DB default is Spanish, `ai.service.ts` fallback is Bengali (the frontend always sends the language, so this rarely shows).
9. **Duplicated types/constants** between `ai/dto.ts` and `lib/api.ts` (modes, generate types) and between backend and frontend for XP/streak constants. There is no shared package.
10. **JWT in localStorage** (README says to move to an httpOnly cookie before production). `/login` wipes the token.
11. **Loose typing**: controllers use `@Req() req: any`, AI JSON is `any`, backend `noImplicitAny` is off. Match existing style unless deliberately tightening.
12. **Free-model flakiness**: surface errors to users (the panels already show `ErrorText`); do not swallow them. Large `count` values for generate may produce truncated JSON at 1400 max tokens, which is handled by the retry then a 502.
13. **No mobile navigation** in the dashboard (see Shell and routing).
14. Call-mode speech works best in Chrome; other browsers show a typed-input fallback message.

## Working agreements for Claude

- Read the relevant file before editing; the code is compact and heavily interdependent (see Recipes).
- Prefer small, targeted diffs that follow the existing style (short one-line comments that explain why, no new dependencies without a reason).
- After backend changes run `npm run build` in `backend/`; after frontend changes run `npm run build` in `frontend/`. State clearly if you could not run them.
- Never commit secrets; `.env` and `.env.local` are git-ignored.
- Do not edit applied Prisma migrations or `package-lock.json` by hand.
