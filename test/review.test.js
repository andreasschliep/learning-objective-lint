'use strict';

// The LLM review is tested against a fake client. No request leaves the machine.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseObjectives, parseAgenda } = require('../src/load');
const review = require('../src/review');

const objectives = parseObjectives({
  modules: [{
    id: 'M1',
    objectives: [
      { id: 'O1', level: 'Apply', text: 'Implement a unit test for a parser.' },
      { id: 'O2', level: 'Analyse', text: 'Compare two ways of isolating a test from the clock.' }
    ]
  }]
});
const agenda = parseAgenda({
  activities: [
    { id: 'A1', title: 'Live demo', minutes: 8, description: 'The facilitator writes a test while participants watch.', objectives: [{ id: 'O1', level: 'Understand' }] },
    { id: 'A2', title: 'Pairs', minutes: 15, description: 'Pairs write tests and compare approaches.', objectives: [{ id: 'O1', level: 'Apply' }, { id: 'O2', level: 'Analyse' }, { id: 'O9', level: 'Apply' }] }
  ]
});

function fakeClient(responses) {
  const calls = [];
  const create = async request => {
    calls.push(request);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, beta: { messages: { create } }, messages: { create } };
}

const textResponse = obj => ({
  model: 'claude-opus-5-5',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(obj) }]
});

test('buildPairs: one pair per known objective reference, optional filter', () => {
  const pairs = review.buildPairs(objectives, agenda);
  assert.deepEqual(pairs.map(p => `${p.lo.id}×${p.activity.id}`), ['O1×A1', 'O1×A2', 'O2×A2']);
  assert.equal(review.buildPairs(objectives, agenda, { objectiveId: 'O2' }).length, 1);
});

test('buildRequest: current default model, structured output, refusal fallback', () => {
  const [pair] = review.buildPairs(objectives, agenda);
  const req = review.buildRequest(pair);
  assert.equal(req.model, 'claude-opus-5-5');
  assert.equal(req.output_config.effort, 'medium');
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.deepEqual(req.output_config.format.schema.required, ['verdict', 'observed_level', 'reasoning', 'suggestion']);
  assert.deepEqual(req.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(req.fallbacks, 'default');
  assert.match(req.messages[0].content, /target_level: Apply/);
  assert.match(req.messages[0].content, /level_claimed_by_designer: Understand/);
  assert.ok(!('thinking' in req), 'thinking is left at the model default');
});

test('buildRequest: no fallback parameters for models without server-side fallback', () => {
  const [pair] = review.buildPairs(objectives, agenda);
  const req = review.buildRequest(pair, { model: 'claude-haiku-5-5', effort: 'low' });
  assert.ok(!('fallbacks' in req));
  assert.ok(!('betas' in req));
  assert.equal(req.output_config.effort, 'low');
});

test('runReview: parses verdicts and uses the beta endpoint with fallbacks', async () => {
  const client = fakeClient([
    textResponse({ verdict: 'partially', observed_level: 'Understand', reasoning: 'Participants only watch.', suggestion: 'Let pairs write the test.' }),
    textResponse({ verdict: 'reaches', observed_level: 'Apply', reasoning: 'Pairs write tests.', suggestion: '' }),
    textResponse({ verdict: 'reaches', observed_level: 'Analyse', reasoning: 'Pairs compare.', suggestion: '' })
  ]);
  const progress = [];
  const results = await review.runReview(review.buildPairs(objectives, agenda), {
    client,
    onProgress: (i, n) => progress.push(`${i}/${n}`)
  });
  assert.equal(client.calls.length, 3);
  assert.deepEqual(progress, ['1/3', '2/3', '3/3']);
  assert.equal(results[0].verdict, 'partially');
  assert.equal(results[0].observedLevel, 'Understand');
  assert.equal(results[1].servedBy, 'claude-opus-5-5');
  assert.equal(review.reviewExitCode(results), 1);
  assert.equal(review.reviewExitCode(results.slice(1)), 0);
});

test('reviewPair: refusal, truncation, bad JSON and API errors become "not reviewed"', async () => {
  const [pair] = review.buildPairs(objectives, agenda);
  const apiError = Object.assign(new Error('overloaded'), { status: 529 });
  const client = fakeClient([
    { stop_reason: 'refusal', stop_details: { category: null }, content: [] },
    { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"verd' }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"verdict":"maybe","observed_level":"Apply","reasoning":"","suggestion":""}' }] },
    apiError
  ]);
  const refused = await review.reviewPair(client, pair);
  const truncated = await review.reviewPair(client, pair);
  const invalid = await review.reviewPair(client, pair);
  const failed = await review.reviewPair(client, pair);
  assert.match(refused.error, /declined/);
  assert.match(truncated.error, /cut off/);
  assert.match(invalid.error, /unexpected verdict/);
  assert.match(failed.error, /API error 529/);
  assert.equal(review.reviewExitCode([refused]), 1);
});

test('renderers: report and dry run', () => {
  const pairs = review.buildPairs(objectives, agenda);
  const dry = review.renderDryRun(pairs);
  assert.match(dry, /3 request\(s\) would be sent\. Nothing was sent\./);
  assert.match(dry, /O1 × A1/);

  const md = review.renderReviewReport([
    { ...pairs[0], verdict: 'does_not_reach', observedLevel: 'Remember', reasoning: 'Only watching.', suggestion: 'Add practice.' },
    { ...pairs[1], error: 'Model declined the request' }
  ], { title: 'Fixture' });
  assert.match(md, /# LLM review — Fixture/);
  assert.match(md, /✗ does not reach/);
  assert.match(md, /not reviewed/);
});
