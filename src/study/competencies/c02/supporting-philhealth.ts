import { ExactDecimal, quantity } from "../../../core/public";
import type { ActivityId, Quantity } from "../../../core/public";
import { c02Copy } from "./content";

/** A01-only support: outcome/rejected comparison are in role-scoped copy, not an oracle. */
export type PhilHealthFloorSupport = Readonly<{
  id: "C02-S01-F";
  activityId: ActivityId;
  primaryScenarioId: "C02-S01";
  period: "monthly";
  basicSalary: Quantity;
  minimumContributionBasis: Quantity;
  employeeShareRate: "2.5%";
  contentKeys: readonly (keyof typeof c02Copy)[];
}>;

const money = (value: string) =>
  quantity(ExactDecimal.from(value), "MONETARY_AMOUNT", "PHP", null);

export const c02PhilHealthFloor: PhilHealthFloorSupport = Object.freeze({
  id: "C02-S01-F",
  activityId: "C02-A01",
  primaryScenarioId: "C02-S01",
  period: "monthly",
  basicSalary: Object.freeze(money("8000.00")),
  minimumContributionBasis: Object.freeze(money("10000.00")),
  employeeShareRate: "2.5%",
  contentKeys: Object.freeze([
    "c02/S01-F/scenario",
    "c02/S01-F/task",
    "c02/S01-F/relationship-help",
    "c02/S01-F/confirmation",
    "c02/S01-F/reconsider",
    "c02/S01-F/accessibility-summary",
  ] as const),
});
