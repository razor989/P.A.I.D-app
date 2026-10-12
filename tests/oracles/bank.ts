/** T018 ONLY. Literal, independently transcribed source outcomes; never import into src/. */
import type {
  ActivityId,
  CompetencyId,
  ScenarioId,
} from "../../src/core/ids/public";

const root = "03 Decisions/Implementation-Baseline/A/";
const banks = {
  C01: "PP10-A-0202-C01-001 #U2014 Final Scenario Bank.md",
  C02: "PP10-A-0202-C02-001 #U2014 C02 Final Exact Scenario Bank.md",
  C03: "PP10-A-0202-C03-001 #U2014 C03 Final Exact Scenario Bank.md",
  C04: "PP10-A-0202-C04-001 #U2014 C04 Final Exact Scenario Bank.md",
  C05: "PP10-A-0202-C05-001 #U2014 C05 Final Exact Scenario Bank.md",
  C06: "PP10-A-0202-C06-001 #U2014 C06 Final Exact Scenario Bank.md",
} as const;
export const sources = Object.freeze({
  banks: Object.freeze(banks),
  fletcher:
    root +
    "PP10-A-0202-C02-001-A1 #U2014 Fletcher BIR Known-Answer Correction.md",
  floor:
    root +
    "PP10-A-0202-C02-001-A2 #U2014 C02 PhilHealth Floor-Coverage Completion.md",
  statutory:
    root + "PP10-A-001-STAT-001 #U2014 Statutory Deduction Parameter Set.md",
  james:
    root +
    "PP10-A-0202-XDEP-001 #U2014 James C05#U2192C01 Provider-Provenance Closure.md",
  percentageAudit: "01 Project/PASS-9-UI-UX-SPECIFICATION.md",
  register: "03 Decisions/Implementation-Baseline/KNOWN-ANSWER-REGISTER.md",
});

export type FixtureClass =
  "PRIMARY" | "VARIANT" | "SUPPORTING" | "STATUTORY_QA" | "POLICY";
export type Oracle = Readonly<{
  id: string;
  class: FixtureClass;
  competencyId: CompetencyId | null;
  activityId: ActivityId | null;
  scenarioId: ScenarioId | null;
  caseId: string | null; // source-authorized child OR source-named internal variant; never invent a canonical child
  role: string;
  source: Readonly<{ path: string; section: string; decision: string }>;
  conditions: readonly string[];
  expected: Readonly<{
    resolution: "KNOWN" | "NOT_APPLICABLE" | "UNKNOWN" | "UNDEFINED";
    availability: "AVAILABLE" | "WITHHELD";
    magnitude: string | null;
    kind: string;
    unit: string;
    basis: string | null;
  }> | null;
  policy: Readonly<{ condition: string; behavior: string }> | null;
}>;

type Row = readonly [
  string,
  string,
  string,
  string,
  string | null,
  string | null,
];
// role, magnitude (or semantic state), kind, unit, basis, optional explanation.
const money = (
  role: string,
  magnitude: string,
  basis: string | null = null,
): Row => [role, magnitude, "MONETARY_AMOUNT", "PHP", basis, null];
const percent = (role: string, magnitude: string): Row => [
  role,
  magnitude,
  "PERCENTAGE_CHANGE",
  "%",
  null,
  null,
];
const boundary = (
  role: string,
  state: string,
  kind = "MONETARY_AMOUNT",
  unit = "PHP",
  basis: string | null = null,
): Row => [role, state, kind, unit, basis, null];

type ScenarioSpec = Readonly<{
  competency: CompetencyId;
  ordinal: number;
  conditions: readonly string[];
  cases: readonly Readonly<{
    label: string | null;
    outputs: readonly Row[];
    section?: string;
    source?: string;
    decision?: string;
  }>[];
}>;

/** Written from the full §20.2 scenario records, not from production results. */
export const scenarioLedger: readonly ScenarioSpec[] = [
  {
    competency: "C01",
    ordinal: 1,
    conditions: [
      "April: 18000 base + 1200 meal allowance; March overtime 900 excluded",
    ],
    cases: [
      { label: null, outputs: [money("gross-income", "19200.00", "April")] },
    ],
  },
  {
    competency: "C01",
    ordinal: 2,
    conditions: ["May: 17250 regular + 1750 transportation allowance"],
    cases: [
      { label: null, outputs: [money("gross-income", "19000.00", "May")] },
    ],
  },
  {
    competency: "C01",
    ordinal: 3,
    conditions: [
      "James: C05 regular 12000; C03 ordinary overtime 937.50; same month",
    ],
    cases: [
      {
        label: null,
        outputs: [money("gross-income", "12937.50", "per month")],
      },
    ],
  },
  {
    competency: "C01",
    ordinal: 4,
    conditions: [
      "Lina: June base 15000, C06 commission ONLY 3600, communication allowance 800",
    ],
    cases: [
      { label: null, outputs: [money("gross-income", "19400.00", "June")] },
    ],
  },
  {
    competency: "C02",
    ordinal: 1,
    conditions: [
      "Anna: gross 12100; private SSS 600, PhilHealth 302.50, Pag-IBIG 200; BIR established zero",
    ],
    cases: [
      {
        label: null,
        outputs: [
          money("total-deductions", "1102.50"),
          money("net-pay", "10997.50"),
          money("BIR", "0.00"),
          boundary("GSIS", "NOT_APPLICABLE"),
        ],
      },
    ],
  },
  {
    competency: "C02",
    ordinal: 2,
    conditions: [
      "James: C01 gross 12937.50, basic 12000; SSS 650, PhilHealth 300, Pag-IBIG 200, BIR zero",
    ],
    cases: [
      {
        label: null,
        outputs: [
          money("total-deductions", "1150.00"),
          money("net-pay", "11787.50"),
          money("BIR", "0.00"),
        ],
      },
    ],
  },
  {
    competency: "C02",
    ordinal: 3,
    conditions: [
      "Fletcher: government salary 24000; GSIS 2160, PhilHealth 600, Pag-IBIG 200; taxable 21040",
    ],
    cases: [
      {
        label: null,
        source: sources.fletcher,
        section: "§1 C02-S03",
        decision: "PP10-A-0202-C02-001-A1 supersedes C02-001",
        outputs: [
          money("BIR", "31.05"),
          money("total-deductions", "2991.05"),
          money("net-pay", "21008.95"),
          boundary("SSS", "NOT_APPLICABLE"),
        ],
      },
    ],
  },
  {
    competency: "C02",
    ordinal: 4,
    conditions: [
      "Alex: two private jobs, gross 28000; Job A basic 25000 + 3000 explicitly non-taxable; Job B gross/basic 28000",
    ],
    cases: [
      {
        label: "Job A",
        outputs: [
          money("total-deductions", "2516.30"),
          money("net-pay", "25483.70"),
        ],
      },
      {
        label: "Job B",
        outputs: [
          money("total-deductions", "3030.05"),
          money("net-pay", "24969.95"),
        ],
      },
    ],
  },
  {
    competency: "C03",
    ordinal: 1,
    conditions: [
      "ordinary working day; 100 PHP/hour; 2 OT hours; condition factor 1.25",
    ],
    cases: [{ label: null, outputs: [money("overtime-pay", "250.00")] }],
  },
  {
    competency: "C03",
    ordinal: 2,
    conditions: [
      "100 PHP/hour; 2 OT hours; compare condition-dependent factors",
    ],
    cases: [
      {
        label: "C03-S02-A",
        outputs: [money("overtime-pay", "250.00")],
        section: "§C03-S02 Situation A ordinary working day; factor 1.25",
      },
      {
        label: "C03-S02-B",
        outputs: [money("overtime-pay", "338.00")],
        section: "§C03-S02 Situation B rest day; factor 1.69",
      },
    ],
  },
  {
    competency: "C03",
    ordinal: 3,
    conditions: [
      "James: ordinary working day; 75 PHP/hour; 10 OT hours; factor 1.25",
    ],
    cases: [{ label: null, outputs: [money("overtime-pay", "937.50")] }],
  },
  {
    competency: "C03",
    ordinal: 4,
    conditions: ["regular holiday; 120 PHP/hour; 3 OT hours; factor 2.60"],
    cases: [{ label: null, outputs: [money("overtime-pay", "936.00")] }],
  },
  {
    competency: "C04",
    ordinal: 1,
    conditions: ["monthly original 18000; new 18000; unchanged"],
    cases: [{ label: null, outputs: [percent("percentage-change", "0")] }],
  },
  {
    competency: "C04",
    ordinal: 2,
    conditions: [
      "same absolute monthly raise 2000; distinct original reference values",
    ],
    cases: [
      {
        label: "C04-S02-A",
        section: "§C04-S02 Situation A 20000→22000",
        outputs: [percent("percentage-change", "+10")],
      },
      {
        label: "C04-S02-B",
        section: "§C04-S02 Situation B 10000→12000",
        outputs: [percent("percentage-change", "+20")],
      },
    ],
  },
  {
    competency: "C04",
    ordinal: 3,
    conditions: ["monthly original 30000; new 27000; decrease"],
    cases: [{ label: null, outputs: [percent("percentage-change", "-10")] }],
  },
  {
    competency: "C04",
    ordinal: 4,
    conditions: ["monthly original 0; new 1500; no replacement denominator"],
    cases: [
      {
        label: null,
        outputs: [
          money("absolute-difference", "+1500", "per month"),
          boundary("percentage-change", "UNDEFINED", "PERCENTAGE_CHANGE", "%"),
        ],
      },
    ],
  },
  {
    competency: "C05",
    ordinal: 1,
    conditions: [
      "312000 PHP annually; 52 weeks/year; Prepare: relationship primary, numeric result guided",
    ],
    cases: [
      {
        label: null,
        outputs: [money("guided-weekly-representation", "6000", "per week")],
      },
    ],
  },
  {
    competency: "C05",
    ordinal: 2,
    conditions: [
      "teacher annual 480000; linked monthly then semi-monthly representations, not universal ladder",
    ],
    cases: [
      {
        label: "C05-S02-A",
        section: "§C05-S02 State A 12 months/year",
        outputs: [money("monthly-representation", "40000", "per month")],
      },
      {
        label: "C05-S02-B",
        section: "§C05-S02 State B 2 pay periods/month",
        outputs: [
          money(
            "semi-monthly-representation",
            "20000",
            "per semi-monthly pay period",
          ),
        ],
      },
    ],
  },
  {
    competency: "C05",
    ordinal: 3,
    conditions: ["936000 PHP annually; 52 weeks/year"],
    cases: [
      {
        label: null,
        outputs: [money("weekly-representation", "18000", "per week")],
      },
    ],
  },
  {
    competency: "C05",
    ordinal: 4,
    conditions: [
      "100 PHP/hour; 40 regular hours explicitly established for THIS week only",
    ],
    cases: [
      {
        label: null,
        outputs: [
          money(
            "weekly-representation",
            "4000",
            "per established 40-hour week",
          ),
        ],
      },
    ],
  },
  {
    competency: "C05",
    ordinal: 5,
    conditions: [
      "4000 PHP/day; approved five-day schedule; 261 working days/year; 12 months",
    ],
    cases: [
      {
        label: null,
        outputs: [
          money(
            "monthly-representation",
            "87000",
            "per month; approved 5-day/261-day/12-month basis",
          ),
        ],
      },
    ],
  },
  {
    competency: "C06",
    ordinal: 1,
    conditions: [
      "Worker A/B: sales 80000; commission rate 5%; arrangement determines applicability",
    ],
    cases: [
      {
        label: "Worker A",
        outputs: [
          money("commission", "4000"),
          boundary("base-salary", "NOT_APPLICABLE"),
          boundary("base-plus-total", "NOT_APPLICABLE"),
        ],
      },
      {
        label: "Worker B",
        outputs: [
          money("base-salary", "10000", "per month"),
          money("commission", "4000"),
          money("base-plus-total", "14000"),
        ],
      },
    ],
  },
  {
    competency: "C06",
    ordinal: 2,
    conditions: [
      "base-plus; 3% commission; monthly base 15000; fixed monthly sales comparison",
    ],
    cases: [
      {
        label: "Situation A",
        section: "§C06-S02 Situation A sales 300000",
        outputs: [
          money("commission", "9000", "per month"),
          money("base-plus-total", "24000", "per month"),
        ],
      },
      {
        label: "Situation B",
        section: "§C06-S02 Situation B sales 500000",
        outputs: [
          money("commission", "15000", "per month"),
          money("base-plus-total", "30000", "per month"),
        ],
      },
    ],
  },
  {
    competency: "C06",
    ordinal: 3,
    conditions: [
      "straight property sale 2000000; rate 5%; NO pay period established",
    ],
    cases: [
      {
        label: null,
        outputs: [
          money("commission", "100000"),
          boundary("base-salary", "NOT_APPLICABLE"),
          boundary("base-plus-total", "NOT_APPLICABLE"),
        ],
      },
    ],
  },
  {
    competency: "C06",
    ordinal: 4,
    conditions: [
      "Lina June monthly sales 120000; rate 3%; base 15000; provider to C01 commission ONLY",
    ],
    cases: [
      {
        label: null,
        outputs: [
          money("commission", "3600", "June"),
          money("base-plus-total", "18600", "June"),
        ],
      },
    ],
  },
];

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const unavailable = (
  state: string,
  magnitude: string | null,
  kind: string,
  unit: string,
  basis: string | null,
) =>
  ({
    resolution:
      state === "NOT_APPLICABLE" || state === "UNDEFINED" || state === "UNKNOWN"
        ? state
        : "KNOWN",
    availability:
      state === "UNDEFINED" || state === "UNKNOWN" ? "WITHHELD" : "AVAILABLE",
    magnitude,
    kind,
    unit,
    basis,
  }) as Oracle["expected"];

function entry(
  spec: ScenarioSpec,
  item: ScenarioSpec["cases"][number],
  row: Row,
): Oracle {
  const scenarioId = `${spec.competency}-S0${spec.ordinal}` as ScenarioId;
  const state = row[1];
  const semantic =
    state === "UNDEFINED" || state === "UNKNOWN" || state === "NOT_APPLICABLE";
  return {
    id: `${item.label ?? scenarioId}:${row[0]}`,
    class: item.label === null ? "PRIMARY" : "VARIANT",
    competencyId: spec.competency,
    activityId: `${spec.competency}-A0${spec.ordinal}` as ActivityId,
    scenarioId,
    caseId: item.label,
    role: row[0],
    source: {
      path: item.source ?? root + banks[spec.competency],
      section: item.section ?? `§${scenarioId}`,
      decision: item.decision ?? `PP10-A-0202-${spec.competency}-001`,
    },
    conditions: spec.conditions,
    expected: unavailable(
      state,
      semantic ? null : state,
      row[2],
      row[3],
      row[4],
    ),
    policy: null,
  };
}

const primary = scenarioLedger.flatMap((spec) =>
  spec.cases.flatMap((item) =>
    item.outputs.map((row) => entry(spec, item, row)),
  ),
);

type Extra = readonly [
  CompetencyId,
  ActivityId | null,
  ScenarioId | null,
  string | null,
  string,
  string,
  string,
  string,
  string | null,
  string,
  string,
  readonly string[],
  FixtureClass,
];
// competency, activity, scenario, case, role, literal/state, kind, unit, basis, path, section, established conditions, class.
const extras: readonly Extra[] = [
  [
    "C01",
    "C01-A01",
    "C01-S01",
    "missing-applicability",
    "gross-income",
    "UNKNOWN",
    "MONETARY_AMOUNT",
    "PHP",
    "April",
    root + banks.C01,
    "§C01-S01 Information needed",
    [
      "earnings amount or applicability missing; dependent gross WITHHELD, not zero",
    ],
    "SUPPORTING",
  ],
  [
    "C02",
    "C02-A01",
    "C02-S01",
    "C02-S01-F",
    "PhilHealth",
    "250.00",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.floor,
    "§C02-S01-F",
    ["basic salary 8000; floor basis 10000; employee share"],
    "SUPPORTING",
  ],
  [
    "C02",
    "C02-A01",
    "C02-S01",
    "missing-classification",
    "net-pay",
    "UNKNOWN",
    "MONETARY_AMOUNT",
    "PHP",
    null,
    sources.statutory,
    "§Classification / withheld",
    ["SSS versus GSIS classification unresolved; dependent net withheld"],
    "SUPPORTING",
  ],
  [
    "C03",
    "C03-A01",
    "C03-S01",
    "zero-hours",
    "overtime-pay",
    "0",
    "MONETARY_AMOUNT",
    "PHP",
    null,
    root + banks.C03,
    "§C03-S01; §20.6 explicit zero hours",
    [
      "ordinary condition, rate 100/hour, overtime hours explicitly established zero",
    ],
    "SUPPORTING",
  ],
  [
    "C03",
    "C03-A01",
    "C03-S01",
    "missing-hours",
    "overtime-pay",
    "UNKNOWN",
    "MONETARY_AMOUNT",
    "PHP",
    null,
    root + banks.C03,
    "§C03-S01; §20.6 unknown hours",
    ["ordinary condition, rate 100/hour, hours unknown; result withheld"],
    "SUPPORTING",
  ],
  [
    "C04",
    null,
    null,
    "600-to-650",
    "percentage-change",
    "8.33",
    "PERCENTAGE_CHANGE",
    "%",
    null,
    sources.percentageAudit,
    "§20.1 supplementary audit",
    ["600 original; 650 new; supplementary audit precision +8.33%"],
    "SUPPORTING",
  ],
  [
    "C05",
    "C05-A04",
    "C05-S04",
    "missing-schedule",
    "weekly-representation",
    "UNKNOWN",
    "MONETARY_AMOUNT",
    "PHP",
    null,
    root + banks.C05,
    "§C05-S04 missing schedule",
    [
      "hourly rate known; weekly schedule absent: cannot assume 40 hours or 5 days, 261 or 313 days",
    ],
    "SUPPORTING",
  ],
  [
    "C05",
    null,
    null,
    "C05-PV-JAMES-01",
    "regular-pay",
    "12000",
    "MONETARY_AMOUNT",
    "PHP",
    null,
    sources.james,
    "§C05-PV-JAMES-01",
    ["James 75 PHP/hour; 160 regular hours; provider to C01-S03 only"],
    "SUPPORTING",
  ],
  [
    "C06",
    "C06-A02",
    "C06-S02",
    "missing-sales",
    "commission",
    "UNKNOWN",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    root + banks.C06,
    "§C06-S02 missing sales/rate",
    ["sales or rate unknown; result withheld"],
    "SUPPORTING",
  ],
  [
    "C06",
    "C06-A02",
    "C06-S02",
    "missing-base",
    "base-plus-total",
    "UNKNOWN",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    root + banks.C06,
    "§C06-S02 missing base",
    [
      "sales/rate known; commission remains established; base salary unknown; total withheld",
    ],
    "SUPPORTING",
  ],
];

const qa: readonly Extra[] = [
  [
    "C02",
    null,
    null,
    "SSS-min",
    "SSS",
    "250",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.statutory,
    "§Known-answer cases SSS minimum",
    ["ordinary business employee; compensation below 5250; MSC 5000"],
    "STATUTORY_QA",
  ],
  [
    "C02",
    null,
    null,
    "SSS-30k",
    "SSS",
    "1500",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.statutory,
    "§Known-answer cases SSS 30000",
    ["ordinary private; MSC 30000"],
    "STATUTORY_QA",
  ],
  [
    "C02",
    null,
    null,
    "SSS-max",
    "SSS",
    "1750",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.statutory,
    "§Known-answer cases SSS maximum",
    ["ordinary business; compensation >=34750; MSC 35000"],
    "STATUTORY_QA",
  ],
  [
    "C02",
    null,
    null,
    "GSIS-30k",
    "GSIS",
    "2700",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.statutory,
    "§Known-answer cases GSIS",
    ["ordinary government member; salary 30000"],
    "STATUTORY_QA",
  ],
  [
    "C02",
    null,
    null,
    "PagIBIG-low",
    "Pag-IBIG",
    "15",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.statutory,
    "§Known-answer cases Pag-IBIG low",
    ["fund salary 1500"],
    "STATUTORY_QA",
  ],
  [
    "C02",
    null,
    null,
    "PagIBIG-cap",
    "Pag-IBIG",
    "200",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.statutory,
    "§Known-answer cases Pag-IBIG cap",
    ["fund salary 15000; MFS cap 10000"],
    "STATUTORY_QA",
  ],
  [
    "C02",
    null,
    null,
    "PhilHealth-30k",
    "PhilHealth",
    "750",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.statutory,
    "§Known-answer cases PhilHealth ordinary",
    ["MBS 30000; total premium 1500; employee half"],
    "STATUTORY_QA",
  ],
  [
    "C02",
    null,
    null,
    "PhilHealth-floor",
    "PhilHealth",
    "250",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.statutory,
    "§Known-answer cases PhilHealth floor",
    ["MBS 8000; floor 10000"],
    "STATUTORY_QA",
  ],
  [
    "C02",
    null,
    null,
    "PhilHealth-ceiling",
    "PhilHealth",
    "2500",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.statutory,
    "§Known-answer cases PhilHealth ceiling",
    ["MBS 120000; ceiling 100000"],
    "STATUTORY_QA",
  ],
  [
    "C02",
    null,
    null,
    "BIR-30k",
    "BIR",
    "1375.05",
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.statutory,
    "§Known-answer cases BIR",
    ["monthly taxable compensation 30000; bracket threshold 20833"],
    "STATUTORY_QA",
  ],
  ...(
    [
      ["SSS", "1500"],
      ["PhilHealth", "750"],
      ["Pag-IBIG", "200"],
      ["BIR", "1007.55"],
      ["total-deductions", "3457.55"],
      ["net-pay", "26542.45"],
    ] as const
  ).map(([role, value]): Extra => [
    "C02",
    null,
    null,
    "private-30k-integration",
    role,
    value,
    "MONETARY_AMOUNT",
    "PHP",
    "per month",
    sources.register,
    "§8 Integrated ordinary-private-employee oracle",
    [
      "gross/basic 30000; ordinary private employee; no other earnings/deductions/non-taxable benefits; monthly BIR",
    ],
    "STATUTORY_QA",
  ]),
];

function extra(row: Extra): Oracle {
  const [
    competencyId,
    activityId,
    scenarioId,
    caseId,
    role,
    state,
    kind,
    unit,
    basis,
    path,
    section,
    conditions,
    fixtureClass,
  ] = row;
  return {
    id: `${caseId}:${role}`,
    class: fixtureClass,
    competencyId,
    activityId,
    scenarioId,
    caseId,
    role,
    source: {
      path,
      section,
      decision:
        path === sources.register
          ? "PP10-A-001-STAT-001 (register §8 bounded case)"
          : path.split("/").at(-1)!.split(" #U2014")[0]!,
    },
    conditions,
    expected: unavailable(
      state,
      state === "UNKNOWN" ? null : state,
      kind,
      unit,
      basis,
    ),
    policy: null,
  };
}

const policies = [
  [
    "adaptation",
    "PP10-A-0207-001",
    "performance differs",
    "no adaptive difficulty or parameter sequence",
  ],
  [
    "scoring",
    "PP10-A-0208-001",
    "respond/retry/review",
    "no scores or score penalties",
  ],
  [
    "mastery",
    "PP10-A-0209-001",
    "confirmed or complete",
    "no mastery/proficiency/pass gate",
  ],
  [
    "retry",
    "PP10-A-0210-001",
    "recheck after feedback",
    "same scenario; no retry counter, penalty or cooldown",
  ],
  [
    "assessment",
    "PP10-A-0211-001",
    "response evaluated",
    "formative only; no summative grade or certification",
  ],
  [
    "completion",
    "PP10-A-0212-001",
    "requirements performed and feedback received",
    "may complete without confirmed response; counts not performance",
  ],
  [
    "progress",
    "PP10-A-0213-001 / -002",
    "authoritative count available or absent",
    "show completed-of-total only when authoritative; otherwise omit aggregate",
  ],
  [
    "persistence",
    "PP10-C-014-001",
    "unexpected close during active state",
    "recover minimum unfinished state, not permanent history",
  ],
  [
    "resume",
    "PP10-C-015-001",
    "valid unfinished state",
    "Continue same state or Abandon without performance consequence",
  ],
  [
    "accounts",
    "PP10-C-016-001",
    "fresh entry",
    "no login/registration/profile/participant-ID gate",
  ],
  [
    "connectivity",
    "PP10-C-017-001",
    "network unavailable",
    "required use does not require remote service",
  ],
  [
    "offline",
    "PP10-C-018-001",
    "offline device",
    "required study and recovery usable locally without sync",
  ],
  [
    "recovery",
    "PP10-C-019-001",
    "recoverable local failure",
    "retry preserves scenario; do not guess state; safe exit",
  ],
  [
    "telemetry",
    "PP10-C-032-001",
    "participant use",
    "no participant telemetry collected/retained/transmitted",
  ],
] as const;

const policyFiles = Object.freeze({
  "PP10-A-0207-001": "A/PP10-A-0207-001#U2014 Difficulty and Adaptation.md",
  "PP10-A-0208-001": "A/PP10-A-0208-001 #U2014 Scoring.md",
  "PP10-A-0209-001": "A/PP10-A-0209-001 #U2014 Mastery.md",
  "PP10-A-0210-001": "A/PP10-A-0210-001#U2014 Retry Policy.md",
  "PP10-A-0211-001": "A/PP10-A-0211-001#U2014 Assessment Policy.md",
  "PP10-A-0212-001":
    "A/PP10-A-0212-001 #U2014 Completion Beyond Current Activity.md",
  "PP10-A-0213-001 / -002":
    "A/PP10-A-0213-002 #U2014 Textual Completion-Count Presentation Boundary.md",
  "PP10-C-014-001": "C/PP10-C-014-001#U2014 Persistence.md",
  "PP10-C-015-001": "C/PP10-C-015-001#U2014 Resume Behavior.md",
  "PP10-C-016-001": "C/PP10-C-016-001#U2014 Account and Session Behavior.md",
  "PP10-C-017-001": "C/PP10-C-017-001 #U2014 Connectivity.md",
  "PP10-C-018-001": "C/PP10-C-018-001#U2014 Offline Behavior.md",
  "PP10-C-019-001":
    "C/PP10-C-019-001 #U2014 Loading and Technical Recovery States.md",
  "PP10-C-032-001": "C/PP10-C-032-001 #U2014 Analytics  Telemetry.md",
});

export const oracles: readonly Oracle[] = freeze([
  ...primary,
  ...extras.map(extra),
  ...qa.map(extra),
  ...policies.map(([id, decision, condition, behavior]): Oracle => ({
    id: `policy:${id}`,
    class: "POLICY",
    competencyId: null,
    activityId: null,
    scenarioId: null,
    caseId: null,
    role: id,
    source: {
      path: `03 Decisions/Implementation-Baseline/${policyFiles[decision]}`,
      section: `§${decision} Exact decision`,
      decision,
    },
    conditions: [condition],
    expected: null,
    policy: { condition, behavior },
  })),
]);

// Freeze ledger as well: map/flatMap create new OUTER arrays, which are not frozen by freezing children.
freeze(scenarioLedger);
