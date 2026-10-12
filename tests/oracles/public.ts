import { ExactDecimal } from "../../src/core/exact-decimal/public";
import { oracles, scenarioLedger, sources } from "./bank";
import type { Oracle } from "./bank";

export { oracles, scenarioLedger, sources } from "./bank";
export type { Oracle } from "./bank";

/** Test-only integrity: compare complete literals and source identities, never calculate results. */
export function validateOracles(input: readonly Oracle[]): void {
  if (!Array.isArray(input) || !Object.isFrozen(input))
    throw new Error("Mutable oracle collection");
  const seen = new Set<string>();
  const reference = new Map(oracles.map((row) => [row.id, row]));
  if (input.length !== oracles.length)
    throw new Error("Oracle inventory mismatch");
  for (const item of input) {
    if (!item || typeof item.id !== "string" || seen.has(item.id))
      throw new Error("Duplicate or invalid fixture identity");
    seen.add(item.id);
    const authority = reference.get(item.id);
    if (!authority) throw new Error(`Unauthorized fixture: ${item.id}`);
    if (!deepFrozen(item))
      throw new Error(`Mutable nested fixture: ${item.id}`);
    if (
      !item.source?.path ||
      !item.source.section ||
      !item.source.decision ||
      !approvedSource(item.source.path)
    )
      throw new Error(`Invalid source trace: ${item.id}`);
    if (JSON.stringify(item) !== JSON.stringify(authority))
      throw new Error(`Oracle/source mismatch: ${item.id}`);
    if (item.expected?.resolution === "KNOWN") {
      if (item.expected.magnitude === null)
        throw new Error("Missing numeric literal");
      ExactDecimal.from(item.expected.magnitude);
    }
  }
  if (seen.size !== reference.size)
    throw new Error("Missing authoritative fixture");
}

export function approvedSource(path: string): boolean {
  return (
    Object.values(sources.banks).some(
      (name) => path === `03 Decisions/Implementation-Baseline/A/${name}`,
    ) ||
    Object.values(sources).some(
      (value) => typeof value === "string" && value === path,
    ) ||
    oracles.some(
      (fixture) => fixture.class === "POLICY" && fixture.source.path === path,
    )
  );
}

export function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value))
    return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) return false;
  if (
    Array.isArray(value) &&
    (keys.length !== value.length + 1 ||
      keys.some((key) => key !== "length" && !/^(0|[1-9]\d*)$/.test(key)))
  )
    return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      descriptor !== undefined &&
      "value" in descriptor &&
      (key === "length" || descriptor.enumerable) &&
      descriptor.value !== undefined &&
      typeof descriptor.value !== "function" &&
      deepFrozen(descriptor.value, seen)
    );
  });
}

/** Exact equality after authorized decimal parsing; no epsilon, arithmetic or evaluator import. */
export function matchesLiteral(actual: string, fixture: Oracle): boolean {
  if (
    fixture.expected?.resolution !== "KNOWN" ||
    fixture.expected.magnitude === null
  )
    throw new Error("No known magnitude");
  return ExactDecimal.from(actual).equals(
    ExactDecimal.from(fixture.expected.magnitude),
  );
}

export function resolveOracle(
  criteria: Readonly<{
    activityId?: string;
    scenarioId?: string;
    caseId?: string | null;
    role?: string;
    id?: string;
  }>,
): Oracle {
  const matches = oracles.filter(
    (item) =>
      (criteria.id === undefined || item.id === criteria.id) &&
      (criteria.activityId === undefined ||
        item.activityId === criteria.activityId) &&
      (criteria.scenarioId === undefined ||
        item.scenarioId === criteria.scenarioId) &&
      (criteria.caseId === undefined || item.caseId === criteria.caseId) &&
      (criteria.role === undefined || item.role === criteria.role),
  );
  if (matches.length !== 1)
    throw new Error(
      `Oracle lookup ${matches.length === 0 ? "missing" : "ambiguous"}`,
    );
  return matches[0]!;
}

export function findOracles(activityId: string): readonly Oracle[] {
  return Object.freeze(
    oracles.filter((item) => item.activityId === activityId),
  );
}
