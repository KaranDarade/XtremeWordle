# Wordle Arena

A multi-game daily word-puzzle site (Wordle, Spelling Bee, Connections and more) built with
Next.js 16, TypeScript, Tailwind CSS v4 and PostgreSQL/Prisma. Its headline mode is **Wordle Arena**,
a real-time 1v1 duel where two players race the same word on the same clock. Comes with an admin
dashboard for users, game data, word lists, live matches and daily/12-hourly word scheduling.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill it in:

   ```bash
   cp .env.example .env
   ```

   Required variables:

   | Variable                                         | Purpose                                                                                              |
   | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`                                   | PostgreSQL connection string (app runtime + migrations)                                              |
   | `TEST_DATABASE_URL`                              | Separate database used by the test suite                                                             |
   | `SESSION_SECRET` / `SEED_SECRET` / `CRON_SECRET` | Generated secrets (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD`                 | Bootstraps the single admin account during seeding                                                   |
   | `NEXT_PUBLIC_SITE_URL`                           | Public base URL used for SEO/`metadataBase`                                                          |

3. Create the schema and seed the data:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Landing page: <http://localhost:3000> · Admin dashboard: <http://localhost:3000/admin>

## Scripts

| Command                           | What it does                                                 |
| --------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                     | Start the dev server                                         |
| `npm run build` / `npm run start` | Production build and serve                                   |
| `npm run verify`                  | Lint + typecheck + unit/integration tests                    |
| `npm run verify:full`             | `verify` plus the complete Playwright suite                  |
| `npm run test:coverage`           | Unit/integration tests with a coverage report for `src/lib`  |
| `npm run test:e2e`                | Fast Playwright run (skips `@heavy` tests; production build) |
| `npm run test:e2e:full`           | Every Playwright test, including `@heavy`                    |
| `npm run db:migrate`              | Create/apply a new Prisma migration                          |
| `npm run db:deploy`               | Apply pending migrations (production)                        |
| `npm run db:seed`                 | Seed admin, games, word lists and puzzles                    |
| `npm run db:studio`               | Browse the database in Prisma Studio                         |
| `npm run icons`                   | Regenerate app icons from `src/app/icon.svg`                 |
| `npm run loadtest`                | Probe the hot endpoints and report throughput/latency        |

## Wordle Arena (multiplayer)

Two players get the same word and race it out.

- **Six rounds, one guess per row, 12s play + 5s reveal** (configurable).
- Your current row stays private; finished rows are revealed to both players.
- **Solve first to win.** If nobody solves, the **closest guess** takes it
  (most greens, then most yellows, then the earlier submission). A true tie is a draw.
- Guests can duel but matches are **casual** — rank points only move when both
  players are signed in.
- A **bot** (`Byte`) fills in when nobody is queued; bot matches are casual too.
- Reactions: 😂 😭 😡 🔥 👏, rate-limited to one every ~1.5s.

### How it stays worker-free

Match state is **derived from timestamps** (`src/lib/arena/clock.ts`): the round and
phase are computed from `startedAt` plus the configured durations, so any request —
including one arriving after a crash — can reconstruct exactly where a match is.
Bots are advanced lazily on each state read, and guesses are idempotent thanks to a
`(playerId, round)` unique constraint.

Realtime uses **polling with adaptive intervals** (fast during play, slower in the
reveal) behind the `/api/arena/match/[id]` endpoint. The countdown itself is drawn
locally from server timestamps, so the timer stays smooth without extra requests.

### Capacity

The game code is cheap; the **Postgres connection pool saturates first**.

| Environment                     | Comfortable concurrent players | First bottleneck                        |
| ------------------------------- | ------------------------------ | --------------------------------------- |
| Local, `npm run dev`            | ~100–300                       | pg pool (10 connections) + dev overhead |
| Local, `npm run start`, pool 25 | ~500–800                       | Postgres `max_connections`              |
| VPS + PgBouncer                 | ~1,000–3,000                   | database writes                         |
| Vercel + pooled Postgres        | scales with plan quotas        | function invocations                    |

Built-in mitigations: presence is heartbeated every 25s (not every poll), the online
count is cached in-process for 5s, and every hot path is indexed. Measure your own
ceiling with `npm run loadtest` against a production build.

## Accounts, avatars and leagues

- **Optional accounts.** Everything is playable signed out; signing in is what
  unlocks history, stats and rank.
- **Google sign-in** (OAuth 2.0 + PKCE). Google-only accounts have no password, and
  an existing email account is linked on first Google sign-in because Google has
  verified the address. Hidden until `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set.
- **Forgot password:** email → 6-digit OTP (hashed, 10-minute expiry, 5 attempts) →
  signed reset ticket → new password + captcha. All sessions are revoked on reset,
  and the endpoint never reveals whether an address is registered.
- **Captcha:** Cloudflare Turnstile, auto-bypassed when keys are absent so local
  development works without an account.
- **Mailer is pluggable** (`console` / `file` / `resend`); the console provider
  prints reset codes to the server log.
- **Avatars** are parametric faux-3D SVG — 12 categories, 150+ combinations, idle
  breath and blink. They animate on hero surfaces and render static in lists, and
  guests/bots get a deterministic avatar from their seed.
- **Leagues:** Bronze → Silver → Gold → Platinum → Diamond at 0/200/500/1000/2000
  points. Winning earns `30 × league multiplier` plus a bonus for solving early;
  losing costs 10; rank never drops below zero.

## How word rotation works

Every game has a **rotation bucket** computed in IST (`Asia/Kolkata`):

- `daily` → `YYYY-MM-DD`, rolling over at **00:00 IST**.
- `twelve-hour` → `YYYY-MM-DD-00` / `YYYY-MM-DD-12`, rolling over at **00:00 and 12:00 IST**.

Two mechanisms guarantee a word always exists:

1. **Deterministic fallback.** `resolvePuzzle()` derives an answer from
   `HMAC(SEED_SECRET, gameId + bucketKey)`, so any bucket resolves to the same word even if no
   scheduler ever runs.
2. **Admin overrides.** A word assigned in the dashboard is stored with `source = MANUAL` and is
   never overwritten by automation (unless an admin explicitly forces regeneration).

Wordle **Unlimited** draws from a pool snapshot stored per 12-hour bucket (`PoolRotation`) and skips
answers already served in that window, so a fresh set of words becomes available every 12 hours.

### Scheduler setup

The rotation endpoint is `GET|POST /api/cron/rotate-words`. It requires a secret, supplied either as
`Authorization: Bearer <CRON_SECRET>` (Vercel Cron does this automatically) or `?secret=<CRON_SECRET>`.

- **Vercel:** `vercel.json` registers `0 0 * * *` (midnight UTC). Vercel's Hobby plan only allows
  once-per-day schedules, which is always at least 6 hours after the IST midnight rollover.
- **12-hour refresh:** point an external scheduler (e.g. cron-job.org or Upstash QStash) at
  `https://<your-domain>/api/cron/rotate-words?secret=<CRON_SECRET>` twice a day. Because answers are
  deterministic, a missed run degrades nothing — it only means the row is materialised later.

Example manual run:

```bash
curl -X POST "http://localhost:3000/api/cron/rotate-words?secret=$CRON_SECRET"
```

A companion endpoint, `GET|POST /api/cron/cleanup`, finalises arena matches whose clock has run out
and prunes stale queue entries, presence rows and expired reset codes. It takes the same secret and is
also triggered opportunistically when the rotation cron or the admin arena page loads, so a missed run
degrades nothing.

## Security and operations

- **Sessions:** opaque tokens are hashed with SHA-256 before storage, delivered in an HTTP-only,
  `SameSite=Lax` cookie that is `Secure` in production.
- **CSRF:** JSON game APIs reject cross-origin `Origin` headers; Server Actions rely on Next.js's
  built-in origin checks.
- **Rate limiting:** 30 credential attempts per IP + email per 10 minutes (tune with
  `AUTH_RATE_LIMIT`), and per-IP limits on all game and cron endpoints. The limiter is in-process,
  so swap `src/lib/http/rate-limit.ts` for Redis/Upstash before running many instances.
- **Security headers:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and
  `Permissions-Policy` are set for every route in `next.config.ts`.
- **Health check:** `GET /api/health` returns `200` when the app can reach PostgreSQL and `503`
  otherwise — point your uptime monitor at it.

## Testing

Two layers, each doing what it is good at:

- **Vitest** (`tests/unit`, `tests/integration`) covers pure logic and database behaviour against a
  real PostgreSQL test database: rotation buckets, the word resolver, Wordle/Bee/Connections rules,
  cron auth, rate limiting, HTTP guards, validation and crypto helpers.
- **Playwright** (`tests/e2e`) drives the real UI against a production build: auth, the admin
  dashboard, all three games, guest→account migration, consent, SEO and automated
  [axe](https://github.com/dequelabs/axe-core) accessibility checks (WCAG 2.1 A/AA). A global
  teardown deletes the `@example.com` accounts each run creates, so the dev database does not drift.

Tests tagged **`@heavy`** (theme/avatar/responsive sweeps, full password-reset and replay flows) are
slower and are skipped by the default `npm run test:e2e`, which is what the inner dev loop should use.
Run `npm run test:e2e:full` (or `npm run verify:full`) before promoting a release.

The Playwright config's `webServer.env` overrides a few variables so the suite stays fast and
deterministic — `MAIL_PROVIDER=file` (writes reset codes to disk instead of the console), relaxed
`RESET_REQUESTS_PER_IP_PER_HOUR`/`AUTH_RATE_LIMIT`, a forced Turnstile bypass (blank keys, so the
reset flow stays offline even when real captcha keys are configured), and shortened arena timings
(`ARENA_ROUND_MS`/`ARENA_BREAK_MS`/`ARENA_COUNTDOWN_MS`/`ARENA_ROUND_COUNT`). These only affect the
test server; `npm run dev` uses the defaults from `src/lib/arena/config.ts`.

Request-scoped code (`src/lib/auth/actions.ts`, the DAL, Server Actions) is exercised through E2E
rather than unit tests, which is why `npm run test:coverage` targets `src/lib` logic and is not a
whole-project percentage.

## Production checklist

1. Provision PostgreSQL and set every variable from `.env.example` (use strong, unique secrets and a
   non-default `ADMIN_PASSWORD`).
2. Apply migrations: `npm run db:deploy`.
3. Seed the admin, games and word lists: `npm run db:seed` (safe to re-run — it upserts).
4. Deploy to Vercel; `vercel.json` registers the midnight rotation cron and the daily arena cleanup.
5. Add the external 12-hour scheduler pointing at
   `https://<domain>/api/cron/rotate-words?secret=<CRON_SECRET>`.
6. Change `ADMIN_PASSWORD` after the first sign-in, and confirm `/api/health` is green.
7. Run `npm run verify:full` locally before promoting a release.

## Deploying to Vercel

A standard Next.js deployment; the only non-obvious parts are Prisma and a build-time database read.

1. Create a **pooled** PostgreSQL database (Neon/Supabase/Vercel Postgres) reachable from Vercel.
   Set `DATABASE_URL` to the pooled string; keep the direct/unpooled string for migrations only.
2. Add every variable from `.env.example` to the Vercel project (Production **and** Preview).
   `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are inlined at build time, so they
   must exist **before** the first build. Never set `TEST_DATABASE_URL` in Vercel.
3. Apply the schema and seed once, against the direct URL:

   ```bash
   DATABASE_URL="<direct-url>" npx prisma migrate deploy
   DATABASE_URL="<direct-url>" npx prisma db seed
   ```

4. Deploy. `postinstall` runs `prisma generate` (the client under `src/generated` is not committed),
   and `vercel.json` registers the daily rotation and cleanup crons.
5. Point Google OAuth's redirect URI and the Cloudflare Turnstile widget hostname at the deployed
   domain, then run `npm run verify:full` locally before promoting.

`/sitemap.xml` is prerendered at build time, so the database must be reachable during `next build`
(it falls back to the static routes if the query fails).

## Architecture notes

- **Auth:** email + password (`bcrypt`), opaque session tokens hashed in the database, delivered in an
  HTTP-only cookie. Guest play is supported through a signed anonymous cookie, so signing in is
  optional.
- **Authorization:** `src/proxy.ts` (Next 16's renamed middleware) performs optimistic redirects for
  `/admin`, while the Data Access Layer in `src/lib/auth/dal.ts` enforces roles for real.
- **Admin dashboard:** overview KPIs, users, games, word schedule, word lists (with CSV import),
  analytics and an audit log of every admin mutation.
- **Theme:** `next-themes` with the `.dark` class, no flash before hydration.
- **Games:** the browser never receives the answer before the game ends. Guesses are validated
  server-side and the feedback grid is computed on the server, so the APIs are safe to call directly.
