---
name: analyze-learning-objectives
description: Check a course's learning objectives and agenda with lo-lint — lint objective wording against Bloom's taxonomy, map objectives to agenda activities (covered / partial / missing / over-covered), and propose concrete rewrites. Use when designing or auditing a workshop or course.
argument-hint: <objectives.yaml> [agenda.yaml]
allowed-tools: Read Write Bash(node bin/lo-lint.js *) Glob Grep
---

# Analyse learning objectives

Use this repository's CLI. It is deterministic; your job is to interpret its findings and propose fixes the designer can accept or reject.

## Input

- `$0` — objectives YAML (`metadata` + `modules[].objectives[]` with `id`, `level`, `text`)
- `$1` — optional agenda YAML (`activities[]` with `id`, `title`, `minutes`, `description`, `objectives[]` of `{id, level}`)

The formats are described in the README; `examples/testing-fundamentals/` has a complete fictional example.

## Steps

1. **Lint the wording.**
   `node bin/lo-lint.js lint $0 --fail-on never`
   For every objective with a finding, propose one rewrite that
   - keeps the intended Bloom level (or says explicitly that the level should change and why),
   - starts with one observable action verb from `src/data/verbs.json` at that level,
   - names a concrete context, in 5 to 35 words.
   Split compound objectives into two. Turn topic headings into outcomes. Move attitudes (aspirational verbs) to a values statement instead of forcing them into an objective.

2. **Check coverage** (only if an agenda is given).
   `node bin/lo-lint.js coverage $0 $1 --fail-on never`
   - *missing*: suggest which existing activity could practise the objective, or a new activity with an estimated duration.
   - *partial*: suggest the smallest change that moves the activity up to the target level (for example: participants do the step themselves instead of watching it).
   - *over-covered*: ask whether one of the activities could serve a different objective.
   - Report unknown objective references and activities without objectives.
   - Comment on the Bloom distribution against the audience level.

3. **Optional second opinion.** Only if the user asks and `ANTHROPIC_API_KEY` is set:
   `node bin/lo-lint.js review $0 $1 --objective <ID>`
   Start with `--dry-run` to show what would be sent. Each pair is one API call, so review a few objectives, not the whole course, unless the user says otherwise.

4. **Report** in this order: summary counts, proposed objective rewrites (table: id, current, proposed, reason), proposed agenda changes, open questions for the designer.

## Rules for you

- Do not edit the YAML files unless the user asks. Propose changes first.
- Do not invent objectives the course did not have; flag gaps instead.
- The linter is a heuristic. If a finding is a false positive, say so and explain why instead of rewriting a good objective.
