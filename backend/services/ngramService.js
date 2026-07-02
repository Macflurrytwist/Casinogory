// ngramService.js
//
// Google doesn't publish an official, keyed Ngram API. The Ngram Viewer
// website itself exposes an unofficial JSON endpoint that the viewer's own
// frontend calls — this is what's used below. It is not guaranteed stable,
// is not rate-limited/documented by Google, and can break or block
// scripted traffic without notice. Treat it as best-effort enrichment, not
// a dependency the app requires to function — every call has a fallback.
//
// Endpoint shape (confirmed working as of this writing):
//   https://books.google.com/ngrams/json?content=WORD&year_start=2000&year_end=2019&corpus=26&smoothing=0
//   corpus=26 is the English (2019) corpus. Coverage currently runs through
//   ~2019/2022 depending on corpus version — it does NOT yet include
//   2023-2026, so "the 2000-2026 period" the brief asks for is necessarily
//   blended: 2000-2019 from real Ngram data, 2020-2026 approximated from
//   the wordBank fallback rarity until a corpus with that coverage exists.

const db = require("../db");
const { WORDS } = require("../data/wordBank");

const FLAT_FALLBACK = {};
Object.values(WORDS).flat().forEach(w => { FLAT_FALLBACK[w.word.toUpperCase()] = w.rarity; });

function rarityFromFrequency(freq) {
  if (!freq || freq <= 0) return 97;
  const logf = Math.log10(freq);
  const clamped = Math.max(-8, Math.min(-3, logf));
  const t = (clamped - -8) / (-3 - -8); // 0 = rare end, 1 = common end
  return Math.max(1, Math.min(99, Math.round((1 - t) * 98) + 1));
}

function getCached(word) {
  const row = db.prepare("SELECT * FROM ngram_cache WHERE word = ?").get(word.toUpperCase());
  return row || null;
}

function setCached(word, rarity, avgFreq) {
  db.prepare(`
    INSERT INTO ngram_cache (word, historic_rarity, avg_frequency, fetched_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(word) DO UPDATE SET historic_rarity=excluded.historic_rarity,
      avg_frequency=excluded.avg_frequency, fetched_at=excluded.fetched_at
  `).run(word.toUpperCase(), rarity, avgFreq);
}

/**
 * Returns a 1-100 historic-rarity score for a word, based on its average
 * printed-book frequency from 2000-2019 (real Ngram data where reachable),
 * falling back to the simulated wordBank/heuristic value if the live
 * lookup fails for any reason (offline, blocked, unknown word, etc).
 */
async function getHistoricRarity(word) {
  const key = word.trim().toUpperCase();
  if (!key) return 50;

  const cached = getCached(key);
  if (cached) return cached.historic_rarity;

  try {
    const url = `https://books.google.com/ngrams/json?content=${encodeURIComponent(key.toLowerCase())}&year_start=2000&year_end=2019&corpus=26&smoothing=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RarityLedger/1.0)" }
    });
    if (!res.ok) throw new Error("ngram http " + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0 || !data[0].timeseries) {
      throw new Error("no ngram series for word");
    }
    const series = data[0].timeseries;
    const avg = series.reduce((a, b) => a + b, 0) / series.length;
    const rarity = rarityFromFrequency(avg);
    setCached(key, rarity, avg);
    return rarity;
  } catch (err) {
    // Offline, blocked, or unknown word — fall back to the simulated
    // corpus value so the game still functions without live network access.
    const fallback = FLAT_FALLBACK[key] ?? estimateFallbackRarity(key);
    setCached(key, fallback, null);
    return fallback;
  }
}

function estimateFallbackRarity(word) {
  const rareLetters = ["Q", "X", "Z", "J", "K", "W", "V"];
  let score = 20 + Math.max(0, word.length - 4) * 4;
  for (const ch of word) if (rareLetters.includes(ch)) score += 10;
  return Math.max(1, Math.min(99, score));
}

module.exports = { getHistoricRarity, rarityFromFrequency };
