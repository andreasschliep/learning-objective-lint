'use strict';

const { loadVerbs, tokenise, levelsForVerb, knownSingleWordVerbs } = require('../util');

const ID = 'compound';
const DESCRIPTION = 'Compound objective: two verbs joined by "and" at the start of the sentence';

function check(lo) {
  const verbs = loadVerbs();
  const actionVerbs = knownSingleWordVerbs();
  const tokens = tokenise(lo.text);

  // Strong signal: "<verb> and <verb> ..." (e.g. "Understand and apply ...").
  if (tokens.length >= 3 && tokens[1] === 'and') {
    if (actionVerbs.has(tokens[0]) && actionVerbs.has(tokens[2])) {
      return {
        status: 'fail',
        message: 'Compound objective: two verbs joined by "and" at sentence start — split it into two objectives',
        evidence: `"${tokens[0]} and ${tokens[2]} ..."`
      };
    }
  }

  // Weaker signal: "<verb> <word> and <verb> ..." where the two verbs sit at different Bloom levels.
  if (tokens.length >= 4 && tokens[2] === 'and') {
    if (actionVerbs.has(tokens[0]) && actionVerbs.has(tokens[3])) {
      const v1Levels = levelsForVerb(tokens[0], verbs.byLevel);
      const v2Levels = levelsForVerb(tokens[3], verbs.byLevel);
      const intersect = [...v1Levels].some(l => v2Levels.has(l));
      if (!intersect && v1Levels.size > 0 && v2Levels.size > 0) {
        return {
          status: 'warn',
          message: 'Possible compound objective: two verbs at different Bloom levels near sentence start',
          evidence: `"${tokens[0]} ... and ${tokens[3]} ..."`
        };
      }
    }
  }

  return { status: 'pass' };
}

module.exports = { id: ID, description: DESCRIPTION, check };
