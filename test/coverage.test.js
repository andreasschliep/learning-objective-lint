'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseObjectives, parseAgenda } = require('../src/load');
const { computeCoverage, coverageExitCode, renderCoverageReport } = require('../src/coverage');

// Small, invented fixture.
const objectives = parseObjectives({
  metadata: { title: 'Fixture', audience_level: 'introductory' },
  modules: [{
    id: 'M1',
    objectives: [
      { id: 'O1', level: 'Apply', text: 'Implement a unit test for a parser.' },
      { id: 'O2', level: 'Analyse', text: 'Compare two ways of isolating a test from the clock.' },
      { id: 'O3', level: 'Remember', text: 'Name the three layers of the test pyramid.' },
      { id: 'O4', text: 'Explain why fast feedback matters.' }
    ]
  }]
});

const agenda = parseAgenda({
  activities: [
    { id: 'A1', objectives: [{ id: 'O1', level: 'Understand' }, { id: 'O2', level: 'Understand' }] },
    { id: 'A2', objectives: [{ id: 'O1', level: 'Apply' }, { id: 'O4', level: 'Understand' }] },
    { id: 'A3', objectives: [{ id: 'O1', level: 'Apply' }, { id: 'O9', level: 'Apply' }] },
    { id: 'A4', objectives: [] }
  ]
});

const byId = result => Object.fromEntries(result.rows.map(r => [r.lo.id, r]));

test('covered when practised at or above the target level', () => {
  const rows = byId(computeCoverage(objectives, agenda));
  assert.equal(rows.O1.status, 'covered');
});

test('partial when practised only below the target level', () => {
  const rows = byId(computeCoverage(objectives, agenda));
  assert.equal(rows.O2.status, 'partial');
  assert.match(rows.O2.note, /up to Understand, target is Analyse/);
});

test('missing when no activity references the objective', () => {
  const rows = byId(computeCoverage(objectives, agenda));
  assert.equal(rows.O3.status, 'missing');
});

test('objective without a target level counts as covered, with a note', () => {
  const rows = byId(computeCoverage(objectives, agenda));
  assert.equal(rows.O4.status, 'covered');
  assert.match(rows.O4.note, /No target level/);
});

test('over-covered at the threshold (distinct activities)', () => {
  const result = computeCoverage(objectives, agenda);
  assert.equal(byId(result).O1.overCovered, true);
  assert.equal(result.counts.overCovered, 1);
  const relaxed = computeCoverage(objectives, agenda, { overThreshold: 4 });
  assert.equal(byId(relaxed).O1.overCovered, false);
});

test('reports unknown references and activities without objectives', () => {
  const result = computeCoverage(objectives, agenda);
  assert.deepEqual(result.unknownRefs, [{ activityId: 'A3', objectiveId: 'O9' }]);
  assert.deepEqual(result.activitiesWithoutObjectives, ['A4']);
});

test('counts and exit codes', () => {
  const result = computeCoverage(objectives, agenda);
  assert.deepEqual(result.counts, { covered: 2, partial: 1, missing: 1, overCovered: 1 });
  assert.equal(coverageExitCode(result), 1);
  assert.equal(coverageExitCode(result, 'never'), 0);

  const complete = parseAgenda({ activities: [{ id: 'B1', objectives: [{ id: 'O1', level: 'Apply' }, { id: 'O2', level: 'Evaluate' }, { id: 'O3', level: 'Remember' }, { id: 'O4', level: 'Understand' }] }] });
  assert.equal(coverageExitCode(computeCoverage(objectives, complete)), 0);
});

test('Bloom distribution and audience profile check', () => {
  const { distribution } = computeCoverage(objectives, agenda);
  assert.equal(distribution.target.Apply, 1);
  assert.equal(distribution.target.Analyse, 1);
  assert.equal(distribution.target.Remember, 1);
  assert.equal(distribution.unspecified, 1);
  assert.equal(distribution.practised.Understand, 3);
  assert.equal(distribution.practised.Apply, 3);
  // 2 of 3 objectives with a level are Remember/Understand/Apply: 67 % < 70 % expected.
  assert.equal(distribution.profileCheck.audience, 'introductory');
  assert.equal(distribution.profileCheck.ok, false);
});

test('unknown audience level is reported, not fatal', () => {
  const odd = parseObjectives({
    metadata: { audience_level: 'expert' },
    modules: [{ id: 'M', objectives: [{ id: 'Z', level: 'Apply', text: 'Implement something small.' }] }]
  });
  const { distribution } = computeCoverage(odd, parseAgenda({ activities: [] }));
  assert.equal(distribution.profileCheck.known, false);
});

test('Markdown report lists gaps, redundancy and hygiene', () => {
  const md = renderCoverageReport(computeCoverage(objectives, agenda), { title: 'Fixture' });
  assert.match(md, /# Objective coverage — Fixture/);
  assert.match(md, /## Gaps to close/);
  assert.match(md, /\*\*O3\*\*/);
  assert.match(md, /## Possible redundancy/);
  assert.match(md, /unknown objective `O9`/);
  assert.match(md, /\*\*A4\*\* serves no objective/);
  assert.match(md, /does not match/);
});
