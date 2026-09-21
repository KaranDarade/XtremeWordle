# Bubble Wordle

A multi-game daily word-puzzle site (Wordle, Spelling Bee, Connections and more) built with
Next.js 16, TypeScript, Tailwind CSS v4 and PostgreSQL/Prisma. Comes with an admin dashboard for
users, game data, word lists and daily/12-hourly word scheduling.

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

| Command                           | What it does                                                |
| --------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                     | Start the dev server                                        |
| `npm run build` / `npm run start` | Production build and serve                                  |
| `npm run verify`                  | Lint + typecheck + unit/integration tests                   |
| `npm run test:coverage`           | Unit/integration tests with a coverage report for `src/lib` |
| `npm run test:e2e`                | Playwright end-to-end tests (builds and serves production)  |
| `npm run db:migrate`              | Create/apply a new Prisma migration                         |
| `npm run db:deploy`               | Apply pending migrations (production)                       |
| `npm run db:seed`                 | Seed admin, games, word lists and puzzles                   |
| `npm run db:studio`               | Browse the database in Prisma Studio                        |

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

Request-scoped code (`src/lib/auth/actions.ts`, the DAL, Server Actions) is exercised through E2E
rather than unit tests, which is why `npm run test:coverage` targets `src/lib` logic and is not a
whole-project percentage.

## Production checklist

1. Provision PostgreSQL and set every variable from `.env.example` (use strong, unique secrets and a
   non-default `ADMIN_PASSWORD`).
2. Apply migrations: `npm run db:deploy`.
3. Seed the admin, games and word lists: `npm run db:seed` (safe to re-run — it upserts).
4. Deploy to Vercel; `vercel.json` registers the midnight cron automatically.
5. Add the external 12-hour scheduler pointing at
   `https://<domain>/api/cron/rotate-words?secret=<CRON_SECRET>`.
6. Change `ADMIN_PASSWORD` after the first sign-in, and confirm `/api/health` is green.
7. Run `npm run verify:full` locally before promoting a release.

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
