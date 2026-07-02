// categoryBank.js
// The full background pool the server draws from to build each day's 20
// categories. Most categories fit any word length ("universal"). A subset
// are tagged onlyLengths — they only make sense for specific word lengths
// (e.g. "Six-Letter Countries") and are filtered out on days they don't fit.
// If fewer than 20 categories are valid for a given day's word length, the
// server backfills randomly from the universal pool (see dailyService.js).

const UNIVERSAL_CATEGORIES = [
  "Movies", "Countries", "Foods", "Animals", "Sports", "Celebrities", "Brands",
  "TV Shows", "Songs", "Books", "Video Games", "Cars", "Colors", "Occupations",
  "Historical Figures", "Superheroes", "Diseases", "Inventions", "Landmarks",
  "Drinks", "Desserts", "Musical Instruments", "Dances", "Holidays",
  "Mythical Creatures", "Board Games", "Emotions", "Weather Phenomena",
  "Planets & Space", "Dinosaurs", "Insects", "Flowers", "Gemstones",
  "Currencies", "Languages", "Sports Teams", "Fashion Brands",
  "Social Media Apps", "Kitchen Appliances", "Dog Breeds", "School Subjects",
  "Card Games", "Casino Games", "Cocktails", "Cheeses", "Pasta Shapes",
  "Spices", "Tools", "Furniture", "Music Genres", "Comic Book Characters",
  "Streaming Shows", "Podcasts", "Fictional Planets", "Constellations",
  "Ocean Creatures", "Birds", "Trees", "Rivers", "Mountains", "Deserts",
  "Islands", "World Capitals", "Religions", "Philosophers", "Scientists",
  "Painters", "Architecture Styles", "Fonts", "Programming Languages",
  "Operating Systems", "Airlines", "Fast Food Chains", "Ice Cream Flavors",
  "Candy Brands", "Yoga Poses", "Martial Arts", "Olympic Sports",
  "Wrestling Moves", "Superstitions", "Fairy Tales", "Nursery Rhymes",
  "Slang & Lingo (Worldwide)", "Internet Memes", "Emojis", "Zodiac Signs",
  "Tarot Cards", "Perfumes", "Watch Brands", "Sneaker Brands",
  "Kitchen Utensils", "Rock Bands", "Dance Crazes", "Board Game Pieces",
  "Video Game Consoles", "Chess Pieces", "Types of Bread", "Herbal Teas"
];

const LENGTH_SPECIFIC_CATEGORIES = [
  { name: "Four-Letter Boy Names", onlyLengths: [4] },
  { name: "Four-Letter Card Game Terms", onlyLengths: [4] },
  { name: "Four-Letter Poker Hand Terms", onlyLengths: [4] },
  { name: "Four-Letter Weather Words", onlyLengths: [4] },
  { name: "Four-Letter Text Abbreviations", onlyLengths: [4] },
  { name: "Five-Letter Wordle-Style Answers", onlyLengths: [5] },
  { name: "Five-Letter Flower Names", onlyLengths: [5] },
  { name: "Five-Letter Dance Moves", onlyLengths: [5] },
  { name: "Five-Letter Spice Names", onlyLengths: [5] },
  { name: "Five-Letter Board Game Pieces", onlyLengths: [5] },
  { name: "Six-Letter Countries", onlyLengths: [6] },
  { name: "Six-Letter Car Models", onlyLengths: [6] },
  { name: "Six-Letter Superhero Aliases", onlyLengths: [6] },
  { name: "Six-Letter Slang Greetings", onlyLengths: [6] },
  { name: "Six-Letter Cocktail Names", onlyLengths: [6] },
  { name: "Seven-Letter Chemical Elements", onlyLengths: [7] },
  { name: "Seven-Letter Constellations", onlyLengths: [7] },
  { name: "Seven-Letter Mythical Beasts", onlyLengths: [7] },
  { name: "Seven-Letter Planets or Moons", onlyLengths: [7] },
  { name: "License-Plate-Style Codes", onlyLengths: [6, 7] }
];

const CATEGORY_BANK = [
  ...UNIVERSAL_CATEGORIES.map((name, i) => ({ id: "u" + i, name, onlyLengths: null })),
  ...LENGTH_SPECIFIC_CATEGORIES.map((c, i) => ({ id: "s" + i, name: c.name, onlyLengths: c.onlyLengths }))
];

function fitsLength(category, length) {
  if (!category.onlyLengths) return true;
  return category.onlyLengths.includes(length);
}

module.exports = { CATEGORY_BANK, fitsLength };
