// routes/submit.js
const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { todayStr, getWordsOfDay } = require("../services/dailyService");
const { scoreSubmission } = require("../services/scoringService");
const { getStreakInfo } = require("../services/streakService");

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  const { wordLength, answers } = req.body || {};
  if (![4, 5, 6, 7].includes(wordLength)) {
    return res.status(400).json({ error: "wordLength must be 4, 5, 6, or 7" });
  }
  if (!answers || typeof answers !== "object" || Object.keys(answers).length !== 10) {
    return res.status(400).json({ error: "answers must be an object with exactly 10 category keys (blank values allowed for timed-out categories)" });
  }

  const date = todayStr();

  // One submission per word length per day — enforced here AND by the
  // UNIQUE(user_id, date, word_length) constraint in the DB as a hard backstop.
  const already = db.prepare(
    "SELECT id FROM submissions WHERE user_id = ? AND date = ? AND word_length = ?"
  ).get(req.user.id, date, wordLength);
  if (already) {
    return res.status(409).json({ error: "Already submitted for this word length today." });
  }

  const wordsOfDay = getWordsOfDay(date);
  const { word, rarity: wordRarityDaily } = wordsOfDay[wordLength];

  const categoriesWithAnswers = Object.entries(answers).map(([category, answer]) => ({ category, answer: String(answer || "").trim() }));
  const { rows, grandTotal, dailyPointsTotal, historicPointsTotal, slangPointsTotal } = await scoreSubmission(categoriesWithAnswers, wordRarityDaily);

  const streak = getStreakInfo(req.user.id);
  const doubleBonus = streak.unlocked_perks.includes("double_bonus");
  const wordBonus = Math.round(wordRarityDaily * 2 * (doubleBonus ? 2 : 1));
  const finalTotal = grandTotal + wordBonus;

  try {
    db.prepare(`
      INSERT INTO submissions
        (user_id, date, word_length, word, word_rarity_daily, categories_json, answers_json,
         score_breakdown_json, daily_points_total, historic_points_total, slang_points_total, total_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id, date, wordLength, word, wordRarityDaily,
      JSON.stringify(Object.keys(answers)), JSON.stringify(answers),
      JSON.stringify(rows), dailyPointsTotal, historicPointsTotal, slangPointsTotal, finalTotal
    );
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "Already submitted for this word length today." });
    }
    throw err;
  }

  res.status(201).json({
    date, wordLength, word, wordRarityDaily,
    rows, categoryPoints: grandTotal, wordBonus, doubleBonus, finalTotal
  });
});

module.exports = router;
