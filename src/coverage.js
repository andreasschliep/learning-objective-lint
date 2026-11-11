'use strict';

const fs = require('fs');
const path = require('path');
const { BLOOM_LEVELS, levelIndex } = require('./util');

const DEFAULT_OVER_THRESHOLD = 3;

function loadProfiles() {
  const file = path.join(__dirname, 'data', 'bloom-profiles.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete raw._comment;
  return raw;
}

/**
 * Map objectives to the agenda activities that practise them.
 *
 * Status per objective:
 *   covered  — at least one activity practises it at (or above) its target Bloom level
 *   partial  — practised, but only below the target level
 *   missing  — no activity references it
 * Additionally, an objective practised by `overThreshold` or more distinct activities
 * is flagged as over-covered (possible redundancy).
 *
 * @param {{metadata: object, objectives: Array}} objectivesDoc  from load.parseObjectives
 * @param {{metadata: object, activities: Array}} agendaDoc      from load.parseAgenda
 */
function computeCoverage(objectivesDoc, agendaDoc, { overThreshold = DEFAULT_OVER_THRESHOLD } = {}) {
  const { objectives } = objectivesDoc;
  const { activities } = agendaDoc;
  const byId = new Map(objectives.map(lo => [lo.id, { lo, links: [] }]));
  const unknownRefs = [];

  for (const act of activities) {
    for (const ref of act.objectives) {
      const entry = byId.get(ref.id);
      if (!entry) {
        unknownRefs.push({ activityId: act.id, objectiveId: ref.id });
        continue;
      }
      entry.links.push({ activityId: act.id, activityTitle: act.title, level: ref.level });
    }
  }

  const rows = objectives.map(lo => {
    const { links } = byId.get(lo.id);
    const distinctActivities = new Set(links.map(l => l.activityId)).size;
    let status;
    let note = '';
    if (links.length === 0) {
      status = 'missing';
      note = 'No activity practises this objective';
    } else if (!lo.level) {
      status = 'covered';
      note = 'No target level set — level not checked';
    } else {
      const best = links.reduce((max, l) => Math.max(max, levelIndex(l.level)), -1);
      if (best >= levelIndex(lo.level)) {
        status = 'covered';
      } else {
        status = 'partial';
        note = `Practised up to ${BLOOM_LEVELS[best]}, target is ${lo.level}`;
      }
    }
    return { lo, links, status, note, overCovered: distinctActivities >= overThreshold };
  });

  const counts = { covered: 0, partial: 0, missing: 0, overCovered: 0 };
  for (const r of rows) {
    counts[r.status]++;
    if (r.overCovered) counts.overCovered++;
  }

  return {
    rows,
    counts,
    overThreshold,
    unknownRefs,
    activitiesWithoutObjectives: activities.filter(a => a.objectives.length === 0).map(a => a.id),
    distribution: bloomDistribution(objectivesDoc, activities)
  };
}

/** Count target levels (objectives) and practised levels (activity links), and check the audience profile. */
function bloomDistribution(objectivesDoc, activities) {
  const target = Object.fromEntries(BLOOM_LEVELS.map(l => [l, 0]));
  const practised = Object.fromEntries(BLOOM_LEVELS.map(l => [l, 0]));
  let unspecified = 0;
  for (const lo of objectivesDoc.objectives) {
    if (lo.level) target[lo.level]++;
    else unspecified++;
  }
  for (const act of activities) {
    for (const ref of act.objectives) practised[ref.level]++;
  }

  const audience = objectivesDoc.metadata && objectivesDoc.metadata.audience_level;
  let profileCheck = null;
  if (audience) {
    const profile = loadProfiles()[audience];
    if (!profile) {
      profileCheck = { audience, known: false };
    } else {
      const withLevel = objectivesDoc.objectives.filter(lo => lo.level).length;
      const inFocus = profile.focus.reduce((sum, l) => sum + target[l], 0);
      const share = withLevel ? inFocus / withLevel : 0;
      profileCheck = {
        audience,
        known: true,
        description: profile.description,
        focus: profile.focus,
        minShare: profile.minShare,
        share,
        ok: share >= profile.minShare
      };
    }
  }
  return { target, practised, unspecified, profileCheck };
}

/** 1 when any objective is missing or only partially covered, else 0. */
function coverageExitCode(result, failOn = 'gaps') {
  if (failOn === 'never') return 0;
  return result.counts.missing + result.counts.partial > 0 ? 1 : 0;
}

const cell = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const pct = (n, total) => (total ? `${Math.round((n / total) * 100)} %` : '–');
const STATUS_LABEL = { covered: '✓ covered', partial: '◐ partial', missing: '✗ missing' };

/** Render a coverage result as Markdown. */
function renderCoverageReport(result, { title = 'course', objectivesSource = '', agendaSource = '' } = {}) {
  const { rows, counts, distribution } = result;
  const total = rows.length;
  const lines = [];
  lines.push(`# Objective coverage — ${title}`, '');
  if (objectivesSource || agendaSource) {
    lines.push(`Objectives: \`${objectivesSource}\` · Agenda: \`${agendaSource}\``, '');
  }
  lines.push('## Summary', '');
  lines.push(`- Objectives: **${total}**`);
  lines.push(`- Covered: **${counts.covered}** (${pct(counts.covered, total)})`);
  lines.push(`- Partially covered (below target level): **${counts.partial}** (${pct(counts.partial, total)})`);
  lines.push(`- Missing: **${counts.missing}** (${pct(counts.missing, total)})`);
  lines.push(`- Over-covered (${result.overThreshold}+ activities): **${counts.overCovered}**`);
  lines.push('');

  lines.push('## Objectives', '');
  lines.push('| Objective | Target | Status | Practised in | Note |');
  lines.push('|-----------|--------|--------|--------------|------|');
  for (const r of rows) {
    const practisedIn = r.links.map(l => `${l.activityId} (${l.level})`).join(', ') || '–';
    const status = STATUS_LABEL[r.status] + (r.overCovered ? ' · over-covered' : '');
    lines.push(`| ${cell(r.lo.id)} | ${r.lo.level || '–'} | ${status} | ${cell(practisedIn)} | ${cell(r.note)} |`);
  }
  lines.push('');

  const gaps = rows.filter(r => r.status !== 'covered');
  if (gaps.length) {
    lines.push('## Gaps to close', '');
    for (const r of gaps) lines.push(`- **${cell(r.lo.id)}** (${r.lo.level || 'no level'}): ${cell(r.lo.text)} — ${r.note}`);
    lines.push('');
  }

  const over = rows.filter(r => r.overCovered);
  if (over.length) {
    lines.push('## Possible redundancy', '');
    for (const r of over) {
      lines.push(`- **${cell(r.lo.id)}** is practised in ${new Set(r.links.map(l => l.activityId)).size} activities — check whether one can go or move to a different objective.`);
    }
    lines.push('');
  }

  if (result.unknownRefs.length || result.activitiesWithoutObjectives.length) {
    lines.push('## Agenda hygiene', '');
    for (const u of result.unknownRefs) lines.push(`- Activity **${cell(u.activityId)}** references unknown objective \`${cell(u.objectiveId)}\``);
    for (const a of result.activitiesWithoutObjectives) lines.push(`- Activity **${cell(a)}** serves no objective (energiser, break — or a candidate to cut?)`);
    lines.push('');
  }

  lines.push('## Bloom distribution', '');
  const targetTotal = BLOOM_LEVELS.reduce((s, l) => s + distribution.target[l], 0);
  const practisedTotal = BLOOM_LEVELS.reduce((s, l) => s + distribution.practised[l], 0);
  lines.push('| Level | Objectives (target) | Agenda links (practised) |');
  lines.push('|-------|---------------------|--------------------------|');
  for (const l of BLOOM_LEVELS) {
    lines.push(`| ${l} | ${distribution.target[l]} (${pct(distribution.target[l], targetTotal)}) | ${distribution.practised[l]} (${pct(distribution.practised[l], practisedTotal)}) |`);
  }
  if (distribution.unspecified) lines.push(`| _no level_ | ${distribution.unspecified} | – |`);
  lines.push('');

  const pc = distribution.profileCheck;
  if (!pc) {
    lines.push('_Set `metadata.audience_level` (introductory, intermediate, advanced) to check the distribution against an expected profile._');
  } else if (!pc.known) {
    lines.push(`_Unknown audience level "${cell(pc.audience)}" — no profile check._`);
  } else {
    const verdict = pc.ok ? '✓ matches' : '⚠️ does not match';
    lines.push(`Audience level **${pc.audience}** (${pc.description}): ${pct(pc.share * 100, 100)} of objectives target ${pc.focus.join(' / ')}; expected at least ${Math.round(pc.minShare * 100)} % — ${verdict} the profile.`);
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = { computeCoverage, coverageExitCode, renderCoverageReport, DEFAULT_OVER_THRESHOLD };
