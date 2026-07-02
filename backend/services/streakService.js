// streakService.js
const db = require("../db");

// Streak thresholds and what they unlock. current_streak is counted in
// consecutive calendar days with at least one login.
const PERK_TIERS = [
  { days: 3, id: "bronze_border", label: "Bronze Machine Trim" },
  { days: 7, id: "silver_border", label: "Silver Machine Trim" },
  { days: 7, id: "seven_letter_reel", label: "7-Letter Reel Unlocked" },
  { days: 14, id: "gold_border", label: "Gold Machine Trim" },
  { days: 30, id: "legendary_border", label: "Legendary Neon Trim" },
  { days: 30, id: "double_bonus", label: "Double Word-of-Day Bonus" }
];

function isoDate(d) { return d.toISOString().slice(0, 10); }
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

/** Call on every successful login. Updates streak + unlocked perks. */
function updateLoginStreak(userId) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  const today = isoDate(new Date());
  let { current_streak, longest_streak, last_login_date } = user;

  if (last_login_date === today) {
    // already counted today, no change
  } else if (last_login_date && daysBetween(last_login_date, today) === 1) {
    current_streak += 1;
  } else {
    current_streak = 1;
  }
  longest_streak = Math.max(longest_streak, current_streak);

  const unlocked = PERK_TIERS.filter(p => current_streak >= p.days).map(p => p.id);

  db.prepare(`
    UPDATE users SET last_login_date=?, current_streak=?, longest_streak=?, unlocked_perks=?
    WHERE id=?
  `).run(today, current_streak, longest_streak, JSON.stringify(unlocked), userId);

  return { current_streak, longest_streak, unlocked_perks: unlocked };
}

function getStreakInfo(userId) {
  const user = db.prepare("SELECT current_streak, longest_streak, unlocked_perks FROM users WHERE id=?").get(userId);
  return {
    current_streak: user.current_streak,
    longest_streak: user.longest_streak,
    unlocked_perks: JSON.parse(user.unlocked_perks || "[]")
  };
}

module.exports = { updateLoginStreak, getStreakInfo, PERK_TIERS };
