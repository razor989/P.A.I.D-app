import { describe, expect, it } from "vitest";
type Mutable<T> = T extends object
  ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
  : T;
import {
  c04ResponseContracts,
  validateC04ResponseContracts,
} from "./response-contracts";

describe("canonical P10-T027-SC-FINAL-001 response authority", () => {
  it("retains exactly four versioned banks and optional response roles", () => {
    validateC04ResponseContracts();
    expect(
      c04ResponseContracts.map((record) => [
        record.activityId,
        record.scenarioId,
        record.contractId,
        record.version,
        record.choices[0]!.correctId,
      ]),
    ).toEqual([
      [
        "C04-A01",
        "C04-S01",
        "C04-A01-interpretation-v1",
        1,
        "c04-a01-no-change",
      ],
      [
        "C04-A02",
        "C04-S02",
        "C04-A02-comparison-v1",
        1,
        "c04-a02-different-originals",
      ],
      [
        "C04-A03",
        "C04-S03",
        "C04-A03-interpretation-v1",
        1,
        "c04-a03-decrease",
      ],
      [
        "C04-A04",
        "C04-S04",
        "C04-A04-explanation-v1",
        1,
        "c04-a04-original-zero",
      ],
    ]);
    expect(
      c04ResponseContracts.map((record) =>
        record.fields
          .filter((field) => !field.required)
          .map((field) => field.role),
      ),
    ).toEqual([["percentage"], ["originalA", "originalB"], [], []]);
    expect(
      c04ResponseContracts[3]!.stages.map((stage) => [
        stage.id,
        stage.visibleChoiceRoles,
      ]),
    ).toEqual([
      ["PRIMARY", []],
      ["REASONING", ["explanation"]],
    ]);
    expect(c04ResponseContracts[3]!.fields[1]!.acceptedKinds).toEqual([
      "EXACT_QUANTITY",
      "SEMANTIC_BOUNDARY",
    ]);
    expect(c04ResponseContracts[1]!.visibility.afterExplanationSteps).toEqual([
      "EXP-01",
      "EXP-02",
      "EXP-03",
      "EXP-04",
      "EXP-05",
    ]);
  });
  it("preserves exact ordered IDs and byte-faithful approved labels", () => {
    expect(
      c04ResponseContracts.map((record) =>
        record.choices[0]!.options.map((option) => [option.id, option.text]),
      ),
    ).toEqual([
      [
        ["c04-a01-no-change", "Maya’s monthly salary did not change."],
        ["c04-a01-increase", "Maya’s monthly salary increased."],
        ["c04-a01-decrease", "Maya’s monthly salary decreased."],
      ],
      [
        [
          "c04-a02-different-originals",
          "The peso increases are equal, but Employee B’s percentage increase is greater because it is compared with a smaller original salary.",
        ],
        [
          "c04-a02-same-percent",
          "The peso increases are equal, so the percentage increases are equal.",
        ],
        [
          "c04-a02-greater-original-greater-percent",
          "Employee A’s percentage increase is greater because Employee A started with the larger salary.",
        ],
      ],
      [
        [
          "c04-a03-decrease",
          "The revised monthly offer is lower than the original offer: the change is a decrease.",
        ],
        [
          "c04-a03-increase",
          "The revised monthly offer is higher than the original offer: the change is an increase.",
        ],
        [
          "c04-a03-no-change",
          "The revised monthly offer is the same as the original offer: there is no change.",
        ],
      ],
      [
        [
          "c04-a04-original-zero",
          "The formula requires division by the original value. The original value is zero, so the percentage change is undefined.",
        ],
        [
          "c04-a04-use-new",
          "Because the original value is zero, use the new value as the denominator to calculate the percentage change.",
        ],
      ],
    ]);
  });
  it("rejects source, structure, visibility, policy and provenance substitutions without repair", () => {
    const draft: Mutable<typeof c04ResponseContracts> =
      c04ResponseContracts.map(
        (record): Mutable<(typeof c04ResponseContracts)[number]> => {
          const { commitment, revisionPolicy, terminalTeaching, ...base } =
            record;
          return {
            ...base,
            fields: record.fields.map((field) => ({
              ...field,
              acceptedKinds: [...field.acceptedKinds],
            })),
            stages: record.stages.map((stage) => ({
              ...stage,
              editableFields: [...stage.editableFields],
              visibleChoiceRoles: [...stage.visibleChoiceRoles],
            })),
            choices: record.choices.map((choice) => ({
              ...choice,
              options: choice.options.map((option) => ({ ...option })),
              visibleStages: [...choice.visibleStages],
            })),
            visibility: {
              phases: [...record.visibility.phases],
              afterExplanationSteps: [
                ...record.visibility.afterExplanationSteps,
              ],
            },
            provenance: {
              ...record.provenance,
              sourceAnchors: [...record.provenance.sourceAnchors],
            },
            ...(commitment
              ? {
                  commitment: {
                    ...commitment,
                    fields: [...commitment.fields],
                  },
                }
              : {}),
            ...(revisionPolicy
              ? { revisionPolicy: { ...revisionPolicy } }
              : {}),
            ...(terminalTeaching
              ? {
                  terminalTeaching: {
                    ...terminalTeaching,
                    afterOutcomes: [
                      terminalTeaching.afterOutcomes[0],
                      terminalTeaching.afterOutcomes[1],
                    ],
                  },
                }
              : {}),
          };
        },
      );
    const mutations = [
      (bank: typeof draft) => bank.pop(),
      (bank: typeof draft) => {
        bank[0] = bank[1]!;
      },
      (bank: typeof draft) => {
        bank[0]!.scenarioId = "C04-S04";
      },
      (bank: typeof draft) => {
        bank[0]!.version = 2;
      },
      (bank: typeof draft) => {
        bank[0]!.fields[0]!.required = false;
      },
      (bank: typeof draft) => {
        bank[0]!.fields[0]!.acceptedKinds = ["TEXT"];
      },
      (bank: typeof draft) => {
        bank[0]!.choices[0]!.role = "explanation";
      },
      (bank: typeof draft) => {
        bank[0]!.choices[0]!.options[1]!.id =
          bank[0]!.choices[0]!.options[0]!.id;
      },
      (bank: typeof draft) => {
        bank[0]!.choices[0]!.options[0]!.text = "";
      },
      (bank: typeof draft) => {
        bank[0]!.choices[0]!.correctId = "approved:yes";
      },
      (bank: typeof draft) => {
        bank[3]!.choices[0]!.visibleStages = ["PRIMARY"];
      },
      (bank: typeof draft) => {
        delete bank[3]!.commitment;
      },
      (bank: typeof draft) => {
        delete bank[3]!.terminalTeaching;
      },
      (bank: typeof draft) => {
        bank[3]!.provenance.decisionId = "PROPOSED";
      },
    ];
    for (const mutate of mutations) {
      const copy = structuredClone(draft);
      mutate(copy);
      const before = JSON.stringify(copy);
      expect(() => validateC04ResponseContracts(copy)).toThrow(TypeError);
      expect(JSON.stringify(copy)).toBe(before);
    }
    expect(() => validateC04ResponseContracts(null)).toThrow();
    const accessor = [...c04ResponseContracts];
    Object.defineProperty(accessor, "0", {
      get: () => c04ResponseContracts[0],
    });
    expect(() => validateC04ResponseContracts(accessor)).toThrow();
  });
  it("deep-freezes every owned record including private correctness and references", () => {
    const visit = (value: unknown): void => {
      if (value && typeof value === "object") {
        expect(Object.isFrozen(value)).toBe(true);
        Object.values(value).forEach(visit);
      }
    };
    visit(c04ResponseContracts);
    expect(() =>
      Object.assign(c04ResponseContracts[3]!.choices[0]!.options[0]!, {
        text: "changed",
      }),
    ).toThrow();
    expect(
      c04ResponseContracts.every(
        (record) => record.provenance.decisionId === "P10-T027-SC-FINAL-001",
      ),
    ).toBe(true);
  });
});
