'use strict';

const { loadVerbs, tokenise } = require('../util');

const ID = 'activity-as-outcome';
const DESCRIPTION = 'Activity verb (participate, attend, experience) — names the activity, not its outcome';

function check(lo) {
  const verbs = loadVerbs();
  const tokens = tokenise(lo.text);
  if (tokens.length === 0) return { status: 'pass' };

  const singleWord = verbs.activity.filter(v => !v.includes(' '));
  if (singleWord.includes(tokens[0])) {
    return {
      status: 'fail',
      message: `Activity verb "${tokens[0]}" — state what the learner can do as a result`,
      evidence: `"${tokens[0]} ..."`
    };
  }

  // Multi-word phrases such as "take part".
  const head = tokens.slice(0, 4).join(' ');
  for (const phrase of verbs.activity.filter(v => v.includes(' '))) {
    if (head.startsWith(phrase)) {
      return {
        status: 'fail',
        message: `Activity phrase "${phrase}" — state what the learner can do as a result`,
        evidence: `"${phrase} ..."`
      };
    }
  }
  return { status: 'pass' };
}

module.exports = { id: ID, description: DESCRIPTION, check };
