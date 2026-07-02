// timerService.js
//
// "Fair but challenging" target: enough time to genuinely think of 10
// connected answers, not enough to comfortably look everything up.
// Baseline is drawn from real category-game norms (Scattergories gives
// ~2 minutes for 12 prompts with a single starting letter already fixed,
// which is an easier constraint than "connect to this specific word").
// Baseline here: 12s/category for 10 categories = 120s, then adjusted for:
//   - word length: a longer word-of-day is harder to free-associate from,
//     so longer lengths get modestly more time.
//   - category difficulty: length-specific categories (tagged onlyLengths
//     in the bank, e.g. "Six-Letter Countries") take more thought than
//     universal ones, so each selected one adds a small bonus.

const BASE_SECONDS_PER_CATEGORY = 12;
const CATEGORY_COUNT = 10;
const LENGTH_ADJUSTMENT = { 4: -10, 5: 0, 6: 10, 7: 30 };
const DIFFICULT_CATEGORY_BONUS = 5;
const MIN_SECONDS = 60;
const MAX_SECONDS = 240;

/**
 * @param {number} wordLength - 4, 5, 6, or 7
 * @param {Array<{onlyLengths: number[]|null}>} selectedCategories - the 10 chosen categories
 */
function computeTimeLimitSeconds(wordLength, selectedCategories) {
  const base = BASE_SECONDS_PER_CATEGORY * CATEGORY_COUNT;
  const lengthAdj = LENGTH_ADJUSTMENT[wordLength] ?? 0;
  const hardCount = (selectedCategories || []).filter(c => c && c.onlyLengths).length;
  const total = base + lengthAdj + hardCount * DIFFICULT_CATEGORY_BONUS;
  return Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, total));
}

module.exports = { computeTimeLimitSeconds };
