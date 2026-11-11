'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const { normaliseLevel, BLOOM_LEVELS } = require('./util');

/** Raised for unreadable or structurally invalid input files. The CLI maps it to exit code 2. */
class InputError extends Error {
  constructor(message, problems = []) {
    super(problems.length ? `${message}\n  - ${problems.join('\n  - ')}` : message);
    this.name = 'InputError';
    this.problems = problems;
  }
}

function readYaml(file) {
  if (!fs.existsSync(file)) throw new InputError(`File not found: ${file}`);
  try {
    return yaml.load(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new InputError(`Could not parse YAML in ${file}: ${err.message}`);
  }
}

const levelHint = `one of ${BLOOM_LEVELS.join(', ')}`;

/**
 * Validate an objectives document and flatten it.
 *
 * Expected shape:
 *   metadata: { id, title, version, audience_level }
 *   modules:
 *     - id: M1
 *       title: ...
 *       objectives:
 *         - { id: TF-1.1, level: Understand, text: "Explain ..." }
 *
 * @returns {{ metadata: object, objectives: Array<{id, level, text, moduleId, moduleTitle}> }}
 */
function parseObjectives(doc, source = 'objectives') {
  const problems = [];
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.modules)) {
    throw new InputError(`${source}: expected a top-level "modules" list`);
  }
  const objectives = [];
  const seen = new Set();
  doc.modules.forEach((mod, mi) => {
    const modId = mod && mod.id != null ? String(mod.id) : `module #${mi + 1}`;
    const list = (mod && mod.objectives) || [];
    if (!Array.isArray(list)) {
      problems.push(`${modId}: "objectives" must be a list`);
      return;
    }
    list.forEach((lo, li) => {
      const where = `${modId}, objective #${li + 1}`;
      if (!lo || lo.id == null) {
        problems.push(`${where}: missing "id"`);
        return;
      }
      const id = String(lo.id);
      if (seen.has(id)) problems.push(`${where}: duplicate id "${id}"`);
      seen.add(id);
      if (typeof lo.text !== 'string') problems.push(`${id}: "text" must be a string`);
      let level = null;
      if (lo.level != null) {
        level = normaliseLevel(lo.level);
        if (!level) problems.push(`${id}: unknown level "${lo.level}" (expected ${levelHint})`);
      }
      objectives.push({
        id,
        level,
        text: typeof lo.text === 'string' ? lo.text : '',
        moduleId: modId,
        moduleTitle: (mod && mod.title) || ''
      });
    });
  });
  if (problems.length) throw new InputError(`${source} is invalid`, problems);
  return { metadata: doc.metadata || {}, objectives };
}

/**
 * Validate an agenda document.
 *
 * Expected shape:
 *   metadata: { title, duration_minutes }
 *   activities:
 *     - id: A1
 *       title: ...
 *       minutes: 10
 *       description: ...
 *       objectives:
 *         - { id: TF-1.1, level: Understand }   # the level this activity practises
 *
 * @returns {{ metadata: object, activities: Array<{id, title, minutes, description, objectives: Array<{id, level}>}> }}
 */
function parseAgenda(doc, source = 'agenda') {
  const problems = [];
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.activities)) {
    throw new InputError(`${source}: expected a top-level "activities" list`);
  }
  const seen = new Set();
  const activities = doc.activities.map((act, ai) => {
    const id = act && act.id != null ? String(act.id) : `activity #${ai + 1}`;
    if (!act || act.id == null) problems.push(`${id}: missing "id"`);
    if (seen.has(id)) problems.push(`${id}: duplicate id`);
    seen.add(id);
    const refs = (act && act.objectives) || [];
    if (!Array.isArray(refs)) {
      problems.push(`${id}: "objectives" must be a list`);
      return { id, title: '', minutes: null, description: '', objectives: [] };
    }
    const objectives = refs.map((ref, ri) => {
      if (!ref || ref.id == null) {
        problems.push(`${id}, objective reference #${ri + 1}: missing "id"`);
        return null;
      }
      const level = normaliseLevel(ref.level);
      if (!level) {
        problems.push(`${id} → ${ref.id}: "level" must be ${levelHint} (the level this activity practises)`);
      }
      return { id: String(ref.id), level };
    }).filter(Boolean);
    return {
      id,
      title: (act && act.title) || '',
      minutes: act && typeof act.minutes === 'number' ? act.minutes : null,
      description: String((act && act.description) || '').trim(),
      objectives
    };
  });
  if (problems.length) throw new InputError(`${source} is invalid`, problems);
  return { metadata: doc.metadata || {}, activities };
}

function loadObjectives(file) {
  return parseObjectives(readYaml(file), file);
}

function loadAgenda(file) {
  return parseAgenda(readYaml(file), file);
}

module.exports = { InputError, parseObjectives, parseAgenda, loadObjectives, loadAgenda };
