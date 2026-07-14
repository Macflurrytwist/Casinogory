# Deploying CASINOGORY — Live in ~20 Minutes

This gets the whole app (backend + frontend, one deployment) live at a
real URL on Render, using the `render.yaml` and `Dockerfile` already in
this repo. No code changes needed — just accounts, clicks, and a real
cost you should know about up front: **the backend runs on Render's
Starter plan (currently $7/month), not free.** That's not a config
choice — Render's persistent disks, which is what keeps your database
(accounts, scores, streaks) from being wiped on every restart, simply
aren't available on free web services at all. Trying to run this on the
free plan means the game *looks* like it's saving progress and then
loses it. `render.yaml` is already set to Starter for this reason.

The Discord bot, if you're deploying it too, stays on Render's free
plan — it holds no database, so it doesn't need a disk.

**Who this is for:** anyone with a terminal, whether that's you or a
developer you've handed this to. No prior familiarity with the project
required — every command is copy-pasteable as-is.

---

## 0. Prerequisites (10 minutes, one-time)

- A [GitHub](https://github.com) account (free)
- A [Render](https://render.com) account — sign up with GitHub, it's
  faster. You'll need a payment method on file once you apply the
  blueprint below, for the backend's Starter-plan instance.
- [Git](https://git-scm.com/downloads) installed. Check with:
  ```bash
  git --version
  ```
  If that fails, install it from the link above first.
- Node.js 18+ if you want to test locally before deploying (optional but
  recommended). Check with:
  ```bash
  node --version
  ```

---

## 1. Unzip and test locally (optional but recommended, 5 minutes)

```bash
unzip casinogory-fullstack.zip
cd rarity-ledger-app/backend
npm install
npm start
```

Open `http://localhost:4000` in a browser. Sign up, pull the lever, play
a round. If that all works, you're deploying working code — kill the
server (Ctrl+C) and move on.

---

## 2. Push the code to GitHub (5 minutes)

From the **`rarity-ledger-app`** folder (the one containing `Dockerfile`
and `render.yaml`):

```bash
cd rarity-ledger-app
git init
git add .
git commit -m "Initial commit — CASINOGORY"
```

Now create an empty repo on GitHub named `casinogory` (github.com → New
repository → don't initialize with a README) and connect it:

```bash
git remote add origin https://github.com/YOUR_USERNAME/casinogory.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username. It'll prompt
for a GitHub login the first time — follow its instructions (usually a
browser popup to authorize).

**No terminal? Use the website instead:** on the new repo's page, click
"uploading an existing file," drag the whole unzipped `rarity-ledger-app`
folder contents in, and commit. Skip straight to step 3.

---

## 3. Deploy to Render (5 minutes)

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect your GitHub account if prompted, then select the `casinogory` repo
3. Render reads `render.yaml` automatically and shows two services:
   `casinogory` (Docker, **Starter plan, $7/month**, 1GB persistent disk —
   this is what actually keeps the database) and
   `casinogory-discord-bot` (Docker, free plan, no disk). Click **Apply**.
4. First build takes 3-5 minutes. When it's done, Render shows a URL like
   `https://casinogory.onrender.com` — that's the live site.

Open it. Sign up for real, pull the lever, play a round, check the
leaderboard. That's the actual game, live, with a real database behind it.

---

## 4. (Optional) Point a real domain at it

If you own a domain already:
1. In Render, open the `casinogory` service → **Settings** → **Custom Domains** → **Add**
2. Enter your domain/subdomain, e.g. `play.yourdomain.com`
3. Render shows a CNAME record to add. Add it at your domain registrar
   (Namecheap, GoDaddy, Cloudflare, wherever the domain was bought)
4. Takes a few minutes to a few hours to propagate

Don't own one yet? Any registrar works — `.com` domains typically run
$10-15/year.

---

## Things to know before real people use it

- **The backend is on Starter, not free, and that's intentional.** No
  cold starts, no 15-minute spin-down, and — the actual reason —
  persistent disks (what saves your database) don't exist on Render's
  free web services at all. The Discord bot service can stay free since
  it has no database of its own.
- **JWT_SECRET is auto-generated** by the blueprint — don't need to touch it.
- **The database is SQLite on a persistent disk** — survives redeploys,
  fine for real usage at moderate scale, *as long as the backend stays
  on a paid plan*. If this ever needs to run on
  more than one server instance, it'll need to move to hosted Postgres
  first (flagged in `backend/README.md`).
- **The unofficial Ngram/Urban Dictionary lookups** may get rate-limited
  under real traffic — the app already degrades gracefully to its
  simulated fallback if that happens, so nothing breaks, but historic
  rarity scores may get less accurate under load.

## If something goes wrong

- Build fails on Render → check the build log (Render shows it live);
  most likely cause is a typo from manual file upload instead of git push
- App loads but signup fails → check the service's Logs tab in Render for
  the actual error
- Still stuck → `backend/README.md` has the fuller technical writeup, or
  paste the error back into the chat that produced this project
