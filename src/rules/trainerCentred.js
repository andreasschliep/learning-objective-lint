'use strict';

const { loadVerbs, containsPhrase } = require('../util');

const ID = 'trainer-centred';
const DESCRIPTION = 'Describes what the trainer or the course will do, not what the learner will be able to do';

function check(lo) {
  const verbs = loadVerbs();
  for (const phrase of verbs.trainerCentredPhrases) {
    if (containsPhrase(lo.text, phrase)) {
      return {
        status: 'fail',
        message: `Trainer-centred phrasing "${phrase}" — rewrite it from the learner's perspective`,
        evidence: `"... ${phrase} ..."`
      };
    }
  }
  return { status: 'pass' };
}

module.exports = { id: ID, description: DESCRIPTION, check };
