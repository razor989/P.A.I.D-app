import { isQuantity } from "../quantities/public";
import type { Quantity } from "../quantities/public";
import type { DomainResolution } from "../semantic-values/public";

/** Selection identities are supplied by later fixed study definitions, never by UI text. */
export type AtomicResponse =
  | Readonly<{ kind: "SINGLE_SELECTION"; selectionId: string }>
  | Readonly<{ kind: "MULTIPLE_SELECTIONS"; selectionIds: readonly string[] }>
  | Readonly<{ kind: "EXACT_QUANTITY"; value: Quantity }>
  | Readonly<{
      kind: "SEMANTIC_BOUNDARY";
      resolution: Exclude<DomainResolution<never>, { kind: "KNOWN" }>;
    }>;

export type LearnerResponse =
  | AtomicResponse
  | Readonly<{
      kind: "COMPOSITE";
      parts: readonly Readonly<{ key: string; response: AtomicResponse }>[];
    }>
  | Readonly<{
      kind: "MODEL_STATE";
      modelId: string;
      entries: readonly Readonly<{ key: string; response: AtomicResponse }>[];
    }>;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fields(value: Record<string, unknown>, ...names: string[]): boolean {
  return (
    Object.keys(value).length === names.length &&
    names.every((name) => Object.prototype.hasOwnProperty.call(value, name))
  );
}

function identity(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.trim() === value
  );
}

function exactQuantity(value: unknown): value is Quantity {
  return (
    record(value) &&
    fields(value, "magnitude", "kind", "unit", "basis") &&
    isQuantity(value)
  );
}

function atomic(value: unknown): value is AtomicResponse {
  if (!record(value)) return false;
  switch (value.kind) {
    case "SINGLE_SELECTION":
      return (
        fields(value, "kind", "selectionId") && identity(value.selectionId)
      );
    case "MULTIPLE_SELECTIONS":
      return (
        fields(value, "kind", "selectionIds") &&
        Array.isArray(value.selectionIds) &&
        value.selectionIds.length > 0 &&
        value.selectionIds.every(identity) &&
        new Set(value.selectionIds).size === value.selectionIds.length
      );
    case "EXACT_QUANTITY":
      return fields(value, "kind", "value") && exactQuantity(value.value);
    case "SEMANTIC_BOUNDARY": {
      if (!fields(value, "kind", "resolution") || !record(value.resolution))
        return false;
      const resolution = value.resolution;
      return resolution.kind === "NOT_APPLICABLE"
        ? fields(resolution, "kind")
        : (resolution.kind === "UNKNOWN" || resolution.kind === "UNDEFINED") &&
            fields(resolution, "kind", "reason") &&
            identity(resolution.reason);
    }
    default:
      return false;
  }
}

/** Structural validity only: no activity options, mathematics or correctness oracle. */
export function isLearnerResponse(value: unknown): value is LearnerResponse {
  if (!record(value)) return false;
  if (atomic(value)) return true;
  if (value.kind !== "COMPOSITE" && value.kind !== "MODEL_STATE") return false;
  const model = value.kind === "MODEL_STATE";
  if (
    !fields(
      value,
      ...(model ? ["kind", "modelId", "entries"] : ["kind", "parts"]),
    )
  )
    return false;
  if (model && !identity(value.modelId)) return false;
  const entries: unknown = model ? value.entries : value.parts;
  return (
    Array.isArray(entries) &&
    entries.length > 0 &&
    entries.every(
      (entry: unknown) =>
        record(entry) &&
        fields(entry, "key", "response") &&
        identity(entry.key) &&
        atomic(entry.response),
    ) &&
    new Set(entries.map((entry: { key: string }) => entry.key)).size ===
      entries.length
  );
}

/** Returns an independent, frozen response snapshot; never interprets its meaning. */
export function parseLearnerResponse(value: unknown): LearnerResponse {
  if (!isLearnerResponse(value))
    throw new TypeError("Invalid learner response");
  if (value.kind === "COMPOSITE" || value.kind === "MODEL_STATE") {
    const entries = value.kind === "COMPOSITE" ? value.parts : value.entries;
    const copy = Object.freeze(
      entries.map((entry) =>
        Object.freeze({ key: entry.key, response: copyAtomic(entry.response) }),
      ),
    );
    return value.kind === "COMPOSITE"
      ? Object.freeze({ kind: value.kind, parts: copy })
      : Object.freeze({
          kind: value.kind,
          modelId: value.modelId,
          entries: copy,
        });
  }
  return copyAtomic(value);
}

function copyAtomic(value: AtomicResponse): AtomicResponse {
  switch (value.kind) {
    case "SINGLE_SELECTION":
      return Object.freeze({
        kind: value.kind,
        selectionId: value.selectionId,
      });
    case "MULTIPLE_SELECTIONS":
      return Object.freeze({
        kind: value.kind,
        selectionIds: Object.freeze([...value.selectionIds]),
      });
    case "EXACT_QUANTITY":
      return Object.freeze({
        kind: value.kind,
        value: Object.freeze({
          magnitude: value.value.magnitude,
          kind: value.value.kind,
          unit: value.value.unit,
          basis: value.value.basis,
        }),
      });
    case "SEMANTIC_BOUNDARY":
      return Object.freeze({
        kind: value.kind,
        resolution: Object.freeze({ ...value.resolution }),
      });
  }
}
