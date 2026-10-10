# P.A.I.D. Application

This repository contains the implementation of the P.A.I.D. offline instructional application.

## Governing authority

The **P.A.I.D. Context System is the external authoritative project, specification, decision, task, and verification authority** for this implementation repository. The Context System remains in its separate repository and is not copied into `PAID-App`.

Implementation work in this repository must follow the currently active bounded task packet and the applicable decisions maintained by the external P.A.I.D. Context System.

## Current baseline

P10-T001 establishes only the private single-package npm/Git repository and approved dependency baseline. Application source, configuration, tests, Android scaffolding, and product behavior are intentionally deferred to later authorized tasks.

## Current verification commands

Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit`, `npm run test:component`, `npm run test:coverage`, `npm run test:e2e`, `npm run test:a11y`, and `npm run build` from the repository root. The browser commands use the locally served blank Vite shell and the pinned Playwright Chromium browser. The current tests establish tooling smoke coverage, not product acceptance or accessibility conformance.

`validate:content` is reserved for P10-T019 and is not implemented yet. The full web-side `verify` gate is also deferred until its constituent checks exist; neither name currently has a passing placeholder script. Android release acceptance is separate from these web commands.

Authoritative source, tests, configuration, and lockfiles remain in Git. `node_modules/`, `dist/`, coverage and browser reports, local verification output, Android build products, and synced Android web assets are generated and excluded by `.gitignore`. The future `android/` project itself remains source-controlled.