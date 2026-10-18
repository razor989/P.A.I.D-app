import { isActivityId, isLearnerResponse } from "../../core/public";
import type { ActivityId } from "../../core/public";
import {
  currentPrimaryCommitmentValid,
  availableModelSelections,
  instructionalContinueEligible,
  modelIntentPermitted,
  primaryResponseReady,
  stagedResponseReady,
} from "../activity-machine/public";
import type {
  ActivityContext,
  ActivityDefinition,
  ActivityEvent,
  ActivityPorts,
  CompletionEvidence,
  Position,
  SupportPhase,
} from "../activity-machine/public";
import { projectReview, projectSourceReview } from "../review/public";
import type {
  ReviewAuthorization,
  ReviewProjection,
  SafeText,
  SourceReviewAuthorization,
  SourceReviewProjection,
} from "../review/public";

export type Exposure = Readonly<{
  content: SafeText;
  /** Source-authored exposure scope; checked alone is never a universal reveal. */
  phases: readonly Position[];
  timing: "PUBLIC" | "CURRENT_CHECK" | "CURRENT_FEEDBACK" | "EXPLICIT_REVEAL";
  /** Explicit reveal is tied to a particular current check, not a boolean. */
  revealRevision?: number;
}>;
export type PublicResponseControl = Readonly<{
  role: string;
  acceptedKinds: readonly string[];
  options?: readonly SafeText[];
}>;
export type ChoiceExposure = Readonly<{
  activityId: ActivityId;
  contractId: string;
  version: number;
  stage: "RESPONSE" | "PRIMARY" | "REASONING";
  controls: readonly PublicResponseControl[];
}>;
export type ResponseStageProjection = "PRIMARY" | "REASONING";
const familySemantics = {
  C01: {
    source: "P9B-MDL-C01-01",
    roles: ["EARNING_RECORD", "GROSS_SUMMARY"],
    relations: ["MEMBER_OF"],
  },
  C02: {
    source: "P9B-MDL-C02-01",
    roles: [
      "GROSS",
      "SSS",
      "GSIS",
      "PHILHEALTH",
      "PAG_IBIG",
      "BIR",
      "CONTROLLING_BASIS",
      "DEDUCTION_RULE",
      "DEDUCTION_CONSEQUENCE",
      "TOTAL_DEDUCTIONS",
      "NET",
    ],
    relations: [
      "ROW_BASIS",
      "BASIS_RULE",
      "RULE_CONSEQUENCE",
      "DEDUCTION_SUBTOTAL",
      "GROSS_MINUS_SUBTOTAL",
    ],
  },
  C03: {
    source: "P9B-MDL-C03-01",
    roles: ["WORK_CONDITION", "MULTIPLIER", "OVERTIME"],
    relations: ["CONDITION_MULTIPLIER", "MULTIPLIER_OVERTIME"],
  },
  C04: {
    source: "P9B-MDL-C04-01",
    roles: ["ORIGINAL", "NEW", "DIFFERENCE", "PERCENTAGE"],
    relations: ["ORIGINAL_NEW_DIFFERENCE", "ORIGINAL_RELATIVE_PERCENTAGE"],
  },
  C05: {
    source: "P9B-MDL-C05-01",
    roles: ["YEAR", "MONTH", "SEMIMONTHLY"],
    relations: [
      "YEAR_TWELVE_MONTHS",
      "MONTH_TWO_SEMIMONTHLY",
      "ESTABLISHED_GIVEN",
    ],
  },
  C06: {
    source: "P9B-MDL-C06-01",
    roles: ["ARRANGEMENT", "SALES", "RATE", "BASE", "COMMISSION", "TOTAL"],
    relations: ["SALES_RATE_COMMISSION", "BASE_COMMISSION_TOTAL"],
  },
} as const;
export type GraphicalFamily = keyof typeof familySemantics;
type FamilyRole<F extends GraphicalFamily> =
  (typeof familySemantics)[F]["roles"][number];
type FamilyRelation<F extends GraphicalFamily> =
  (typeof familySemantics)[F]["relations"][number];
export type PublishedQuantity = Readonly<
  | { status: "KNOWN"; amount: string; unit: string; provenance: string }
  | {
      status: "UNKNOWN" | "UNDEFINED" | "NOT_APPLICABLE";
      unit: string;
      provenance: string;
    }
>;
export type FamilyElement<F extends GraphicalFamily> = Readonly<{
  id: string;
  role: FamilyRole<F>;
  exposure: Exposure;
  quantity?: PublishedQuantity;
  state:
    | "FIXED"
    | "SELECTED"
    | "PARTICIPATING"
    | "AVAILABLE"
    | "EXPLORATORY_PARTIAL"
    | "EXPLORATORY_COMPLETE"
    | "ESTABLISHED_GIVEN";
}>;
export type FamilyRelationship<F extends GraphicalFamily> = Readonly<{
  id: string;
  kind: FamilyRelation<F>;
  from: readonly string[];
  to: string;
  exposure: Exposure;
}>;
export type FamilyPresentation<F extends GraphicalFamily> = Readonly<{
  family: F;
  activityId: ActivityId;
  scenarioId: string;
  position: Position;
  modelId: string;
  revision: number;
  sourceId: (typeof familySemantics)[F]["source"];
  elements: readonly FamilyElement<F>[];
  relationships: readonly FamilyRelationship<F>[];
  focus: Readonly<{
    targets: readonly string[];
    explanation: Exposure;
    reinforcement: readonly Exposure[];
  }>;
  readingOrder: readonly string[];
  controls: readonly Readonly<{
    target: string;
    exposure: Exposure;
    event: Extract<
      ActivityEvent,
      { type: "MODEL_INTENT" | "SELECT_MODEL_CHILD" }
    >;
  }>[];
}>;
export type SafeFamilyModel = {
  [F in GraphicalFamily]: Readonly<{
    family: F;
    sourceId: (typeof familySemantics)[F]["source"];
    activityId: ActivityId;
    scenarioId: string;
    position: Position;
    modelId: string;
    revision: number;
    elements: readonly Readonly<
      Omit<FamilyElement<F>, "exposure"> & { content: SafeText }
    >[];
    relationships: readonly Readonly<
      Omit<FamilyRelationship<F>, "exposure"> & { content: SafeText }
    >[];
    focus?: Readonly<{
      targets: readonly string[];
      explanation: SafeText;
      reinforcement: readonly SafeText[];
    }>;
    readingOrder: readonly string[];
    controls: readonly Readonly<{
      target: string;
      content: SafeText;
      event: Extract<
        ActivityEvent,
        { type: "MODEL_INTENT" | "SELECT_MODEL_CHILD" }
      >;
    }>[];
  }>;
}[GraphicalFamily];
/** Capability object, not serialized presentation input. The constructor is a
 * TRUSTED composition API like ActivityModelAdapter, not source authentication.
 * Its producer must authenticate model issuance and canonical prose itself.
 */
export type FamilyProjectionAuthority = Readonly<{ family: GraphicalFamily }>;
type FamilyProducer = Readonly<{
  family: GraphicalFamily;
  activityId: ActivityId;
  scenarioId: string;
  modelId: string;
  project: (
    context: ActivityContext,
    phase: Position,
  ) => FamilyPresentation<GraphicalFamily> | null;
}>;
const familyIssuers = new WeakMap<FamilyProjectionAuthority, FamilyProducer>();

export function createFamilyProjectionAuthority(
  producer: FamilyProducer,
): FamilyProjectionAuthority {
  if (
    !closedRecord(producer, [
      "family",
      "activityId",
      "scenarioId",
      "modelId",
      "project",
    ]) ||
    !Object.prototype.hasOwnProperty.call(familySemantics, producer.family) ||
    !isActivityId(producer.activityId) ||
    !producer.activityId.startsWith(`${producer.family}-`) ||
    producer.scenarioId !== producer.activityId.replace("-A", "-S") ||
    !semanticId(producer.modelId) ||
    typeof producer.project !== "function"
  )
    throw new TypeError("Invalid trusted family producer");
  const token = Object.freeze({ family: producer.family });
  familyIssuers.set(token, Object.freeze({ ...producer }));
  return token;
}

const semanticId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;
const semanticArray = (value: unknown): boolean => Array.isArray(value);
function closedRecord(value: unknown, keys: readonly string[]): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).length === keys.length &&
    keys.every((key) => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      return d !== undefined && "value" in d;
    })
  );
}
/** No accessors, extra array properties, cycles, symbols or model instances. */
function cloneSemanticData(
  value: unknown,
  ancestors = new Set<object>(),
): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (!value || typeof value !== "object" || ancestors.has(value))
    throw new TypeError("Unsafe family data");
  const array = Array.isArray(value);
  if (
    Object.getPrototypeOf(value) !==
    (array ? Array.prototype : Object.prototype)
  )
    throw new TypeError("Unsafe family prototype");
  ancestors.add(value);
  if (array && Reflect.ownKeys(value).length !== value.length + 1)
    throw new TypeError("Unsafe family array");
  const result: Record<string, unknown> = {};
  const list: unknown[] = [];
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === "length") continue;
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !d || !("value" in d))
      throw new TypeError("Unsafe family property");
    const child = cloneSemanticData(d.value, ancestors);
    if (array) list.push(child);
    else Object.defineProperty(result, key, { value: child, enumerable: true });
  }
  ancestors.delete(value);
  return Object.freeze(array ? list : result);
}

function validateSemanticExposure(value: unknown): asserts value is Exposure {
  if (!value || typeof value !== "object")
    throw new TypeError("Invalid family exposure");
  const entry = value as Record<string, unknown>;
  const reveal = Object.prototype.hasOwnProperty.call(value, "revealRevision");
  if (
    !closedRecord(value, [
      "content",
      "phases",
      "timing",
      ...(reveal ? ["revealRevision"] : []),
    ]) ||
    !closedRecord(entry.content, ["id", "text"]) ||
    !semanticId((entry.content as SafeText).id) ||
    !semanticId((entry.content as SafeText).text) ||
    !Array.isArray(entry.phases) ||
    !entry.phases.length ||
    !entry.phases.every(phaseValid) ||
    ![
      "PUBLIC",
      "CURRENT_CHECK",
      "CURRENT_FEEDBACK",
      "EXPLICIT_REVEAL",
    ].includes(entry.timing as string) ||
    (entry.timing === "EXPLICIT_REVEAL"
      ? !Number.isSafeInteger(entry.revealRevision) ||
        (entry.revealRevision as number) < 0
      : reveal)
  )
    throw new TypeError("Invalid family exposure");
}

/** Validate the supplied stage graph BEFORE exposure removes protected endpoints.
 * A source-authorized stage may omit future roles; every supplied dependent
 * role must still have its complete incoming relationship. C06 arrangements
 * remain complete, because a partial arrangement would manufacture a hybrid.
 * Quantities remain source-owned: this checks meaning/topology, not arithmetic.
 */
function validateFamilyTopology(value: FamilyPresentation<GraphicalFamily>) {
  const roles = familySemantics[value.family].roles as readonly string[];
  const byRole = (role: string) =>
    value.elements.filter((element) => element.role === role);
  for (const role of roles) {
    const count = byRole(role).length;
    const repeated =
      value.family === "C02" ||
      [
        "EARNING_RECORD",
        "CONTROLLING_BASIS",
        "DEDUCTION_RULE",
        "DEDUCTION_CONSEQUENCE",
      ].includes(role);
    if ((!repeated && count > 1) || (value.family === "C06" && count !== 1))
      throw new TypeError("Invalid family role cardinality");
  }
  if (!value.elements.length) throw new TypeError("Empty family stage");
  const rootRoles: Record<GraphicalFamily, readonly string[]> = {
    C01: ["EARNING_RECORD"],
    C02: ["GROSS"],
    C03: ["WORK_CONDITION"],
    C04: ["ORIGINAL", "NEW"],
    C05: ["YEAR", "MONTH"],
    C06: ["ARRANGEMENT"],
  };
  if (!rootRoles[value.family].some((role) => byRole(role).length))
    throw new TypeError("Missing family stage anchor");
  const roleOf = (id: string) =>
    value.elements.find((element) => element.id === id)?.role;
  const endpoints: Record<string, readonly [readonly string[], string]> = {
    MEMBER_OF: [["EARNING_RECORD"], "GROSS_SUMMARY"],
    ROW_BASIS: [["DEDUCTION"], "CONTROLLING_BASIS"],
    BASIS_RULE: [["CONTROLLING_BASIS"], "DEDUCTION_RULE"],
    RULE_CONSEQUENCE: [["DEDUCTION_RULE"], "DEDUCTION_CONSEQUENCE"],
    DEDUCTION_SUBTOTAL: [
      [
        "DEDUCTION_CONSEQUENCE",
        "DEDUCTION_CONSEQUENCE",
        "DEDUCTION_CONSEQUENCE",
        "DEDUCTION_CONSEQUENCE",
      ],
      "TOTAL_DEDUCTIONS",
    ],
    GROSS_MINUS_SUBTOTAL: [["GROSS", "TOTAL_DEDUCTIONS"], "NET"],
    CONDITION_MULTIPLIER: [["WORK_CONDITION"], "MULTIPLIER"],
    MULTIPLIER_OVERTIME: [["MULTIPLIER"], "OVERTIME"],
    ORIGINAL_NEW_DIFFERENCE: [["ORIGINAL", "NEW"], "DIFFERENCE"],
    ORIGINAL_RELATIVE_PERCENTAGE: [["ORIGINAL", "DIFFERENCE"], "PERCENTAGE"],
    YEAR_TWELVE_MONTHS: [["YEAR"], "MONTH"],
    MONTH_TWO_SEMIMONTHLY: [["MONTH"], "SEMIMONTHLY"],
    ESTABLISHED_GIVEN: [["YEAR"], "MONTH"],
    SALES_RATE_COMMISSION: [["SALES", "RATE"], "COMMISSION"],
    BASE_COMMISSION_TOTAL: [["BASE", "COMMISSION"], "TOTAL"],
  };
  const signatures = new Set<string>();
  for (const relation of value.relationships) {
    const [from, to] = endpoints[relation.kind]!;
    const actual = relation.from.map(roleOf);
    const expectedFrom =
      value.family === "C02" &&
      value.activityId === "C02-A01" &&
      relation.kind === "DEDUCTION_SUBTOTAL"
        ? ["SSS", "PHILHEALTH", "PAG_IBIG", "BIR"]
        : from;
    const unmatched = [...actual];
    const target = roleOf(relation.to);
    const signature = `${relation.kind}:${[...relation.from].sort().join(",")}:${relation.to}`;
    if (
      signatures.has(signature) ||
      actual.length !== expectedFrom.length ||
      !expectedFrom.every((role) => {
        const index = unmatched.findIndex((item) =>
          role === "DEDUCTION"
            ? ["SSS", "GSIS", "PHILHEALTH", "PAG_IBIG", "BIR"].includes(item!)
            : item === role,
        );
        if (index < 0) return false;
        unmatched.splice(index, 1);
        return true;
      }) ||
      (to === "DEDUCTION"
        ? !["SSS", "GSIS", "PHILHEALTH", "PAG_IBIG", "BIR"].includes(target!)
        : target !== to)
    )
      throw new TypeError("Invalid family relationship endpoints");
    signatures.add(signature);
  }
  const count = (kind: string) =>
    value.relationships.filter((relation) => relation.kind === kind).length;
  if (value.family === "C02") {
    const rowFor = (
      id: string,
      seen = new Set<string>(),
    ): string | undefined => {
      if (seen.has(id)) return undefined;
      seen.add(id);
      if (
        ["SSS", "GSIS", "PHILHEALTH", "PAG_IBIG", "BIR"].includes(roleOf(id)!)
      )
        return id;
      const incoming = value.relationships.find(
        (relation) =>
          relation.to === id &&
          ["ROW_BASIS", "BASIS_RULE", "RULE_CONSEQUENCE"].includes(
            relation.kind,
          ),
      );
      return incoming ? rowFor(incoming.from[0]!, seen) : undefined;
    };
    for (const subtotal of value.relationships.filter(
      (relation) => relation.kind === "DEDUCTION_SUBTOTAL",
    )) {
      const rows = subtotal.from.map((id) => rowFor(id));
      const actualRoles = rows.map((id) => (id ? roleOf(id) : undefined));
      if (
        rows.some((id) => !id) ||
        new Set(rows).size !== 4 ||
        !["PHILHEALTH", "PAG_IBIG", "BIR"].every((role) =>
          actualRoles.includes(role as FamilyRole<GraphicalFamily>),
        ) ||
        actualRoles.filter((role) => role === "SSS" || role === "GSIS")
          .length !== 1
      )
        throw new TypeError("Invalid deduction subtotal chain");
    }
  }
  const requireCount = (kind: string, expected = 1) => {
    if (count(kind) !== expected)
      throw new TypeError("Incomplete family topology");
  };
  const requireIncoming = (kind: string, role: string) => {
    for (const element of byRole(role))
      if (
        value.relationships.filter(
          (relation) => relation.kind === kind && relation.to === element.id,
        ).length !== 1
      )
        throw new TypeError("Incomplete family topology");
  };
  switch (value.family) {
    case "C01": {
      const participating = byRole("EARNING_RECORD").filter(
        (element) => element.state === "PARTICIPATING",
      );
      requireCount("MEMBER_OF", participating.length);
      if (
        value.relationships.some(
          (relation) =>
            !participating.some((element) => element.id === relation.from[0]),
        )
      )
        throw new TypeError("Nonparticipating earning membership");
      break;
    }
    case "C02": {
      requireIncoming("ROW_BASIS", "CONTROLLING_BASIS");
      requireIncoming("BASIS_RULE", "DEDUCTION_RULE");
      requireIncoming("RULE_CONSEQUENCE", "DEDUCTION_CONSEQUENCE");
      requireIncoming("DEDUCTION_SUBTOTAL", "TOTAL_DEDUCTIONS");
      requireIncoming("GROSS_MINUS_SUBTOTAL", "NET");
      // Each row has its own chain, never a shared rule/consequence substituted
      // for the different statutory bases. Missing future chains are permitted.
      for (const kind of ["ROW_BASIS", "BASIS_RULE", "RULE_CONSEQUENCE"])
        if (
          new Set(
            value.relationships
              .filter((relation) => relation.kind === kind)
              .map((relation) => relation.from[0]),
          ).size !== count(kind)
        )
          throw new TypeError("Shared deduction chain");
      break;
    }
    case "C03":
      requireIncoming("CONDITION_MULTIPLIER", "MULTIPLIER");
      requireIncoming("MULTIPLIER_OVERTIME", "OVERTIME");
      break;
    case "C04":
      requireIncoming("ORIGINAL_NEW_DIFFERENCE", "DIFFERENCE");
      requireIncoming("ORIGINAL_RELATIVE_PERCENTAGE", "PERCENTAGE");
      break;
    case "C05":
      // An established monthly Given may begin the second source state without
      // carrying the preceding annual state into a universal conversion ladder.
      if (byRole("YEAR").length) requireIncoming("YEAR_TWELVE_MONTHS", "MONTH");
      else if (
        byRole("MONTH").some((element) => element.state !== "ESTABLISHED_GIVEN")
      )
        throw new TypeError("Unestablished monthly Given");
      requireIncoming("MONTH_TWO_SEMIMONTHLY", "SEMIMONTHLY");
      if (count("ESTABLISHED_GIVEN") > 1)
        throw new TypeError("Duplicate established Given");
      if (
        count("ESTABLISHED_GIVEN") &&
        byRole("MONTH")[0]!.state !== "ESTABLISHED_GIVEN"
      )
        throw new TypeError("Unestablished monthly Given");
      break;
    case "C06": {
      const arrangement = byRole("ARRANGEMENT")[0]!.quantity;
      const sales = byRole("SALES")[0]!.quantity;
      const rate = byRole("RATE")[0]!.quantity;
      const commission = byRole("COMMISSION")[0]!.quantity;
      const base = byRole("BASE")[0]!.quantity;
      const total = byRole("TOTAL")[0]!.quantity;
      requireCount("SALES_RATE_COMMISSION");
      if (
        (sales?.status !== "KNOWN" || rate?.status !== "KNOWN") &&
        (commission?.status === "KNOWN" || total?.status === "KNOWN")
      )
        throw new TypeError("Unestablished commission dependency");
      if (total?.status === "KNOWN" && commission?.status !== "KNOWN")
        throw new TypeError("Unestablished total dependency");
      if (arrangement?.status !== "KNOWN")
        throw new TypeError("Missing whole commission arrangement");
      if (arrangement.amount === "STRAIGHT_COMMISSION") {
        requireCount("BASE_COMMISSION_TOTAL", 0);
        if (
          base?.status !== "NOT_APPLICABLE" ||
          total?.status !== "NOT_APPLICABLE"
        )
          throw new TypeError("Hybrid straight commission arrangement");
      } else if (arrangement.amount === "BASE_PLUS_COMMISSION") {
        requireCount("BASE_COMMISSION_TOTAL");
        if (
          !base ||
          !total ||
          base.status === "NOT_APPLICABLE" ||
          total.status === "NOT_APPLICABLE" ||
          (base.status !== "KNOWN" && total.status === "KNOWN")
        )
          throw new TypeError("Hybrid base-plus commission arrangement");
      } else throw new TypeError("Unknown commission arrangement");
      break;
    }
  }
  const interactive =
    value.family === "C01"
      ? ["C01-A01", "C01-A02"].includes(value.activityId)
      : value.family === "C06"
        ? ["C06-A01", "C06-A02"].includes(value.activityId)
        : value.activityId === `${value.family}-A02`;
  if (!interactive && value.controls.length)
    throw new TypeError("Unauthorized static family controls");
}

function projectFamilyModel(
  input: FrameInput,
  currentCheck: boolean,
  currentFeedback: boolean,
): SafeFamilyModel | undefined {
  const token = input.content.familyProjection;
  if (!token) return undefined;
  const producer = familyIssuers.get(token);
  if (!producer) throw new TypeError("Unissued family authority");
  const c = input.context;
  const policy =
    input.definition.modelIntents ?? input.definition.modelSelection;
  const model = c.intentModel ?? c.model;
  if (
    producer.activityId !== c.activityId ||
    c.activityId !== input.definition.activityId ||
    input.phase !== c.position ||
    (policy &&
      (policy.modelId !== producer.modelId ||
        policy.scenarioId !== producer.scenarioId)) ||
    (model &&
      (model.modelId !== producer.modelId ||
        !Number.isSafeInteger(model.revision) ||
        model.revision < 0))
  )
    throw new TypeError("Wrong family projection binding");
  const supplied = producer.project(c, input.phase);
  if (supplied === null) return undefined;
  const value = cloneSemanticData(
    supplied,
  ) as FamilyPresentation<GraphicalFamily>;
  const semantics = familySemantics[producer.family];
  if (
    !closedRecord(value, [
      "family",
      "activityId",
      "scenarioId",
      "position",
      "modelId",
      "revision",
      "sourceId",
      "elements",
      "relationships",
      "focus",
      "readingOrder",
      "controls",
    ]) ||
    value.family !== producer.family ||
    value.activityId !== c.activityId ||
    value.scenarioId !== producer.scenarioId ||
    value.position !== input.phase ||
    value.modelId !== producer.modelId ||
    value.revision !== (model?.revision ?? 0) ||
    value.sourceId !== semantics.source ||
    !semanticArray(value.elements) ||
    !semanticArray(value.relationships) ||
    !semanticArray(value.readingOrder) ||
    !semanticArray(value.controls)
  )
    throw new TypeError("Invalid family presentation");
  const all = new Set<string>();
  const elementIds = new Set<string>();
  const text = (exposure: Exposure) =>
    projectFacts([exposure], input.phase, c, currentCheck, currentFeedback)[0];
  const add = (id: string) => {
    if (!semanticId(id) || !id.startsWith(`${producer.family}-`) || all.has(id))
      throw new TypeError("Invalid family semantic identity");
    all.add(id);
  };
  const elements: Readonly<
    Omit<FamilyElement<GraphicalFamily>, "exposure"> & { content: SafeText }
  >[] = [];
  for (const item of value.elements) {
    if (
      !closedRecord(item, [
        "id",
        "role",
        "exposure",
        "state",
        ...(item.quantity ? ["quantity"] : []),
      ]) ||
      !(semantics.roles as readonly string[]).includes(item.role) ||
      ![
        "FIXED",
        "SELECTED",
        "PARTICIPATING",
        "AVAILABLE",
        "EXPLORATORY_PARTIAL",
        "EXPLORATORY_COMPLETE",
        "ESTABLISHED_GIVEN",
      ].includes(item.state)
    )
      throw new TypeError("Invalid family element");
    add(item.id);
    elementIds.add(item.id);
    validateSemanticExposure(item.exposure);
    const q = item.quantity;
    if (
      q &&
      (!closedRecord(q, [
        "status",
        "unit",
        "provenance",
        ...(q.status === "KNOWN" ? ["amount"] : []),
      ]) ||
        !["KNOWN", "UNKNOWN", "UNDEFINED", "NOT_APPLICABLE"].includes(
          q.status,
        ) ||
        !semanticId(q.unit) ||
        !semanticId(q.provenance) ||
        (q.status === "KNOWN" && !semanticId(q.amount)))
    )
      throw new TypeError("Invalid family quantity");
    const content = text(item.exposure);
    // C02 ACTIVE assessment owns these answers even if a producer accidentally
    // marks a final-output row PUBLIC. Its endpoint-dependent relations/focus
    // are removed below as well. Other prose still requires trusted authorship.
    if (
      content &&
      !(
        producer.family === "C02" &&
        input.phase === "ACTIVE" &&
        c.activityId !== "C02-A01" &&
        ["TOTAL_DEDUCTIONS", "NET"].includes(item.role)
      )
    )
      elements.push(
        Object.freeze({
          id: item.id,
          role: item.role,
          state: item.state,
          ...(q ? { quantity: q } : {}),
          content,
        }),
      );
  }
  const visible = new Set(elements.map((item) => item.id));
  const relationships: SafeFamilyModel["relationships"][number][] = [];
  for (const item of value.relationships) {
    if (
      !closedRecord(item, ["id", "kind", "from", "to", "exposure"]) ||
      !(semantics.relations as readonly string[]).includes(item.kind) ||
      !semanticArray(item.from) ||
      !item.from.length ||
      new Set(item.from).size !== item.from.length ||
      !item.from.every((id: string) => elementIds.has(id)) ||
      !elementIds.has(item.to)
    )
      throw new TypeError("Invalid family relationship");
    add(item.id);
    validateSemanticExposure(item.exposure);
    const content = text(item.exposure);
    if (
      content &&
      item.from.every((id: string) => visible.has(id)) &&
      visible.has(item.to)
    ) {
      relationships.push(
        Object.freeze({
          id: item.id,
          kind: item.kind,
          from: item.from,
          to: item.to,
          content,
        }),
      );
      visible.add(item.id);
    }
  }
  if (
    new Set(value.readingOrder).size !== all.size ||
    value.readingOrder.length !== all.size ||
    !value.readingOrder.every((id) => all.has(id))
  )
    throw new TypeError("Invalid semantic reading order");
  if (
    !closedRecord(value.focus, ["targets", "explanation", "reinforcement"]) ||
    !semanticArray(value.focus.targets) ||
    !value.focus.targets.length ||
    !value.focus.targets.every((id) => all.has(id)) ||
    !semanticArray(value.focus.reinforcement)
  )
    throw new TypeError("Invalid semantic focus");
  validateSemanticExposure(value.focus.explanation);
  value.focus.reinforcement.forEach(validateSemanticExposure);
  const explanation = text(value.focus.explanation);
  const focus =
    explanation &&
    new Set(value.focus.targets).size === value.focus.targets.length &&
    value.focus.targets.every((id) => visible.has(id))
      ? Object.freeze({
          targets: value.focus.targets,
          explanation,
          reinforcement: Object.freeze(
            value.focus.reinforcement.flatMap((item) => {
              const projected = text(item);
              return projected ? [projected] : [];
            }),
          ),
        })
      : undefined;
  const controls: SafeFamilyModel["controls"][number][] = [];
  validateFamilyTopology(value);
  for (const control of value.controls) {
    if (
      !closedRecord(control, ["target", "exposure", "event"]) ||
      !elementIds.has(control.target)
    )
      throw new TypeError("Invalid family control");
    validateSemanticExposure(control.exposure);
    const event = control.event;
    const allowed =
      event.type === "MODEL_INTENT"
        ? modelIntentPermitted(c, input.definition.modelIntents, event)
        : event.type === "SELECT_MODEL_CHILD" &&
          closedRecord(event, [
            "type",
            "modelId",
            "selectionId",
            "revision",
            "position",
          ]) &&
          !!c.model &&
          event.modelId === c.model.modelId &&
          event.revision === c.model.revision &&
          event.position === c.position &&
          availableModelSelections(c, input.definition.modelSelection).includes(
            event.selectionId,
          );
    const content = text(control.exposure);
    if (
      input.support === "NONE" &&
      allowed &&
      content &&
      visible.has(control.target)
    )
      controls.push(Object.freeze({ target: control.target, content, event }));
  }
  // The producer owns source mathematics. This boundary additionally enforces
  // the closed family topology before releasing the exposure-filtered graph.
  return Object.freeze({
    family: producer.family,
    sourceId: semantics.source,
    activityId: c.activityId,
    scenarioId: producer.scenarioId,
    position: input.phase,
    modelId: producer.modelId,
    revision: model?.revision ?? 0,
    elements: Object.freeze(elements),
    relationships: Object.freeze(relationships),
    ...(focus ? { focus } : {}),
    readingOrder: Object.freeze(
      value.readingOrder.filter((id) => visible.has(id)),
    ),
    controls: Object.freeze(controls),
  }) as SafeFamilyModel;
}
/** D063/S1: opt-in eligibility only; none of these introduces an actor event.
 * Source: final Amendment C C01 §28 and C05 §§47–55. Trusted composition
 * must bind contentId to the complete canonical passage, not a numeric label.
 */
export type InstructionalDeliveryObligation =
  | "C01_MAY_ALLOWANCE_CONSEQUENCE"
  | "C05_YEAR_MONTHS_EXPLANATION"
  | "C05_MONTH_SEMIMONTHLY_EXPLANATION";
export type InstructionalDeliveryRequest = Readonly<{
  obligation: InstructionalDeliveryObligation;
  contentId: string;
}>;
export type EligibleInstructionalDelivery = Readonly<{
  activityId: ActivityId;
  scenarioId: string;
  position: Position;
  contentId: string;
  purpose: InstructionalDeliveryObligation;
  modelId: string;
  modelRevision: number;
  responseRevision: number;
  checkedRevision: number | null;
  feedbackRevision: number | null;
}>;
export type FrameContent = Readonly<{
  references: readonly Exposure[];
  modelFacts: readonly Exposure[];
  derivedFacts: readonly Exposure[];
  responseContract: SafeText;
  /** Trusted composition authenticates Study membership before injection.
   * This input carries public controls only, never an evaluator answer key. */
  responseControls?: readonly ChoiceExposure[];
  modelSelectionOptions?: readonly SafeText[];
  instructionalDelivery?: InstructionalDeliveryRequest;
  familyProjection?: FamilyProjectionAuthority;
  feedback?: Readonly<{
    outcome: "CONFIRMED" | "RECONSIDERATION";
    revision: number;
    content: SafeText;
  }>;
  review?: ReviewAuthorization;
  sourceReview?: SourceReviewAuthorization;
}>;
/** Authentication of source material, manifest membership, reveal and provider
 * provenance belongs to future trusted composition (T027+), NOT this interface.
 * A synthetic injected authorization demonstrates enforcement, not authenticity. */
export type FrameInput = Readonly<{
  context: ActivityContext;
  phase: Position;
  support: SupportPhase;
  definition: ActivityDefinition;
  ports: ActivityPorts;
  content: FrameContent;
}>;
export type LearnerIntent = ActivityEvent["type"];
export type SemanticActivityFrame = Readonly<{
  activityId: ActivityId;
  stateId: string;
  contentReferences: readonly SafeText[];
  exposedModelFacts: readonly SafeText[];
  exposedDerivedFacts: readonly SafeText[];
  allowedLearnerIntents: readonly LearnerIntent[];
  responseContract: SafeText;
  responseStage?: ResponseStageProjection;
  responseControls?: readonly PublicResponseControl[];
  modelSelectionControl?: Readonly<{
    modelId: string;
    revision: number;
    position: Position;
    selectedId: string;
    options: readonly SafeText[];
  }>;
  eligibleInstructionalDelivery?: EligibleInstructionalDelivery;
  familyModel?: SafeFamilyModel;
  feedbackState?: Readonly<{
    outcome: "CONFIRMED" | "RECONSIDERATION";
    content: SafeText;
  }>;
  reviewAvailability: boolean;
  sourceReviewAvailability: boolean;
  completionActionAvailability: boolean;
  review?: ReviewProjection;
  sourceReview?: SourceReviewProjection;
}>;

const phaseValid = (value: unknown): value is Position =>
  value === "ENTRY" ||
  value === "ACTIVE" ||
  value === "REVISION" ||
  value === "CONFIRMATION" ||
  value === "POST_CONFIRMATION_EXPLANATION" ||
  value === "RECONSIDERATION" ||
  value === "INFO_NEEDED" ||
  value === "COMPLETE" ||
  (typeof value === "string" &&
    /^EXP-[0-9]{2,}$/.test(value) &&
    value !== "EXP-00");
const safeText = (value: SafeText | undefined): SafeText | null =>
  value &&
  typeof value.id === "string" &&
  value.id.trim() === value.id &&
  value.id.length > 0 &&
  typeof value.text === "string" &&
  value.text.trim() === value.text &&
  value.text.length > 0
    ? Object.freeze({ id: value.id, text: value.text })
    : null;
const authorized = (callback: () => boolean): boolean => {
  try {
    return callback() === true;
  } catch {
    return false;
  }
};

const deliverySources = {
  C01_MAY_ALLOWANCE_CONSEQUENCE: {
    activityId: "C01-A02",
    scenarioId: "C01-S02",
    position: "EXP-03",
    requirement: "C01_MAY_BOTH",
    passage:
      "Both established May earnings now participate. The allowance itself did not change from ₱1,750.00. The composition changed because another applicable earning joined the total.",
  },
  C05_YEAR_MONTHS_EXPLANATION: {
    activityId: "C05-A02",
    scenarioId: "C05-S02",
    position: "EXP-02",
    requirement: "C05_YEAR_MONTHS",
    passage:
      "The approved year contains 12 months. To express the annual salary as a monthly salary, partition the annual amount across those 12 month periods.\n\n₱480,000 ÷ 12\n=\n₱40,000/month\n\nThe target is now a monthly representation. The annual salary has not disappeared; we have expressed the same approved compensation relationship using a different time basis.",
  },
  C05_MONTH_SEMIMONTHLY_EXPLANATION: {
    activityId: "C05-A02",
    scenarioId: "C05-S02",
    position: "EXP-04",
    requirement: "C05_MONTH_SEMIMONTHLY",
    passage:
      "The established monthly salary is ₱40,000.00. This approved monthly structure contains two semi-monthly pay periods. Partitioning the monthly amount across those two periods gives:\n\n₱40,000 ÷ 2\n=\n₱20,000 per semi-monthly pay period\n\nThe semi-monthly amount is another representation of the approved compensation structure.",
  },
} as const;

// A descriptor is an issued capability, not a JSON acknowledgment. Bind to the
// exact supplying actor context and composition, conservatively invalidating on
// ANY actor context replacement (including support/re-entry). No mutable delivery
// flag, acknowledgment ledger or progression prerequisite is created here.
const deliveryIssuers = new WeakMap<
  EligibleInstructionalDelivery,
  Readonly<{
    context: ActivityContext;
    definition: ActivityDefinition;
    ports: ActivityPorts;
    text: string;
  }>
>();

function deliveryCandidate(
  input: FrameInput,
  references: readonly SafeText[],
  familyModel: SafeFamilyModel | undefined,
): EligibleInstructionalDelivery | undefined {
  const request = input.content.instructionalDelivery;
  if (!request) return undefined;
  if (
    typeof request !== "object" ||
    Object.getPrototypeOf(request) !== Object.prototype ||
    Reflect.ownKeys(request).length !== 2 ||
    !["obligation", "contentId"].every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(request, key);
      return descriptor !== undefined && "value" in descriptor;
    }) ||
    typeof request.contentId !== "string" ||
    !request.contentId ||
    request.contentId.trim() !== request.contentId ||
    !Object.prototype.hasOwnProperty.call(deliverySources, request.obligation)
  )
    throw new TypeError("Invalid instructional delivery request");
  const source = deliverySources[request.obligation];
  const c = input.context;
  const model = c.intentModel;
  const policy = input.definition.modelIntents;
  if (
    input.support !== "NONE" ||
    c.position !== input.phase ||
    c.activityId !== source.activityId ||
    input.definition.activityId !== source.activityId ||
    input.phase !== source.position ||
    !model ||
    !policy ||
    model.scenarioId !== source.scenarioId ||
    policy.scenarioId !== source.scenarioId ||
    model.modelId !== policy.modelId ||
    model.family !== policy.family ||
    !Number.isSafeInteger(model.revision) ||
    model.revision < 0 ||
    !input.definition.instructionalContinuation?.stages.some(
      (stage) =>
        stage.position === source.position &&
        stage.requirement === source.requirement,
    ) ||
    !instructionalContinueEligible(c, input.definition, input.support) ||
    references.filter((item) => item.id === request.contentId).length !== 1 ||
    !references.some(
      (item) => item.id === request.contentId && item.text === source.passage,
    ) ||
    !deliveryConsequencePresent(request.obligation, familyModel, source.passage)
  )
    return undefined;
  return Object.freeze({
    activityId: c.activityId,
    scenarioId: source.scenarioId,
    position: input.phase,
    contentId: request.contentId,
    purpose: request.obligation,
    modelId: model.modelId,
    modelRevision: model.revision,
    responseRevision: c.responseRevision,
    checkedRevision: c.checkedRevision,
    feedbackRevision: c.feedbackRevision,
  });
}

/** Headless semantic availability only: not presentation or acknowledgment.
 * The consequence must be present in the same published graph as the exact
 * explanation, with its causal links included in focus and nonvisual order.
 */
function deliveryConsequencePresent(
  purpose: InstructionalDeliveryObligation,
  model: SafeFamilyModel | undefined,
  passage: string,
): boolean {
  if (!model?.focus || model.focus.explanation.text !== passage) return false;
  const expected =
    purpose === "C01_MAY_ALLOWANCE_CONSEQUENCE"
      ? [
          ["EARNING_RECORD", "17250", "PHP"],
          ["EARNING_RECORD", "1750", "PHP"],
          ["GROSS_SUMMARY", "19000", "PHP"],
        ]
      : purpose === "C05_YEAR_MONTHS_EXPLANATION"
        ? [
            ["YEAR", "480000", "PHP/year"],
            ["MONTH", "40000", "PHP/month"],
          ]
        : [
            ["MONTH", "40000", "PHP/month"],
            ["SEMIMONTHLY", "20000", "PHP/semi-monthly period"],
          ];
  const elements = expected.map(([role, amount, unit]) =>
    model.elements.find(
      (element) =>
        element.role === role &&
        element.quantity?.status === "KNOWN" &&
        element.quantity.amount === amount &&
        element.quantity.unit === unit,
    ),
  );
  if (elements.some((element) => !element)) return false;
  if (
    purpose === "C01_MAY_ALLOWANCE_CONSEQUENCE" &&
    elements.slice(0, 2).some((element) => element!.state !== "PARTICIPATING")
  )
    return false;
  if (
    purpose === "C05_MONTH_SEMIMONTHLY_EXPLANATION" &&
    elements[0]!.state !== "ESTABLISHED_GIVEN"
  )
    return false;
  const kind =
    purpose === "C01_MAY_ALLOWANCE_CONSEQUENCE"
      ? "MEMBER_OF"
      : purpose === "C05_YEAR_MONTHS_EXPLANATION"
        ? "YEAR_TWELVE_MONTHS"
        : "MONTH_TWO_SEMIMONTHLY";
  const consequence = elements[elements.length - 1]!;
  const links = elements
    .slice(0, -1)
    .map((element) =>
      model.relationships.find(
        (relation) =>
          relation.kind === kind &&
          relation.from.includes(element!.id) &&
          relation.to === consequence.id,
      ),
    );
  return (
    links.every((link) => !!link) &&
    [
      ...elements.map((element) => element!.id),
      ...links.map((link) => link.id),
    ].every(
      (id) =>
        model.focus!.targets.includes(id) && model.readingOrder.includes(id),
    )
  );
}

/** Current eligibility, NOT delivery acknowledgment. Copies, forged objects,
 * other actors and stale contexts fail closed. Eligibility requires the complete
 * source passage (C01 §28; C05 §§49/55), not a caller-selected label or substring.
 * Calling this repeatedly cannot unlock Continue/Finish or acknowledge prose.
 */
export function isCurrentInstructionalDelivery(
  descriptor: unknown,
  input: FrameInput,
): descriptor is EligibleInstructionalDelivery {
  if (descriptor === null || typeof descriptor !== "object") return false;
  const issued = deliveryIssuers.get(
    descriptor as EligibleInstructionalDelivery,
  );
  if (
    !issued ||
    issued.context !== input.context ||
    issued.definition !== input.definition ||
    issued.ports !== input.ports
  )
    return false;
  try {
    const frame = projectSemanticActivityFrame(input);
    const references = frame.contentReferences;
    const candidate = deliveryCandidate(input, references, frame.familyModel);
    return (
      candidate !== undefined &&
      references.some(
        (item) => item.id === candidate.contentId && item.text === issued.text,
      ) &&
      (Object.keys(candidate) as (keyof EligibleInstructionalDelivery)[]).every(
        (key) =>
          candidate[key] === (descriptor as EligibleInstructionalDelivery)[key],
      )
    );
  } catch {
    return false;
  }
}

function projectFacts(
  items: readonly Exposure[],
  phase: Position,
  context: ActivityContext,
  currentCheck: boolean,
  currentFeedback: boolean,
): readonly SafeText[] {
  // This phase is reachable only after delivery for the current confirmed check.
  if (phase === "POST_CONFIRMATION_EXPLANATION" && !currentFeedback)
    return Object.freeze([]);
  if (!Array.isArray(items)) return Object.freeze([]);
  const entries: readonly Exposure[] = items;
  const output: SafeText[] = [];
  for (const item of entries) {
    if (!item || !Array.isArray(item.phases) || !item.phases.includes(phase))
      continue;
    const permitted =
      item.timing === "PUBLIC" ||
      (item.timing === "CURRENT_CHECK" && currentCheck) ||
      (item.timing === "CURRENT_FEEDBACK" && currentFeedback) ||
      (item.timing === "EXPLICIT_REVEAL" &&
        currentCheck &&
        item.revealRevision === context.responseRevision);
    if (!permitted) continue;
    const safe = safeText(item.content);
    if (safe) output.push(safe);
  }
  return Object.freeze(output);
}

/** Pure, allowlist-only semantic projection. Never pass a snapshot, evaluator
 * diagnostic, raw response, model or provider result to a renderer. */
export function projectSemanticActivityFrame(
  input: FrameInput,
): SemanticActivityFrame {
  const { context: c, phase, support, definition, ports, content } = input;
  const staging = definition.responseStages;
  const teaching = definition.terminalTeaching;
  if (
    !isActivityId(c.activityId) ||
    c.activityId !== definition.activityId ||
    !phaseValid(phase) ||
    (phase === "POST_CONFIRMATION_EXPLANATION" &&
      definition.edges.CONFIRMATION?.CONTINUE !==
        "POST_CONFIRMATION_EXPLANATION") ||
    c.position !== phase ||
    !["NONE", "REVIEW", "SOURCE_REVIEW", "REINFORCEMENT"].includes(support) ||
    (support === "NONE" ? c.origin !== null : c.origin !== phase) ||
    !Number.isSafeInteger(c.responseRevision) ||
    c.responseRevision < 0 ||
    !content ||
    !safeText(content.responseContract)
  )
    throw new TypeError("Invalid semantic projection input");
  if (
    staging &&
    c.responseStage !== "PRIMARY" &&
    c.responseStage !== "REASONING"
  )
    throw new TypeError("Missing response stage");
  if (
    staging &&
    c.responseStage === "REASONING" &&
    !currentPrimaryCommitmentValid(c, staging)
  )
    throw new TypeError("Invalid primary commitment exposure");
  if (
    teaching &&
    phase === "POST_CONFIRMATION_EXPLANATION" &&
    (c.terminalEntryRevision !== c.responseRevision ||
      c.checkedRevision !== c.responseRevision ||
      c.feedbackRevision !== c.responseRevision ||
      !c.evaluation)
  )
    throw new TypeError("Invalid terminal teaching entry");
  const currentCheck =
    c.response !== null &&
    c.hasChecked &&
    c.checkedRevision === c.responseRevision &&
    c.evaluation !== null &&
    ((phase === "CONFIRMATION" && c.evaluation.outcome === "CONFIRMED") ||
      (phase === "POST_CONFIRMATION_EXPLANATION" &&
        definition.edges.CONFIRMATION?.CONTINUE ===
          "POST_CONFIRMATION_EXPLANATION" &&
        (c.evaluation.outcome === "CONFIRMED" ||
          teaching?.outcomes === "BOTH") &&
        c.feedbackRevision === c.responseRevision) ||
      (phase === "RECONSIDERATION" &&
        c.evaluation.outcome === "RECONSIDERATION") ||
      phase === "COMPLETE");
  const currentFeedback =
    currentCheck && c.feedbackRevision === c.responseRevision;
  const modes = definition.support[phase] ?? [];
  const idle = support === "NONE";
  const reviewAvailable =
    idle &&
    modes.includes("REVIEW") &&
    projectReview(c.activityId, phase, phase, "REVIEW", content.review) !==
      null;
  const sourceAvailable =
    idle &&
    phase !== "INFO_NEEDED" &&
    modes.includes("SOURCE_REVIEW") &&
    authorized(() => ports.sourceReviewAvailable(c.activityId, phase)) &&
    projectSourceReview(
      c.activityId,
      phase,
      phase,
      "SOURCE_REVIEW",
      content.sourceReview,
    ) !== null;
  const review = projectReview(
    c.activityId,
    phase,
    c.origin,
    support,
    content.review,
  );
  const sourceReview =
    phase !== "INFO_NEEDED" &&
    modes.includes("SOURCE_REVIEW") &&
    authorized(() => ports.sourceReviewAvailable(c.activityId, phase))
      ? projectSourceReview(
          c.activityId,
          phase,
          c.origin,
          support,
          content.sourceReview,
        )
      : null;
  const finish =
    idle &&
    currentFeedback &&
    (!teaching ||
      (phase === "POST_CONFIRMATION_EXPLANATION" &&
        c.terminalEntryRevision === c.responseRevision &&
        c.terminalTeachingRevision === c.responseRevision)) &&
    ((phase === "CONFIRMATION" &&
      definition.edges.CONFIRMATION?.CONTINUE !==
        "POST_CONFIRMATION_EXPLANATION") ||
      phase === "POST_CONFIRMATION_EXPLANATION" ||
      phase === "RECONSIDERATION") &&
    authorized(() =>
      ports.completionEligible({
        activityId: c.activityId,
        responseRevision: c.responseRevision,
        checkedRevision: c.checkedRevision,
        feedbackRevision: c.feedbackRevision,
        evaluation: c.evaluation,
      } satisfies CompletionEvidence),
    );
  const intents: LearnerIntent[] = [];
  const allowedModels = idle
    ? availableModelSelections(c, definition.modelSelection)
    : [];
  let modelSelectionControl: SemanticActivityFrame["modelSelectionControl"];
  if (
    definition.modelSelection &&
    c.model &&
    allowedModels.length &&
    content.modelSelectionOptions
  ) {
    const supplied = content.modelSelectionOptions;
    if (
      !((value: unknown): boolean => Array.isArray(value))(supplied) ||
      supplied.length !== definition.modelSelection.selectionIds.length ||
      new Set(supplied.map((item) => item.id)).size !== supplied.length ||
      supplied.some(
        (item) =>
          Reflect.ownKeys(item).length !== 2 ||
          !safeText(item) ||
          !definition.modelSelection!.selectionIds.includes(item.id),
      )
    )
      throw new TypeError("Invalid model selection labels");
    modelSelectionControl = Object.freeze({
      modelId: c.model.modelId,
      revision: c.model.revision,
      position: phase,
      selectedId: c.model.value.selectionId,
      options: Object.freeze(
        allowedModels.map((id) =>
          safeText(supplied.find((item) => item.id === id))!,
        ),
      ),
    });
    intents.push("SELECT_MODEL_CHILD");
  }
  if (idle) {
    const edge = definition.edges[phase];
    if (
      (phase === "CONFIRMATION" ||
        (phase === "RECONSIDERATION" && teaching?.outcomes === "BOTH")) &&
      edge?.CONTINUE === "POST_CONFIRMATION_EXPLANATION" &&
      currentFeedback &&
      (phase === "CONFIRMATION"
        ? c.evaluation?.outcome === "CONFIRMED"
        : c.evaluation?.outcome === "RECONSIDERATION")
    )
      intents.push("CONTINUE");
    if (
      phase === c.position &&
      instructionalContinueEligible(c, definition, support)
    )
      intents.push("CONTINUE");
    if (
      phase.startsWith("EXP-") &&
      edge?.PREVIOUS?.startsWith("EXP-") &&
      definition.edges[edge.PREVIOUS]
    )
      intents.push("PREVIOUS");
    if (
      phase === "INFO_NEEDED" &&
      c.infoOrigin &&
      edge?.PREVIOUS === c.infoOrigin &&
      authorized(() => ports.informationReturn(c.activityId, c.infoOrigin!))
    )
      intents.push("PREVIOUS");
    if (
      (phase === "ENTRY" || phase.startsWith("EXP-") || phase === "ACTIVE") &&
      edge?.INFO_NEEDED === "INFO_NEEDED" &&
      c.checkedRevision === null &&
      authorized(() => ports.informationNeeded(c.activityId, phase))
    )
      intents.push("INFO_NEEDED");
    if (
      (phase === "ACTIVE" || phase === "REVISION") &&
      c.responseRevision < Number.MAX_SAFE_INTEGER
    )
      intents.push("RESPONSE_CHANGED");
    if (
      (phase === "ACTIVE" || phase === "REVISION") &&
      c.response !== null &&
      isLearnerResponse(c.response) &&
      (!staging || stagedResponseReady(c, staging)) &&
      c.checkedRevision !== c.responseRevision &&
      authorized(() => ports.ready(c.response!))
    ) {
      if (phase === "ACTIVE" && !c.hasChecked) intents.push("CHECK_RESPONSE");
      if (c.hasChecked) intents.push("CHECK_AGAIN");
    }
    if (staging && (phase === "ACTIVE" || phase === "REVISION")) {
      if (
        c.responseStage === "PRIMARY" &&
        primaryResponseReady(c.response, staging) &&
        Number.isSafeInteger(c.commitmentSequence) &&
        c.commitmentSequence! < Number.MAX_SAFE_INTEGER
      )
        intents.push("COMMIT_PRIMARY_RESPONSE");
      if (
        c.responseStage === "REASONING" &&
        currentPrimaryCommitmentValid(c, staging) &&
        c.responseRevision < Number.MAX_SAFE_INTEGER
      )
        intents.push("RETURN_TO_PRIMARY");
    }
    if (
      (phase === "CONFIRMATION" || phase === "RECONSIDERATION") &&
      c.response !== null &&
      (!staging || c.responseRevision < Number.MAX_SAFE_INTEGER)
    )
      intents.push("REVISE");
    if (finish) intents.push("FINISH_ACTIVITY");
    if (
      reviewAvailable ||
      sourceAvailable ||
      (modes.includes("REINFORCEMENT") && phase.startsWith("EXP-"))
    )
      intents.push("OPEN_SUPPORT");
  } else intents.push("CLOSE_SUPPORT");
  const feedback =
    currentFeedback &&
    content.feedback?.revision === c.responseRevision &&
    content.feedback.outcome === c.evaluation?.outcome
      ? safeText(content.feedback.content)
      : null;
  const editable = idle && (phase === "ACTIVE" || phase === "REVISION");
  const controls: PublicResponseControl[] = [];
  // Boolean structural check deliberately avoids Array.isArray's any[] type
  // predicate erasing the declared readonly element types at this boundary.
  const array = (value: unknown): boolean => Array.isArray(value);
  const exact = (value: unknown, keys: readonly string[]): boolean =>
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).length === keys.length &&
    keys.every(
      (key) => Object.getOwnPropertyDescriptor(value, key)?.value !== undefined,
    );
  if (content.responseControls) {
    if (!array(content.responseControls))
      throw new TypeError("Invalid control exposures");
    const stages = new Set<string>();
    for (const exposure of content.responseControls) {
      if (
        !exact(exposure, [
          "activityId",
          "contractId",
          "version",
          "stage",
          "controls",
        ]) ||
        exposure.activityId !== c.activityId ||
        exposure.contractId !==
          (staging?.contractId ?? content.responseContract.id) ||
        !Number.isSafeInteger(exposure.version) ||
        exposure.version < 1 ||
        (staging && exposure.version !== staging.version) ||
        !["RESPONSE", "PRIMARY", "REASONING"].includes(exposure.stage) ||
        (staging
          ? exposure.stage === "RESPONSE"
          : exposure.stage !== "RESPONSE") ||
        stages.has(exposure.stage) ||
        !array(exposure.controls)
      )
        throw new TypeError("Unauthorized control exposure");
      stages.add(exposure.stage);
      const seen = new Set<string>();
      for (const control of exposure.controls) {
        if (
          !exact(control, [
            "role",
            "acceptedKinds",
            ...(control.options ? ["options"] : []),
          ]) ||
          typeof control.role !== "string" ||
          !control.role ||
          control.role.trim() !== control.role ||
          seen.has(control.role) ||
          !array(control.acceptedKinds) ||
          !control.acceptedKinds.length ||
          new Set(control.acceptedKinds).size !==
            control.acceptedKinds.length ||
          !control.acceptedKinds.every((kind: string) =>
            [
              "EXACT_QUANTITY",
              "SEMANTIC_BOUNDARY",
              "SINGLE_SELECTION",
            ].includes(kind),
          )
        )
          throw new TypeError("Invalid public control");
        seen.add(control.role);
        if (staging) {
          const field = staging.primaryFields.find(
            (item) => item.key === control.role,
          );
          if (
            exposure.stage === "PRIMARY"
              ? !field ||
                control.options !== undefined ||
                JSON.stringify(control.acceptedKinds) !==
                  JSON.stringify(field.acceptedKinds)
              : control.role !== staging.reasoningField ||
                JSON.stringify(control.acceptedKinds) !==
                  JSON.stringify(["SINGLE_SELECTION"])
          )
            throw new TypeError("Wrong-stage control");
        }
        let options: readonly SafeText[] | undefined;
        if (control.options) {
          if (
            !array(control.options) ||
            control.options.length < 2 ||
            new Set(control.options.map((item: SafeText) => item.id)).size !==
              control.options.length ||
            control.options.some(
              (item: SafeText) =>
                !exact(item, ["id", "text"]) || !safeText(item),
            )
          )
            throw new TypeError("Invalid selectable options");
          if (
            staging &&
            JSON.stringify(control.options.map((item: SafeText) => item.id)) !==
              JSON.stringify(staging.optionIds)
          )
            throw new TypeError("Wrong option authority");
          options = Object.freeze(
            control.options.map((item: SafeText) => safeText(item)!),
          );
        } else if (control.acceptedKinds.includes("SINGLE_SELECTION"))
          throw new TypeError("Missing selectable options");
        if (editable && exposure.stage === (c.responseStage ?? "RESPONSE"))
          controls.push(
            Object.freeze({
              role: control.role,
              acceptedKinds: Object.freeze([...control.acceptedKinds]),
              ...(options ? { options } : {}),
            }),
          );
      }
      if (
        staging &&
        (exposure.stage === "PRIMARY"
          ? seen.size !== staging.primaryFields.length
          : seen.size !== 1)
      )
        throw new TypeError("Incomplete stage controls");
    }
  }
  // The declared terminal reference cannot be smuggled through a PUBLIC exposure
  // in an earlier phase. Projection is not a delivery acknowledgment.
  const exposures = (items: readonly Exposure[]): readonly Exposure[] =>
    teaching
      ? items.filter(
          (item) =>
            item.content.id !== teaching.contentId ||
            (phase === "POST_CONFIRMATION_EXPLANATION" &&
              currentFeedback &&
              item.timing === "CURRENT_FEEDBACK"),
        )
      : items;
  const contentReferences = projectFacts(
    exposures(content.references),
    phase,
    c,
    currentCheck,
    currentFeedback,
  );
  const familyModel = projectFamilyModel(input, currentCheck, currentFeedback);
  const eligibleInstructionalDelivery = deliveryCandidate(
    input,
    contentReferences,
    familyModel,
  );
  if (
    familyModel?.controls.some(
      (control) => control.event.type === "MODEL_INTENT",
    )
  )
    intents.push("MODEL_INTENT");
  if (eligibleInstructionalDelivery)
    deliveryIssuers.set(eligibleInstructionalDelivery, {
      context: c,
      definition,
      ports,
      text: contentReferences.find(
        (item) => item.id === eligibleInstructionalDelivery.contentId,
      )!.text,
    });
  return Object.freeze({
    activityId: c.activityId,
    stateId: support === "NONE" ? phase : `${support}[${phase}]`,
    contentReferences,
    ...(eligibleInstructionalDelivery ? { eligibleInstructionalDelivery } : {}),
    ...(familyModel ? { familyModel } : {}),
    exposedModelFacts: projectFacts(
      exposures(content.modelFacts),
      phase,
      c,
      currentCheck,
      currentFeedback,
    ),
    exposedDerivedFacts: projectFacts(
      exposures(content.derivedFacts),
      phase,
      c,
      currentCheck,
      currentFeedback,
    ),
    allowedLearnerIntents: Object.freeze(intents),
    ...(modelSelectionControl ? { modelSelectionControl } : {}),
    responseContract: safeText(content.responseContract)!,
    ...(staging ? { responseStage: c.responseStage! } : {}),
    ...(content.responseControls
      ? { responseControls: Object.freeze(controls) }
      : {}),
    ...(feedback
      ? {
          feedbackState: Object.freeze({
            outcome: c.evaluation!.outcome,
            content: feedback,
          }),
        }
      : {}),
    reviewAvailability: Boolean(reviewAvailable),
    sourceReviewAvailability: Boolean(sourceAvailable),
    completionActionAvailability: finish,
    ...(review ? { review } : {}),
    ...(sourceReview ? { sourceReview } : {}),
  });
}
