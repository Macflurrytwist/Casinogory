// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { JWT_SECRET } = require("../middleware/auth");
const { updateLoginStreak, getStreakInfo } = require("../services/streakService");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Invalid email" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: "An account with that email already exists" });

  const hash = await bcrypt.hash(password, 10);
  const info = db.prepare(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
  ).run(name.trim(), email.toLowerCase(), hash);

  const streak = updateLoginStreak(info.lastInsertRowid);
  const token = jwt.sign({ id: info.lastInsertRowid, name, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: "30d" });
  res.status(201).json({ token, user: { id: info.lastInsertRowid, name, email }, streak });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  const streak = updateLoginStreak(user.id);
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email }, streak });
});

router.get("/me", require("../middleware/auth").requireAuth, (req, res) => {
  const streak = getStreakInfo(req.user.id);
  res.json({ user: req.user, streak });
});

module.exports = router;
