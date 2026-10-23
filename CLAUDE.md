# CLAUDE.md

Guidance for working in this repository. Every source file in the project was read to write this.

## What this is

TalkMate is an AI language-practice web app (a Talkpal-style clone; the UI even says "in this clone"). A learner picks a target language and level, then practices in ten "modes": Chat, Call (voice), Sentence, Word, Dialogue, Roleplays, Characters, Debates, Photo and Flashcards. Practice earns XP, levels, streaks and achievements, and an LLM writes daily feedback.

**Sentence, Word, Dialogue, Roleplays and Flashcards are not modals like the other modes.** All are page-based. Dialogue (`/dialogue`, 21 topics): a picture grid of topics, a topic intro page with Start, then a practice screen where a partner speaks a line and the learner reads their answer aloud for a 1-5 rating (backend `src/dialogue`: catalog, prompts, in-memory script cache, `GET /dialogue/topics`, `POST /dialogue/session`, `POST /dialogue/complete`; progress in `DialogueProgress` (best score, attempts, passed; check badge on the grid); pronunciation reuses `/sentence/evaluate`; the old `GeneratePanel` dialogue type is now legacy). Sentence (`/sentence`, 10 units x 3 skills): the AI writes 5 sentences for a skill, the learner hears them, reads them aloud, and gets a 1-5 pronunciation rating. Word (`/word`, 10 units x 12 stars): each star is one word with a photo, then 3 sentences made from the word, rated the same way, and an unfinished lesson can be resumed. Flashcards (`/flashcards`, 18 topics x 15 cards): a topic grid, then a full-screen deck where the learner sees a photo, the word, its sound and an example sentence and marks each card "Learning" or "I know it"; marked cards feed a Daily review. Roleplays (`/roleplay`, 24 scenarios): a picture grid with a category pill, an intro page (Scenario, Your tasks, Start), then a chat where the AI plays the other person and a side panel reviews each learner message (see "Roleplay Mode"). See "Sentence Mode", "Word Mode" and "Flashcards Mode" below.

**Characters is page-based too** (`/characters`, 30 characters): a portrait grid, a character intro page with Start, then a full-screen chat where the character speaks the learner's language and a right-hand panel reviews each learner message (backend `src/characters`; conversations are saved per user, character and language). See "Characters Mode" below.

**Call is page-based too** (`/call`, one full-screen page): a phone call with the teacher Kai, a right-hand panel that reviews what the learner said, and an "Advanced feedback" button (backend `src/call`; see "Call Mode" below). The old modal call in `ChatPanel` is now legacy.

**Photo is page-based too** (`/photo`, 2 units x 8 stars): a star grid, then a full-screen page with a picture and a text/mic box where the AI judges the learner's description (see "Photo Mode" below). The old `PhotoPanel` upload modal is now legacy.

**Explore is a dashboard tab too** (frontend only, no backend or DB change): today's picks for every mode, chosen from the lists the mode pages already load. See "Explore" below.

**Courses and Learn are dashboard tabs** (frontend only, no backend or DB change): Courses is a grid of 32 courses, and picking one makes it the selected course and opens Learn, a learning path of units whose three exercises open Word, Sentence and Dialogue Mode. See "Courses and Learn" below.

**Account is a dashboard tab**, not a modal: target language, Personalization answers, demo Subscriptions and Refer-a-friend. See "Account" below. There is no real billing.

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
| `PIXABAY_API_KEY` | no | free key from pixabay.com/api/docs (Pexels has paused new keys). Preferred photo source: each picture is downloaded once to `backend/media/pixabay/<id>.jpg` (git-ignored) and served by the API at `/media/pixabay/<id>.jpg`, because Pixabay URLs expire after 24 h and hotlinking is not allowed |
| `PUBLIC_API_URL` | no | public base URL of the API, used to build the `/media/...` photo URLs; default `http://localhost:<PORT>`. Set it when the API is not on localhost |
| `PEXELS_API_KEY` | no | fallback when there is no Pixabay key (existing keys only; new ones are paused); gives each Word Mode word and each Flashcards topic and card a stock photo. Without it the app shows an emoji (Word Mode) or an emoji on a gradient (Flashcards) |
| `FRONTEND_URL` | no | comma-separated CORS origins, default `http://localhost:3000` |
| `PORT` | no | default 4000, binds `0.0.0.0` |

**OpenRouter free quota**: models ending in `:free` allow 20 requests/minute, and 50 requests/day unless the account has ever bought 10 credits (then 1,000/day). The limit is per account, so pinning another free model does not raise it. Every sentence set, pronunciation check, chat turn and feedback is one request. The backend logs OpenRouter's reason for each failure (`<model> -> 429 <reason>`).

Frontend `.env.local` (copy from `.env.local.example`): `NEXT_PUBLIC_API_URL=http://localhost:4000`.

## Repository map

```
backend/
  prisma/schema.prisma            9 models (below)
  prisma/migrations/
    20261007160943_init/          User, Progress, PracticeEntry
    20261013154234_practice_time/ PracticeDay
    20261015035243_sentence_mode/ SentenceProgress
    20261015073124_/              Progress.nativeLanguage (folder has no name suffix because --name was omitted; do not rename an applied migration)
    20261017110133_/              Account: User referral columns, Personalization, Subscription (also unnamed)
    20261019103226_word_mode/     WordProgress
    20261019120754_flashcards/    FlashcardDeck
    20261020120000_dialogue_mode/ DialogueProgress
    20261020130000_characters_mode/ CharacterSession
    20261021090000_photo_mode/    PhotoProgress
    20261020120000_roleplay_mode/ RoleplaySession (hand-written to match what `prisma migrate dev` generates; run `npx prisma migrate dev` to apply it)
  src/main.ts                     bootstrap, body limit, CORS, ValidationPipe
  src/app.module.ts               ConfigModule (global), Throttler, HealthController (GET /health)
  src/prisma/prisma.module.ts     global PrismaService (extends PrismaClient, connects on init)
  src/auth/                       controller, service, guard, dto, module
  src/progress/                   controller, service, dto, module (exports ProgressService)
  src/ai/                         controller, service, openrouter.service, prompts, dto, module (exports OpenRouterService)
  src/sentence/                   catalog, scoring, prompts, dto, service, controller, module (Sentence Mode)
  src/account/                    controller, service, dto, options (Personalization questions), subscription.util, module
  src/word/                       catalog, prompts, dto, images (Pexels), service, controller, module (Word Mode; exports WordImageService)
  src/flashcard/                  catalog, prompts, dto, service, controller, module (Flashcards Mode; reuses WordImageService)
  src/characters/                 catalog, prompts, dto, service, controller, module (Characters Mode)
  src/roleplay/                   catalog, prompts, dto, service, controller, module (Roleplay Mode; reuses WordImageService)
  src/photo/                      catalog, prompts, dto, service, controller, module (Photo Mode)
  src/call/                       prompts, dto, service, controller, module (Call Mode; no database tables)
frontend/
  app/layout.tsx, globals.css     root layout (title "TalkMate"), Tailwind directives
  app/page.tsx                    redirects to /dashboard
  app/login/page.tsx              login + register form
  app/dashboard/page.tsx          the app shell (client component)
  app/sentence/                   layout.tsx, page.tsx (unit list), [skillId]/page.tsx (skill intro), [skillId]/practice/page.tsx
  components/                     ChatPanel, GeneratePanel, PhotoPanel, ProgressView, PracticeTimer, Modal, CoursesView, LearnView
  components/sentence/            SentenceProvider (auth, Premium gate, shared data), SentenceShell (sidebar + Logo)
  components/account/             AccountView (menu), PersonalizationView, SubscriptionView, ReferView, SubPage (shared header)
  components/word/                WordProvider (auth, Premium gate, star grid data)
  components/PronunciationReview  Stars, ColoredSentence, Review (shared by Word Mode)
  app/word/                       layout.tsx, page.tsx (star grid), [wordId]/page.tsx (the lesson)
  lib/api.ts, modes.ts, dates.ts  API client + types, mode/language constants, local-date helpers
  lib/courses.ts                  COURSES (32), the learning path of each course (pathFor), selected-course storage (see Courses and Learn)
  lib/speech.ts, sentence.ts      browser speech helpers; Sentence Mode helpers (session key, prefs, useSkillId)
  lib/word.ts, usePronunciation.ts  Word Mode helpers (useWordId, nextWordId); mic -> rating hook
  components/flashcards/          FlashcardsProvider (auth, Premium gate, PracticeTimer, topic grid data)
  app/flashcards/                 layout.tsx, page.tsx (topic grid), [topicId]/page.tsx (the deck; topicId "review" = Daily review)
  lib/flashcards.ts               useTopicId()
  components/characters/          CharactersProvider (auth, Premium gate, PracticeTimer, character grid data), CharacterPortrait, ReviewPanels (ReviewBadge, FeedbackEmpty, FeedbackList)
  app/characters/                 layout.tsx, page.tsx (grid), [characterId]/page.tsx (intro), [characterId]/practice/page.tsx (chat)
  lib/characters.ts               useCharacterId(), intro texts, portrait helpers
  public/characters/              optional portrait images <id>.jpg (see Characters Mode)
  components/roleplay/            RoleplayProvider (auth, Premium gate, PracticeTimer, scenario grid data), Feedback (ReviewBadge, FeedbackEmpty, FeedbackList)
  app/roleplay/                   layout.tsx, page.tsx (scenario grid), [scenarioId]/page.tsx (intro), [scenarioId]/practice/page.tsx (the chat)
  lib/roleplay.ts                 useRoleplayId(), ROLEPLAY_INTRO
  components/photo/               PhotoProvider (auth, Premium gate, PracticeTimer, star grid data)
  app/photo/                      layout.tsx, page.tsx (unit/star grid), [photoId]/page.tsx (picture + description + AI feedback)
  lib/photo.ts                    usePhotoId(), nextPhotoId(), imageToDataUrl()
  components/call/                CallProvider (auth, Premium gate, PracticeTimer)
  app/call/                       layout.tsx, page.tsx (the whole call screen: Kai, timer, controls, review panel, Advanced feedback)
  public/call/kai.svg             Kai's avatar (a drawn placeholder; overwrite it or point `KAI_IMG` in `app/call/page.tsx` at your own portrait)
  public/photo/                   the 16 pictures 1.jpg ... 16.jpg (added by hand, see Photo Mode)
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
- `POST /auth/register`: email lowercased/trimmed, 409 if it exists, bcryptjs cost 10, creates `User` and an empty `Progress` in one nested create, returns `{ token, user: { id, email } }`. An optional `referralCode` (4-12 letters/digits, upper-cased before lookup) links the new user to the inviter through `User.referredById`; an unknown code is silently ignored so a typo never blocks sign-up.
- `POST /auth/login`: same error ("Invalid email or password.") for unknown email and wrong password. Keep it that way to avoid account enumeration.
- JWT: `JwtModule.registerAsync({ global: true })`, secret from `JWT_SECRET`, 7-day expiry, payload `{ sub, email }`. No refresh tokens.
- `AuthGuard` parses `Authorization: Bearer <token>` and sets `req.user = { id, email }`. Controllers read `req.user.id`.
- DTOs: register email max 254, password 8..72 (bcrypt ignores bytes past 72), name optional max 60. Login password max 72.

### Progress (`src/progress`)
Constants: `STUDY_SECONDS = 180`, `XP_PER_LEVEL = 50`. Dates in this file are **UTC** (`ymd = toISOString().slice(0,10)`).

- `snapshot(userId)` is what almost every endpoint returns: `{ email, xp, streak, longest, messages, premium, giftClaimed, language, nativeLanguage, level, today: string[] }`. `today` is the user's last 30 `PracticeEntry` texts for the UTC day, oldest first. If `lastDay` is more than 1 day before UTC today, `streak` is reported as 0 without writing to the DB.
- `snapshot()` first calls `syncPremium`, one extra query on every endpoint that returns a snapshot (see Account).
- `practice(text)`: in one transaction, `xp += 10`, `messages += 1`, insert `PracticeEntry` (text truncated to 1000). Returns a snapshot.
- `addTime(seconds, day)`: `day` is the **browser's local date**. Rejected (400 "Invalid day") if more than 1 day away from UTC today. Upserts `PracticeDay` (increments seconds). Only when this call makes the day's total cross 180 seconds does the streak change: gap = days between `lastDay` and `day`; if `lastDay` is null or gap > 0, `streak = gap === 1 ? streak + 1 : 1`, `longest = max(...)`, `lastDay = day`.
- `stats()`: `{ totalSeconds, studiedDays (days >= 180s), activeDays (days > 0s), days: last 400 PracticeDay rows oldest-first, achievements }`.
- `settings(dto)`: updates `language` and `nativeLanguage` (any string up to 40 chars, not validated against the frontend list) and `level` (Beginner | Intermediate | Advanced). `ProgressModule` exports `ProgressService` because Sentence Mode calls `practice()`.
- `unlockPremium()`: demo only. It now calls `startSubscription` (account module), which creates or restarts a 1-month **demo subscription**, sets `premium = true`, and pays out a pending referral reward. It still works for any logged-in user.
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
  - call: **legacy** `/ai/chat` mode (1-2 short sentences, no emojis, markdown or lists because the reply is read aloud). Home now opens the page-based Call Mode, which has its own prompts in `src/call/call.prompts.ts`.
  - roleplay: plays the other party in a scenario (default restaurant), adds `(Tip: ...)`. **Legacy**: Home now opens the page-based Roleplay Mode, which has its own prompts in `src/roleplay`.
  - characters: no longer a `/ai/chat` mode. Its prompts live in `src/characters/characters.prompts.ts` (see Characters Mode).
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

### Word Mode (`src/word`)
All routes are behind `AuthGuard`. Nothing here checks `premium` (see gotcha 1).

- **Catalog** (`word.catalog.ts`): `WORD_UNITS` = 10 units x 12 words (`TOTAL_WORDS` = 120). Each entry is an **English concept** with an emoji and a photo search term (`photo` defaults to the English word without a leading "to"). The AI turns the concept into the word in the learner's language, so one list serves every language. Word ids are URL slugs (`friend`, `to-laugh`, `train-station`) and the keys stored in `WordProgress`; never rename one with progress on it. Unit titles are only prompt context; the UI shows "Unit N".
- `GET /word/units` -> `{ language, percent, passed, total, units: [{ number, title, words: [{ id, emoji, passed, bestScore, inProgress }] }] }`. `language` is `Progress.language`, and only rows for that language count, so progress is **per language** (German "friend" and French "friend" are separate lessons). `inProgress` means a row exists and `finished` is false; that is what makes the frontend show the resume popup.
- `POST /word/start` `{ wordId, targetLanguage?, nativeLanguage?, level?, restart? }` -> `{ wordId, emoji, word, translation, sentences: [{ sentence, translation, note, chunks: [{ text, meaning, explanation }] }], step, scores, resumed, image }`.
  - If an unfinished row with a valid saved lesson exists and `restart` is not true, it returns that saved lesson at the saved `step`/`scores` with `resumed: true` and **no AI call**.
  - Otherwise it asks the AI (one request, `lessonSystem`, temperature 0.7, up to 2 attempts, 2 or 3 sentences accepted, fewer returns 502), fetches the photo in parallel, upserts the row (`step 0`, `scores []`, `finished false`) and returns `resumed: false`. A finished row is treated like no row, so opening a finished word makes a fresh lesson while keeping `passed` and `bestScore`.
  - The prompt asks for `word` (with the article for languages that have one; verbs in the infinitive), its `translation` in the native language, and 3 sentences, each with `translation`, `note` and 2-3 `chunks` for the "Explain" popup. Output is validated and trimmed (`parseLesson`); chunks are optional.
- `PATCH /word/lesson` `{ wordId, language, step 0-5, scores }` saves the position after every move. Scores are cleaned by `cleanScores` (integers 1-5 or `null`, at most the number of sentences). It is ignored if the row is missing or finished. Errors on the client are swallowed, so a failed save only loses the latest step.
- `POST /word/complete` `{ wordId, language, scores }` -> `{ average, passed, percent, progress }`. Average of the non-null scores rounded to 1 decimal; `passed` needs at least one score and `average >= PASS_SCORE` (imported from `sentence.service.ts`). Upserts the row (`finished true`, `step` = sentence count, best score kept, `passed` once true stays true, `attempts` + 1) and calls `ProgressService.practice("Word Mode: <english> (<avg>/5)")` for +10 XP. If every sentence was skipped the run is closed but nothing is scored or rewarded.
- **Pronunciation is not duplicated**: the lesson page calls the existing `POST /sentence/evaluate` (same word-match + AI rating flow, same 40/min throttle).
- **Photos** (`word.images.ts`, `WordImageService`): tries Pixabay first (`PIXABAY_API_KEY`: search `hits[0]`, download `webformatURL` to `media/pixabay`, query -> picture index in `media/pixabay/index.json`, served from `/media/` by `main.ts`), then Pexels. The Pexels path: when `PEXELS_API_KEY` is set, `GET https://api.pexels.com/v1/search?query=<photo>&per_page=1&orientation=landscape` with the key in `Authorization`; uses `src.large`, `photographer` and the photo `url` for the credit. Cached in memory for the life of the process; failures (non-2xx, timeout after 6 s) are not cached and return `null`, so the UI falls back to the emoji.
- Cost: a new lesson is 1 AI request, each pronunciation attempt 1 more, a resume 0.

### Flashcards Mode (`src/flashcard`)
All routes are behind `AuthGuard`. Nothing here checks `premium` (see gotcha 1). `FlashcardModule` imports `AiModule`, `ProgressModule` and `WordModule` (which exports `WordImageService` for the photos).

- **Catalog** (`flashcard.catalog.ts`): `FLASH_TOPICS` = 18 topics (People, Colors, Family, Basic actions, Day and night, Drinks, Food, Animals, Numbers, Clothes, Body, Weather, Places, Transport, Home, Feelings, Jobs, School), `CARDS_PER_DECK` = 15. Each topic has `id` (URL slug, also the key stored in `FlashcardDeck`), `title`, `emoji`, `photo` (search text for the topic's cover) and `hint` (prompt context). Never rename an id that users have a deck for. Like Word Mode, the topics are language-neutral: the AI writes the words in the learner's language.
- **Decks are per user, topic and language** (`FlashcardDeck`). A deck is written once by the AI, with a photo per card, and then **saved**, so the same words come back and the marks stay attached to them.
- `GET /flashcards/topics` -> `{ language, reviewCount, topics: [{ id, title, emoji, total, known, completed, cover }] }`. `language` is `Progress.language`, and only decks in that language count. `total` is the saved card count (15 when there is no deck yet), `known` counts cards with status `known`, `completed` = a deck exists and every card is known, `cover` is a Pexels photo URL or null. `reviewCount` = cards marked learning or flagged across all decks, capped at 15. One request looks up 18 cover photos in parallel (in-memory cached, key `flash-cover:<id>`).
- `POST /flashcards/deck` `{ topicId, restart?, targetLanguage?, nativeLanguage?, level? }` -> `{ topicId, title, emoji, cards: [{ topicId, index, term, translation, example, exampleTranslation, image, status, flagged }] }`. 404 for an unknown topic.
  - A saved deck is returned with no AI call unless `restart` is true (the "New words" button).
  - Otherwise `generate()` asks the AI for the cards: up to 3 attempts (temperature 0.6, 2600 max tokens); later attempts only ask for what is still missing (plus 2 spare) and pass the terms already collected as an exclude list; duplicates are dropped case-insensitively; cards without a term or a translation are dropped. **Fewer than `MIN_CARDS` (10) usable cards returns 502** "unreadable deck"; 10 to 14 is accepted, so a deck can be shorter than 15.
  - It then fetches a Pexels photo per card in parallel (`image` is `{ url, credit, creditUrl }` or null; cached under `flash:<photo text>`), and upserts the row with every status `new` and every flag false. **Restarting resets the marks for that topic.**
  - Prompt (`deckSystem` in `flashcard.prompts.ts`): `term` is the dictionary form with its article for languages that use one (verbs in the infinitive), `translation` is 1-3 words in the native language, `example` is ONE sentence that uses the word (no numbering, quotes, emojis, romanization or brackets), `exampleTranslation`, and `photo` (2-4 English words for a concrete stock photo). Example length and word difficulty follow the level (`LENGTH`). Schema: `{ cards: [{ term, translation, example, exampleTranslation, photo }] }`.
- `GET /flashcards/review` -> the same shape as a deck, with `topicId: 'review'`, `title: 'Daily review'`, plus `language`. It collects every card marked `learning` or flagged, walking the topics in catalog order and stopping at 15 (`REVIEW_MAX`). Each card keeps its own `topicId` and `index` so marks go back to the right deck.
- `PATCH /flashcards/mark` `{ topicId, language, index (0..49), status?: 'learning' | 'known', flagged? }` -> `{ ok: true }`. Sets the card's status and/or flag. Marking a card `known` also clears its flag unless `flagged` is sent in the same call. A missing deck or an index past the end is silently ignored (still `ok`). Throttle 120 / 60 s because it fires on every click.
- `POST /flashcards/complete` `{ topicId (a topic id or "review"), known (0..50), total (1..50) }` -> `{ progress }`. Calls `ProgressService.practice("Flashcards: <title> (<known>/<total> known)")`, so a finished run gives +10 XP and a daily-feedback line. 404 for an unknown topic. `known` is clamped to `total` but otherwise trusted.
- `cleanStatus` / `cleanFlags` rebuild the per-card arrays to the deck length, so a malformed or short stored array falls back to `new` / `false`.
- `flashcard.service.ts` has its own `learner()` fallback (Spanish / English / Beginner), which differs from the AI module's (see gotcha 8).
- Cost: a new deck is 1 to 3 AI requests, opening a saved deck, marking cards and the Daily review cost 0.

### Characters Mode (`src/characters`)
All routes are behind `AuthGuard`, throttled at 40 / 60 s (a turn is a reply plus a review). Nothing here checks `premium` (the frontend gate does, like the other page modes). `CharactersModule` imports `AiModule` and `ProgressModule`. It is modelled on Debates: same endpoints, same chat screen, but one conversation per character instead of per topic and side.

- **Catalog** (`characters.catalog.ts`): `CHARACTERS` = 30 entries (Norse, Greek, Egyptian and Hindu figures, historical people, Dracula, Frankenstein's Monster, Sherlock Holmes). Each has `id` (URL slug and the key stored in `CharacterSession`, so never rename one with conversations), `name`, `emoji`, `hue` (0-360, colour of the fallback tile), `kind` (`history` | `myth` | `fiction`) and `about` (English persona text: who they are, how they talk, what they like; used in the prompt and on the intro page). The AI writes in the learner's language, so one list serves every language. `hue` is a number, not Tailwind classes, because class names that only exist in backend data are purged from the CSS build.
- `GET /characters` -> `{ total, talked, characters: [{ id, name, emoji, hue, kind, about, saved }] }`. `saved` is the learner-message count of the saved conversation in the current `Progress.language` (0 = none); `talked` counts characters with `saved > 0`. The grid shows a check badge on those.
- `GET /characters/session?characterId=` -> `{ session: { intro, messages, reviews, translations } | null }`; `PUT /characters/session` saves the whole conversation (reviews and translations are rebuilt, trimmed and only kept for matching message roles); `DELETE /characters/session?characterId=` throws it away.
- `POST /characters/start` `{ characterId, ...learner }` -> `{ characterId, name, emoji, hue, about, opening }`. One AI request: the character greets the learner by account first name (else the email's first part, else "there") in 1-2 short lines and asks an easy question.
- `POST /characters/reply` `{ characterId, messages[1..30], ...learner }` -> `{ reply }`. The last message must be the learner's. Reply length follows the level (`LENGTH`). The persona prompt keeps the character in voice, family-friendly and respectful with religious figures, admits to being an AI role if asked, avoids modern politics, and forbids emojis, markdown and stage directions because the reply is read aloud. Language mistakes are not corrected here. Calls `ProgressService.practice("Characters: <name> - <message>")` for +10 XP and a daily-feedback line.
- `POST /characters/feedback` `{ message, ...learner }` -> `{ correct, corrected, explanation, translation }` (JSON from the AI, 2 attempts, 502 if unreadable). `explanation` and `translation` are in the native language. `POST /characters/translate` `{ text, ...learner }` -> `{ translation }` for the character's bubbles.
- Saved conversations are per language, like debates and Word Mode lessons. Cost: opening 1 AI request, each turn 2 (reply + review), translating 1, resuming 0.

### Roleplay Mode (`src/roleplay`)
All routes are behind `AuthGuard`, throttled at 40 / 60 s (every turn is a reply plus a review). Nothing here checks `premium` (see gotcha 1). `RoleplayModule` imports `AiModule`, `ProgressModule` and `WordModule` (for the Pexels photos). It is a sibling of Debate Mode and follows the same shape, without sides.

- **Catalog** (`roleplay.catalog.ts`): `ROLEPLAY_SCENARIOS` = 24 scenarios in 5 categories (Social 6, Transport 4, Travel 7, Food 4, Shopping 3). Each has `id` (URL slug and the key stored in `RoleplaySession`), `title`, `category` (the pill on the picture), `emoji`, `photo` (cover search text), `partner` + `partnerEmoji` (who the AI plays, shown as the chat name: "Coworker", "Barista"), `scenario` (English text for the intro page, written to the learner) and exactly three `tasks`. The AI writes in the learner's language, so one list serves every language. Never rename an id that has saved chats.
- `GET /roleplay/scenarios` -> `{ total, practiced, scenarios: [{ id, title, category, emoji, cover, scenario, tasks, partner: { name, emoji }, practiced, saved }] }`. `saved` = learner messages in the unfinished chat for the current language; `practiced` = `saved > 0`. One request looks up 24 cover photos in parallel (in-memory cached under `roleplay-cover:<id>`, `null` without `PEXELS_API_KEY`).
- `POST /roleplay/start` `{ scenarioId, ...learner }` -> `{ scenarioId, title, scenario, tasks, partner, opening }`. One AI request: the partner's first line (`openingSystem`, 1 short sentence for Beginners). 404 for an unknown scenario.
- `POST /roleplay/reply` `{ scenarioId, messages[1..30] (last must be the learner's), ...learner }` -> `{ reply }`. `replySystem` makes the AI stay in character, answer in the target language only, create openings for the three tasks without doing or listing them, give no corrections and no emojis/markdown (the reply is read aloud). Calls `ProgressService.practice("Roleplay: <title> - <message>")`, so each turn gives +10 XP.
- `POST /roleplay/feedback` `{ message, ...learner }` -> `{ correct, corrected, explanation, translation }` (explanation and translation in the native language; up to 2 attempts, 502 when unreadable). `POST /roleplay/translate` `{ text, ...learner }` -> `{ translation }`.
- **Saved chats** (`RoleplaySession`, one per user, scenario and language): `GET/PUT/DELETE /roleplay/session`. The client PUTs the whole conversation (messages + finished reviews + translations) after every change; the service rebuilds and trims `reviews` / `translations` by message index. Saving gives no XP; only `/roleplay/reply` does.
- Cost: opening a scenario is 1 AI request, each learner message is 2 (reply + review), a translation is 1, resuming a saved chat is 0.

### Call Mode (`src/call`)

All routes are behind `AuthGuard` with a 40 / 60 s throttle (every spoken turn is a reply plus a review). Nothing is stored: **there are no Call tables and no migration**; a call lives in the browser until the page is closed. Nothing here checks `premium` server-side. `CallModule` imports `AiModule` and `ProgressModule`.

- The teacher is always **Kai** (`TEACHER` in `call.prompts.ts`). He calls the learner by the account name (else the first part of the email), speaks only the target language, answers in 1-4 sentences by level (`LENGTH`), reacts, then asks one simple follow-up. He never corrects mistakes (the panel does), and uses no emojis, markdown or lists because the reply is read aloud.
- `POST /call/start` `{ ...learner }` -> `{ teacher: { name }, opening }`: Kai's greeting and one easy question. 1 AI request.
- `POST /call/reply` `{ messages[1..30] (last must be the learner's), ...learner }` -> `{ reply }`. Calls `ProgressService.practice("Call: <message>")`, so each turn gives +10 XP and a daily-feedback line.
- `POST /call/feedback` `{ message (1-1000), ...learner }` -> `{ correct, corrected, explanation }`. Ignores capitals and punctuation because the text comes from speech recognition; a message not in the target language is `correct: false`. `corrected` is empty when correct; `explanation` is written in the native language. Retries once on unreadable JSON, then 502.
- `POST /call/translate` `{ text, ...learner }` -> `{ translation }` (Kai's line in the native language).
- `POST /call/advanced` `{ messages[1..30], ...learner }` -> `{ summary, strengths[1-3], mistakes[0-5] of { original, corrected, explanation }, tips[1-3] }`. 400 if the call has no learner message. Written in the native language. 1 AI request (retries once on bad JSON).
- Cost: greeting 1 request, each turn 2 (reply + review), translate 1, advanced feedback 1. This matters for the free OpenRouter quota.

### Photo Mode (`src/photo`)

All routes are behind `AuthGuard` (default throttle 20 / 60 s; each judging is one OpenRouter vision request). Nothing here checks `premium` server-side. `PhotoModule` imports `AiModule` and `ProgressModule`.

- **Catalog** (`photo.catalog.ts`): `PHOTO_UNITS` = 2 units x 8 photos (`TOTAL_PHOTOS` = 16). Photo ids are `photo-<n>` (the keys stored in `PhotoProgress`) and each points at `/photo/<n>.jpg`, a file the **frontend** serves from `frontend/public/photo/`. Unit 1 = 1-8, Unit 2 = 9-16. A non-jpg file needs `photo(n, 'png')`. The backend never reads the image files.
- `GET /photo/units` -> `{ language, percent, passed, total, units: [{ number, photos: [{ id, image, passed, bestScore }] }] }`, progress for `Progress.language` only. `percent` = passed photos / `TOTAL_PHOTOS`.
- `POST /photo/judge` `{ photoId, image (data URL, png|jpeg|webp, max 5M chars), description (2-1000 chars), targetLanguage?, nativeLanguage?, level? }`. Because the backend cannot read the frontend's files, **the browser resizes the picture (max 800 px JPEG) and sends it along**. The AI (`judgeSystem` in `photo.prompts.ts`, multimodal message, temperature 0.4, up to 2 attempts, 502 if the JSON is unusable) returns `{ score 1-5, summary, corrections (max 3), better, betterTranslation, words (max 3) }`. The learner's text is treated as data, not instructions. `passed` = score >= `PASS_SCORE` (3, imported from `sentence.service.ts`). The row is upserted (best score, last score, attempts, sticky `passed`), `ProgressService.practice()` gives +10 XP, and the response is `{ result, passed, bestScore, percent, progress }`.
- Like `/ai/photo`, this needs a vision-capable model: if `openrouter/free` does not route to one, pin it with `OPENROUTER_MODEL`.

### Account (`src/account`)
All routes are behind `AuthGuard`. **Billing is not connected**: plans have no prices and nothing is charged; everything is demo logic so the Account page has something to manage.

- **Personalization**: `GET /account/personalization` -> `{ values: { reason, frequency, goal, style, ageRange } (each string | null), questions: [{ key, label, options[] }] }`; `PATCH /account/personalization` takes any subset of the five keys and upserts the `Personalization` row. The question list lives only in `account.options.ts` (`QUESTIONS`): the DTO validates with `@IsIn(optionsFor(key))` and the frontend renders whatever the server returns. The answers are stored but **nothing reads them yet** (the AI prompts ignore them).
- **Refer a friend**: `GET /account/referral` -> `{ code, invited, rewarded }`. The 6-character code (alphabet without look-alikes `0 O 1 I L`) is created lazily on the first call and stored in `User.referralCode` (unique; up to 5 retries on a Prisma `P2002` collision). `invited` counts users with `referredById = you`; `rewarded` counts those whose `referralRewarded` is true. The invite link is `<origin>/login?ref=<CODE>`.
- **Reward**: when a referred user starts their first subscription, `rewardForReferral` flips the friend's `referralRewarded` with `updateMany ... where referralRewarded = false`, so a double click pays out once, then `grantFreeMonth` adds one month to **both** users' `currentPeriodEnd` (from `max(now, current end)`) and sets `premium = true`. A user with no plan gets a `canceled` 1-month plan, which does not renew. The claim and the grants are separate writes, so a failure in between loses the reward.
- **Subscriptions**: one `Subscription` row per user: `months` (plan length), `status` (`active` | `paused` | `canceled`), `currentPeriodEnd` (the end of the period already paid for). `PLAN_MONTHS = [1, 3, 12, 24]` in `subscription.util.ts` (the frontend has its own copy). Endpoints: `GET /account/subscription` and `POST /account/subscription/{plan, pause, resume, cancel}`; all return `{ status: 'none' | 'active' | 'paused' | 'canceled', months, nextPayment, accessUntil, premium }`.
  - `none` means no row, or a paused/cancelled plan whose `currentPeriodEnd` has passed.
  - Active: `nextPayment` is `currentPeriodEnd` stepped forward in whole plans until it is in the future (`nextPayment()`); `accessUntil` is null. Paused/cancelled: `accessUntil = currentPeriodEnd`, `nextPayment` null.
  - `plan` (`{ months }`, must be in `PLAN_MONTHS`) works while active or paused. `pause` needs active and moves `currentPeriodEnd` to the end of the paid period. `resume` needs paused. `cancel` works while active or paused and keeps access until the paid period ends. Wrong-state calls return 400.
- **`syncPremium`** (`subscription.util.ts`): when a subscription exists, is not `active`, and has run out, it sets `Progress.premium = false`. It runs inside `ProgressService.snapshot` and `GET /account/subscription`. **Active plans never expire** (nothing renews or charges), and a user who got Premium from the old demo unlock without a `Subscription` row is never switched off.

### Database (`prisma/schema.prisma`)
- `User(id cuid, email unique, name?, passwordHash, createdAt, referralCode? unique, referredById? -> User (onDelete SetNull), referralRewarded Boolean)`. The self-relation is named `Referrals`.
- `Progress(userId PK -> User, xp, streak, longest, messages, lastDay "YYYY-MM-DD"?, premium, giftClaimed, language default "Spanish", level default "Beginner", nativeLanguage default "English", updatedAt)`.
- `PracticeEntry(id cuid, userId, day "YYYY-MM-DD" (UTC), text, createdAt)`, index on `(userId, day)`.
- `PracticeDay(userId, day "YYYY-MM-DD" (browser local), seconds)`, composite PK `(userId, day)`.
- `SentenceProgress(userId, skillId, bestScore Float, lastScore Float, attempts, passed, updatedAt)`, composite PK `(userId, skillId)`; `skillId` must match an id in `sentence.catalog.ts`.
- `DialogueProgress(userId, topicId, bestScore Float, lastScore Float, attempts, passed, updatedAt)`, composite PK `(userId, topicId)`; `topicId` must match an id in `dialogue.catalog.ts`. Not per language, like Sentence Mode.
- `CharacterSession(userId, characterId, language, messages Json, reviews Json, translations Json, count, updatedAt)`, composite PK `(userId, characterId, language)`; `characterId` must match an id in `characters.catalog.ts`. `messages` is `[{ role, content }]` starting with the character's opening; `reviews` and `translations` are keyed by message index. One saved conversation per character and language.
- `RoleplaySession(userId, scenarioId, language, messages Json, reviews Json, translations Json, count, updatedAt)`, composite PK `(userId, scenarioId, language)`; `scenarioId` must match an id in `roleplay.catalog.ts`. `reviews` / `translations` are keyed by message index.
- `Personalization(userId PK -> User, reason?, frequency?, goal?, style?, ageRange?)`: nullable strings holding the chosen option text.
- `Subscription(userId PK -> User, months default 1, status default "active", currentPeriodEnd DateTime, createdAt, updatedAt)`.
- `WordProgress(userId, wordId, language, lesson Json?, step, scores Json default [], finished, passed, bestScore, attempts, updatedAt)`, composite PK `(userId, wordId, language)`. `lesson` stores the generated lesson so a resume shows identical content; `finished` is the current run, `passed`/`bestScore` are lifetime.
- `FlashcardDeck(userId, topicId, language, cards Json, status Json default [], flagged Json default [], updatedAt)`, composite PK `(userId, topicId, language)`. `cards` is `[{ term, translation, example, exampleTranslation, photo, image }]`; `status` is one of `new | learning | known` per card and `flagged` a boolean per card, **both matched to the card by array index**, so never reorder or trim `cards` without rewriting both arrays. `topicId` must match an id in `flashcard.catalog.ts`.
- `PhotoProgress(userId, photoId, language, bestScore Int, lastScore Int, attempts, passed, updatedAt)`, composite PK `(userId, photoId, language)`. `photoId` must match an id in `photo.catalog.ts`; a score of 3 or more sets `passed`, which stays true.
- All child relations `onDelete: Cascade` (except `referredBy`, which is `SetNull`). Dates are stored as strings, not `DateTime`.
- Never edit an applied migration. Change the schema, then run `npx prisma migrate dev --name <change>` and commit the generated folder.

## Frontend in detail

### Shell and routing
- `/` redirects to `/dashboard`. `/login` toggles between login and register and **clears the token on mount**, so visiting it logs you out. With `/login?ref=CODE` it opens the register form, shows "Invite code CODE applied." and sends `referralCode` with the registration.
- `app/dashboard/page.tsx` (client component) holds all state: `Progress` snapshot `s`, active tab, open mode, upsell/feedback modals, toast. It redirects to `/login` if there is no token, loads `/progress`, and shows a retry screen on failure.
- Sidebar tabs: Home, **Learn**, Courses, Explore, Progress, plus **Account** at the bottom (`active === "account"` renders `AccountView` in the main area; the old Account modal with only a Log out button is gone). The **Premium tab was removed**; the upsell modal is still opened by a locked mode, a locked Learn exercise and the "Get premium" card on Home. Learn renders `LearnView`, Courses renders `CoursesView`, Explore renders `ExploreView` (see "Explore" below). The pink notification dot is on Progress (the `dot` flag in `NAV`). Clicking any tab also closes an open mode modal. The sidebar is `hidden md:flex`, so **on screens below `md` there is no navigation** (no way to reach Progress, Account or the gift). Fix this if mobile matters.
- The sidebar logo is a button: it returns to the Home tab, closes any open mode and pushes `/dashboard`. On Sentence Mode pages the shared `Logo` is a link to `/dashboard`. The dashboard also honours `?tab=learn`, `?tab=courses`, `?tab=explore` and `?tab=progress` on load (the `TABS` array; the Sentence/Word/Dialogue sidebar's Learn and Progress links use it).
- Home has three selects: **My language** (`nativeLanguage`, what translations and feedback are written in), the language being learned, and level. All PATCH `/progress/settings`.
- Home lists `MODES` from `lib/modes.ts`. Only Chat is free; the other 9 show a lock and open the upsell modal unless `s.premium`. The upsell button calls the demo `POST /progress/premium`. Language and level selects update state optimistically and PATCH `/progress/settings`.
- Mode routing in the dashboard uses hard-coded id arrays: chat -> `ChatPanel` (`call`, `roleplay`, `debate` and the old `characters` are no longer reachable through it; they are still in the `ChatMode` type); dialogue -> `GeneratePanel`; photo -> `PhotoPanel`. **Call, Sentence, Word, Dialogue, Roleplays, Characters, Debates, Flashcards and Photo are the exceptions**: `clickMode` does `router.push("/<id>")` (e.g. `"/characters"`, `"/roleplay"`) (after the Premium check) instead of opening a modal. The `"sentence"`, `"word"` and `"flashcards"` entries left in the `GeneratePanel` array and generate types are legacy and unreachable from Home (the old flip-card carousel in `GeneratePanel` is dead code). `FeedbackModal` (defined at the bottom of the dashboard file) calls `/ai/feedback` with `s.today`.
- `PracticeTimer` is mounted **only while a mode modal is open, or inside `/sentence/*`, `/word/*` and `/flashcards/*`** (`SentenceProvider`, `WordProvider` and `FlashcardsProvider` mount it), so practice time is counted only inside a mode.

### `lib/api.ts`
Single API client. `BASE` = `NEXT_PUBLIC_API_URL`. Token key `talkmate-token` in `localStorage`. `request()` adds the Bearer header, turns network failure into "Can't reach the server...", flattens Nest validation message arrays, and on any 401 (when a token existed) clears it and hard-redirects to `/login`. `keepalive` is used for the final timer flush on unmount. Exports types `Msg`, `ChatMode`, `GenerateType`, `Learner` (`targetLanguage`, `level`, optional `nativeLanguage`), `Progress` (now includes `nativeLanguage`), `Stats`, `Achievement`, the Sentence types (`SentenceUnits`, `SentenceSkill`, `SentenceItem`, `PronunciationResult`), and the `api` object, including `api.sentence.{units, session(skillId, learner), evaluate, complete}` `api.word.{units, start(wordId, learner + restart), save, complete}` (types `WordUnits`, `WordStar`, `WordLesson`, `WordSentence`, `SentenceChunk`), `api.flashcards.{topics, deck(topicId, learner + restart), review, mark, complete}` (types `FlashTopics`, `FlashTopicInfo`, `FlashDeck`, `FlashCard`, `FlashStatus`, `FlashImage`; `deck()` throws if `topicId` is empty), and `api.account.{personalization, savePersonalization, referral, subscription, changePlan, pause, resume, cancel}`. Account types: `PersonalizationData`, `Referral`, `SubscriptionInfo`. `api.auth.register` accepts `referralCode`.

### Components
- `ChatPanel`: message list, text input, and (Call mode) a mic button using `SpeechRecognition`/`webkitSpeechRecognition` (Chrome-first) and `speechSynthesis` to read replies aloud, with the language mapped through `SPEECH_LANG`. Sends the last 20 messages. Always sends the full `context` object (scenario, topic, stance) regardless of mode. Changing scenario/topic/stance clears the conversation. After each successful reply it calls `onPractice(userText)`, which logs the learner's message and awards 10 XP. Scenario and topic option lists are constants at the top of the file. Characters is no longer a ChatPanel mode.
- `GeneratePanel`: topic input with per-type default, "Generate"/"Regenerate", renders list / dialogue bubbles / flip-card carousel. On each successful generation it calls `onPractice("Studied <mode>: <topic>")`, so every (re)generate gives +10 XP and adds a line to the daily feedback input.
- `PhotoPanel`: client-side resize to max 800 px JPEG (quality 0.8) via canvas, then POST. Only logs practice when the learner typed a description.
- `ProgressView`: fetches `/progress/stats` (refetches when `s.messages` or `s.streak` change). Cards for Stats, streak, a 1- or 5-week calendar (a day is "studied" at >= 180 s), an inline-SVG `AreaChart` (7 / 28 days / all time), level bar, Share (navigator.share or clipboard), a Certificates placeholder ("Courses not built yet"), and Achievements (first 4 unlocked, "See all" modal). `ICONS` maps achievement ids to lucide icons.
- `components/sentence/SentenceProvider.tsx`: wraps every `/sentence/*` page. Redirects to `/login` without a token and to `/dashboard` when `premium` is false (UI-only gate), loads `/progress` and `/sentence/units` once, mounts `PracticeTimer`, and exposes `useSentence()` = `{ progress, units, unitsError, reloadUnits }`.
- `components/account/*`: see "Account page" below.
- `components/word/WordProvider.tsx`: the same gate as `SentenceProvider` (login, Premium redirect, `PracticeTimer`) for `/word/*`, loading `/progress` and `/word/units`; exposes `useWord()` = `{ progress, units, unitsError, reloadUnits }`.
- `components/flashcards/FlashcardsProvider.tsx`: the same gate as `WordProvider` (login, Premium redirect, `PracticeTimer`) for `/flashcards/*`, but it only loads `/progress` itself. The topic grid is loaded by the page through `reloadTopics()`; the provider just holds the state. Exposes `useFlashcards()` = `{ progress, topics, topicsError, reloadTopics }`.
- `components/PronunciationReview.tsx`: `Stars`, `ColoredSentence` (green matched / red missed words) and `Review` (stars, feedback, tip, "We heard", Try again, Next/Finish). Used by Word Mode only; the Sentence practice page keeps its own copies.
- `components/CoursesView.tsx` and `components/LearnView.tsx`: the Courses and Learn tabs (see "Courses and Learn"). `CoursesView` also exports `tileOf(course)`, the gradient class used for course tiles (the gradient classes live in the component because Tailwind's `content` globs do not include `lib/`).
- `components/sentence/SentenceShell.tsx` (also used by the Word pages and the Flashcards topic grid for the sidebar and back link): fixed sidebar (Home, Learn, Progress, Log out; hidden below `md`) plus a centred column with a back link, and the exported `Logo`.
- `Modal.tsx` exports `Modal` (backdrop click and Escape close, `wide` prop), `Select` and `ErrorText`.
- `PracticeTimer`: renders nothing; counts 1 s ticks while `document.visibilityState === "visible"`, flushes every 30 s (capped at 60 s per request) and once on unmount, calling `api.progress.time(seconds, localDay())`.
- `lib/dates.ts`: local-date helpers (`ymd`, `localDay`, `parseDay`, `addDays`, `startOfWeek` = Monday, `shortDate`).
- `lib/modes.ts`: `MODES` (id, title, desc, emoji, premium), `LANGUAGES` (12), `LEVELS`, `SPEECH_LANG`.
- `lib/speech.ts`: browser-only helpers: `supportsSpeechRecognition`, `createRecognition(lang)` (interim results, not continuous), `speak(text, lang, rate, onEnd)`, `hasVoiceFor(lang)`, `cancelSpeech`.
- `lib/word.ts`: `useWordId()` (same URL-path fallback as `useSkillId`) and `nextWordId(units, id)` (the next star, for "Next word").
- `lib/usePronunciation.ts`: hook `{ mic, live, error, setError, canListen, start(sentence), stop }`: browser `SpeechRecognition` -> `api.sentence.evaluate` -> `onResult`. It repeats the logic inside the Sentence practice page, which was left unchanged.
- `lib/flashcards.ts`: `useTopicId()` (same URL-path fallback as `useSkillId`; `"review"` is the Daily review).
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

### Word Mode pages (`app/word`)
Flow: Home -> `/word` -> `/word/<wordId>`. Both share `WordProvider` via `app/word/layout.tsx`; the sidebar and back link come from `SentenceShell`.

- `/word`: description, progress pill (`percent`), then 10 unit boxes with a "Unit N" pill and an `x/12` counter, 6 stars per row. Star states: gold = passed, outlined with a dot = in progress, dim = not started. Clicking an **in-progress** star opens the "Ready to get back?" popup (Continue the exercise -> `/word/<id>`, Start over -> `/word/<id>?restart=1`); any other star goes straight to `/word/<id>` with no popup.
- `/word/<wordId>` (full screen): calls `api.word.start(wordId, { ...learner, restart })`. The `restart` flag is read from `?restart=1` and **removed from the URL immediately**, so a refresh resumes instead of restarting. The page reloads when the word id changes (Next word). "Try again" after a failed load repeats the same intent (resume or start over).
  - A progress track with one stop for the word card and one per sentence (4 stops for 3 sentences).
  - **Step 0, word card**: photo (or the emoji tile when there is no photo or the image fails), the word, a play button, the translation, a Pexels credit line when a photo is shown, **Continue**.
  - **Steps 1..n, sentences**: header "word - translation", "Read out loud", Replay, **Explain** (a popup with the sentence and each chunk's meaning and explanation, falling back to the sentence note when there are no chunks), translation (toggle in settings), mic and Skip. After a rating: coloured words, `Review`, Try again, Next/Finish.
  - Every move calls `api.word.save` with `{ step, scores }` (best effort). A rating is saved as soon as it arrives, so closing after rating still keeps the score. Closing (X) goes to `/word`; reopening shows the popup.
  - Finishing calls `api.word.complete` and shows a summary: stars and average, "Word learned!" or "Keep practising" (needs 3.0), each sentence's stars, then Next word / Practise again (restart) / Back to words. The star grid is reloaded.
  - Speaker toggle and settings (slow speech, show translation) reuse the Sentence Mode preferences in `localStorage` `talkmate-sentence-prefs`. Voice is the browser's `speechSynthesis`.

### Flashcards pages (`app/flashcards`)
Flow: Home -> `/flashcards` -> `/flashcards/<topicId>` (or `/flashcards/review`). All pages share `FlashcardsProvider` via `app/flashcards/layout.tsx`.

- `/flashcards` (uses `SentenceShell`, back link to `/dashboard`): a **Daily review** row (shows "N waiting" from `reviewCount`) and a two-column grid of topic cards with a Pexels cover (an emoji on a gradient when there is no photo), "<total> Flashcards" plus "<n> known" when partly learned, and a check badge when `completed`. It calls `reloadTopics()` every time it opens so the marks are fresh after a deck. A Pexels credit sits at the bottom.
- `/flashcards/<topicId>` (full screen, no sidebar). **`review` is a reserved id**: it loads `api.flashcards.review()` instead of a deck, so never add a topic with that id.
  - Loads with `api.flashcards.deck(topicId, { ...learner, restart })` (opens the saved deck, or waits while the AI writes a new one). The learner comes from `useFlashcards().progress`, loaded once, so a language change made elsewhere needs a page reload to apply.
  - **Queue**: a topic deck starts with the cards that are not `known` (all 15 when everything is known); the Daily review queues every card it holds. Progress bar with an `n / total` bubble.
  - **Card**: photo (emoji tile when there is no photo or the image fails), the word, its translation (toggle), a play button, the example sentence (tap to hear it, with its translation) and a Pexels credit line. A flag button (top right) keeps the card in the Daily review and is rolled back with no message if saving fails.
  - **Answer**: **Learning** (left arrow key) or **I know it** (right arrow key). The choice is saved at once with `api.flashcards.mark` (errors swallowed) and the next card shows. Marking known clears the flag locally, matching the server.
  - **Voice**: the speaker toggle auto-plays each new word after 350 ms; settings (Slow speech, Show translation) share the Sentence Mode preferences in `localStorage` `talkmate-sentence-prefs`. Warns when the browser has no voice for the language (`hasVoiceFor`). Voice is the browser's `speechSynthesis`; there is no speaking or recognition in this mode.
  - **Summary** after the last card: cards known this round out of the queue length, a list of the cards still marked Learning, **Practise the N learning cards** (a new queue from those cards, no reload and no new XP), **New words** (topic decks only; asks `window.confirm`, then reloads with `restart: true`, which replaces the deck and resets that topic's marks) and Back to flashcards.
  - **XP**: finishing calls `api.flashcards.complete({ topicId, known, total })` once per visit (+10 XP; a `rewarded` ref guards it and `load()` resets it, so New words can pay again). Errors are swallowed and the returned snapshot is ignored.
  - The Daily review with nothing to show displays "Nothing to review yet". Close (X) goes to `/flashcards`.

### Characters pages (`app/characters`)
Flow: Home -> `/characters` -> `/characters/<characterId>` -> `/characters/<characterId>/practice`. All three share `CharactersProvider` via `app/characters/layout.tsx` (login, Premium redirect, `PracticeTimer`, `/progress` and the grid loaded once; the grid page calls `reloadList()` whenever it opens so the check badges are fresh).

- `/characters` (uses `SentenceShell`, back link to `/dashboard`): intro text, then a two-column grid of portrait tiles with the name on top and a check badge when a conversation exists.
- `/characters/<characterId>`: portrait, name, "In the Character Mode you can chat...", the character's `about`, language / level / feedback language, and **Start**. With a saved conversation the button reads **Continue** and a "N messages saved - Start over" line appears (Start over goes to `?restart=1`). Unknown ids redirect to `/characters`.
- `/characters/<characterId>/practice` (full screen, no sidebar): a copy of the Debate chat with the side logic removed.
  - Loads the saved conversation, or asks `api.characters.start` for the character's opening (auto-played when the speaker is on). `?restart=1` is removed from the URL at once, so a refresh continues instead of restarting, and clears the saved conversation first.
  - Header: avatar, name, info (the character's `about`), speaker toggle (auto-play), menu (Slow speech, Message feedback on small screens, Restart conversation, Change character). Character bubbles have Replay and Translate; learner bubbles show a Checking / Correct / Can be improved badge.
  - Right panel (a modal below `lg`): "Get feedback on messages" until the learner sends something, then one card per message with the verdict, corrected sentence, explanation, translation and a Listen button. The review runs in parallel with the reply; a failed reply takes the message back into the input so it can be resent.
  - Input: text, or the mic (browser `SpeechRecognition`, live transcript, sends when recognition ends). The conversation is saved 800 ms after every change, never while the character is answering. Speaker/slow settings reuse `talkmate-sentence-prefs`.
- **Portraits**: tiles are a colour gradient (from `hue`) with the character's emoji by default. To use artwork, put `public/characters/<id>.jpg` files in place (ids as in `characters.catalog.ts`, roughly 4:5 portrait) and set `NEXT_PUBLIC_CHARACTER_PORTRAITS=1`; a missing file falls back to the gradient tile. No artwork is included.
- `ReviewPanels.tsx` holds `ReviewBadge`, `FeedbackEmpty` and `FeedbackList`. The Debate practice page still has its own copies of these.

### Call page (`app/call`)

One full-screen page, `/call`, behind `CallProvider` (login, Premium redirect, `PracticeTimer`). Header: logo, centred "Call Mode", close (back to `/dashboard`). Two cards, the right one hidden below `lg` (it opens as a "Message feedback" modal from the ⋮ menu).

- **Call card**: Kai's avatar and a green dot on top, ⋮ menu (Slow speech, Message feedback on small screens, Start a new call, End call), an orange **i** button (About Call Mode), then the big avatar, "Kai" and the call timer (`mm:ss`, `h:mm:ss` after an hour; counts from the moment Kai picks up, resets on a new call). A small status line shows Connecting / Listening / Kai is thinking. The avatar gets a ring while Kai is speaking.
- **Control bar** (left to right): **Kai's voice** on/off (`Speech`, highlighted while on; off also shows Kai's text as a caption), **Translate** (shows Kai's last line plus its translation, fetched once per line), **Replay** (Kai's last line again), and the round **mic** (blue; red and pulsing while recording; tap again to stop). Slow speech uses the shared `SentencePrefs.slow`; the voice toggle is page-local and not saved.
- **Flow**: on load `api.call.start` gives Kai's greeting, spoken aloud (the browser may need a click first, which the Home click already provides). The mic uses `createRecognition`; when recognition ends with text it is sent at once (`api.call.reply`) and, in parallel, reviewed (`api.call.feedback`). If the reply fails the learner's message and its review are taken back and the error is shown. Only the last 20 messages are sent. Nothing is saved, so a refresh starts a new call.
- **Right panel**: per message a dashed box with what was heard, then (when wrong) a grey `x` line with the original and a green `check` line with the corrected sentence (click it to hear it), then a short explanation in the native language; a correct message shows one green line. While the mic is open the live transcript appears at the bottom. Empty state until the first message.
- **Advanced feedback** (button at the bottom of the panel, disabled until the learner has spoken): `api.call.advanced` on the last 30 messages, shown in a modal as summary, what went well, mistakes to fix and what to practise.
- Kai's picture is `public/call/kai.svg` (`KAI_IMG` in `page.tsx`).

### Photo pages (`app/photo`)

- `/photo` (uses `SentenceShell`, back link to `/dashboard`): "Photo Mode" header and description, a progress pill with `percent`, then one bordered card per unit with a "Unit N" pill and a `done/total` pill. Each unit is **8 stars, 4 per row** (2 rows), centred, with each tile the same size as a Word Mode tile (a column is one sixth of the row, aspect 1:0.95, star size 22); a star is a link to `/photo/<id>` and turns yellow once passed. Data comes from `PhotoProvider` (`usePhoto()`), which also holds the Premium gate.
- `/photo/<photoId>` (full screen): header "Photo Mode" with a close button (back to the grid), "Describe what you see", the picture, then an input ("Aa") with a Send button and a mic (speech recognition in the target language, Chrome/Edge). Send resizes the picture in the browser and calls `api.photos.judge`; the page then shows the star score (1-5), summary, Corrections, Better version (with Listen), New words, and **Try again / Next photo / Back to photos**. A missing image file shows a message naming the path to add. Opening a different photo resets the page.

### Roleplay pages (`app/roleplay`)
Flow: Home -> `/roleplay` -> `/roleplay/<scenarioId>` -> `/roleplay/<scenarioId>/practice`. All pages share `RoleplayProvider` via `app/roleplay/layout.tsx` (login + Premium gate, `PracticeTimer`, loads `/progress` and the scenario grid; exposes `useRoleplay()` = `{ progress, scenarios, scenariosError, reloadScenarios }`). The grid and intro use `SentenceShell`.

- `/roleplay`: description, then a two-column grid of pictures (aspect 7:5) with the title top-left, a white category pill bottom-left and a check badge bottom-right once practised (an emoji on a gradient when there is no Pexels photo). It calls `reloadScenarios()` on every open so the check marks are fresh.
- `/roleplay/<scenarioId>`: cover picture, title, **Scenario:** text, **Your tasks:** bullets and **Start**. With a saved chat the button reads **Continue** and a line below offers "N messages saved - Start over" (`?restart=1`).
- `/roleplay/<scenarioId>/practice` (full screen, same layout as the Debate chat): header "Roleplays" with a close button (back to the grid); a chat card with the partner (cover photo as avatar, emoji fallback, green dot, name like "Coworker") and Info (scenario + tasks popup), speaker (auto-play on/off) and a menu (Slow speech, Message feedback below `lg`, Restart roleplay, Change scenario); the partner's bubbles have **Replay** and **Translate** buttons; the input shows "Aa" with a mic that turns into Send when there is text, and the line "You're talking to AI. Check important info." sits under it. The right panel (a modal below `lg`) shows "Get feedback on messages" until the learner has sent one, then a card per message (Correct / Can be improved, the fixed sentence, explanation, translation, Listen).
  - Loading: a saved chat is continued, otherwise `api.roleplay.start` asks the partner for its first line (read aloud when auto-play is on). `?restart=1` is removed from the URL at once so a refresh continues. The state is saved with a debounce of 0.8 s whenever the partner is not answering; a send that fails is taken back into the input.
  - Sending: the partner's reply and the message review run in parallel. Speech input uses the browser `SpeechRecognition` and sends what it heard when recognition ends. Speaker and Slow speech share the Sentence Mode preferences in `localStorage` `talkmate-sentence-prefs`.
  - `components/roleplay/Feedback.tsx` holds the review UI. Debate still has its own copy of the same components.

### Account page (`components/account`)
`AccountView` (props: `s`, `onLanguage`, `onLogout`, `onToast`, `onSnapshot`) keeps a local `view` state (`menu` | sub-page) instead of using routes, so Account is always `/dashboard` with the Account tab active.

- **Menu**: a Target language card (opens a modal listing `LANGUAGES` with two-letter badges, since Windows does not draw flag emoji; choosing one calls `onLanguage` -> `updateSettings({ language })`, the same PATCH as the Home select), then rows for Profile, Personalization, Settings, Subscriptions, Refer a friend, For organizations, Support and Log out, plus a footer of legal titles that are plain text, not links.
- **Not built**: Profile, Settings, For organizations and Support render `SubPage` with "This section isn't built yet."
- `PersonalizationView`: loads `GET /account/personalization` and renders a `<select>` per server-supplied question. Each change is saved on its own (`PATCH`), updated optimistically, rolled back with a toast if saving fails.
- `ReferView`: read-only invite link field with a copy button (clipboard failure shows a toast asking to copy by hand), the "invited / rewarded" counts, and a three-step explainer.
- `SubscriptionView`: shows one of three states. With no plan: a "Get Premium (demo)" button that calls `api.progress.premium()` (starting a demo plan) and reloads the subscription. With a plan: a card with plan length and the next payment or access-until date, Change plan (modal with the four lengths), Pause/Resume, Cancel (confirmation modal), and Resubscribe when cancelled. After every action, and once on mount, it re-fetches `/progress` and passes it to `onSnapshot`, because the Premium flag can change (a lapsed plan switches it off). A note says billing is not connected.
- `SubPage` is the shared back-arrow header. Toasts go through the dashboard's `setToast`.

### Courses and Learn (`components/CoursesView.tsx`, `components/LearnView.tsx`, `lib/courses.ts`)
Frontend only: no endpoint, no migration. Both are tabs inside `app/dashboard/page.tsx`, not routes.

- **Data** (`lib/courses.ts`): `COURSES` is 32 entries in three groups (`level` 12 with a CEFR `badge` A1.1 to C2.2, `lifestyle` 10, `professional` 10). A `Unit` is `{ title, word, sentence, dialogue }`: Exercise 1 opens `/word/<word>`, Exercise 2 `/sentence/<sentence>`, Exercise 3 `/dialogue/<dialogue>`. Those ids must exist in the backend catalogs (`word.catalog.ts`, `sentence.catalog.ts`, `dialogue.catalog.ts`); the lists `WORDS`, `SENTENCES`, `DIALOGUES` at the bottom of the file are copies of them.
- **Paths**: only "Absolute beginner 1" has a hand-written path (`ABSOLUTE_BEGINNER_1`, the ten units from the design). Every other course gets `pathFor(course)`: 10 units built from the existing catalogs (sentence skills and words rotate by the course's position; lifestyle and professional courses put their `dialogues` hints first and name units after the dialogue topic). Those paths are **placeholders** until real ones are written.
- **Selected course**: `courseId` state in the dashboard, persisted in `localStorage` key `talkmate-course` (`loadCourseId`/`saveCourseId`, default `absolute-beginner-1`). Not stored on the server, so it does not follow the user to another browser.
- **Courses tab**: `CoursesView` shows the three groups as 2-column card grids (gradient tile with an emoji, title, description, badge). A card calls `openCourse(course)` in the dashboard: save the id, `setActive("learn")`, scroll to top. The selected card is not highlighted (a purple outline was removed on purpose).
- **Learn tab**: `LearnView` shows the course picker (a popover listing all courses, same `openCourse`), a percent bar and the units, each with three exercise rows. On mount it calls `api.word.units()`, `api.sentence.units()` and `api.dialogue.topics()` together (`Promise.allSettled`, so one failing mode only hides its check marks) to get the emoji, dialogue cover and `passed` flag of each exercise. Percent = passed exercises / (units x 3). The book button on a unit opens a `Modal` listing its three lessons. Rows are `Link`s for Premium users; for everyone else a click calls `onLocked(mode)`, which opens the same upsell modal as a locked mode on Home.
- The exercise pages themselves are unchanged, so after finishing one the learner lands back on Home (their back links point at `/dashboard`), not on Learn.

### Explore (`components/ExploreView.tsx`, `lib/explore.ts`)
Frontend only: no endpoint, no migration. A dashboard tab (`active === "explore"`), not a route.

- **Data**: on mount it calls `api.roleplay.scenarios`, `characters.list`, `dialogue.topics`, `flashcards.topics`, `debate.topics`, `word.units`, `sentence.units` and `photos.units` together (`Promise.allSettled`, so a failing mode only hides its own card; all failing shows an error with Try again). It reloads each time the tab opens, so finished items drop out of the picks.
- **Picks**: `pickDaily(items, n, day, salt, done)` shuffles with a generator seeded by the local date (`localDay()`), then puts items the learner has not finished first. The same picks show all day and change at midnight. Nothing is stored.
- **Layout** (two columns, one below `md`): left Daily pick, Characters (carousel of 5), Dialogue (2), Photo Mode (5 thumbnails, Start now); right Roleplays (2), Word Mode (5 emoji tiles, Play now), Sentence Mode (2), Flashcards (carousel of 5), Debates (2). Titles and descriptions come from `MODES`.
- **Daily pick**: one open item from Debates, Roleplays, Dialogue or Flashcards, chosen by the date (`dailyPick`); that item is left out of its own card below.
- **Links** go to the exercise pages (`/roleplay/<id>`, `/word/<id>`, ...). Non-Premium users get the upsell modal through `onLocked`, like Learn.
- Covers are Pexels photos (emoji on a gradient without `PEXELS_API_KEY`); Word and Sentence tiles are always emoji on gradients because their catalogs have no photos. Gradient classes live in the component, not in `lib/`.

### Styling and TypeScript
Tailwind utility classes only (`globals.css` is just the three directives). Dark theme: page `bg-[#16161c]`, cards `bg-[#1f1f27]`, indigo-600 primary, pink accents for premium, `white/10` surfaces. Keep new UI consistent with this. `tsconfig` is `strict`; path alias `@/*` = frontend root. Client components start with `"use client"`. Frontend uses double quotes and 2-space indent; backend uses single quotes.

## Recipes

**Add a chat-style mode**: add the id to `CHAT_MODES` in `backend/src/ai/dto.ts`; add a `case` to `chatSystem` in `prompts.ts` (the switch has no default, so TypeScript will flag a missing case); add the id to `ChatMode` in `frontend/lib/api.ts`; add an entry to `MODES` in `lib/modes.ts`; add the id to the chat array in `dashboard/page.tsx`; add any selector UI in `ChatPanel`.

**Add a generate type**: `GENERATE_TYPES` in `dto.ts`, a `case` in `generateSystem`, `GenerateType` and `DEFAULT_TOPIC` in the frontend, a render block in `GeneratePanel`, a `MODES` entry, and the dashboard id array.

**Add an achievement**: append to `ACHIEVEMENTS` in `progress.service.ts` (add new facts to the `Facts` type and `stats()` if needed) and add an icon to `ICONS` in `ProgressView.tsx`.

**Change XP, level size or the study threshold**: `XP_PER_LEVEL` lives in `progress.service.ts`, `dashboard/page.tsx` and `ProgressView.tsx`; `STUDY_SECONDS` lives in `progress.service.ts` and `ProgressView.tsx`. Change all copies.

**Add or change a Sentence Mode skill**: edit `SENTENCE_UNITS` in `backend/src/sentence/sentence.catalog.ts` (no DB change). Add new skills with new ids; renaming or deleting an id orphans users' `SentenceProgress` rows and drops them from the percentage.

**Add or change a Flashcards topic**: edit `FLASH_TOPICS` in `backend/src/flashcard/flashcard.catalog.ts` (no DB change). Use `photo` for the cover search and `hint` to steer the AI. Add new topics with new ids (never `review`); renaming or removing an id orphans users' `FlashcardDeck` rows. The grid draws whatever the server sends. To change the deck size edit `CARDS_PER_DECK` (the prompt, the Daily review cap and `MIN_CARDS` follow it; the `mark` DTO allows indexes up to 49 and `complete` totals up to 50).

**Add Photo Mode photos or a unit**: put the new pictures in `frontend/public/photo/` (17.jpg, 18.jpg, ...), then add `{ number: 3, photos: range(17, 24) }` to `PHOTO_UNITS` in `backend/src/photo/photo.catalog.ts` (8 per unit keeps 2 rows of 4). No DB change. Never renumber an existing photo.

**Add or change a Roleplay scenario**: edit `ROLEPLAY_SCENARIOS` in `backend/src/roleplay/roleplay.catalog.ts` (no DB change). Keep exactly three tasks, pick a `category` from `ROLEPLAY_CATEGORIES` (a new category needs the frontend `RoleplayCategory` type too, the pill draws any text), and use `photo` for the cover search. Add new scenarios with new ids; renaming or removing an id orphans users' `RoleplaySession` rows.

**Add or change a Word Mode word**: edit `WORD_UNITS` in `backend/src/word/word.catalog.ts` (no DB change). Keep 12 per unit for the grid (the UI draws whatever the server sends in 6 columns). Add new words with new ids; renaming or removing an id orphans `WordProgress` rows. Use the third argument to `w(...)` to improve the photo search.

**Change the Sentence Mode pass mark or scoring**: `PASS_SCORE` is in `sentence.service.ts` (Word Mode imports it from there) **and** `frontend/lib/sentence.ts`; the similarity-to-score thresholds are in `anchorScore` (`sentence.scoring.ts`); prompts are in `sentence.prompts.ts`.

**Add a Personalization question**: add an entry to `QUESTIONS` in `backend/src/account/account.options.ts`, add its key to `PersonalizationDto` (`account.dto.ts`) and to the `Personalization` model, then run a migration. The frontend renders it automatically. Nothing uses the answers until you wire them into prompts.

**Change plan lengths**: `PLAN_MONTHS` in `backend/src/account/subscription.util.ts` and `PLANS` in `SubscriptionView.tsx`.

**Add or change a course path**: add a `lvl(...)`/`life(...)`/`pro(...)` entry to `COURSES` in `frontend/lib/courses.ts` (new ids only; the id is what `talkmate-course` stores), and give it a `units` array of `u(title, wordId, sentenceSkillId, dialogueTopicId)` to replace the generated path. Check every id against the backend catalogs; a wrong id opens a broken exercise page. New catalog content is added with the existing Word/Sentence/Dialogue recipes, then referenced here.

**Add an API field**: DTO (validators) -> service -> `lib/api.ts` types/helpers -> callers. Remember `whitelist: true` drops undeclared fields.

## Known issues and gotchas

1. **Premium is only enforced in the UI.** Backend `/ai/*`, `/sentence/*`, `/word/*` and `/flashcards/*` routes never check `premium`, and `/progress/premium` unlocks any logged-in user (it now also starts a demo subscription). Needs real billing and server-side gating before launch.
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
14. Call Mode needs speech recognition (Chrome or Edge) and has **no typed fallback**: other browsers show "Speech recognition isn't supported in this browser". Replies are read with the browser's installed voices (a warning shows when none exists for the language). Call Mode does not check Premium on the server and nothing about a call is saved.
15. **Sentence Mode trusts the browser.** `POST /sentence/complete` accepts whatever scores the client sends, so a user can fake a pass. Premium is not checked on `/sentence/*` either (extends gotcha 1).
16. **Pronunciation is judged on browser speech-to-text, not on audio.** Recognition quality varies by browser and language (Bengali is weaker in Chrome's recogniser), so a correctly spoken word can be marked wrong. Replay uses the browser's installed voices: Chrome has no Bengali voice (the page shows a warning); Edge ships natural online voices. An audio-capable model or server-side text-to-speech would fix this but was deliberately not added.
17. **Free-quota burn.** A Sentence session costs roughly 6-12 OpenRouter requests, so the 50/day free cap can run out after a few sessions (see Environment variables). Starting a skill always generates new sentences; nothing is cached server-side.
18. **`PASS_SCORE` is duplicated** in `sentence.service.ts` and `frontend/lib/sentence.ts` (the backend Word Mode shares the first).
19. **Legacy `sentence`, `word` and `flashcards` generate types**: still supported by `/ai/generate` and `GeneratePanel` (its flashcards schema is `{ front, back, hint }`, unrelated to the Flashcards Mode cards), but Home no longer opens them.
20. **Unnamed migration folders**: `20261015073124_` (the nativeLanguage column) and `20261017110133_` (the Account tables). Applied migrations must not be renamed.
21. **Subscriptions are a demo.** No payment provider, no prices, no renewals: an active plan never expires, "next payment" is just a computed date, and the "update payment method" link only shows a toast. Real billing needs a provider, webhooks and server-side Premium checks.
22. **Old demo-unlocked Premium never expires**: `syncPremium` only acts when a `Subscription` row exists, so users unlocked before the Account page existed stay Premium and see "Premium is on from the earlier demo unlock".
23. **Referral rewards can be farmed.** There is no email verification or limit, so one person can create accounts with their own link and start demo subscriptions to collect free months. Fix before real money is involved.
24. **Personalization answers are collected but unused**, and several Account rows (Profile, Settings, For organizations, Support, the legal footer) are placeholders.
25. **`PLAN_MONTHS` is duplicated** in the backend (`subscription.util.ts`) and `SubscriptionView.tsx`.
26. **Word Mode trusts the browser** the same way Sentence Mode does: `/word/complete` and `/word/lesson` accept whatever scores the client sends, and `/word/*` does not check Premium on the server.
27. **Word lessons are only as good as the AI.** The word in the target language, its article and the translation come from a free model with no review, and the 120-word list is a first draft. Check Bengali and the other languages by hand.
28. **A saved lesson is not refreshed** when the learner changes "My language" or level partway through; "Start over" makes a new one. Progress is stored per target language, not per native language.
29. **Photos are optional and in memory**: without `PEXELS_API_KEY` every word shows an emoji, and the photo cache is lost on restart (one Pexels request per word per run). Pexels asks for a credit; the lesson page shows one.
30. **Word Mode copies the mic logic** into `usePronunciation`; the Sentence practice page still has its own copy. A bug fixed in one must be fixed in the other, or the Sentence page should be moved onto the hook.
31. **Flashcards trust the browser** like the other modes: `/flashcards/complete` accepts any `known` count and pays +10 XP each call (no cap beyond the throttle), `mark` is client-driven, and `/flashcards/*` does not check Premium on the server.
32. **A saved deck is never refreshed.** Changing "My language" or level does not rewrite the cards (only the target language selects a different deck); "New words" is the only way, and it wipes that topic's marks. A deck can hold 10 to 14 cards when the AI falls short, even though the code comments say 15.
33. **Daily review is capped at 15 cards and walks topics in catalog order**, so cards from topics late in the list can starve behind early ones. Cards stay in the review until marked known (a flag alone keeps them there).
34. **Flashcards photo load.** The first topic grid after a server start looks up 18 covers, and a new deck looks up up to 15 photos, all in parallel; the cache is in memory only and Pexels failures are not cached. Without `PEXELS_API_KEY` the grid and cards show gradients with emoji.
35. **Flashcard marks and the deck are tied by array index.** `status` and `flagged` are parallel arrays to `cards`; anything that reorders or edits a stored deck must rewrite all three together. `mark` silently ignores a missing deck or an out-of-range index, so a stale tab can lose a click without any error.
36. **`review` is a reserved route id** (`/flashcards/review`); it is checked before topic lookup in the page, not in the catalog, so a topic with that id would be unreachable.
37. **Free-quota cost of Flashcards**: a new deck costs 1 to 3 OpenRouter requests (opening saved decks, marking and the Daily review cost none), so "New words" spends quota just like a Sentence session.
38. **Roleplay covers are stock photos, not illustrations.** The grid in the design uses illustrated covers; Pexels photos (or an emoji on a gradient without `PEXELS_API_KEY`) stand in, and the chat avatar is a crop of the same cover. Swap `cover` for fixed illustration URLs if you have them.
39. **Roleplay tasks are display-only.** The AI is told the three tasks so it can create openings, but nothing tracks whether the learner did them; the check badge on the grid means "sent at least one message" in the current language. Saved chats are per language and are never refreshed when level or "My language" changes (Start over makes a new one).
40. **Roleplay trusts the browser and Premium is UI-only** like the other modes; each turn costs 2 OpenRouter requests (reply + review), so the free daily quota drains faster than in Chat.
41. **Roleplay migration was written by hand** (`20261020120000_roleplay_mode`) and the build was not run when it was added; run `npx prisma migrate dev` and both `npm run build`s before relying on it.
42. **Photo pictures are not in the repo.** Photo Mode needs `frontend/public/photo/1.jpg` ... `16.jpg`; a missing file shows a "picture is missing" message on the photo page and the AI call fails client-side before it starts. The picture is sent to the model as a base64 image on every judging (about 800 px), so it needs a vision-capable model (see Photo Mode). Premium is UI-only here too.
43. **Photo migration was written by hand** (`20261021090000_photo_mode`), so run `npx prisma migrate dev` in `backend/` to apply it. The old `PhotoPanel` + `POST /ai/photo` still exist but Home no longer opens them (`photo` is in the `router.push` list).

44. **Course paths are mostly generated.** Only "Absolute beginner 1" has hand-picked units; the other 31 courses reuse the same 120 words, 30 sentence skills and 21 dialogues in a rotation, so units repeat across courses and the titles do not always match the exercises. Course cards and exercise avatars use emoji on gradients (no illustrations).
45. **Course ids are duplicated.** `WORDS`, `SENTENCES` and `DIALOGUES` in `lib/courses.ts` copy ids from the backend catalogs. Renaming or removing a catalog id (which the catalogs already forbid) would break Learn links silently.
46. **Learn progress is borrowed.** Check marks and the percent are read from Word, Sentence and Dialogue progress, so the same exercise shows as done in every course that uses it, and Word progress is per target language. The selected course lives only in the browser's `localStorage`.
47. **Learn is UI-gated like everything else**: non-Premium users get the upsell on click, but the exercise URLs and the backend routes stay open.
48. **Learn was added without running `npm run build`** (no `node_modules` in that environment); run it, and click through Courses -> Learn -> an exercise, before relying on it. Tailwind classes written in `lib/` are not generated (its `content` globs only cover `app/` and `components/`), which is why the course gradients are in `CoursesView.tsx`.

49. **Explore was build-checked only** (`npx tsc` and `npm run build` pass); it was not clicked through in a browser. Word and Sentence tiles are emoji, not illustrations as in the design.

50. **Pixabay photos live on the API's disk** (`backend/media`). Deleting the folder just re-downloads them; on hosting with a read-only or temporary disk they are lost on redeploy. Pixabay allows 100 requests per minute and asks for results to be cached, which the index does. Saved flashcard decks keep the `/media/...` URL, so changing `PUBLIC_API_URL` later breaks old decks' pictures until the deck is renewed. The Pixabay path was typechecked but not run against the live API (no key in the build environment).

51. **Sentence lessons get stock photos; Characters get Wikipedia pictures.** Sentence: `backend/src/explore/photo-queries.ts` (`SENTENCE_PHOTO`) feeds `cover` in `GET /sentence/units` (null without a Pixabay/Pexels key); only Explore shows it. Characters: `characters.photos.ts` (`CharacterPhotoService`, titles in `CHARACTER_WIKI`) asks the Wikipedia API (no key) for each character's lead image and downloads it once to `backend/media/characters/<id>.jpg` (git-ignored, served at `/media/characters/<id>.jpg`); `GET /characters` returns it as `cover`. The first Characters load waits at most 8 s, the rest finish in the background, so a second load shows all of them; after a failure it retries after 10 minutes. A character whose article has no lead image keeps the emoji tile. Lead images are mostly public domain but not always, so the UI credits Wikipedia. Your own `public/characters/<id>.jpg` files still win when `NEXT_PUBLIC_CHARACTER_PORTRAITS=1`. To change a picture, put your own file at `backend/media/characters/<id>.jpg` (it is never overwritten) or change the title in `CHARACTER_WIKI`. Not run against the live Wikipedia API in the build environment (no access); the response parsing is unit-tested with a fake response.

## Working agreements for Claude

- Read the relevant file before editing; the code is compact and heavily interdependent (see Recipes).
- Prefer small, targeted diffs that follow the existing style (short one-line comments that explain why, no new dependencies without a reason).
- After backend changes run `npm run build` in `backend/`; after frontend changes run `npm run build` in `frontend/`. State clearly if you could not run them.
- Never commit secrets; `.env` and `.env.local` are git-ignored.
- Do not edit applied Prisma migrations or `package-lock.json` by hand.
