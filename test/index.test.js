'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const lib = require('../src/index');

test('index: exports the Bloom verb helpers for other tools', () => {
  for (const name of ['loadVerbs', 'tokenise', 'levelsForVerb', 'levelIndex']) {
    assert.equal(typeof lib[name], 'function', `${name} is exported`);
  }
  const verbs = lib.loadVerbs();
  assert.ok(lib.levelsForVerb('apply', verbs.byLevel).has('Apply'));
  assert.equal(lib.levelIndex('Create'), 5);
  assert.deepEqual(lib.tokenise('Explain, then apply.'), ['explain', 'then', 'apply']);
});
