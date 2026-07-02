// dailyService.js
// Everything here is seeded from the calendar date only, so every player
// who opens the app on a given day gets the identical slot arrangement,
// words, and category pool — no per-player randomness.

const { WORDS } = require("../data/wordBank");
const { CATEGORY_BANK, fitsLength } = require("../data/categoryBank");

function hashStringToInt(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Deterministic word-of-day for every length, for a given date string. */
function getWordsOfDay(dateStr) {
  const seed = hashStringToInt("rarity-ledger:words:" + dateStr);
  const rng = mulberry32(seed);
  const out = {};
  [4, 5, 6, 7].forEach(len => {
    const list = WORDS[len];
    const idx = Math.floor(rng() * list.length);
    out[len] = list[idx];
  });
  return out;
}

/** Deterministic slot order (which reel position reveals which length). */
function getSlotOrder(dateStr) {
  const seed = hashStringToInt("rarity-ledger:slots:" + dateStr);
  const rng = mulberry32(seed);
  return seededShuffle([4, 5, 6], rng);
}

/**
 * The day's 20 categories for a given word length. Filters the 118-entry
 * background bank down to categories that fit this length, shuffles
 * deterministically, and takes 20. If the day's actual word makes a
 * category impossible to answer in a way the length-based filter didn't
 * catch, callers can request a replacement (see swapCategory below) —
 * pulled randomly from the remaining fitting pool, still deterministic
 * per (date, length, slotIndex) so re-fetching the same swap is stable.
 */
function getCategoriesForLength(dateStr, length) {
  const fitting = CATEGORY_BANK.filter(c => fitsLength(c, length));
  const seed = hashStringToInt("rarity-ledger:cats:" + dateStr + ":" + length);
  const rng = mulberry32(seed);
  let shuffled = seededShuffle(fitting, rng);
  if (shuffled.length < 20) {
    // Backfill from the universal (any-length) pool if the fitting set
    // somehow runs short.
    const universal = CATEGORY_BANK.filter(c => !c.onlyLengths && !shuffled.includes(c));
    shuffled = shuffled.concat(seededShuffle(universal, rng));
  }
  return shuffled.slice(0, 20);
}

/**
 * Swap out one category (e.g. the player/UI flags it as not workable for
 * today's word) for the next unused fitting category from the background
 * bank, deterministically.
 */
function swapCategory(dateStr, length, currentTwenty, categoryIdToReplace) {
  const fitting = CATEGORY_BANK.filter(c => fitsLength(c, length));
  const seed = hashStringToInt("rarity-ledger:cats:" + dateStr + ":" + length);
  const rng = mulberry32(seed);
  const fullShuffle = seededShuffle(fitting, rng);
  const usedIds = new Set(currentTwenty.map(c => c.id));
  const replacement = fullShuffle.find(c => !usedIds.has(c.id));
  if (!replacement) return currentTwenty; // bank exhausted, extremely unlikely at 118 entries
  return currentTwenty.map(c => (c.id === categoryIdToReplace ? replacement : c));
}

module.exports = {
  todayStr, getWordsOfDay, getSlotOrder, getCategoriesForLength, swapCategory
};
