// scoringService.js
const { getHistoricRarity } = require("./ngramService");
const { matchesRegionalSlang } = require("./slangService");

const COMMON_WORDS = new Set([
  "THE", "CAT", "DOG", "RUN", "HAPPY", "MOVIE", "MUSIC", "LOVE", "TIME", "WATER",
  "HOUSE", "CAR", "SUN", "STAR", "APPLE", "BANANA", "PIZZA", "COFFEE", "SCHOOL",
  "BOOK", "PHONE", "TABLE", "CHAIR", "RED", "BLUE", "GREEN", "BALL", "TREE",
  "RAIN", "FRIEND", "SONG", "GAME", "SHOE", "SOCCER", "FOOTBALL", "BASKETBALL",
  "PARIS", "LONDON", "AMERICA", "FRANCE", "LION", "TIGER", "BEAR"
]);

/** Same-day "how uncommon does this look" heuristic — this is the fast,
 * always-available half of scoring (no network dependency). */
function estimateAnswerRarity(answer) {
  const a = (answer || "").trim();
  if (!a) return 0;
  const upper = a.toUpperCase();
  const lettersOnly = upper.replace(/[^A-Z]/g, "");
  let score = 18;
  score += Math.max(0, lettersOnly.length - 4) * 3;
  const rareLetters = ["Q", "X", "Z", "J", "K", "W", "V"];
  let rareCount = 0;
  for (const ch of lettersOnly) if (rareLetters.includes(ch)) rareCount++;
  score += rareCount * 11;
  const words = a.split(/\s+/).filter(Boolean);
  if (words.length > 1) score += 8;
  const vowels = (lettersOnly.match(/[AEIOU]/g) || []).length;
  const vowelRatio = lettersOnly.length ? vowels / lettersOnly.length : 0;
  if (vowelRatio < 0.3) score += 10;
  if (COMMON_WORDS.has(lettersOnly)) score = Math.min(score, 14);
  return Math.max(1, Math.min(99, Math.round(score)));
}

function tierFor(score) {
  if (score < 20) return { name: "Common", base: 10, css: "var(--slate)" };
  if (score < 45) return { name: "Uncommon", base: 25, css: "var(--rust)" };
  if (score < 75) return { name: "Rare", base: 50, css: "var(--brass)" };
  return { name: "Legendary", base: 90, css: "var(--seal)" };
}

/**
 * Full per-category score. Three independent components, so a rare
 * answer to a rare word-of-day is worth meaningfully more than a common
 * answer to a common word-of-day:
 *   1. dailyPoints    — how uncommon the answer itself looks (heuristic)
 *   2. wordBonusMult  — multiplier from today's word-of-day rarity
 *   3. historicPoints — the answer's own real-world rarity, 2000-2019 via
 *                        Google Ngram (async, falls back gracefully)
 *   4. slangBonus     — flat bonus if the answer matches a curated
 *                        regional slang term
 */
async function computeCategoryScore(categoryName, answer, wordRarityDaily) {
  const trimmed = (answer || "").trim();
  if (!trimmed) {
    return {
      category: categoryName, answer: "", dailyRarityScore: 0, tier: "Skipped",
      tierColor: "var(--slate)", dailyPoints: 0, historicRarity: 0, historicPoints: 0,
      slangMatch: null, slangBonus: 0, total: 0
    };
  }
  const dailyRarityScore = estimateAnswerRarity(answer);
  const tier = tierFor(dailyRarityScore);
  const wordBonusMult = 1 + wordRarityDaily / 100;
  const dailyPoints = Math.round(tier.base * wordBonusMult);

  const historicRarity = await getHistoricRarity(answer);
  const historicPoints = Math.round(historicRarity * 0.6);

  const slangMatch = matchesRegionalSlang(answer);
  const slangBonus = slangMatch ? 20 : 0;

  const total = dailyPoints + historicPoints + slangBonus;

  return {
    category: categoryName,
    answer,
    dailyRarityScore,
    tier: tier.name,
    tierColor: tier.css,
    dailyPoints,
    historicRarity,
    historicPoints,
    slangMatch: slangMatch ? { term: slangMatch.term, region: slangMatch.region } : null,
    slangBonus,
    total
  };
}

async function scoreSubmission(categoriesWithAnswers, wordRarityDaily) {
  const rows = await Promise.all(
    categoriesWithAnswers.map(({ category, answer }) =>
      computeCategoryScore(category, answer, wordRarityDaily)
    )
  );
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const dailyPointsTotal = rows.reduce((s, r) => s + r.dailyPoints, 0);
  const historicPointsTotal = rows.reduce((s, r) => s + r.historicPoints, 0);
  const slangPointsTotal = rows.reduce((s, r) => s + r.slangBonus, 0);
  return { rows, grandTotal, dailyPointsTotal, historicPointsTotal, slangPointsTotal };
}

module.exports = { estimateAnswerRarity, tierFor, computeCategoryScore, scoreSubmission };
