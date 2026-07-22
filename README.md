# CASINOGORY Discord Bot

Lets people play the daily round directly in a Discord server — `/play`
pulls a reel, picks categories via a native Discord select menu, answers
via two modals, and auto-submits at the server-computed timer, exactly
like the website. Every play counts toward the same accounts, streaks,
and leaderboard as the web game — there's no separate Discord-only
scoring system.

## Part 1 — Create the Discord application (only you can do this part)

I can't create a Discord application or generate a bot token on your
behalf — that requires your own Discord account and accepting Discord's
terms directly. It's about 5 minutes:

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → name it (e.g. "Casinogory")
2. Left sidebar → **Bot** → **Reset Token** → copy it. This is `DISCORD_TOKEN` — treat it like a password, never commit it.
3. On the same Bot page: no privileged intents needed (the bot never
   reads message content — everything is slash commands, buttons, select
   menus, and modals). Leave Presence/Server Members/Message Content
   intents off.
4. Left sidebar → **General Information** → copy **Application ID**.
   This is `DISCORD_CLIENT_ID`.
5. Left sidebar → **OAuth2 → URL Generator** → check scopes `bot` and
   `applications.commands` → under Bot Permissions check *Send Messages*,
   *Embed Links*, *Use Slash Commands*. Copy the generated URL, open it,
   and invite the bot to your server.
6. (Optional, for instant command updates while testing) In Discord,
   enable Developer Mode (User Settings → Advanced), right-click your
   server icon → **Copy Server ID**. That's `DISCORD_GUILD_ID`.

## Part 2 — Configure and run

```bash
cd discord-bot
cp .env.example .env
```

Fill in `.env`:
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` from Part 1
- `GAME_API_BASE` — your live backend URL + `/api`, e.g.
  `https://casinogory.onrender.com/api`
- `DISCORD_BOT_SHARED_SECRET` — invent any long random string, and set
  the **exact same value** as `DISCORD_BOT_SHARED_SECRET` on the
  **backend's** environment variables (Render dashboard → your web
  service → Environment). This is what lets the backend trust that
  account-creation requests really came from your bot.

Then:

```bash
npm install
npm run deploy-commands   # registers /play, /leaderboard, /stats, /link
npm start
```

(On Render, both of these run automatically on every deploy — see Part 3.)

If `DISCORD_GUILD_ID` is set, commands appear in that server instantly.
Leave it blank for global commands (takes up to ~1 hour to propagate
everywhere, but then works in every server the bot is added to).

## Part 3 — Deploy it so it stays online

This needs to run continuously (it holds a live connection to Discord),
so it can't just run on your laptop long-term. `render.yaml` at the
project root already defines it as a second Render service
(`casinogory-discord-bot`, a background worker — no public URL needed).

If you deployed the backend via the Render Blueprint already, the bot
service was created alongside it but left unconfigured (its env vars are
marked `sync: false` — Render won't guess secrets for you). Go to that
service in the Render dashboard → **Environment** → fill in the five
values from Part 2 → it deploys automatically.

## How it works, briefly

- `/play` → `ensureAccountReal()` calls the backend's `/api/auth/discord`
  (protected by the shared secret) to find-or-create a game account tied
  to the player's Discord ID, then shows reel buttons from
  `/api/daily/status`.
- Reel button → `/api/daily/spin` → the word + 20 categories.
- The category picker is a native Discord select menu with
  `minValues = maxValues = 10`, so Discord itself enforces "exactly 10."
- `/api/daily/confirm-categories` gets the server-computed timer; the
  deadline is shown via Discord's `<t:UNIX:R>` live-updating relative
  timestamp — no polling needed for the countdown to look live.
- Answers are collected via two 5-field modals (Discord's hard limit is
  5 text inputs per modal).
- A `setTimeout` mirrors the timer and auto-submits with whatever was
  filled in if the player doesn't finish in time — identical to the
  website's behavior, and it's the same `/api/submit` endpoint either way.
- Every submission also posts a short public "flex" message to the
  channel — this is the intended growth loop, borrowed from how Wordle's
  share button works.
- `/link <code>` — a player who already has a web account generates a
  code from their Stats page and redeems it here, so their Discord plays
  count toward that same account/streak instead of a separate
  auto-created one. If that Discord ID already has real play history
  under a different (guest) account, linking is refused rather than
  silently losing that history.

## Known limitations

- In-progress rounds live in the bot process's memory
  (`sessions` Map) — a bot restart mid-round loses that round's progress
  (nothing is scored until final submit, so nothing incorrect gets
  recorded, the player just has to `/play` again).
- Single-process only. If this bot ever needs to run across multiple
  processes/shards for scale, the session store needs to move to
  something shared (Redis, or the same SQLite database) instead of an
  in-memory Map.
- `/leaderboard` and `/stats` are separate slash commands rather than
  buttons inside `/play`, to keep each interaction's response time
  comfortably under Discord's 3-second ack window.
