import { isActivityId } from "../../core/public";
import type { ActivityId } from "../../core/public";
import {
  validateActivityDefinition,
  validateActivityModelAdapter,
  validateActivityIntentAdapter,
} from "../activity-machine/public";
import type {
  ActivityDefinition,
  ActivityPorts,
  ActivityModelAdapter,
  ActivityIntentAdapter,
} from "../activity-machine/public";

/** Structural executable binding, NOT authentication of a canonical Study manifest. */
export type ExecutableActivityBinding = Readonly<{
  activityId: ActivityId;
  definition: ActivityDefinition;
  ports: ActivityPorts;
  modelAdapter?: ActivityModelAdapter;
  intentAdapter?: ActivityIntentAdapter;
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
    Reflect.ownKeys(value).length !==
      3 +
        ("modelAdapter" in value ? 1 : 0) +
        ("intentAdapter" in value ? 1 : 0) ||
    !Reflect.ownKeys(value).every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && "value" in descriptor;
    }) ||
    !["activityId", "definition", "ports"].every((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    ) ||
    !isActivityId(value.activityId)
  )
    throw new TypeError("Invalid executable activity binding");
  validateActivityDefinition(value.definition);
  if (value.activityId !== value.definition.activityId)
    throw new TypeError("Conflicting activity identity");
  if (!!value.definition.modelSelection !== "modelAdapter" in value)
    throw new TypeError("Model metadata and adapter must be supplied together");
  if ("modelAdapter" in value) validateActivityModelAdapter(value.modelAdapter);
  if (!!value.definition.modelIntents !== "intentAdapter" in value)
    throw new TypeError(
      "Model intent policy and adapter must be supplied together",
    );
  if ("intentAdapter" in value)
    validateActivityIntentAdapter(value.intentAdapter);
  if (
    value.definition.instructionalContinuation &&
    !(value.intentAdapter as ActivityIntentAdapter | undefined)
      ?.continuationState
  )
    throw new TypeError(
      "Continuation requires trusted family state capability",
    );
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
  const freezeMetadata = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    for (const child of Object.values(value) as unknown[])
      freezeMetadata(child);
    Object.freeze(value);
  };
  if (definition.responseStages) freezeMetadata(definition.responseStages);
  if (definition.terminalTeaching) freezeMetadata(definition.terminalTeaching);
  if (definition.modelSelection) freezeMetadata(definition.modelSelection);
  if (definition.modelIntents) freezeMetadata(definition.modelIntents);
  if (definition.instructionalContinuation)
    freezeMetadata(definition.instructionalContinuation);
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
  const adapter = value.modelAdapter as ActivityModelAdapter | undefined;
  const intentAdapter = value.intentAdapter as
    ActivityIntentAdapter | undefined;
  return Object.freeze({
    activityId: value.activityId,
    definition,
    ports,
    ...(intentAdapter
      ? {
          intentAdapter: Object.freeze({
            initialize: intentAdapter.initialize,
            transition: intentAdapter.transition,
            ...(intentAdapter.continuationState
              ? { continuationState: intentAdapter.continuationState }
              : {}),
          }),
        }
      : {}),
    ...(adapter
      ? {
          modelAdapter: Object.freeze({
            initialize: adapter.initialize,
            select: adapter.select,
          }),
        }
      : {}),
  });
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
