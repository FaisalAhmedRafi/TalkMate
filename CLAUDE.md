# CLAUDE.md

Guidance for working in this repository. Every source file in the project was read to write this.

## What this is

TalkMate is an AI language-practice web app (a Talkpal-style clone; the UI even says "in this clone"). A learner picks a target language and level, then practices in ten "modes": Chat, Call (voice), Sentence, Word, Dialogue, Roleplays, Characters, Debates, Photo and Flashcards. Practice earns XP, levels, streaks and achievements, and an LLM writes daily feedback.

**Sentence is not a modal like the others.** It is a guided course under `/sentence` (10 units x 3 skills): the AI writes 5 sentences for a skill, the learner hears them, reads them aloud, and gets a 1-5 pronunciation rating. See "Sentence Mode" below.

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

**OpenRouter free quota**: models ending in `:free` allow 20 requests/minute, and 50 requests/day unless the account has ever bought 10 credits (then 1,000/day). The limit is per account, so pinning another free model does not raise it. Every sentence set, pronunciation check, chat turn and feedback is one request. The backend logs OpenRouter's reason for each failure (`<model> -> 429 <reason>`).

Frontend `.env.local` (copy from `.env.local.example`): `NEXT_PUBLIC_API_URL=http://localhost:4000`.

## Repository map

```
backend/
  prisma/schema.prisma            5 models (below)
  prisma/migrations/
    20261007160943_init/          User, Progress, PracticeEntry
    20261013154234_practice_time/ PracticeDay
    20261015035243_sentence_mode/ SentenceProgress
    20261015073124_/              Progress.nativeLanguage (folder has no name suffix because --name was omitted; do not rename an applied migration)
  src/main.ts                     bootstrap, body limit, CORS, ValidationPipe
  src/app.module.ts               ConfigModule (global), Throttler, HealthController (GET /health)
  src/prisma/prisma.module.ts     global PrismaService (extends PrismaClient, connects on init)
  src/auth/                       controller, service, guard, dto, module
  src/progress/                   controller, service, dto, module (exports ProgressService)
  src/ai/                         controller, service, openrouter.service, prompts, dto, module (exports OpenRouterService)
  src/sentence/                   catalog, scoring, prompts, dto, service, controller, module (Sentence Mode)
frontend/
  app/layout.tsx, globals.css     root layout (title "TalkMate"), Tailwind directives
  app/page.tsx                    redirects to /dashboard
  app/login/page.tsx              login + register form
  app/dashboard/page.tsx          the app shell (client component)
  app/sentence/                   layout.tsx, page.tsx (unit list), [skillId]/page.tsx (skill intro), [skillId]/practice/page.tsx
  components/                     ChatPanel, GeneratePanel, PhotoPanel, ProgressView, PracticeTimer, Modal
  components/sentence/            SentenceProvider (auth, Premium gate, shared data), SentenceShell (sidebar + Logo)
  lib/api.ts, modes.ts, dates.ts  API client + types, mode/language constants, local-date helpers
  lib/speech.ts, sentence.ts      browser speech helpers; Sentence Mode helpers (session key, prefs, useSkillId)
```

## Backend in detail

### Bootstrap (`main.ts`)
- `bodyParser: false`, then `json({ limit: '6mb' })`. Needed for base64 photos (the DTO allows up to 5,000,000 chars).
- `trust proxy` = 1 (so throttling sees the real client IP behind one proxy).
- CORS allows only the origins in `FRONTEND_URL`.
- Global `ValidationPipe({ whitelist: true, transform: true })`: unknown properties are silently stripped, so a new request field **must** be added to the DTO or it will vanish.

### Rate limiting
Global `ThrottlerGuard`: 20 requests / 60 s per client. `AuthController` overrides with 10 / 60 s and `POST /sentence/evaluate` with 40 / 60 s (a session can retry a lot). This protects the free OpenRouter quota and password guessing.

### Auth (`src/auth`)
- `POST /auth/register`: email lowercased/trimmed, 409 if it exists, bcryptjs cost 10, creates `User` and an empty `Progress` in one nested create, returns `{ token, user: { id, email } }`.
- `POST /auth/login`: same error ("Invalid email or password.") for unknown email and wrong password. Keep it that way to avoid account enumeration.
- JWT: `JwtModule.registerAsync({ global: true })`, secret from `JWT_SECRET`, 7-day expiry, payload `{ sub, email }`. No refresh tokens.
- `AuthGuard` parses `Authorization: Bearer <token>` and sets `req.user = { id, email }`. Controllers read `req.user.id`.
- DTOs: register email max 254, password 8..72 (bcrypt ignores bytes past 72), name optional max 60. Login password max 72.

### Progress (`src/progress`)
Constants: `STUDY_SECONDS = 180`, `XP_PER_LEVEL = 50`. Dates in this file are **UTC** (`ymd = toISOString().slice(0,10)`).

- `snapshot(userId)` is what almost every endpoint returns: `{ email, xp, streak, longest, messages, premium, giftClaimed, language, nativeLanguage, level, today: string[] }`. `today` is the user's last 30 `PracticeEntry` texts for the UTC day, oldest first. If `lastDay` is more than 1 day before UTC today, `streak` is reported as 0 without writing to the DB.
- `practice(text)`: in one transaction, `xp += 10`, `messages += 1`, insert `PracticeEntry` (text truncated to 1000). Returns a snapshot.
- `addTime(seconds, day)`: `day` is the **browser's local date**. Rejected (400 "Invalid day") if more than 1 day away from UTC today. Upserts `PracticeDay` (increments seconds). Only when this call makes the day's total cross 180 seconds does the streak change: gap = days between `lastDay` and `day`; if `lastDay` is null or gap > 0, `streak = gap === 1 ? streak + 1 : 1`, `longest = max(...)`, `lastDay = day`.
- `stats()`: `{ totalSeconds, studiedDays (days >= 180s), activeDays (days > 0s), days: last 400 PracticeDay rows oldest-first, achievements }`.
- `settings(dto)`: updates `language` and `nativeLanguage` (any string up to 40 chars, not validated against the frontend list) and `level` (Beginner | Intermediate | Advanced). `ProgressModule` exports `ProgressService` because Sentence Mode calls `practice()`.
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
- `learner()` fallback defaults in `ai.service.ts`: target `Bengali`, native `English`, level `Beginner`. The dashboard now sends the learner's saved `nativeLanguage` (the "My language" select) with every call, so corrections, translations and feedback are written in it. `LearnerDto` in `ai/dto.ts` is exported and reused by the Sentence DTOs.
- `prompts.ts` is the single place for tutor behavior:
  - chat: friendly teacher, 2-4 short sentences in the target language, ends with a question, adds a `Correction:` line when needed.
  - call: 1-2 short sentences, **no emojis, markdown or lists** because the reply is read aloud by the browser.
  - roleplay: plays the other party in a scenario (default restaurant), adds `(Tip: ...)`.
  - characters: age-appropriate, stays in voice, must not claim to be the real person.
  - debate: user argues `for`/`against` (default `for`), AI takes the opposite side, respectful, one argument per turn.
  - generate prompts demand JSON only and embed the schemas above. Changing a schema means updating the prompt, `GeneratePanel` rendering and the response handling together.
- `OpenRouterService.complete()`: POST `https://openrouter.ai/api/v1/chat/completions` with `Authorization`, `X-Title: TalkMate`, 45 s timeout. Message content is text or `image_url` parts. For each model (primary, then fallbacks) up to 2 attempts: 200 with empty content moves to the next model; 401/402/403 throws 502 immediately ("Check your API key"); on other failures it reads OpenRouter's error text (`errorDetail`) and logs it. A 429 whose text mentions a daily limit throws 502 at once with a message saying today's free requests are used up (the quota is account-wide, so retrying or switching model cannot help). Other 429s and 5xx sleep 700 ms x attempt and retry; other statuses move on. Everything exhausted returns 502 "The free AI models are busy or rate limited." The service is exported from `AiModule` so Sentence Mode can use it.

### Sentence Mode (`src/sentence`)
All routes are behind `AuthGuard`. Nothing here checks `premium` (see gotcha 1).

- **Catalog** (`sentence.catalog.ts`): `SENTENCE_UNITS` = 10 units x 3 skills (`TOTAL_SKILLS` = 30). Skill ids are URL slugs (`basic-greetings`) and are the keys stored in `SentenceProgress`, so never rename one that users have progress on. Each skill has `title`, `description`, `emoji`. `findSkill(id)` looks one up.
- `GET /sentence/units` -> `{ percent, passed, total, units: [{ number, title, skills: [{ id, title, description, emoji, passed, bestScore, attempts }] }] }`. `percent` = passed skills / 30.
- `POST /sentence/session` `{ skillId, targetLanguage?, nativeLanguage?, level? }` -> `{ skillId, title, items: [{ sentence, translation, note }] }`. The prompt (`sessionSystem`) gives the unit, skill title and description, level-based length rules, and asks for exactly 5 distinct one-sentence lines, with `translation` and `note` in the native language. Up to 2 attempts; duplicates are dropped; 3 or more usable sentences are accepted; fewer returns 502.
- `POST /sentence/evaluate` `{ sentence, transcript, confidence?, ...learner }` -> `{ score 1-5, feedback, tip, heard, similarity, spaced, words: [{ text, ok }], source: 'ai' | 'fallback' }`. `transcript` is what the **browser's speech recogniser heard**; the AI never receives audio. Flow:
  1. `matchSpeech` (`sentence.scoring.ts`) aligns target and heard words with a longest-common-subsequence and returns per-word `ok` flags plus a Dice similarity. Comparison ignores case and punctuation, ignores accents on **Latin letters only** (marks on Bengali, Hindi, Arabic are real vowels and are kept), and compares character by character for Chinese and Japanese (`spaced: false`).
  2. `anchorScore` maps similarity (blended 85/15 with the recogniser's confidence when given) to 1-5: >= 0.95 is 5, >= 0.8 is 4, >= 0.6 is 3, >= 0.35 is 2, else 1.
  3. The AI (`evaluateSystem`, temperature 0.3) returns `score`, `feedback`, `tip`; the score is clamped to within 1 point of the anchor (`clampScore`) so a weak free model cannot invent a wild rating.
  4. If the AI fails or returns unreadable JSON, the anchor score and a canned English message are returned with `source: 'fallback'`. A missing API key (503) is rethrown instead.
- `POST /sentence/complete` `{ skillId, scores: 1-5 ints (1..5 of them) }` -> `{ average, passed, percent, progress }`. Average is rounded to 1 decimal; `PASS_SCORE = 3` (exported from `sentence.service.ts`). Upserts `SentenceProgress` (keeps the best score, counts attempts, once `passed` stays `passed`) and calls `ProgressService.practice("Sentence Mode: <skill> (<avg>/5)")`, so each finished session gives +10 XP and a line in the daily feedback input.
- Sentence generation costs 1 AI request and each pronunciation check 1 more, so one session is roughly 6-12 requests of the free quota.

### Database (`prisma/schema.prisma`)
- `User(id cuid, email unique, name?, passwordHash, createdAt)`.
- `Progress(userId PK -> User, xp, streak, longest, messages, lastDay "YYYY-MM-DD"?, premium, giftClaimed, language default "Spanish", level default "Beginner", nativeLanguage default "English", updatedAt)`.
- `PracticeEntry(id cuid, userId, day "YYYY-MM-DD" (UTC), text, createdAt)`, index on `(userId, day)`.
- `PracticeDay(userId, day "YYYY-MM-DD" (browser local), seconds)`, composite PK `(userId, day)`.
- `SentenceProgress(userId, skillId, bestScore Float, lastScore Float, attempts, passed, updatedAt)`, composite PK `(userId, skillId)`; `skillId` must match an id in `sentence.catalog.ts`.
- All child relations `onDelete: Cascade`. Dates are stored as strings, not `DateTime`.
- Never edit an applied migration. Change the schema, then run `npx prisma migrate dev --name <change>` and commit the generated folder.

## Frontend in detail

### Shell and routing
- `/` redirects to `/dashboard`. `/login` toggles between login and register and **clears the token on mount**, so visiting it logs you out.
- `app/dashboard/page.tsx` (client component) holds all state: `Progress` snapshot `s`, active tab, open mode, upsell/feedback/account modals, toast. It redirects to `/login` if there is no token, loads `/progress`, and shows a retry screen on failure.
- Sidebar tabs: Home, Courses, Explore, Premium, Progress. Courses and Explore render a "This section isn't built yet" placeholder; Premium opens the upsell modal. The sidebar is `hidden md:flex`, so **on screens below `md` there is no navigation** (no way to reach Progress, Account or the gift). Fix this if mobile matters.
- The sidebar logo is a button: it returns to the Home tab, closes any open mode and pushes `/dashboard`. On Sentence Mode pages the shared `Logo` is a link to `/dashboard`. The dashboard also honours `?tab=progress` on load (the Sentence sidebar's Progress link uses it).
- Home has three selects: **My language** (`nativeLanguage`, what translations and feedback are written in), the language being learned, and level. All PATCH `/progress/settings`.
- Home lists `MODES` from `lib/modes.ts`. Only Chat is free; the other 9 show a lock and open the upsell modal unless `s.premium`. The upsell button calls the demo `POST /progress/premium`. Language and level selects update state optimistically and PATCH `/progress/settings`.
- Mode routing in the dashboard uses hard-coded id arrays: chat/call/roleplay/characters/debate -> `ChatPanel`; word/dialogue/flashcards -> `GeneratePanel`; photo -> `PhotoPanel`. **Sentence is the exception**: `clickMode` does `router.push("/sentence")` (after the Premium check) instead of opening a modal. The `"sentence"` entries left in the `GeneratePanel` array and generate types are legacy and unreachable from Home. `FeedbackModal` (defined at the bottom of the dashboard file) calls `/ai/feedback` with `s.today`.
- `PracticeTimer` is mounted **only while a mode modal is open, or inside `/sentence/*`** (`SentenceProvider` mounts it), so practice time is counted only inside a mode.

### `lib/api.ts`
Single API client. `BASE` = `NEXT_PUBLIC_API_URL`. Token key `talkmate-token` in `localStorage`. `request()` adds the Bearer header, turns network failure into "Can't reach the server...", flattens Nest validation message arrays, and on any 401 (when a token existed) clears it and hard-redirects to `/login`. `keepalive` is used for the final timer flush on unmount. Exports types `Msg`, `ChatMode`, `GenerateType`, `Learner` (`targetLanguage`, `level`, optional `nativeLanguage`), `Progress` (now includes `nativeLanguage`), `Stats`, `Achievement`, the Sentence types (`SentenceUnits`, `SentenceSkill`, `SentenceItem`, `PronunciationResult`), and the `api` object, including `api.sentence.{units, session(skillId, learner), evaluate, complete}`.

### Components
- `ChatPanel`: message list, text input, and (Call mode) a mic button using `SpeechRecognition`/`webkitSpeechRecognition` (Chrome-first) and `speechSynthesis` to read replies aloud, with the language mapped through `SPEECH_LANG`. Sends the last 20 messages. Always sends the full `context` object (scenario, character, topic, stance) regardless of mode. Changing scenario/character/topic/stance clears the conversation. After each successful reply it calls `onPractice(userText)`, which logs the learner's message and awards 10 XP. Scenario, character and topic option lists are constants at the top of the file.
- `GeneratePanel`: topic input with per-type default, "Generate"/"Regenerate", renders list / dialogue bubbles / flip-card carousel. On each successful generation it calls `onPractice("Studied <mode>: <topic>")`, so every (re)generate gives +10 XP and adds a line to the daily feedback input.
- `PhotoPanel`: client-side resize to max 800 px JPEG (quality 0.8) via canvas, then POST. Only logs practice when the learner typed a description.
- `ProgressView`: fetches `/progress/stats` (refetches when `s.messages` or `s.streak` change). Cards for Stats, streak, a 1- or 5-week calendar (a day is "studied" at >= 180 s), an inline-SVG `AreaChart` (7 / 28 days / all time), level bar, Share (navigator.share or clipboard), a Certificates placeholder ("Courses not built yet"), and Achievements (first 4 unlocked, "See all" modal). `ICONS` maps achievement ids to lucide icons.
- `components/sentence/SentenceProvider.tsx`: wraps every `/sentence/*` page. Redirects to `/login` without a token and to `/dashboard` when `premium` is false (UI-only gate), loads `/progress` and `/sentence/units` once, mounts `PracticeTimer`, and exposes `useSentence()` = `{ progress, units, unitsError, reloadUnits }`.
- `components/sentence/SentenceShell.tsx`: fixed sidebar (Home, Progress, Log out; hidden below `md`) plus a centred column with a back link, and the exported `Logo`.
- `Modal.tsx` exports `Modal` (backdrop click and Escape close, `wide` prop), `Select` and `ErrorText`.
- `PracticeTimer`: renders nothing; counts 1 s ticks while `document.visibilityState === "visible"`, flushes every 30 s (capped at 60 s per request) and once on unmount, calling `api.progress.time(seconds, localDay())`.
- `lib/dates.ts`: local-date helpers (`ymd`, `localDay`, `parseDay`, `addDays`, `startOfWeek` = Monday, `shortDate`).
- `lib/modes.ts`: `MODES` (id, title, desc, emoji, premium), `LANGUAGES` (12), `LEVELS`, `SPEECH_LANG`.
- `lib/speech.ts`: browser-only helpers: `supportsSpeechRecognition`, `createRecognition(lang)` (interim results, not continuous), `speak(text, lang, rate, onEnd)`, `hasVoiceFor(lang)`, `cancelSpeech`.
- `lib/sentence.ts`: `useSkillId()` (reads the id from the URL path, so it works even if the folder is not named exactly `[skillId]`), `sessionKey(skillId, language, level, native)`, `loadPrefs`/`savePrefs`, `SCORE_LABEL`, `PASS_SCORE`.

### Sentence Mode pages (`app/sentence`)
Flow: Home -> `/sentence` -> `/sentence/<skillId>` -> `/sentence/<skillId>/practice`. All three share `SentenceProvider` via `app/sentence/layout.tsx`.

- `/sentence`: unit list with a progress pill from `percent`; each skill row links to its page and shows a check and best score when passed.
- `/sentence/<skillId>`: intro card (emoji tile, description, language, level, translation language, best score) and **Start**. Start deletes the saved session for this skill so it always gets fresh sentences.
- `/sentence/<skillId>/practice` (full screen, no sidebar):
  - Loads a session from `sessionStorage` (key `talkmate-sentence:<skill>:<language>:<level>:<native>`) or calls `api.sentence.session`. The state `{ items, idx, results }` is saved on every change so a refresh keeps the same sentences, and removed when the session finishes. The native language is in the key so changing "My language" never reuses old translations.
  - Top bar: speaker toggle (auto-play audio), settings (slow speech, show translation; saved in `localStorage` `talkmate-sentence-prefs`), close. Progress bar with an `n / total` marker.
  - Card: **Replay** (browser `speechSynthesis`, `SPEECH_LANG[language]`), **Explain** (shows the AI `note`). Auto-plays each sentence unless turned off.
  - Mic: browser `SpeechRecognition` (live transcript, ends on pause) -> `api.sentence.evaluate`. The sentence is then coloured word by word (green matched, red missed), with stars, feedback, tip, and "We heard: ...". **Try again** clears the result; **Next/Finish** advances; **Skip** records the sentence as skipped (not scored).
  - Finishing calls `api.sentence.complete` with the scores of non-skipped sentences (nothing is saved if all were skipped) and shows a summary with Practise again / Back to units, then reloads the unit list.
  - Warns when the browser has no voice for the language (`hasVoiceFor`) or no speech recognition.

### Styling and TypeScript
Tailwind utility classes only (`globals.css` is just the three directives). Dark theme: page `bg-[#16161c]`, cards `bg-[#1f1f27]`, indigo-600 primary, pink accents for premium, `white/10` surfaces. Keep new UI consistent with this. `tsconfig` is `strict`; path alias `@/*` = frontend root. Client components start with `"use client"`. Frontend uses double quotes and 2-space indent; backend uses single quotes.

## Recipes

**Add a chat-style mode**: add the id to `CHAT_MODES` in `backend/src/ai/dto.ts`; add a `case` to `chatSystem` in `prompts.ts` (the switch has no default, so TypeScript will flag a missing case); add the id to `ChatMode` in `frontend/lib/api.ts`; add an entry to `MODES` in `lib/modes.ts`; add the id to the chat array in `dashboard/page.tsx`; add any selector UI in `ChatPanel`.

**Add a generate type**: `GENERATE_TYPES` in `dto.ts`, a `case` in `generateSystem`, `GenerateType` and `DEFAULT_TOPIC` in the frontend, a render block in `GeneratePanel`, a `MODES` entry, and the dashboard id array.

**Add an achievement**: append to `ACHIEVEMENTS` in `progress.service.ts` (add new facts to the `Facts` type and `stats()` if needed) and add an icon to `ICONS` in `ProgressView.tsx`.

**Change XP, level size or the study threshold**: `XP_PER_LEVEL` lives in `progress.service.ts`, `dashboard/page.tsx` and `ProgressView.tsx`; `STUDY_SECONDS` lives in `progress.service.ts` and `ProgressView.tsx`. Change all copies.

**Add or change a Sentence Mode skill**: edit `SENTENCE_UNITS` in `backend/src/sentence/sentence.catalog.ts` (no DB change). Add new skills with new ids; renaming or deleting an id orphans users' `SentenceProgress` rows and drops them from the percentage.

**Change the Sentence Mode pass mark or scoring**: `PASS_SCORE` is in `sentence.service.ts` **and** `frontend/lib/sentence.ts`; the similarity-to-score thresholds are in `anchorScore` (`sentence.scoring.ts`); prompts are in `sentence.prompts.ts`.

**Add an API field**: DTO (validators) -> service -> `lib/api.ts` types/helpers -> callers. Remember `whitelist: true` drops undeclared fields.

## Known issues and gotchas

1. **Premium is only enforced in the UI.** Backend `/ai/*` routes never check `premium`, and `/progress/premium` unlocks any logged-in user. Needs real billing and server-side gating before launch.
2. **Two day systems.** `PracticeEntry.day` and the streak-lapse check use UTC; `PracticeDay.day`, streak increments and the calendar use the browser's local date. Do not mix them; the +/-1 day tolerance in `addTime` exists because of this.
3. **Streak depends on timer seconds, not messages.** Sending messages gives XP but never extends the streak; 180 s of visible-tab time inside an open mode does.
4. **XP farming**: every Regenerate and every message gives +10 XP with no limit other than the 20 req/min throttle.
5. **`addTime` is not atomic** (read, upsert, update in separate calls); concurrent requests could double or skip a streak step.
6. **README is stale**: it lists three tables (there are five), omits `GET /progress/stats`, `POST /progress/time` and everything about Sentence Mode, and suggests `migrate dev --name init` although migrations already exist.
7. **Native language** is stored in `Progress.nativeLanguage` (default English), set with the "My language" select on Home, and sent with every AI call. Translations, tips and feedback are written in it. Nothing stops it being the same as the target language.
8. **Language default mismatch**: DB default is Spanish, `ai.service.ts` fallback is Bengali (the frontend always sends the language, so this rarely shows).
9. **Duplicated types/constants** between `ai/dto.ts` and `lib/api.ts` (modes, generate types) and between backend and frontend for XP/streak constants. There is no shared package.
10. **JWT in localStorage** (README says to move to an httpOnly cookie before production). `/login` wipes the token.
11. **Loose typing**: controllers use `@Req() req: any`, AI JSON is `any`, backend `noImplicitAny` is off. Match existing style unless deliberately tightening.
12. **Free-model flakiness**: surface errors to users (the panels already show `ErrorText`); do not swallow them. Large `count` values for generate may produce truncated JSON at 1400 max tokens, which is handled by the retry then a 502.
13. **No mobile navigation** in the dashboard (see Shell and routing).
14. Call-mode speech works best in Chrome; other browsers show a typed-input fallback message.
15. **Sentence Mode trusts the browser.** `POST /sentence/complete` accepts whatever scores the client sends, so a user can fake a pass. Premium is not checked on `/sentence/*` either (extends gotcha 1).
16. **Pronunciation is judged on browser speech-to-text, not on audio.** Recognition quality varies by browser and language (Bengali is weaker in Chrome's recogniser), so a correctly spoken word can be marked wrong. Replay uses the browser's installed voices: Chrome has no Bengali voice (the page shows a warning); Edge ships natural online voices. An audio-capable model or server-side text-to-speech would fix this but was deliberately not added.
17. **Free-quota burn.** A Sentence session costs roughly 6-12 OpenRouter requests, so the 50/day free cap can run out after a few sessions (see Environment variables). Starting a skill always generates new sentences; nothing is cached server-side.
18. **`PASS_SCORE` is duplicated** in `sentence.service.ts` and `frontend/lib/sentence.ts`.
19. **Legacy `sentence` generate type**: still supported by `/ai/generate` and `GeneratePanel`, but Home no longer opens it.
20. **Unnamed migration folder**: `20261015073124_` (the nativeLanguage column). Applied migrations must not be renamed.

## Working agreements for Claude

- Read the relevant file before editing; the code is compact and heavily interdependent (see Recipes).
- Prefer small, targeted diffs that follow the existing style (short one-line comments that explain why, no new dependencies without a reason).
- After backend changes run `npm run build` in `backend/`; after frontend changes run `npm run build` in `frontend/`. State clearly if you could not run them.
- Never commit secrets; `.env` and `.env.local` are git-ignored.
- Do not edit applied Prisma migrations or `package-lock.json` by hand.
