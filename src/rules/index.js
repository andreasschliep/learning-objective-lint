'use strict';

/** All lint rules, in report order. Each exports { id, description, check(lo) }. */
module.exports = [
  require('./compound'),
  require('./vagueVerb'),
  require('./verbLevelMismatch'),
  require('./trainerCentred'),
  require('./contentCentred'),
  require('./granularity'),
  require('./aspirational'),
  require('./activityAsOutcome')
];
