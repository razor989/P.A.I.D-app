/** Canonical study identity; display names and historical aliases are not IDs. */
export const COMPETENCY_IDS = [
  "C01",
  "C02",
  "C03",
  "C04",
  "C05",
  "C06",
] as const;
export type CompetencyId = (typeof COMPETENCY_IDS)[number];

type FourActivityCompetency = Exclude<CompetencyId, "C05">;
export type ActivityId =
  `${FourActivityCompetency}-A0${1 | 2 | 3 | 4}` | `C05-A0${1 | 2 | 3 | 4 | 5}`;

type NonzeroDigit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Digit = 0 | NonzeroDigit;

/** Two-digit form only (01–99); scenario-bank membership is later-owned. */
export type ScenarioId =
  | `${CompetencyId}-S${0}${NonzeroDigit}`
  | `${CompetencyId}-S${NonzeroDigit}${Digit}`;
/** Established child suffix form only; does not assert bank membership. */
export type ScenarioChildId = `${ScenarioId}-${"A" | "B"}`;
export type SupportingRecordId = "C02-S01-F";
export type ProviderRecordId = "C05-PV-JAMES-01";

export function isCompetencyId(value: unknown): value is CompetencyId {
  return typeof value === "string" && COMPETENCY_IDS.some((id) => id === value);
}

export function isActivityId(value: unknown): value is ActivityId {
  if (typeof value !== "string") return false;
  const match = /^(C0[1-6])-A0([1-5])$/.exec(value);
  return match !== null && (match[2] !== "5" || match[1] === "C05");
}

export function isScenarioId(value: unknown): value is ScenarioId {
  return (
    typeof value === "string" && /^C0[1-6]-S(0[1-9]|[1-9][0-9])$/.test(value)
  );
}

export function isScenarioChildId(value: unknown): value is ScenarioChildId {
  return (
    typeof value === "string" &&
    /^C0[1-6]-S(0[1-9]|[1-9][0-9])-[AB]$/.test(value)
  );
}

export function isSupportingRecordId(
  value: unknown,
): value is SupportingRecordId {
  return value === "C02-S01-F";
}

export function isProviderRecordId(value: unknown): value is ProviderRecordId {
  return value === "C05-PV-JAMES-01";
}
