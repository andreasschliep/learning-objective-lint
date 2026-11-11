'use strict';

const { tokenise } = require('../util');

const ID = 'granularity';
const DESCRIPTION = 'Too thin (fewer than 5 words) or too broad (more than 35 words)';

const MIN_WORDS = 5;
const MAX_WORDS = 35;

function check(lo) {
  const tokens = tokenise(lo.text);
  if (tokens.length < MIN_WORDS) {
    return {
      status: 'warn',
      message: `Only ${tokens.length} words — probably too thin to be assessable`,
      evidence: `"${lo.text}"`
    };
  }
  if (tokens.length > MAX_WORDS) {
    return {
      status: 'warn',
      message: `${tokens.length} words — probably too broad or compound; consider splitting`,
      evidence: `"${String(lo.text).slice(0, 60)}..."`
    };
  }
  return { status: 'pass' };
}

module.exports = { id: ID, description: DESCRIPTION, check, MIN_WORDS, MAX_WORDS };
