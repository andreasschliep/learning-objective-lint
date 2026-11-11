'use strict';

// End-to-end: run the CLI on the fictional example and check output and exit codes.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const root = path.join(__dirname, '..');
const cli = path.join(root, 'bin', 'lo-lint.js');
const objectives = path.join(root, 'examples', 'testing-fundamentals', 'objectives.yaml');
const agenda = path.join(root, 'examples', 'testing-fundamentals', 'agenda.yaml');

function run(args, env = {}) {
  const childEnv = { ...process.env, ...env };
  delete childEnv.ANTHROPIC_API_KEY;
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: childEnv });
}

test('lint: example has findings → exit 1; --fail-on never → exit 0', () => {
  const res = run(['lint', objectives]);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /Fail: \*\*6\*\*/);
  assert.match(res.stderr, /12 objectives — 5 pass, 1 warn, 6 fail/);
  assert.equal(run(['lint', objectives, '--fail-on', 'never']).status, 0);
});

test('lint: --out writes the report to a file', () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lo-lint-')), 'report.md');
  const res = run(['lint', objectives, '--out', out, '--fail-on', 'never']);
  assert.equal(res.status, 0);
  assert.equal(res.stdout, '');
  assert.match(fs.readFileSync(out, 'utf8'), /# Learning-objective lint/);
});

test('coverage: example has gaps → exit 1 with summary', () => {
  const res = run(['coverage', objectives, agenda]);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /8 covered, 1 partial, 3 missing, 1 over-covered/);
  assert.match(res.stdout, /TF-3\.2 \| Apply \| ◐ partial/);
});

test('review: --dry-run works without an API key', () => {
  const res = run(['review', objectives, agenda, '--objective', 'TF-2.1', '--dry-run']);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /3 request\(s\) would be sent/);
});

test('review: without ANTHROPIC_API_KEY → exit 2 with a hint', () => {
  const res = run(['review', objectives, agenda]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /needs ANTHROPIC_API_KEY/);
});

test('invalid input and usage errors → exit 2', () => {
  assert.equal(run(['lint', 'does-not-exist.yaml']).status, 2);
  assert.equal(run(['lint', objectives, '--fail-on', 'sometimes']).status, 2);
  assert.equal(run(['frobnicate']).status, 2);
  assert.equal(run([]).status, 2);
  assert.equal(run(['--help']).status, 0);
});
