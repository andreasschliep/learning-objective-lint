'use strict';

const { tokenise, knownSingleWordVerbs } = require('../util');

const ID = 'content-centred';
const DESCRIPTION = 'Reads like a topic heading (no action verb) rather than an outcome';

function check(lo) {
  const tokens = tokenise(lo.text);
  if (tokens.length === 0) {
    return { status: 'fail', message: 'Empty objective text' };
  }

  const known = knownSingleWordVerbs({ includeAmbiguous: true });
  const head = tokens.slice(0, 8);
  if (!head.some(t => known.has(t))) {
    return {
      status: 'warn',
      message: 'No recognised action verb in the first 8 words — possibly a topic heading, not an outcome',
      evidence: `"${head.join(' ')} ..."`
    };
  }
  return { status: 'pass' };
}

module.exports = { id: ID, description: DESCRIPTION, check };
