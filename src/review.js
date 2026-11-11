'use strict';

/**
 * Optional LLM review: asks Claude whether an agenda activity really lets participants
 * reach the objective it claims to serve, at the claimed Bloom level.
 *
 * The rule-based lint and the coverage check never call a model. This module is only
 * used by `lo-lint review`, and only when ANTHROPIC_API_KEY is set (or with --dry-run,
 * which prints the prompts without sending them).
 */

const { BLOOM_LEVELS } = require('./util');

const DEFAULT_MODEL = 'claude-opus-5-5';
const DEFAULT_EFFORT = 'medium';

// Models that accept server-side refusal fallbacks (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-1']);
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const VERDICTS = ['reaches', 'partially', 'does_not_reach'];

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: VERDICTS },
    observed_level: { type: 'string', enum: BLOOM_LEVELS },
    reasoning: { type: 'string' },
    suggestion: { type: 'string' }
  },
  required: ['verdict', 'observed_level', 'reasoning', 'suggestion'],
  additionalProperties: false
};

const SYSTEM_PROMPT = [
  'You review workshop designs for instructional designers.',
  'You get one learning objective (with its target level in Bloom\'s revised taxonomy) and one workshop activity that claims to practise it.',
  'Judge whether a participant who does the activity as described would actually perform the behaviour the objective names, at the target level.',
  'Judge only what the description says participants do. Do not assume steps that are not described.',
  'verdict: "reaches" if participants perform the behaviour at or above the target level; "partially" if they work on the right content but at a lower level or only part of the behaviour; "does_not_reach" otherwise.',
  'observed_level: the highest Bloom level participants actually perform in the activity.',
  'reasoning: two sentences at most. suggestion: one concrete change to the activity that would close the gap, or an empty string if the verdict is "reaches".'
].join('\n');

/** Every (objective, activity) pair the agenda claims, optionally limited to one objective. */
function buildPairs(objectivesDoc, agendaDoc, { objectiveId } = {}) {
  const byId = new Map(objectivesDoc.objectives.map(lo => [lo.id, lo]));
  const pairs = [];
  for (const activity of agendaDoc.activities) {
    for (const ref of activity.objectives) {
      const lo = byId.get(ref.id);
      if (!lo) continue; // unknown references are reported by the coverage command
      if (objectiveId && lo.id !== objectiveId) continue;
      pairs.push({ lo, activity, practisedLevel: ref.level });
    }
  }
  return pairs;
}

function buildPrompt({ lo, activity, practisedLevel }) {
  return [
    '<objective>',
    `id: ${lo.id}`,
    `target_level: ${lo.level || 'not specified'}`,
    `text: ${lo.text}`,
    '</objective>',
    '<activity>',
    `id: ${activity.id}`,
    `title: ${activity.title}`,
    activity.minutes != null ? `minutes: ${activity.minutes}` : null,
    `level_claimed_by_designer: ${practisedLevel}`,
    `description: ${activity.description || '(no description given)'}`,
    '</activity>'
  ].filter(line => line !== null).join('\n');
}

function buildRequest(pair, { model = DEFAULT_MODEL, effort = DEFAULT_EFFORT } = {}) {
  const request = {
    model,
    max_tokens: 16000,
    output_config: { effort, format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(pair) }]
  };
  if (FALLBACK_MODELS.has(model)) {
    request.betas = [FALLBACK_BETA];
    request.fallbacks = 'default';
  }
  return request;
}

/** Parse and validate the model's JSON verdict. Throws on anything unexpected. */
function parseVerdict(text) {
  const data = JSON.parse(text);
  if (!VERDICTS.includes(data.verdict)) throw new Error(`unexpected verdict "${data.verdict}"`);
  if (!BLOOM_LEVELS.includes(data.observed_level)) throw new Error(`unexpected level "${data.observed_level}"`);
  return {
    verdict: data.verdict,
    observedLevel: data.observed_level,
    reasoning: String(data.reasoning || ''),
    suggestion: String(data.suggestion || '')
  };
}

async function reviewPair(client, pair, options = {}) {
  const request = buildRequest(pair, options);
  let response;
  try {
    response = request.betas
      ? await client.beta.messages.create(request)
      : await client.messages.create(request);
  } catch (err) {
    return { ...pair, error: `API error${err.status ? ` ${err.status}` : ''}: ${err.message}` };
  }

  if (response.stop_reason === 'refusal') {
    const category = response.stop_details && response.stop_details.category;
    return { ...pair, error: `Model declined the request${category ? ` (${category})` : ''}` };
  }
  if (response.stop_reason === 'max_tokens') {
    return { ...pair, error: 'Response was cut off (max_tokens)' };
  }
  const text = (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try {
    return { ...pair, ...parseVerdict(text), servedBy: response.model };
  } catch (err) {
    return { ...pair, error: `Could not read the verdict: ${err.message}` };
  }
}

/** Review all pairs one after another. `onProgress(i, total, pair)` is called before each request. */
async function runReview(pairs, { client, model, effort, onProgress } = {}) {
  const results = [];
  for (let i = 0; i < pairs.length; i++) {
    if (onProgress) onProgress(i + 1, pairs.length, pairs[i]);
    results.push(await reviewPair(client, pairs[i], { model, effort }));
  }
  return results;
}

/** Create an SDK client. Required lazily so lint and coverage work without the SDK being loaded. */
function createClient() {
  const sdk = require('@anthropic-ai/sdk');
  const Anthropic = sdk.default || sdk;
  return new Anthropic();
}

function reviewExitCode(results) {
  return results.some(r => r.error || r.verdict !== 'reaches') ? 1 : 0;
}

const cell = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const VERDICT_LABEL = { reaches: '✓ reaches', partially: '◐ partially', does_not_reach: '✗ does not reach' };

function renderReviewReport(results, { title = 'course', model = DEFAULT_MODEL } = {}) {
  const lines = [`# LLM review — ${title}`, ''];
  lines.push(`Model: \`${model}\`. Verdicts are a second opinion for the designer, not a gate.`, '');
  const counts = { reaches: 0, partially: 0, does_not_reach: 0, error: 0 };
  for (const r of results) counts[r.error ? 'error' : r.verdict]++;
  lines.push(`- Reaches: **${counts.reaches}** · Partially: **${counts.partially}** · Does not reach: **${counts.does_not_reach}** · Not reviewed: **${counts.error}**`, '');
  lines.push('| Objective | Activity | Claimed | Verdict | Observed | Reasoning | Suggestion |');
  lines.push('|-----------|----------|---------|---------|----------|-----------|------------|');
  for (const r of results) {
    if (r.error) {
      lines.push(`| ${cell(r.lo.id)} | ${cell(r.activity.id)} | ${r.practisedLevel} | ⚠️ not reviewed | – | ${cell(r.error)} | – |`);
    } else {
      lines.push(`| ${cell(r.lo.id)} | ${cell(r.activity.id)} | ${r.practisedLevel} | ${VERDICT_LABEL[r.verdict]} | ${r.observedLevel} | ${cell(r.reasoning)} | ${cell(r.suggestion) || '–'} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function renderDryRun(pairs, options = {}) {
  const lines = ['# LLM review — dry run', '', `${pairs.length} request(s) would be sent. Nothing was sent.`, ''];
  pairs.forEach((pair, i) => {
    const request = buildRequest(pair, options);
    lines.push(`## ${i + 1}. ${pair.lo.id} × ${pair.activity.id}`, '');
    lines.push(`Model \`${request.model}\`, effort \`${request.output_config.effort}\`${request.fallbacks ? ', server-side refusal fallback on' : ''}.`, '');
    lines.push('```text', buildPrompt(pair), '```', '');
  });
  return lines.join('\n');
}

module.exports = {
  DEFAULT_MODEL,
  DEFAULT_EFFORT,
  SYSTEM_PROMPT,
  VERDICT_SCHEMA,
  buildPairs,
  buildPrompt,
  buildRequest,
  parseVerdict,
  reviewPair,
  runReview,
  createClient,
  reviewExitCode,
  renderReviewReport,
  renderDryRun
};
