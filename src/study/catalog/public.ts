import { z } from "zod";
import { isProviderRecordId } from "../../core/public";
import type {
  ActivityId,
  CompetencyId,
  ProviderRecordId,
  ScenarioId,
} from "../../core/public";
import {
  activityManifestSchema,
  competencyDefinitionSchema,
  scenarioDefinitionSchema,
} from "../schemas/public";
import type {
  ActivityManifest,
  CompetencyDefinition,
  ScenarioDefinition,
} from "../schemas/public";

/** Complete means complete for this supplied registry, not for the fixed bank. */
export const studyRegistrySchema = z.strictObject({
  complete: z.boolean(),
  competencies: z.array(competencyDefinitionSchema),
  activities: z.array(activityManifestSchema),
  scenarios: z.array(scenarioDefinitionSchema),
  contentIds: z.array(z.string().min(1)),
  responseContractIds: z.array(z.string().min(1)),
  modelProfileIds: z.array(z.string().min(1)),
  interactionProfileIds: z.array(z.string().min(1)),
  oracleIds: z.array(z.string().min(1)),
  providerRecordIds: z
    .array(z.custom<ProviderRecordId>(isProviderRecordId))
    .optional(),
});
export type StudyRegistry = z.input<typeof studyRegistrySchema>;
export type StudyCatalog = Readonly<{
  competencies: ReadonlyMap<CompetencyId, CompetencyDefinition>;
  activities: ReadonlyMap<ActivityId, ActivityManifest>;
  scenarios: ReadonlyMap<ScenarioId, ScenarioDefinition>;
}>;

function index<T extends { readonly id: string }>(
  entries: readonly T[],
  name: string,
): Map<T["id"], T> {
  const map = new Map<T["id"], T>();
  for (const entry of entries) {
    if (map.has(entry.id)) throw new Error(`Duplicate ${name}: ${entry.id}`);
    map.set(entry.id, entry);
  }
  return map;
}

function identifiers(values: readonly string[], name: string): Set<string> {
  const set = new Set(values);
  if (set.size !== values.length) throw new Error(`Duplicate ${name}`);
  return set;
}

function resolve(found: boolean, complete: boolean, name: string): void {
  if (!found && complete) throw new Error(`Dangling ${name}`);
}

function freezeDefinition<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freezeDefinition(nested);
    Object.freeze(value);
  }
  return value;
}

/** A frozen Map still permits set(); this facade exposes no mutator or backing map. */
function readonlyIndex<K, V>(source: Map<K, V>): ReadonlyMap<K, V> {
  const view: ReadonlyMap<K, V> = Object.freeze({
    get: (key: K) => source.get(key),
    has: (key: K) => source.has(key),
    get size() {
      return source.size;
    },
    keys: () => source.keys(),
    values: () => source.values(),
    entries: () => source.entries(),
    [Symbol.iterator]: () => source.entries(),
    forEach: (callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void) => {
      for (const [key, value] of source) callback(value, key, view);
    },
  });
  return view;
}

/** Structural parsing plus only those membership checks knowable from the supplied data. */
export function composeStudyCatalog(input: unknown): StudyCatalog {
  const data = studyRegistrySchema.parse(input);
  const competencies = index(data.competencies, "competency");
  const activities = index(data.activities, "activity");
  const scenarios = index(data.scenarios, "scenario");
  const content = identifiers(data.contentIds, "content ID");
  const responses = identifiers(data.responseContractIds, "response ID");
  const models = identifiers(data.modelProfileIds, "model ID");
  const interactions = identifiers(
    data.interactionProfileIds,
    "interaction ID",
  );
  const oracles = identifiers(data.oracleIds, "oracle ID");
  const providerRecords = identifiers(
    data.providerRecordIds ?? [],
    "provider record ID",
  );

  for (const competency of competencies.values()) {
    for (const id of competency.activityIds) {
      // Ownership is structural, independent of registry completeness or presence.
      if (!id.startsWith(`${competency.id}-`))
        throw new Error(`Wrong competency for ${id}`);
      const activity = activities.get(id);
      if (activity && activity.competencyId !== competency.id)
        throw new Error(`Wrong competency for ${id}`);
      resolve(!!activity, data.complete, `activity ${id}`);
    }
  }
  for (const activity of activities.values()) {
    const owner = competencies.get(activity.competencyId);
    if (owner && !owner.activityIds.includes(activity.id))
      throw new Error(`Unlisted activity ${activity.id}`);
    resolve(!!owner, data.complete, `competency ${activity.competencyId}`);
    for (const id of activity.scenarioIds) {
      const scenario = scenarios.get(id);
      if (
        scenario &&
        (scenario.activityId !== activity.id ||
          scenario.competencyId !== activity.competencyId)
      )
        throw new Error(`Wrong scenario ownership ${id}`);
      resolve(!!scenario, data.complete, `scenario ${id}`);
    }
    for (const ref of activity.contentReferences)
      resolve(
        content.has(ref.contentId),
        data.complete,
        `content ${ref.contentId}`,
      );
    resolve(
      responses.has(activity.responseContract.contractId),
      data.complete,
      `response ${activity.responseContract.contractId}`,
    );
    if (activity.modelBinding) {
      resolve(
        models.has(activity.modelBinding.profileId),
        data.complete,
        `model ${activity.modelBinding.profileId}`,
      );
      if (activity.modelBinding.interactionProfileId)
        resolve(
          interactions.has(activity.modelBinding.interactionProfileId),
          data.complete,
          `interaction ${activity.modelBinding.interactionProfileId}`,
        );
    }
    if (activity.oracle)
      resolve(
        oracles.has(activity.oracle.oracleId),
        data.complete,
        `oracle ${activity.oracle.oracleId}`,
      );
    for (const ref of activity.providerReferences ?? []) {
      if (ref.consumerCompetencyId !== activity.competencyId)
        throw new Error(`Wrong provider consumer ${activity.id}`);
      if (isProviderRecordId(ref.sourceRecordId)) {
        resolve(
          providerRecords.has(ref.sourceRecordId),
          data.complete,
          `provider source ${ref.sourceRecordId}`,
        );
      } else {
        const source = scenarios.get(ref.sourceRecordId);
        if (source && source.competencyId !== ref.providerCompetencyId)
          throw new Error(`Wrong provider source ${ref.sourceRecordId}`);
        resolve(
          !!source,
          data.complete,
          `provider source ${ref.sourceRecordId}`,
        );
      }
    }
    if (activity.successorActivityId)
      resolve(
        activities.has(activity.successorActivityId),
        data.complete,
        `successor ${activity.successorActivityId}`,
      );
  }
  for (const scenario of scenarios.values()) {
    const activity = activities.get(scenario.activityId);
    if (activity && !activity.scenarioIds.includes(scenario.id))
      throw new Error(`Unlisted scenario ${scenario.id}`);
    resolve(
      !!activity,
      data.complete,
      `scenario activity ${scenario.activityId}`,
    );
    for (const ref of scenario.providerReferences ?? []) {
      if (ref.consumerCompetencyId !== scenario.competencyId)
        throw new Error(`Wrong provider consumer ${scenario.id}`);
      if (isProviderRecordId(ref.sourceRecordId)) {
        resolve(
          providerRecords.has(ref.sourceRecordId),
          data.complete,
          `provider source ${ref.sourceRecordId}`,
        );
      } else {
        const source = scenarios.get(ref.sourceRecordId);
        if (source && source.competencyId !== ref.providerCompetencyId)
          throw new Error(`Wrong provider source ${ref.sourceRecordId}`);
        resolve(
          !!source,
          data.complete,
          `provider source ${ref.sourceRecordId}`,
        );
      }
    }
  }
  // Zod detaches plain input objects; ExactDecimal is already immutable.
  for (const entry of [
    ...competencies.values(),
    ...activities.values(),
    ...scenarios.values(),
  ])
    freezeDefinition(entry);
  return Object.freeze({
    competencies: readonlyIndex(competencies),
    activities: readonlyIndex(activities),
    scenarios: readonlyIndex(scenarios),
  });
}
