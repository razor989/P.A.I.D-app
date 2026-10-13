/// <reference types="node" />
import { registerHooks } from "node:module";

// Node 24 strips TypeScript types but does not resolve this bank's extensionless ESM specifiers.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)
        ? `${specifier}.ts`
        : specifier,
      context,
    );
  },
});

async function main(): Promise<void> {
  const { actualContentBank, validateContent } =
    await import("../src/study/validation/public");
  const { oracles, scenarioLedger, validateOracles } =
    await import("../tests/oracles/public");
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    (args.length === 1 && args[0] !== "--self-test-invalid")
  )
    throw new Error("Unsupported CLI argument");
  // Only one bounded negative probe: it cannot replace, bypass or accept a different bank.
  const bank = args.length
    ? Object.freeze({
        ...actualContentBank,
        parts: Object.freeze(actualContentBank.parts.slice(1)),
      })
    : actualContentBank;
  const summary = validateContent(bank);
  validateOracles(oracles);
  if (scenarioLedger.length !== 25 || oracles.length !== 91)
    throw new Error(
      "Oracle inventory: expected 25 primary scenarios and 91 rows",
    );
  for (const [kind, count] of Object.entries({
    PRIMARY: 31,
    VARIANT: 20,
    SUPPORTING: 10,
    STATUTORY_QA: 16,
    POLICY: 14,
  }))
    if (oracles.filter((row) => row.class === kind).length !== count)
      throw new Error(`Oracle class ${kind}: expected ${count}`);
  const activities = new Map(
    bank.parts.flatMap((part) =>
      part.activities.map((item) => [item.id, item] as const),
    ),
  );
  const scenarios = new Map(
    bank.parts.flatMap((part) =>
      part.scenarios.map((item) => [item.id, item] as const),
    ),
  );
  for (const row of oracles) {
    if (row.class === "POLICY" || row.class === "STATUTORY_QA") {
      if (row.activityId !== null || row.scenarioId !== null)
        throw new Error(
          `${row.id}: supporting/policy oracle promoted to learner progress`,
        );
      continue;
    }
    if (
      row.class === "SUPPORTING" &&
      row.activityId === null &&
      row.scenarioId === null
    ) {
      if (
        row.competencyId === null ||
        !bank.parts.some((part) => part.competency.id === row.competencyId)
      )
        throw new Error(`${row.id}: unsupported supporting oracle owner`);
      continue;
    }
    if (
      row.activityId === null ||
      row.scenarioId === null ||
      activities.get(row.activityId)?.competencyId !== row.competencyId ||
      scenarios.get(row.scenarioId)?.activityId !== row.activityId
    )
      throw new Error(
        `${row.id}: oracle activity/scenario trace does not resolve`,
      );
    if (
      (row.class === "PRIMARY" || row.class === "VARIANT") &&
      !scenarioLedger.some(
        (spec) =>
          spec.competency === row.competencyId &&
          `${spec.competency}-S0${spec.ordinal}` === row.scenarioId &&
          spec.cases.some(
            (item) =>
              item.label === row.caseId &&
              item.outputs.some((output) => output[0] === row.role),
          ),
      )
    )
      throw new Error(
        `${row.id}: oracle output role absent from source ledger`,
      );
  }
  console.log(
    `Content valid: ${summary.competencies} competencies, ${summary.activities} learner activities, ${summary.scenarios} primary scenarios, ${summary.providerEdges} provider edges, ${oracles.length} test-only oracle rows compatible. Future runtime handlers/reveal scheduling deferred.`,
  );
}

main().catch((error: unknown) => {
  console.error(
    `Content invalid: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
