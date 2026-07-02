// routes/daily.js
const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { todayStr, getWordsOfDay, getSlotOrder, getCategoriesForLength, swapCategory } = require("../services/dailyService");
const { getSlangContext } = require("../services/slangService");
const { getStreakInfo } = require("../services/streakService");
const { computeTimeLimitSeconds } = require("../services/timerService");

const router = express.Router();

/** What the client needs to draw the slot machine: slot order, which
 * lengths this user has already submitted today (reel locks), and
 * whether the 7-letter reel is unlocked via streak perks. */
router.get("/status", requireAuth, (req, res) => {
  const date = todayStr();
  const slotOrder = getSlotOrder(date);
  const submittedToday = db.prepare(
    "SELECT word_length FROM submissions WHERE user_id = ? AND date = ?"
  ).all(req.user.id, date).map(r => r.word_length);

  const streak = getStreakInfo(req.user.id);
  const sevenUnlocked = streak.unlocked_perks.includes("seven_letter_reel");

  res.json({
    date,
    slotOrder,
    availableLengths: sevenUnlocked ? [4, 5, 6, 7] : [4, 5, 6],
    submittedLengths: submittedToday,
    streak
  });
});

/** Pull the lever on a chosen reel/length: reveals the word + 20
 * categories for today. Does not itself count as a submission — that
 * only happens once the player POSTs /api/submit. */
router.post("/spin", requireAuth, async (req, res) => {
  const { wordLength } = req.body || {};
  if (![4, 5, 6, 7].includes(wordLength)) {
    return res.status(400).json({ error: "wordLength must be 4, 5, 6, or 7" });
  }
  const date = todayStr();

  if (wordLength === 7) {
    const streak = getStreakInfo(req.user.id);
    if (!streak.unlocked_perks.includes("seven_letter_reel")) {
      return res.status(403).json({ error: "7-letter reel unlocks at a 7-day login streak" });
    }
  }

  const already = db.prepare(
    "SELECT id FROM submissions WHERE user_id = ? AND date = ? AND word_length = ?"
  ).get(req.user.id, date, wordLength);
  if (already) {
    return res.status(409).json({ error: "Already submitted for this word length today. One submission per word length per day." });
  }

  const wordsOfDay = getWordsOfDay(date);
  const { word, rarity: wordRarityDaily } = wordsOfDay[wordLength];
  const categories = getCategoriesForLength(date, wordLength);
  const slangContext = await getSlangContext(word);

  res.json({ date, wordLength, word, wordRarityDaily, categories, slangContext });
});

/** Manually flag a shown category as not workable for today's word — the
 * server swaps in the next fitting category from the background bank. */
router.post("/swap-category", requireAuth, (req, res) => {
  const { wordLength, currentCategories, categoryIdToReplace } = req.body || {};
  if (![4, 5, 6, 7].includes(wordLength) || !Array.isArray(currentCategories) || !categoryIdToReplace) {
    return res.status(400).json({ error: "wordLength, currentCategories[], and categoryIdToReplace are required" });
  }
  const date = todayStr();
  const updated = swapCategory(date, wordLength, currentCategories, categoryIdToReplace);
  res.json({ categories: updated });
});

/** Once the player has locked in their 10 categories, compute a fair-but-
 * challenging countdown for the answer round. Server-authoritative so a
 * tampered client can't grant itself extra time — the leaderboard is
 * only meaningful if the clock is trustworthy. */
router.post("/confirm-categories", requireAuth, (req, res) => {
  const { wordLength, categories } = req.body || {};
  if (![4, 5, 6, 7].includes(wordLength) || !Array.isArray(categories) || categories.length !== 10) {
    return res.status(400).json({ error: "wordLength and exactly 10 categories are required" });
  }
  const timeLimitSeconds = computeTimeLimitSeconds(wordLength, categories);
  res.json({ timeLimitSeconds, startedAt: new Date().toISOString() });
});

module.exports = router;
