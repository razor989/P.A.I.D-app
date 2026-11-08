# Project history

This page explains the identifiers that appear throughout the code, tests and commit messages. They are a historical record of how P.A.I.D. was built. They are **not** active instructions for contributors.

## The P.A.I.D. Context System

Development was governed by a separate, **private** repository called the *P.A.I.D. Context System*. It holds the project specification, research sources, numbered decisions and bounded task packets. This repository implements those tasks. The Context System is not published, and nothing in this repository needs it to build, test or run.

One test refers to it directly: `tests/oracles/public.test.ts` checks that each oracle fixture's source document exists in a sibling `../PAID-Context-System` checkout. That test sits outside Vitest's default `include`, so it never runs in a normal checkout. `tests/oracles/LEDGER.md` records those source paths for provenance only.

## Identifiers you will see

| Pattern | Meaning | Example |
|---|---|---|
| `P10-Tnnn`, `Tnnn` | An implementation task in phase P10 | `T045` (C04 activity production), `T080` (sound) |
| `P10-Dnnn`, `Dnnn` | A recorded project decision | `D226` (C04 compatibility amendment) |
| `Sn`, `Stage D/E` | Steps within a task's acceptance plan | `P10-T027 Stage E` in `eslint.config.js` |
| `D1`–`D6` (October 2026 commits) | Steps of the instructional-model foundation milestone | `feat: D4 embedded C02 PhilHealth Floor Check` |
| `C01`–`C06` | Competencies | `C04` Percentage Change |
| `Cnn-Ann`, `Cnn-Snn` | An activity, or a scenario, within a competency | `C03-A02`, `C04-S02` |
| "owner-accepted", "authorized" | The project owner reviewed and accepted the work | — |

Where these identifiers appear in code comments, they mark *why* a rule or boundary exists. They are kept for traceability and do not need to be understood to work on the code.

## Timeline (from Git)

| Period | Work |
|---|---|
| 2026-10-08 to 10-10 | Package baseline, React/Vite scaffold, lint, formatting, module boundaries, verification toolchain (`T001`–`T005`) |
| 2026-10-10 to 10-13 | Core contracts: identifiers, exact decimals, quantities, responses, providers; study schemas; fixed content definitions for C01–C06; content gate and oracle bank (`T007`–`T019`) |
| 2026-10-13 to 10-20 | C04 mathematics and model, shared activity machine, registry, semantic frames, Recovery store and rehydration, app session, navigation, composition root, startup recovery (`T023`–`T037`) |
| 2026-10-21 to 10-24 | Design tokens and fonts, shells, shared controls, feedback surfaces, accessibility coordinator, reduced motion, C04 Anchored Change Track (`T038`–`T044`) |
| 2026-11-01 to 11-04 | C04 activities completed (`T045`); C03 Overtime Pay mathematics, model, recovery and four activities (`T062`) |
| 2026-11-04 to 11-05 | C06 Commission mathematics, evaluators, recovery and experience (`T072`) |
| 2026-11-06 | Learning Library, activity galleries, navigation motion, floating lesson navigation |
| 2026-11-07 | Phone layouts, learner-facing copy rewrite, sound identity; tag `web-baseline-2026-11-07` |
| 2026-11-08 | Android shell (Capacitor 8) with native Recovery storage and hardware Back |

The full record is in `git log`.
