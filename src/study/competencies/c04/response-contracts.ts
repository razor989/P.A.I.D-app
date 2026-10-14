/** P10-T027-SC-FINAL-001 §§2–6; owner-approved additive F1 source extension.
 * Correctness belongs to trusted evaluation composition, never public controls.
 */
export type C04ResponseContract = Readonly<{
  contractId: string;
  version: number;
  activityId: string;
  scenarioId: string;
  fields: readonly Readonly<{
    role: string;
    required: boolean;
    acceptedKinds: readonly string[];
    quantityKind?: string;
    unit?: string;
    basis?: string | null;
  }>[];
  stages: readonly Readonly<{
    id: "RESPONSE" | "PRIMARY" | "REASONING";
    editableFields: readonly string[];
    visibleChoiceRoles: readonly string[];
  }>[];
  choices: readonly Readonly<{
    role: string;
    options: readonly Readonly<{ id: string; text: string }>[];
    correctId: string;
    visibleStages: readonly string[];
    incorrectFeedbackRef: string;
  }>[];
  commitment?: Readonly<{
    event: "COMMIT_PRIMARY_RESPONSE";
    fields: readonly string[];
    retainFirstSnapshot: true;
  }>;
  revisionPolicy?: Readonly<{
    event: "RETURN_TO_PRIMARY";
    clearDependentExplanation: true;
    requireRecommitment: true;
    retainFirstSnapshot: true;
  }>;
  confirmationFeedbackRef: string;
  terminalTeaching?: Readonly<{
    contentRef: string;
    afterOutcomes: readonly ["CONFIRMED", "RECONSIDERATION"];
    learnerControlled: true;
    deliveryBeforeFinish: true;
  }>;
  visibility: Readonly<{
    phases: readonly string[];
    afterExplanationSteps: readonly string[];
  }>;
  provenance: Readonly<{
    decisionId: string;
    sourceAnchors: readonly string[];
  }>;
}>;

const banks = [
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
] as const;
const roles = [
  "interpretation",
  "comparison",
  "interpretation",
  "explanation",
] as const;
const fieldRoles = [
  ["original", "new", "difference", "interpretation", "percentage"],
  [
    "originalA",
    "originalB",
    "differenceA",
    "differenceB",
    "percentageA",
    "percentageB",
    "comparison",
  ],
  ["original", "new", "difference", "percentage", "interpretation"],
  ["difference", "percentage", "explanation"],
] as const;
const anchors = [
  "C3 final §§19–22",
  "C3 earlier §58; final §§32–36",
  "C3 earlier §95; final §§46–49",
  "C3 final §§63–67,89; C2 §70",
];
const feedback = [
  "reconsider-interpretation",
  "reconsider-interpretation",
  "reconsider-direction",
  "reconsider-prohibited-substitutions",
];

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export const c04ResponseContracts: readonly C04ResponseContract[] = freeze(
  roles.map((role, index): C04ResponseContract => {
    const prefix = `c04/S0${index + 1}`;
    const fields = fieldRoles[index]!.map((key) => ({
      role: key,
      required:
        !(index === 0 && key === "percentage") &&
        !(index === 1 && key.startsWith("original")),
      acceptedKinds:
        key === role
          ? ["SINGLE_SELECTION"]
          : ["EXACT_QUANTITY", "SEMANTIC_BOUNDARY"],
      ...(key === role
        ? {}
        : {
            quantityKind: key.startsWith("percentage")
              ? "PERCENTAGE_CHANGE"
              : "MONETARY_AMOUNT",
            unit: key.startsWith("percentage") ? "%" : "PHP",
            basis: key.startsWith("percentage") ? null : "per month",
          }),
    }));
    return {
      contractId: `C04-A0${index + 1}-${role}-v1`,
      version: 1,
      activityId: `C04-A0${index + 1}`,
      scenarioId: `C04-S0${index + 1}`,
      fields,
      stages:
        index === 3
          ? [
              {
                id: "PRIMARY",
                editableFields: ["difference", "percentage"],
                visibleChoiceRoles: [],
              },
              {
                id: "REASONING",
                editableFields: ["explanation"],
                visibleChoiceRoles: [role],
              },
            ]
          : [
              {
                id: "RESPONSE",
                editableFields: [...fieldRoles[index]!],
                visibleChoiceRoles: [role],
              },
            ],
      choices: [
        {
          role,
          options: banks[index]!.map(([id, text]) => ({ id, text })),
          correctId: banks[index]![0][0],
          visibleStages: [index === 3 ? "REASONING" : "RESPONSE"],
          incorrectFeedbackRef: `${prefix}/${feedback[index]}`,
        },
      ],
      ...(index === 3
        ? {
            commitment: {
              event: "COMMIT_PRIMARY_RESPONSE" as const,
              fields: ["difference", "percentage"],
              retainFirstSnapshot: true as const,
            },
            revisionPolicy: {
              event: "RETURN_TO_PRIMARY" as const,
              clearDependentExplanation: true as const,
              requireRecommitment: true as const,
              retainFirstSnapshot: true as const,
            },
            terminalTeaching: {
              contentRef: `${prefix}/undefined-result`,
              afterOutcomes: ["CONFIRMED", "RECONSIDERATION"] as const,
              learnerControlled: true as const,
              deliveryBeforeFinish: true as const,
            },
          }
        : {}),
      confirmationFeedbackRef: `${prefix}/confirmation`,
      visibility: {
        phases: ["ACTIVE", "REVISION"],
        afterExplanationSteps:
          index === 1 ? ["EXP-01", "EXP-02", "EXP-03", "EXP-04", "EXP-05"] : [],
      },
      provenance: {
        decisionId: "P10-T027-SC-FINAL-001",
        sourceAnchors: [anchors[index]!],
      },
    };
  }),
);

// Exact fixed-bank validation rejects substitutions as well as structural drift.
// Validation neither freezes nor repairs caller input.
function equal(actual: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== "object")
    return actual === expected;
  if (
    actual === null ||
    typeof actual !== "object" ||
    Array.isArray(actual) !== Array.isArray(expected)
  )
    return false;
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected))
    return false;
  const keys = Reflect.ownKeys(expected);
  return (
    Reflect.ownKeys(actual).length === keys.length &&
    keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(actual, key);
      return (
        descriptor !== undefined &&
        "value" in descriptor &&
        equal(descriptor.value, (expected as Record<PropertyKey, unknown>)[key])
      );
    })
  );
}
export function validateC04ResponseContracts(
  value: unknown = c04ResponseContracts,
): asserts value is readonly C04ResponseContract[] {
  if (!equal(value, c04ResponseContracts))
    throw new TypeError("C04 canonical response-contract mismatch");
}

validateC04ResponseContracts();
