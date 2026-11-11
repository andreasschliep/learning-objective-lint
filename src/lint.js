'use strict';

const RULES = require('./rules');

const SEVERITY = { pass: 0, warn: 1, fail: 2 };

/**
 * Run every rule against one objective.
 * @param {{id: string, level?: string, text: string}} lo
 * @returns {{lo, results: Array<{ruleId, status, message?, evidence?}>, worstStatus: 'pass'|'warn'|'fail'}}
 */
function lintObjective(lo) {
  const results = RULES.map(rule => ({ ruleId: rule.id, ...rule.check(lo) }));
  let worstStatus = 'pass';
  for (const r of results) {
    if (SEVERITY[r.status] > SEVERITY[worstStatus]) worstStatus = r.status;
  }
  return { lo, results, worstStatus };
}

/** Lint a flattened list of objectives (see load.parseObjectives). */
function lintAll(objectives) {
  const reports = objectives.map(lo => lintObjective(lo));
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const r of reports) counts[r.worstStatus]++;
  return { reports, counts };
}

/**
 * Exit code for a lint run.
 * @param {{fail: number, warn: number}} counts
 * @param {'fail'|'warn'|'never'} failOn
 */
function lintExitCode(counts, failOn = 'fail') {
  if (failOn === 'never') return 0;
  if (failOn === 'warn') return counts.fail + counts.warn > 0 ? 1 : 0;
  return counts.fail > 0 ? 1 : 0;
}

const cell = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const marker = status => (status === 'fail' ? '❌' : status === 'warn' ? '⚠️' : '✓');

/** Render a lint run as Markdown. */
function renderLintReport({ reports, counts }, { title = 'objectives', source = '' } = {}) {
  const lines = [];
  lines.push(`# Learning-objective lint — ${title}`);
  lines.push('');
  if (source) lines.push(`Source: \`${source}\``, '');
  lines.push('## Summary', '');
  lines.push(`- Objectives: **${reports.length}**`);
  lines.push(`- Pass: **${counts.pass}**`);
  lines.push(`- Warn: **${counts.warn}** (a likely smell — review and decide)`);
  lines.push(`- Fail: **${counts.fail}** (a clear anti-pattern — probably needs a rewrite)`);
  lines.push('');
  lines.push('## Rules', '');
  for (const rule of RULES) lines.push(`- \`${rule.id}\` — ${rule.description}`);
  lines.push('');
  lines.push('## Findings', '');

  const issues = reports.filter(r => r.worstStatus !== 'pass');
  if (issues.length === 0) {
    lines.push('_No findings — every objective passes._');
  } else {
    lines.push('| Objective | Level | Status | Rule(s) | Evidence |');
    lines.push('|-----------|-------|--------|---------|----------|');
    for (const r of issues) {
      const fired = r.results.filter(x => x.status !== 'pass');
      const rules = fired.map(x => `\`${x.ruleId}\``).join(', ');
      const evidence = fired.map(x => cell(`${x.message}${x.evidence ? ` — ${x.evidence}` : ''}`)).join('<br>');
      lines.push(`| **${cell(r.lo.id)}** ${marker(r.worstStatus)} | ${r.lo.level || '–'} | ${r.worstStatus} | ${rules} | ${evidence}<br>_Text:_ "${cell(r.lo.text)}" |`);
    }
  }
  lines.push('');
  lines.push('## All objectives', '');
  lines.push('| Objective | Level | Status | Text |');
  lines.push('|-----------|-------|--------|------|');
  for (const r of reports) {
    lines.push(`| ${cell(r.lo.id)} | ${r.lo.level || '–'} | ${marker(r.worstStatus)} | "${cell(r.lo.text)}" |`);
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = { RULES, lintObjective, lintAll, lintExitCode, renderLintReport };
