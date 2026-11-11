# Rubric: eight ways a learning objective goes wrong

A learning objective describes what a learner will be able to **do** after the session, in a way someone could observe and check. Each rule in `lo-lint` looks for one common way that promise gets lost. The examples are fictional.

The rules are heuristics based on word lists (`src/data/verbs.json`). They catch the typical cases cheaply; they do not understand meaning. Treat every finding as a prompt to look, not as a verdict.

| Rule | Status | What it means | Weak | Better |
|------|--------|---------------|------|--------|
| `compound` | fail / warn | Two outcomes in one sentence. One of them usually goes untested. | "Identify and analyse flaky tests." | Two objectives: "Identify …" and "Analyse …" |
| `vague-verb` | fail | A mental state (know, understand, be aware of) cannot be observed. | "Understand test doubles." | "Explain when a stub is enough and when a mock is needed." |
| `verb-level-mismatch` | fail (2+ levels apart) / warn (1 level) | The verb and the claimed Bloom level disagree, so the activity and the assessment will aim at different things. | "List the properties of a good test." claimed as *Evaluate* | Either claim *Remember*, or "Assess a test against five properties of a good test." |
| `trainer-centred` | fail | Describes what the trainer or the course does, not what the learner can do. | "The trainer will demonstrate TDD." | "Demonstrate one red-green-refactor cycle on a small kata." |
| `content-centred` | warn | A topic heading, not an outcome. There is no behaviour to check. | "Test doubles: mocks, stubs and fakes." | "Use a suitable test double in three given situations." |
| `granularity` | warn | Fewer than 5 words is too thin to assess; more than 35 words usually hides several objectives. | "Master testing." | One sentence, one behaviour, one context. |
| `aspirational` | fail | An attitude (inspire, embrace, embody). Worth having, but not assessable as an objective. | "Embrace test-first development." | "Demonstrate test-first development by writing the failing test before the code in a short kata." — or move the attitude to a values statement. |
| `activity-as-outcome` | fail | Names the activity (participate, attend), not what it produces. | "Participate in a mob-testing session." | "Identify one defect together with a group, starting from a shared failing test." |

## Bloom levels

`lo-lint` uses the six levels of the revised taxonomy, from lowest to highest: **Remember, Understand, Apply, Analyse, Evaluate, Create**. The American spelling *Analyze* is accepted as input.

## Coverage statuses

`lo-lint coverage` compares each objective's target level with the level at which agenda activities practise it:

- **covered** — at least one activity practises the objective at or above its target level
- **partial** — the objective is practised, but only below its target level (for example: participants watch a demo for an *Apply* objective)
- **missing** — no activity practises it
- **over-covered** — three or more activities practise it (configurable with `--over`); maybe one of them could serve another objective

The audience profile check (`metadata.audience_level`) compares the spread of target levels with a rough expectation per audience level, defined in `src/data/bloom-profiles.json`. It is advisory and does not affect the exit code.
