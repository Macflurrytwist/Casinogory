// routes/stats.js
const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getStreakInfo, PERK_TIERS } = require("../services/streakService");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const streak = getStreakInfo(req.user.id);
  const history = db.prepare(`
    SELECT date, word_length, word, total_score
    FROM submissions WHERE user_id = ? ORDER BY date DESC, word_length ASC LIMIT 50
  `).all(req.user.id);

  const nextPerk = PERK_TIERS
    .filter(p => !streak.unlocked_perks.includes(p.id))
    .sort((a, b) => a.days - b.days)[0] || null;

  res.json({ streak, history, allPerkTiers: PERK_TIERS, nextPerk });
});

module.exports = router;
