import {
  isCompetencyId,
  isProviderRecordId,
  isScenarioId,
} from "../ids/public";
import type { ProviderRecordId, ScenarioId } from "../ids/public";
import { isQuantity } from "../quantities/public";
import type { Quantity } from "../quantities/public";
import type { Result } from "../semantic-values/public";

/** Only outputs expressly identified by the approved dependency matrix (section 4.1).
 * This is NOT a complete scenario-bank source-output-key catalog.
 */
const PROVIDER_EXPORTS = Object.freeze({
  C01: Object.freeze({ C02: Object.freeze(["gross-income result"] as const) }),
  C03: Object.freeze({ C01: Object.freeze(["overtime-pay value"] as const) }),
  C05: Object.freeze({
    C01: Object.freeze([
      "wage/salary representation",
      "converted pay value",
    ] as const),
    C03: Object.freeze(["hourly-rate representation"] as const),
    C04: Object.freeze(["contextual wage/salary representation"] as const),
  }),
  C06: Object.freeze({ C01: Object.freeze(["commission amount"] as const) }),
});

export type ProviderCompetency = keyof typeof PROVIDER_EXPORTS;
export type ProviderExport = {
  [P in ProviderCompetency]: {
    [C in keyof (typeof PROVIDER_EXPORTS)[P]]: Readonly<{
      providerCompetencyId: P;
      consumerCompetencyId: C;
      sourceOutputKey: (typeof PROVIDER_EXPORTS)[P][C] extends readonly (infer Key)[]
        ? Key
        : never;
    }>;
  }[keyof (typeof PROVIDER_EXPORTS)[P]];
}[ProviderCompetency];

export type ProviderProvenance = ProviderExport &
  Readonly<{
    sourceRecordId: ScenarioId | ProviderRecordId;
    relevantCondition: string | null;
  }>;

export type ProviderRead =
  | Readonly<{
      kind: "ESTABLISHED";
      provenance: ProviderProvenance;
      result: Result<Quantity>;
    }>
  | Readonly<{
      kind: "TECHNICAL_FAILURE";
      error: string;
    }>;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fields(value: Record<string, unknown>, ...keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function label(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim() === value
  );
}

function exactQuantity(value: unknown): value is Quantity {
  return (
    record(value) &&
    fields(value, "magnitude", "kind", "unit", "basis") &&
    isQuantity(value)
  );
}

function isProvenance(value: unknown): value is ProviderProvenance {
  if (
    !record(value) ||
    !fields(
      value,
      "providerCompetencyId",
      "consumerCompetencyId",
      "sourceOutputKey",
      "sourceRecordId",
      "relevantCondition",
    ) ||
    !isCompetencyId(value.providerCompetencyId) ||
    !isCompetencyId(value.consumerCompetencyId) ||
    !label(value.sourceOutputKey) ||
    !(value.relevantCondition === null || label(value.relevantCondition))
  )
    return false;
  const source = value.sourceRecordId;
  if (
    !(
      isScenarioId(source) &&
      source.startsWith(value.providerCompetencyId + "-")
    ) &&
    !(isProviderRecordId(source) && value.providerCompetencyId === "C05")
  )
    return false;
  const exportsByConsumer: unknown =
    PROVIDER_EXPORTS[value.providerCompetencyId as ProviderCompetency];
  if (!record(exportsByConsumer)) return false;
  const keys: unknown = exportsByConsumer[value.consumerCompetencyId];
  return (
    Array.isArray(keys) &&
    keys.some((key: unknown) => key === value.sourceOutputKey)
  );
}

/** Pure validation: cannot calculate, change or remove a provider-owned value. */
export function isProviderRead(value: unknown): value is ProviderRead {
  if (!record(value)) return false;
  if (value.kind === "TECHNICAL_FAILURE")
    return fields(value, "kind", "error") && label(value.error);
  if (
    value.kind !== "ESTABLISHED" ||
    !fields(value, "kind", "provenance", "result") ||
    !isProvenance(value.provenance) ||
    !record(value.result) ||
    !fields(value.result, "resolution", "availability") ||
    (value.result.availability !== "AVAILABLE" &&
      value.result.availability !== "WITHHELD") ||
    !record(value.result.resolution)
  )
    return false;
  const resolution = value.result.resolution;
  if (resolution.kind === "KNOWN") {
    return (
      fields(resolution, "kind", "value") &&
      exactQuantity(resolution.value) &&
      resolution.value.kind === value.provenance.sourceOutputKey
    );
  }
  if (resolution.kind === "NOT_APPLICABLE") return fields(resolution, "kind");
  return (
    (resolution.kind === "UNKNOWN" || resolution.kind === "UNDEFINED") &&
    fields(resolution, "kind", "reason") &&
    label(resolution.reason)
  );
}

/** Frozen snapshot; ExactDecimal is already immutable. No learner-facing reveal method. */
export function parseProviderRead(value: unknown): ProviderRead {
  if (!isProviderRead(value)) throw new TypeError("Invalid provider read");
  if (value.kind === "TECHNICAL_FAILURE")
    return Object.freeze({ kind: value.kind, error: value.error });
  const resolution = value.result.resolution;
  const copy =
    resolution.kind === "KNOWN"
      ? Object.freeze({
          kind: resolution.kind,
          value: Object.freeze({
            magnitude: resolution.value.magnitude,
            kind: resolution.value.kind,
            unit: resolution.value.unit,
            basis: resolution.value.basis,
          }),
        })
      : Object.freeze({ ...resolution });
  return Object.freeze({
    kind: value.kind,
    provenance: Object.freeze({ ...value.provenance }),
    result: Object.freeze({
      availability: value.result.availability,
      resolution: copy,
    }),
  });
}
