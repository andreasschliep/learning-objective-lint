# learning-objective-lint

Lint learning objectives against Bloom's taxonomy, and check that a workshop agenda actually practises them at the intended level.

*Built with Claude Code as co-developer.*

```
$ node bin/lo-lint.js lint objectives.yaml
| TF-2.3 ❌ | Evaluate | fail | verb-level-mismatch | Claimed level "Evaluate" is 4 steps away from the highest verb level "Remember" ...
$ node bin/lo-lint.js coverage objectives.yaml agenda.yaml
coverage: 12 objectives — 8 covered, 1 partial, 3 missing, 1 over-covered
```

## Problem

Learning objectives drift. "Understand test doubles" sounds fine until someone has to design an exercise or an assessment for it: what exactly would a participant *do*? And even good objectives get lost in the agenda. An objective that claims *Apply* is often only ever demonstrated by the trainer, so participants reach *Understand* at best. Reviewing this by hand on every course revision is slow and inconsistent.

## Approach

Three commands, from cheap and deterministic to optional and model-based:

| Command | What it does | Needs |
|---------|--------------|-------|
| `lint` | Eight rules flag typical anti-patterns in objective wording: vague verbs, compound objectives, verb vs. Bloom-level mismatch, trainer-centred phrasing, topic headings, wrong size, aspirational verbs, activities stated as outcomes. See [docs/rubric.md](docs/rubric.md). | nothing |
| `coverage` | Maps objectives to agenda activities. Each activity states the Bloom level participants actually work at. Reports **covered**, **partial** (practised below the target level), **missing** and **over-covered**, plus unknown references, activities without objectives and the Bloom distribution compared with the audience level. | nothing |
| `review` | Optional second opinion: asks Claude whether each activity description really lets participants reach its objective, with a structured verdict and a suggested change. | `ANTHROPIC_API_KEY` |

The rules are plain word lists in [`src/data/verbs.json`](src/data/verbs.json), so you can adapt them without touching code. Both `lint` and `coverage` produce Markdown and an exit code, so they can run in CI on every change to a course.

## Quick start

Requires Node.js 20.6 or later.

```bash
git clone <this repository>
cd learning-objective-lint
npm install

# Lint the fictional example (exits 1 because it contains deliberately flawed objectives)
node bin/lo-lint.js lint examples/testing-fundamentals/objectives.yaml

# Map objectives to the agenda
node bin/lo-lint.js coverage examples/testing-fundamentals/objectives.yaml examples/testing-fundamentals/agenda.yaml

# Write a report to a file instead of stdout
node bin/lo-lint.js coverage examples/testing-fundamentals/objectives.yaml examples/testing-fundamentals/agenda.yaml --out coverage.report.md

npm test
```

Optional LLM review:

```bash
# See exactly what would be sent — no key needed, nothing is sent
node bin/lo-lint.js review examples/testing-fundamentals/objectives.yaml examples/testing-fundamentals/agenda.yaml --objective TF-3.2 --dry-run

cp .env.example .env   # then put your key into .env
node --env-file=.env bin/lo-lint.js review examples/testing-fundamentals/objectives.yaml examples/testing-fundamentals/agenda.yaml --objective TF-3.2
```

The review uses `claude-opus-5-5` at effort `medium` by default (override with `--model` / `--effort` or `LO_REVIEW_MODEL` / `LO_REVIEW_EFFORT`). It requests structured JSON output and enables Anthropic's server-side refusal fallback (`fallbacks: "default"`) for models that support it. Each objective–activity pair is one API call; use `--objective` to keep runs small.

### Exit codes

| Code | `lint` | `coverage` | `review` |
|------|--------|------------|----------|
| 0 | no failing objective | no missing or partial objective | every activity reaches its objective |
| 1 | at least one fail (`--fail-on warn` also counts warnings) | gaps found | at least one partial, miss or unreviewed pair |
| 2 | invalid input or usage | invalid input or usage | invalid input, usage, or no API key |

Use `--fail-on never` to always exit 0.

## File formats

Objectives:

```yaml
metadata:
  title: Testing Fundamentals
  audience_level: introductory     # introductory | intermediate | advanced (optional)
modules:
  - id: M2
    title: Writing a good unit test
    objectives:
      - id: TF-2.1
        level: Apply               # Remember | Understand | Apply | Analyse | Evaluate | Create
        text: Implement a unit test for a date-parsing function using the arrange-act-assert structure.
```

Agenda:

```yaml
activities:
  - id: A4
    title: "Pair exercise: boundary values"
    minutes: 15
    description: Pairs write parameterised tests for the discount calculator ...
    objectives:
      - { id: TF-2.1, level: Apply }      # the level participants work at in THIS activity
      - { id: TF-2.2, level: Analyse }
```

A complete example is in [`examples/testing-fundamentals/`](examples/testing-fundamentals/). **All example data is fictional.**

## Example output (coverage, shortened)

```
| Objective | Target | Status                   | Practised in                            |
|-----------|--------|--------------------------|-----------------------------------------|
| TF-2.1    | Apply  | ✓ covered · over-covered | A3 (Understand), A4 (Apply), A5 (Apply) |
| TF-3.2    | Apply  | ◐ partial                | A3 (Understand)                         |
| TF-3.5    | Evaluate | ✗ missing              | –                                       |

Agenda hygiene
- Activity A6 references unknown objective `TF-4.1`
- Activity A0 serves no objective (energiser, break — or a candidate to cut?)

Audience level introductory: 75 % of objectives target Remember / Understand / Apply;
expected at least 70 % — ✓ matches the profile.
```

## Use it with Claude Code

[`.claude/skills/analyze-learning-objectives/SKILL.md`](.claude/skills/analyze-learning-objectives/SKILL.md) is a Claude Code skill that runs `lint` and `coverage`, interprets the findings and proposes rewrites and agenda changes for the designer to accept or reject.

## How this was built

The linter grew out of my own course-design work. I defined the problem, the eight rules and the thresholds; Claude Code drafted much of the implementation and the tests. For this public version, Claude Code extracted the linter from a private codebase, replaced all course data with fictional examples and added the `coverage` and `review` commands.

Three rules I follow when working with AI:

1. It only sees what I would also show a client.
2. It says what it has done.
3. Nothing leaves the house without human review.

## Credits

- Bloom's revised taxonomy: L. W. Anderson & D. R. Krathwohl (Eds.), *A Taxonomy for Learning, Teaching, and Assessing: A Revision of Bloom's Taxonomy of Educational Objectives*, 2001 — building on B. S. Bloom et al., 1956.
- Dependencies: [js-yaml](https://github.com/nodeca/js-yaml) (MIT), [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) (MIT, only used by `review`).

## Related tools

Small tools from my work as a trainer and facilitator:

- [miro-board-builder](https://github.com/andreasschliep/miro-board-builder): describe a Miro board in YAML, check it offline, then build it through the REST API
- [facilitation-planner](https://github.com/andreasschliep/facilitation-planner): plan a session backwards from acceptance sentences and let a checker keep the timing honest
- [wardley-map-builder](https://github.com/andreasschliep/wardley-map-builder): render Wardley maps from YAML to PNG or onto a Miro board

More about me: [github.com/andreasschliep](https://github.com/andreasschliep)

## License

MIT, see [LICENSE](LICENSE).
