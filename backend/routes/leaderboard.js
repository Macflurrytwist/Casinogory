// routes/leaderboard.js
const express = require("express");
const db = require("../db");
const { todayStr } = require("../services/dailyService");

const router = express.Router();

const METRIC_COLUMN = {
  daily: "daily_points_total",
  historic: "historic_points_total",
  overall: "total_score"
};

/**
 * GET /api/leaderboard?scope=today|alltime&metric=daily|historic|overall&wordLength=4|5|6|7|all
 *
 * scope=today   -> one row per submission made today (optionally filtered
 *                   to one word length), ranked by the chosen metric.
 * scope=alltime -> one row per user, summing the chosen metric across
 *                   every submission they've ever made.
 *
 * No auth required — leaderboards are public by nature. Names shown are
 * the account's display name (not email).
 */
router.get("/", (req, res) => {
  const scope = req.query.scope === "alltime" ? "alltime" : "today";
  const metric = ["daily", "historic", "overall"].includes(req.query.metric) ? req.query.metric : "daily";
  const wordLength = req.query.wordLength && req.query.wordLength !== "all" ? parseInt(req.query.wordLength, 10) : null;
  const column = METRIC_COLUMN[metric];
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

  if (scope === "today") {
    const date = todayStr();
    let sql = `
      SELECT u.name AS name, s.word AS word, s.word_length AS wordLength,
             s.${column} AS points, s.date AS date
      FROM submissions s JOIN users u ON u.id = s.user_id
      WHERE s.date = ?`;
    const params = [date];
    if (wordLength) { sql += " AND s.word_length = ?"; params.push(wordLength); }
    sql += ` ORDER BY s.${column} DESC LIMIT ?`;
    params.push(limit);
    const rows = db.prepare(sql).all(...params);
    return res.json({ scope, metric, wordLength: wordLength || "all", date, rows: addRank(rows) });
  }

  // all-time: sum the metric per user across every submission
  let sql = `
    SELECT u.name AS name, SUM(s.${column}) AS points, COUNT(*) AS submissions
    FROM submissions s JOIN users u ON u.id = s.user_id`;
  const params = [];
  if (wordLength) { sql += " WHERE s.word_length = ?"; params.push(wordLength); }
  sql += ` GROUP BY s.user_id ORDER BY points DESC LIMIT ?`;
  params.push(limit);
  const rows = db.prepare(sql).all(...params);
  res.json({ scope, metric, wordLength: wordLength || "all", rows: addRank(rows) });
});

function addRank(rows) {
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

module.exports = router;
