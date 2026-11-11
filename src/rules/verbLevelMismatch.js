'use strict';

const { loadVerbs, tokenise, levelsForVerb, levelIndex, highestLevel, normaliseLevel } = require('../util');

const ID = 'verb-level-mismatch';
const DESCRIPTION = 'The verb in the objective does not match the Bloom level it claims';

function check(lo) {
  const claimed = normaliseLevel(lo.level);
  if (!claimed) return { status: 'pass' };
  const verbs = loadVerbs();
  const tokens = tokenise(lo.text);
  if (tokens.length === 0) return { status: 'pass' };

  // Collect the Bloom levels of every known action verb in the first 12 words.
  // Multi-verb objectives are usually pitched at their highest verb.
  const collected = new Set();
  for (const tok of tokens.slice(0, 12)) {
    for (const l of levelsForVerb(tok, verbs.byLevel)) collected.add(l);
  }

  // No known action verb: leave it to vague-verb and content-centred.
  if (collected.size === 0) return { status: 'pass' };

  if (collected.has(claimed)) return { status: 'pass' };

  const top = highestLevel(collected);
  const distance = Math.abs(levelIndex(top) - levelIndex(claimed));

  if (distance >= 2) {
    return {
      status: 'fail',
      message: `Claimed level "${claimed}" is ${distance} steps away from the highest verb level "${top}" found in the text`,
      evidence: `verbs detected at: ${[...collected].join(', ')}`
    };
  }
  return {
    status: 'warn',
    message: `Claimed level "${claimed}" does not match any detected verb level (highest detected: "${top}")`,
    evidence: `verbs detected at: ${[...collected].join(', ')}`
  };
}

module.exports = { id: ID, description: DESCRIPTION, check };
