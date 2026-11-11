'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseObjectives, parseAgenda, InputError } = require('../src/load');

test('objectives: flattens modules and normalises levels', () => {
  const doc = parseObjectives({
    metadata: { title: 'T' },
    modules: [
      { id: 'M1', title: 'One', objectives: [{ id: 1.1, level: 'apply', text: 'Implement a test.' }] },
      { id: 'M2', objectives: [{ id: 'B', level: 'Analyze', text: 'Compare two fixtures.' }] }
    ]
  });
  assert.equal(doc.objectives.length, 2);
  assert.deepEqual(doc.objectives[0], { id: '1.1', level: 'Apply', text: 'Implement a test.', moduleId: 'M1', moduleTitle: 'One' });
  assert.equal(doc.objectives[1].level, 'Analyse');
});

test('objectives: rejects a missing modules list', () => {
  assert.throws(() => parseObjectives({ metadata: {} }), InputError);
});

test('objectives: collects all problems in one error', () => {
  try {
    parseObjectives({
      modules: [{
        id: 'M1',
        objectives: [
          { id: 'A', level: 'Memorise', text: 'Name things.' },
          { id: 'A', level: 'Apply', text: 'Implement things.' },
          { level: 'Apply', text: 'No id.' }
        ]
      }]
    });
    assert.fail('expected InputError');
  } catch (err) {
    assert.ok(err instanceof InputError);
    assert.equal(err.problems.length, 3);
    assert.match(err.message, /unknown level "Memorise"/);
    assert.match(err.message, /duplicate id "A"/);
    assert.match(err.message, /missing "id"/);
  }
});

test('agenda: requires a valid level on every objective reference', () => {
  assert.throws(
    () => parseAgenda({ activities: [{ id: 'A1', objectives: [{ id: 'O1' }] }] }),
    /"level" must be one of/
  );
});

test('agenda: rejects duplicate activity ids and a missing activities list', () => {
  assert.throws(() => parseAgenda({}), InputError);
  assert.throws(
    () => parseAgenda({ activities: [{ id: 'A1', objectives: [] }, { id: 'A1', objectives: [] }] }),
    /duplicate id/
  );
});

test('agenda: trims descriptions and keeps minutes', () => {
  const doc = parseAgenda({ activities: [{ id: 'A1', minutes: 5, description: 'Pairs write a test.\n', objectives: [] }] });
  assert.equal(doc.activities[0].description, 'Pairs write a test.');
  assert.equal(doc.activities[0].minutes, 5);
});
