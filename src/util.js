'use strict';

const fs = require('fs');
const path = require('path');

/** Bloom's revised taxonomy, lowest to highest cognitive level. */
const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create'];

/** Accepted spellings that map onto the canonical level names above. */
const LEVEL_ALIASES = {
  analyze: 'Analyse'
};

let cachedVerbs = null;

/** Verb lists (vague, aspirational, activity, trainer-centred phrases, verbs by Bloom level). */
function loadVerbs() {
  if (cachedVerbs) return cachedVerbs;
  const file = path.join(__dirname, 'data', 'verbs.json');
  cachedVerbs = JSON.parse(fs.readFileSync(file, 'utf8'));
  return cachedVerbs;
}

function tokenise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[(),.;:!?"'–—]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function levelsForVerb(verb, byLevel) {
  const lower = verb.toLowerCase();
  const levels = new Set();
  for (const [lvl, verbs] of Object.entries(byLevel)) {
    if (verbs.includes(lower)) levels.add(lvl);
  }
  return levels;
}

function levelIndex(level) {
  return BLOOM_LEVELS.indexOf(level);
}

function highestLevel(levelsSet) {
  let best = -1;
  for (const lvl of levelsSet) {
    const idx = levelIndex(lvl);
    if (idx > best) best = idx;
  }
  return best === -1 ? null : BLOOM_LEVELS[best];
}

/**
 * Map user input ("apply", "Analyze", "ANALYSE") onto a canonical Bloom level.
 * Returns null for anything that is not a Bloom level.
 */
function normaliseLevel(level) {
  if (typeof level !== 'string') return null;
  const lower = level.trim().toLowerCase();
  if (LEVEL_ALIASES[lower]) return LEVEL_ALIASES[lower];
  return BLOOM_LEVELS.find(l => l.toLowerCase() === lower) || null;
}

function containsPhrase(text, phrase) {
  return String(text || '').toLowerCase().includes(phrase.toLowerCase());
}

/** All single-word verbs the rules know about (action, vague, aspirational, activity). */
function knownSingleWordVerbs({ includeAmbiguous = false } = {}) {
  const verbs = loadVerbs();
  const single = list => list.filter(v => !v.includes(' '));
  const all = Object.values(verbs.byLevel).flat()
    .concat(single(verbs.vague))
    .concat(single(verbs.aspirational))
    .concat(single(verbs.activity));
  if (includeAmbiguous) all.push(...single(verbs.ambiguous));
  return new Set(all);
}

module.exports = {
  BLOOM_LEVELS,
  loadVerbs,
  tokenise,
  levelsForVerb,
  levelIndex,
  highestLevel,
  normaliseLevel,
  containsPhrase,
  knownSingleWordVerbs
};
