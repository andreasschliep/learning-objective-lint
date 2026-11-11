#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  InputError,
  loadObjectives,
  loadAgenda,
  lintAll,
  lintExitCode,
  renderLintReport,
  computeCoverage,
  coverageExitCode,
  renderCoverageReport,
  review
} = require('../src');

const HELP = `lo-lint — check learning objectives and the agenda that is meant to teach them

Usage:
  lo-lint lint <objectives.yaml> [--out report.md] [--fail-on fail|warn|never]
  lo-lint coverage <objectives.yaml> <agenda.yaml> [--out report.md] [--over 3] [--fail-on gaps|never]
  lo-lint review <objectives.yaml> <agenda.yaml> [--objective ID] [--dry-run] [--model ID] [--effort LEVEL] [--out report.md]

Commands:
  lint       Rule-based check of every objective (vague verbs, Bloom-level mismatch, ...)
  coverage   Map objectives to agenda activities: covered / partial / missing / over-covered
  review     Optional: ask Claude whether each activity really reaches its objective
             (needs ANTHROPIC_API_KEY; --dry-run prints the prompts instead)

Exit codes:
  0  no findings      1  findings (see --fail-on)      2  invalid input or configuration
`;

const VALUE_FLAGS = new Set(['--out', '--fail-on', '--over', '--objective', '--model', '--effort']);
const BOOL_FLAGS = new Set(['--dry-run', '--help', '-h']);

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (VALUE_FLAGS.has(arg)) {
      if (i + 1 >= argv.length) throw new InputError(`Missing value for ${arg}`);
      flags[arg.slice(2)] = argv[++i];
    } else if (BOOL_FLAGS.has(arg)) {
      flags[arg.replace(/^-+/, '')] = true;
    } else if (arg.startsWith('-')) {
      throw new InputError(`Unknown option ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) throw new InputError(`${name} must be one of: ${allowed.join(', ')}`);
  return value;
}

function emit(markdown, out) {
  if (out) {
    fs.writeFileSync(out, markdown);
    console.error(`Report written to ${out}`);
  } else {
    process.stdout.write(markdown);
  }
}

function titleOf(metadata, file) {
  return (metadata && (metadata.title || metadata.id)) || path.basename(file, path.extname(file));
}

function cmdLint(positional, flags) {
  if (positional.length !== 1) throw new InputError('lint expects exactly one objectives file');
  const failOn = oneOf(flags['fail-on'] || 'fail', ['fail', 'warn', 'never'], '--fail-on');
  const file = positional[0];
  const doc = loadObjectives(file);
  const result = lintAll(doc.objectives);
  emit(renderLintReport(result, { title: titleOf(doc.metadata, file), source: path.basename(file) }), flags.out);
  const c = result.counts;
  console.error(`\nlint: ${result.reports.length} objectives — ${c.pass} pass, ${c.warn} warn, ${c.fail} fail`);
  return lintExitCode(c, failOn);
}

function cmdCoverage(positional, flags) {
  if (positional.length !== 2) throw new InputError('coverage expects an objectives file and an agenda file');
  const failOn = oneOf(flags['fail-on'] || 'gaps', ['gaps', 'never'], '--fail-on');
  const overThreshold = flags.over != null ? Number(flags.over) : undefined;
  if (overThreshold !== undefined && !(Number.isInteger(overThreshold) && overThreshold >= 2)) {
    throw new InputError('--over must be an integer of at least 2');
  }
  const [objFile, agendaFile] = positional;
  const objectives = loadObjectives(objFile);
  const agenda = loadAgenda(agendaFile);
  const result = computeCoverage(objectives, agenda, { overThreshold });
  emit(renderCoverageReport(result, {
    title: titleOf(agenda.metadata, agendaFile),
    objectivesSource: path.basename(objFile),
    agendaSource: path.basename(agendaFile)
  }), flags.out);
  const c = result.counts;
  console.error(`\ncoverage: ${result.rows.length} objectives — ${c.covered} covered, ${c.partial} partial, ${c.missing} missing, ${c.overCovered} over-covered`);
  return coverageExitCode(result, failOn);
}

async function cmdReview(positional, flags) {
  if (positional.length !== 2) throw new InputError('review expects an objectives file and an agenda file');
  const [objFile, agendaFile] = positional;
  const objectives = loadObjectives(objFile);
  const agenda = loadAgenda(agendaFile);
  const pairs = review.buildPairs(objectives, agenda, { objectiveId: flags.objective });
  if (pairs.length === 0) throw new InputError('Nothing to review: no agenda activity references the selected objective(s)');

  const model = flags.model || process.env.LO_REVIEW_MODEL || review.DEFAULT_MODEL;
  const effort = oneOf(flags.effort || process.env.LO_REVIEW_EFFORT || review.DEFAULT_EFFORT,
    ['low', 'medium', 'high', 'xhigh', 'max'], '--effort');

  if (flags['dry-run']) {
    emit(review.renderDryRun(pairs, { model, effort }), flags.out);
    return 0;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new InputError('review needs ANTHROPIC_API_KEY (see .env.example), or use --dry-run to see the prompts');
  }

  const results = await review.runReview(pairs, {
    client: review.createClient(),
    model,
    effort,
    onProgress: (i, n, p) => console.error(`review ${i}/${n}: ${p.lo.id} × ${p.activity.id}`)
  });
  emit(review.renderReviewReport(results, { title: titleOf(agenda.metadata, agendaFile), model }), flags.out);
  return review.reviewExitCode(results);
}

async function main(argv) {
  const { positional, flags } = parseArgs(argv);
  const [command, ...rest] = positional;
  if (flags.help || flags.h || !command) {
    process.stdout.write(HELP);
    return command || flags.help || flags.h ? 0 : 2;
  }
  switch (command) {
    case 'lint': return cmdLint(rest, flags);
    case 'coverage': return cmdCoverage(rest, flags);
    case 'review': return cmdReview(rest, flags);
    default: throw new InputError(`Unknown command "${command}". Run lo-lint --help.`);
  }
}

main(process.argv.slice(2))
  .then(code => { process.exitCode = code; })
  .catch(err => {
    if (err instanceof InputError) {
      console.error(`lo-lint: ${err.message}`);
      process.exitCode = 2;
    } else {
      console.error(err);
      process.exitCode = 2;
    }
  });
