# The Rarity Ledger / CASINOGORY — Backend

Real accounts, daily word/category generation, Google Ngram + slang
enrichment, and login-streak perks, for the CASINOGORY slot-machine
frontend (`frontend/index.html`).

## What's real vs. simulated

- **Accounts, sessions, one-submission-per-word-length-per-day, streaks,
  perks**: fully real, enforced in SQLite (a `UNIQUE(user_id, date,
  word_length)` constraint backstops the app-level check).
- **Historic rarity (Google Ngram)**: real. Calls the *unofficial* JSON
  endpoint the Ngram Viewer website itself uses
  (`books.google.com/ngrams/json?...`). Google doesn't publish an
  official, keyed API for this, so:
  - it isn't rate-limited, versioned, or guaranteed stable by Google, and
    can break or start blocking scripted traffic without notice;
  - its book corpus currently covers roughly 2000–2019/2022, not through
    2026 — there's no public corpus for 2023–2026 yet. Recent-year
    coverage is approximated by the same fallback heuristic used when
    the live call fails.
  - results are cached in `ngram_cache` so repeat lookups don't re-hit
    the endpoint.
- **Regional slang/lingo**: no free API tags slang by world region, so
  regional coverage comes from a small curated seed file
  (`data/regionalSlang.json`, ~40 terms across ~15 regions — expand this
  freely). It's supplemented by a live, best-effort lookup against Urban
  Dictionary's unofficial endpoint for general "internet slang" flavor
  (no regional data, and failures are silently ignored).
- **Same-day answer rarity**: a simple heuristic (word length, uncommon
  letters, common-word check) — instant, no network dependency by design.

## Setup

```bash
cd backend
npm install
npm start        # listens on http://localhost:4000
```

Requires Node 18+ (for global `fetch`). Set `JWT_SECRET` and `PORT` env
vars for anything beyond local dev. The SQLite file (`rarity_ledger.db`)
is created automatically on first run.

Then open `frontend/index.html` in a browser (or serve it) with the
backend running — the frontend auto-detects it at `http://localhost:4000`
and uses it. If it can't reach the backend within ~2.5s, it transparently
switches to an in-browser local-demo mode with the same game logic, so
the game is still fully playable standalone.

## API

All authenticated routes take `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | `{name, email, password}` → `{token, user, streak}` |
| POST | `/api/auth/login` | `{email, password}` → `{token, user, streak}`. Updates the login streak. |
| GET  | `/api/auth/me` | Current user + streak |
| GET  | `/api/daily/status` | Today's slot order, which lengths this user already submitted, whether the 7-letter reel is unlocked |
| POST | `/api/daily/spin` | `{wordLength}` → reveals the word, its daily rarity, and 20 categories. 403 if 7-letter and not unlocked; 409 if already submitted today for that length. |
| POST | `/api/daily/swap-category` | `{wordLength, currentCategories, categoryIdToReplace}` → swaps one category for another from the 118-entry background bank |
| POST | `/api/submit` | `{wordLength, answers: {category: answer, ...}}` (exactly 10) → full scoring breakdown. Enforces one submission per word length per day. |
| GET  | `/api/stats` | Streak, unlocked perks, next perk, submission history |
| POST | `/api/daily/confirm-categories` | `{wordLength, categories}` (the chosen 10) → server-computed `timeLimitSeconds` for the answer round |
| GET  | `/api/leaderboard` | Public. Query params: `scope` (`today`\|`alltime`), `metric` (`daily`\|`historic`\|`overall`), `wordLength` (`4`\|`5`\|`6`\|`7`\|`all`), `limit` |

## Timer ("fair but challenging")

Computed server-side once the player locks in their 10 categories
(`services/timerService.js`), so a tampered client can't grant itself
extra time — that matters once scores feed a public leaderboard.

Baseline: 12s × 10 categories = **120s**, then adjusted:
- word length: 4-letter −10s, 5-letter +0s, 6-letter +10s, 7-letter +30s
  (a longer word is harder to free-associate from)
- +5s for each *selected* category that's length-specific (e.g. "Six-Letter
  Countries" takes more thought than "Movies")
- clamped to 60s–240s overall

Unanswered categories at time-out are submitted as blank and scored as
"Skipped" (zero points) rather than rejected — see `scoringService.js`.

## Leaderboards

`routes/leaderboard.js`. Two scopes × three metrics:
- **Today** — one row per submission made today, ranked by the chosen
  metric, optionally filtered to one word length.
- **All-time** — one row per player, summing the chosen metric across
  every submission they've ever made.
- **Metrics**: `daily` (same-day rarity heuristic points), `historic`
  (Google Ngram-derived points — this is the "historic rarity"
  leaderboard), `overall` (full score including word-of-day and slang
  bonuses).

No auth required to view — leaderboards are public by design. The
`daily_points_total` / `historic_points_total` / `slang_points_total`
columns on `submissions` are populated at submit time so these queries
are cheap aggregates, not JSON parsing.

## Data model

- `users` — name, email, bcrypt password hash, `last_login_date`,
  `current_streak`, `longest_streak`, `unlocked_perks` (JSON array).
- `submissions` — one row per (user, date, word_length); stores the word,
  its daily rarity, the 10 categories/answers, the full score breakdown,
  and the total. The unique constraint is what actually enforces "one
  submission per word length."
- `ngram_cache` — memoizes historic-rarity lookups by word.

## Streak perks (`services/streakService.js`)

| Streak | Unlocks |
|---|---|
| 3 days | Bronze machine trim |
| 7 days | Silver machine trim **and** the 7-letter reel |
| 14 days | Gold machine trim |
| 30 days | Legendary neon trim **and** a doubled word-of-day bonus |

Add more tiers by extending `PERK_TIERS` — the frontend already reads
whatever comes back in `unlocked_perks`.

## Extending the category bank

`data/categoryBank.js` holds 118 categories: ~98 "universal" (fit any
word length) and 20 tagged `onlyLengths` for a specific length. The
daily generator (`services/dailyService.js`) filters to what fits the
day's word length, shuffles deterministically by date, and takes 20 —
so every player sees the same 20 on a given day. If a shown category
turns out not to work for the actual word, `/daily/swap-category` pulls
the next fitting one from the same deterministic pool. Add more entries
to either array to grow the background pool further.

## Deploying this as a real website

There's no way for me (Claude, in this chat) to publish to the live
internet directly — this sandbox has no outbound network and nothing I
create here persists on a public URL. But the app is built to deploy in
one piece: `server.js` already serves the frontend as static files
(`app.use(express.static(...))`), so one deployment covers both.

**Fastest path (Render, free tier to start):**
1. Push this whole project to a GitHub repo.
2. On Render: New → Blueprint → point at the repo. It reads `render.yaml`
   at the project root and provisions the web service, a persistent
   1GB disk for the SQLite file, and a generated `JWT_SECRET`
   automatically.
3. Render gives you a `*.onrender.com` URL immediately. Add a custom
   domain under that service's Settings once you own one (any registrar
   — Namecheap, Google Domains successor Squarespace Domains, etc.) by
   pointing a CNAME at it.

**Alternatives:**
- **Railway or Fly.io** — same Dockerfile works with minimal changes;
  both offer persistent volumes for SQLite similarly to Render's disk.
- **A plain VPS** (DigitalOcean, Hetzner, AWS Lightsail) — `docker build`
  + `docker run`, or run `node server.js` directly behind nginx/Caddy for
  TLS. More setup, more control, no cold starts.
- **Split hosting** — frontend on Vercel/Netlify, backend elsewhere —
  works too, just remember to hardcode `API_BASE` in `frontend/index.html`
  to the backend's real URL instead of relying on same-origin `/api`.

**Before real users touch it:**
- Rotate `JWT_SECRET` to a real secret (Render's `generateValue: true`
  already does this).
- Move off the free tier before traffic matters — free instances on most
  of these platforms sleep after inactivity, which means a cold first
  request.
- SQLite is genuinely fine at this scale (thousands of daily users), but
  if this grows past one server instance, migrate to hosted Postgres —
  the query shapes in `routes/*.js` are simple enough to port directly.
- Decide what to do about the unofficial Ngram/Urban Dictionary
  endpoints at real traffic volumes — they're not built for that and may
  rate-limit or block you; the app degrades gracefully either way, but
  it's worth monitoring.

**If you'd rather have hands-on help shipping this** — wiring up the
GitHub repo, walking through the actual Render/Railway dashboard, buying
and pointing a domain — that's a good fit for Claude Code or the Claude
desktop app, where I can run real commands against your accounts instead
of just writing files for you to copy. Happy to keep working here too if
you'd rather paste commands yourself as we go.

## Known limitations / next steps

- No email verification — signup is instant, matching the earlier
  prototype's scope.
- The Ngram and Urban Dictionary calls are unofficial/unauthenticated
  endpoints. For a production launch, budget time to either get proper
  licensed access to n-gram frequency data (e.g. a corpus license or a
  paid frequency-data API) or accept the stability risk.
- Category "fit" is currently just a word-length filter. If you want
  actual semantic fit-checking (e.g. rejecting "Chemical Elements" for a
  word with no plausible connection), that needs an LLM- or
  dictionary-based relevance check per (category, word) pair — flagged
  here as a real gap, not simulated.
