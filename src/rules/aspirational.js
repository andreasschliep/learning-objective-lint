'use strict';

const { loadVerbs, tokenise } = require('../util');

const ID = 'aspirational';
const DESCRIPTION = 'Aspirational verb (inspire, embody, embrace, ...) — an attitude, not testable behaviour';

function check(lo) {
  const verbs = loadVerbs();
  const tokens = tokenise(lo.text);
  if (tokens.length === 0) return { status: 'pass' };
  const singleWord = verbs.aspirational.filter(v => !v.includes(' '));
  if (singleWord.includes(tokens[0])) {
    return {
      status: 'fail',
      message: `Aspirational verb "${tokens[0]}" — recast it as observable behaviour or move it to a values statement`,
      evidence: `"${tokens[0]} ..."`
    };
  }
  return { status: 'pass' };
}

module.exports = { id: ID, description: DESCRIPTION, check };
