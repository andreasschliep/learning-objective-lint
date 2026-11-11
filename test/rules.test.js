'use strict';

// Rule tests. All objectives below are invented for these tests (fictional
// "Testing Fundamentals" workshop); none are taken from a real course.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const compound = require('../src/rules/compound');
const vagueVerb = require('../src/rules/vagueVerb');
const verbLevelMismatch = require('../src/rules/verbLevelMismatch');
const trainerCentred = require('../src/rules/trainerCentred');
const contentCentred = require('../src/rules/contentCentred');
const granularity = require('../src/rules/granularity');
const aspirational = require('../src/rules/aspirational');
const activity = require('../src/rules/activityAsOutcome');
const { lintObjective, RULES } = require('../src/lint');

function expectStatus(rule, lo, expected) {
  const out = rule.check({ id: 'X', ...lo });
  assert.equal(out.status, expected, `${rule.id}: expected "${expected}" but got "${out.status}" (${out.message || '-'})`);
  return out;
}

// ---------- compound ----------
test('compound: "Understand and apply ..." → fail', () => {
  expectStatus(compound, { level: 'Understand', text: 'Understand and apply test doubles in general.' }, 'fail');
});

test('compound: "Identify and analyse ..." → fail', () => {
  expectStatus(compound, { level: 'Analyse', text: 'Identify and analyse flaky tests in a build pipeline.' }, 'fail');
});

test('compound: second verb far from the start → pass', () => {
  expectStatus(compound, {
    level: 'Analyse',
    text: 'Recognise common unit-testing anti-patterns (e.g., testing private methods, shared mutable fixtures, assertion-free tests) and propose corrective measures'
  }, 'pass');
});

test('compound: single-verb objective → pass', () => {
  expectStatus(compound, { level: 'Apply', text: 'Implement a parameterised unit test that covers the boundary values of a date-parsing function.' }, 'pass');
});

test('compound: "<verb> <word> and <verb>" at different levels → warn', () => {
  expectStatus(compound, { level: 'Evaluate', text: 'Name causes and evaluate fixes for flaky tests.' }, 'warn');
});

// ---------- vague-verb ----------
test('vague-verb: "Know ..." → fail', () => {
  expectStatus(vagueVerb, { level: 'Remember', text: 'Know the red-green-refactor cycle.' }, 'fail');
});

test('vague-verb: "Understand ..." → fail', () => {
  expectStatus(vagueVerb, { level: 'Understand', text: 'Understand the purpose of test doubles.' }, 'fail');
});

test('vague-verb: multi-word "Be familiar with ..." → fail', () => {
  expectStatus(vagueVerb, { level: 'Remember', text: "Be familiar with the test runner's command-line options." }, 'fail');
});

test('vague-verb: "Explain ..." → pass', () => {
  expectStatus(vagueVerb, { level: 'Understand', text: 'Explain the three steps of the red-green-refactor cycle.' }, 'pass');
});

// ---------- verb-level-mismatch ----------
test('mismatch: claims Analyse, verb is "List" → fail', () => {
  expectStatus(verbLevelMismatch, { level: 'Analyse', text: 'List the properties of a good unit test.' }, 'fail');
});

test('mismatch: claims Apply, verb "Implement" → pass', () => {
  expectStatus(verbLevelMismatch, { level: 'Apply', text: 'Implement a parameterised unit test for a date parser.' }, 'pass');
});

test('mismatch: claims Analyse, "Recognise ... and propose" → pass (highest verb matches)', () => {
  expectStatus(verbLevelMismatch, { level: 'Analyse', text: 'Recognise common unit-testing anti-patterns and propose corrective measures.' }, 'pass');
});

test('mismatch: unknown verb → pass (left to other rules)', () => {
  expectStatus(verbLevelMismatch, { level: 'Apply', text: 'Wrangle the legacy suite.' }, 'pass');
});

test('mismatch: one level apart → warn', () => {
  expectStatus(verbLevelMismatch, { level: 'Understand', text: 'Apply the arrange-act-assert pattern to an existing test.' }, 'warn');
});

test('mismatch: no level given → pass', () => {
  expectStatus(verbLevelMismatch, { text: 'List the properties of a good unit test.' }, 'pass');
});

test('mismatch: American spelling "Analyze" is accepted', () => {
  expectStatus(verbLevelMismatch, { level: 'Analyze', text: 'Compare two strategies for isolating a test from the database.' }, 'pass');
});

// ---------- trainer-centred ----------
test('trainer-centred: "The trainer will ..." → fail', () => {
  expectStatus(trainerCentred, { level: 'Apply', text: 'The trainer will demonstrate test-driven development on a kata.' }, 'fail');
});

test('trainer-centred: "We will ..." → fail', () => {
  expectStatus(trainerCentred, { level: 'Understand', text: 'We will discuss when to use mocks.' }, 'fail');
});

test('trainer-centred: "This module covers ..." → fail', () => {
  expectStatus(trainerCentred, { level: 'Understand', text: 'This module covers test doubles.' }, 'fail');
});

test('trainer-centred: learner-centred objective → pass', () => {
  expectStatus(trainerCentred, { level: 'Apply', text: 'Demonstrate how to isolate a test from the system clock.' }, 'pass');
});

// ---------- content-centred ----------
test('content-centred: bare topic heading → warn', () => {
  expectStatus(contentCentred, { level: 'Understand', text: 'Test doubles and their purpose.' }, 'warn');
});

test('content-centred: objective with an action verb → pass', () => {
  expectStatus(contentCentred, { level: 'Apply', text: 'Demonstrate how to isolate a test from the system clock.' }, 'pass');
});

test('content-centred: empty text → fail', () => {
  expectStatus(contentCentred, { level: 'Apply', text: '' }, 'fail');
});

// ---------- granularity ----------
test('granularity: two words → warn', () => {
  expectStatus(granularity, { level: 'Apply', text: 'Master testing.' }, 'warn');
});

test('granularity: more than 35 words → warn', () => {
  const longText = 'Apply ' + 'testing practices in a large legacy codebase '.repeat(8) + 'effectively.';
  expectStatus(granularity, { level: 'Apply', text: longText }, 'warn');
});

test('granularity: about 15 words → pass', () => {
  expectStatus(granularity, { level: 'Apply', text: 'Implement a parameterised unit test that covers the boundary values of a date-parsing function.' }, 'pass');
});

// ---------- aspirational ----------
test('aspirational: "Inspire ..." → fail', () => {
  expectStatus(aspirational, { level: 'Apply', text: 'Inspire teammates to embrace test-first development.' }, 'fail');
});

test('aspirational: "Embody ..." → fail', () => {
  expectStatus(aspirational, { level: 'Apply', text: 'Embody a quality-first mindset in daily work.' }, 'fail');
});

test('aspirational: "Demonstrate ..." → pass', () => {
  expectStatus(aspirational, { level: 'Apply', text: 'Demonstrate test-first development on a small coding kata.' }, 'pass');
});

// ---------- activity-as-outcome ----------
test('activity: "Participate in ..." → fail', () => {
  expectStatus(activity, { level: 'Apply', text: 'Participate in a mob-testing session.' }, 'fail');
});

test('activity: "Attend ..." → fail', () => {
  expectStatus(activity, { level: 'Apply', text: 'Attend a code review of a test suite.' }, 'fail');
});

test('activity: multi-word "Take part in ..." → fail', () => {
  expectStatus(activity, { level: 'Apply', text: 'Take part in a bug bash.' }, 'fail');
});

test('activity: "Facilitate ..." → pass', () => {
  expectStatus(activity, { level: 'Apply', text: 'Facilitate a test-review session that yields concrete improvements.' }, 'pass');
});

// ---------- aggregate ----------
test('lintObjective: runs all eight rules and reports the worst status', () => {
  const clean = lintObjective({ id: 'X', level: 'Apply', text: 'Implement a unit test for a date-parsing function using arrange-act-assert.' });
  assert.equal(RULES.length, 8);
  assert.equal(clean.results.length, 8);
  assert.equal(clean.worstStatus, 'pass');

  const warnOnly = lintObjective({ id: 'X', level: 'Understand', text: 'Test doubles and their purpose.' });
  assert.equal(warnOnly.worstStatus, 'warn');

  const failing = lintObjective({ id: 'X', level: 'Apply', text: 'Embrace test-first development.' });
  assert.equal(failing.worstStatus, 'fail');
  assert.deepEqual(failing.results.filter(r => r.status !== 'pass').map(r => r.ruleId).sort(), ['aspirational', 'granularity']);
});
