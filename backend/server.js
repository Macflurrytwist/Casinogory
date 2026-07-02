// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const dailyRoutes = require("./routes/daily");
const submitRoutes = require("./routes/submit");
const statsRoutes = require("./routes/stats");
const leaderboardRoutes = require("./routes/leaderboard");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/daily", dailyRoutes);
app.use("/api/submit", submitRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Serve the frontend from the same server/port so a single deployment
// covers both — see ../frontend/index.html. Point a browser at "/" once
// this is deployed and it works with no separate static host needed.
app.use(express.static(path.join(__dirname, "..", "frontend")));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Rarity Ledger backend listening on http://localhost:${PORT}`);
});
