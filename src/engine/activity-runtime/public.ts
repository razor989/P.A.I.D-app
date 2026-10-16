import { createActor } from "xstate";
import { createActivityMachine } from "../activity-machine/public";
import { ActivityRegistry } from "../registry/public";

/** Each call returns a new unstarted actor. The authorized caller owns start/stop. */
export function createActivityActor(registry: ActivityRegistry, id: unknown) {
  if (!(registry instanceof ActivityRegistry))
    throw new TypeError("Invalid activity registry");
  const binding = registry.resolve(id);
  return createActor(
    createActivityMachine(
      binding.definition,
      binding.ports,
      binding.modelAdapter,
    ),
  );
}

export type ActivityActor = ReturnType<typeof createActivityActor>;
