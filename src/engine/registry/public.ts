import { isActivityId } from "../../core/public";
import type { ActivityId } from "../../core/public";
import { validateActivityDefinition } from "../activity-machine/public";
import type {
  ActivityDefinition,
  ActivityPorts,
} from "../activity-machine/public";

/** Structural executable binding, NOT authentication of a canonical Study manifest. */
export type ExecutableActivityBinding = Readonly<{
  activityId: ActivityId;
  definition: ActivityDefinition;
  ports: ActivityPorts;
}>;

const portNames = [
  "ready",
  "evaluate",
  "completionEligible",
  "sourceReviewAvailable",
  "informationNeeded",
  "informationReturn",
] as const;

const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

function retain(value: unknown): ExecutableActivityBinding {
  if (
    !plain(value) ||
    Reflect.ownKeys(value).length !== 3 ||
    !["activityId", "definition", "ports"].every((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    ) ||
    !isActivityId(value.activityId)
  )
    throw new TypeError("Invalid executable activity binding");
  validateActivityDefinition(value.definition);
  if (value.activityId !== value.definition.activityId)
    throw new TypeError("Conflicting activity identity");
  if (
    !plain(value.ports) ||
    Reflect.ownKeys(value.ports).length !== portNames.length ||
    !portNames.every(
      (name) =>
        Object.prototype.hasOwnProperty.call(value.ports, name) &&
        typeof (value.ports as Record<string, unknown>)[name] === "function",
    )
  )
    throw new TypeError("Invalid activity ports");

  // T024 definitions are plain, validated graph data; clone before freezing so
  // caller-owned definitions remain mutable without changing registered edges.
  const definition = structuredClone(value.definition);
  for (const edges of Object.values(definition.edges)) Object.freeze(edges);
  for (const modes of Object.values(definition.support)) Object.freeze(modes);
  Object.freeze(definition.edges);
  Object.freeze(definition.support);
  Object.freeze(definition);
  // Functions cannot be cloned or authenticated. Copy the port table, not its
  // caller-owned container; later composition must supply trusted callbacks.
  const supplied = value.ports as ActivityPorts;
  const ports = Object.freeze({
    ready: supplied.ready,
    evaluate: supplied.evaluate,
    completionEligible: supplied.completionEligible,
    sourceReviewAvailable: supplied.sourceReviewAvailable,
    informationNeeded: supplied.informationNeeded,
    informationReturn: supplied.informationReturn,
  });
  return Object.freeze({ activityId: value.activityId, definition, ports });
}

/** Closed approved ID set, constructor-only bindings; no plugin/discovery API. */
export class ActivityRegistry {
  readonly #bindings = new Map<ActivityId, ExecutableActivityBinding>();

  constructor(bindings: readonly ExecutableActivityBinding[]) {
    if (!Array.isArray(bindings)) throw new TypeError("Invalid registrations");
    for (const input of bindings) {
      const binding = retain(input);
      if (this.#bindings.has(binding.activityId))
        throw new Error(`Duplicate activity binding: ${binding.activityId}`);
      this.#bindings.set(binding.activityId, binding);
    }
    Object.freeze(this);
  }

  isKnown(id: unknown): id is ActivityId {
    return isActivityId(id);
  }

  resolve(id: unknown): ExecutableActivityBinding {
    if (!isActivityId(id)) throw new TypeError("Unknown activity ID");
    const binding = this.#bindings.get(id);
    if (!binding) throw new Error(`Unbound activity ID: ${id}`);
    return binding;
  }
}
