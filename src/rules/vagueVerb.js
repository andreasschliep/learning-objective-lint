'use strict';

const { loadVerbs, tokenise } = require('../util');

const ID = 'vague-verb';
const DESCRIPTION = 'Vague mental-state verb (know, understand, be familiar with, ...) at sentence start';

function check(lo) {
  const verbs = loadVerbs();
  const tokens = tokenise(lo.text);
  if (tokens.length === 0) return { status: 'pass' };

  const singleWord = verbs.vague.filter(v => !v.includes(' '));
  if (singleWord.includes(tokens[0])) {
    return {
      status: 'fail',
      message: `Vague mental-state verb "${tokens[0]}" — replace it with an observable action verb at the same Bloom level`,
      evidence: `"${tokens[0]} ..."`
    };
  }

  // Multi-word phrases such as "be familiar with", "learn about", "be aware of".
  const multiWord = verbs.vague.filter(v => v.includes(' '));
  const head = tokens.slice(0, 4).join(' ');
  for (const phrase of multiWord) {
    if (head.startsWith(phrase)) {
      return {
        status: 'fail',
        message: `Vague mental-state phrase "${phrase}" — replace it with an observable action verb at the same Bloom level`,
        evidence: `"${phrase} ..."`
      };
    }
  }

  return { status: 'pass' };
}

module.exports = { id: ID, description: DESCRIPTION, check };
