# Architecture

P.A.I.D. is a single-page React application built with Vite. Capacitor wraps the same web build in an Android shell. Everything runs on the device: there is no server, account or network call.

## Layers

Source lives in `src/`, one directory per *owner*. Each owner exposes a `public.ts` entry point. `eslint.config.js` enforces which owners may import which. Breaking a boundary is a lint error, not a convention.

```
            ┌──────────────────────────── app ─────────────────────────────┐
            │ composition root, bootstrap, browser/native storage adapters │
            └───────┬───────────────┬───────────────┬──────────────┬───────┘
                    │               │               │              │
              presentation       session         platform       recovery
              (React UI)     (app machine)   (Capacitor shell)  (checkpoints)
                    │               │                              │
                    │               └──────────── engine ──────────┘
                    │                    (activity machines, bindings)
                    │                     │                │
                    │                   study        competencies
                    │            (content bank,  (per-competency math,
                    │             schemas)        models, evaluators)
                    └──────────────── core ───────────────┘
                     (exact decimals, ids, quantities, responses)
```

| Owner | Responsibility | May not use |
|---|---|---|
| `core` | Exact-decimal arithmetic (wrapping `bignumber.js`), identifiers, quantities, response values and provider records | Any other owner; React; XState; Capacitor |
| `study` | The learner-facing content bank: competency, activity and scenario definitions, validated with Zod | Owners above it; React; XState; Capacitor |
| `competencies` | One folder per competency (`c03-overtime-pay`, `c04-percentage-change`, `c06-commission`), each with `math`, `model` and `evaluators`. Competencies cannot import each other | `study` and the owners above it; React; XState; Capacitor |
| `engine` | XState activity machines, per-competency activity bindings, semantic frames and review | `recovery`, `session`, `presentation`, `platform`, `app`; React; Capacitor |
| `recovery` | Versioned checkpoint format, projection, rehydration and the storage port | `session`, `presentation`, `platform`, `app`; React; Capacitor |
| `session` | The app-level machine: navigation between destinations, competency and activity selection, completion | `presentation`, `platform`, `app`; React; Capacitor |
| `presentation` | React components and CSS modules: Library, galleries, activity hosts, interactive models, feedback, navigation, motion and audio cues | `recovery`, `session`, `platform`, `app`; Capacitor |
| `platform` | The Android native shell: `@capacitor/preferences` storage for the Recovery checkpoint and hardware Back. It is `null` in a browser | Every owner except `core` |
| `app` | Composition root. It wires every owner together through exact, allow-listed public imports | Private (non-`public`) paths of other owners |

`src/main.tsx` imports the base stylesheet and calls `bootstrap()` from `src/app/bootstrap.tsx`.

## Implemented learning content

The catalogue in `src/study/competencies/` defines six competencies (C01–C06). The session's `isExecutableActivity` (`src/session/app-machine/public.ts`) controls which ones learners can open. At present that is **C03 Overtime Pay, C04 Percentage Change and C06 Commission**. Each has four activities in the same order:

| Family | Learner role |
|---|---|
| Prepare | Share first thinking before any rules are given |
| Explore and Learn | Build the idea with an interactive model |
| Apply | Calculate and explain in a new situation |
| Check and Transfer | Carry the reasoning to an unfamiliar case |

C01 Gross Income, C02 Net Pay and Statutory Deductions, and C05 Wage and Salary Representation and Conversion have content definitions, but the Library does not offer them.

## Saved progress (Recovery)

The app saves one checkpoint for the learner's current work and restores it at startup. In a browser the checkpoint is stored in `localStorage` (`src/app/browser-checkpoint-store.ts`). On Android it is stored in `@capacitor/preferences` under the same key and envelope (`src/platform/native-shell.ts`). The checkpoint format is versioned and validated in `src/recovery/`.

The Android WebView origin is the Capacitor default, `https://localhost`. Changing `server.androidScheme` or `server.hostname` in `capacitor.config.ts` after release would change that origin and lose browser-side storage on installed devices.

## Sound

`src/presentation/audio/cues.ts` maps semantic cue names to processed Ogg Opus files in `src/assets/audio/`. Learners can switch sound off, and the preference is stored separately. See `src/assets/audio/PROVENANCE.md` for how each cue was produced, and [`ASSETS.md`](../ASSETS.md) for the terms of each source.

## Tests

| Kind | Location | Runner |
|---|---|---|
| Unit and component | `src/**/*.test.ts(x)`, `tests/helpers/` | Vitest (`npm test`) |
| Browser end-to-end | `tests/e2e/*.browser.spec.ts` | Playwright, desktop Chromium |
| Accessibility | `tests/a11y/` | Playwright + axe-core |
| Phone layouts | `tests/mobile/` | Playwright, Pixel 7 emulation at 412, 360 and 384 px wide and in landscape |
| Content and oracle inventory | `scripts/validate-content.ts`, `tests/oracles/` | `npm run validate:content` |
| Visual baseline (opt-in) | `tests/baseline/` | `PAID_BASELINE=<label> npx playwright test --project=baseline` |

Many test and lint comments carry historical task and decision identifiers (such as `P10-T045` and `D054`). [`PROJECT-HISTORY.md`](PROJECT-HISTORY.md) explains them.
