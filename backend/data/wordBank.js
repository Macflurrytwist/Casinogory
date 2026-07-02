// wordBank.js
// Simulated baseline rarity (1-100) per word, used as a fallback when the
// live Google Ngram lookup fails or is unavailable. Real historic rarity
// is computed at runtime by services/ngramService.js.

const WORDS = {
  4: [
    { word: "TIME", rarity: 5 }, { word: "LOVE", rarity: 8 }, { word: "GAME", rarity: 10 },
    { word: "BOOK", rarity: 12 }, { word: "FISH", rarity: 15 }, { word: "MOON", rarity: 18 },
    { word: "GOLD", rarity: 22 }, { word: "WOLF", rarity: 28 }, { word: "EPIC", rarity: 35 },
    { word: "JADE", rarity: 44 }, { word: "YOGA", rarity: 52 }, { word: "QUIZ", rarity: 60 },
    { word: "NULL", rarity: 66 }, { word: "IBEX", rarity: 88 }, { word: "ONYX", rarity: 92 }
  ],
  5: [
    { word: "HOUSE", rarity: 4 }, { word: "WATER", rarity: 5 }, { word: "HEART", rarity: 7 },
    { word: "MUSIC", rarity: 9 }, { word: "DREAM", rarity: 12 }, { word: "GHOST", rarity: 18 },
    { word: "MAGIC", rarity: 15 }, { word: "TIGER", rarity: 20 }, { word: "STORM", rarity: 22 },
    { word: "QUERY", rarity: 32 }, { word: "ZEBRA", rarity: 42 }, { word: "IVORY", rarity: 55 },
    { word: "WALTZ", rarity: 62 }, { word: "EPOXY", rarity: 70 }, { word: "JAZZY", rarity: 80 }
  ],
  6: [
    { word: "FRIEND", rarity: 5 }, { word: "GARDEN", rarity: 10 }, { word: "ORANGE", rarity: 14 },
    { word: "WINTER", rarity: 13 }, { word: "PLANET", rarity: 16 }, { word: "DRAGON", rarity: 20 },
    { word: "PUZZLE", rarity: 26 }, { word: "GALAXY", rarity: 30 }, { word: "VOYAGE", rarity: 36 },
    { word: "OXYGEN", rarity: 33 }, { word: "MYSTIC", rarity: 46 }, { word: "ZODIAC", rarity: 56 },
    { word: "QUARTZ", rarity: 64 }, { word: "WIZARD", rarity: 41 }, { word: "JACKAL", rarity: 72 }
  ],
  // Unlocked at a 7-day login streak.
  7: [
    { word: "FREEDOM", rarity: 8 }, { word: "JOURNEY", rarity: 14 }, { word: "MYSTERY", rarity: 18 },
    { word: "RAINBOW", rarity: 20 }, { word: "CRYSTAL", rarity: 25 }, { word: "ORCHARD", rarity: 32 },
    { word: "VINTAGE", rarity: 30 }, { word: "PHANTOM", rarity: 42 }, { word: "GRIFFIN", rarity: 58 },
    { word: "OBELISK", rarity: 70 }, { word: "PARADOX", rarity: 65 }, { word: "ZEALOUS", rarity: 78 }
  ]
};

module.exports = { WORDS };
