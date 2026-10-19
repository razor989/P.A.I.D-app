import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { createActivityMachine } from "../activity-machine/public";
import type {
  ActivityContext,
  ActivityDefinition,
  ActivityPorts,
  ModelIntent,
  ActivityEvent,
} from "../activity-machine/public";
import {
  isCurrentInstructionalDelivery,
  createFamilyProjectionAuthority,
  projectSemanticActivityFrame,
} from "./public";
import type {
  Exposure,
  FamilyPresentation,
  GraphicalFamily,
  FrameContent,
  FrameInput,
  PublishedQuantity,
} from "./public";
import { ExactDecimal, quantity } from "../../core/public";
import type { LearnerResponse } from "../../core/public";
import { ActivityRegistry } from "../registry/public";
import { createActivityActor } from "../activity-runtime/public";
import type { ExecutableActivityBinding } from "../registry/public";
import {
  composeC04ActivityFrame,
  createC04ActivityActor,
} from "../c04-activity-binding/public";

function freezeFixture<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeFixture(child);
    Object.freeze(value);
  }
  return value;
}

const topology = (
  family: GraphicalFamily,
  exposure: Exposure,
  straight = false,
): FamilyPresentation<GraphicalFamily>["relationships"] => {
  const specs: Record<
    GraphicalFamily,
    readonly (readonly [string, readonly string[], string])[]
  > = {
    C01: [["MEMBER_OF", ["EARNING_RECORD"], "GROSS_SUMMARY"]],
    C02: [
      ...["SSS", "PHILHEALTH", "PAG_IBIG", "BIR"].flatMap((role) => [
        ["ROW_BASIS", [role], `${role}-basis`] as const,
        ["BASIS_RULE", [`${role}-basis`], `${role}-rule`] as const,
        ["RULE_CONSEQUENCE", [`${role}-rule`], `${role}-consequence`] as const,
      ]),
      [
        "DEDUCTION_SUBTOTAL",
        [
          "SSS-consequence",
          "PHILHEALTH-consequence",
          "PAG_IBIG-consequence",
          "BIR-consequence",
        ],
        "TOTAL_DEDUCTIONS",
      ],
      ["GROSS_MINUS_SUBTOTAL", ["GROSS", "TOTAL_DEDUCTIONS"], "NET"],
    ],
    C03: [
      ["CONDITION_MULTIPLIER", ["WORK_CONDITION"], "MULTIPLIER"],
      ["MULTIPLIER_OVERTIME", ["MULTIPLIER"], "OVERTIME"],
    ],
    C04: [
      ["ORIGINAL_NEW_DIFFERENCE", ["ORIGINAL", "NEW"], "DIFFERENCE"],
      [
        "ORIGINAL_RELATIVE_PERCENTAGE",
        ["ORIGINAL", "DIFFERENCE"],
        "PERCENTAGE",
      ],
    ],
    C05: [
      ["YEAR_TWELVE_MONTHS", ["YEAR"], "MONTH"],
      ["MONTH_TWO_SEMIMONTHLY", ["MONTH"], "SEMIMONTHLY"],
    ],
    C06: [
      ["SALES_RATE_COMMISSION", ["SALES", "RATE"], "COMMISSION"],
      ...(!straight
        ? [["BASE_COMMISSION_TOTAL", ["BASE", "COMMISSION"], "TOTAL"] as const]
        : []),
    ],
  };
  return specs[family].map(([kind, from, to], index) => ({
    id: `${family}-relation-${index}`,
    kind: kind as FamilyPresentation<GraphicalFamily>["relationships"][number]["kind"],
    from: from.map((role) => `${family}-${role}`),
    to: `${family}-${to}`,
    exposure,
  }));
};

// Shape-only transport fixtures below are deliberately not source-conformance
// assertions. The separately audited final-stage matrix owns that proof.
function deductionChainElements(exposure: Exposure) {
  return ["SSS", "PHILHEALTH", "PAG_IBIG", "BIR"].flatMap((row) =>
    (
      [
        ["basis", "CONTROLLING_BASIS"],
        ["rule", "DEDUCTION_RULE"],
        ["consequence", "DEDUCTION_CONSEQUENCE"],
      ] as const
    ).map(([suffix, role]) => ({
      id: `C02-${row}-${suffix}`,
      role,
      state: "FIXED" as const,
      exposure,
    })),
  );
}

describe("D3 six-family public-path compatibility (synthetic source-cited producers)", () => {
  // Final Amendment B P9B-MDL-C01..C06-01; C3 storyboard blobs:
  // 8b141c2d / a63b485a / 619ca232 / e9e01573 / 6c4b45d1 / 1867a428.
  // These test-only quantities are source-authored constants, not Engine math.
  // This matrix proves the publication seam, NOT complete family bindings.
  const fixtures = [
    {
      family: "C01",
      roles: ["EARNING_RECORD", "GROSS_SUMMARY"],
      values: ["17250", "17250"],
      relation: "MEMBER_OF",
      label: "Exploratory partial May composition, not final gross",
    },
    {
      family: "C02",
      roles: [
        "GROSS",
        "SSS",
        "PHILHEALTH",
        "PAG_IBIG",
        "BIR",
        "TOTAL_DEDUCTIONS",
        "NET",
      ],
      values: ["12937.50", "650", "300", "200", "0", "1150", "11787.50"],
      relation: "GROSS_MINUS_SUBTOTAL",
      label: "Gross less distinct deductions, protected ACTIVE final response",
    },
    {
      family: "C03",
      roles: ["WORK_CONDITION", "MULTIPLIER", "OVERTIME"],
      values: ["ORDINARY_DAY", "1.25", "250"],
      relation: "MULTIPLIER_OVERTIME",
      label: "Ordinary condition determines 1.25 and overtime 250",
    },
    {
      family: "C04",
      roles: ["ORIGINAL", "NEW", "DIFFERENCE", "PERCENTAGE"],
      values: ["20000", "22000", "2000", "10"],
      relation: "ORIGINAL_RELATIVE_PERCENTAGE",
      label: "C04-S02-A: same 2000 raise relative to original 20000 gives 10%",
    },
    {
      family: "C05",
      roles: ["YEAR", "MONTH", "SEMIMONTHLY"],
      values: ["480000", "40000", "20000"],
      relation: "MONTH_TWO_SEMIMONTHLY",
      label: "Established monthly Given precedes two semi-monthly periods",
    },
    {
      family: "C06",
      roles: ["ARRANGEMENT", "SALES", "RATE", "BASE", "COMMISSION", "TOTAL"],
      values: ["STRAIGHT_COMMISSION", "80000", "5%", "N/A", "4000", "N/A"],
      relation: "SALES_RATE_COMMISSION",
      label:
        "Straight commission ends at Commission; base and total not applicable",
    },
  ] as const;
  const exposure = (
    id: string,
    text: string,
    timing: Exposure["timing"] = "PUBLIC",
  ): Exposure => ({ content: { id, text }, phases: ["ACTIVE"], timing });
  const setup = (
    fixture: (typeof fixtures)[number],
    sourceComparison = false,
    checkedTeaching = false,
  ) => {
    const family = fixture.family;
    const activityId = `${family}-${checkedTeaching ? "A01" : "A02"}` as const;
    const scenarioId = activityId.replace("-A", "-S");
    const modelId = `${family}-D3-PROJECTION-FIXTURE`;
    const phase =
      sourceComparison && family === "C03"
        ? "EXP-03"
        : sourceComparison && family === "C06"
          ? "EXP-04"
          : "ACTIVE";
    const firstSelection =
      sourceComparison && family === "C03"
        ? "ORDINARY_DAY"
        : sourceComparison && family === "C06"
          ? "SALES_300000"
          : checkedTeaching
            ? "STRAIGHT_COMMISSION"
            : "first";
    const secondSelection =
      sourceComparison && family === "C03"
        ? "REST_DAY"
        : sourceComparison && family === "C06"
          ? "SALES_500000"
          : checkedTeaching
            ? "BASE_PLUS_COMMISSION"
            : "second";
    const scopedExposure = (
      id: string,
      text: string,
      timing: Exposure["timing"] = "PUBLIC",
    ): Exposure => ({ content: { id, text }, phases: [phase], timing });
    const definition: ActivityDefinition = {
      activityId,
      edges: {
        ENTRY: { CONTINUE: phase },
        ...(phase === "ACTIVE"
          ? {}
          : { [phase]: { CONTINUE: "ACTIVE" as const } }),
      },
      support: { ACTIVE: ["REVIEW"] },
      modelSelection: {
        modelId,
        scenarioId,
        initialSelectionId: firstSelection,
        selectionIds: [firstSelection, secondSelection],
        allowedSelections: { [phase]: [firstSelection, secondSelection] },
      },
    };
    const ports: ActivityPorts = {
      ready: () => checkedTeaching,
      evaluate: () => ({
        outcome: checkedTeaching ? "CONFIRMED" : "RECONSIDERATION",
        diagnostic: null,
      }),
      completionEligible: () => false,
      sourceReviewAvailable: () => false,
      informationNeeded: () => false,
      informationReturn: () => false,
    };
    const issued = new WeakSet<object>();
    const state = (selectionId: string) => {
      const result = Object.freeze({
        selectionId,
        privateAnswer: "PRIVATE_MODEL_ANSWER",
      });
      issued.add(result);
      return { selectionId, state: result };
    };
    const registry = new ActivityRegistry([
      {
        activityId,
        definition,
        ports,
        modelAdapter: {
          initialize: () => state(firstSelection),
          select: (current, selectionId) =>
            issued.has(current.state as object) ? state(selectionId) : null,
        },
      },
    ]);
    const binding = registry.resolve(activityId);
    const actor = createActivityActor(registry, activityId).start();
    actor.send({ type: "CONTINUE" });
    const presentation = (
      context: ActivityContext,
    ): FamilyPresentation<GraphicalFamily> => {
      const second = context.model!.value.selectionId === secondSelection;
      const values = checkedTeaching
        ? second
          ? ["BASE_PLUS_COMMISSION", "80000", "5%", "10000", "4000", "14000"]
          : ["STRAIGHT_COMMISSION", "80000", "5%", "N/A", "4000", "N/A"]
        : !sourceComparison
          ? fixture.values
          : family === "C03"
            ? second
              ? ["REST_DAY", "1.69", "338"]
              : ["ORDINARY_DAY", "1.25", "250"]
            : family === "C04"
              ? second
                ? ["10000", "12000", "2000", "20"]
                : ["20000", "22000", "2000", "10"]
              : family === "C06"
                ? second
                  ? [
                      "BASE_PLUS_COMMISSION",
                      "500000",
                      "3%",
                      "15000",
                      "15000",
                      "30000",
                    ]
                  : [
                      "BASE_PLUS_COMMISSION",
                      "300000",
                      "3%",
                      "15000",
                      "9000",
                      "24000",
                    ]
                : fixture.values;
      const elements: FamilyPresentation<GraphicalFamily>["elements"][number][] =
        fixture.roles.map((role, index) => ({
          id: `${family}-${role}`,
          role,
          state:
            family === "C01" && role === "EARNING_RECORD"
              ? ("PARTICIPATING" as const)
              : ("FIXED" as const),
          exposure: scopedExposure(
            `${family}-copy-${role}`,
            `${role}: ${values[index]}`,
            (family === "C02" && ["NET", "TOTAL_DEDUCTIONS"].includes(role)) ||
              (checkedTeaching && ["COMMISSION", "TOTAL"].includes(role))
              ? "CURRENT_CHECK"
              : "PUBLIC",
          ),
          quantity:
            values[index] === "N/A"
              ? {
                  status: "NOT_APPLICABLE" as const,
                  unit: "PHP",
                  provenance: "FINAL_FIXED_BANK",
                }
              : {
                  status: "KNOWN" as const,
                  amount: values[index]!,
                  unit:
                    sourceComparison && family === "C03"
                      ? role === "WORK_CONDITION"
                        ? "CONDITION"
                        : role === "MULTIPLIER"
                          ? "MULTIPLIER"
                          : "PHP"
                      : sourceComparison && family === "C06"
                        ? role === "ARRANGEMENT"
                          ? "ARRANGEMENT"
                          : role === "RATE"
                            ? "PERCENT"
                            : "PHP"
                        : "SOURCE_UNIT",
                  provenance: "FINAL_FIXED_BANK",
                },
        }));
      const relationships = topology(
        family,
        scopedExposure(`${family}-relation-copy`, fixture.label),
        family === "C06" && values[0] === "STRAIGHT_COMMISSION",
      );
      if (family === "C02")
        elements.push(
          ...deductionChainElements(
            exposure("C02-chain-copy", "Transport-only deduction chain"),
          ),
        );
      return {
        family,
        activityId,
        scenarioId,
        position: phase,
        modelId,
        revision: context.model!.revision,
        sourceId: `P9B-MDL-${family}-01`,
        elements,
        relationships,
        focus: {
          targets:
            sourceComparison && family === "C03"
              ? ["C03-WORK_CONDITION", "C03-MULTIPLIER", "C03-OVERTIME"]
              : sourceComparison && family === "C06"
                ? ["C06-SALES", "C06-COMMISSION", "C06-TOTAL"]
                : [elements[0]!.id],
          explanation: scopedExposure(
            `${family}-explanation`,
            sourceComparison
              ? family === "C03"
                ? `${second ? "REST_DAY 1.69 → 338" : "ORDINARY_DAY 1.25 → 250"}; hourly rate 100 and overtime hours 2 stay fixed.`
                : family === "C04"
                  ? `${second ? "C04-S02-B: original 10000; new 12000; 20%" : "C04-S02-A: original 20000; new 22000; 10%"}; the same 2000 raise uses each original as reference.`
                  : `Sales ${values[1]} × fixed 3%; base 15000 stays fixed; commission ${values[4]}; total ${values[5]}.`
              : fixture.label,
          ),
          reinforcement: [
            ...(sourceComparison && family === "C03"
              ? [
                  scopedExposure(
                    "C03-source-causal-reinforcement",
                    second
                      ? "Notice what changed: the hourly rate and overtime hours stayed the same. The work condition changed, so the applicable multiplier changed from 1.25 to 1.69. The overtime pay therefore changed from ₱250.00 to ₱338.00."
                      : "Regular hourly rate ₱100.00 per hour. Condition: ordinary working-day overtime. Multiplier 1.25. Overtime hours 2. Corresponding overtime pay ₱250.00.",
                  ),
                ]
              : []),
            ...(sourceComparison && family === "C06" && second
              ? [
                  scopedExposure(
                    "C06-source-nonvisual-update",
                    "Sales changed to ₱500,000.00. Commission Rate remains 3%. Base Salary remains ₱15,000.00. Commission is now ₱15,000.00. Total Compensation is now ₱30,000.00.",
                  ),
                ]
              : []),
            scopedExposure(
              `${family}-protected-reinforcement`,
              "PRIVATE_TEACHING_ANSWER",
              "CURRENT_FEEDBACK",
            ),
          ],
        },
        readingOrder: [
          ...elements.map((item) => item.id),
          ...relationships.map((item) => item.id),
        ],
        controls: [
          {
            target:
              sourceComparison && family === "C06"
                ? "C06-SALES"
                : elements[0]!.id,
            exposure: scopedExposure(
              `${family}-control`,
              "Select complete approved fixture state",
            ),
            event: {
              type: "SELECT_MODEL_CHILD",
              modelId,
              position: phase,
              revision: context.model!.revision,
              selectionId: secondSelection,
            },
          },
        ],
      };
    };
    const authority = createFamilyProjectionAuthority({
      family,
      activityId,
      scenarioId,
      modelId,
      project: (context) => {
        if (!context.model || !issued.has(context.model.value.state as object))
          throw new TypeError("Unissued fixture model");
        return presentation(context);
      },
    });
    const content: FrameContent = {
      references: [],
      modelFacts: [],
      derivedFacts: [],
      responseContract: {
        id: "fixture",
        text: "Synthetic compatibility response",
      },
      familyProjection: authority,
    };
    const input = (): FrameInput => ({
      context: actor.getSnapshot().context,
      phase,
      support: "NONE",
      definition: binding.definition,
      ports: binding.ports,
      content,
    });
    return { actor, input, authority, presentation, family, modelId };
  };
  it.each(fixtures)(
    "$family projects safe immutable typed semantics through Registry→Runtime→actor→frame",
    (fixture) => {
      const { actor, input, family } = setup(fixture);
      const before = actor.getSnapshot().context;
      const frame = projectSemanticActivityFrame(input());
      const model = frame.familyModel!;
      expect(model.family).toBe(family);
      expect(model.sourceId).toBe(`P9B-MDL-${family}-01`);
      expect(model.revision).toBe(0);
      expect(model.focus?.explanation.text).toBe(fixture.label);
      expect(model.readingOrder).toContain(model.elements[0]!.id);
      expect(JSON.stringify(model)).not.toContain("PRIVATE_");
      expect(
        model.elements.every(
          (element) =>
            Object.isFrozen(element) && Object.isFrozen(element.quantity),
        ),
      ).toBe(true);
      if (family === "C02") {
        expect(JSON.stringify(model)).not.toContain("11787.50");
        expect(JSON.stringify(model)).not.toContain("1150");
        expect(model.elements.map((element) => element.role)).not.toContain(
          "NET",
        );
      }
      const control = model.controls[0]!;
      actor.send(control.event);
      expect(actor.getSnapshot().context.model!.revision).toBe(1);
      const after = actor.getSnapshot().context;
      actor.send(control.event);
      expect(actor.getSnapshot().context).toBe(after);
      expect(after).not.toBe(before);
      expect(projectSemanticActivityFrame(input()).familyModel!.revision).toBe(
        1,
      );
      const supporting = {
        ...input(),
        support: "REVIEW" as const,
        context: { ...after, origin: "ACTIVE" as const },
      };
      expect(
        projectSemanticActivityFrame(supporting).familyModel!.controls,
      ).toEqual([]);
      expect(
        projectSemanticActivityFrame({
          ...input(),
          content: {
            references: [],
            modelFacts: [],
            derivedFacts: [],
            responseContract: input().content.responseContract,
          },
        }).familyModel,
      ).toBeUndefined();
      actor.stop();
    },
  );
  it.each([fixtures[0], fixtures[2], fixtures[3], fixtures[4], fixtures[5]])(
    "$family independently audits the identified finite source state and rejects altered fixture claims",
    (fixture) => {
      // Source root: PAID-Context-System/01 Project/
      // PASS-9-AMENDMENT-C-DETAILED-INSTRUCTIONAL-EXPERIENCE-AND-STORYBOARD-COMPLETION/.
      // These literal oracles are transcribed independently of setup's callback.
      // C02 has its larger, stage-specific oracle below, not this shape harness.
      const oracles = {
        C01: {
          path: "03-C3-C01-GROSS-INCOME.md, final A02 EXP-02, exploratory regular-pay membership",
          quantities: ["17250", "17250"],
          roles: ["EARNING_RECORD", "GROSS_SUMMARY"],
          edges: ["MEMBER_OF"],
          focus: "C01-EARNING_RECORD",
          passage: "Exploratory partial May composition, not final gross",
        },
        C03: {
          path: "05-C3-C03-OVERTIME-PAY.md, final A02 EXP-02/03, hourly rate 100 and hours 2",
          quantities: ["ORDINARY_DAY", "1.25", "250"],
          roles: ["WORK_CONDITION", "MULTIPLIER", "OVERTIME"],
          edges: ["CONDITION_MULTIPLIER", "MULTIPLIER_OVERTIME"],
          focus: "C03-WORK_CONDITION",
          passage:
            "ORDINARY_DAY 1.25 → 250; hourly rate 100 and overtime hours 2 stay fixed.",
        },
        C04: {
          path: "06-C3-C04-PERCENTAGE-CHANGE.md, final C04-A02 S02-A, signed difference relative to original",
          quantities: ["20000", "22000", "2000", "10"],
          roles: ["ORIGINAL", "NEW", "DIFFERENCE", "PERCENTAGE"],
          edges: ["ORIGINAL_NEW_DIFFERENCE", "ORIGINAL_RELATIVE_PERCENTAGE"],
          focus: "C04-ORIGINAL",
          passage:
            "C04-S02-A: original 20000; new 22000; 10%; the same 2000 raise uses each original as reference.",
        },
        C05: {
          path: "07-C3-C05-WAGE-SALARY-REPRESENTATION-CONVERSION.md, final A02 linked annual/monthly and monthly/semi-monthly states",
          quantities: ["480000", "40000", "20000"],
          roles: ["YEAR", "MONTH", "SEMIMONTHLY"],
          edges: ["YEAR_TWELVE_MONTHS", "MONTH_TWO_SEMIMONTHLY"],
          focus: "C05-YEAR",
          passage:
            "Established monthly Given precedes two semi-monthly periods",
        },
        C06: {
          path: "08-C3-C06-COMMISSION.md, final A02 Situation A; §§72–87, fixed 3% rate and 15000 base",
          quantities: [
            "BASE_PLUS_COMMISSION",
            "300000",
            "3%",
            "15000",
            "9000",
            "24000",
          ],
          roles: [
            "ARRANGEMENT",
            "SALES",
            "RATE",
            "BASE",
            "COMMISSION",
            "TOTAL",
          ],
          edges: ["SALES_RATE_COMMISSION", "BASE_COMMISSION_TOTAL"],
          focus: "C06-ARRANGEMENT",
          passage:
            "Sales 300000 × fixed 3%; base 15000 stays fixed; commission 9000; total 24000.",
        },
      } as const;
      const oracle = oracles[fixture.family];
      const phase =
        fixture.family === "C03"
          ? "EXP-03"
          : fixture.family === "C06"
            ? "EXP-04"
            : "ACTIVE";
      const exposure = (
        id: string,
        text: string,
        timing: Exposure["timing"] = "PUBLIC",
      ): Exposure => ({ content: { id, text }, phases: [phase], timing });
      expect(oracle.path).toMatch(/\.md, final/);
      const test = setup(
        fixture,
        ["C03", "C04", "C06"].includes(fixture.family),
      );
      const value = freezeFixture(test.presentation(test.input().context));
      const audit = (candidate: FamilyPresentation<GraphicalFamily>) => {
        expect(candidate.family).toBe(fixture.family);
        expect(candidate.activityId).toBe(`${fixture.family}-A02`);
        expect(candidate.scenarioId).toBe(`${fixture.family}-S02`);
        expect(candidate.position).toBe(phase);
        expect(candidate.modelId).toBe(
          `${fixture.family}-D3-PROJECTION-FIXTURE`,
        );
        expect(candidate.revision).toBe(0);
        expect(candidate.sourceId).toBe(`P9B-MDL-${fixture.family}-01`);
        expect(candidate.elements.map((element) => element.role)).toEqual(
          oracle.roles,
        );
        candidate.elements.forEach((element, index) => {
          expect(element.id).toBe(`${fixture.family}-${oracle.roles[index]}`);
          expect(element.quantity).toEqual({
            status: "KNOWN",
            amount: oracle.quantities[index],
            unit:
              fixture.family === "C03"
                ? ["CONDITION", "MULTIPLIER", "PHP"][index]
                : fixture.family === "C06"
                  ? ["ARRANGEMENT", "PHP", "PERCENT", "PHP", "PHP", "PHP"][
                      index
                    ]
                  : "SOURCE_UNIT",
            provenance: "FINAL_FIXED_BANK",
          });
          expect(element.state).toBe(
            fixture.family === "C01" && index === 0 ? "PARTICIPATING" : "FIXED",
          );
          expect(element.exposure).toEqual(
            exposure(
              `${fixture.family}-copy-${oracle.roles[index]}`,
              `${oracle.roles[index]}: ${oracle.quantities[index]}`,
            ),
          );
        });
        expect(
          candidate.relationships.map((relation) => relation.kind),
        ).toEqual(oracle.edges);
        expect(candidate.relationships).toEqual(
          topology(
            fixture.family,
            exposure(`${fixture.family}-relation-copy`, fixture.label),
          ),
        );
        expect(candidate.focus.targets).toEqual(
          fixture.family === "C03"
            ? ["C03-WORK_CONDITION", "C03-MULTIPLIER", "C03-OVERTIME"]
            : fixture.family === "C06"
              ? ["C06-SALES", "C06-COMMISSION", "C06-TOTAL"]
              : [oracle.focus],
        );
        expect(candidate.focus.explanation).toEqual(
          exposure(`${fixture.family}-explanation`, oracle.passage),
        );
        expect(candidate.focus.reinforcement).toEqual([
          ...(fixture.family === "C03"
            ? [
                exposure(
                  "C03-source-causal-reinforcement",
                  "Regular hourly rate ₱100.00 per hour. Condition: ordinary working-day overtime. Multiplier 1.25. Overtime hours 2. Corresponding overtime pay ₱250.00.",
                ),
              ]
            : []),
          exposure(
            `${fixture.family}-protected-reinforcement`,
            "PRIVATE_TEACHING_ANSWER",
            "CURRENT_FEEDBACK",
          ),
        ]);
        expect(candidate.readingOrder).toEqual([
          ...oracle.roles.map((role) => `${fixture.family}-${role}`),
          ...oracle.edges.map(
            (_, index) => `${fixture.family}-relation-${index}`,
          ),
        ]);
        expect(candidate.controls).toEqual([
          {
            target: fixture.family === "C06" ? "C06-SALES" : oracle.focus,
            exposure: exposure(
              `${fixture.family}-control`,
              "Select complete approved fixture state",
            ),
            event: {
              type: "SELECT_MODEL_CHILD",
              modelId: `${fixture.family}-D3-PROJECTION-FIXTURE`,
              position: phase,
              revision: 0,
              selectionId:
                fixture.family === "C03"
                  ? "REST_DAY"
                  : fixture.family === "C06"
                    ? "SALES_500000"
                    : "second",
            },
          },
        ]);
      };
      audit(value);
      const publicLeak = exposure(
        `${fixture.family}-laundered`,
        "An unsupported answer-bearing passage marked PUBLIC",
      );
      const malformed: FamilyPresentation<GraphicalFamily>[] = [
        { ...value, sourceId: "P9B-MDL-C02-01" },
        { ...value, scenarioId: "unsupported" },
        { ...value, position: "ENTRY" },
        { ...value, revision: 1 },
        {
          ...value,
          elements: value.elements.map((element, index) =>
            index
              ? element
              : {
                  ...element,
                  quantity: {
                    status: "KNOWN",
                    amount: "999",
                    unit: "PHP",
                    provenance: "unsupported provider",
                  },
                },
          ),
        },
        {
          ...value,
          elements: value.elements.map((element, index) =>
            index ? element : { ...element, exposure: publicLeak },
          ),
        },
        {
          ...value,
          relationships: value.relationships.map((relation) => ({
            ...relation,
            exposure: publicLeak,
          })),
        },
        {
          ...value,
          relationships: value.relationships.map((relation) => ({
            ...relation,
            from: [relation.to],
            to: relation.from[0]!,
          })),
        },
        { ...value, focus: { ...value.focus, explanation: publicLeak } },
        { ...value, focus: { ...value.focus, reinforcement: [publicLeak] } },
        { ...value, focus: { ...value.focus, targets: ["unsupported-focus"] } },
        { ...value, readingOrder: [...value.readingOrder].reverse() },
        {
          ...value,
          controls: value.controls.map((control) => ({
            ...control,
            target: "unsupported-target",
            exposure: publicLeak,
          })),
        },
      ];
      for (const candidate of malformed)
        expect(() => audit(candidate)).toThrow();
      test.actor.stop();
    },
  );
  it("rejects unissued authority, wrong identity/stage/revision, extras, getters, cycles and cross-family roles", () => {
    const test = setup(fixtures[0]);
    const original = test.input();
    expect(() =>
      projectSemanticActivityFrame({
        ...original,
        content: {
          ...original.content,
          familyProjection: { ...test.authority },
        },
      }),
    ).toThrow("Unissued");
    const base = test.presentation(original.context);
    const hostile: unknown[] = [
      { ...base, revision: 99 },
      { ...base, position: "EXP-02" },
      { ...base, scenarioId: "C02-S02" },
      { ...base, activityId: "C02-A02" },
      { ...base, modelId: "wrong" },
      { ...base, sourceId: "unknown" },
      { ...base, elements: [{ ...base.elements[0]!, role: "NET" }] },
      { ...base, answerKey: "PRIVATE_ANSWER" },
      { ...base, focus: { ...base.focus, targets: ["C01-absent"] } },
      { ...base, readingOrder: [] },
      {
        ...base,
        elements: [
          {
            ...base.elements[0]!,
            exposure: {
              ...base.elements[0]!.exposure,
              hidden: "PRIVATE_ANSWER",
            },
          },
        ],
      },
    ];
    const getter = { ...base };
    Object.defineProperty(getter, "elements", {
      get: () => {
        throw new Error("Getter invoked");
      },
      enumerable: true,
    });
    hostile.push(getter);
    const cycle = { ...base, extra: {} };
    cycle.extra = cycle;
    hostile.push(cycle);
    for (const value of hostile) {
      const authority = createFamilyProjectionAuthority({
        family: "C01",
        activityId: "C01-A02",
        scenarioId: "C01-S02",
        modelId: test.modelId,
        project: () => value as FamilyPresentation<GraphicalFamily>,
      });
      expect(() =>
        projectSemanticActivityFrame({
          ...original,
          content: { ...original.content, familyProjection: authority },
        }),
      ).toThrow();
    }
    test.actor.stop();
  });
  it.each(fixtures)(
    "$family rejects missing roles, incomplete graphs and reversed endpoints",
    (fixture) => {
      const test = setup(fixture);
      const input = test.input();
      const base = test.presentation(input.context);
      const invalid: FamilyPresentation<GraphicalFamily>[] = [
        { ...base, elements: base.elements.slice(1) },
        {
          ...base,
          elements: [
            ...base.elements,
            { ...base.elements[0]!, id: `${fixture.family}-duplicate-role` },
          ],
        },
        { ...base, relationships: [] },
        {
          ...base,
          relationships: base.relationships.map((relation, index) =>
            index
              ? relation
              : { ...relation, from: [relation.to], to: relation.from[0]! },
          ),
        },
      ];
      if (fixture.family === "C06") {
        for (const role of ["BASE", "TOTAL"])
          invalid.push({
            ...base,
            elements: base.elements.map((element) =>
              element.role === role
                ? {
                    ...element,
                    quantity: {
                      status: "KNOWN",
                      amount: "0",
                      unit: "PHP",
                      provenance: "forged",
                    },
                  }
                : element,
            ),
          });
        invalid.push({
          ...base,
          relationships: topology("C06", base.elements[0]!.exposure),
        });
      }
      for (const value of invalid) {
        const authority = createFamilyProjectionAuthority({
          family: fixture.family,
          activityId: input.context.activityId,
          scenarioId: base.scenarioId,
          modelId: test.modelId,
          project: () => value,
        });
        expect(() =>
          projectSemanticActivityFrame({
            ...input,
            content: { ...input.content, familyProjection: authority },
          }),
        ).toThrow();
      }
      test.actor.stop();
    },
  );
  it.each([fixtures[2], fixtures[3], fixtures[5]])(
    "$family changes only the approved bounded source comparison",
    (fixture) => {
      const test = setup(fixture, true);
      const before = projectSemanticActivityFrame(test.input()).familyModel!;
      // Final C03 §30 / C06 §§38–41: select condition or Sales only,
      // never a derived multiplier, commission, base or rate.
      if (fixture.family !== "C04") {
        const event = before.controls[0]!.event;
        expect(before.position).toBe(
          fixture.family === "C03" ? "EXP-03" : "EXP-04",
        );
        expect(before.controls[0]!.target).toBe(
          fixture.family === "C03" ? "C03-WORK_CONDITION" : "C06-SALES",
        );
        const initial = test.actor.getSnapshot().context;
        for (const patch of [
          { selectionId: "MULTIPLIER_2" },
          { selectionId: "RATE_5" },
          { position: "ENTRY" },
          { revision: 99 },
          { modelId: "wrong" },
        ]) {
          test.actor.send({ ...event, ...patch } as never);
          expect(test.actor.getSnapshot().context).toBe(initial);
        }
        expect(
          before.elements.every(
            (item) => item.quantity?.unit !== "SOURCE_UNIT",
          ),
        ).toBe(true);
      }
      test.actor.send(before.controls[0]!.event);
      const after = projectSemanticActivityFrame(test.input()).familyModel!;
      const quantities = (model: typeof before) =>
        model.elements.map((element) =>
          element.quantity?.status === "KNOWN"
            ? element.quantity.amount
            : element.quantity?.status,
        );
      if (fixture.family === "C03") {
        expect(quantities(before)).toEqual(["ORDINARY_DAY", "1.25", "250"]);
        expect(quantities(after)).toEqual(["REST_DAY", "1.69", "338"]);
        expect(after.focus?.explanation.text).toContain(
          "hourly rate 100 and overtime hours 2 stay fixed",
        );
        expect(after.focus?.reinforcement[0]?.text).toBe(
          "Notice what changed: the hourly rate and overtime hours stayed the same. The work condition changed, so the applicable multiplier changed from 1.25 to 1.69. The overtime pay therefore changed from ₱250.00 to ₱338.00.",
        );
      } else if (fixture.family === "C04") {
        expect(quantities(before)).toEqual(["20000", "22000", "2000", "10"]);
        expect(quantities(after)).toEqual(["10000", "12000", "2000", "20"]);
        expect(before.focus?.explanation.text).toContain("C04-S02-A");
        expect(after.focus?.explanation.text).toContain("C04-S02-B");
      } else {
        expect(quantities(before)).toEqual([
          "BASE_PLUS_COMMISSION",
          "300000",
          "3%",
          "15000",
          "9000",
          "24000",
        ]);
        expect(quantities(after)).toEqual([
          "BASE_PLUS_COMMISSION",
          "500000",
          "3%",
          "15000",
          "15000",
          "30000",
        ]);
        expect(after.relationships.map((relation) => relation.kind)).toEqual([
          "SALES_RATE_COMMISSION",
          "BASE_COMMISSION_TOTAL",
        ]);
        expect(after.focus?.reinforcement[0]?.text).toBe(
          "Sales changed to ₱500,000.00. Commission Rate remains 3%. Base Salary remains ₱15,000.00. Commission is now ₱15,000.00. Total Compensation is now ₱30,000.00.",
        );
      }
      expect(after.revision).toBe(1);
      expect(after.readingOrder).toEqual([
        ...after.elements.map((item) => item.id),
        ...after.relationships.map((item) => item.id),
      ]);
      const current = test.actor.getSnapshot().context;
      test.actor.send(before.controls[0]!.event);
      expect(test.actor.getSnapshot().context).toBe(current);
      test.actor.stop();
    },
  );
  it("preserves C06 missing-input partial knowledge without zero/N/A/default substitution", () => {
    // Final C06 §§73–78: unknown Base preserves Commission but withholds Total;
    // unknown Sales/Rate withholds both dependent results. Not new bank states.
    const test = setup(fixtures[5], true);
    const input = test.input();
    const base = test.presentation(input.context);
    const unknown = (item: (typeof base.elements)[number]) => ({
      status: "UNKNOWN" as const,
      unit: item.quantity!.unit,
      provenance: "Final C06 parameter boundary, not participant scenario",
    });
    const publish = (elements: typeof base.elements) =>
      projectSemanticActivityFrame({
        ...input,
        content: {
          ...input.content,
          familyProjection: createFamilyProjectionAuthority({
            family: "C06",
            activityId: "C06-A02",
            scenarioId: "C06-S02",
            modelId: test.modelId,
            project: () => ({ ...base, elements }),
          }),
        },
      }).familyModel!;
    const baseMissing = base.elements.map((item) =>
      ["BASE", "TOTAL"].includes(item.role)
        ? {
            ...item,
            quantity: unknown(item),
            exposure: {
              content: {
                id: `${item.id}-missing`,
                text: `${item.role}: information needed`,
              },
              phases: [input.phase],
              timing: "PUBLIC" as const,
            },
            // Partial-knowledge probe retains the source comparison stage.
          }
        : item,
    );
    expect(
      publish(baseMissing).elements.find((item) => item.role === "COMMISSION")
        ?.quantity,
    ).toMatchObject({ status: "KNOWN", amount: "9000" });
    expect(
      publish(baseMissing).elements.find((item) => item.role === "TOTAL")
        ?.quantity,
    ).toMatchObject({ status: "UNKNOWN" });
    for (const missing of ["SALES", "RATE"]) {
      const malformed = base.elements.map((item) =>
        item.role === missing ? { ...item, quantity: unknown(item) } : item,
      );
      expect(() => publish(malformed)).toThrow(
        "Unestablished commission dependency",
      );
      const partial = malformed.map((item) =>
        ["COMMISSION", "TOTAL", missing].includes(item.role)
          ? {
              ...item,
              quantity: unknown(item),
              exposure: exposure(
                `${item.id}-missing`,
                `${item.role}: information needed`,
              ),
            }
          : item,
      );
      expect(
        publish(partial)
          .elements.filter((item) =>
            ["COMMISSION", "TOTAL"].includes(item.role),
          )
          .every((item) => item.quantity?.status === "UNKNOWN"),
      ).toBe(true);
    }
    const hybrid = base.elements.map((item) =>
      item.role === "BASE" ? { ...item, quantity: unknown(item) } : item,
    );
    expect(() => publish(hybrid)).toThrow("Hybrid base-plus");
    test.actor.stop();
  });
  it("C06-A01 preserves whole arrangements and withholds checked teaching before a current check", () => {
    const test = setup(fixtures[5], false, true);
    const before = projectSemanticActivityFrame(test.input()).familyModel!;
    expect(
      before.elements.find((element) => element.role === "BASE")?.quantity
        ?.status,
    ).toBe("NOT_APPLICABLE");
    expect(
      before.elements.some((element) => element.role === "COMMISSION"),
    ).toBe(false);
    expect(before.relationships).toEqual([]);
    test.actor.send(before.controls[0]!.event);
    const selected = projectSemanticActivityFrame(test.input()).familyModel!;
    expect(
      selected.elements.find((element) => element.role === "BASE")?.quantity,
    ).toMatchObject({ amount: "10000" });
    expect(selected.elements.some((element) => element.role === "TOTAL")).toBe(
      false,
    );
    test.actor.send({
      type: "RESPONSE_CHANGED",
      response: { kind: "SINGLE_SELECTION", selectionId: "base-plus" },
    });
    test.actor.send({ type: "CHECK_RESPONSE" });
    const context = test.actor.getSnapshot().context;
    expect(context.evaluation?.outcome).toBe("CONFIRMED");
    const publication = test.presentation(context);
    const exposeNow = (value: Exposure): Exposure => ({
      ...value,
      phases: [context.position],
    });
    const authority = createFamilyProjectionAuthority({
      family: "C06",
      activityId: "C06-A01",
      scenarioId: "C06-S01",
      modelId: test.modelId,
      project: () => ({
        ...publication,
        position: context.position,
        elements: publication.elements.map((element) => ({
          ...element,
          exposure: exposeNow(element.exposure),
        })),
        relationships: publication.relationships.map((relation) => ({
          ...relation,
          exposure: exposeNow(relation.exposure),
        })),
        focus: {
          ...publication.focus,
          explanation: {
            content: {
              id: "C06-A01-post-check-structure",
              text: "Worker A: Straight. Commission ₱4,000. Base Salary Not Applicable. No Total-Assembler branch. Worker B: Base-Plus. Commission ₱4,000. Base Salary ₱10,000. Total ₱14,000.",
            },
            phases: [context.position],
            timing: "CURRENT_CHECK",
          },
          reinforcement: publication.focus.reinforcement.map(exposeNow),
        },
        controls: [],
      }),
    });
    const checked = projectSemanticActivityFrame({
      ...test.input(),
      context,
      phase: context.position,
      content: { ...test.input().content, familyProjection: authority },
    }).familyModel!;
    expect(
      checked.elements.find((element) => element.role === "COMMISSION")
        ?.quantity,
    ).toMatchObject({ amount: "4000" });
    expect(
      checked.elements.find((element) => element.role === "TOTAL")?.quantity,
    ).toMatchObject({ amount: "14000" });
    expect(checked.relationships.map((relation) => relation.kind)).toEqual([
      "SALES_RATE_COMMISSION",
      "BASE_COMMISSION_TOTAL",
    ]);
    expect(checked.focus?.explanation.text).toBe(
      "Worker A: Straight. Commission ₱4,000. Base Salary Not Applicable. No Total-Assembler branch. Worker B: Base-Plus. Commission ₱4,000. Base Salary ₱10,000. Total ₱14,000.",
    );
    test.actor.stop();
  });
  it("filters protected answers throughout nested C02 semantics and invalidates reveal revisions", () => {
    const test = setup(fixtures[1]);
    const input = test.input();
    const base = test.presentation(input.context);
    for (const timing of [
      "CURRENT_CHECK",
      "CURRENT_FEEDBACK",
      "EXPLICIT_REVEAL",
    ] as const) {
      const protectedExposure: Exposure = {
        content: {
          id: "C02-protected-answer",
          text: "PRIVATE_NESTED_ANSWER_11787.50",
        },
        phases: ["ACTIVE"],
        timing,
        ...(timing === "EXPLICIT_REVEAL" ? { revealRevision: 999 } : {}),
      };
      const authority = createFamilyProjectionAuthority({
        family: "C02",
        activityId: "C02-A02",
        scenarioId: "C02-S02",
        modelId: test.modelId,
        project: () => ({
          ...base,
          relationships: base.relationships.map((relation) => ({
            ...relation,
            exposure: protectedExposure,
          })),
          focus: {
            targets: ["C02-GROSS"],
            explanation: protectedExposure,
            reinforcement: [protectedExposure],
          },
          controls: base.controls.map((control) => ({
            ...control,
            exposure: protectedExposure,
          })),
        }),
      });
      const model = projectSemanticActivityFrame({
        ...input,
        content: { ...input.content, familyProjection: authority },
      }).familyModel!;
      expect(model.relationships).toEqual([]);
      expect(model.focus).toBeUndefined();
      expect(model.controls).toEqual([]);
      expect(model.readingOrder).not.toContain("C02-NET");
      expect(JSON.stringify(model)).not.toContain("PRIVATE_");
      expect(JSON.stringify(model)).not.toContain("11787.50");
      expect(JSON.stringify(model)).not.toContain("1150");
    }
    test.actor.stop();
  });
  it.each(fixtures)(
    "$family permits static publication without a model policy but rejects static controls",
    (fixture) => {
      const test = setup(fixture);
      const original = test.input();
      const activityId = `${fixture.family}-A03` as const;
      const staticDefinition: ActivityDefinition = {
        activityId,
        edges: { ENTRY: { CONTINUE: "ACTIVE" } },
        support: {},
      };
      const registry = new ActivityRegistry([
        { activityId, definition: staticDefinition, ports: original.ports },
      ]);
      const actor = createActivityActor(registry, activityId).start();
      actor.send({ type: "CONTINUE" });
      const base = {
        ...test.presentation(original.context),
        activityId,
        scenarioId: `${fixture.family}-S03`,
        revision: 0,
      };
      const binding = registry.resolve(activityId);
      for (const controls of [[], base.controls]) {
        const authority = createFamilyProjectionAuthority({
          family: fixture.family,
          activityId,
          scenarioId: base.scenarioId,
          modelId: test.modelId,
          project: () => ({ ...base, controls }),
        });
        const input: FrameInput = {
          ...original,
          context: actor.getSnapshot().context,
          definition: binding.definition,
          ports: binding.ports,
          content: { ...original.content, familyProjection: authority },
        };
        if (controls.length)
          expect(() => projectSemanticActivityFrame(input)).toThrow(
            "static family controls",
          );
        else {
          const model = projectSemanticActivityFrame(input).familyModel!;
          expect(model.controls).toEqual([]);
          expect(model.revision).toBe(0);
          expect(actor.getSnapshot().context.model).toBeUndefined();
        }
      }
      actor.stop();
      test.actor.stop();
    },
  );
});

describe("D3 source-authored family intents through Registry→Runtime→actor→frame", () => {
  // Context 57fbf75: final C01 §§24–26, C02 James, C05 §§28–33.
  // These adapters contain ONLY the approved finite states; no illustrative math.
  // C02's older transport-only trace remains separately exercised below, but
  // its stage/source proof is the final-stage matrix, not this generic harness.
  const families = ["C01", "C02", "C05"] as const;
  it.each(families)(
    "%s transports stage-bound D1 states (C02 transport-only; stage proof separate)",
    (family) => {
      const activityId = `${family}-A02` as const;
      const scenarioId = `${family}-S02`;
      const modelId = `${family}-source-trace`;
      const operations: readonly ModelIntent[] =
        family === "C01"
          ? (["REGULAR_PAY", "TRANSPORTATION_ALLOWANCE"] as const).flatMap(
              (earning) =>
                (["INCLUDE_EARNING", "REMOVE_EARNING"] as const).map(
                  (operation) => ({
                    family,
                    earning,
                    operation,
                    period: "MAY",
                  }),
                ),
            )
          : family === "C02"
            ? [
                ...(["SSS", "PHILHEALTH", "PAG_IBIG", "BIR"] as const).map(
                  (deduction) => ({
                    family,
                    operation: "INSPECT_BASIS" as const,
                    deduction,
                  }),
                ),
                {
                  family,
                  operation: "SELECT_BASIS",
                  deduction: "SSS",
                  basis: "STATUTORY_MSC",
                },
                {
                  family,
                  operation: "SELECT_BASIS",
                  deduction: "PHILHEALTH",
                  basis: "MONTHLY_BASIC_SALARY",
                },
                {
                  family,
                  operation: "SELECT_BASIS",
                  deduction: "PAG_IBIG",
                  basis: "CAPPED_FUND_SALARY",
                },
                {
                  family,
                  operation: "SELECT_BASIS",
                  deduction: "BIR",
                  basis: "TAXABLE_COMPENSATION",
                },
              ]
            : [
                { family, operation: "PARTITION_YEAR_INTO_MONTHS" },
                { family, operation: "PARTITION_MONTH_INTO_SEMIMONTHLY" },
              ];
      type State = Readonly<{
        regular: boolean;
        allowance: boolean;
        months: boolean;
        semi: boolean;
        inspected: readonly string[];
        bases: readonly string[];
      }>;
      const issued = new WeakSet<object>();
      const issue = (state: State) => {
        const result = Object.freeze({
          ...state,
          inspected: Object.freeze([...state.inspected]),
          bases: Object.freeze([...state.bases]),
        });
        issued.add(result);
        return result;
      };
      const initial = () =>
        issue({
          regular: false,
          allowance: false,
          months: false,
          semi: false,
          inspected: [],
          bases: [],
        });
      const definition: ActivityDefinition = {
        activityId,
        edges: {
          ENTRY: { CONTINUE: "EXP-01" },
          "EXP-01": { CONTINUE: "EXP-02" },
          "EXP-02": { CONTINUE: "EXP-03" },
          "EXP-03": { CONTINUE: "EXP-04" },
          "EXP-04": { CONTINUE: "EXP-05" },
          "EXP-05": { CONTINUE: family === "C01" ? "ACTIVE" : "EXP-06" },
          "EXP-06": { CONTINUE: "ACTIVE" },
        },
        support: {},
        modelIntents: {
          family,
          scenarioId,
          modelId,
          permissions: ["EXP-02", "EXP-03", "EXP-04"].flatMap((position) =>
            operations
              .filter(
                (intent) =>
                  family === "C02" ||
                  (intent.family === "C01" &&
                    (position === "EXP-02"
                      ? intent.earning === "REGULAR_PAY"
                      : position === "EXP-03")) ||
                  (intent.family === "C05" &&
                    (position === "EXP-02"
                      ? intent.operation === "PARTITION_YEAR_INTO_MONTHS"
                      : position === "EXP-04" &&
                        intent.operation ===
                          "PARTITION_MONTH_INTO_SEMIMONTHLY")),
              )
              .map((intent) => ({
                position: position as "EXP-02",
                intent,
              })),
          ),
        },
        ...(family === "C02"
          ? {}
          : {
              instructionalContinuation: {
                activityId: family === "C01" ? "C01-A02" : "C05-A02",
                family,
                stages:
                  family === "C01"
                    ? [
                        {
                          position: "EXP-02" as const,
                          requirement: "C01_MAY_REGULAR" as const,
                          action: operations[0]!,
                        },
                        {
                          position: "EXP-03" as const,
                          requirement: "C01_MAY_BOTH" as const,
                          action: operations[2]!,
                        },
                      ]
                    : [
                        {
                          position: "EXP-02" as const,
                          requirement: "C05_YEAR_MONTHS" as const,
                          action: operations[0]!,
                        },
                        {
                          position: "EXP-04" as const,
                          requirement: "C05_MONTH_SEMIMONTHLY" as const,
                          action: operations[1]!,
                        },
                      ],
              },
            }),
      };
      const ports: ActivityPorts = {
        ready: () => false,
        evaluate: () => ({ outcome: "RECONSIDERATION", diagnostic: null }),
        completionEligible: () => false,
        sourceReviewAvailable: () => false,
        informationNeeded: () => false,
        informationReturn: () => false,
      };
      const registry = new ActivityRegistry([
        {
          activityId,
          definition,
          ports,
          intentAdapter: {
            initialize: initial,
            continuationState: (current, requirement) => {
              if (!issued.has(current)) return false;
              const state = current as State;
              return requirement === "C01_MAY_REGULAR"
                ? state.regular
                : requirement === "C01_MAY_BOTH"
                  ? state.regular && state.allowance
                  : requirement === "C05_YEAR_MONTHS"
                    ? state.months
                    : state.months && state.semi;
            },
            transition: (current, intent) => {
              if (!issued.has(current)) return null;
              const state = current as State;
              if (intent.family === "C01") {
                const key =
                  intent.earning === "REGULAR_PAY" ? "regular" : "allowance";
                const included = intent.operation === "INCLUDE_EARNING";
                return state[key] === included
                  ? null
                  : issue({ ...state, [key]: included });
              }
              if (intent.family === "C02") {
                if (intent.operation === "INSPECT_BASIS")
                  return state.inspected.includes(intent.deduction)
                    ? null
                    : issue({
                        ...state,
                        inspected: [...state.inspected, intent.deduction],
                      });
                return !state.inspected.includes(intent.deduction) ||
                  state.bases.includes(intent.basis)
                  ? null
                  : issue({ ...state, bases: [...state.bases, intent.basis] });
              }
              if (intent.operation === "PARTITION_YEAR_INTO_MONTHS")
                return state.months ? null : issue({ ...state, months: true });
              return !state.months || state.semi
                ? null
                : issue({ ...state, semi: true });
            },
          },
        },
      ]);
      const binding = registry.resolve(activityId);
      const actor = createActivityActor(registry, activityId).start();
      const other = createActivityActor(registry, activityId).start();
      actor.send({ type: "CONTINUE" });
      expect(actor.getSnapshot().context.position).toBe("EXP-01");
      actor.send({ type: "CONTINUE" });
      const expose = (
        id: string,
        text: string,
        phase: FrameInput["phase"],
      ): Exposure => ({
        content: { id, text },
        phases: [phase],
        timing: "PUBLIC",
      });
      const authority = createFamilyProjectionAuthority({
        family,
        activityId,
        scenarioId,
        modelId,
        project: (context, phase) => {
          const state = context.intentModel!.state as State;
          if (!issued.has(state)) throw new TypeError("Unissued source model");
          const roles =
            family === "C01"
              ? (["EARNING_RECORD", "GROSS_SUMMARY"] as const)
              : family === "C02"
                ? ([
                    "GROSS",
                    "SSS",
                    "PHILHEALTH",
                    "PAG_IBIG",
                    "BIR",
                    "TOTAL_DEDUCTIONS",
                    "NET",
                  ] as const)
                : (["YEAR", "MONTH", "SEMIMONTHLY"] as const);
          const values =
            family === "C01"
              ? [
                  "17250",
                  state.regular
                    ? state.allowance
                      ? "19000"
                      : "17250"
                    : state.allowance
                      ? "1750"
                      : "0",
                ]
              : family === "C02"
                ? ["12937.50", "650", "300", "200", "0", "1150", "11787.50"]
                : ["480000", "40000", "20000"];
          const elements: FamilyPresentation<GraphicalFamily>["elements"][number][] =
            roles.map((role, index) => ({
              id: `${family}-${role}`,
              role,
              state:
                role === "EARNING_RECORD"
                  ? state.regular
                    ? "PARTICIPATING"
                    : "AVAILABLE"
                  : role === "GROSS_SUMMARY"
                    ? state.regular && state.allowance
                      ? "EXPLORATORY_COMPLETE"
                      : "EXPLORATORY_PARTIAL"
                    : role === "MONTH" && state.months
                      ? "ESTABLISHED_GIVEN"
                      : "FIXED",
              quantity: {
                status:
                  (family === "C02" &&
                    role !== "GROSS" &&
                    !state.bases.includes(
                      (
                        {
                          SSS: "STATUTORY_MSC",
                          PHILHEALTH: "MONTHLY_BASIC_SALARY",
                          PAG_IBIG: "CAPPED_FUND_SALARY",
                          BIR: "TAXABLE_COMPENSATION",
                        } as Record<string, string>
                      )[role] ?? "NEVER_AUTO_SOLVE",
                    )) ||
                  (family === "C05" &&
                    ((role === "MONTH" && !state.months) ||
                      (role === "SEMIMONTHLY" && !state.semi)))
                    ? "UNKNOWN"
                    : "KNOWN",
                ...((family === "C02" &&
                  role !== "GROSS" &&
                  !state.bases.includes(
                    (
                      {
                        SSS: "STATUTORY_MSC",
                        PHILHEALTH: "MONTHLY_BASIC_SALARY",
                        PAG_IBIG: "CAPPED_FUND_SALARY",
                        BIR: "TAXABLE_COMPENSATION",
                      } as Record<string, string>
                    )[role] ?? "NEVER_AUTO_SOLVE",
                  )) ||
                (family === "C05" &&
                  ((role === "MONTH" && !state.months) ||
                    (role === "SEMIMONTHLY" && !state.semi)))
                  ? {}
                  : { amount: values[index]! }),
                unit:
                  family === "C05"
                    ? role === "YEAR"
                      ? "PHP/year"
                      : role === "MONTH"
                        ? "PHP/month"
                        : "PHP/semi-monthly period"
                    : "PHP",
                provenance: scenarioId,
              } as PublishedQuantity,
              exposure: expose(
                `${family}-copy-${role}`,
                (family === "C02" &&
                  role !== "GROSS" &&
                  !state.bases.includes(
                    (
                      {
                        SSS: "STATUTORY_MSC",
                        PHILHEALTH: "MONTHLY_BASIC_SALARY",
                        PAG_IBIG: "CAPPED_FUND_SALARY",
                        BIR: "TAXABLE_COMPENSATION",
                      } as Record<string, string>
                    )[role] ?? "NEVER_AUTO_SOLVE",
                  )) ||
                  (family === "C05" &&
                    ((role === "MONTH" && !state.months) ||
                      (role === "SEMIMONTHLY" && !state.semi)))
                  ? `${role}: target not yet established`
                  : `${role}: ${values[index]}`,
                phase,
              ),
            }));
          let relationships = topology(
            family,
            expose(
              `${family}-relationships`,
              "Source-authorized relationships",
              phase,
            ),
          );
          if (family === "C02")
            elements.push(
              ...deductionChainElements(
                expose(
                  "C02-chain-copy",
                  "Transport-only deduction chain",
                  phase,
                ),
              ),
            );
          if (family === "C01") {
            elements.push({
              id: "C01-ALLOWANCE",
              role: "EARNING_RECORD",
              state: state.allowance ? "PARTICIPATING" : "AVAILABLE",
              quantity: {
                status: "KNOWN",
                amount: "1750",
                unit: "PHP",
                provenance: scenarioId,
              },
              exposure: expose(
                "C01-allowance-copy",
                "Transportation allowance — May",
                phase,
              ),
            });
            relationships = [
              ...(state.regular ? relationships : []),
              ...(state.allowance
                ? [
                    {
                      id: "C01-allowance-membership",
                      kind: "MEMBER_OF" as const,
                      from: ["C01-ALLOWANCE"],
                      to: "C01-GROSS_SUMMARY",
                      exposure: expose(
                        "C01-allowance-link",
                        "Applicable May earning",
                        phase,
                      ),
                    },
                  ]
                : []),
            ];
          }
          if (family === "C05" && state.months)
            relationships = [
              ...relationships,
              {
                id: "C05-given",
                kind: "ESTABLISHED_GIVEN",
                from: ["C05-YEAR"],
                to: "C05-MONTH",
                exposure: expose(
                  "C05-given-copy",
                  "Established monthly representation becomes Given",
                  phase,
                ),
              },
            ];
          const target =
            family === "C01"
              ? "C01-GROSS_SUMMARY"
              : family === "C02"
                ? `C02-${state.inspected[state.inspected.length - 1] ?? "GROSS"}`
                : state.semi
                  ? "C05-SEMIMONTHLY"
                  : "C05-MONTH";
          return {
            family,
            activityId,
            scenarioId,
            modelId,
            position: phase,
            revision: context.intentModel!.revision,
            sourceId: `P9B-MDL-${family}-01`,
            elements,
            relationships,
            focus: {
              targets:
                family === "C01"
                  ? [
                      phase === "EXP-02"
                        ? "C01-EARNING_RECORD"
                        : "C01-ALLOWANCE",
                      "C01-GROSS_SUMMARY",
                    ]
                  : [target],
              explanation: expose(
                `${family}-focus`,
                family === "C02"
                  ? `Inspected bases: ${state.inspected.join(", ")}. Selected: ${state.bases.join(", ")}. Gross remains established; each deduction retains its own basis. Inspection does not solve total deductions or net pay.`
                  : family === "C01"
                    ? phase === "EXP-02"
                      ? "An earning joins the gross-income composition because it applies to the scenario—not because its number changes. Try including Paolo’s regular pay. Watch the relationship between the record and the summary."
                      : "Now look at the transportation allowance. We do not include it merely because it is called an allowance. We include it because Paolo’s scenario explicitly says that his employer includes the ₱1,750.00 allowance as part of his May earnings."
                    : phase === "EXP-02"
                      ? "The approved year contains 12 months. To express the annual salary as a monthly salary, partition the annual amount across those 12 month periods.\n\n₱480,000 ÷ 12\n=\n₱40,000/month\n\nThe target is now a monthly representation. The annual salary has not disappeared; we have expressed the same approved compensation relationship using a different time basis."
                      : phase === "EXP-04"
                        ? "The established monthly salary is ₱40,000.00. This approved monthly structure contains two semi-monthly pay periods. Partitioning the monthly amount across those two periods gives:\n\n₱40,000 ÷ 2\n=\n₱20,000 per semi-monthly pay period\n\nThe semi-monthly amount is another representation of the approved compensation structure."
                        : "The established monthly salary is ₱40,000.00. Inspect the established Month representation before the second approved partition.",
                phase,
              ),
              reinforcement: [],
            },
            readingOrder: [
              ...elements.map((element) => element.id),
              ...relationships.map((relation) => relation.id),
            ],
            controls: operations
              .filter((intent) =>
                definition.modelIntents!.permissions.some(
                  (permission) =>
                    permission.position === phase &&
                    JSON.stringify(permission.intent) ===
                      JSON.stringify(intent),
                ),
              )
              .map((intent, index) => ({
                target:
                  intent.family === "C01"
                    ? intent.earning === "REGULAR_PAY"
                      ? "C01-EARNING_RECORD"
                      : "C01-ALLOWANCE"
                    : intent.family === "C05"
                      ? intent.operation === "PARTITION_YEAR_INTO_MONTHS"
                        ? "C05-YEAR"
                        : "C05-MONTH"
                      : target,
                exposure: expose(
                  `${family}-control-${index}`,
                  intent.operation,
                  phase,
                ),
                event: {
                  type: "MODEL_INTENT",
                  activityId,
                  scenarioId,
                  modelId,
                  position: phase,
                  revision: context.intentModel!.revision,
                  intent,
                },
              })),
          };
        },
      });
      const input = (): FrameInput => ({
        context: actor.getSnapshot().context,
        phase: actor.getSnapshot().context.position,
        support: "NONE",
        definition: binding.definition,
        ports: binding.ports,
        content: {
          references: [],
          modelFacts: [],
          derivedFacts: [],
          responseContract: { id: "source-response", text: "Source response" },
          familyProjection: authority,
        },
      });
      const frame = () => projectSemanticActivityFrame(input()).familyModel!;
      // Independent bounded source expectations for the actual intent trace.
      // Structural fixture audits above are not counted as these stage proofs.
      const auditIntentTrace = (model = frame()) => {
        if (family === "C02") return;
        const context = actor.getSnapshot().context;
        const state = context.intentModel!.state as State;
        expect(model.activityId).toBe(family === "C01" ? "C01-A02" : "C05-A02");
        expect(model.scenarioId).toBe(family === "C01" ? "C01-S02" : "C05-S02");
        expect(model.position).toBe(context.position);
        expect(model.revision).toBe(context.intentModel!.revision);
        expect(model.readingOrder).toEqual([
          ...model.elements.map((item) => item.id),
          ...model.relationships.map((item) => item.id),
        ]);
        const value = (id: string) =>
          model.elements.find((item) => item.id === id)!;
        if (family === "C01") {
          expect(value("C01-EARNING_RECORD").quantity).toMatchObject({
            status: "KNOWN",
            amount: "17250",
            unit: "PHP",
          });
          expect(value("C01-ALLOWANCE").quantity).toMatchObject({
            status: "KNOWN",
            amount: "1750",
            unit: "PHP",
          });
          expect(value("C01-EARNING_RECORD").state).toBe(
            state.regular ? "PARTICIPATING" : "AVAILABLE",
          );
          expect(value("C01-ALLOWANCE").state).toBe(
            state.allowance ? "PARTICIPATING" : "AVAILABLE",
          );
          expect(value("C01-GROSS_SUMMARY").quantity).toMatchObject({
            status: "KNOWN",
            amount: String(
              (state.regular ? 17250 : 0) + (state.allowance ? 1750 : 0),
            ),
            unit: "PHP",
          });
          expect(value("C01-GROSS_SUMMARY").state).toBe(
            state.regular && state.allowance
              ? "EXPLORATORY_COMPLETE"
              : "EXPLORATORY_PARTIAL",
          );
          expect(model.relationships.map((item) => item.from[0])).toEqual([
            ...(state.regular ? ["C01-EARNING_RECORD"] : []),
            ...(state.allowance ? ["C01-ALLOWANCE"] : []),
          ]);
          expect(
            model.relationships.every(
              (item) =>
                item.kind === "MEMBER_OF" && item.to === "C01-GROSS_SUMMARY",
            ),
          ).toBe(true);
          expect(model.focus?.targets).toEqual([
            context.position === "EXP-02"
              ? "C01-EARNING_RECORD"
              : "C01-ALLOWANCE",
            "C01-GROSS_SUMMARY",
          ]);
          expect(model.focus?.explanation.text).toBe(
            context.position === "EXP-02"
              ? "An earning joins the gross-income composition because it applies to the scenario—not because its number changes. Try including Paolo’s regular pay. Watch the relationship between the record and the summary."
              : "Now look at the transportation allowance. We do not include it merely because it is called an allowance. We include it because Paolo’s scenario explicitly says that his employer includes the ₱1,750.00 allowance as part of his May earnings.",
          );
          expect(model.controls.map((item) => item.target)).toEqual(
            context.position === "EXP-02"
              ? ["C01-EARNING_RECORD", "C01-EARNING_RECORD"]
              : [
                  "C01-EARNING_RECORD",
                  "C01-EARNING_RECORD",
                  "C01-ALLOWANCE",
                  "C01-ALLOWANCE",
                ],
          );
        } else {
          expect(value("C05-YEAR").quantity).toMatchObject({
            status: "KNOWN",
            amount: "480000",
            unit: "PHP/year",
          });
          expect(value("C05-MONTH").quantity).toMatchObject(
            state.months
              ? { status: "KNOWN", amount: "40000", unit: "PHP/month" }
              : { status: "UNKNOWN", unit: "PHP/month" },
          );
          expect(value("C05-SEMIMONTHLY").quantity).toMatchObject(
            state.semi
              ? {
                  status: "KNOWN",
                  amount: "20000",
                  unit: "PHP/semi-monthly period",
                }
              : { status: "UNKNOWN", unit: "PHP/semi-monthly period" },
          );
          expect(model.controls.map((item) => item.target)).toEqual(
            context.position === "EXP-02"
              ? ["C05-YEAR"]
              : context.position === "EXP-04"
                ? ["C05-MONTH"]
                : [],
          );
          expect(model.focus?.targets).toEqual([
            state.semi ? "C05-SEMIMONTHLY" : "C05-MONTH",
          ]);
        }
        for (const control of model.controls)
          expect(control.event).toMatchObject({
            type: "MODEL_INTENT",
            activityId,
            scenarioId,
            modelId,
            position: context.position,
            revision: context.intentModel!.revision,
          });
      };
      const amount = (role: string) =>
        frame().elements.find((element) => element.role === role)?.quantity;
      const act = (index: number) => {
        auditIntentTrace();
        if (family !== "C02") {
          const valid = frame();
          expect(() => auditIntentTrace({ ...valid, revision: 999 })).toThrow();
          expect(() =>
            auditIntentTrace({ ...valid, position: "ACTIVE" }),
          ).toThrow();
          expect(() =>
            auditIntentTrace({
              ...valid,
              readingOrder: [...valid.readingOrder].reverse(),
            }),
          ).toThrow();
          expect(() =>
            auditIntentTrace({
              ...valid,
              focus: { ...valid.focus!, targets: ["wrong-source-focus"] },
            }),
          ).toThrow();
          expect(() =>
            auditIntentTrace({
              ...valid,
              controls: valid.controls.map((control) => ({
                ...control,
                target: "wrong-source-target",
              })),
            }),
          ).toThrow();
        }
        const event = frame().controls.find(
          (control) =>
            control.event.type === "MODEL_INTENT" &&
            JSON.stringify(control.event.intent) ===
              JSON.stringify(operations[index]),
        )!.event;
        actor.send(event);
        const after = actor.getSnapshot().context;
        auditIntentTrace();
        expect(after.intentModel!.revision).toBe(
          (event.type === "MODEL_INTENT" ? event.revision : -1) + 1,
        );
        expect(frame().readingOrder).toEqual([
          ...frame().elements.map((item) => item.id),
          ...frame().relationships.map((item) => item.id),
        ]);
        actor.send(event);
        expect(actor.getSnapshot().context.intentModel).toBe(after.intentModel);
      };
      if (family === "C01") {
        const blocked = actor.getSnapshot().context;
        expect(
          projectSemanticActivityFrame(input()).allowedLearnerIntents,
        ).not.toContain("CONTINUE");
        actor.send({ type: "CONTINUE" });
        expect(actor.getSnapshot().context).toBe(blocked);
        expect(frame().controls.map((control) => control.target)).toEqual([
          "C01-EARNING_RECORD",
          "C01-EARNING_RECORD",
        ]);
        expect(amount("GROSS_SUMMARY")).toMatchObject({ amount: "0" });
        act(0);
        expect(
          projectSemanticActivityFrame(input()).allowedLearnerIntents,
        ).toContain("CONTINUE");
        expect(frame().focus?.targets).toEqual([
          "C01-EARNING_RECORD",
          "C01-GROSS_SUMMARY",
        ]);
        expect(amount("GROSS_SUMMARY")).toMatchObject({ amount: "17250" });
        expect(
          frame().elements.find((element) => element.role === "GROSS_SUMMARY")
            ?.state,
        ).toBe("EXPLORATORY_PARTIAL");
        actor.send({ type: "CONTINUE" });
        act(2);
        expect(frame().focus?.targets).toEqual([
          "C01-ALLOWANCE",
          "C01-GROSS_SUMMARY",
        ]);
        expect(
          projectSemanticActivityFrame(input()).allowedLearnerIntents,
        ).toContain("CONTINUE");
        expect(amount("GROSS_SUMMARY")).toMatchObject({ amount: "19000" });
        act(3);
        expect(
          projectSemanticActivityFrame(input()).allowedLearnerIntents,
        ).not.toContain("CONTINUE");
        expect(amount("GROSS_SUMMARY")).toMatchObject({ amount: "17250" });
        expect(
          frame().elements.find((element) => element.id === "C01-ALLOWANCE")
            ?.quantity,
        ).toMatchObject({ amount: "1750" });
        act(2);
        expect(frame().relationships).toHaveLength(2);
        expect(
          frame().elements.find((element) => element.role === "GROSS_SUMMARY")
            ?.state,
        ).toBe("EXPLORATORY_COMPLETE");
      } else if (family === "C02") {
        for (let index = 0; index < 4; index++) act(index);
        for (let index = 4; index < 8; index++) act(index);
        expect(frame().focus?.targets).toEqual(["C02-BIR"]);
        expect(frame().focus?.explanation.text).toContain(
          "SSS, PHILHEALTH, PAG_IBIG, BIR",
        );
        expect(frame().focus?.explanation.text).toContain(
          "STATUTORY_MSC, MONTHLY_BASIC_SALARY, CAPPED_FUND_SALARY, TAXABLE_COMPENSATION",
        );
        const expected = ["12937.50", "650", "300", "200", "0"];
        frame()
          .elements.filter((element) => element.quantity)
          .forEach((element, index) => {
            expect(element.quantity).toMatchObject(
              index < 5
                ? { status: "KNOWN", amount: expected[index] }
                : { status: "UNKNOWN" },
            );
          });
      } else {
        const before = actor.getSnapshot().context;
        const first = frame().controls[0]!.event;
        expect(frame().controls.map((control) => control.target)).toEqual([
          "C05-YEAR",
        ]);
        actor.send({ ...first, intent: operations[1] } as never);
        actor.send({ type: "CONTINUE" });
        expect(actor.getSnapshot().context).toBe(before);
        expect(amount("SEMIMONTHLY")).toMatchObject({ status: "UNKNOWN" });
        act(0);
        expect(amount("MONTH")).toMatchObject({
          amount: "40000",
          unit: "PHP/month",
        });
        actor.send({ type: "CONTINUE" });
        expect(actor.getSnapshot().context.position).toBe("EXP-03");
        expect(frame().controls).toEqual([]);
        actor.send({ type: "CONTINUE" });
        expect(actor.getSnapshot().context.position).toBe("EXP-04");
        expect(frame().controls.map((control) => control.target)).toEqual([
          "C05-MONTH",
        ]);
        expect(
          frame().elements.find((element) => element.role === "MONTH")?.state,
        ).toBe("ESTABLISHED_GIVEN");
        act(1);
        expect(
          projectSemanticActivityFrame(input()).allowedLearnerIntents,
        ).toContain("CONTINUE");
        expect(amount("SEMIMONTHLY")).toMatchObject({
          amount: "20000",
          unit: "PHP/semi-monthly period",
        });
        expect(
          frame().relationships.map((relation) => relation.kind),
        ).toContain("ESTABLISHED_GIVEN");
      }
      const before = actor.getSnapshot().context;
      const control = frame().controls[0]!.event;
      for (const patch of [
        { revision: 999 },
        { modelId: "forged" },
        { position: "ENTRY" },
        { scenarioId: "C01-S01" },
      ])
        actor.send({ ...control, ...patch } as never);
      expect(actor.getSnapshot().context).toBe(before);
      expect(() =>
        projectSemanticActivityFrame({
          ...input(),
          context: other.getSnapshot().context,
        }),
      ).toThrow();
      actor.stop();
      other.stop();
    },
  );
});

describe("D3 delivery eligibility only (source-cited compatibility fixtures)", () => {
  // D063/S1 §3; D018/S1 §3; final C01 §28 (blob 8b141c2d),
  // final C05 §§47–55 (blob 6c4b45d1), Context faf061f4.
  // Full canonical passages, preserved from final C01 §28 / C05 §§49 and 55.
  const passages = [
    "Both established May earnings now participate. The allowance itself did not change from ₱1,750.00. The composition changed because another applicable earning joined the total.",
    "The approved year contains 12 months. To express the annual salary as a monthly salary, partition the annual amount across those 12 month periods.\n\n₱480,000 ÷ 12\n=\n₱40,000/month\n\nThe target is now a monthly representation. The annual salary has not disappeared; we have expressed the same approved compensation relationship using a different time basis.",
    "The established monthly salary is ₱40,000.00. This approved monthly structure contains two semi-monthly pay periods. Partitioning the monthly amount across those two periods gives:\n\n₱40,000 ÷ 2\n=\n₱20,000 per semi-monthly pay period\n\nThe semi-monthly amount is another representation of the approved compensation structure.",
  ];
  const cases = [
    {
      activityId: "C01-A02",
      family: "C01",
      scenarioId: "C01-S02",
      position: "EXP-03",
      requirement: "C01_MAY_BOTH",
      obligation: "C01_MAY_ALLOWANCE_CONSEQUENCE",
      action: {
        family: "C01",
        operation: "INCLUDE_EARNING",
        earning: "TRANSPORTATION_ALLOWANCE",
        period: "MAY",
      },
    },
    {
      activityId: "C05-A02",
      family: "C05",
      scenarioId: "C05-S02",
      position: "EXP-02",
      requirement: "C05_YEAR_MONTHS",
      obligation: "C05_YEAR_MONTHS_EXPLANATION",
      action: { family: "C05", operation: "PARTITION_YEAR_INTO_MONTHS" },
    },
    {
      activityId: "C05-A02",
      family: "C05",
      scenarioId: "C05-S02",
      position: "EXP-04",
      requirement: "C05_MONTH_SEMIMONTHLY",
      obligation: "C05_MONTH_SEMIMONTHLY_EXPLANATION",
      action: { family: "C05", operation: "PARTITION_MONTH_INTO_SEMIMONTHLY" },
    },
  ] as const;
  it.each(cases)(
    "$obligation requires current action, exposed prose and exact issuance",
    (test) => {
      const initial = Object.freeze({ established: false });
      const established = Object.freeze({ established: true });
      const issued = new WeakSet([initial, established]);
      const stages =
        test.family === "C01"
          ? [
              {
                position: "EXP-02" as const,
                requirement: "C01_MAY_REGULAR" as const,
                action: {
                  family: "C01" as const,
                  operation: "INCLUDE_EARNING" as const,
                  earning: "REGULAR_PAY" as const,
                  period: "MAY" as const,
                },
              },
              {
                position: "EXP-03" as const,
                requirement: "C01_MAY_BOTH" as const,
                action: cases[0].action,
              },
            ]
          : [
              {
                position: "EXP-02" as const,
                requirement: "C05_YEAR_MONTHS" as const,
                action: cases[1].action,
              },
              {
                position: "EXP-04" as const,
                requirement: "C05_MONTH_SEMIMONTHLY" as const,
                action: cases[2].action,
              },
            ];
      const definition: ActivityDefinition = {
        activityId: test.activityId,
        edges: {
          ENTRY: { CONTINUE: test.position },
          "EXP-02": { CONTINUE: "ACTIVE" },
          "EXP-03": { CONTINUE: "ACTIVE" },
          "EXP-04": { CONTINUE: "ACTIVE" },
          [test.position]: { CONTINUE: "ACTIVE" },
        },
        support: { [test.position]: ["REINFORCEMENT"] },
        modelIntents: {
          family: test.family,
          scenarioId: test.scenarioId,
          modelId: `${test.family}-D3-DELIVERY-FIXTURE`,
          permissions: stages.map((stage) => ({
            position: stage.position,
            intent: stage.action,
          })),
        },
        instructionalContinuation: {
          activityId: test.activityId,
          family: test.family,
          stages,
        },
      };
      const ports: ActivityPorts = {
        ready: () => false,
        evaluate: () => ({ outcome: "RECONSIDERATION", diagnostic: null }),
        completionEligible: () => false,
        sourceReviewAvailable: () => false,
        informationNeeded: () => false,
        informationReturn: () => false,
      };
      const registry = new ActivityRegistry([
        {
          activityId: test.activityId,
          definition,
          ports,
          intentAdapter: {
            initialize: () => initial,
            transition: (current) =>
              issued.has(current as typeof initial) ? established : null,
            continuationState: (state) => state === established,
          },
        },
      ]);
      const binding = registry.resolve(test.activityId);
      const actor = createActivityActor(registry, test.activityId).start();
      const other = createActivityActor(registry, test.activityId).start();
      const content: FrameContent = {
        responseContract: { id: "fixture-response", text: "Fixture response" },
        references: [
          {
            content: {
              id: "fixture-canonical-passage",
              text: passages[cases.indexOf(test)]!,
            },
            phases: [test.position],
            timing: "PUBLIC",
          },
        ],
        modelFacts: [],
        derivedFacts: [],
        instructionalDelivery: {
          obligation: test.obligation,
          contentId: "fixture-canonical-passage",
        },
        familyProjection: createFamilyProjectionAuthority({
          family: test.family,
          activityId: test.activityId,
          scenarioId: test.scenarioId,
          modelId: binding.definition.modelIntents!.modelId,
          project: (context, phase) => ({
            family: test.family,
            activityId: test.activityId,
            scenarioId: test.scenarioId,
            position: phase,
            modelId: binding.definition.modelIntents!.modelId,
            revision: context.intentModel!.revision,
            sourceId: `P9B-MDL-${test.family}-01`,
            elements: (test.family === "C01"
              ? (["EARNING_RECORD", "EARNING_RECORD", "GROSS_SUMMARY"] as const)
              : (["YEAR", "MONTH", "SEMIMONTHLY"] as const)
            ).map((role, index) => ({
              id: `${test.family}-${role}${role === "EARNING_RECORD" && index === 1 ? "-allowance" : ""}`,
              role,
              state:
                role === "EARNING_RECORD"
                  ? ("PARTICIPATING" as const)
                  : role === "MONTH" && test.position === "EXP-04"
                    ? ("ESTABLISHED_GIVEN" as const)
                    : ("AVAILABLE" as const),
              quantity: {
                status: "KNOWN" as const,
                amount:
                  test.family === "C01"
                    ? ["17250", "1750", "19000"][index]!
                    : ["480000", "40000", "20000"][index]!,
                unit:
                  test.family === "C01"
                    ? "PHP"
                    : ["PHP/year", "PHP/month", "PHP/semi-monthly period"][
                        index
                      ]!,
                provenance: test.scenarioId,
              },
              exposure: {
                content: {
                  id: `${test.family}-target-label`,
                  text: "Source-cited synthetic operation target",
                },
                phases: [test.position],
                timing: "PUBLIC",
              },
            })),
            relationships: [
              ...topology(test.family, {
                content: {
                  id: `${test.family}-relationship-copy`,
                  text: "Source relationship",
                },
                phases: [test.position],
                timing: "PUBLIC",
              }),
              ...(test.family === "C01"
                ? [
                    {
                      id: "C01-allowance-link",
                      kind: "MEMBER_OF" as const,
                      from: ["C01-EARNING_RECORD-allowance"],
                      to: "C01-GROSS_SUMMARY",
                      exposure: {
                        content: {
                          id: "C01-membership",
                          text: "May allowance participates in gross composition",
                        },
                        phases: [test.position],
                        timing: "PUBLIC" as const,
                      },
                    },
                  ]
                : []),
            ],
            focus: {
              targets:
                test.family === "C01"
                  ? [
                      "C01-EARNING_RECORD",
                      "C01-EARNING_RECORD-allowance",
                      "C01-GROSS_SUMMARY",
                      "C01-relation-0",
                      "C01-allowance-link",
                    ]
                  : test.position === "EXP-02"
                    ? ["C05-YEAR", "C05-MONTH", "C05-relation-0"]
                    : ["C05-MONTH", "C05-SEMIMONTHLY", "C05-relation-1"],
              explanation: {
                content: {
                  id: `${test.family}-focus`,
                  text: passages[cases.indexOf(test)]!,
                },
                phases: [test.position],
                timing: "PUBLIC",
              },
              reinforcement: [],
            },
            readingOrder: [
              ...(test.family === "C01"
                ? [
                    "EARNING_RECORD",
                    "EARNING_RECORD-allowance",
                    "GROSS_SUMMARY",
                  ]
                : ["YEAR", "MONTH", "SEMIMONTHLY"]
              ).map((role) => `${test.family}-${role}`),
              ...topology(test.family, {
                content: { id: "copy", text: "Relationship" },
                phases: [test.position],
                timing: "PUBLIC",
              }).map((relation) => relation.id),
              ...(test.family === "C01" ? ["C01-allowance-link"] : []),
            ],
            controls: context.intentModel!.revision
              ? []
              : [
                  {
                    target: `${test.family}-${test.family === "C01" ? "EARNING_RECORD" : "MONTH"}`,
                    exposure: {
                      content: {
                        id: `${test.family}-control`,
                        text: "Perform source-bounded fixture operation",
                      },
                      phases: [test.position],
                      timing: "PUBLIC",
                    },
                    event: {
                      type: "MODEL_INTENT",
                      activityId: test.activityId,
                      scenarioId: test.scenarioId,
                      modelId: binding.definition.modelIntents!.modelId,
                      position: phase,
                      revision: context.intentModel!.revision,
                      intent: test.action,
                    },
                  },
                ],
          }),
        }),
      };
      const frameInput = (): FrameInput => ({
        context: actor.getSnapshot().context,
        definition: binding.definition,
        ports: binding.ports,
        phase: test.position,
        support: "NONE",
        content,
      });
      actor.send({ type: "CONTINUE" });
      const before = actor.getSnapshot().context;
      expect(
        projectSemanticActivityFrame(frameInput())
          .eligibleInstructionalDelivery,
      ).toBeUndefined();
      actor.send({ type: "CONTINUE" });
      expect(actor.getSnapshot().context).toBe(before);
      const legalControl =
        projectSemanticActivityFrame(frameInput()).familyModel!.controls[0]!
          .event;
      expect(
        projectSemanticActivityFrame(frameInput()).allowedLearnerIntents,
      ).toContain("MODEL_INTENT");
      actor.send(legalControl);
      const acted = actor.getSnapshot().context;
      actor.send(legalControl);
      expect(actor.getSnapshot().context).toBe(acted);
      expect(
        projectSemanticActivityFrame(frameInput()).familyModel!.controls,
      ).toEqual([]);
      const current = frameInput();
      const frame = projectSemanticActivityFrame(current);
      const descriptor = frame.eligibleInstructionalDelivery!;
      expect(descriptor).toBeDefined();
      expect(frame.allowedLearnerIntents).toContain("CONTINUE");
      expect(Object.isFrozen(descriptor)).toBe(true);
      expect(isCurrentInstructionalDelivery(descriptor, current)).toBe(true);
      expect(isCurrentInstructionalDelivery(descriptor, current)).toBe(true);
      const published = frame.familyModel!;
      const restoreExposure = (text: {
        id: string;
        text: string;
      }): Exposure => ({
        content: text,
        phases: [test.position],
        timing: "PUBLIC",
      });
      const semantic: FamilyPresentation<GraphicalFamily> = {
        ...published,
        position: test.position,
        elements: published.elements.map(({ content, ...element }) => ({
          ...element,
          exposure: restoreExposure(content),
        })),
        relationships: published.relationships.map(
          ({ content, ...relation }) => ({
            ...relation,
            exposure: restoreExposure(content),
          }),
        ),
        focus: {
          targets: published.focus!.targets,
          explanation: restoreExposure(published.focus!.explanation),
          reinforcement: [],
        },
        controls: [],
      };
      const { familyProjection: omitted, ...withoutFamily } = content;
      expect(omitted).toBeDefined();
      expect(
        isCurrentInstructionalDelivery(descriptor, {
          ...current,
          content: withoutFamily,
        }),
      ).toBe(false);
      for (const altered of [
        {
          ...semantic,
          focus: { ...semantic.focus, targets: [semantic.elements[0]!.id] },
        },
        {
          ...semantic,
          focus: {
            ...semantic.focus,
            explanation: restoreExposure({
              id: "changed-focus",
              text: "Not the complete explanatory passage",
            }),
          },
        },
        {
          ...semantic,
          elements: semantic.elements.map((element) =>
            element.role !==
            (test.obligation === "C05_MONTH_SEMIMONTHLY_EXPLANATION"
              ? "SEMIMONTHLY"
              : test.family === "C01"
                ? "GROSS_SUMMARY"
                : "MONTH")
              ? element
              : {
                  ...element,
                  quantity: {
                    status: "KNOWN" as const,
                    amount: "999",
                    unit: "PHP",
                    provenance: "altered consequence",
                  },
                },
          ),
        },
        {
          ...semantic,
          relationships: semantic.relationships.map((relation) => ({
            ...relation,
            exposure: {
              ...relation.exposure,
              timing: "CURRENT_CHECK" as const,
            },
          })),
        },
      ]) {
        const alteredAuthority = createFamilyProjectionAuthority({
          family: test.family,
          activityId: test.activityId,
          scenarioId: test.scenarioId,
          modelId: published.modelId,
          project: () => altered,
        });
        const wrongConsequence = {
          ...current,
          content: { ...content, familyProjection: alteredAuthority },
        };
        expect(
          projectSemanticActivityFrame(wrongConsequence)
            .eligibleInstructionalDelivery,
        ).toBeUndefined();
        expect(
          isCurrentInstructionalDelivery(descriptor, wrongConsequence),
        ).toBe(false);
      }
      for (const text of [
        "Synthetic complete-passage identity probe",
        passages[cases.indexOf(test)]!.slice(0, 60),
        `${passages[cases.indexOf(test)]!} Added answer.`,
        "Wrong canonical passage",
      ]) {
        const changed = {
          ...current,
          content: {
            ...content,
            references: [
              {
                ...content.references[0]!,
                content: { id: descriptor.contentId, text },
              },
            ],
          },
        };
        expect(
          projectSemanticActivityFrame(changed).eligibleInstructionalDelivery,
        ).toBeUndefined();
        expect(isCurrentInstructionalDelivery(descriptor, changed)).toBe(false);
      }
      for (const patch of [
        { responseRevision: current.context.responseRevision + 1 },
        { checkedRevision: 1 },
        { feedbackRevision: 1 },
        { activityId: "C04-A02" as const },
        { position: "ENTRY" as const },
        {
          intentModel: {
            ...current.context.intentModel!,
            revision: current.context.intentModel!.revision + 1,
          },
        },
        { intentModel: { ...current.context.intentModel!, modelId: "wrong" } },
      ])
        expect(
          isCurrentInstructionalDelivery(descriptor, {
            ...current,
            context: { ...current.context, ...patch },
          }),
        ).toBe(false);
      const duplicate = {
        ...current,
        content: {
          ...content,
          references: [content.references[0]!, content.references[0]!],
        },
      };
      expect(
        projectSemanticActivityFrame(duplicate).eligibleInstructionalDelivery,
      ).toBeUndefined();
      expect(isCurrentInstructionalDelivery(descriptor, duplicate)).toBe(false);
      expect(isCurrentInstructionalDelivery({ ...descriptor }, current)).toBe(
        false,
      );
      expect(
        isCurrentInstructionalDelivery(new Proxy(descriptor, {}), current),
      ).toBe(false);
      expect(
        isCurrentInstructionalDelivery(
          { ...descriptor, purpose: "FORGED" },
          current,
        ),
      ).toBe(false);
      expect(
        isCurrentInstructionalDelivery(descriptor, {
          ...current,
          context: { ...current.context },
        }),
      ).toBe(false);
      expect(
        isCurrentInstructionalDelivery(descriptor, {
          ...current,
          context: other.getSnapshot().context,
        }),
      ).toBe(false);
      for (const timing of [
        "CURRENT_CHECK",
        "CURRENT_FEEDBACK",
        "EXPLICIT_REVEAL",
      ] as const) {
        const hidden = {
          ...current,
          content: {
            ...content,
            references: [{ ...content.references[0]!, timing }],
          },
        };
        expect(
          projectSemanticActivityFrame(hidden).eligibleInstructionalDelivery,
        ).toBeUndefined();
        expect(isCurrentInstructionalDelivery(descriptor, hidden)).toBe(false);
      }
      expect(
        isCurrentInstructionalDelivery(descriptor, {
          ...current,
          content: {
            ...content,
            references: [
              {
                ...content.references[0]!,
                content: {
                  id: descriptor.contentId,
                  text: "Changed source passage",
                },
              },
            ],
          },
        }),
      ).toBe(false);
      const afterProjection = actor.getSnapshot().context;
      for (const event of [
        { type: "EXPLANATION_DELIVERED", ...descriptor },
        {
          type: "TERMINAL_TEACHING_DELIVERED",
          revision: 0,
          contentId: descriptor.contentId,
        },
        { type: "FEEDBACK_DELIVERED", revision: 0 },
      ])
        actor.send(event as never);
      expect(actor.getSnapshot().context).toBe(afterProjection);
      actor.send({ type: "OPEN_SUPPORT", mode: "REINFORCEMENT" });
      expect(
        isCurrentInstructionalDelivery(descriptor, {
          ...frameInput(),
          support: "REINFORCEMENT",
        }),
      ).toBe(false);
      actor.send({ type: "CLOSE_SUPPORT" });
      expect(isCurrentInstructionalDelivery(descriptor, frameInput())).toBe(
        false,
      );
      const refreshed =
        projectSemanticActivityFrame(
          frameInput(),
        ).eligibleInstructionalDelivery;
      expect(isCurrentInstructionalDelivery(refreshed, frameInput())).toBe(
        true,
      );
      actor.send({ type: "CONTINUE" });
      expect(actor.getSnapshot().context.position).toBe("ACTIVE");
      expect(
        isCurrentInstructionalDelivery(refreshed, {
          ...frameInput(),
          phase: "ACTIVE",
        }),
      ).toBe(false);
      actor.stop();
      other.stop();
    },
  );
});

// Synthetic enforcement fixtures, NOT authenticated fixed-bank composition.
describe("D3 final-source C02 stage-conformance boundary (fixture authority only)", () => {
  // Context 57fbf75: 01 Project/PASS-9-AMENDMENT-C-DETAILED-INSTRUCTIONAL-EXPERIENCE-AND-STORYBOARD-COMPLETION/
  // 04-C3-C02-NET-PAY-AND-STATUTORY-DEDUCTIONS.md, final §§26–33,
  // lines 4241–4479. No production canonical producer is authenticated here.
  const sourceRows = [
    ["SSS", "13000", "5%", "650", 3],
    ["PHILHEALTH", "12000", "2.5%", "300", 4],
    ["PAG_IBIG", "10000", "2%", "200", 4],
    ["BIR", "11787.50", "Below monthly threshold 20833", "0", 5],
  ] as const;
  const sourcePassages = [
    "C02 begins with James’s gross income already established at ₱12,937.50. That amount came from Gross Income, so we do not rebuild it here.\n\nThe ₱12,000.00 regular pay and ₱937.50 overtime amount help us understand the payroll conditions, but C02’s work starts downstream: determine the applicable deductions, combine them, and determine what remains afterward.",
    "These deductions belong to the same payroll, but that does not mean they all use the same numerical basis. Each deduction keeps the rule that governs it.\n\nBefore calculating a deduction, ask: “What basis controls this row?” Gross income is the starting amount for the payroll, but it is not a universal deduction basis.",
    "SSS does not treat James’s ₱12,937.50 gross income as a simple gross-income × 5% calculation. The approved SSS schedule maps the employee’s compensation range to a Monthly Salary Credit, or MSC.\n\nFor James’s approved state, that MSC is ₱13,000.00. The employee deduction is based on this statutory MSC.",
    "PhilHealth uses a different basis from SSS. For this approved ordinary employee scenario, the employee share is based on Monthly Basic Salary after the authorized bounds are applied. James’s ₱937.50 overtime contributes to gross earnings, but it is not part of the Monthly Basic Salary used by this PhilHealth calculation.",
    "James’s taxable compensation remains below the relevant monthly taxable threshold, so his approved BIR withholding is ₱0.00. That zero is a valid result; it does not mean the BIR information is missing.",
    "Only after the individual deductions are established do we form Total Deductions. Total Deductions is a subtotal, not another deduction category.\n\nNet pay is then the amount remaining after that subtotal is subtracted from Gross Income.",
  ];
  const expose = (
    id: string,
    text: string,
    phase: FrameInput["phase"],
  ): Exposure => ({ content: { id, text }, phases: [phase], timing: "PUBLIC" });
  function fixture(stage: number): FamilyPresentation<"C02"> {
    const phase = `EXP-0${stage}` as FrameInput["phase"];
    const elements: FamilyPresentation<"C02">["elements"][number][] = [
      {
        id: "C02-GROSS",
        role: "GROSS",
        state: "FIXED",
        quantity: {
          status: "KNOWN",
          amount: "12937.50",
          unit: "PHP",
          provenance: "C01 established James gross; final C02 §26",
        },
        exposure: expose(
          "C02-gross-copy",
          "Gross Income — established from Gross Income",
          phase,
        ),
      },
    ];
    const relationships: FamilyPresentation<"C02">["relationships"][number][] =
      [];
    if (stage >= 2)
      for (const [row, basis, rule, amount, firstStage] of sourceRows) {
        elements.push({
          id: `C02-${row}`,
          role: row,
          state: "FIXED",
          exposure: expose(`C02-${row}-label`, row, phase),
        });
        if (stage < firstStage) continue;
        for (const [suffix, role, value, unit] of [
          ["basis", "CONTROLLING_BASIS", basis, "PHP"],
          ["rule", "DEDUCTION_RULE", rule, "APPROVED_RULE"],
          ["consequence", "DEDUCTION_CONSEQUENCE", amount, "PHP"],
        ] as const)
          elements.push({
            id: `C02-${row}-${suffix}`,
            role,
            state: "FIXED",
            quantity: {
              status: "KNOWN",
              amount: value,
              unit,
              provenance: `Final C02 James §${firstStage + 25}`,
            },
            exposure: expose(
              `C02-${row}-${suffix}-copy`,
              `${row} ${suffix}: ${value}`,
              phase,
            ),
          });
        for (const [kind, from, to] of [
          ["ROW_BASIS", `C02-${row}`, `C02-${row}-basis`],
          ["BASIS_RULE", `C02-${row}-basis`, `C02-${row}-rule`],
          ["RULE_CONSEQUENCE", `C02-${row}-rule`, `C02-${row}-consequence`],
        ] as const)
          relationships.push({
            id: `${to}-link`,
            kind,
            from: [from],
            to,
            exposure: expose(`${to}-link-copy`, `${from} → ${to}`, phase),
          });
      }
    if (stage === 6) {
      for (const [role, amount] of [
        ["TOTAL_DEDUCTIONS", "1150"],
        ["NET", "11787.50"],
      ] as const)
        elements.push({
          id: `C02-${role}`,
          role,
          state: "FIXED",
          quantity: {
            status: "KNOWN",
            amount,
            unit: "PHP",
            provenance: "Final C02 §32",
          },
          exposure: expose(`C02-${role}-copy`, `${role}: ${amount}`, phase),
        });
      relationships.push(
        {
          id: "C02-subtotal",
          kind: "DEDUCTION_SUBTOTAL",
          from: sourceRows.map(([row]) => `C02-${row}-consequence`),
          to: "C02-TOTAL_DEDUCTIONS",
          exposure: expose(
            "C02-subtotal-copy",
            "Individual employee deductions form one subtotal",
            phase,
          ),
        },
        {
          id: "C02-net",
          kind: "GROSS_MINUS_SUBTOTAL",
          from: ["C02-GROSS", "C02-TOTAL_DEDUCTIONS"],
          to: "C02-NET",
          exposure: expose(
            "C02-net-copy",
            "Gross Income minus Total Deductions establishes Net Pay",
            phase,
          ),
        },
      );
    }
    const ids = [
      ...elements.map((item) => item.id),
      ...relationships.map((item) => item.id),
    ];
    return freezeFixture({
      family: "C02",
      activityId: "C02-A02",
      scenarioId: "C02-S02",
      position: phase,
      modelId: "C02-final-stage-fixture",
      revision: 0,
      sourceId: "P9B-MDL-C02-01",
      elements,
      relationships,
      focus: {
        targets: ids,
        explanation: expose(
          `C02-final-EXP-0${stage}`,
          sourcePassages[stage - 1]!,
          phase,
        ),
        reinforcement: [],
      },
      readingOrder: ids,
      controls: [],
    });
  }
  /** This is a test proof boundary, NOT an injectable runtime authenticator.
   * Audit all publication-bearing fields, including nested PUBLIC copy, against
   * a separately transcribed source oracle, before constructing the producer.
   */
  function audit(candidate: FamilyPresentation<"C02">, stage: number) {
    expect(candidate.activityId).toBe("C02-A02");
    expect(candidate.scenarioId).toBe("C02-S02");
    expect(candidate.position).toBe(`EXP-0${stage}`);
    expect(candidate.sourceId).toBe("P9B-MDL-C02-01");
    expect(candidate.revision).toBe(0);
    expect(candidate.modelId).toBe("C02-final-stage-fixture");
    expect(candidate.controls).toEqual([]);
    expect(candidate.elements[0]!.quantity).toEqual({
      status: "KNOWN",
      amount: "12937.50",
      unit: "PHP",
      provenance: "C01 established James gross; final C02 §26",
    });
    const chains = sourceRows.filter((row) => row[4] <= stage);
    expect(candidate.elements).toHaveLength(
      1 + (stage >= 2 ? 4 : 0) + chains.length * 3 + (stage === 6 ? 2 : 0),
    );
    expect(candidate.relationships).toHaveLength(
      chains.length * 3 + (stage === 6 ? 2 : 0),
    );
    for (const [row, basis, rule, amount] of chains) {
      expect(
        candidate.elements.find((item) => item.id === `C02-${row}-basis`)
          ?.quantity,
      ).toMatchObject({ status: "KNOWN", amount: basis, unit: "PHP" });
      expect(
        candidate.elements.find((item) => item.id === `C02-${row}-rule`)
          ?.quantity,
      ).toMatchObject({ status: "KNOWN", amount: rule, unit: "APPROVED_RULE" });
      expect(
        candidate.elements.find((item) => item.id === `C02-${row}-consequence`)
          ?.quantity,
      ).toMatchObject({ status: "KNOWN", amount, unit: "PHP" });
    }
    expect(candidate.focus.explanation.content.text).toBe(
      sourcePassages[stage - 1],
    );
    expect(candidate.focus.targets).toEqual(candidate.readingOrder);
    expect(candidate.focus.reinforcement).toEqual([]);
    expect(candidate.focus.explanation).toEqual(
      expose(
        `C02-final-EXP-0${stage}`,
        sourcePassages[stage - 1]!,
        candidate.position,
      ),
    );
    const expectedIds = ["C02-GROSS"];
    if (stage >= 2)
      for (const [row] of sourceRows) {
        expectedIds.push(`C02-${row}`);
        const rowElement = candidate.elements.find(
          (item) => item.id === `C02-${row}`,
        )!;
        expect(rowElement).toEqual({
          id: `C02-${row}`,
          role: row,
          state: "FIXED",
          exposure: expose(`C02-${row}-label`, row, candidate.position),
        });
        const source = chains.find((entry) => entry[0] === row);
        if (!source) continue;
        for (const [suffix, role, value, unit] of [
          ["basis", "CONTROLLING_BASIS", source[1], "PHP"],
          ["rule", "DEDUCTION_RULE", source[2], "APPROVED_RULE"],
          ["consequence", "DEDUCTION_CONSEQUENCE", source[3], "PHP"],
        ] as const) {
          expectedIds.push(`C02-${row}-${suffix}`);
          expect(
            candidate.elements.find(
              (item) => item.id === `C02-${row}-${suffix}`,
            ),
          ).toEqual({
            id: `C02-${row}-${suffix}`,
            role,
            state: "FIXED",
            quantity: {
              status: "KNOWN",
              amount: value,
              unit,
              provenance: `Final C02 James §${source[4] + 25}`,
            },
            exposure: expose(
              `C02-${row}-${suffix}-copy`,
              `${row} ${suffix}: ${value}`,
              candidate.position,
            ),
          });
        }
      }
    if (stage === 6) expectedIds.push("C02-TOTAL_DEDUCTIONS", "C02-NET");
    if (stage === 6)
      for (const [role, amount] of [
        ["TOTAL_DEDUCTIONS", "1150"],
        ["NET", "11787.50"],
      ] as const)
        expect(candidate.elements.find((item) => item.role === role)).toEqual({
          id: `C02-${role}`,
          role,
          state: "FIXED",
          quantity: {
            status: "KNOWN",
            amount,
            unit: "PHP",
            provenance: "Final C02 §32",
          },
          exposure: expose(
            `C02-${role}-copy`,
            `${role}: ${amount}`,
            candidate.position,
          ),
        });
    expect(candidate.elements.map((item) => item.id)).toEqual(expectedIds);
    expect(candidate.elements[0]!.exposure).toEqual(
      expose(
        "C02-gross-copy",
        "Gross Income — established from Gross Income",
        candidate.position,
      ),
    );
    for (const relation of candidate.relationships) {
      expect(relation.exposure.timing).toBe("PUBLIC");
      expect(relation.exposure.phases).toEqual([candidate.position]);
      if (
        relation.kind === "ROW_BASIS" ||
        relation.kind === "BASIS_RULE" ||
        relation.kind === "RULE_CONSEQUENCE"
      ) {
        const row = chains.find(([name]) =>
          relation.to.startsWith(`C02-${name}-`),
        )!;
        const suffixes =
          relation.kind === "ROW_BASIS"
            ? ["", "-basis"]
            : relation.kind === "BASIS_RULE"
              ? ["-basis", "-rule"]
              : ["-rule", "-consequence"];
        expect(relation.from).toEqual([`C02-${row[0]}${suffixes[0]}`]);
        expect(relation.to).toBe(`C02-${row[0]}${suffixes[1]}`);
        expect(relation.exposure).toEqual(
          expose(
            `${relation.to}-link-copy`,
            `${relation.from[0]} → ${relation.to}`,
            candidate.position,
          ),
        );
      } else {
        const subtotal = relation.kind === "DEDUCTION_SUBTOTAL";
        expect(relation.from).toEqual(
          subtotal
            ? [
                "C02-SSS-consequence",
                "C02-PHILHEALTH-consequence",
                "C02-PAG_IBIG-consequence",
                "C02-BIR-consequence",
              ]
            : ["C02-GROSS", "C02-TOTAL_DEDUCTIONS"],
        );
        expect(relation.to).toBe(subtotal ? "C02-TOTAL_DEDUCTIONS" : "C02-NET");
        expect(relation.exposure).toEqual(
          expose(
            subtotal ? "C02-subtotal-copy" : "C02-net-copy",
            subtotal
              ? "Individual employee deductions form one subtotal"
              : "Gross Income minus Total Deductions establishes Net Pay",
            candidate.position,
          ),
        );
      }
    }
    expect(candidate.readingOrder).toEqual([
      ...expectedIds,
      ...candidate.relationships.map((item) => item.id),
    ]);
    const clean = structuredClone(candidate);
    for (const element of clean.elements) {
      expect(Object.keys(element).sort()).toEqual(
        (element.quantity
          ? ["id", "role", "state", "quantity", "exposure"]
          : ["id", "role", "state", "exposure"]
        ).sort(),
      );
      expect(Object.keys(element.exposure).sort()).toEqual([
        "content",
        "phases",
        "timing",
      ]);
      expect(Object.keys(element.exposure.content).sort()).toEqual([
        "id",
        "text",
      ]);
    }
  }
  it.each([1, 2, 3, 4, 5, 6])(
    "James EXP-0%s publishes only the current source stage, including nonvisual causal order",
    (stage) => {
      const value = fixture(stage);
      audit(value, stage);
      const definition: ActivityDefinition = {
        activityId: "C02-A02",
        edges: {
          ENTRY: { CONTINUE: value.position },
          [value.position]: { CONTINUE: "ACTIVE" as const },
        },
        support: {},
      };
      const ports: ActivityPorts = {
        ready: () => false,
        evaluate: () => ({ outcome: "RECONSIDERATION", diagnostic: null }),
        completionEligible: () => false,
        sourceReviewAvailable: () => false,
        informationNeeded: () => false,
        informationReturn: () => false,
      };
      const actor = createActor(
        createActivityMachine(definition, ports),
      ).start();
      actor.send({ type: "CONTINUE" });
      const authority = createFamilyProjectionAuthority({
        family: "C02",
        activityId: "C02-A02",
        scenarioId: "C02-S02",
        modelId: value.modelId,
        project: () => value,
      });
      const frame = projectSemanticActivityFrame({
        context: actor.getSnapshot().context,
        phase: value.position,
        support: "NONE",
        definition,
        ports,
        content: {
          references: [],
          modelFacts: [],
          derivedFacts: [],
          responseContract: {
            id: "C02-response",
            text: "Guided James payroll",
          },
          familyProjection: authority,
        },
      });
      expect(frame.familyModel!.elements).toHaveLength(value.elements.length);
      expect(frame.familyModel!.relationships).toHaveLength(
        value.relationships.length,
      );
      expect(frame.familyModel!.readingOrder).toEqual(value.readingOrder);
      expect(frame.familyModel!.focus?.explanation.text).toBe(
        sourcePassages[stage - 1],
      );
      if (stage < 6)
        expect(
          frame.familyModel!.elements.some(
            (item) => item.role === "NET" || item.role === "TOTAL_DEDUCTIONS",
          ),
        ).toBe(false);
      if (stage === 2)
        expect(
          frame.familyModel!.elements.slice(1).every((item) => !item.quantity),
        ).toBe(true);
      if (stage === 5)
        expect(
          frame.familyModel!.elements.find(
            (item) => item.id === "C02-BIR-consequence",
          )?.quantity,
        ).toMatchObject({ status: "KNOWN", amount: "0" });
      actor.stop();
    },
  );
  it("runs James's ordered Registry→Runtime stage trace with deduction-targeted revision-bound inspection", () => {
    // Final C02 §§26–33; fixture authority, not a production model engine.
    const intents = sourceRows.map(([deduction]) => ({
      family: "C02" as const,
      operation: "INSPECT_BASIS" as const,
      deduction,
    }));
    const selections: readonly ModelIntent[] = [
      {
        family: "C02",
        operation: "SELECT_BASIS",
        deduction: "SSS",
        basis: "STATUTORY_MSC",
      },
      {
        family: "C02",
        operation: "SELECT_BASIS",
        deduction: "PHILHEALTH",
        basis: "MONTHLY_BASIC_SALARY",
      },
      {
        family: "C02",
        operation: "SELECT_BASIS",
        deduction: "PAG_IBIG",
        basis: "CAPPED_FUND_SALARY",
      },
      {
        family: "C02",
        operation: "SELECT_BASIS",
        deduction: "BIR",
        basis: "TAXABLE_COMPENSATION",
      },
    ];
    const definition: ActivityDefinition = {
      activityId: "C02-A02",
      edges: {
        ENTRY: { CONTINUE: "EXP-01" },
        "EXP-01": { CONTINUE: "EXP-02" },
        "EXP-02": { CONTINUE: "EXP-03" },
        "EXP-03": { CONTINUE: "EXP-04" },
        "EXP-04": { CONTINUE: "EXP-05" },
        "EXP-05": { CONTINUE: "EXP-06" },
        "EXP-06": { CONTINUE: "ACTIVE" },
      },
      support: {},
      modelIntents: {
        family: "C02",
        scenarioId: "C02-S02",
        modelId: "C02-final-stage-fixture",
        permissions: [
          ...intents.map((intent) => ({ position: "EXP-02" as const, intent })),
          ...selections.map((intent, index) => ({
            position:
              index === 0
                ? ("EXP-03" as const)
                : index === 3
                  ? ("EXP-05" as const)
                  : ("EXP-04" as const),
            intent,
          })),
        ],
      },
    };
    const ports: ActivityPorts = {
      ready: () => false,
      evaluate: () => ({ outcome: "RECONSIDERATION", diagnostic: null }),
      completionEligible: () => false,
      sourceReviewAvailable: () => false,
      informationNeeded: () => false,
      informationReturn: () => false,
    };
    const registry = new ActivityRegistry([
      {
        activityId: "C02-A02",
        definition,
        ports,
        intentAdapter: {
          initialize: () => Object.freeze({ inspected: "" }),
          transition: (_state, intent) =>
            intent.family === "C02"
              ? Object.freeze({ inspected: intent.deduction })
              : null,
        },
      },
    ]);
    const binding = registry.resolve("C02-A02");
    const actor = createActivityActor(registry, "C02-A02").start();
    for (let stage = 1; stage <= 6; stage++) {
      actor.send({ type: "CONTINUE" });
      const context = actor.getSnapshot().context;
      expect(context.position).toBe(`EXP-0${stage}`);
      const base = fixture(stage);
      audit(base, stage);
      const presentation = (): FamilyPresentation<"C02"> => ({
        ...base,
        revision: actor.getSnapshot().context.intentModel!.revision,
        controls: definition
          .modelIntents!.permissions.filter(
            (permission) => permission.position === base.position,
          )
          .map(({ intent }) => ({
            target: `C02-${intent.family === "C02" ? intent.deduction : ""}`,
            exposure: expose(
              `inspect-${JSON.stringify(intent)}`,
              "Inspect the controlling deduction basis",
              base.position,
            ),
            event: {
              type: "MODEL_INTENT",
              activityId: "C02-A02",
              scenarioId: "C02-S02",
              modelId: base.modelId,
              revision: actor.getSnapshot().context.intentModel!.revision,
              position: base.position,
              intent,
            },
          })),
      });
      const frame = () =>
        projectSemanticActivityFrame({
          context: actor.getSnapshot().context,
          phase: base.position,
          support: "NONE",
          definition: binding.definition,
          ports: binding.ports,
          content: {
            references: [],
            modelFacts: [],
            derivedFacts: [],
            responseContract: {
              id: "James",
              text: "Determine deductions and net independently in ACTIVE",
            },
            familyProjection: createFamilyProjectionAuthority({
              family: "C02",
              activityId: "C02-A02",
              scenarioId: "C02-S02",
              modelId: base.modelId,
              project: presentation,
            }),
          },
        });
      const published = frame().familyModel!;
      expect(published.readingOrder).toEqual(base.readingOrder);
      expect(published.focus?.explanation.text).toBe(sourcePassages[stage - 1]);
      expect(published.controls.map((control) => control.target)).toEqual(
        stage === 2
          ? ["C02-SSS", "C02-PHILHEALTH", "C02-PAG_IBIG", "C02-BIR"]
          : stage === 3
            ? ["C02-SSS"]
            : stage === 4
              ? ["C02-PHILHEALTH", "C02-PAG_IBIG"]
              : stage === 5
                ? ["C02-BIR"]
                : [],
      );
      for (const control of published.controls) {
        const before = actor.getSnapshot().context;
        actor.send({ ...control.event, position: "ACTIVE" } as never);
        expect(actor.getSnapshot().context).toBe(before);
        // Refresh after each accepted revision; the previous command is stale.
        const event = frame().familyModel!.controls.find(
          (item) => item.target === control.target,
        )!.event;
        actor.send(event);
        expect(actor.getSnapshot().context.intentModel!.revision).toBe(
          before.intentModel!.revision + 1,
        );
        const current = actor.getSnapshot().context;
        actor.send(event);
        expect(actor.getSnapshot().context).toBe(current);
      }
    }
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.position).toBe("ACTIVE");
    const current = actor.getSnapshot().context;
    actor.send({
      type: "MODEL_INTENT",
      activityId: "C02-A02",
      scenarioId: "C02-S02",
      modelId: "C02-final-stage-fixture",
      position: "ACTIVE",
      revision: current.intentModel!.revision,
      intent: intents[0]!,
    });
    expect(actor.getSnapshot().context).toBe(current);
    const active = fixture(6);
    const activeCopy = (value: Exposure): Exposure => ({
      ...value,
      phases: ["ACTIVE"],
      timing: "CURRENT_CHECK",
    });
    const activeAuthority = createFamilyProjectionAuthority({
      family: "C02",
      activityId: "C02-A02",
      scenarioId: "C02-S02",
      modelId: active.modelId,
      project: () => ({
        ...active,
        position: "ACTIVE",
        revision: current.intentModel!.revision,
        elements: active.elements.map((item) => ({
          ...item,
          exposure: activeCopy(item.exposure),
        })),
        relationships: active.relationships.map((item) => ({
          ...item,
          exposure: activeCopy(item.exposure),
        })),
        focus: {
          ...active.focus,
          explanation: activeCopy(active.focus.explanation),
          reinforcement: [],
        },
        controls: [],
      }),
    });
    const protectedFrame = projectSemanticActivityFrame({
      context: current,
      phase: "ACTIVE",
      support: "NONE",
      definition: binding.definition,
      ports: binding.ports,
      content: {
        references: [],
        modelFacts: [],
        derivedFacts: [],
        responseContract: {
          id: "James-independent",
          text: "Determine total deductions and net pay",
        },
        familyProjection: activeAuthority,
      },
    });
    expect(protectedFrame.familyModel!.elements).toEqual([]);
    expect(protectedFrame.familyModel!.relationships).toEqual([]);
    expect(protectedFrame.familyModel!.focus).toBeUndefined();
    expect(protectedFrame.familyModel!.readingOrder).toEqual([]);
    actor.stop();
  });

  it("rejects changed quantities, provenance, copy, phase, focus, relations, controls and nested PUBLIC laundering at the fixture audit boundary", () => {
    const base = fixture(6);
    const malicious = {
      content: {
        id: "C02-safe-looking",
        text: "The protected answer is already available.",
      },
      phases: ["EXP-06"],
      timing: "PUBLIC",
    } as const;
    const candidates: FamilyPresentation<"C02">[] = [
      { ...base, revision: 1 },
      { ...base, scenarioId: "C02-S03" },
      { ...base, position: "ACTIVE" },
      {
        ...base,
        elements: base.elements.map((item, index) =>
          index
            ? item
            : {
                ...item,
                quantity: {
                  status: "KNOWN",
                  amount: "999",
                  unit: "PHP",
                  provenance: "fabricated provider",
                },
              },
        ),
      },
      {
        ...base,
        elements: base.elements.map((item, index) =>
          index ? item : { ...item, exposure: malicious },
        ),
      },
      {
        ...base,
        relationships: base.relationships.map((item, index) =>
          index ? item : { ...item, exposure: malicious },
        ),
      },
      {
        ...base,
        relationships: base.relationships.map((item, index) =>
          index ? item : { ...item, to: "C02-PHILHEALTH-basis" },
        ),
      },
      { ...base, focus: { ...base.focus, explanation: malicious } },
      { ...base, focus: { ...base.focus, reinforcement: [malicious] } },
      { ...base, focus: { ...base.focus, targets: ["C02-GROSS"] } },
      { ...base, readingOrder: [...base.readingOrder].reverse() },
      {
        ...base,
        controls: [
          {
            target: "C02-GROSS",
            exposure: malicious,
            event: {
              type: "MODEL_INTENT",
              activityId: "C02-A02",
              scenarioId: "C02-S02",
              modelId: base.modelId,
              position: "EXP-06",
              revision: 0,
              intent: {
                family: "C02",
                operation: "INSPECT_BASIS",
                deduction: "SSS",
              },
            },
          },
        ],
      },
    ];
    for (const candidate of candidates)
      expect(() => audit(candidate, 6)).toThrow();
  });
  it("does not force the annual state or a future semi-monthly target into the current monthly graph", () => {
    const definition: ActivityDefinition = {
      activityId: "C05-A02",
      edges: {
        ENTRY: { CONTINUE: "EXP-03" },
        "EXP-03": { CONTINUE: "ACTIVE" },
      },
      support: {},
    };
    const ports: ActivityPorts = {
      ready: () => false,
      evaluate: () => ({ outcome: "RECONSIDERATION", diagnostic: null }),
      completionEligible: () => false,
      sourceReviewAvailable: () => false,
      informationNeeded: () => false,
      informationReturn: () => false,
    };
    const actor = createActor(createActivityMachine(definition, ports)).start();
    actor.send({ type: "CONTINUE" });
    const value: FamilyPresentation<"C05"> = {
      family: "C05",
      activityId: "C05-A02",
      scenarioId: "C05-S02",
      modelId: "C05-partial-Given",
      revision: 0,
      position: "EXP-03",
      sourceId: "P9B-MDL-C05-01",
      elements: [
        {
          id: "C05-established-month",
          role: "MONTH",
          state: "ESTABLISHED_GIVEN",
          quantity: {
            status: "KNOWN",
            amount: "40000",
            unit: "PHP/month",
            provenance:
              "Final C05 §§50–51, monthly result becomes second-state Given",
          },
          exposure: expose(
            "C05-monthly-Given-copy",
            "Established monthly salary ₱40,000.00",
            "EXP-03",
          ),
        },
      ],
      relationships: [],
      controls: [],
      readingOrder: ["C05-established-month"],
      focus: {
        targets: ["C05-established-month"],
        explanation: expose(
          "C05-state-handoff",
          "Monthly result becomes the established Given for the second approved state.",
          "EXP-03",
        ),
        reinforcement: [],
      },
    };
    const input = (presentation: FamilyPresentation<"C05">): FrameInput => ({
      context: actor.getSnapshot().context,
      phase: "EXP-03",
      support: "NONE",
      definition,
      ports,
      content: {
        references: [],
        modelFacts: [],
        derivedFacts: [],
        responseContract: {
          id: "C05-response",
          text: "Time-basis representation",
        },
        familyProjection: createFamilyProjectionAuthority({
          family: "C05",
          activityId: "C05-A02",
          scenarioId: "C05-S02",
          modelId: value.modelId,
          project: () => presentation,
        }),
      },
    });
    const model = projectSemanticActivityFrame(input(value)).familyModel!;
    expect(model.elements.map((item) => item.role)).toEqual(["MONTH"]);
    expect(model.relationships).toEqual([]);
    expect(() =>
      projectSemanticActivityFrame(
        input({
          ...value,
          elements: value.elements.map((item) => ({
            ...item,
            state: "AVAILABLE",
          })),
        }),
      ),
    ).toThrow("Unestablished monthly Given");
    actor.stop();
  });
});

describe("D3 genuine C04 composer regression, not D6 browser certification", () => {
  it("preserves stage-focused A/B dependent exposure and existing selection semantics", () => {
    const actor = createC04ActivityActor("C04-A02").start();
    const frame = () => composeC04ActivityFrame(actor);
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.position).toBe("EXP-01");
    expect(
      frame().contentReferences.some((item) => item.id.endsWith("/teaching")),
    ).toBe(true);
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.position).toBe("EXP-02");
    expect(
      frame().contentReferences.some((item) =>
        item.id.endsWith("/dependent-teaching"),
      ),
    ).toBe(false);
    expect(frame().exposedDerivedFacts).toEqual([]);
    const select = (selectionId: string) => {
      const control = frame().modelSelectionControl!;
      actor.send({
        type: "SELECT_MODEL_CHILD",
        modelId: control.modelId,
        revision: control.revision,
        position: control.position,
        selectionId,
      });
    };
    select("C04-S02-B");
    expect(frame().exposedDerivedFacts).toEqual([]);
    select("C04-S02-A");
    expect(
      frame().contentReferences.find((item) =>
        item.id.endsWith("/dependent-teaching"),
      )?.text,
    ).toContain("increased by 10%");
    expect(frame().exposedDerivedFacts.length).toBeGreaterThan(0);
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.position).toBe("EXP-03");
    expect(frame().exposedDerivedFacts).toEqual([]);
    select("C04-S02-B");
    expect(
      frame().contentReferences.find((item) =>
        item.id.endsWith("/dependent-teaching"),
      )?.text,
    ).toContain("increased by 20%");
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.position).toBe("EXP-04");
    expect(
      frame()
        .contentReferences.map((item) => item.text)
        .join(" "),
    ).toContain("Original A ≠ Original B");
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.position).toBe("EXP-05");
    expect(
      frame().contentReferences.some(
        (item) =>
          item.text === "Percentage Change = (New − Original) ÷ Original × 100",
      ),
    ).toBe(true);
    expect(frame().eligibleInstructionalDelivery).toBeUndefined();
    actor.stop();
  });
});

describe("D3 C02 static assessment inputs and paired identity", () => {
  it("retains Anna's intentionally complete Prepare ledger without adding Floor local state", () => {
    // Final C02 §14 (3976–3993): complete payroll is intentionally visible.
    // D4's required embedded Floor lifecycle is NOT implemented in this fixture.
    const definition: ActivityDefinition = {
      activityId: "C02-A01",
      edges: { ENTRY: { CONTINUE: "ACTIVE" } },
      support: {},
    };
    const ports: ActivityPorts = {
      ready: () => false,
      evaluate: () => ({ outcome: "RECONSIDERATION", diagnostic: null }),
      completionEligible: () => false,
      sourceReviewAvailable: () => false,
      informationNeeded: () => false,
      informationReturn: () => false,
    };
    const actor = createActor(createActivityMachine(definition, ports)).start();
    actor.send({ type: "CONTINUE" });
    const exposure = (id: string, text: string): Exposure => ({
      content: { id, text },
      phases: ["ACTIVE"],
      timing: "PUBLIC",
    });
    const rows = [
      ["GROSS", "12100"],
      ["SSS", "600"],
      ["PHILHEALTH", "302.50"],
      ["PAG_IBIG", "200"],
      ["BIR", "0"],
    ] as const;
    const elements: FamilyPresentation<"C02">["elements"][number][] = rows.map(
      ([role, amount]) => ({
        id: `C02-Anna-${role}`,
        role,
        state: "FIXED",
        quantity: {
          status: "KNOWN",
          amount,
          unit: "PHP",
          provenance: "Final C02 §14 Anna established static payroll",
        },
        exposure: exposure(`C02-Anna-${role}-copy`, `${role}: ${amount}`),
      }),
    );
    for (const [role, amount] of [
      ["TOTAL_DEDUCTIONS", "1102.50"],
      ["NET", "10997.50"],
    ] as const)
      elements.push({
        id: `C02-Anna-${role}`,
        role,
        state: "FIXED",
        quantity: {
          status: "KNOWN",
          amount,
          unit: "PHP",
          provenance: "Final C02 §14 Anna established static payroll",
        },
        exposure: exposure(`C02-Anna-${role}-copy`, `${role}: ${amount}`),
      });
    const relationships: FamilyPresentation<"C02">["relationships"][number][] =
      [
        {
          id: "C02-Anna-subtotal",
          kind: "DEDUCTION_SUBTOTAL",
          from: ["SSS", "PHILHEALTH", "PAG_IBIG", "BIR"].map(
            (role) => `C02-Anna-${role}`,
          ),
          to: "C02-Anna-TOTAL_DEDUCTIONS",
          exposure: exposure(
            "C02-Anna-subtotal-copy",
            "The four employee deductions form one subtotal",
          ),
        },
        {
          id: "C02-Anna-net",
          kind: "GROSS_MINUS_SUBTOTAL",
          from: ["C02-Anna-GROSS", "C02-Anna-TOTAL_DEDUCTIONS"],
          to: "C02-Anna-NET",
          exposure: exposure(
            "C02-Anna-net-copy",
            "Net pay is gross income minus total deductions",
          ),
        },
      ];
    // Static Anna requires payroll roles, not a fabricated statutory worked chain.
    const ids = [
      ...elements.map((item) => item.id),
      ...relationships.map((item) => item.id),
    ];
    const model: FamilyPresentation<"C02"> = {
      family: "C02",
      activityId: "C02-A01",
      scenarioId: "C02-S01",
      modelId: "C02-Anna-source-fixture",
      revision: 0,
      position: "ACTIVE",
      sourceId: "P9B-MDL-C02-01",
      elements,
      relationships,
      readingOrder: ids,
      controls: [],
      focus: {
        targets: ids,
        explanation: exposure(
          "C02-Anna-roles",
          "Keep the payroll roles separate: gross income is the starting amount; each deduction is an individual subtraction; total deductions combine those deductions; net pay is gross income minus total deductions.",
        ),
        reinforcement: [],
      },
    };
    const frame = projectSemanticActivityFrame({
      context: actor.getSnapshot().context,
      phase: "ACTIVE",
      support: "NONE",
      definition,
      ports,
      content: {
        references: [],
        modelFacts: [
          exposure("C02-Anna-total", "Total deductions: ₱1,102.50"),
          exposure("C02-Anna-net", "Net pay: ₱10,997.50"),
        ],
        derivedFacts: [],
        responseContract: {
          id: "C02-Anna-response",
          text: "Identify payroll roles",
        },
        familyProjection: createFamilyProjectionAuthority({
          family: "C02",
          activityId: "C02-A01",
          scenarioId: "C02-S01",
          modelId: model.modelId,
          project: () => model,
        }),
      },
    });
    expect(
      frame.familyModel!.elements.map((item) =>
        item.quantity?.status === "KNOWN" ? item.quantity.amount : undefined,
      ),
    ).toEqual(["12100", "600", "302.50", "200", "0", "1102.50", "10997.50"]);
    expect(frame.exposedModelFacts.map((item) => item.text)).toEqual([
      "Total deductions: ₱1,102.50",
      "Net pay: ₱10,997.50",
    ]);
    expect(frame.familyModel!.controls).toEqual([]);
    actor.stop();
  });
  // Final C02 §§35–56, lines 4503–5006: Fletcher uses GSIS; Alex's
  // equal-gross ledgers are distinct. Solved values are post-response only.
  it.each(["C02-A03", "C02-A04"] as const)(
    "%s publishes givens/rules without solved results or controls",
    (activityId) => {
      const definition: ActivityDefinition = {
        activityId,
        edges: { ENTRY: { CONTINUE: "ACTIVE" } },
        support: {},
      };
      const ports: ActivityPorts = {
        ready: () => false,
        evaluate: () => ({ outcome: "RECONSIDERATION", diagnostic: null }),
        completionEligible: () => false,
        sourceReviewAvailable: () => false,
        informationNeeded: () => false,
        informationReturn: () => false,
      };
      const actor = createActor(
        createActivityMachine(definition, ports),
      ).start();
      actor.send({ type: "CONTINUE" });
      const ledgers =
        activityId === "C02-A03"
          ? [
              {
                id: "Fletcher",
                gross: "24000",
                basic: "24000",
                insurance: "GSIS" as const,
                rule: "9% of actual monthly salary",
              },
            ]
          : [
              {
                id: "Job-A",
                gross: "28000",
                basic: "25000",
                insurance: "SSS" as const,
                rule: "Approved statutory MSC schedule",
              },
              {
                id: "Job-B",
                gross: "28000",
                basic: "28000",
                insurance: "SSS" as const,
                rule: "Approved statutory MSC schedule",
              },
            ];
      const elements: FamilyPresentation<"C02">["elements"][number][] = [];
      const relationships: FamilyPresentation<"C02">["relationships"][number][] =
        [];
      const exp = (id: string, text: string): Exposure => ({
        content: { id, text },
        phases: ["ACTIVE"],
        timing: "PUBLIC",
      });
      for (const ledger of ledgers) {
        const prefix = `C02-${ledger.id}`;
        elements.push({
          id: `${prefix}-gross`,
          role: "GROSS",
          state: "FIXED",
          quantity: {
            status: "KNOWN",
            amount: ledger.gross,
            unit: "PHP",
            provenance: `Final C02 ${activityId} established input`,
          },
          exposure: exp(
            `${prefix}-gross-copy`,
            `${ledger.id}: established gross income ${ledger.gross}`,
          ),
        });
        for (const row of [
          ledger.insurance,
          "PHILHEALTH",
          "PAG_IBIG",
          "BIR",
        ] as const) {
          elements.push({
            id: `${prefix}-${row}`,
            role: row,
            state: "FIXED",
            exposure: exp(`${prefix}-${row}-label`, `${ledger.id}: ${row}`),
          });
          // The insurance row shows rule access, never an already solved result.
          if (row !== ledger.insurance) continue;
          elements.push(
            {
              id: `${prefix}-basis`,
              role: "CONTROLLING_BASIS",
              state: "FIXED",
              exposure: exp(
                `${prefix}-basis-copy`,
                row === "GSIS"
                  ? `Actual monthly salary ${ledger.basic}`
                  : "Use the current approved SSS table/reference",
              ),
            },
            {
              id: `${prefix}-rule`,
              role: "DEDUCTION_RULE",
              state: "FIXED",
              exposure: exp(`${prefix}-rule-copy`, ledger.rule),
            },
          );
          relationships.push(
            {
              id: `${prefix}-basis-link`,
              kind: "ROW_BASIS",
              from: [`${prefix}-${row}`],
              to: `${prefix}-basis`,
              exposure: exp(
                `${prefix}-basis-link-copy`,
                `${ledger.id}: insurance row uses its own controlling basis`,
              ),
            },
            {
              id: `${prefix}-rule-link`,
              kind: "BASIS_RULE",
              from: [`${prefix}-basis`],
              to: `${prefix}-rule`,
              exposure: exp(
                `${prefix}-rule-link-copy`,
                `${ledger.id}: apply the approved insurance rule`,
              ),
            },
          );
        }
      }
      const ids = [
        ...elements.map((item) => item.id),
        ...relationships.map((item) => item.id),
      ];
      const presentation: FamilyPresentation<"C02"> = {
        family: "C02",
        activityId,
        scenarioId: activityId.replace("-A", "-S"),
        modelId: "C02-static-source-fixture",
        revision: 0,
        position: "ACTIVE",
        sourceId: "P9B-MDL-C02-01",
        elements,
        relationships,
        readingOrder: ids,
        controls: [],
        focus: {
          targets: ids,
          explanation: exp(
            "C02-assessment-rule-access",
            "Use each payroll's approved rules. Determine the deductions, total deductions and net pay independently.",
          ),
          reinforcement: [],
        },
      };
      const input = (value: FamilyPresentation<"C02">): FrameInput => ({
        context: actor.getSnapshot().context,
        phase: "ACTIVE",
        support: "NONE",
        definition,
        ports,
        content: {
          references: [],
          modelFacts: [],
          derivedFacts: [],
          responseContract: {
            id: "C02-static-response",
            text: "Independent payroll calculation",
          },
          familyProjection: createFamilyProjectionAuthority({
            family: "C02",
            activityId,
            scenarioId: presentation.scenarioId,
            modelId: presentation.modelId,
            project: () => value,
          }),
        },
      });
      const frame = projectSemanticActivityFrame(input(presentation));
      expect(frame.familyModel!.controls).toEqual([]);
      expect(
        frame
          .familyModel!.elements.filter((item) => item.role === "GROSS")
          .map((item) => item.quantity),
      ).toEqual(
        activityId === "C02-A03"
          ? [
              {
                status: "KNOWN",
                amount: "24000",
                unit: "PHP",
                provenance: "Final C02 C02-A03 established input",
              },
            ]
          : [
              {
                status: "KNOWN",
                amount: "28000",
                unit: "PHP",
                provenance: "Final C02 C02-A04 established input",
              },
              {
                status: "KNOWN",
                amount: "28000",
                unit: "PHP",
                provenance: "Final C02 C02-A04 established input",
              },
            ],
      );
      expect(
        frame.familyModel!.elements.some((item) =>
          ["DEDUCTION_CONSEQUENCE", "TOTAL_DEDUCTIONS", "NET"].includes(
            item.role,
          ),
        ),
      ).toBe(false);
      if (activityId === "C02-A03")
        expect(
          frame.familyModel!.elements.some((item) => item.role === "SSS"),
        ).toBe(false);
      else
        expect(
          frame
            .familyModel!.elements.filter((item) => item.role === "GROSS")
            .map((item) => item.id),
        ).toEqual(["C02-Job-A-gross", "C02-Job-B-gross"]);
      // Malformed nested providers must be rejected, even in currently hidden data.
      // Final C02 §§36/38/43/44/50/55/56: source-conformance boundary,
      // not universal runtime authentication of arbitrary provider callbacks.
      const auditAssessment = (candidate: FamilyPresentation<"C02">) => {
        expect(candidate.position).toBe("ACTIVE");
        expect(candidate.controls).toEqual([]);
        expect(candidate.focus.explanation).toEqual(
          exp(
            "C02-assessment-rule-access",
            "Use each payroll's approved rules. Determine the deductions, total deductions and net pay independently.",
          ),
        );
        expect(candidate.focus.reinforcement).toEqual([]);
        const expectedIds: string[] = [];
        const expectedRelations: string[] = [];
        for (const ledger of ledgers) {
          const prefix = `C02-${ledger.id}`;
          expectedIds.push(`${prefix}-gross`);
          expect(
            candidate.elements.find((item) => item.id === `${prefix}-gross`),
          ).toEqual({
            id: `${prefix}-gross`,
            role: "GROSS",
            state: "FIXED",
            quantity: {
              status: "KNOWN",
              amount: activityId === "C02-A03" ? "24000" : "28000",
              unit: "PHP",
              provenance: `Final C02 ${activityId} established input`,
            },
            exposure: exp(
              `${prefix}-gross-copy`,
              `${ledger.id}: established gross income ${activityId === "C02-A03" ? "24000" : "28000"}`,
            ),
          });
          for (const row of [
            ledger.insurance,
            "PHILHEALTH",
            "PAG_IBIG",
            "BIR",
          ] as const) {
            expectedIds.push(`${prefix}-${row}`);
            expect(
              candidate.elements.find((item) => item.id === `${prefix}-${row}`),
            ).toEqual({
              id: `${prefix}-${row}`,
              role: row,
              state: "FIXED",
              exposure: exp(`${prefix}-${row}-label`, `${ledger.id}: ${row}`),
            });
            if (row !== ledger.insurance) continue;
            expectedIds.push(`${prefix}-basis`, `${prefix}-rule`);
            expect(
              candidate.elements.find((item) => item.id === `${prefix}-basis`),
            ).toEqual({
              id: `${prefix}-basis`,
              role: "CONTROLLING_BASIS",
              state: "FIXED",
              exposure: exp(
                `${prefix}-basis-copy`,
                row === "GSIS"
                  ? "Actual monthly salary 24000"
                  : "Use the current approved SSS table/reference",
              ),
            });
            expect(
              candidate.elements.find((item) => item.id === `${prefix}-rule`),
            ).toEqual({
              id: `${prefix}-rule`,
              role: "DEDUCTION_RULE",
              state: "FIXED",
              exposure: exp(
                `${prefix}-rule-copy`,
                row === "GSIS"
                  ? "9% of actual monthly salary"
                  : "Approved statutory MSC schedule",
              ),
            });
            expectedRelations.push(
              `${prefix}-basis-link`,
              `${prefix}-rule-link`,
            );
          }
        }
        expect(candidate.elements.map((item) => item.id)).toEqual(expectedIds);
        expect(candidate.relationships.map((item) => item.id)).toEqual(
          expectedRelations,
        );
        for (const ledger of ledgers) {
          const prefix = `C02-${ledger.id}`;
          expect(
            candidate.relationships.find(
              (item) => item.id === `${prefix}-basis-link`,
            ),
          ).toEqual({
            id: `${prefix}-basis-link`,
            kind: "ROW_BASIS",
            from: [`${prefix}-${ledger.insurance}`],
            to: `${prefix}-basis`,
            exposure: exp(
              `${prefix}-basis-link-copy`,
              `${ledger.id}: insurance row uses its own controlling basis`,
            ),
          });
          expect(
            candidate.relationships.find(
              (item) => item.id === `${prefix}-rule-link`,
            ),
          ).toEqual({
            id: `${prefix}-rule-link`,
            kind: "BASIS_RULE",
            from: [`${prefix}-basis`],
            to: `${prefix}-rule`,
            exposure: exp(
              `${prefix}-rule-link-copy`,
              `${ledger.id}: apply the approved insurance rule`,
            ),
          });
        }
        expect(candidate.readingOrder).toEqual([
          ...expectedIds,
          ...expectedRelations,
        ]);
        expect(candidate.focus.targets).toEqual([
          ...expectedIds,
          ...expectedRelations,
        ]);
      };
      auditAssessment(presentation);
      const leak = exp(
        "source-looking-public-copy",
        activityId === "C02-A03"
          ? "Net pay is 21,008.95; BIR 31.05"
          : "The answer is SSS 1,400.00",
      );
      const laundering: FamilyPresentation<"C02">[] = [
        {
          ...presentation,
          elements: presentation.elements.map((item, index) =>
            index ? item : { ...item, exposure: leak },
          ),
        },
        {
          ...presentation,
          elements: presentation.elements.map((item, index) =>
            index
              ? item
              : {
                  ...item,
                  quantity: {
                    status: "KNOWN",
                    amount: "21008.95",
                    unit: "PHP",
                    provenance: "source-looking",
                  },
                },
          ),
        },
        {
          ...presentation,
          relationships: presentation.relationships.map((item, index) =>
            index ? item : { ...item, exposure: leak },
          ),
        },
        {
          ...presentation,
          focus: { ...presentation.focus, explanation: leak },
        },
        {
          ...presentation,
          focus: { ...presentation.focus, reinforcement: [leak] },
        },
        {
          ...presentation,
          focus: {
            ...presentation.focus,
            targets: [...presentation.focus.targets, leak.content.text],
          },
        },
        {
          ...presentation,
          readingOrder: [...presentation.readingOrder, leak.content.text],
        },
      ];
      for (const candidate of laundering)
        expect(() => auditAssessment(candidate)).toThrow();
      const malformed: unknown[] = [
        {
          ...presentation,
          elements: presentation.elements.map((item, index) =>
            index
              ? item
              : {
                  ...item,
                  quantity: {
                    status: "KNOWN",
                    amount: "24000",
                    unit: "PHP",
                    provenance: { provider: "unsafe raw object" },
                  },
                },
          ),
        },
        {
          ...presentation,
          focus: {
            ...presentation.focus,
            reinforcement: [
              {
                content: {
                  id: "secret",
                  text: "hidden",
                  providerInternals: true,
                },
                phases: ["CONFIRMATION"],
                timing: "CURRENT_FEEDBACK",
              },
            ],
          },
        },
        {
          ...presentation,
          readingOrder: Object.assign([...presentation.readingOrder], {
            metadata: "unsafe",
          }),
        },
        {
          ...presentation,
          focus: {
            ...presentation.focus,
            explanation: {
              ...presentation.focus.explanation,
              revealRevision: 0,
            },
          },
        },
      ];
      for (const candidate of malformed)
        expect(() =>
          projectSemanticActivityFrame(
            input(candidate as FamilyPresentation<"C02">),
          ),
        ).toThrow();
      actor.stop();
    },
  );
});

describe("D3 semantic commands validate the recipient, not UI issuance (D063/S2)", () => {
  it.each([false, true])(
    "isolates matching C01 actors, shared-machine=%s, and rejects recipient-illegal commands",
    (shared) => {
      const include: ModelIntent = {
        family: "C01",
        operation: "INCLUDE_EARNING",
        earning: "REGULAR_PAY",
        period: "MAY",
      };
      const definition: ActivityDefinition = {
        activityId: "C01-A02",
        edges: {
          ENTRY: { CONTINUE: "EXP-02" },
          "EXP-02": { CONTINUE: "ACTIVE" },
        },
        support: {},
        modelIntents: {
          family: "C01",
          scenarioId: "C01-S02",
          modelId: "C01-recipient-fixture",
          permissions: [{ position: "EXP-02", intent: include }],
        },
      };
      const ports: ActivityPorts = {
        ready: () => false,
        evaluate: () => ({ outcome: "RECONSIDERATION", diagnostic: null }),
        completionEligible: () => false,
        sourceReviewAvailable: () => false,
        informationNeeded: () => false,
        informationReturn: () => false,
      };
      const initial = Object.freeze({ included: false });
      const included = Object.freeze({ included: true });
      const adapter = {
        initialize: () => initial,
        transition: (state: object) => (state === initial ? included : null),
      };
      const machine = createActivityMachine(
        definition,
        ports,
        undefined,
        undefined,
        adapter,
      );
      const a = createActor(machine).start();
      const b = createActor(
        shared
          ? machine
          : createActivityMachine(
              definition,
              ports,
              undefined,
              undefined,
              adapter,
            ),
      ).start();
      a.send({ type: "CONTINUE" });
      b.send({ type: "CONTINUE" });
      const command = {
        type: "MODEL_INTENT" as const,
        activityId: "C01-A02" as const,
        scenarioId: "C01-S02",
        modelId: "C01-recipient-fixture",
        position: "EXP-02" as const,
        revision: 0,
        intent: include,
      };
      const beforeA = a.getSnapshot().context;
      const beforeB = b.getSnapshot().context;
      for (const patch of [
        { activityId: "C01-A01" },
        { scenarioId: "C01-S01" },
        { modelId: "wrong" },
        { revision: 1 },
        { position: "ACTIVE" },
        { intent: { ...include, earning: "TRANSPORTATION_ALLOWANCE" } },
        { intent: { ...include, operation: "REMOVE_EARNING" } },
        { intent: { ...include, earning: "invented" } },
        { actorStamp: "not-authorized" },
      ]) {
        b.send({ ...command, ...patch } as never);
        expect(b.getSnapshot().context).toBe(beforeB);
        expect(a.getSnapshot().context).toBe(beforeA);
      }
      // The exact same semantic command is legal in both matching actors.
      // Origin in A's UI is deliberately NOT treated as an unforgeable stamp.
      b.send(command);
      expect(b.getSnapshot().context.intentModel?.revision).toBe(1);
      expect(a.getSnapshot().context).toBe(beforeA);
      a.send(command);
      expect(a.getSnapshot().context.intentModel?.revision).toBe(1);
      const afterB = b.getSnapshot().context;
      b.send(command);
      expect(b.getSnapshot().context).toBe(afterB);
      b.send({ type: "CONTINUE" });
      const activeB = b.getSnapshot().context;
      b.send({ ...command, revision: 1, position: "ACTIVE" });
      expect(b.getSnapshot().context).toBe(activeB);
      expect(a.getSnapshot().context.position).toBe("EXP-02");
      a.stop();
      b.stop();
    },
  );
});

const id = "C04-A03" as const;
const response = {
  kind: "SINGLE_SELECTION",
  selectionId: "learner-choice",
} as const;
const definition: ActivityDefinition = {
  activityId: id,
  edges: { ENTRY: { CONTINUE: "ACTIVE" }, ACTIVE: {}, INFO_NEEDED: {} },
  support: {
    ACTIVE: ["REVIEW"],
    CONFIRMATION: ["REVIEW"],
    RECONSIDERATION: ["REVIEW"],
    COMPLETE: [],
  },
};
const ports: ActivityPorts = {
  ready: () => true,
  evaluate: () => ({ outcome: "CONFIRMED", diagnostic: null }),
  completionEligible: () => true,
  sourceReviewAvailable: () => false,
  informationNeeded: () => false,
  informationReturn: () => false,
};
const secret = "SECRET_CORRECT_MINUS_TEN_PERCENT";
const content: FrameContent = {
  responseContract: { id: "choice", text: "Select a direction" },
  references: [
    {
      content: { id: "prompt", text: "Original and New" },
      phases: ["ACTIVE", "RECONSIDERATION", "CONFIRMATION"],
      timing: "PUBLIC",
    },
  ],
  modelFacts: [
    {
      content: { id: "original", text: "Original 30000" },
      phases: ["ACTIVE"],
      timing: "PUBLIC",
    },
  ],
  derivedFacts: [
    {
      content: { id: "answer", text: secret, metadata: { secret } } as never,
      phases: ["ACTIVE", "CONFIRMATION", "RECONSIDERATION"],
      timing: "EXPLICIT_REVEAL",
      revealRevision: 3,
    },
    {
      content: { id: "other", text: "OTHER_SECRET" },
      phases: ["CONFIRMATION", "RECONSIDERATION"],
      timing: "EXPLICIT_REVEAL",
      revealRevision: 99,
    },
  ],
  feedback: {
    outcome: "CONFIRMED",
    revision: 3,
    content: { id: "feedback", text: "Consider the relationship" },
  },
  review: {
    receivingActivityId: id,
    invokingPhase: "ACTIVE",
    relationships: [{ id: "principle", text: "Original is the reference" }],
  },
};
function input(
  overrides: Partial<ActivityContext> = {},
  phase: ActivityContext["position"] = "ACTIVE",
  support: FrameInput["support"] = "NONE",
  source: FrameContent = content,
): FrameInput {
  return {
    definition,
    ports,
    content: source,
    phase,
    support,
    context: {
      activityId: id,
      position: phase,
      origin: support === "NONE" ? null : phase,
      infoOrigin: null,
      response,
      checkedResponse: null,
      responseRevision: 3,
      hasChecked: false,
      checkedRevision: null,
      feedbackRevision: null,
      evaluation: null,
      ...overrides,
    },
  };
}
describe("synthetic semantic exposure enforcement", () => {
  it("omits model controls on absent or invalid evidence and rejects unsafe option labels", () => {
    const base = input();
    const policy: ActivityDefinition = {
      ...definition,
      modelSelection: {
        modelId: "synthetic",
        scenarioId: "C04-S03",
        initialSelectionId: "A",
        selectionIds: ["A", "B"],
        allowedSelections: { ACTIVE: ["A", "B"] },
      },
    };
    const source: FrameContent = {
      ...content,
      modelSelectionOptions: [
        { id: "A", text: "A" },
        { id: "B", text: "B" },
      ],
    };
    const valid: FrameInput = {
      ...base,
      definition: policy,
      content: source,
      context: {
        ...base.context,
        model: {
          modelId: "synthetic",
          revision: 0,
          value: { selectionId: "A", state: Object.freeze({ private: true }) },
        },
      },
    };
    expect(
      projectSemanticActivityFrame({ ...valid, context: base.context })
        .modelSelectionControl,
    ).toBeUndefined();
    expect(
      projectSemanticActivityFrame({
        ...valid,
        context: {
          ...valid.context,
          model: { ...valid.context.model!, modelId: "wrong" },
        },
      }).modelSelectionControl,
    ).toBeUndefined();
    expect(
      projectSemanticActivityFrame({
        ...valid,
        context: {
          ...valid.context,
          model: { ...valid.context.model!, revision: Number.MAX_SAFE_INTEGER },
        },
      }).modelSelectionControl,
    ).toBeUndefined();
    expect(
      projectSemanticActivityFrame({ ...valid, content }).modelSelectionControl,
    ).toBeUndefined();
    expect(() =>
      projectSemanticActivityFrame({
        ...valid,
        content: {
          ...source,
          modelSelectionOptions: [
            { id: "A", text: "A", correctId: "hidden" } as never,
            { id: "B", text: "B" },
          ],
        },
      }),
    ).toThrow("Invalid model selection labels");
    expect(projectSemanticActivityFrame(base)).not.toHaveProperty(
      "modelSelectionControl",
    );
  });
  it.each([
    ["ENTRY", []],
    ["EXP-01", []],
    ["EXP-02", ["A"]],
    ["EXP-03", ["B"]],
    ["EXP-04", []],
    ["EXP-05", []],
    ["ACTIVE", ["A", "B"]],
    ["REVISION", ["A", "B"]],
    ["CONFIRMATION", []],
    ["RECONSIDERATION", []],
    ["COMPLETE", []],
    ["INFO_NEEDED", []],
  ] as const)(
    "projects safe synthetic model options at %s without relabelling facts",
    (phase, expected) => {
      const base = input({}, phase);
      const modelDefinition: ActivityDefinition = {
        ...definition,
        modelSelection: {
          modelId: "synthetic",
          scenarioId: "C04-S03",
          initialSelectionId: "A",
          selectionIds: ["A", "B"],
          allowedSelections: {
            "EXP-02": ["A"],
            "EXP-03": ["B"],
            ACTIVE: ["A", "B"],
            REVISION: ["A", "B"],
          },
        },
      };
      const source: FrameContent = {
        ...content,
        modelSelectionOptions: [
          { id: "A", text: "Synthetic A" },
          { id: "B", text: "Synthetic B" },
        ],
        modelFacts: [
          {
            content: { id: "focus-A", text: "Authored A focus" },
            phases: ["EXP-02"],
            timing: "PUBLIC",
          },
        ],
      };
      const withModel: FrameInput = {
        ...base,
        definition: modelDefinition,
        content: source,
        context: {
          ...base.context,
          model: {
            modelId: "synthetic",
            revision: 2,
            value: {
              selectionId: "B",
              state: Object.freeze({
                privateTruth: "PRIVATE_ISSUANCE",
                correctId: "SECRET",
              }),
            },
          },
        },
      };
      const frame = projectSemanticActivityFrame(withModel);
      expect(
        frame.modelSelectionControl?.options.map((item) => item.id) ?? [],
      ).toEqual(expected);
      expect(frame.allowedLearnerIntents.includes("SELECT_MODEL_CHILD")).toBe(
        expected.length > 0,
      );
      if (expected.length)
        expect(frame.modelSelectionControl).toMatchObject({
          revision: 2,
          selectedId: "B",
          position: phase,
        });
      if (phase === "EXP-02")
        expect(frame.exposedModelFacts).toEqual([
          { id: "focus-A", text: "Authored A focus" },
        ]);
      expect(JSON.stringify(frame)).not.toMatch(
        /PRIVATE_ISSUANCE|correctId|initialize|"state"/,
      );
      const supported = projectSemanticActivityFrame({
        ...withModel,
        support: "REVIEW",
        context: { ...withModel.context, origin: phase },
      });
      expect(supported.modelSelectionControl).toBeUndefined();
      expect(supported.allowedLearnerIntents).not.toContain(
        "SELECT_MODEL_CHILD",
      );
    },
  );
  it.each(["CONFIRMED", "RECONSIDERATION"] as const)(
    "projects synthetic staged controls and acknowledged terminal teaching for %s without hidden metadata",
    (outcome) => {
      const policy: ActivityDefinition = {
        activityId: "C04-A04",
        edges: {
          ENTRY: { CONTINUE: "ACTIVE" },
          CONFIRMATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" },
          RECONSIDERATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" },
        },
        support: {
          ACTIVE: ["REVIEW"],
          POST_CONFIRMATION_EXPLANATION: ["REVIEW"],
        },
        responseStages: {
          contractId: "synthetic-staged",
          version: 1,
          scenarioId: "C04-S04",
          primaryFields: [
            {
              key: "quantity",
              acceptedKinds: ["EXACT_QUANTITY"],
              quantityKind: "MONETARY_AMOUNT",
              unit: "PHP",
              basis: null,
            },
          ],
          reasoningField: "reason",
          optionIds: ["one", "two"],
        },
        terminalTeaching: { outcomes: "BOTH", contentId: "synthetic-teaching" },
      };
      const dependencies: ActivityPorts = {
        ...ports,
        evaluate: () => ({
          outcome,
          diagnostic: outcome === "CONFIRMED" ? null : "RECONSIDER_UNDEFINED",
        }),
      };
      const a = createActor(
        createActivityMachine(policy, dependencies),
      ).start();
      const source: FrameContent = {
        responseContract: {
          id: "synthetic-staged",
          text: "Enter your response",
        },
        modelFacts: [],
        derivedFacts: [],
        references: [
          {
            content: {
              id: "synthetic-teaching",
              text: "HIDDEN_TERMINAL_TRUTH",
            },
            phases: ["ACTIVE", "POST_CONFIRMATION_EXPLANATION"],
            timing: "PUBLIC",
          },
        ],
        responseControls: [
          {
            activityId: "C04-A04",
            contractId: "synthetic-staged",
            version: 1,
            stage: "PRIMARY",
            controls: [{ role: "quantity", acceptedKinds: ["EXACT_QUANTITY"] }],
          },
          {
            activityId: "C04-A04",
            contractId: "synthetic-staged",
            version: 1,
            stage: "REASONING",
            controls: [
              {
                role: "reason",
                acceptedKinds: ["SINGLE_SELECTION"],
                options: [
                  { id: "one", text: "SYNTHETIC_REASON_ONE" },
                  { id: "two", text: "SYNTHETIC_REASON_TWO" },
                ],
              },
            ],
          },
        ],
      };
      const frame = (content = source) =>
        projectSemanticActivityFrame({
          definition: policy,
          ports: dependencies,
          content,
          context: a.getSnapshot().context,
          phase: a.getSnapshot().context.position,
          support: a.getSnapshot().context.origin ? "REVIEW" : "NONE",
        });
      a.send({ type: "CONTINUE" });
      expect(frame().responseStage).toBe("PRIMARY");
      expect(frame().responseControls?.map((control) => control.role)).toEqual([
        "quantity",
      ]);
      expect(JSON.stringify(frame())).not.toMatch(
        /SYNTHETIC_REASON|HIDDEN_TERMINAL_TRUTH|correctId|primaryCommitment/,
      );
      expect(frame().allowedLearnerIntents).not.toContain(
        "COMMIT_PRIMARY_RESPONSE",
      );
      const primary: LearnerResponse = {
        kind: "COMPOSITE",
        parts: [
          {
            key: "quantity",
            response: {
              kind: "EXACT_QUANTITY",
              value: quantity(
                ExactDecimal.from("7"),
                "MONETARY_AMOUNT",
                "PHP",
                null,
              ),
            },
          },
        ],
      };
      a.send({ type: "RESPONSE_CHANGED", response: primary });
      expect(frame().allowedLearnerIntents).toContain(
        "COMMIT_PRIMARY_RESPONSE",
      );
      expect(frame().allowedLearnerIntents).not.toContain("CHECK_RESPONSE");
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(frame().responseControls).toEqual([]);
      expect(frame().allowedLearnerIntents).toEqual(["CLOSE_SUPPORT"]);
      a.send({ type: "CLOSE_SUPPORT" });
      a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
      expect(frame().responseStage).toBe("REASONING");
      expect(frame().responseControls?.map((control) => control.role)).toEqual([
        "reason",
      ]);
      expect(frame().allowedLearnerIntents).toContain("RETURN_TO_PRIMARY");
      expect(frame().allowedLearnerIntents).not.toContain("CHECK_RESPONSE");
      const bad = structuredClone(source);
      Object.assign(bad.responseControls![1]!.controls[0]!, {
        correctId: "one",
      });
      expect(() => frame(bad)).toThrow();
      const wrongVersion = structuredClone(source);
      Object.assign(wrongVersion.responseControls![1]!, { version: 2 });
      expect(() => frame(wrongVersion)).toThrow();
      const forged = {
        ...a.getSnapshot().context,
        currentPrimaryCommitment: {
          ...a.getSnapshot().context.currentPrimaryCommitment!,
          version: 99,
        },
      };
      expect(() =>
        projectSemanticActivityFrame({
          definition: policy,
          ports: dependencies,
          content: source,
          context: forged,
          phase: "ACTIVE",
          support: "NONE",
        }),
      ).toThrow();
      a.send({
        type: "RESPONSE_CHANGED",
        response: {
          kind: "COMPOSITE",
          parts: [
            ...(primary.kind === "COMPOSITE" ? primary.parts : []),
            {
              key: "reason",
              response: { kind: "SINGLE_SELECTION", selectionId: "two" },
            },
          ],
        },
      });
      expect(frame().allowedLearnerIntents).toContain("CHECK_RESPONSE");
      a.send({ type: "CHECK_RESPONSE" });
      expect(frame().allowedLearnerIntents).not.toContain("CONTINUE");
      const revision = a.getSnapshot().context.responseRevision;
      a.send({ type: "FEEDBACK_DELIVERED", revision });
      expect(frame().allowedLearnerIntents).toContain("CONTINUE");
      expect(frame().completionActionAvailability).toBe(false);
      a.send({ type: "CONTINUE" });
      const deliveredSource: FrameContent = {
        ...source,
        references: [
          {
            content: {
              id: "synthetic-teaching",
              text: "HIDDEN_TERMINAL_TRUTH",
            },
            phases: ["POST_CONFIRMATION_EXPLANATION"],
            timing: "CURRENT_FEEDBACK",
          },
        ],
        feedback: {
          outcome,
          revision,
          content: {
            id: "synthetic-feedback",
            text: "Delivered current feedback",
          },
        },
        review: {
          receivingActivityId: "C04-A04",
          invokingPhase: "POST_CONFIRMATION_EXPLANATION",
          relationships: [
            { id: "principle", text: "Approved synthetic relationship" },
          ],
        },
      };
      expect(frame(deliveredSource).contentReferences).toEqual([
        { id: "synthetic-teaching", text: "HIDDEN_TERMINAL_TRUTH" },
      ]);
      expect(frame(deliveredSource).feedbackState?.outcome).toBe(outcome);
      expect(frame(deliveredSource).completionActionAvailability).toBe(false);
      expect(a.getSnapshot().context.terminalTeachingRevision).toBeNull();
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(frame(deliveredSource).review?.returnTo).toBe(
        "POST_CONFIRMATION_EXPLANATION",
      );
      expect(frame(deliveredSource).responseControls).toEqual([]);
      a.send({ type: "CLOSE_SUPPORT" });
      // Explicit test simulation of trusted delivery, never projector side effect.
      a.send({
        type: "TERMINAL_TEACHING_DELIVERED",
        revision,
        contentId: "synthetic-teaching",
      });
      expect(frame(deliveredSource).allowedLearnerIntents).toContain(
        "FINISH_ACTIVITY",
      );
      expect(JSON.stringify(frame(deliveredSource))).not.toMatch(
        /correctId|Commitment|diagnostic|"magnitude"/,
      );
      const stale = { ...a.getSnapshot().context, feedbackRevision: null };
      expect(() =>
        projectSemanticActivityFrame({
          definition: policy,
          ports: dependencies,
          content: deliveredSource,
          context: stale,
          phase: "POST_CONFIRMATION_EXPLANATION",
          support: "NONE",
        }),
      ).toThrow();
      a.stop();
    },
  );
  it("projects only current confirmed post-confirmation continuation and phase-gated synthetic content", () => {
    const route: ActivityDefinition = {
      ...definition,
      edges: {
        ...definition.edges,
        CONFIRMATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" },
      },
      support: {
        ...definition.support,
        POST_CONFIRMATION_EXPLANATION: ["REVIEW"],
      },
    };
    const explanation = "SYNTHETIC_UNDEFINED_RESULT_EXPLANATION";
    const source: FrameContent = {
      ...content,
      references: [
        ...content.references,
        {
          content: { id: "c04/S04/undefined-result", text: explanation },
          phases: ["POST_CONFIRMATION_EXPLANATION"],
          timing: "CURRENT_FEEDBACK",
        },
      ],
      derivedFacts: [
        {
          content: { id: "synthetic-answer", text: "SYNTHETIC_BOUNDARY" },
          phases: ["POST_CONFIRMATION_EXPLANATION"],
          timing: "CURRENT_FEEDBACK",
        },
        {
          content: { id: "unrelated", text: "UNRELATED_SECRET" },
          phases: ["ACTIVE"],
          timing: "PUBLIC",
        },
      ],
      review: {
        receivingActivityId: id,
        invokingPhase: "POST_CONFIRMATION_EXPLANATION",
        relationships: [
          { id: "synthetic-relation", text: "Synthetic reference" },
        ],
      },
    };
    const checked: Partial<ActivityContext> = {
      hasChecked: true,
      checkedRevision: 3,
      feedbackRevision: 3,
      evaluation: { outcome: "CONFIRMED", diagnostic: "PRIVATE_DIAGNOSTIC" },
    };
    const frame = (
      phase: ActivityContext["position"],
      evidence = checked,
      support: FrameInput["support"] = "NONE",
      selected = route,
    ) =>
      projectSemanticActivityFrame({
        ...input(evidence, phase, support, source),
        definition: selected,
      });
    const before = frame("ACTIVE", {});
    const confirmation = frame("CONFIRMATION");
    expect(before.allowedLearnerIntents).not.toContain("CONTINUE");
    expect(confirmation.allowedLearnerIntents).toContain("CONTINUE");
    expect(confirmation.allowedLearnerIntents).not.toContain("FINISH_ACTIVITY");
    for (const result of [
      before,
      confirmation,
      frame("CONFIRMATION", { ...checked, feedbackRevision: null }),
    ]) {
      expect(JSON.stringify(result)).not.toContain(explanation);
      expect(JSON.stringify(result)).not.toContain("SYNTHETIC_BOUNDARY");
    }
    expect(
      frame("CONFIRMATION", { ...checked, feedbackRevision: null })
        .allowedLearnerIntents,
    ).not.toContain("CONTINUE");
    for (const evidence of [
      { ...checked, checkedRevision: 2 },
      { ...checked, responseRevision: 4 },
      { ...checked, evaluation: null },
      { ...checked, hasChecked: false },
    ]) {
      expect(
        frame("CONFIRMATION", evidence).allowedLearnerIntents,
      ).not.toContain("CONTINUE");
      expect(
        frame("POST_CONFIRMATION_EXPLANATION", evidence).contentReferences,
      ).toEqual([]);
    }
    const explained = frame("POST_CONFIRMATION_EXPLANATION");
    expect(explained.contentReferences).toContainEqual({
      id: "c04/S04/undefined-result",
      text: explanation,
    });
    expect(explained.allowedLearnerIntents).toContain("FINISH_ACTIVITY");
    expect(explained.allowedLearnerIntents).not.toContain("CONTINUE");
    expect(explained.reviewAvailability).toBe(true);
    expect(explained.sourceReviewAvailability).toBe(false);
    expect(JSON.stringify(explained)).not.toContain("UNRELATED_SECRET");
    expect(JSON.stringify(explained)).not.toContain("PRIVATE_DIAGNOSTIC");
    expect(explained).not.toHaveProperty("context");
    const stale = frame("POST_CONFIRMATION_EXPLANATION", {
      ...checked,
      feedbackRevision: null,
    });
    expect(stale.contentReferences).toEqual([]);
    expect(stale.exposedDerivedFacts).toEqual([]);
    expect(stale.completionActionAvailability).toBe(false);
    const review = frame("POST_CONFIRMATION_EXPLANATION", checked, "REVIEW");
    expect(review.stateId).toBe("REVIEW[POST_CONFIRMATION_EXPLANATION]");
    expect(review.review?.returnTo).toBe("POST_CONFIRMATION_EXPLANATION");
    expect(review.allowedLearnerIntents).toEqual(["CLOSE_SUPPORT"]);
    expect(
      frame("POST_CONFIRMATION_EXPLANATION", checked, "NONE", {
        ...route,
        support: { ACTIVE: ["REVIEW"] },
      }).reviewAvailability,
    ).toBe(false);
    expect(() =>
      frame("POST_CONFIRMATION_EXPLANATION", checked, "NONE", definition),
    ).toThrow();
    expect(source.references[1]?.content.text).toBe(explanation);
  });
  it("omits hidden answers, nested metadata, diagnostics and stale evidence before check and during support", () => {
    for (const data of [
      input(),
      input({ responseRevision: 5 }),
      input({}, "ACTIVE", "REVIEW"),
      input(
        {
          hasChecked: true,
          checkedRevision: 2,
          feedbackRevision: 2,
          evaluation: { outcome: "CONFIRMED", diagnostic: null },
        },
        "CONFIRMATION",
      ),
    ]) {
      const frame = projectSemanticActivityFrame(data);
      expect(JSON.stringify(frame)).not.toContain(secret);
      expect(JSON.stringify(frame)).not.toContain("OTHER_SECRET");
      expect(JSON.stringify(frame)).not.toContain("metadata");
      expect(frame.exposedDerivedFacts).toEqual([]);
      expect(frame).not.toHaveProperty("context");
      expect(frame).not.toHaveProperty("evaluation");
    }
  });
  it("checks first after repeated edits, rechecks only after actual check, finishes on both outcomes only with current feedback", () => {
    expect(
      projectSemanticActivityFrame(input()).allowedLearnerIntents,
    ).toContain("CHECK_RESPONSE");
    expect(
      projectSemanticActivityFrame(input()).allowedLearnerIntents,
    ).not.toContain("CHECK_AGAIN");
    expect(
      projectSemanticActivityFrame(input({ hasChecked: true }, "REVISION"))
        .allowedLearnerIntents,
    ).toContain("CHECK_AGAIN");
    for (const outcome of ["CONFIRMED", "RECONSIDERATION"] as const) {
      const phase =
        outcome === "CONFIRMED" ? "CONFIRMATION" : "RECONSIDERATION";
      const checked = input(
        {
          hasChecked: true,
          checkedRevision: 3,
          feedbackRevision: 3,
          evaluation: {
            outcome,
            diagnostic: outcome === "CONFIRMED" ? null : "PRIVATE_DIAGNOSTIC",
          },
        },
        phase,
      );
      const frame = projectSemanticActivityFrame(checked);
      expect(frame.completionActionAvailability).toBe(true);
      expect(frame.allowedLearnerIntents).toContain("FINISH_ACTIVITY");
      expect(JSON.stringify(frame)).not.toContain("PRIVATE_DIAGNOSTIC");
      expect(frame.exposedDerivedFacts).toEqual([
        { id: "answer", text: secret },
      ]);
      expect(JSON.stringify(frame)).not.toContain("OTHER_SECRET");
      expect(
        projectSemanticActivityFrame(
          input({ ...checked.context, feedbackRevision: null }, phase),
        ).completionActionAvailability,
      ).toBe(false);
      expect(
        projectSemanticActivityFrame(
          input({ ...checked.context, responseRevision: 4 }, phase),
        ).exposedDerivedFacts,
      ).toEqual([]);
    }
  });
  it("support blocks underlying actions; COMPLETE does not inherit ACTIVE Review", () => {
    const support = projectSemanticActivityFrame(input({}, "ACTIVE", "REVIEW"));
    expect(support.allowedLearnerIntents).toEqual(["CLOSE_SUPPORT"]);
    expect(support.review?.returnTo).toBe("ACTIVE");
    expect(
      projectSemanticActivityFrame(input({}, "COMPLETE")).reviewAvailability,
    ).toBe(false);
  });
  it("copies and freezes nested output, ignores injected extra properties and does not mutate inputs", () => {
    const frame = projectSemanticActivityFrame(input());
    expect(Object.isFrozen(frame)).toBe(true);
    expect(Object.isFrozen(frame.exposedModelFacts[0])).toBe(true);
    expect(Object.isFrozen(frame.allowedLearnerIntents)).toBe(true);
    expect(() =>
      Object.assign(frame.exposedModelFacts[0]!, { text: secret }),
    ).toThrow();
    expect(() =>
      (frame.allowedLearnerIntents as string[]).push("FINISH_ACTIVITY"),
    ).toThrow();
    expect(content.modelFacts[0]!.content.text).toBe("Original 30000");
    expect(() =>
      projectSemanticActivityFrame({
        ...input(),
        phase: "UNKNOWN" as "ACTIVE",
      }),
    ).toThrow("Invalid semantic projection input");
  });
});

// D4 fixture-only composition, NOT T071/T072 production binding or D5 issuer.
// Context ddc0bb26: final C02 §§13–23, 68–69; D054/S1–S2.
// Exact fixed copy: App f480888 src/study/competencies/c02/content.ts:10–37.
// Full explanation: final C02 §20, lines 4120–4122, no paraphrase.
const d4Texts: Readonly<Record<string, string>> = {
  "c02/S01/confirmation":
    "Confirmed. SSS is ₱600.00, PhilHealth is ₱302.50, Pag-IBIG is ₱200.00, and withholding tax is ₱0.00. Total deductions are ₱1,102.50, so net pay is ₱10,997.50.",
  "c02/S01/reconsider-payroll-role":
    "Check whether you are identifying gross income, one deduction, total deductions, or net pay. These are different payroll roles.",
  "c02/S01/reconsider-arithmetic":
    "Add the four employee deductions before subtracting the total from ₱12,100.00 gross income.",
  "c02/S01-F/scenario":
    "For this PhilHealth check, the employee's established monthly basic salary is ₱8,000.00. The approved PhilHealth minimum contribution basis is ₱10,000.00.",
  "c02/S01-F/task":
    "Identify the contribution basis that applies and determine the employee share at 2.5%.",
  "c02/S01-F/relationship-help":
    "Because ₱8,000.00 is below the approved ₱10,000.00 floor, use ₱10,000.00 as the contribution basis.",
  "c02/S01-F/confirmation":
    "Confirmed. The contribution basis is ₱10,000.00, so the employee share is ₱250.00.",
  "c02/S01-F/reconsider":
    "Do not calculate ₱8,000.00 × 2.5%. That gives ₱200.00 and ignores the approved PhilHealth floor.",
  "c02/S01-F/accessibility-summary":
    "Monthly basic salary ₱8,000.00. PhilHealth minimum contribution basis ₱10,000.00. Employee share at 2.5%: ₱250.00.",
  "C02-FLOOR-EXPLANATION":
    "A contribution rule may place a boundary on the basis used in its calculation. Here, the employee’s monthly basic salary is ₱8,000.00, but the approved PhilHealth rule uses a minimum contribution basis of ₱10,000.00.\n\nThat does not mean the employee suddenly earns ₱10,000.00. The employee’s salary remains ₱8,000.00. The ₱10,000.00 amount is the basis required by this contribution rule.",
};
function d4Fixture(): ExecutableActivityBinding {
  const text = (id: string) => ({ id, text: d4Texts[id]! });
  const definition: ActivityDefinition = {
    activityId: "C02-A01",
    edges: {
      ENTRY: { CONTINUE: "ACTIVE" },
      CONFIRMATION: { CONTINUE: "C02-S01-F" },
      RECONSIDERATION: { CONTINUE: "C02-S01-F" },
    },
    support: {
      ACTIVE: ["REVIEW"],
      CONFIRMATION: ["REVIEW"],
      RECONSIDERATION: ["REVIEW"],
    },
    embeddedFloor: {
      id: "C02-S01-F",
      activityId: "C02-A01",
      primaryScenarioId: "C02-S01",
      salary: "8000.00",
      minimumBasis: "10000.00",
      rate: "2.5%",
      scenario: text("c02/S01-F/scenario"),
      task: text("c02/S01-F/task"),
      help: text("c02/S01-F/relationship-help"),
      explanation: text("C02-FLOOR-EXPLANATION"),
      nonvisual: text("c02/S01-F/accessibility-summary"),
      mainFeedback: {
        confirmation: text("c02/S01/confirmation"),
        payrollRole: text("c02/S01/reconsider-payroll-role"),
        arithmetic: text("c02/S01/reconsider-arithmetic"),
      },
      choices: [
        {
          basis: "8000.00",
          share: "200.00",
          outcome: "RECONSIDERATION",
          feedback: text("c02/S01-F/reconsider"),
        },
        {
          basis: "10000.00",
          share: "250.00",
          outcome: "CONFIRMED",
          feedback: text("c02/S01-F/confirmation"),
        },
      ],
    },
  };
  // Canonical A01 task identifies payroll roles in the intentionally complete static ledger.
  // Role keys are fixture-local response transport, NOT new canonical option/content IDs.
  const expected = d4Anna();
  const ready = (response: LearnerResponse) =>
    response.kind === "COMPOSITE" &&
    response.parts.length === expected.parts.length &&
    response.parts.every(
      (p) =>
        expected.parts.some((e) => e.key === p.key) &&
        p.response.kind === "EXACT_QUANTITY" &&
        p.response.value.kind === "MONETARY_AMOUNT" &&
        p.response.value.unit === "PHP" &&
        p.response.value.basis === null,
    );
  return {
    activityId: "C02-A01",
    definition,
    ports: {
      ready,
      evaluate: (response) => {
        if (!ready(response) || response.kind !== "COMPOSITE")
          throw new TypeError("Not an Anna payroll-role response");
        const correct = response.parts.every((p) => {
          const target = expected.parts.find((e) => e.key === p.key)!.response;
          return (
            p.response.kind === "EXACT_QUANTITY" &&
            p.response.value.magnitude.equals(target.value.magnitude)
          );
        });
        return correct
          ? { outcome: "CONFIRMED", diagnostic: null }
          : {
              outcome: "RECONSIDERATION",
              diagnostic: "c02/S01/reconsider-payroll-role",
            };
      },
      completionEligible: (evidence) =>
        evidence.activityId === "C02-A01" &&
        evidence.evaluation !== null &&
        evidence.checkedRevision === evidence.responseRevision &&
        evidence.feedbackRevision === evidence.responseRevision,
      sourceReviewAvailable: () => false,
      informationNeeded: () => false,
      informationReturn: () => false,
    },
  };
}
function d4Anna(wrong = false) {
  const rows: readonly (readonly [string, string])[] = [
    ["gross", wrong ? "1102.50" : "12100.00"],
    ["SSS", "600.00"],
    ["PhilHealth", "302.50"],
    ["Pag-IBIG", "200.00"],
    ["withholding", "0.00"],
    ["total deductions", "1102.50"],
    ["net pay", "10997.50"],
  ];
  return {
    kind: "COMPOSITE" as const,
    parts: rows.map(([key, amount]) => ({
      key,
      response: {
        kind: "EXACT_QUANTITY" as const,
        value: quantity(
          ExactDecimal.from(amount),
          "MONETARY_AMOUNT",
          "PHP",
          null,
        ),
      },
    })),
  };
}
type D4Actor = ReturnType<typeof createActivityActor>;
function d4Frame(actor: D4Actor, binding: ExecutableActivityBinding) {
  const c = actor.getSnapshot().context;
  const feedback = c.evaluation
    ? c.evaluation.outcome === "CONFIRMED"
      ? binding.definition.embeddedFloor!.mainFeedback.confirmation
      : binding.definition.embeddedFloor!.mainFeedback.payrollRole
    : null;
  return projectSemanticActivityFrame({
    context: c,
    phase: c.position,
    support: c.origin === null ? "NONE" : "REVIEW",
    definition: binding.definition,
    ports: binding.ports,
    content: {
      references: [],
      modelFacts: [],
      derivedFacts: [],
      responseContract: {
        id: "c02/S01/task",
        text: "Identify the starting gross income, each individual deduction, total deductions, and Anna's final take-home pay.",
      },
      ...(feedback
        ? {
            feedback: {
              outcome: c.evaluation!.outcome,
              revision: c.responseRevision,
              content: feedback,
            },
          }
        : {}),
    },
  });
}
function d4Check(actor: D4Actor, wrong = false) {
  actor.send({ type: "CONTINUE" });
  actor.send({ type: "RESPONSE_CHANGED", response: d4Anna(wrong) });
  actor.send({ type: "CHECK_RESPONSE" });
}
// Test-controlled trusted presentation boundary: the complete exact feedback or
// local passage/consequence and nonvisual equivalent become available before ACK.
// This is headless semantic availability, NOT DOM/a11y/browser certification.
function d4Present(
  actor: D4Actor,
  binding: ExecutableActivityBinding,
  available = true,
) {
  const frame = d4Frame(actor, binding);
  const delivery = frame.c02Delivery;
  if (!delivery || !available) return false;
  const shown = delivery.passages.map((p) => ({ ...p }));
  const accessible = { ...delivery.nonvisual };
  expect(shown.every((p) => d4Texts[p.id] === p.text)).toBe(true);
  expect(d4Texts[accessible.id]).toBe(accessible.text);
  if (delivery.purpose === "MAIN_FEEDBACK")
    expect(frame.feedbackState?.content).toEqual(shown[0]);
  else {
    expect(frame.embeddedFloor!.consequence).not.toBeNull();
    expect(shown).toContainEqual(frame.embeddedFloor!.feedback);
    expect(shown).toContainEqual(frame.embeddedFloor!.explanation);
    expect(accessible).toEqual(frame.embeddedFloor!.nonvisual);
  }
  actor.send({
    type:
      delivery.purpose === "MAIN_FEEDBACK"
        ? "C02_MAIN_FEEDBACK_DELIVERED"
        : "C02_FLOOR_TEACHING_DELIVERED",
    capability: delivery.capability,
  });
  return true;
}
function d4Select(
  actor: D4Actor,
  binding: ExecutableActivityBinding,
  basis: "8000.00" | "10000.00",
) {
  const event = d4Frame(actor, binding).embeddedFloor!.controls.find(
    (e) => e.basis === basis,
  )!;
  expect(event).toBeDefined();
  actor.send(event);
}
function d4Unchanged(actor: D4Actor, event: unknown) {
  const before = actor.getSnapshot().context;
  actor.send(event as ActivityEvent);
  expect(actor.getSnapshot().context).toBe(before);
}

describe("D4 embedded Floor semantic projection and delivery parity", () => {
  const start = () => {
    const registry = new ActivityRegistry([d4Fixture()]);
    return {
      binding: registry.resolve("C02-A01"),
      actor: createActivityActor(registry, "C02-A01").start(),
    };
  };
  it.each([false, true])(
    "both branches expose only current main feedback then distinct bounded Floor controls: reconsideration=%s",
    (wrong) => {
      const { actor, binding } = start();
      let f = d4Frame(actor, binding);
      expect(f.embeddedFloor).toBeUndefined();
      expect(f.c02Delivery).toBeUndefined();
      d4Check(actor, wrong);
      f = d4Frame(actor, binding);
      expect(f.feedbackState?.content.text).toBe(
        d4Texts[
          wrong ? "c02/S01/reconsider-payroll-role" : "c02/S01/confirmation"
        ],
      );
      expect(f.c02Delivery!.passages).toEqual([f.feedbackState!.content]);
      expect(f.allowedLearnerIntents).not.toContain("CONTINUE");
      expect(f.allowedLearnerIntents.includes("REVISE")).toBe(wrong);
      expect(f.embeddedFloor).toBeUndefined();
      expect(f.contentReferences).toEqual([]);
      const before = actor.getSnapshot().context;
      d4Frame(actor, binding);
      d4Frame(actor, binding);
      expect(actor.getSnapshot().context).toBe(before);
      expect(before.feedbackRevision).toBeNull();
      d4Present(actor, binding);
      f = d4Frame(actor, binding);
      expect(f.c02Delivery).toBeUndefined();
      expect(f.allowedLearnerIntents).toContain("CONTINUE");
      expect(f.completionActionAvailability).toBe(false);
      actor.send({ type: "CONTINUE" });
      f = d4Frame(actor, binding);
      expect(f.stateId).toBe("C02-S01-F");
      expect(f.embeddedFloor!.id).toBe("C02-S01-F");
      expect(f.embeddedFloor!.selectedBasis).toBeNull();
      expect(f.embeddedFloor!.consequence).toBeNull();
      expect(f.embeddedFloor!.controls.map((c) => c.basis)).toEqual([
        "8000.00",
        "10000.00",
      ]);
      expect(f.embeddedFloor!.explanation.text).toBe(
        d4Texts["C02-FLOOR-EXPLANATION"],
      );
      expect(f.embeddedFloor!.nonvisual.text).toBe(
        d4Texts["c02/S01-F/accessibility-summary"],
      );
      expect(f.allowedLearnerIntents).not.toContain("PREVIOUS");
      expect(f.allowedLearnerIntents).not.toContain("OPEN_SUPPORT");
      expect(f.c02Delivery).toBeUndefined();
      for (const basis of ["8000.00", "10000.00"] as const) {
        const old = f.embeddedFloor!.controls.find((e) => e.basis === basis)!;
        actor.send(old);
        f = d4Frame(actor, binding);
        expect(f.embeddedFloor!.consequence?.share).toBe(
          basis === "8000.00" ? "200.00" : "250.00",
        );
        expect(f.embeddedFloor!.controls).toHaveLength(1);
        expect(f.completionActionAvailability).toBe(false);
        d4Unchanged(actor, old);
        d4Unchanged(actor, { type: "FINISH_ACTIVITY" });
        expect(f.c02Delivery!.passages.map((p) => p.id)).toEqual([
          "c02/S01-F/scenario",
          "c02/S01-F/task",
          "c02/S01-F/relationship-help",
          basis === "8000.00"
            ? "c02/S01-F/reconsider"
            : "c02/S01-F/confirmation",
          "C02-FLOOR-EXPLANATION",
        ]);
        expect(d4Present(actor, binding, false)).toBe(false);
        expect(
          actor.getSnapshot().context.c02Floor!.teachingRevision,
        ).toBeNull();
        d4Present(actor, binding);
        f = d4Frame(actor, binding);
        expect(f.c02Delivery).toBeUndefined();
        expect(f.completionActionAvailability).toBe(basis === "10000.00");
        expect(f.allowedLearnerIntents.includes("FINISH_ACTIVITY")).toBe(
          basis === "10000.00",
        );
      }
      actor.send({ type: "FINISH_ACTIVITY" });
      expect(d4Frame(actor, binding).stateId).toBe("COMPLETE");
      actor.stop();
    },
  );
  it("rejects detached state or replaced source and blocks overlay delivery without manufacturing completion", () => {
    const { actor, binding } = start();
    d4Check(actor, true);
    const context = actor.getSnapshot().context;
    const input = {
      context,
      phase: context.position,
      support: "NONE" as const,
      definition: binding.definition,
      ports: binding.ports,
      content: {
        references: [],
        modelFacts: [],
        derivedFacts: [],
        responseContract: {
          id: "c02/S01/task",
          text: "Identify the starting gross income, each individual deduction, total deductions, and Anna's final take-home pay.",
        },
      },
    };
    expect(() =>
      projectSemanticActivityFrame({ ...input, context: { ...context } }),
    ).toThrow("C02");
    const definition = structuredClone(binding.definition);
    const changed = {
      ...definition,
      embeddedFloor: {
        ...definition.embeddedFloor!,
        explanation: { id: "C02-FLOOR-EXPLANATION", text: "wrong" },
      },
    };
    expect(() =>
      projectSemanticActivityFrame({ ...input, definition: changed }),
    ).toThrow("C02");
    actor.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    const overlay = d4Frame(actor, binding);
    expect(overlay.c02Delivery).toBeUndefined();
    expect(overlay.completionActionAvailability).toBe(false);
    expect(overlay.allowedLearnerIntents).toEqual(["CLOSE_SUPPORT"]);
    actor.send({ type: "CLOSE_SUPPORT" });
    expect(actor.getSnapshot().context.feedbackRevision).toBeNull();
    actor.stop();
  });
  it("pure fixed consequence mathematics and source IDs are independent of prose parsing", () => {
    const { actor, binding } = start();
    const floor = binding.definition.embeddedFloor!;
    expect(
      ExactDecimal.from(floor.salary)
        .multiply(ExactDecimal.from("0.025"))
        .toString(),
    ).toBe("200");
    expect(
      ExactDecimal.from(floor.minimumBasis)
        .multiply(ExactDecimal.from("0.025"))
        .toString(),
    ).toBe("250");
    expect(floor.scenario.id).toBe("c02/S01-F/scenario");
    d4Check(actor);
    d4Present(actor, binding);
    actor.send({ type: "CONTINUE" });
    d4Select(actor, binding, "10000.00");
    const descriptor = d4Frame(actor, binding).c02Delivery!;
    expect(descriptor.scenarioId).toBe("C02-S01-F");
    expect(descriptor.localRevision).toBe(1);
    expect(descriptor.position).toBe("C02-S01-F");
    expect(descriptor.responseRevision).toBe(1);
    actor.stop();
  });
});

describe("D4 Floor relative exposure", () => {
  it("blocks source Floor text smuggled as PUBLIC references facts or derived facts before local entry", () => {
    const registry = new ActivityRegistry([d4Fixture()]);
    const binding = registry.resolve("C02-A01");
    const actor = createActivityActor(registry, "C02-A01").start();
    actor.send({ type: "CONTINUE" });
    const context = actor.getSnapshot().context;
    const floor = binding.definition.embeddedFloor!;
    const passages = [
      floor.scenario,
      floor.task,
      floor.help,
      floor.explanation,
      floor.nonvisual,
      ...floor.choices.map((c) => c.feedback),
    ];
    const entries = passages
      .flatMap((p) => [p, { id: `public-${p.id}`, text: p.text }])
      .map((content) => ({
        content,
        phases: ["ACTIVE" as const],
        timing: "PUBLIC" as const,
      }));
    const f = projectSemanticActivityFrame({
      context,
      phase: "ACTIVE",
      support: "NONE",
      definition: binding.definition,
      ports: binding.ports,
      content: {
        references: entries,
        modelFacts: entries,
        derivedFacts: entries,
        responseContract: {
          id: "c02/S01/task",
          text: "Identify the starting gross income, each individual deduction, total deductions, and Anna's final take-home pay.",
        },
      },
    });
    expect(f.contentReferences).toEqual([]);
    expect(f.exposedModelFacts).toEqual([]);
    expect(f.exposedDerivedFacts).toEqual([]);
    expect(f.embeddedFloor).toBeUndefined();
    expect(f.c02Delivery).toBeUndefined();
    actor.stop();
  });
});
