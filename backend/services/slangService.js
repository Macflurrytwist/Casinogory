// slangService.js
//
// No free service tags slang by world region, so regional coverage comes
// from a small curated seed dataset (data/regionalSlang.json). This is
// supplemented, where possible, by a live lookup against Urban
// Dictionary's unofficial (undocumented, unauthenticated) endpoint for a
// broader "internet slang" definition. Regional data always wins for the
// "Slang & Lingo (Worldwide)" category; Urban Dictionary is flavor only,
// and failures there are silently swallowed.

const REGIONAL_SLANG = require("../data/regionalSlang.json");

function findRegionalMatches(word) {
  const key = word.trim().toLowerCase();
  return REGIONAL_SLANG.filter(
    e => e.term.toLowerCase() === key || e.meaning.toLowerCase().includes(key)
  );
}

async function fetchUrbanDictionary(word) {
  try {
    const res = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RarityLedger/1.0)" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.list || !data.list.length) return null;
    const top = data.list.sort((a, b) => (b.thumbs_up || 0) - (a.thumbs_up || 0))[0];
    return { definition: top.definition, example: top.example, source: "Urban Dictionary" };
  } catch (err) {
    return null;
  }
}

/**
 * Returns whatever regional/slang context exists for a word, for display
 * in the "Slang & Lingo (Worldwide)" category and for the slang-match
 * scoring bonus.
 */
async function getSlangContext(word) {
  const regional = findRegionalMatches(word);
  const urban = await fetchUrbanDictionary(word);
  return { regional, urban };
}

/**
 * True if a player's free-text answer matches a curated regional slang
 * term — used to award the regional-slang scoring bonus.
 */
function matchesRegionalSlang(answer) {
  const key = answer.trim().toLowerCase();
  return REGIONAL_SLANG.find(e => e.term.toLowerCase() === key) || null;
}

module.exports = { getSlangContext, matchesRegionalSlang };
