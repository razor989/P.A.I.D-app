import {
  ExactDecimal,
  isProviderRead,
  isProviderRecordId,
  isScenarioId,
  quantity,
} from "../../core/public";
import type { ProviderProvenance, Quantity } from "../../core/public";
import type { ActivityManifest, ScenarioDefinition } from "../schemas/public";
import { c01Activities, c01Scenarios } from "../competencies/c01/public";
import { c02Activities, c02Scenarios } from "../competencies/c02/public";
import { c03Activities, c03Scenarios } from "../competencies/c03/public";
import { c04Activities, c04Scenarios } from "../competencies/c04/public";
import {
  c05Activities,
  c05James,
  c05Scenarios,
} from "../competencies/c05/public";
import {
  c06Activities,
  c06CommissionProvider,
  c06Scenarios,
} from "../competencies/c06/public";

/** No progress identity, navigation, reveal policy or calculated result is registered here. */
export type ProviderReviewDefinition = Readonly<{
  sourceRecordId: string;
  sourceCompetencyId: string;
  consumerScenarioId: string;
  consumerActivityId: string;
  consumerCompetencyId: string;
  sourceOutputKey: string;
  sourceOwnedOutputKey: string;
  relevantCondition: string | null;
  allowedOutputs: readonly string[];
  origin: Readonly<{ sourceRecordId: string; sourceCompetencyId: string }>;
  read: Readonly<{
    kind: "ESTABLISHED";
    provenance: ProviderProvenance;
    result: Readonly<{
      availability: "AVAILABLE";
      resolution: Readonly<{ kind: "KNOWN"; value: Quantity }>;
    }>;
  }>;
}>;

export type ProviderReviewBank = Readonly<{
  activities: readonly ActivityManifest[];
  scenarios: readonly ScenarioDefinition[];
  james: typeof c05James;
  commission: typeof c06CommissionProvider;
}>;

const actualBank: ProviderReviewBank = Object.freeze({
  activities: Object.freeze([
    ...c01Activities,
    ...c02Activities,
    ...c03Activities,
    ...c04Activities,
    ...c05Activities,
    ...c06Activities,
  ]),
  scenarios: Object.freeze([
    ...c01Scenarios,
    ...c02Scenarios,
    ...c03Scenarios,
    ...c04Scenarios,
    ...c05Scenarios,
    ...c06Scenarios,
  ]),
  james: c05James,
  commission: c06CommissionProvider,
});

const established = (text: string): Quantity =>
  quantity(ExactDecimal.from(text), "MONETARY_AMOUNT", "PHP", null);

// These are source-established outputs, not an oracle bank or producer arithmetic.
// C03-S03 and C01-S03 have no separate producer-output object in the fixed bank;
// their approved source results are frozen by XDEP-001 and the C01 scenario bank.
const outputs = Object.freeze({
  "C05-PV-JAMES-01": c05James.establishedRegularPay,
  "C03-S03": established("937.50"),
  "C06-S04": c06CommissionProvider.read.result.resolution.value,
  "C01-S03": established("12937.50"),
});

const sourceKeys = Object.freeze({
  "C05-PV-JAMES-01": c05James.provenance.sourceOutputKey,
  "C03-S03": "overtime-pay value",
  "C06-S04": c06CommissionProvider.read.provenance.sourceOutputKey,
  "C01-S03": "gross-income result",
});

type Source = keyof typeof outputs;
const isSource = (id: string): id is Source =>
  Object.prototype.hasOwnProperty.call(outputs, id);

function snapshot(value: unknown): unknown {
  if (value instanceof ExactDecimal) return { decimal: value.toString() };
  if (Array.isArray(value)) return value.map(snapshot);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, snapshot(entry)]),
    );
  return value;
}
const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(snapshot(a)) === JSON.stringify(snapshot(b));

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Provider integrity: ${message}`);
}

function sealedData(value: unknown): boolean {
  if (value instanceof ExactDecimal) return Object.isFrozen(value);
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value !== "object" || !Object.isFrozen(value)) return false;
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  return Object.values(value).every(sealedData);
}

/** Source/consumer authority is checked against the committed fixed-bank records,
 * not merely against the syntactic T009 category whitelist. */
export function validateProviderReviewGraph(
  bank: ProviderReviewBank,
  definitions: readonly ProviderReviewDefinition[],
): void {
  assert(bank.james === c05James, "missing or forged James provider state");
  assert(
    bank.commission === c06CommissionProvider,
    "missing or altered commission source",
  );
  assert(
    bank.activities.length === actualBank.activities.length &&
      bank.scenarios.length === actualBank.scenarios.length,
    "invented or missing learner activity/scenario",
  );
  for (const expected of actualBank.activities) {
    const found = bank.activities.filter((entry) => entry.id === expected.id);
    assert(
      found.length === 1 && same(found[0], expected),
      `activity ${expected.id}`,
    );
  }
  for (const expected of actualBank.scenarios) {
    const found = bank.scenarios.filter((entry) => entry.id === expected.id);
    assert(
      found.length === 1 && same(found[0], expected),
      `scenario ${expected.id}`,
    );
  }

  const seen = new Set<string>();
  const refs: {
    scenario: ScenarioDefinition;
    activity: ActivityManifest;
    ref: ProviderProvenance;
  }[] = [];
  for (const scenario of bank.scenarios) {
    const activity = bank.activities.find(
      (item) => item.id === scenario.activityId,
    );
    assert(
      activity && activity.competencyId === scenario.competencyId,
      "consumer ownership",
    );
    assert(
      same(
        scenario.providerReferences ?? [],
        activity.providerReferences ?? [],
      ),
      `activity/scenario provider references ${scenario.id}`,
    );
    for (const ref of scenario.providerReferences ?? []) {
      assert(
        isScenarioId(ref.sourceRecordId) ||
          isProviderRecordId(ref.sourceRecordId),
        "source identity",
      );
      assert(
        isSource(ref.sourceRecordId),
        `unapproved source ${ref.sourceRecordId}`,
      );
      const source = bank.scenarios.find(
        (item) => item.id === ref.sourceRecordId,
      );
      assert(
        source
          ? source.competencyId === ref.providerCompetencyId
          : ref.sourceRecordId === bank.james.id &&
              ref.providerCompetencyId === "C05",
        `source owner ${ref.sourceRecordId}`,
      );
      assert(
        ref.consumerCompetencyId === scenario.competencyId,
        "consumer competency",
      );
      refs.push({ scenario, activity, ref });
    }
  }
  assert(
    definitions.length === refs.length,
    "missing or extra provider output",
  );
  for (const { scenario, activity, ref } of refs) {
    const matches = definitions.filter(
      (item) =>
        item.consumerScenarioId === scenario.id &&
        item.sourceRecordId === ref.sourceRecordId,
    );
    assert(matches.length === 1, `duplicate/missing output ${scenario.id}`);
    const definition = matches[0]!;
    assert(sealedData(definition), "mutable or executable provider definition");
    const sourceId = ref.sourceRecordId;
    assert(isSource(sourceId), "unapproved output source");
    // The ONLY different producer/consumer key mapping is the approved James
    // regular-pay representation for this exact source and consumer.
    assert(
      definition.sourceOwnedOutputKey === sourceKeys[sourceId] &&
        (ref.sourceOutputKey === sourceKeys[sourceId] ||
          (sourceId === "C05-PV-JAMES-01" &&
            scenario.id === "C01-S03" &&
            ref.sourceOutputKey === "converted pay value")),
      "unapproved output key or alias",
    );
    const expected = Object.freeze({
      sourceRecordId: sourceId,
      sourceCompetencyId: ref.providerCompetencyId,
      consumerScenarioId: scenario.id,
      consumerActivityId: activity.id,
      consumerCompetencyId: ref.consumerCompetencyId,
      sourceOutputKey: ref.sourceOutputKey,
      sourceOwnedOutputKey: sourceKeys[sourceId],
      relevantCondition: ref.relevantCondition,
      allowedOutputs: [ref.sourceOutputKey],
      origin: {
        sourceRecordId: sourceId,
        sourceCompetencyId: ref.providerCompetencyId,
      },
      read: {
        kind: "ESTABLISHED",
        provenance: ref,
        result: {
          availability: "AVAILABLE",
          resolution: { kind: "KNOWN", value: outputs[sourceId] },
        },
      },
    });
    assert(
      same(definition, expected),
      `wrong output/condition/quantity ${sourceId}`,
    );
    assert(
      isProviderRead(definition.read),
      `invalid provider read ${sourceId}`,
    );
    assert(
      definition.read.result.resolution.value.magnitude instanceof ExactDecimal,
      "non-exact value",
    );
    const consumerFact =
      sourceId === "C05-PV-JAMES-01"
        ? "C05-established regular pay for the month"
        : sourceId === "C03-S03"
          ? "C03-established overtime pay for the same month"
          : sourceId === "C06-S04"
            ? "C06-established June commission"
            : "C01-S03 established monthly gross income";
    const fact = scenario.facts.find((item) => item.key === consumerFact);
    assert(
      fact?.resolution.kind === "KNOWN" &&
        same(fact.resolution.value, outputs[sourceId]),
      `source/consumer quantity mismatch ${sourceId}`,
    );
    const key = `${scenario.id}:${sourceId}:${ref.sourceOutputKey}`;
    assert(!seen.has(key), "duplicate provider reference");
    seen.add(key);
  }
}

function makeDefinitions(
  bank: ProviderReviewBank,
): readonly ProviderReviewDefinition[] {
  return Object.freeze(
    bank.scenarios.flatMap((scenario) =>
      (scenario.providerReferences ?? []).map((ref) => {
        assert(isSource(ref.sourceRecordId), "unapproved source");
        const activity = bank.activities.find(
          (item) => item.id === scenario.activityId,
        );
        assert(activity, "missing consumer activity");
        return Object.freeze({
          sourceRecordId: ref.sourceRecordId,
          sourceCompetencyId: ref.providerCompetencyId,
          consumerScenarioId: scenario.id,
          consumerActivityId: activity.id,
          consumerCompetencyId: ref.consumerCompetencyId,
          sourceOutputKey: ref.sourceOutputKey,
          sourceOwnedOutputKey: sourceKeys[ref.sourceRecordId],
          relevantCondition: ref.relevantCondition,
          allowedOutputs: Object.freeze([ref.sourceOutputKey]),
          origin: Object.freeze({
            sourceRecordId: ref.sourceRecordId,
            sourceCompetencyId: ref.providerCompetencyId,
          }),
          read: Object.freeze({
            kind: "ESTABLISHED" as const,
            provenance: Object.freeze({ ...ref }),
            result: Object.freeze({
              availability: "AVAILABLE" as const,
              resolution: Object.freeze({
                kind: "KNOWN" as const,
                value: outputs[ref.sourceRecordId],
              }),
            }),
          }),
        });
      }),
    ),
  );
}

/** Only four instantiated scenario edges; the hourly-rate C03 provenance is
 * source support without a C03 consumer providerReferences edge. */
export const providerReviewDefinitions = makeDefinitions(actualBank);
validateProviderReviewGraph(actualBank, providerReviewDefinitions);

/** A missing/mismatched lookup is a technical integrity error, never UNKNOWN. */
export function lookupProviderReview(
  consumerScenarioId: string,
  reference: ProviderProvenance,
): ProviderReviewDefinition {
  const match = providerReviewDefinitions.find(
    (item) =>
      item.consumerScenarioId === consumerScenarioId &&
      same(item.read.provenance, reference),
  );
  assert(match, `unresolved provider reference ${consumerScenarioId}`);
  return match;
}
